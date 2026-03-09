import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, hashPassword, comparePassword, requireAuth, requirePermission, requireActivePassword } from "./auth";
import { seedDatabase } from "./seed";
import { loginSchema, insertAgreementSchema, insertTargetSchema, insertCommissionRuleSchema, insertContactSchema, insertUniversitySchema, PERMISSION_REGISTRY, LEGACY_PERMISSION_MAP } from "@shared/schema";
import { sendPasswordResetEmail, sendLoginOtpEmail, verifyEmailConnection } from "./email";
import { calculateEntry, computeMasterFromEntries, STUDENT_STATUSES, PAYMENT_STATUSES } from "./commission-calc";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { UAParser } from "ua-parser-js";

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF and DOC/DOCX files are allowed"));
    }
  },
});

function validatePeriodKey(targetType: string, periodKey: string): string | null {
  if (targetType === "yearly") {
    if (!/^\d{4}$/.test(periodKey)) return "Yearly period key must be a 4-digit year (e.g., 2026)";
  } else if (targetType === "monthly") {
    if (!/^\d{4}-\d{2}$/.test(periodKey)) return "Monthly period key must be YYYY-MM format (e.g., 2026-07)";
  } else if (targetType === "intake") {
    if (!/^[A-Za-z0-9]+-\d{4}$/.test(periodKey)) return "Intake period key must be like T1-2026, T2-2026";
  }
  return null;
}

function parseDeviceInfo(userAgent: string) {
  const parser = new UAParser(userAgent);
  const result = parser.getResult();
  const browser = result.browser;
  const os = result.os;
  const device = result.device;
  return {
    browser: `${browser.name || "Unknown"} ${browser.version || ""}`.trim(),
    os: `${os.name || "Unknown"} ${os.version || ""}`.trim(),
    deviceType: device.type || "desktop",
  };
}

function getUA(req: any): string {
  const ua = req.headers["user-agent"];
  if (Array.isArray(ua)) return ua[0] || "";
  return ua || "";
}

function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

function hashOtp(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

const PASSWORD_POLICY = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: true,
};

function validatePasswordPolicy(password: string): string | null {
  if (password.length < PASSWORD_POLICY.minLength) return `Password must be at least ${PASSWORD_POLICY.minLength} characters`;
  if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter";
  if (PASSWORD_POLICY.requireLowercase && !/[a-z]/.test(password)) return "Password must contain at least one lowercase letter";
  if (PASSWORD_POLICY.requireNumber && !/[0-9]/.test(password)) return "Password must contain at least one number";
  if (PASSWORD_POLICY.requireSpecial && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return "Password must contain at least one special character";
  return null;
}

const loginAttemptTracker = new Map<string, { count: number; lockedUntil: number }>();
const OTP_EXPIRY_MINUTES = 5;
const MAX_OTP_ATTEMPTS = 5;
const MAX_OTP_RESENDS = 3;
const PASSWORD_EXPIRY_DAYS = 90;
const PASSWORD_WARNING_DAYS = 14;

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  await seedDatabase();

  app.use("/api", requireActivePassword);

  app.post("/api/auth/login", async (req, res) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid credentials format" });
      }
      const { email, password } = parsed.data;
      const clientIp = req.ip || "unknown";

      const tracker = loginAttemptTracker.get(email);
      if (tracker && tracker.lockedUntil > Date.now()) {
        const remainSec = Math.ceil((tracker.lockedUntil - Date.now()) / 1000);
        await storage.createSecurityAuditLog({ eventType: "LOGIN_LOCKED", ipAddress: clientIp, metadata: { email, remainSec } });
        return res.status(429).json({ message: `Too many failed attempts. Try again in ${remainSec} seconds.` });
      }

      const user = await storage.getUserByEmail(email);
      if (!user || !user.isActive) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      const valid = await comparePassword(password, user.passwordHash);
      if (!valid) {
        const entry = loginAttemptTracker.get(email) || { count: 0, lockedUntil: 0 };
        entry.count++;
        if (entry.count >= 5) {
          entry.lockedUntil = Date.now() + 15 * 60 * 1000;
          entry.count = 0;
        }
        loginAttemptTracker.set(email, entry);
        await storage.createAuditLog({ userId: user.id, action: "LOGIN_FAILED", entityType: "user", entityId: user.id, ipAddress: clientIp });
        await storage.createSecurityAuditLog({ userId: user.id, eventType: "LOGIN_FAILED", ipAddress: clientIp, deviceInfo: getUA(req) });
        return res.status(401).json({ message: "Invalid email or password" });
      }

      loginAttemptTracker.delete(email);

      const otpCode = generateOtp();
      const otpHash = hashOtp(otpCode);
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

      await storage.createLoginVerificationCode({ userId: user.id, codeHash: otpHash, expiresAt });

      let otpSent = false;
      try {
        await sendLoginOtpEmail(user.email, otpCode, OTP_EXPIRY_MINUTES);
        await storage.createSecurityAuditLog({ userId: user.id, eventType: "OTP_SENT", ipAddress: clientIp, deviceInfo: getUA(req) });
        otpSent = true;
        console.log(`[OTP] Code for ${user.email}: ${otpCode} (expires in ${OTP_EXPIRY_MINUTES} min)`);
      } catch (emailErr: any) {
        console.error("Failed to send OTP email:", emailErr.message);
        await storage.createSecurityAuditLog({ userId: user.id, eventType: "OTP_SEND_FAILED", ipAddress: clientIp, metadata: { error: emailErr.message } });
        console.log(`[OTP FALLBACK] Code for ${user.email}: ${otpCode} (email delivery failed)`);
      }

      req.session.pendingUserId = user.id;
      req.session.otpRequired = true;

      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      if (!otpSent) {
        return res.status(500).json({
          message: "Failed to send verification email. Please try again or contact an administrator.",
        });
      }

      res.json({
        requiresOtp: true,
        message: "Verification code sent to your email",
        email: user.email.replace(/(.{2})(.*)(@.*)/, "$1***$3"),
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/auth/verify-otp", async (req, res) => {
    try {
      const { code } = req.body;
      const userId = req.session.pendingUserId;
      if (!userId || !req.session.otpRequired) {
        return res.status(400).json({ message: "No pending verification. Please login again." });
      }

      const clientIp = req.ip || "unknown";
      const activeCode = await storage.getActiveVerificationCode(userId);

      if (!activeCode) {
        return res.status(400).json({ message: "Verification code expired. Please login again." });
      }

      if (activeCode.attempts >= MAX_OTP_ATTEMPTS) {
        await storage.updateVerificationCode(activeCode.id, { status: "exhausted" });
        await storage.createSecurityAuditLog({ userId, eventType: "OTP_EXHAUSTED", ipAddress: clientIp });
        delete req.session.pendingUserId;
        delete req.session.otpRequired;
        return res.status(400).json({ message: "Too many attempts. Please login again." });
      }

      await storage.updateVerificationCode(activeCode.id, { attempts: activeCode.attempts + 1 });

      if (hashOtp(code) !== activeCode.codeHash) {
        await storage.createSecurityAuditLog({ userId, eventType: "OTP_FAILED", ipAddress: clientIp });
        const remaining = MAX_OTP_ATTEMPTS - activeCode.attempts - 1;
        return res.status(401).json({ message: `Invalid code. ${remaining} attempt(s) remaining.` });
      }

      await storage.updateVerificationCode(activeCode.id, { status: "used", usedAt: new Date() });
      await storage.createSecurityAuditLog({ userId, eventType: "OTP_VERIFIED", ipAddress: clientIp, deviceInfo: getUA(req) });

      const user = await storage.getUser(userId);
      if (!user) return res.status(401).json({ message: "User not found" });

      const perms = await storage.getUserPermissions(user.id);
      const userRolesData = await storage.getUserRoles(user.id);
      req.session.userId = user.id;
      req.session.userPermissions = perms;
      delete req.session.pendingUserId;
      delete req.session.otpRequired;

      const deviceInfo = parseDeviceInfo(getUA(req));
      await storage.createUserSession({
        userId: user.id,
        sessionToken: req.sessionID,
        ipAddress: clientIp,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        deviceType: deviceInfo.deviceType,
        otpVerified: true,
      });

      await storage.updateUserLoginInfo(user.id, clientIp);
      await storage.createAuditLog({ userId: user.id, action: "LOGIN_SUCCESS", entityType: "user", entityId: user.id, ipAddress: clientIp });

      let passwordExpired = false;
      let passwordWarning = false;
      let daysUntilExpiry: number | null = null;
      if (user.forcePasswordChange) {
        passwordExpired = true;
      } else if (user.passwordChangedAt) {
        const daysSinceChange = Math.floor((Date.now() - new Date(user.passwordChangedAt).getTime()) / (1000 * 60 * 60 * 24));
        daysUntilExpiry = PASSWORD_EXPIRY_DAYS - daysSinceChange;
        if (daysUntilExpiry <= 0) {
          passwordExpired = true;
        } else if (daysUntilExpiry <= PASSWORD_WARNING_DAYS) {
          passwordWarning = true;
        }
      }

      req.session.passwordExpired = passwordExpired;

      const { passwordHash, ...safeUser } = user;
      res.json({
        user: safeUser,
        permissions: perms,
        roles: userRolesData,
        passwordExpired,
        passwordWarning,
        daysUntilExpiry,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/auth/resend-otp", async (req, res) => {
    try {
      const userId = req.session.pendingUserId;
      if (!userId || !req.session.otpRequired) {
        return res.status(400).json({ message: "No pending verification. Please login again." });
      }

      const clientIp = req.ip || "unknown";
      const existingCode = await storage.getActiveVerificationCode(userId);
      if (existingCode && existingCode.resendCount >= MAX_OTP_RESENDS) {
        return res.status(429).json({ message: "Maximum resend limit reached. Please login again." });
      }

      const user = await storage.getUser(userId);
      if (!user) return res.status(400).json({ message: "User not found" });

      const otpCode = generateOtp();
      const otpHash = hashOtp(otpCode);
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

      const newCode = await storage.createLoginVerificationCode({ userId, codeHash: otpHash, expiresAt });
      if (existingCode) {
        await storage.updateVerificationCode(newCode.id, { resendCount: (existingCode.resendCount || 0) + 1 });
      }

      try {
        await sendLoginOtpEmail(user.email, otpCode, OTP_EXPIRY_MINUTES);
        await storage.createSecurityAuditLog({ userId, eventType: "OTP_RESENT", ipAddress: clientIp });
        console.log(`[OTP] Resend code for ${user.email}: ${otpCode} (expires in ${OTP_EXPIRY_MINUTES} min)`);
      } catch (emailErr: any) {
        console.error("Failed to resend OTP:", emailErr.message);
        console.log(`[OTP FALLBACK] Resend code for ${user.email}: ${otpCode} (email delivery failed)`);
        return res.status(500).json({ message: "Failed to send verification email. Please try again." });
      }

      res.json({ message: "New verification code sent" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    const userId = req.session.userId;
    const sessionId = req.sessionID;
    if (userId) {
      const sessions = await storage.getUserSessions(userId, true);
      const matchingSession = sessions.find(s => s.sessionToken === sessionId);
      if (matchingSession) {
        await storage.updateUserSession(matchingSession.id, { isActive: false, logoutAt: new Date(), logoutReason: "manual" });
      }
      await storage.createAuditLog({ userId, action: "LOGOUT", entityType: "user", entityId: userId });
      await storage.createSecurityAuditLog({ userId, eventType: "LOGOUT", ipAddress: req.ip });
    }
    req.session.destroy(() => {
      res.json({ message: "Logged out" });
    });
  });

  const forgotPasswordRateLimit = new Map<string, { count: number; resetAt: number }>();

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || typeof email !== "string") {
        return res.status(400).json({ message: "Email is required" });
      }

      const clientIp = req.ip || "unknown";
      const now = Date.now();
      const rateEntry = forgotPasswordRateLimit.get(clientIp);
      if (rateEntry && rateEntry.resetAt > now && rateEntry.count >= 5) {
        return res.json({ message: "If an account with that email exists, a password reset link has been sent." });
      }
      if (!rateEntry || rateEntry.resetAt <= now) {
        forgotPasswordRateLimit.set(clientIp, { count: 1, resetAt: now + 15 * 60 * 1000 });
      } else {
        rateEntry.count++;
      }

      const genericResponse = { message: "If an account with that email exists, a password reset link has been sent." };

      const user = await storage.getUserByEmail(email);
      if (!user || !user.isActive) {
        return res.json(genericResponse);
      }

      await storage.invalidateUserPasswordResetTokens(user.id);

      const rawToken = crypto.randomBytes(32);
      const tokenHex = rawToken.toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

      await storage.createPasswordResetToken({
        userId: user.id,
        tokenHash,
        expiresAt,
        requestIp: clientIp,
        userAgent: req.headers["user-agent"],
      });

      await storage.createAuditLog({
        userId: user.id,
        action: "PASSWORD_RESET_REQUESTED",
        entityType: "user",
        entityId: user.id,
        ipAddress: clientIp,
        userAgent: req.headers["user-agent"],
      });

      const proto = req.headers["x-forwarded-proto"] || req.protocol;
      const host = req.headers["x-forwarded-host"] || req.get("host");
      const resetUrl = `${proto}://${host}/reset-password?token=${tokenHex}`;

      try {
        await sendPasswordResetEmail(user.email, resetUrl, expiresAt);
        console.log(`Password reset email sent to ${user.email}`);
      } catch (emailErr) {
        console.error("Failed to send password reset email:", emailErr);
        console.log(`Fallback - Reset URL for ${user.email}: ${resetUrl}`);
      }

      res.json(genericResponse);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      if (!token || typeof token !== "string") {
        return res.status(400).json({ message: "Reset token is required" });
      }
      if (!newPassword || typeof newPassword !== "string") {
        return res.status(400).json({ message: "New password is required" });
      }

      const policyError = validatePasswordPolicy(newPassword);
      if (policyError) return res.status(400).json({ message: policyError });

      const rawToken = Buffer.from(token, "hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

      const resetToken = await storage.getPasswordResetTokenByHash(tokenHash);
      if (!resetToken) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }
      if (resetToken.usedAt) {
        return res.status(400).json({ message: "This reset token has already been used" });
      }
      if (new Date() > resetToken.expiresAt) {
        return res.status(400).json({ message: "This reset token has expired" });
      }

      const user = await storage.getUser(resetToken.userId);
      if (!user || !user.isActive) {
        return res.status(400).json({ message: "This account is no longer active" });
      }

      const history = await storage.getPasswordHistory(resetToken.userId, 3);
      for (const h of history) {
        if (await comparePassword(newPassword, h.passwordHash)) {
          return res.status(400).json({ message: "Cannot reuse a recent password. Please choose a different password." });
        }
      }
      if (await comparePassword(newPassword, user.passwordHash)) {
        return res.status(400).json({ message: "New password must be different from current password." });
      }

      await storage.addPasswordToHistory(resetToken.userId, user.passwordHash);
      const hashedPassword = await hashPassword(newPassword);
      await storage.updateUserPassword(resetToken.userId, hashedPassword);

      await storage.markPasswordResetTokenUsed(resetToken.id);
      await storage.invalidateUserPasswordResetTokens(resetToken.userId);

      await storage.invalidateUserSessions(resetToken.userId);

      await storage.createAuditLog({
        userId: resetToken.userId,
        action: "PASSWORD_RESET_COMPLETED",
        entityType: "user",
        entityId: resetToken.userId,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json({ message: "Password has been reset successfully. Please log in with your new password." });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user) return res.status(401).json({ message: "User not found" });
    const perms = await storage.getUserPermissions(user.id);
    const userRolesData = await storage.getUserRoles(user.id);
    req.session.userPermissions = perms;

    let passwordExpired = false;
    let passwordWarning = false;
    let daysUntilExpiry: number | null = null;
    if (user.forcePasswordChange) {
      passwordExpired = true;
    } else if (user.passwordChangedAt) {
      const daysSinceChange = Math.floor((Date.now() - new Date(user.passwordChangedAt).getTime()) / (1000 * 60 * 60 * 24));
      daysUntilExpiry = PASSWORD_EXPIRY_DAYS - daysSinceChange;
      if (daysUntilExpiry <= 0) {
        passwordExpired = true;
      } else if (daysUntilExpiry <= PASSWORD_WARNING_DAYS) {
        passwordWarning = true;
      }
    }

    const { passwordHash, ...safeUser } = user;
    res.json({ user: safeUser, permissions: perms, roles: userRolesData, passwordExpired, passwordWarning, daysUntilExpiry });
  });

  app.post("/api/auth/change-password", requireAuth, async (req, res) => {
    try {
      const { currentPassword, newPassword, confirmPassword } = req.body;
      const userId = req.session.userId!;
      const clientIp = req.ip || "unknown";

      if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({ message: "All fields are required" });
      }
      if (newPassword !== confirmPassword) {
        return res.status(400).json({ message: "New password and confirmation do not match" });
      }

      const policyError = validatePasswordPolicy(newPassword);
      if (policyError) return res.status(400).json({ message: policyError });

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const validCurrent = await comparePassword(currentPassword, user.passwordHash);
      if (!validCurrent) {
        await storage.createSecurityAuditLog({ userId, eventType: "PASSWORD_CHANGE_FAILED", ipAddress: clientIp, metadata: { reason: "wrong_current" } });
        return res.status(401).json({ message: "Current password is incorrect" });
      }

      const history = await storage.getPasswordHistory(userId, 3);
      for (const h of history) {
        if (await comparePassword(newPassword, h.passwordHash)) {
          return res.status(400).json({ message: "Cannot reuse a recent password. Please choose a different password." });
        }
      }
      if (await comparePassword(newPassword, user.passwordHash)) {
        return res.status(400).json({ message: "New password must be different from current password." });
      }

      await storage.addPasswordToHistory(userId, user.passwordHash);
      const newHash = await hashPassword(newPassword);
      await storage.updateUserPassword(userId, newHash);
      await storage.createSecurityAuditLog({ userId, eventType: "PASSWORD_CHANGED", ipAddress: clientIp });
      await storage.createAuditLog({ userId, action: "PASSWORD_CHANGED", entityType: "user", entityId: userId, ipAddress: clientIp });

      req.session.passwordExpired = false;

      res.json({ message: "Password changed successfully" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/auth/heartbeat", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const sessionId = req.sessionID;
      const sessions = await storage.getUserSessions(userId, true);
      const match = sessions.find(s => s.sessionToken === sessionId);
      if (match) {
        await storage.updateUserSession(match.id, { lastActivityAt: new Date() });
      }
      res.json({ active: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/auth/sessions", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const sessions = await storage.getUserSessions(userId);
      const currentToken = req.sessionID;
      const result = sessions.map(s => ({
        ...s,
        isCurrent: s.sessionToken === currentToken,
        sessionToken: undefined,
      }));
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/auth/sessions/:id/logout", requireAuth, async (req, res) => {
    try {
      const sessionDbId = Number(req.params.id);
      const session = await storage.getUserSession(sessionDbId);
      if (!session || session.userId !== req.session.userId!) {
        return res.status(404).json({ message: "Session not found" });
      }
      await storage.updateUserSession(sessionDbId, { isActive: false, logoutAt: new Date(), logoutReason: "remote_logout" });
      await storage.createSecurityAuditLog({ userId: req.session.userId!, eventType: "REMOTE_LOGOUT", ipAddress: req.ip, metadata: { targetSessionId: sessionDbId } });
      res.json({ message: "Session logged out" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/auth/logout-others", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const currentToken = req.sessionID;
      const sessions = await storage.getUserSessions(userId, true);
      const currentSession = sessions.find(s => s.sessionToken === currentToken);
      if (currentSession) {
        await storage.deactivateUserSessions(userId, "logout_others", currentSession.id);
      }
      await storage.createSecurityAuditLog({ userId, eventType: "LOGOUT_ALL_OTHERS", ipAddress: req.ip });
      res.json({ message: "All other sessions logged out" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/auth/security-logs", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const logs = await storage.getSecurityAuditLogs(userId, 50);
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/users/:id/sessions", requireAuth, requirePermission("security.user.manage"), async (req, res) => {
    try {
      const userId = Number(req.params.id);
      const sessions = await storage.getUserSessions(userId);
      res.json(sessions.map(s => ({ ...s, sessionToken: undefined })));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/users/:id/security-logs", requireAuth, requirePermission("security.user.manage"), async (req, res) => {
    try {
      const userId = Number(req.params.id);
      const logs = await storage.getSecurityAuditLogs(userId, 100);
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/countries", requireAuth, async (_req, res) => {
    const data = await storage.getCountries();
    res.json(data);
  });

  app.get("/api/providers", requireAuth, async (req, res) => {
    const filters = {
      status: req.query.status as string | undefined,
      providerType: req.query.providerType as string | undefined,
      countryId: req.query.countryId ? parseInt(req.query.countryId as string) : undefined,
      search: req.query.search as string | undefined,
    };
    const data = await storage.getProviders(filters);
    res.json(data);
  });

  app.get("/api/providers/:id", requireAuth, async (req, res) => {
    const data = await storage.getProvider(parseInt(req.params.id));
    if (!data) return res.status(404).json({ message: "Provider not found" });
    res.json(data);
  });

  app.post("/api/providers", requireAuth, requirePermission("providers.provider.add"), async (req, res) => {
    try {
      const parsed = insertUniversitySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      const isDuplicate = await storage.checkDuplicateProvider(parsed.data.name, parsed.data.countryId || null);
      if (isDuplicate) return res.status(409).json({ message: "A provider with this name and country already exists" });
      const provider = await storage.createProvider(parsed.data);
      res.json(provider);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/providers/:id", requireAuth, requirePermission("providers.provider.update"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const parsed = insertUniversitySchema.partial().safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      if (parsed.data.name) {
        const isDuplicate = await storage.checkDuplicateProvider(parsed.data.name, parsed.data.countryId || null, id);
        if (isDuplicate) return res.status(409).json({ message: "A provider with this name and country already exists" });
      }
      const provider = await storage.updateProvider(id, parsed.data);
      res.json(provider);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/universities", requireAuth, async (_req, res) => {
    const data = await storage.getProviders({ status: "active" });
    res.json(data);
  });

  app.post("/api/universities", requireAuth, requirePermission("providers.provider.add"), async (req, res) => {
    try {
      const parsed = insertUniversitySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data" });
      const isDuplicate = await storage.checkDuplicateProvider(parsed.data.name, parsed.data.countryId || null);
      if (isDuplicate) return res.status(409).json({ message: "A provider with this name and country already exists" });
      const uni = await storage.createProvider(parsed.data);
      res.json(uni);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/dashboard/stats", requireAuth, async (_req, res) => {
    const stats = await storage.getDashboardStats();
    res.json(stats);
  });

  app.get("/api/dashboard/expiring", requireAuth, async (req, res) => {
    const days = parseInt(req.query.days as string) || 90;
    const data = await storage.getExpiringAgreements(days);
    res.json(data);
  });

  app.get("/api/dashboard/recent", requireAuth, async (req, res) => {
    const limit = parseInt(req.query.limit as string) || 10;
    const data = await storage.getRecentAgreements(limit);
    res.json(data);
  });

  app.get("/api/agreements/status-counts", requireAuth, requirePermission("agreement.view"), async (_req, res) => {
    const counts = await storage.getAgreementStatusCounts();
    res.json(counts);
  });

  app.get("/api/agreements", requireAuth, requirePermission("agreement.view"), async (req, res) => {
    const filters = {
      status: req.query.status as string | undefined,
      countryId: req.query.countryId ? parseInt(req.query.countryId as string) : undefined,
      providerCountryId: req.query.providerCountryId ? parseInt(req.query.providerCountryId as string) : undefined,
      providerId: req.query.providerId ? parseInt(req.query.providerId as string) : undefined,
      search: req.query.search as string | undefined,
    };
    const data = await storage.getAgreements(filters);
    res.json(data);
  });

  app.get("/api/agreements/:id", requireAuth, requirePermission("agreement.view"), async (req, res) => {
    const data = await storage.getAgreement(parseInt(req.params.id));
    if (!data) return res.status(404).json({ message: "Agreement not found" });
    res.json(data);
  });

  app.post("/api/agreements", requireAuth, requirePermission("agreement.create"), async (req, res) => {
    try {
      const territoryCountryIds: number[] = req.body.territoryCountryIds || [];
      const territoryType = req.body.territoryType || "country_specific";
      const payload = {
        ...req.body,
        universityId: Number(req.body.universityId),
        territoryType,
        territoryCountryId: territoryCountryIds.length > 0 ? territoryCountryIds[0] : null,
        confidentialityLevel: "high",
        createdByUserId: req.session.userId,
        updatedByUserId: req.session.userId,
      };
      delete payload.territoryCountryIds;
      const parsed = insertAgreementSchema.safeParse(payload);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      const isDuplicate = await storage.checkDuplicateAgreement(
        parsed.data.universityId, parsed.data.agreementType, parsed.data.startDate, territoryCountryIds
      );
      if (isDuplicate) return res.status(409).json({ message: "Agreement already exists for this provider, type, start date, and territory." });
      const agreement = await storage.createAgreement(parsed.data);
      if (territoryType === "country_specific" && territoryCountryIds.length > 0) {
        await storage.setAgreementTerritories(agreement.id, territoryCountryIds);
      }
      await storage.createAuditLog({
        userId: req.session.userId,
        action: "AGREEMENT_CREATE",
        entityType: "agreement",
        entityId: agreement.id,
        ipAddress: req.ip,
      });
      res.json(agreement);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/agreements/:id", requireAuth, requirePermission("agreement.edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const territoryCountryIds: number[] | undefined = req.body.territoryCountryIds;
      const payload: any = { ...req.body, updatedByUserId: req.session.userId };
      if (payload.universityId) payload.universityId = Number(payload.universityId);
      if (payload.territoryType === "country_specific" && territoryCountryIds) {
        payload.territoryCountryId = territoryCountryIds.length > 0 ? territoryCountryIds[0] : null;
      } else if (payload.territoryType === "global") {
        payload.territoryCountryId = null;
      }
      payload.confidentialityLevel = "high";
      delete payload.territoryCountryIds;
      const parsed = insertAgreementSchema.partial().safeParse(payload);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      const agreement = await storage.updateAgreement(id, parsed.data);
      if (territoryCountryIds !== undefined) {
        if (payload.territoryType === "global") {
          await storage.setAgreementTerritories(id, []);
        } else {
          await storage.setAgreementTerritories(id, territoryCountryIds);
        }
      }
      await storage.createAuditLog({
        userId: req.session.userId,
        action: "AGREEMENT_EDIT",
        entityType: "agreement",
        entityId: id,
        ipAddress: req.ip,
      });
      res.json(agreement);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/agreements/:id", requireAuth, requirePermission("agreement.delete"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteAgreement(id);
      await storage.createAuditLog({
        userId: req.session.userId,
        action: "AGREEMENT_DELETE",
        entityType: "agreement",
        entityId: id,
        ipAddress: req.ip,
      });
      res.json({ message: "Deleted" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/agreements/:id/targets", requireAuth, requirePermission("targets.view"), async (req, res) => {
    const data = await storage.getTargets(parseInt(req.params.id));
    res.json(data);
  });

  app.post("/api/agreements/:id/targets", requireAuth, requirePermission("targets.create"), async (req, res) => {
    try {
      const payload = {
        ...req.body,
        agreementId: parseInt(req.params.id),
        createdByUserId: req.session.userId,
      };
      const parsed = insertTargetSchema.safeParse(payload);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      const periodError = validatePeriodKey(parsed.data.targetType, parsed.data.periodKey);
      if (periodError) return res.status(400).json({ message: periodError });
      const isDuplicate = await storage.checkDuplicateTarget(
        parsed.data.agreementId, parsed.data.targetType, parsed.data.metric, parsed.data.periodKey
      );
      if (isDuplicate) return res.status(409).json({ message: "A target with this type, metric, and period already exists for this agreement" });
      const target = await storage.createTarget(parsed.data);
      res.json(target);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/targets/:id", requireAuth, requirePermission("targets.edit"), async (req, res) => {
    try {
      const parsed = insertTargetSchema.partial().safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      const target = await storage.updateTarget(parseInt(req.params.id), parsed.data);
      res.json(target);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/targets/:id", requireAuth, requirePermission("targets.delete"), async (req, res) => {
    try {
      await storage.deleteTarget(parseInt(req.params.id));
      res.json({ message: "Deleted" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/targets/:id/bonus-rules", requireAuth, requirePermission("bonus.view"), async (req, res) => {
    const data = await storage.getBonusRules(parseInt(req.params.id));
    res.json(data);
  });

  app.post("/api/targets/:id/bonus-rules", requireAuth, requirePermission("bonus.create"), async (req, res) => {
    try {
      const targetId = parseInt(req.params.id);
      const { bonusType, currency, tiers, countryEntries } = req.body;
      if (!bonusType || !currency) return res.status(400).json({ message: "bonusType and currency are required" });

      if ((bonusType === "tier_per_student" || bonusType === "tiered_flat") && tiers) {
        for (let i = 0; i < tiers.length; i++) {
          for (let j = i + 1; j < tiers.length; j++) {
            const a = tiers[i];
            const b = tiers[j];
            const aMax = a.maxStudents ?? Infinity;
            const bMax = b.maxStudents ?? Infinity;
            if (a.minStudents < bMax && b.minStudents < aMax) {
              return res.status(400).json({ message: `Overlapping bonus tiers: ${a.minStudents}-${aMax} and ${b.minStudents}-${bMax}` });
            }
          }
        }
      }

      const rule = await storage.createBonusRule({ targetId, bonusType, currency });

      if (tiers && tiers.length > 0) {
        for (const tier of tiers) {
          await storage.createBonusTier({
            bonusRuleId: rule.id,
            minStudents: tier.minStudents,
            maxStudents: tier.maxStudents || null,
            bonusAmount: String(tier.bonusAmount),
            calculationType: tier.calculationType || (bonusType === "tier_per_student" ? "per_student" : "flat"),
          });
        }
      }

      if (countryEntries && countryEntries.length > 0) {
        for (const entry of countryEntries) {
          await storage.createBonusCountryEntry({
            bonusRuleId: rule.id,
            countryId: entry.countryId,
            studentCount: entry.studentCount,
            bonusAmount: String(entry.bonusAmount),
          });
        }
      }

      const fullRule = (await storage.getBonusRules(targetId)).find((r: any) => r.id === rule.id);
      res.json(fullRule);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/bonus-rules/:id", requireAuth, requirePermission("bonus.delete"), async (req, res) => {
    try {
      await storage.deleteBonusRule(parseInt(req.params.id));
      res.json({ message: "Deleted" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/bonus/calculate", requireAuth, async (req, res) => {
    try {
      const { targetId, studentCount, countryId } = req.body;
      const rules = await storage.getBonusRules(targetId);
      let totalBonus = 0;
      const breakdown: any[] = [];

      for (const rule of rules) {
        if (rule.bonusType === "tier_per_student") {
          const tier = rule.tiers.find((t: any) => {
            const max = t.maxStudents ?? Infinity;
            return studentCount >= t.minStudents && studentCount <= max;
          });
          if (tier) {
            const amount = tier.calculationType === "per_student"
              ? studentCount * parseFloat(tier.bonusAmount)
              : parseFloat(tier.bonusAmount);
            totalBonus += amount;
            breakdown.push({ rule: rule.bonusType, tier: `${tier.minStudents}-${tier.maxStudents || '∞'}`, amount, currency: rule.currency });
          }
        } else if (rule.bonusType === "flat_on_target" || rule.bonusType === "country_bonus") {
          for (const entry of rule.countryEntries) {
            if ((!countryId || entry.countryId === countryId) && studentCount >= entry.studentCount) {
              const amount = parseFloat(entry.bonusAmount);
              totalBonus += amount;
              breakdown.push({ rule: rule.bonusType, country: entry.countryName, amount, currency: rule.currency });
            }
          }
        } else if (rule.bonusType === "tiered_flat") {
          let bestTier = null;
          for (const tier of rule.tiers) {
            if (studentCount >= tier.minStudents) {
              if (!bestTier || tier.minStudents > bestTier.minStudents) {
                bestTier = tier;
              }
            }
          }
          if (bestTier) {
            const amount = parseFloat(bestTier.bonusAmount);
            totalBonus += amount;
            breakdown.push({ rule: rule.bonusType, threshold: bestTier.minStudents, amount, currency: rule.currency });
          }
        }
      }

      res.json({ totalBonus, breakdown });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/commission-rules", requireAuth, requirePermission("commission.view"), async (req, res) => {
    try {
      const filters: any = {};
      if (req.query.providerId) filters.providerId = parseInt(req.query.providerId as string);
      if (req.query.providerCountryId) filters.providerCountryId = parseInt(req.query.providerCountryId as string);
      if (req.query.agreementStatus) filters.agreementStatus = req.query.agreementStatus as string;
      if (req.query.commissionMode) filters.commissionMode = req.query.commissionMode as string;
      if (req.query.search) filters.search = req.query.search as string;
      const data = await storage.getAllCommissionRules(filters);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/bonus-rules", requireAuth, requirePermission("bonus.view"), async (req, res) => {
    try {
      const filters: any = {};
      if (req.query.providerId) filters.providerId = parseInt(req.query.providerId as string);
      if (req.query.providerCountryId) filters.providerCountryId = parseInt(req.query.providerCountryId as string);
      if (req.query.agreementStatus) filters.agreementStatus = req.query.agreementStatus as string;
      if (req.query.bonusType) filters.bonusType = req.query.bonusType as string;
      if (req.query.search) filters.search = req.query.search as string;
      const data = await storage.getAllBonusRules(filters);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/agreements/:id/commission-rules", requireAuth, requirePermission("commission.view"), async (req, res) => {
    const data = await storage.getCommissionRules(parseInt(req.params.id));
    res.json(data);
  });

  app.post("/api/agreements/:id/commission-rules", requireAuth, requirePermission("commission.create"), async (req, res) => {
    try {
      const payload = {
        ...req.body,
        agreementId: parseInt(req.params.id),
      };
      const parsed = insertCommissionRuleSchema.safeParse(payload);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      const rule = await storage.createCommissionRule(parsed.data);
      res.json(rule);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/commission-rules/:id", requireAuth, requirePermission("commission.edit"), async (req, res) => {
    try {
      const parsed = insertCommissionRuleSchema.partial().safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      const rule = await storage.updateCommissionRule(parseInt(req.params.id), parsed.data);
      res.json(rule);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/commission-rules/:id", requireAuth, requirePermission("commission.delete"), async (req, res) => {
    try {
      await storage.deleteCommissionRule(parseInt(req.params.id));
      res.json({ message: "Deleted" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/contacts", requireAuth, requirePermission("contacts.view"), async (req, res) => {
    try {
      const filters: any = {};
      if (req.query.q) filters.q = req.query.q as string;
      if (req.query.providerId) filters.providerId = parseInt(req.query.providerId as string);
      if (req.query.providerCountryId) filters.providerCountryId = parseInt(req.query.providerCountryId as string);
      if (req.query.contactCountryId) filters.contactCountryId = parseInt(req.query.contactCountryId as string);
      if (req.query.agreementStatus) filters.agreementStatus = req.query.agreementStatus as string;
      const data = await storage.getAllContacts(filters);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/agreements/:id/contacts", requireAuth, requirePermission("contacts.view"), async (req, res) => {
    const data = await storage.getContacts(parseInt(req.params.id));
    res.json(data);
  });

  app.post("/api/agreements/:id/contacts", requireAuth, requirePermission("contacts.create"), async (req, res) => {
    try {
      const payload = {
        ...req.body,
        agreementId: parseInt(req.params.id),
        countryId: req.body.countryId ? Number(req.body.countryId) : null,
      };
      const parsed = insertContactSchema.safeParse(payload);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      const contact = await storage.createContact(parsed.data);
      res.json(contact);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/contacts/:id", requireAuth, requirePermission("contacts.edit"), async (req, res) => {
    try {
      const parsed = insertContactSchema.partial().safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      const contact = await storage.updateContact(parseInt(req.params.id), parsed.data);
      res.json(contact);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/contacts/:id", requireAuth, requirePermission("contacts.delete"), async (req, res) => {
    try {
      await storage.deleteContact(parseInt(req.params.id));
      res.json({ message: "Deleted" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/agreements/:id/documents", requireAuth, requirePermission("document.list"), async (req, res) => {
    const data = await storage.getDocuments(parseInt(req.params.id));
    res.json(data);
  });

  app.post("/api/agreements/:id/documents", requireAuth, requirePermission("document.upload"), upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const agreementId = parseInt(req.params.id);
      const docs = await storage.getDocuments(agreementId);
      const nextVersion = docs.length > 0 ? Math.max(...docs.map(d => d.versionNo)) + 1 : 1;
      const doc = await storage.createDocument({
        agreementId,
        versionNo: nextVersion,
        originalFilename: req.file.originalname,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        storagePath: req.file.path,
        status: "active",
        uploadedByUserId: req.session.userId,
        uploadNote: req.body.note || null,
      });
      await storage.createAuditLog({
        userId: req.session.userId,
        action: "DOC_UPLOAD",
        entityType: "document",
        entityId: doc.id,
        ipAddress: req.ip,
      });
      res.json(doc);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/documents/:id/view", requireAuth, requirePermission("document.view_in_portal"), async (req, res) => {
    try {
      const doc = await storage.getDocument(parseInt(req.params.id));
      if (!doc) return res.status(404).json({ message: "Document not found" });

      const agreement = await storage.getAgreement(doc.agreementId);
      if (!agreement) return res.status(404).json({ message: "Agreement not found" });

      const filePath = doc.storagePath;
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "File not found on server" });
      }

      await storage.createAuditLog({
        userId: req.session.userId,
        action: "DOC_VIEW",
        entityType: "document",
        entityId: doc.id,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        metadata: { agreementId: doc.agreementId, filename: doc.originalFilename, version: doc.versionNo },
      });

      res.setHeader("Content-Type", doc.mimeType);
      res.setHeader("Content-Disposition", `inline; filename="${doc.originalFilename}"`);
      res.setHeader("Content-Length", doc.sizeBytes.toString());
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.setHeader("X-Content-Type-Options", "nosniff");

      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/documents/:id/download", requireAuth, requirePermission("document.download"), async (req, res) => {
    try {
      const doc = await storage.getDocument(parseInt(req.params.id));
      if (!doc) return res.status(404).json({ message: "Document not found" });

      const agreement = await storage.getAgreement(doc.agreementId);
      if (!agreement) return res.status(404).json({ message: "Agreement not found" });

      const filePath = doc.storagePath;
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "File not found on server" });
      }

      await storage.createAuditLog({
        userId: req.session.userId,
        action: "DOC_DOWNLOAD",
        entityType: "document",
        entityId: doc.id,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        metadata: { agreementId: doc.agreementId, filename: doc.originalFilename, version: doc.versionNo },
      });

      res.setHeader("Content-Type", doc.mimeType);
      res.setHeader("Content-Disposition", `attachment; filename="${doc.originalFilename}"`);
      res.setHeader("Content-Length", doc.sizeBytes.toString());
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
      res.setHeader("Pragma", "no-cache");

      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/audit-logs", requireAuth, requirePermission("audit.view"), async (req, res) => {
    const filters = {
      entityType: req.query.entityType as string | undefined,
      entityId: req.query.entityId ? parseInt(req.query.entityId as string) : undefined,
      userId: req.query.userId ? parseInt(req.query.userId as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 100,
    };
    const logs = await storage.getAuditLogs(filters);
    res.json(logs);
  });

  app.get("/api/users", requireAuth, requirePermission("security.user.manage"), async (_req, res) => {
    const data = await storage.getUsers();
    const usersWithRoles = await Promise.all(
      data.map(async ({ passwordHash, ...u }) => {
        const userRoles = await storage.getUserRoles(u.id);
        return { ...u, roles: userRoles };
      })
    );
    res.json(usersWithRoles);
  });

  app.post("/api/users", requireAuth, requirePermission("security.user.manage"), async (req, res) => {
    try {
      const { email, fullName, password, roleId } = req.body;
      if (!password || password.length < 12) {
        return res.status(400).json({ message: "Password must be at least 12 characters" });
      }
      if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
        return res.status(400).json({ message: "Password must include uppercase, lowercase, and a number" });
      }
      const hash = await hashPassword(password);
      const user = await storage.createUser({ email, fullName, passwordHash: hash, isActive: true });
      if (roleId) {
        await storage.assignRole(user.id, roleId);
      }
      const { passwordHash, ...safeUser } = user;
      res.json(safeUser);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/users/:id/roles", requireAuth, requirePermission("security.user.manage"), async (req, res) => {
    const data = await storage.getUserRoles(parseInt(req.params.id));
    res.json(data);
  });

  app.post("/api/users/:id/roles", requireAuth, requirePermission("security.role.manage"), async (req, res) => {
    try {
      await storage.assignRole(parseInt(req.params.id), req.body.roleId);
      res.json({ message: "Role assigned" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/users/:id/roles/:roleId", requireAuth, requirePermission("security.role.manage"), async (req, res) => {
    try {
      await storage.removeRole(parseInt(req.params.id), parseInt(req.params.roleId));
      res.json({ message: "Role removed" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/roles", requireAuth, async (req, res) => {
    const userPerms = req.session.userPermissions || [];
    if (!userPerms.includes("security.role.manage") && !userPerms.includes("security.user.manage")) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const allRoles = await storage.getRoles();
    const rolesWithCounts = await Promise.all(allRoles.map(async (role) => {
      const userCount = await storage.getRoleUserCount(role.id);
      return { ...role, userCount };
    }));
    res.json(rolesWithCounts);
  });

  app.get("/api/roles/:id", requireAuth, requirePermission("security.role.manage"), async (req, res) => {
    const role = await storage.getRole(parseInt(req.params.id));
    if (!role) return res.status(404).json({ message: "Role not found" });
    res.json(role);
  });

  app.get("/api/roles/:id/permissions", requireAuth, requirePermission("security.role.manage"), async (req, res) => {
    const permissionIds = await storage.getRolePermissions(parseInt(req.params.id));
    res.json(permissionIds);
  });

  app.post("/api/roles", requireAuth, requirePermission("security.role.manage"), async (req, res) => {
    try {
      const { name, description } = req.body;
      if (!name || name.trim().length === 0) return res.status(400).json({ message: "Role name is required" });
      const role = await storage.createRole(name.trim(), description);
      await storage.createAuditLog({
        userId: req.session.userId,
        action: "ROLE_CREATE",
        entityType: "role",
        entityId: role.id,
        ipAddress: req.ip,
        metadata: { name: role.name },
      });
      res.json(role);
    } catch (err: any) {
      if (err.message?.includes("unique")) return res.status(409).json({ message: "A role with this name already exists" });
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/roles/:id", requireAuth, requirePermission("security.role.manage"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const oldRole = await storage.getRole(id);
      if (!oldRole) return res.status(404).json({ message: "Role not found" });
      const { name, description } = req.body;
      const role = await storage.updateRole(id, { name, description });
      await storage.createAuditLog({
        userId: req.session.userId,
        action: "ROLE_UPDATE",
        entityType: "role",
        entityId: id,
        ipAddress: req.ip,
        metadata: { oldName: oldRole.name, newName: role.name },
      });
      res.json(role);
    } catch (err: any) {
      if (err.message?.includes("unique")) return res.status(409).json({ message: "A role with this name already exists" });
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/roles/:id", requireAuth, requirePermission("security.role.manage"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const role = await storage.getRole(id);
      if (!role) return res.status(404).json({ message: "Role not found" });
      const isLast = await storage.isLastAdminRole(id);
      if (isLast) return res.status(400).json({ message: "Cannot delete the last role with admin permissions. At least one admin role must remain." });
      const userCount = await storage.getRoleUserCount(id);
      if (userCount > 0) return res.status(400).json({ message: `Cannot delete role with ${userCount} active user(s). Remove users from this role first.` });
      await storage.deleteRole(id);
      await storage.createAuditLog({
        userId: req.session.userId,
        action: "ROLE_DELETE",
        entityType: "role",
        entityId: id,
        ipAddress: req.ip,
        metadata: { name: role.name },
      });
      res.json({ message: "Role deleted" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/roles/:id/duplicate", requireAuth, requirePermission("security.role.manage"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const originalRole = await storage.getRole(id);
      if (!originalRole) return res.status(404).json({ message: "Role not found" });
      const newName = req.body.name || `${originalRole.name} (Copy)`;
      const newRole = await storage.duplicateRole(id, newName);
      await storage.createAuditLog({
        userId: req.session.userId,
        action: "ROLE_DUPLICATE",
        entityType: "role",
        entityId: newRole.id,
        ipAddress: req.ip,
        metadata: { sourceRoleId: id, sourceName: originalRole.name, newName: newRole.name },
      });
      res.json(newRole);
    } catch (err: any) {
      if (err.message?.includes("unique")) return res.status(409).json({ message: "A role with this name already exists" });
      res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/roles/:id/permissions", requireAuth, requirePermission("security.role.manage"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const role = await storage.getRole(id);
      if (!role) return res.status(404).json({ message: "Role not found" });
      const { permissionIds } = req.body;
      if (!Array.isArray(permissionIds)) return res.status(400).json({ message: "permissionIds must be an array" });
      const oldPermIds = await storage.getRolePermissions(id);
      const isLast = await storage.isLastAdminRole(id);
      if (isLast) {
        const allPerms = await storage.getPermissions();
        const adminCodes = ["security.role.manage", "security.user.manage"];
        const adminPermIds = allPerms.filter(p => adminCodes.includes(p.code)).map(p => p.id);
        const wouldRemoveAdmin = adminPermIds.some(apId => !permissionIds.includes(apId));
        if (wouldRemoveAdmin) {
          return res.status(400).json({ message: "Cannot remove admin permissions from the last admin role." });
        }
      }
      await storage.setRolePermissions(id, permissionIds);
      await storage.createAuditLog({
        userId: req.session.userId,
        action: "ROLE_PERMISSIONS_UPDATE",
        entityType: "role",
        entityId: id,
        ipAddress: req.ip,
        metadata: { oldPermissionCount: oldPermIds.length, newPermissionCount: permissionIds.length },
      });
      res.json({ message: "Permissions updated" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/users/:id/roles", requireAuth, requirePermission("security.role.manage"), async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { roleIds } = req.body;
      if (!Array.isArray(roleIds)) return res.status(400).json({ message: "roleIds must be an array" });
      const oldRoles = await storage.getUserRoles(userId);
      await storage.setUserRoles(userId, roleIds);
      await storage.createAuditLog({
        userId: req.session.userId,
        action: "USER_ROLES_UPDATE",
        entityType: "user",
        entityId: userId,
        ipAddress: req.ip,
        metadata: { oldRoles: oldRoles.map(r => r.name), newRoleIds: roleIds },
      });
      res.json({ message: "User roles updated" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/users/:id/status", requireAuth, requirePermission("security.user.manage"), async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { isActive } = req.body;
      if (typeof isActive !== "boolean") return res.status(400).json({ message: "isActive must be a boolean" });
      if (userId === req.session.userId) return res.status(400).json({ message: "You cannot deactivate your own account" });
      await storage.updateUserActiveStatus(userId, isActive);
      if (!isActive) {
        await storage.deactivateUserSessions(userId, "account_deactivated");
      }
      await storage.createAuditLog({
        userId: req.session.userId,
        action: isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED",
        entityType: "user",
        entityId: userId,
        ipAddress: req.ip,
      });
      res.json({ message: isActive ? "User activated" : "User deactivated" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/permissions/schema", requireAuth, requirePermission("security.role.manage"), async (_req, res) => {
    try {
      const allPermissions = await storage.getPermissions();
      const reverseLegacy: Record<string, string> = {};
      for (const [legacyCode, newCode] of Object.entries(LEGACY_PERMISSION_MAP)) {
        reverseLegacy[newCode] = legacyCode;
      }

      const modules = PERMISSION_REGISTRY.map(mod => ({
        module: mod.module,
        label: mod.label,
        resources: mod.resources.map(resource => {
          const actions = resource.actions.map(action => {
            const newCode = `${mod.module}.${resource.resource}.${action}`;
            const legacyCode = reverseLegacy[newCode];
            const perm = allPermissions.find(p =>
              p.code === newCode || p.code === legacyCode ||
              (p.module === mod.module && p.resource === resource.resource && p.action === action)
            );
            return {
              action,
              code: perm?.code || newCode,
              permissionId: perm?.id || null,
              description: perm?.description || `${action} ${resource.label}`,
            };
          });
          return {
            resource: resource.resource,
            label: resource.label,
            actions,
          };
        }),
      }));

      res.json({ modules });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/commission-tracker/students", requireAuth, requirePermission("commission_tracker.view"), async (req, res) => {
    try {
      const filters: any = {};
      if (req.query.search) filters.search = String(req.query.search);
      if (req.query.agent) {
        const agents = String(req.query.agent).split(",").filter(Boolean);
        if (agents.length === 1) filters.agent = agents[0];
        else if (agents.length > 1) filters.agents = agents;
      }
      if (req.query.provider) {
        const providers = String(req.query.provider).split(",").filter(Boolean);
        if (providers.length === 1) filters.provider = providers[0];
        else if (providers.length > 1) filters.providers = providers;
      }
      if (req.query.country) filters.country = String(req.query.country);
      if (req.query.status) {
        const statuses = String(req.query.status).split(",").filter(Boolean);
        if (statuses.length === 1) filters.status = statuses[0];
        else if (statuses.length > 1) filters.statuses = statuses;
      }
      const students = await storage.getCommissionStudents(filters);
      res.json(students);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/commission-tracker/students/:id", requireAuth, requirePermission("commission_tracker.view"), async (req, res) => {
    try {
      const student = await storage.getCommissionStudent(Number(req.params.id));
      if (!student) return res.status(404).json({ message: "Student not found" });
      const entries = await storage.getCommissionEntries(student.id);
      res.json({ ...student, entries });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/commission-tracker/students", requireAuth, requirePermission("commission_tracker.create"), async (req, res) => {
    try {
      const { studentName, agentsicId, provider, studentId } = req.body;
      if (!studentName || !(studentName || "").trim()) {
        return res.status(400).json({ message: "Student Name is required" });
      }
      if (!agentsicId || !(agentsicId || "").trim()) {
        return res.status(400).json({ message: "Agentsic ID is required" });
      }
      if (!provider || !(provider || "").trim()) {
        return res.status(400).json({ message: "Provider is required" });
      }

      const dupMsg = await storage.checkCommissionStudentDuplicates(studentName, agentsicId, provider, studentId || "");
      if (dupMsg) {
        return res.status(409).json({ message: dupMsg });
      }

      const country = (req.body.country || "AU").trim();
      const isAU = country.toLowerCase() === "au" || country.toLowerCase() === "australia";
      const data = {
        ...req.body,
        gstRatePct: isAU ? "10" : "0",
        gstApplicable: req.body.gstApplicable || (isAU ? "Yes" : "No"),
      };
      const student = await storage.createCommissionStudent(data);

      const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "create",
        entityType: "commission_student",
        entityId: student.id,
        ipAddress: String(clientIp),
        userAgent: req.headers["user-agent"],
      });

      res.status(201).json(student);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/commission-tracker/students/:id", requireAuth, requirePermission("commission_tracker.edit"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const existing = await storage.getCommissionStudent(id);
      if (!existing) return res.status(404).json({ message: "Student not found" });

      if (req.body.agentsicId !== undefined && !req.body.agentsicId?.trim()) {
        return res.status(400).json({ message: "Agentsic ID cannot be empty" });
      }

      const mergedName = (req.body.studentName || existing.studentName).trim();
      const mergedAgentsicId = (req.body.agentsicId || existing.agentsicId || "").trim();
      const mergedProvider = (req.body.provider || existing.provider).trim();
      const mergedStudentId = (req.body.studentId !== undefined ? req.body.studentId : existing.studentId || "").trim();

      const dupMsg = await storage.checkCommissionStudentDuplicates(mergedName, mergedAgentsicId, mergedProvider, mergedStudentId, id);
      if (dupMsg) {
        return res.status(409).json({ message: dupMsg });
      }

      const country = (req.body.country || existing.country).trim();
      const isAU = country.toLowerCase() === "au" || country.toLowerCase() === "australia";
      const updateData = { ...req.body };
      if (req.body.country) {
        updateData.gstRatePct = isAU ? "10" : "0";
        if (!req.body.gstApplicable) updateData.gstApplicable = isAU ? "Yes" : "No";
      }

      const student = await storage.updateCommissionStudent(id, updateData);

      const entries = await storage.getCommissionEntries(id);
      for (const entry of entries) {
        const calc = calculateEntry(student, entry);
        await storage.updateCommissionEntry(entry.id, calc as any);
      }

      const updatedEntries = await storage.getCommissionEntries(id);
      const tms = await storage.getCommissionTerms();
      const master = computeMasterFromEntries(updatedEntries, tms.map(t => t.termName));
      await storage.updateCommissionStudent(id, {
        status: master.status,
        notes: master.notes,
        totalReceived: master.totalReceived,
      });

      const final = await storage.getCommissionStudent(id);
      res.json(final);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/commission-tracker/students/:id", requireAuth, requirePermission("commission_tracker.student.delete_master"), async (req, res) => {
    try {
      await storage.deleteCommissionStudent(Number(req.params.id));
      res.json({ message: "Student deleted" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/commission-tracker/students/:id/entries", requireAuth, requirePermission("commission_tracker.entry.view"), async (req, res) => {
    try {
      const entries = await storage.getCommissionEntries(Number(req.params.id));
      res.json(entries);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/commission-tracker/students/:id/entries", requireAuth, requirePermission("commission_tracker.entry.create"), async (req, res) => {
    try {
      const studentId = Number(req.params.id);
      const student = await storage.getCommissionStudent(studentId);
      if (!student) return res.status(404).json({ message: "Student not found" });

      const termName = req.body.termName;
      const allTerms = await storage.getCommissionTerms();
      const termNames = allTerms.map(t => t.termName);
      if (!termNames.includes(termName)) {
        return res.status(400).json({ message: `Invalid term: ${termName}. Must be one of: ${termNames.join(", ")}` });
      }

      const existingEntries = await storage.getCommissionEntries(studentId);
      if (existingEntries.find(e => e.termName === termName)) {
        return res.status(400).json({ message: `Entry for ${termName} already exists` });
      }

      const termIdx = termNames.indexOf(termName);
      for (let i = 0; i < termIdx; i++) {
        const prevEntry = existingEntries.find(e => e.termName === termNames[i]);
        if (prevEntry) {
          const st = prevEntry.studentStatus || "";
          if (st === "Withdrawn" || st === "Complete") {
            return res.status(400).json({ message: `Cannot add ${termName} entry: previous term ${termNames[i]} has status "${st}" which blocks downstream terms` });
          }
        }
      }

      const calc = calculateEntry(student, req.body);
      const entryData = {
        commissionStudentId: studentId,
        termName,
        academicYear: req.body.academicYear || null,
        feeGross: req.body.feeGross || "0",
        bonus: req.body.bonus || "0",
        commissionRateOverridePct: req.body.commissionRateOverridePct || null,
        paymentStatus: req.body.paymentStatus || "Pending",
        paidDate: req.body.paidDate || null,
        invoiceNo: req.body.invoiceNo || null,
        paymentRef: req.body.paymentRef || null,
        notes: req.body.notes || null,
        studentStatus: req.body.studentStatus || "Under Enquiry",
        scholarshipTypeOverride: req.body.scholarshipTypeOverride || null,
        scholarshipValueOverride: req.body.scholarshipValueOverride || null,
        ...calc,
      };

      const entry = await storage.createCommissionEntry(entryData);

      const allEntries = await storage.getCommissionEntries(studentId);
      const master = computeMasterFromEntries(allEntries, termNames);
      await storage.updateCommissionStudent(studentId, {
        status: master.status,
        notes: master.notes,
        totalReceived: master.totalReceived,
      });

      res.status(201).json(entry);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/commission-tracker/entries/:id", requireAuth, requirePermission("commission_tracker.entry.edit"), async (req, res) => {
    try {
      const entryId = Number(req.params.id);
      const existing = await storage.getCommissionEntry(entryId);
      if (!existing) return res.status(404).json({ message: "Entry not found" });

      const student = await storage.getCommissionStudent(existing.commissionStudentId);
      if (!student) return res.status(404).json({ message: "Student not found" });

      const body = { ...req.body };
      if (body.feeGross === "" || body.feeGross === null) body.feeGross = "0";
      if (body.bonus === "" || body.bonus === null) body.bonus = "0";
      if (body.commissionRateOverridePct === "") body.commissionRateOverridePct = null;
      if (body.scholarshipTypeOverride === "") body.scholarshipTypeOverride = null;
      if (body.scholarshipValueOverride === "") body.scholarshipValueOverride = null;

      const merged = { ...existing, ...body };
      const calc = calculateEntry(student, merged);

      const updateData = {
        academicYear: merged.academicYear,
        feeGross: merged.feeGross || "0",
        bonus: merged.bonus || "0",
        commissionRateOverridePct: merged.commissionRateOverridePct || null,
        paymentStatus: merged.paymentStatus,
        paidDate: merged.paidDate || null,
        invoiceNo: merged.invoiceNo || null,
        paymentRef: merged.paymentRef || null,
        notes: merged.notes || null,
        studentStatus: merged.studentStatus,
        scholarshipTypeOverride: merged.scholarshipTypeOverride || null,
        scholarshipValueOverride: merged.scholarshipValueOverride || null,
        ...calc,
      };

      const entry = await storage.updateCommissionEntry(entryId, updateData);

      const allEntries = await storage.getCommissionEntries(student.id);
      const tms3 = await storage.getCommissionTerms();
      const master = computeMasterFromEntries(allEntries, tms3.map(t => t.termName));
      await storage.updateCommissionStudent(student.id, {
        status: master.status,
        notes: master.notes,
        totalReceived: master.totalReceived,
      });

      res.json(entry);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/commission-tracker/entries/:id", requireAuth, requirePermission("commission_tracker.entry.delete"), async (req, res) => {
    try {
      const entryId = Number(req.params.id);
      const existing = await storage.getCommissionEntry(entryId);
      if (!existing) return res.status(404).json({ message: "Entry not found" });

      const studentId = existing.commissionStudentId;
      await storage.deleteCommissionEntry(entryId);

      const allEntries = await storage.getCommissionEntries(studentId);
      const tms2 = await storage.getCommissionTerms();
      const master = computeMasterFromEntries(allEntries, tms2.map(t => t.termName));
      await storage.updateCommissionStudent(studentId, {
        status: master.status,
        notes: master.notes,
        totalReceived: master.totalReceived,
      });

      res.json({ message: "Entry deleted" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/commission-tracker/students/:id/recalculate", requireAuth, requirePermission("commission_tracker.edit"), async (req, res) => {
    try {
      const studentId = Number(req.params.id);
      const student = await storage.getCommissionStudent(studentId);
      if (!student) return res.status(404).json({ message: "Student not found" });

      const entries = await storage.getCommissionEntries(studentId);
      for (const entry of entries) {
        const calc = calculateEntry(student, entry);
        await storage.updateCommissionEntry(entry.id, calc as any);
      }

      const updatedEntries = await storage.getCommissionEntries(studentId);
      const terms = await storage.getCommissionTerms();
      const termOrder = terms.map(t => t.termName);
      const master = computeMasterFromEntries(updatedEntries, termOrder);
      const updated = await storage.updateCommissionStudent(studentId, {
        status: master.status,
        notes: master.notes,
        totalReceived: master.totalReceived,
      });

      res.json({ ...updated, entries: updatedEntries });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/commission-tracker/dashboard", requireAuth, requirePermission("commission_tracker.view"), async (_req, res) => {
    try {
      const dashboard = await storage.getCommissionTrackerDashboard();
      res.json(dashboard);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/commission-tracker/filters", requireAuth, requirePermission("commission_tracker.view"), async (_req, res) => {
    try {
      const students = await storage.getCommissionStudents();
      const terms = await storage.getCommissionTerms();
      const agents = [...new Set(students.map(s => s.agentName))].sort();
      const providers = [...new Set(students.map(s => s.provider))].sort();
      const countries = [...new Set(students.map(s => s.country))].sort();
      res.json({
        agents,
        providers,
        countries,
        statuses: [...STUDENT_STATUSES],
        paymentStatuses: [...PAYMENT_STATUSES],
        termNames: terms.map(t => t.termName),
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/commission-tracker/terms", requireAuth, requirePermission("commission_tracker.view"), async (_req, res) => {
    try {
      const terms = await storage.getCommissionTerms();
      res.json(terms);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/commission-tracker/terms", requireAuth, requirePermission("commission_tracker.create"), async (req, res) => {
    try {
      const { termName, termLabel, year, termNumber, sortOrder } = req.body;
      if (!termName || !termLabel || !year || !termNumber || sortOrder === undefined) {
        return res.status(400).json({ message: "termName, termLabel, year, termNumber, and sortOrder are required" });
      }
      const term = await storage.createCommissionTerm({ termName, termLabel, year, termNumber, sortOrder });
      res.status(201).json(term);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/commission-tracker/terms/:id", requireAuth, requirePermission("commission_tracker.delete"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const allTerms = await storage.getCommissionTerms();
      const term = allTerms.find(t => t.id === id);
      if (!term) return res.status(404).json({ message: "Term not found" });

      const entries = await storage.getCommissionEntriesByTerm(term.termName);
      if (entries.length > 0) {
        return res.status(400).json({ message: `Cannot delete term ${term.termLabel}: ${entries.length} entries exist. Remove entries first.` });
      }

      await storage.deleteCommissionTerm(id);
      res.json({ message: "Term deleted" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/commission-tracker/all-entries", requireAuth, requirePermission("commission_tracker.view"), async (req, res) => {
    try {
      const year = req.query.year ? Number(req.query.year) : undefined;
      const students = await storage.getCommissionStudents();
      const terms = await storage.getCommissionTerms();
      const yearTermNames = year ? terms.filter(t => t.year === year).map(t => t.termName) : null;

      const result: Record<number, any[]> = {};
      for (const s of students) {
        const entries = await storage.getCommissionEntries(s.id);
        result[s.id] = yearTermNames ? entries.filter(e => yearTermNames.includes(e.termName)) : entries;
      }
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/commission-tracker/years", requireAuth, requirePermission("commission_tracker.view"), async (_req, res) => {
    try {
      const terms = await storage.getCommissionTerms();
      const years = [...new Set(terms.map(t => t.year))].sort((a, b) => a - b);
      res.json(years);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/commission-tracker/dashboard/:year", requireAuth, requirePermission("commission_tracker.view"), async (req, res) => {
    try {
      const year = Number(req.params.year);
      const terms = await storage.getCommissionTerms();
      const yearTermNames = terms.filter(t => t.year === year).map(t => t.termName);

      const students = await storage.getCommissionStudents();
      let totalStudents = 0;
      let totalCommission = 0;
      let totalReceived = 0;
      let activeCount = 0;
      let pendingPayments = 0;
      let paidPayments = 0;
      const byStatus: Record<string, number> = {};
      const byAgent: Record<string, { count: number; total: number }> = {};
      const byProvider: Record<string, { count: number; total: number }> = {};

      for (const s of students) {
        const entries = await storage.getCommissionEntries(s.id);
        const yearEntries = entries.filter(e => yearTermNames.includes(e.termName));
        if (yearEntries.length === 0) continue;

        totalStudents++;
        for (const e of yearEntries) {
          const amt = Number(e.totalAmount || 0);
          totalCommission += amt;
          if (e.paymentStatus === "Received") {
            totalReceived += amt;
            paidPayments++;
          }
          if (e.paymentStatus === "Pending") pendingPayments++;
          const st = e.studentStatus || "Under Enquiry";
          byStatus[st] = (byStatus[st] || 0) + 1;
          if (st === "Active") activeCount++;
        }

        if (!byAgent[s.agentName]) byAgent[s.agentName] = { count: 0, total: 0 };
        byAgent[s.agentName].count++;
        byAgent[s.agentName].total += yearEntries.reduce((sum, e) => sum + Number(e.totalAmount || 0), 0);

        if (!byProvider[s.provider]) byProvider[s.provider] = { count: 0, total: 0 };
        byProvider[s.provider].count++;
        byProvider[s.provider].total += yearEntries.reduce((sum, e) => sum + Number(e.totalAmount || 0), 0);
      }

      res.json({
        totalStudents,
        totalCommission: Math.round(totalCommission * 100) / 100,
        totalReceived: Math.round(totalReceived * 100) / 100,
        activeCount,
        pendingPayments,
        paidPayments,
        byStatus,
        byAgent: Object.entries(byAgent).map(([agent, v]) => ({ agent, ...v })),
        byProvider: Object.entries(byProvider).map(([provider, v]) => ({ provider, ...v })),
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/commission-tracker/sample-sheet", requireAuth, requirePermission("commission_tracker.view"), async (_req, res) => {
    try {
      const headers = [
        "Agent Name", "Agentsic ID (mandatory)", "Student ID", "Student Name",
        "Provider", "Country", "Start Intake", "Course Level", "Course Name",
        "Duration (Years)"
      ];
      const sampleRow = [
        "Sample Agent", "AG-001", "STU-001", "John Doe",
        "University of Newcastle", "Australia", "T1 2025", "Bachelor", "Computer Science",
        "3"
      ];
      const csv = [headers.join(","), sampleRow.join(",")].join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=commission_tracker_sample.csv");
      res.send(csv);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }).single("file");
  app.post("/api/commission-tracker/bulk-upload/preview", requireAuth, requirePermission("commission_tracker.create"), csvUpload, async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });

      const { parse } = await import("csv-parse/sync");
      const content = req.file.buffer.toString("utf-8");
      const records = parse(content, { columns: true, skip_empty_lines: true, trim: true });

      const valid: any[] = [];
      const invalid: any[] = [];
      const duplicates: any[] = [];

      const seenInFile: Array<{ studentName: string; agentsicId: string; provider: string; studentId: string }> = [];

      for (let i = 0; i < records.length; i++) {
        const row = records[i];
        const rowNum = i + 2;
        const studentName = (row["Student Name"] || "").trim();
        const agentsicId = (row["Agentsic ID (mandatory)"] || row["Agentsic ID"] || "").trim();
        const provider = (row["Provider"] || "").trim();
        const studentId = (row["Student ID"] || "").trim();
        const agentName = (row["Agent Name"] || "").trim();

        const errors: string[] = [];
        if (!agentsicId) errors.push("Agentsic ID is required");
        if (!studentName) errors.push("Student Name is required");
        if (!provider) errors.push("Provider is required");
        if (!agentName) errors.push("Agent Name is required");

        if (errors.length > 0) {
          invalid.push({ row: rowNum, data: row, errors });
          continue;
        }

        const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
        const filedup = seenInFile.find(s => {
          if (norm(s.studentName) === norm(studentName) && norm(s.agentsicId) === norm(agentsicId)) return true;
          if (norm(s.studentName) === norm(studentName) && norm(s.provider) === norm(provider) && s.studentId && norm(s.studentId) === norm(studentId)) return true;
          if (norm(s.provider) === norm(provider) && s.studentId && norm(s.studentId) === norm(studentId)) return true;
          return false;
        });
        if (filedup) {
          duplicates.push({ row: rowNum, data: row, errors: ["Duplicate within uploaded file"] });
          continue;
        }

        const dbDup = await storage.checkCommissionStudentDuplicates(studentName, agentsicId, provider, studentId);
        if (dbDup) {
          duplicates.push({ row: rowNum, data: row, errors: [dbDup] });
          continue;
        }

        seenInFile.push({ studentName, agentsicId, provider, studentId });
        valid.push({
          row: rowNum,
          data: {
            agentName,
            agentsicId,
            studentId,
            studentName,
            provider,
            country: (row["Country"] || "Australia").trim(),
            startIntake: (row["Start Intake"] || "").trim(),
            courseLevel: (row["Course Level"] || "").trim(),
            courseName: (row["Course Name"] || "").trim(),
            courseDurationYears: (row["Duration (Years)"] || "").trim(),
            commissionRatePct: (row["Commission Rate (%)"] || "").trim(),
            gstApplicable: (row["GST Applicable (Yes/No)"] || "Yes").trim(),
            scholarshipType: (row["Scholarship Type (None/Percent/Fixed)"] || "None").trim(),
            scholarshipValue: (row["Scholarship Value"] || "0").trim(),
          },
        });
      }

      res.json({ valid, invalid, duplicates, totalRows: records.length });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/commission-tracker/bulk-upload/confirm", requireAuth, requirePermission("commission_tracker.create"), async (req, res) => {
    try {
      const { rows } = req.body;
      if (!rows || !Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ message: "No rows to import" });
      }

      const results = { imported: 0, failed: 0, errors: [] as string[] };
      const importedSoFar: Array<{ studentName: string; agentsicId: string; provider: string; studentId: string }> = [];
      const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

      for (const item of rows) {
        try {
          const data = item.data || item;
          const studentName = (data.studentName || "").trim();
          const agentsicId = (data.agentsicId || "").trim();
          const provider = (data.provider || "").trim();
          const agentName = (data.agentName || "").trim();
          const studentId = (data.studentId || "").trim();

          if (!agentsicId) throw new Error("Agentsic ID is required");
          if (!studentName) throw new Error("Student Name is required");
          if (!provider) throw new Error("Provider is required");
          if (!agentName) throw new Error("Agent Name is required");

          const batchDup = importedSoFar.find(s => {
            if (norm(s.studentName) === norm(studentName) && norm(s.agentsicId) === norm(agentsicId)) return true;
            if (norm(s.studentName) === norm(studentName) && norm(s.provider) === norm(provider) && s.studentId && norm(s.studentId) === norm(studentId)) return true;
            if (norm(s.provider) === norm(provider) && s.studentId && norm(s.studentId) === norm(studentId)) return true;
            return false;
          });
          if (batchDup) throw new Error("Duplicate within import batch");

          const dbDup = await storage.checkCommissionStudentDuplicates(studentName, agentsicId, provider, studentId);
          if (dbDup) throw new Error(dbDup);

          const country = (data.country || "Australia").trim();
          const isAU = country.toLowerCase() === "au" || country.toLowerCase() === "australia";
          await storage.createCommissionStudent({
            ...data,
            gstRatePct: isAU ? "10" : "0",
            gstApplicable: data.gstApplicable || (isAU ? "Yes" : "No"),
          });
          importedSoFar.push({ studentName, agentsicId, provider, studentId });
          results.imported++;
        } catch (e: any) {
          results.failed++;
          results.errors.push(`Row ${item.row || "?"}: ${e.message}`);
        }
      }

      res.json(results);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  return httpServer;
}
