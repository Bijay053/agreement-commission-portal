import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, hashPassword, comparePassword, requireAuth, requirePermission } from "./auth";
import { seedDatabase } from "./seed";
import { loginSchema, insertAgreementSchema, insertTargetSchema, insertCommissionRuleSchema, insertContactSchema, insertUniversitySchema, PERMISSION_REGISTRY, LEGACY_PERMISSION_MAP } from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupAuth(app);
  await seedDatabase();

  app.post("/api/auth/login", async (req, res) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid credentials format" });
      }
      const { email, password } = parsed.data;
      const user = await storage.getUserByEmail(email);
      if (!user || !user.isActive) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      const valid = await comparePassword(password, user.passwordHash);
      if (!valid) {
        await storage.createAuditLog({ userId: user.id, action: "LOGIN_FAILED", entityType: "user", entityId: user.id, ipAddress: req.ip });
        return res.status(401).json({ message: "Invalid email or password" });
      }
      const perms = await storage.getUserPermissions(user.id);
      const userRoles = await storage.getUserRoles(user.id);
      req.session.userId = user.id;
      req.session.userPermissions = perms;
      await storage.createAuditLog({ userId: user.id, action: "LOGIN_SUCCESS", entityType: "user", entityId: user.id, ipAddress: req.ip });
      const { passwordHash, ...safeUser } = user;
      res.json({ user: safeUser, permissions: perms, roles: userRoles });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    const userId = req.session.userId;
    req.session.destroy(() => {
      if (userId) {
        storage.createAuditLog({ userId, action: "LOGOUT", entityType: "user", entityId: userId });
      }
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

      const resetUrl = `${req.protocol}://${req.get("host")}/reset-password?token=${tokenHex}`;
      console.log("\n========================================");
      console.log("PASSWORD RESET LINK");
      console.log("========================================");
      console.log(`User: ${user.email}`);
      console.log(`URL: ${resetUrl}`);
      console.log(`Expires: ${expiresAt.toISOString()}`);
      console.log("========================================\n");

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

      if (newPassword.length < 12) {
        return res.status(400).json({ message: "Password must be at least 12 characters" });
      }
      if (!/[A-Z]/.test(newPassword)) {
        return res.status(400).json({ message: "Password must include at least one uppercase letter" });
      }
      if (!/[a-z]/.test(newPassword)) {
        return res.status(400).json({ message: "Password must include at least one lowercase letter" });
      }
      if (!/\d/.test(newPassword)) {
        return res.status(400).json({ message: "Password must include at least one number" });
      }

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
    const userRoles = await storage.getUserRoles(user.id);
    const { passwordHash, ...safeUser } = user;
    res.json({ user: safeUser, permissions: perms, roles: userRoles });
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

  app.post("/api/providers", requireAuth, requirePermission("agreement.create"), async (req, res) => {
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

  app.patch("/api/providers/:id", requireAuth, requirePermission("agreement.edit"), async (req, res) => {
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

  app.post("/api/universities", requireAuth, requirePermission("agreement.create"), async (req, res) => {
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

  app.post("/api/agreements/:id/targets", requireAuth, requirePermission("targets.manage"), async (req, res) => {
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

  app.patch("/api/targets/:id", requireAuth, requirePermission("targets.manage"), async (req, res) => {
    try {
      const parsed = insertTargetSchema.partial().safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      const target = await storage.updateTarget(parseInt(req.params.id), parsed.data);
      res.json(target);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/targets/:id", requireAuth, requirePermission("targets.manage"), async (req, res) => {
    try {
      await storage.deleteTarget(parseInt(req.params.id));
      res.json({ message: "Deleted" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/targets/:id/bonus-rules", requireAuth, requirePermission("targets.view"), async (req, res) => {
    const data = await storage.getBonusRules(parseInt(req.params.id));
    res.json(data);
  });

  app.post("/api/targets/:id/bonus-rules", requireAuth, requirePermission("targets.manage"), async (req, res) => {
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

  app.delete("/api/bonus-rules/:id", requireAuth, requirePermission("targets.manage"), async (req, res) => {
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

  app.get("/api/bonus-rules", requireAuth, requirePermission("commission.view"), async (req, res) => {
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

  app.post("/api/agreements/:id/commission-rules", requireAuth, requirePermission("commission.manage"), async (req, res) => {
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

  app.patch("/api/commission-rules/:id", requireAuth, requirePermission("commission.manage"), async (req, res) => {
    try {
      const parsed = insertCommissionRuleSchema.partial().safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      const rule = await storage.updateCommissionRule(parseInt(req.params.id), parsed.data);
      res.json(rule);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/commission-rules/:id", requireAuth, requirePermission("commission.manage"), async (req, res) => {
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

  app.post("/api/agreements/:id/contacts", requireAuth, requirePermission("contacts.manage"), async (req, res) => {
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

  app.patch("/api/contacts/:id", requireAuth, requirePermission("contacts.manage"), async (req, res) => {
    try {
      const parsed = insertContactSchema.partial().safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      const contact = await storage.updateContact(parseInt(req.params.id), parsed.data);
      res.json(contact);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/contacts/:id", requireAuth, requirePermission("contacts.manage"), async (req, res) => {
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
      res.setHeader("X-Frame-Options", "SAMEORIGIN");

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

  return httpServer;
}
