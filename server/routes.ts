import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, hashPassword, comparePassword, requireAuth, requirePermission } from "./auth";
import { seedDatabase } from "./seed";
import { loginSchema, insertAgreementSchema, insertTargetSchema, insertCommissionRuleSchema, insertContactSchema, insertUniversitySchema } from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";

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

  app.get("/api/agreements", requireAuth, requirePermission("agreement.view"), async (req, res) => {
    const filters = {
      status: req.query.status as string | undefined,
      countryId: req.query.countryId ? parseInt(req.query.countryId as string) : undefined,
      providerCountryId: req.query.providerCountryId ? parseInt(req.query.providerCountryId as string) : undefined,
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
    const safeUsers = data.map(({ passwordHash, ...u }) => u);
    res.json(safeUsers);
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

  app.get("/api/roles", requireAuth, async (_req, res) => {
    const data = await storage.getRoles();
    res.json(data);
  });

  return httpServer;
}
