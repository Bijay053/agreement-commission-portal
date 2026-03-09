import { db } from "./db";
import { eq, and, desc, asc, gte, lte, ilike, sql, or, inArray, aliasedTable } from "drizzle-orm";
import {
  users, roles, permissions, rolePermissions, userRoles, userCountryAccess,
  countries, universities, agreements, agreementTerritories, agreementTargets,
  agreementCommissionRules, agreementContacts, agreementDocuments, auditLogs,
  targetBonusRules, targetBonusTiers, targetBonusCountry, passwordResetTokens,
  commissionStudents, commissionEntries, commissionTerms,
  subAgentEntries, subAgentTermEntries,
  userSessions, loginVerificationCodes, securityAuditLogs, passwordHistory,
  type User, type InsertUser, type Agreement, type InsertAgreement,
  type AgreementTarget, type InsertTarget, type AgreementCommissionRule,
  type InsertCommissionRule, type AgreementContact, type InsertContact,
  type AgreementDocument, type InsertDocument, type University, type InsertUniversity,
  type Country, type Role, type Permission, type AuditLog,
  type TargetBonusRule, type TargetBonusTier, type TargetBonusCountryEntry,
  type PasswordResetToken,
  type CommissionStudent, type InsertCommissionStudent,
  type CommissionEntry, type InsertCommissionEntry,
  type CommissionTerm,
  type SubAgentEntry, type InsertSubAgentEntry,
  type SubAgentTermEntry, type InsertSubAgentTermEntry,
  type UserSession, type LoginVerificationCode, type SecurityAuditLog,
} from "@shared/schema";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUsers(): Promise<User[]>;

  getRoles(): Promise<Role[]>;
  getRole(id: number): Promise<Role | undefined>;
  createRole(name: string, description?: string): Promise<Role>;
  updateRole(id: number, data: { name?: string; description?: string }): Promise<Role>;
  deleteRole(id: number): Promise<void>;
  duplicateRole(id: number, newName: string): Promise<Role>;
  getRolePermissions(roleId: number): Promise<number[]>;
  setRolePermissions(roleId: number, permissionIds: number[]): Promise<void>;
  getRoleUserCount(roleId: number): Promise<number>;
  getPermissions(): Promise<Permission[]>;
  getUserRoles(userId: number): Promise<Role[]>;
  getUserPermissions(userId: number): Promise<string[]>;
  assignRole(userId: number, roleId: number): Promise<void>;
  removeRole(userId: number, roleId: number): Promise<void>;
  setUserRoles(userId: number, roleIds: number[]): Promise<void>;
  isLastAdminRole(roleId: number): Promise<boolean>;

  getCountries(): Promise<Country[]>;

  getProviders(filters?: { status?: string; providerType?: string; countryId?: number; search?: string }): Promise<any[]>;
  getProvider(id: number): Promise<any>;
  createProvider(data: InsertUniversity): Promise<University>;
  updateProvider(id: number, data: Partial<InsertUniversity>): Promise<University>;
  checkDuplicateProvider(name: string, countryId: number | null, excludeId?: number): Promise<boolean>;

  getAgreementStatusCounts(): Promise<Record<string, number>>;
  getAgreements(filters?: { status?: string; countryId?: number; providerCountryId?: number; providerId?: number; search?: string }): Promise<any[]>;
  getAgreement(id: number): Promise<any>;
  createAgreement(agreement: InsertAgreement): Promise<Agreement>;
  updateAgreement(id: number, data: Partial<InsertAgreement>): Promise<Agreement>;
  deleteAgreement(id: number): Promise<void>;
  setAgreementTerritories(agreementId: number, countryIds: number[]): Promise<void>;
  getAgreementTerritories(agreementId: number): Promise<Country[]>;

  getTargets(agreementId: number): Promise<AgreementTarget[]>;
  createTarget(target: InsertTarget): Promise<AgreementTarget>;
  updateTarget(id: number, data: Partial<InsertTarget>): Promise<AgreementTarget>;
  deleteTarget(id: number): Promise<void>;
  checkDuplicateTarget(agreementId: number, targetType: string, metric: string, periodKey: string, excludeId?: number): Promise<boolean>;

  getBonusRules(targetId: number): Promise<any[]>;
  getAllBonusRules(filters?: { providerId?: number; providerCountryId?: number; agreementStatus?: string; bonusType?: string; search?: string }): Promise<any[]>;
  createBonusRule(rule: any): Promise<TargetBonusRule>;
  deleteBonusRule(id: number): Promise<void>;
  createBonusTier(tier: any): Promise<TargetBonusTier>;
  createBonusCountryEntry(entry: any): Promise<TargetBonusCountryEntry>;

  getCommissionRules(agreementId: number): Promise<AgreementCommissionRule[]>;
  getAllCommissionRules(filters?: { providerId?: number; providerCountryId?: number; agreementStatus?: string; commissionMode?: string; search?: string }): Promise<any[]>;
  createCommissionRule(rule: InsertCommissionRule): Promise<AgreementCommissionRule>;
  updateCommissionRule(id: number, data: Partial<InsertCommissionRule>): Promise<AgreementCommissionRule>;
  deleteCommissionRule(id: number): Promise<void>;

  getContacts(agreementId: number): Promise<AgreementContact[]>;
  getAllContacts(filters?: { q?: string; providerId?: number; providerCountryId?: number; contactCountryId?: number; agreementStatus?: string }): Promise<any[]>;
  createContact(contact: InsertContact): Promise<AgreementContact>;
  updateContact(id: number, data: Partial<InsertContact>): Promise<AgreementContact>;
  deleteContact(id: number): Promise<void>;

  getDocuments(agreementId: number): Promise<AgreementDocument[]>;
  getDocument(id: number): Promise<AgreementDocument | undefined>;
  createDocument(doc: InsertDocument): Promise<AgreementDocument>;

  getExpiringAgreements(daysAhead: number): Promise<any[]>;
  getRecentAgreements(limit: number): Promise<any[]>;
  getDashboardStats(): Promise<{ total: number; active: number; expiringSoon: number; expired: number }>;

  createAuditLog(log: { userId?: number; action: string; entityType: string; entityId?: number; ipAddress?: string; userAgent?: string; metadata?: any }): Promise<void>;
  getAuditLogs(filters?: { entityType?: string; entityId?: number; userId?: number; limit?: number }): Promise<AuditLog[]>;

  createPasswordResetToken(data: { userId: number; tokenHash: string; expiresAt: Date; requestIp?: string; userAgent?: string }): Promise<PasswordResetToken>;
  getPasswordResetTokenByHash(tokenHash: string): Promise<PasswordResetToken | undefined>;
  markPasswordResetTokenUsed(id: number): Promise<void>;
  invalidateUserPasswordResetTokens(userId: number): Promise<void>;
  updateUserPassword(userId: number, passwordHash: string): Promise<void>;
  updateUserActiveStatus(userId: number, isActive: boolean): Promise<void>;
  invalidateUserSessions(userId: number): Promise<void>;

  getCommissionTerms(): Promise<CommissionTerm[]>;
  createCommissionTerm(data: { termName: string; termLabel: string; year: number; termNumber: number; sortOrder: number }): Promise<CommissionTerm>;
  deleteCommissionTerm(id: number): Promise<void>;

  getCommissionStudents(filters?: { search?: string; agent?: string; provider?: string; country?: string; status?: string; agents?: string[]; providers?: string[]; statuses?: string[] }): Promise<CommissionStudent[]>;
  getCommissionStudent(id: number): Promise<CommissionStudent | undefined>;
  createCommissionStudent(data: InsertCommissionStudent): Promise<CommissionStudent>;
  updateCommissionStudent(id: number, data: Partial<InsertCommissionStudent>): Promise<CommissionStudent>;
  deleteCommissionStudent(id: number): Promise<void>;

  getCommissionEntries(studentId: number): Promise<CommissionEntry[]>;
  getCommissionEntry(id: number): Promise<CommissionEntry | undefined>;
  createCommissionEntry(data: InsertCommissionEntry): Promise<CommissionEntry>;
  updateCommissionEntry(id: number, data: Partial<InsertCommissionEntry>): Promise<CommissionEntry>;
  deleteCommissionEntry(id: number): Promise<void>;
  getCommissionEntriesByTerm(termName: string): Promise<CommissionEntry[]>;

  getCommissionTrackerDashboard(): Promise<{
    totalStudents: number;
    totalCommission: number;
    totalReceived: number;
    byStatus: Record<string, number>;
    byAgent: { agent: string; count: number; total: number }[];
    byProvider: { provider: string; count: number; total: number }[];
  }>;

  getSubAgentEntries(filters?: { search?: string; agents?: string[]; providers?: string[]; statuses?: string[] }): Promise<(SubAgentEntry & { student: CommissionStudent })[]>;
  getSubAgentEntry(studentId: number): Promise<(SubAgentEntry & { student: CommissionStudent }) | undefined>;
  upsertSubAgentEntry(commissionStudentId: number, data: Partial<InsertSubAgentEntry>): Promise<SubAgentEntry>;
  deleteSubAgentEntry(studentId: number): Promise<void>;

  getSubAgentTermEntries(termName: string, filters?: { search?: string; agents?: string[]; providers?: string[]; statuses?: string[] }): Promise<(SubAgentTermEntry & { student: CommissionStudent })[]>;
  getSubAgentTermEntry(id: number): Promise<(SubAgentTermEntry & { student: CommissionStudent }) | undefined>;
  createSubAgentTermEntry(data: InsertSubAgentTermEntry): Promise<SubAgentTermEntry>;
  updateSubAgentTermEntry(id: number, data: Partial<InsertSubAgentTermEntry>): Promise<SubAgentTermEntry>;
  deleteSubAgentTermEntry(id: number): Promise<void>;

  syncSubAgentFromMain(): Promise<{ added: number; updated: number; removed: number }>;
  recalcSubAgentMasterTotals(commissionStudentId: number): Promise<SubAgentEntry>;

  getSubAgentDashboard(year?: number): Promise<{
    totalStudents: number;
    totalPaid: number;
    totalMargin: number;
    byStatus: Record<string, number>;
    byAgent: { agent: string; count: number; totalPaid: number }[];
    byProvider: { provider: string; count: number; totalPaid: number }[];
  }>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  async getUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(asc(users.fullName));
  }

  async getRoles(): Promise<Role[]> {
    return db.select().from(roles).orderBy(asc(roles.name));
  }

  async getRole(id: number): Promise<Role | undefined> {
    const [role] = await db.select().from(roles).where(eq(roles.id, id));
    return role;
  }

  async createRole(name: string, description?: string): Promise<Role> {
    const [created] = await db.insert(roles).values({ name, description: description || null }).returning();
    return created;
  }

  async updateRole(id: number, data: { name?: string; description?: string }): Promise<Role> {
    const [updated] = await db.update(roles).set(data).where(eq(roles.id, id)).returning();
    return updated;
  }

  async deleteRole(id: number): Promise<void> {
    await db.delete(roles).where(eq(roles.id, id));
  }

  async duplicateRole(id: number, newName: string): Promise<Role> {
    const existingPerms = await this.getRolePermissions(id);
    const newRole = await this.createRole(newName);
    if (existingPerms.length > 0) {
      await db.insert(rolePermissions).values(
        existingPerms.map(permissionId => ({ roleId: newRole.id, permissionId }))
      );
    }
    return newRole;
  }

  async getRolePermissions(roleId: number): Promise<number[]> {
    const result = await db
      .select({ permissionId: rolePermissions.permissionId })
      .from(rolePermissions)
      .where(eq(rolePermissions.roleId, roleId));
    return result.map(r => r.permissionId);
  }

  async setRolePermissions(roleId: number, permissionIds: number[]): Promise<void> {
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
    if (permissionIds.length > 0) {
      await db.insert(rolePermissions).values(
        permissionIds.map(permissionId => ({ roleId, permissionId }))
      );
    }
  }

  async getRoleUserCount(roleId: number): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(userRoles)
      .where(eq(userRoles.roleId, roleId));
    return Number(result.count);
  }

  async isLastAdminRole(roleId: number): Promise<boolean> {
    const adminPerms = await db
      .select({ code: permissions.code, id: permissions.id })
      .from(permissions)
      .where(or(eq(permissions.code, "security.role.manage"), eq(permissions.code, "security.user.manage")));
    const adminPermIds = adminPerms.map(p => p.id);
    if (adminPermIds.length === 0) return false;
    const roleHasAdmin = await db
      .select({ count: sql<number>`count(*)` })
      .from(rolePermissions)
      .where(and(eq(rolePermissions.roleId, roleId), inArray(rolePermissions.permissionId, adminPermIds)));
    if (Number(roleHasAdmin[0].count) < adminPermIds.length) return false;
    const otherRolesWithAdmin = await db
      .select({ roleId: rolePermissions.roleId })
      .from(rolePermissions)
      .where(and(
        inArray(rolePermissions.permissionId, adminPermIds),
        sql`${rolePermissions.roleId} != ${roleId}`
      ))
      .groupBy(rolePermissions.roleId);
    const fullAdminRoles = [];
    for (const r of otherRolesWithAdmin) {
      const permCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(rolePermissions)
        .where(and(eq(rolePermissions.roleId, r.roleId), inArray(rolePermissions.permissionId, adminPermIds)));
      if (Number(permCount[0].count) >= adminPermIds.length) {
        const userCount = await this.getRoleUserCount(r.roleId);
        if (userCount > 0) fullAdminRoles.push(r.roleId);
      }
    }
    return fullAdminRoles.length === 0;
  }

  async getPermissions(): Promise<Permission[]> {
    return db.select().from(permissions).orderBy(asc(permissions.code));
  }

  async getUserRoles(userId: number): Promise<Role[]> {
    const result = await db
      .select({ id: roles.id, name: roles.name, description: roles.description })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, userId));
    return result;
  }

  async getUserPermissions(userId: number): Promise<string[]> {
    const result = await db
      .select({ code: permissions.code })
      .from(userRoles)
      .innerJoin(rolePermissions, eq(userRoles.roleId, rolePermissions.roleId))
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(userRoles.userId, userId));
    const dbCodes = [...new Set(result.map(r => r.code))];
    const { LEGACY_PERMISSION_MAP } = await import("@shared/schema");
    const reverseLegacy: Record<string, string> = {};
    for (const [legacyCode, newCode] of Object.entries(LEGACY_PERMISSION_MAP)) {
      reverseLegacy[newCode] = legacyCode;
    }
    const allCodes = new Set(dbCodes);
    for (const code of dbCodes) {
      if (reverseLegacy[code]) {
        allCodes.add(reverseLegacy[code]);
      }
      const legacyTarget = LEGACY_PERMISSION_MAP[code];
      if (legacyTarget) {
        allCodes.add(legacyTarget);
      }
    }
    return [...allCodes];
  }

  async assignRole(userId: number, roleId: number): Promise<void> {
    await db.insert(userRoles).values({ userId, roleId }).onConflictDoNothing();
  }

  async removeRole(userId: number, roleId: number): Promise<void> {
    await db.delete(userRoles).where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId)));
  }

  async setUserRoles(userId: number, roleIds: number[]): Promise<void> {
    await db.delete(userRoles).where(eq(userRoles.userId, userId));
    if (roleIds.length > 0) {
      await db.insert(userRoles).values(
        roleIds.map(roleId => ({ userId, roleId }))
      );
    }
  }

  async getCountries(): Promise<Country[]> {
    return db.select().from(countries).orderBy(asc(countries.name));
  }

  async getProviders(filters?: { status?: string; providerType?: string; countryId?: number; search?: string }): Promise<any[]> {
    let query = db
      .select({
        id: universities.id,
        name: universities.name,
        providerType: universities.providerType,
        countryId: universities.countryId,
        website: universities.website,
        notes: universities.notes,
        status: universities.status,
        createdAt: universities.createdAt,
        updatedAt: universities.updatedAt,
        countryName: countries.name,
      })
      .from(universities)
      .leftJoin(countries, eq(universities.countryId, countries.id));

    const conditions: any[] = [];
    if (filters?.status) conditions.push(eq(universities.status, filters.status));
    if (filters?.providerType) conditions.push(eq(universities.providerType, filters.providerType));
    if (filters?.countryId) conditions.push(eq(universities.countryId, filters.countryId));
    if (filters?.search) {
      conditions.push(
        or(
          ilike(universities.name, `%${filters.search}%`),
          ilike(universities.website, `%${filters.search}%`)
        )
      );
    }
    if (conditions.length > 0) query = query.where(and(...conditions)) as any;
    return (query as any).orderBy(asc(universities.name));
  }

  async getProvider(id: number): Promise<any> {
    const [result] = await db
      .select({
        id: universities.id,
        name: universities.name,
        providerType: universities.providerType,
        countryId: universities.countryId,
        website: universities.website,
        notes: universities.notes,
        status: universities.status,
        createdAt: universities.createdAt,
        updatedAt: universities.updatedAt,
        countryName: countries.name,
      })
      .from(universities)
      .leftJoin(countries, eq(universities.countryId, countries.id))
      .where(eq(universities.id, id));
    return result;
  }

  async createProvider(data: InsertUniversity): Promise<University> {
    const [created] = await db.insert(universities).values(data).returning();
    return created;
  }

  async updateProvider(id: number, data: Partial<InsertUniversity>): Promise<University> {
    const [updated] = await db.update(universities).set({ ...data, updatedAt: new Date() }).where(eq(universities.id, id)).returning();
    return updated;
  }

  async checkDuplicateProvider(name: string, countryId: number | null, excludeId?: number): Promise<boolean> {
    const conditions: any[] = [sql`lower(${universities.name}) = lower(${name})`];
    if (countryId) conditions.push(eq(universities.countryId, countryId));
    if (excludeId) conditions.push(sql`${universities.id} != ${excludeId}`);
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(universities).where(and(...conditions));
    return Number(result.count) > 0;
  }

  async getAgreements(filters?: { status?: string; countryId?: number; providerCountryId?: number; providerId?: number; search?: string }): Promise<any[]> {
    let query = db
      .select({
        id: agreements.id,
        agreementCode: agreements.agreementCode,
        title: agreements.title,
        agreementType: agreements.agreementType,
        status: agreements.status,
        territoryType: agreements.territoryType,
        startDate: agreements.startDate,
        expiryDate: agreements.expiryDate,
        autoRenew: agreements.autoRenew,
        createdAt: agreements.createdAt,
        universityName: universities.name,
        universityId: agreements.universityId,
        providerCountryId: universities.countryId,
        providerCountryName: countries.name,
      })
      .from(agreements)
      .innerJoin(universities, eq(agreements.universityId, universities.id))
      .leftJoin(countries, eq(universities.countryId, countries.id));

    const conditions: any[] = [];
    if (filters?.status) conditions.push(eq(agreements.status, filters.status));
    if (filters?.providerCountryId) conditions.push(eq(universities.countryId, filters.providerCountryId));
    if (filters?.providerId) conditions.push(eq(agreements.universityId, filters.providerId));
    if (filters?.countryId) {
      conditions.push(
        or(
          eq(agreements.territoryType, "global"),
          sql`${agreements.id} IN (SELECT agreement_id FROM agreement_territories WHERE country_id = ${filters.countryId})`
        )
      );
    }
    if (filters?.search) {
      conditions.push(
        or(
          ilike(agreements.title, `%${filters.search}%`),
          ilike(universities.name, `%${filters.search}%`),
          ilike(agreements.agreementCode, `%${filters.search}%`)
        )
      );
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    return (query as any).orderBy(desc(agreements.updatedAt));
  }

  async getAgreement(id: number): Promise<any> {
    const [result] = await db
      .select({
        id: agreements.id,
        universityId: agreements.universityId,
        agreementCode: agreements.agreementCode,
        title: agreements.title,
        agreementType: agreements.agreementType,
        status: agreements.status,
        territoryType: agreements.territoryType,
        territoryCountryId: agreements.territoryCountryId,
        startDate: agreements.startDate,
        expiryDate: agreements.expiryDate,
        autoRenew: agreements.autoRenew,
        internalNotes: agreements.internalNotes,
        createdByUserId: agreements.createdByUserId,
        updatedByUserId: agreements.updatedByUserId,
        createdAt: agreements.createdAt,
        updatedAt: agreements.updatedAt,
        universityName: universities.name,
        providerType: universities.providerType,
        providerCountryName: countries.name,
      })
      .from(agreements)
      .innerJoin(universities, eq(agreements.universityId, universities.id))
      .leftJoin(countries, eq(universities.countryId, countries.id))
      .where(eq(agreements.id, id));

    if (result) {
      const territories = await this.getAgreementTerritories(id);
      return { ...result, territories };
    }
    return result;
  }

  async checkDuplicateAgreement(universityId: number, agreementType: string, startDate: string, territoryCountryIds: number[], excludeId?: number): Promise<boolean> {
    const conditions: any[] = [
      eq(agreements.universityId, universityId),
      eq(agreements.agreementType, agreementType),
      eq(agreements.startDate, startDate),
      or(eq(agreements.status, "draft"), eq(agreements.status, "active"), eq(agreements.status, "renewal_in_progress")),
    ];
    if (excludeId) conditions.push(sql`${agreements.id} != ${excludeId}`);
    const matches = await db.select({ id: agreements.id }).from(agreements).where(and(...conditions));
    if (matches.length === 0) return false;
    for (const match of matches) {
      const existingTerritories = await this.getAgreementTerritories(match.id);
      const existingIds = existingTerritories.map(t => t.id).sort();
      const newIds = [...territoryCountryIds].sort();
      if (existingIds.length === newIds.length && existingIds.every((v, i) => v === newIds[i])) {
        return true;
      }
    }
    return false;
  }

  async createAgreement(agreement: InsertAgreement): Promise<Agreement> {
    const [created] = await db.insert(agreements).values(agreement).returning();
    return created;
  }

  async updateAgreement(id: number, data: Partial<InsertAgreement>): Promise<Agreement> {
    const [updated] = await db.update(agreements).set({ ...data, updatedAt: new Date() }).where(eq(agreements.id, id)).returning();
    return updated;
  }

  async deleteAgreement(id: number): Promise<void> {
    await db.delete(agreements).where(eq(agreements.id, id));
  }

  async setAgreementTerritories(agreementId: number, countryIds: number[]): Promise<void> {
    await db.delete(agreementTerritories).where(eq(agreementTerritories.agreementId, agreementId));
    if (countryIds.length > 0) {
      await db.insert(agreementTerritories).values(
        countryIds.map(countryId => ({ agreementId, countryId }))
      );
    }
  }

  async getAgreementTerritories(agreementId: number): Promise<Country[]> {
    const result = await db
      .select({ id: countries.id, iso2: countries.iso2, name: countries.name })
      .from(agreementTerritories)
      .innerJoin(countries, eq(agreementTerritories.countryId, countries.id))
      .where(eq(agreementTerritories.agreementId, agreementId))
      .orderBy(asc(countries.name));
    return result;
  }

  async getTargets(agreementId: number): Promise<AgreementTarget[]> {
    return db.select().from(agreementTargets).where(eq(agreementTargets.agreementId, agreementId)).orderBy(asc(agreementTargets.periodKey));
  }

  async createTarget(target: InsertTarget): Promise<AgreementTarget> {
    const [created] = await db.insert(agreementTargets).values(target).returning();
    return created;
  }

  async updateTarget(id: number, data: Partial<InsertTarget>): Promise<AgreementTarget> {
    const [updated] = await db.update(agreementTargets).set({ ...data, updatedAt: new Date() }).where(eq(agreementTargets.id, id)).returning();
    return updated;
  }

  async deleteTarget(id: number): Promise<void> {
    await db.delete(agreementTargets).where(eq(agreementTargets.id, id));
  }

  async checkDuplicateTarget(agreementId: number, targetType: string, metric: string, periodKey: string, excludeId?: number): Promise<boolean> {
    const conditions: any[] = [
      eq(agreementTargets.agreementId, agreementId),
      eq(agreementTargets.targetType, targetType),
      eq(agreementTargets.metric, metric),
      eq(agreementTargets.periodKey, periodKey),
    ];
    if (excludeId) conditions.push(sql`${agreementTargets.id} != ${excludeId}`);
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(agreementTargets).where(and(...conditions));
    return Number(result.count) > 0;
  }

  async getBonusRules(targetId: number): Promise<any[]> {
    const rules = await db.select().from(targetBonusRules).where(eq(targetBonusRules.targetId, targetId));
    const result = [];
    for (const rule of rules) {
      const tiers = await db.select().from(targetBonusTiers).where(eq(targetBonusTiers.bonusRuleId, rule.id)).orderBy(asc(targetBonusTiers.minStudents));
      const countryEntries = await db
        .select({
          id: targetBonusCountry.id,
          bonusRuleId: targetBonusCountry.bonusRuleId,
          countryId: targetBonusCountry.countryId,
          studentCount: targetBonusCountry.studentCount,
          bonusAmount: targetBonusCountry.bonusAmount,
          countryName: countries.name,
        })
        .from(targetBonusCountry)
        .innerJoin(countries, eq(targetBonusCountry.countryId, countries.id))
        .where(eq(targetBonusCountry.bonusRuleId, rule.id));
      result.push({ ...rule, tiers, countryEntries });
    }
    return result;
  }

  async getAllBonusRules(filters?: { providerId?: number; providerCountryId?: number; agreementStatus?: string; bonusType?: string; search?: string }): Promise<any[]> {
    const conditions: any[] = [];
    if (filters?.providerId) conditions.push(eq(agreements.universityId, filters.providerId));
    if (filters?.providerCountryId) conditions.push(eq(universities.countryId, filters.providerCountryId));
    if (filters?.agreementStatus) conditions.push(eq(agreements.status, filters.agreementStatus));
    if (filters?.bonusType) conditions.push(eq(targetBonusRules.bonusType, filters.bonusType));
    if (filters?.search) {
      const s = `%${filters.search}%`;
      conditions.push(or(
        ilike(universities.name, s),
        ilike(agreements.title, s),
        ilike(agreements.agreementCode, s),
      ));
    }

    const rows = await db
      .select({
        id: targetBonusRules.id,
        targetId: targetBonusRules.targetId,
        bonusType: targetBonusRules.bonusType,
        currency: targetBonusRules.currency,
        ruleCreatedAt: targetBonusRules.createdAt,
        targetType: agreementTargets.targetType,
        metric: agreementTargets.metric,
        targetValue: agreementTargets.value,
        periodKey: agreementTargets.periodKey,
        agreementId: agreements.id,
        agreementCode: agreements.agreementCode,
        agreementTitle: agreements.title,
        agreementStatus: agreements.status,
        providerId: universities.id,
        providerName: universities.name,
        providerCountryId: universities.countryId,
        providerCountryName: countries.name,
      })
      .from(targetBonusRules)
      .innerJoin(agreementTargets, eq(targetBonusRules.targetId, agreementTargets.id))
      .innerJoin(agreements, eq(agreementTargets.agreementId, agreements.id))
      .innerJoin(universities, eq(agreements.universityId, universities.id))
      .leftJoin(countries, eq(universities.countryId, countries.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(targetBonusRules.createdAt));

    const result = [];
    for (const row of rows) {
      const tiers = await db.select().from(targetBonusTiers).where(eq(targetBonusTiers.bonusRuleId, row.id)).orderBy(asc(targetBonusTiers.minStudents));
      const countryEntries = await db
        .select({
          id: targetBonusCountry.id,
          bonusRuleId: targetBonusCountry.bonusRuleId,
          countryId: targetBonusCountry.countryId,
          studentCount: targetBonusCountry.studentCount,
          bonusAmount: targetBonusCountry.bonusAmount,
          countryName: countries.name,
        })
        .from(targetBonusCountry)
        .innerJoin(countries, eq(targetBonusCountry.countryId, countries.id))
        .where(eq(targetBonusCountry.bonusRuleId, row.id));

      const agreementIds = [row.agreementId];
      const territories = await db
        .select({ countryName: countries.name })
        .from(agreementTerritories)
        .innerJoin(countries, eq(agreementTerritories.countryId, countries.id))
        .where(eq(agreementTerritories.agreementId, row.agreementId));

      result.push({
        ...row,
        tiers,
        countryEntries,
        territoryCountries: territories.map(t => t.countryName),
      });
    }

    return result;
  }

  async createBonusRule(rule: any): Promise<TargetBonusRule> {
    const [created] = await db.insert(targetBonusRules).values(rule).returning();
    return created;
  }

  async deleteBonusRule(id: number): Promise<void> {
    await db.delete(targetBonusRules).where(eq(targetBonusRules.id, id));
  }

  async createBonusTier(tier: any): Promise<TargetBonusTier> {
    const [created] = await db.insert(targetBonusTiers).values(tier).returning();
    return created;
  }

  async createBonusCountryEntry(entry: any): Promise<TargetBonusCountryEntry> {
    const [created] = await db.insert(targetBonusCountry).values(entry).returning();
    return created;
  }

  async getCommissionRules(agreementId: number): Promise<AgreementCommissionRule[]> {
    return db.select().from(agreementCommissionRules).where(eq(agreementCommissionRules.agreementId, agreementId)).orderBy(asc(agreementCommissionRules.priority));
  }

  async getAllCommissionRules(filters?: { providerId?: number; providerCountryId?: number; agreementStatus?: string; commissionMode?: string; search?: string }): Promise<any[]> {
    const conditions: any[] = [];
    if (filters?.providerId) conditions.push(eq(agreements.universityId, filters.providerId));
    if (filters?.providerCountryId) conditions.push(eq(universities.countryId, filters.providerCountryId));
    if (filters?.agreementStatus) conditions.push(eq(agreements.status, filters.agreementStatus));
    if (filters?.commissionMode) conditions.push(eq(agreementCommissionRules.commissionMode, filters.commissionMode));
    if (filters?.search) {
      const s = `%${filters.search}%`;
      conditions.push(or(
        ilike(universities.name, s),
        ilike(agreements.title, s),
        ilike(agreements.agreementCode, s),
        ilike(agreementCommissionRules.label, s),
        ilike(agreementCommissionRules.studyLevel, s),
      ));
    }

    const rows = await db
      .select({
        id: agreementCommissionRules.id,
        agreementId: agreementCommissionRules.agreementId,
        label: agreementCommissionRules.label,
        studyLevel: agreementCommissionRules.studyLevel,
        commissionMode: agreementCommissionRules.commissionMode,
        percentageValue: agreementCommissionRules.percentageValue,
        flatAmount: agreementCommissionRules.flatAmount,
        currency: agreementCommissionRules.currency,
        basis: agreementCommissionRules.basis,
        payEvent: agreementCommissionRules.payEvent,
        conditionsText: agreementCommissionRules.conditionsText,
        effectiveFrom: agreementCommissionRules.effectiveFrom,
        effectiveTo: agreementCommissionRules.effectiveTo,
        priority: agreementCommissionRules.priority,
        isActive: agreementCommissionRules.isActive,
        createdAt: agreementCommissionRules.createdAt,
        updatedAt: agreementCommissionRules.updatedAt,
        agreementCode: agreements.agreementCode,
        agreementTitle: agreements.title,
        agreementStatus: agreements.status,
        providerId: universities.id,
        providerName: universities.name,
        providerCountryId: universities.countryId,
        providerCountryName: countries.name,
      })
      .from(agreementCommissionRules)
      .innerJoin(agreements, eq(agreementCommissionRules.agreementId, agreements.id))
      .innerJoin(universities, eq(agreements.universityId, universities.id))
      .leftJoin(countries, eq(universities.countryId, countries.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(agreementCommissionRules.updatedAt));

    const agreementIds = [...new Set(rows.map(r => r.agreementId))];
    const territoryMap: Record<number, string[]> = {};
    if (agreementIds.length > 0) {
      const territories = await db
        .select({
          agreementId: agreementTerritories.agreementId,
          countryName: countries.name,
        })
        .from(agreementTerritories)
        .innerJoin(countries, eq(agreementTerritories.countryId, countries.id))
        .where(inArray(agreementTerritories.agreementId, agreementIds));
      for (const t of territories) {
        if (!territoryMap[t.agreementId]) territoryMap[t.agreementId] = [];
        territoryMap[t.agreementId].push(t.countryName);
      }
    }

    return rows.map(r => ({
      ...r,
      territoryCountries: territoryMap[r.agreementId] || [],
    }));
  }

  async createCommissionRule(rule: InsertCommissionRule): Promise<AgreementCommissionRule> {
    const [created] = await db.insert(agreementCommissionRules).values(rule).returning();
    return created;
  }

  async updateCommissionRule(id: number, data: Partial<InsertCommissionRule>): Promise<AgreementCommissionRule> {
    const [updated] = await db.update(agreementCommissionRules).set({ ...data, updatedAt: new Date() }).where(eq(agreementCommissionRules.id, id)).returning();
    return updated;
  }

  async deleteCommissionRule(id: number): Promise<void> {
    await db.delete(agreementCommissionRules).where(eq(agreementCommissionRules.id, id));
  }

  async getContacts(agreementId: number): Promise<AgreementContact[]> {
    return db.select().from(agreementContacts).where(eq(agreementContacts.agreementId, agreementId)).orderBy(desc(agreementContacts.isPrimary));
  }

  async getAllContacts(filters?: { q?: string; providerId?: number; providerCountryId?: number; contactCountryId?: number; agreementStatus?: string }): Promise<any[]> {
    const providerCountry = aliasedTable(countries, "providerCountry");
    const contactCountry = aliasedTable(countries, "contactCountry");

    const conditions: any[] = [];

    if (filters?.q) {
      const search = `%${filters.q}%`;
      conditions.push(or(
        ilike(agreementContacts.fullName, search),
        ilike(agreementContacts.email, search),
        ilike(agreementContacts.phone, search),
        ilike(universities.name, search),
        ilike(agreements.title, search),
        ilike(agreements.agreementCode, search),
      ));
    }
    if (filters?.providerId) {
      conditions.push(eq(agreements.universityId, filters.providerId));
    }
    if (filters?.providerCountryId) {
      conditions.push(eq(universities.countryId, filters.providerCountryId));
    }
    if (filters?.contactCountryId) {
      conditions.push(eq(agreementContacts.countryId, filters.contactCountryId));
    }
    if (filters?.agreementStatus) {
      conditions.push(eq(agreements.status, filters.agreementStatus));
    }

    const rows = await db
      .select({
        id: agreementContacts.id,
        fullName: agreementContacts.fullName,
        positionTitle: agreementContacts.positionTitle,
        email: agreementContacts.email,
        phone: agreementContacts.phone,
        isPrimary: agreementContacts.isPrimary,
        notes: agreementContacts.notes,
        city: agreementContacts.city,
        contactCountryId: agreementContacts.countryId,
        contactCountryName: contactCountry.name,
        agreementId: agreements.id,
        agreementCode: agreements.agreementCode,
        agreementTitle: agreements.title,
        agreementStatus: agreements.status,
        providerId: universities.id,
        providerName: universities.name,
        providerType: universities.providerType,
        providerCountryId: universities.countryId,
        providerCountryName: providerCountry.name,
        createdAt: agreementContacts.createdAt,
      })
      .from(agreementContacts)
      .innerJoin(agreements, eq(agreementContacts.agreementId, agreements.id))
      .innerJoin(universities, eq(agreements.universityId, universities.id))
      .leftJoin(providerCountry, eq(universities.countryId, providerCountry.id))
      .leftJoin(contactCountry, eq(agreementContacts.countryId, contactCountry.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(agreementContacts.isPrimary), asc(agreementContacts.fullName));

    const agreementIds = [...new Set(rows.map(r => r.agreementId))];
    const territoryMap: Record<number, string[]> = {};
    if (agreementIds.length > 0) {
      const territories = await db
        .select({
          agreementId: agreementTerritories.agreementId,
          countryName: countries.name,
        })
        .from(agreementTerritories)
        .innerJoin(countries, eq(agreementTerritories.countryId, countries.id))
        .where(inArray(agreementTerritories.agreementId, agreementIds));
      for (const t of territories) {
        if (!territoryMap[t.agreementId]) territoryMap[t.agreementId] = [];
        territoryMap[t.agreementId].push(t.countryName);
      }
    }

    return rows.map(r => ({
      ...r,
      territoryCountries: territoryMap[r.agreementId] || [],
    }));
  }

  async createContact(contact: InsertContact): Promise<AgreementContact> {
    const [created] = await db.insert(agreementContacts).values(contact).returning();
    return created;
  }

  async updateContact(id: number, data: Partial<InsertContact>): Promise<AgreementContact> {
    const [updated] = await db.update(agreementContacts).set({ ...data, updatedAt: new Date() }).where(eq(agreementContacts.id, id)).returning();
    return updated;
  }

  async deleteContact(id: number): Promise<void> {
    await db.delete(agreementContacts).where(eq(agreementContacts.id, id));
  }

  async getDocuments(agreementId: number): Promise<AgreementDocument[]> {
    return db.select().from(agreementDocuments).where(eq(agreementDocuments.agreementId, agreementId)).orderBy(desc(agreementDocuments.versionNo));
  }

  async getDocument(id: number): Promise<AgreementDocument | undefined> {
    const [doc] = await db.select().from(agreementDocuments).where(eq(agreementDocuments.id, id));
    return doc;
  }

  async createDocument(doc: InsertDocument): Promise<AgreementDocument> {
    const [created] = await db.insert(agreementDocuments).values(doc).returning();
    return created;
  }

  async getExpiringAgreements(daysAhead: number): Promise<any[]> {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + daysAhead);
    const todayStr = today.toISOString().split('T')[0];
    const futureStr = futureDate.toISOString().split('T')[0];

    return db
      .select({
        id: agreements.id,
        agreementCode: agreements.agreementCode,
        title: agreements.title,
        status: agreements.status,
        expiryDate: agreements.expiryDate,
        universityName: universities.name,
      })
      .from(agreements)
      .innerJoin(universities, eq(agreements.universityId, universities.id))
      .where(
        and(
          eq(agreements.status, "active"),
          gte(agreements.expiryDate, todayStr),
          lte(agreements.expiryDate, futureStr)
        )
      )
      .orderBy(asc(agreements.expiryDate));
  }

  async getRecentAgreements(limit: number): Promise<any[]> {
    return db
      .select({
        id: agreements.id,
        agreementCode: agreements.agreementCode,
        title: agreements.title,
        status: agreements.status,
        agreementType: agreements.agreementType,
        updatedAt: agreements.updatedAt,
        universityName: universities.name,
      })
      .from(agreements)
      .innerJoin(universities, eq(agreements.universityId, universities.id))
      .orderBy(desc(agreements.updatedAt))
      .limit(limit);
  }

  async getAgreementStatusCounts(): Promise<Record<string, number>> {
    const results = await db
      .select({ status: agreements.status, count: sql<number>`count(*)` })
      .from(agreements)
      .groupBy(agreements.status);
    const counts: Record<string, number> = {};
    for (const r of results) {
      counts[r.status] = Number(r.count);
    }
    return counts;
  }

  async getDashboardStats(): Promise<{ total: number; active: number; expiringSoon: number; expired: number }> {
    const [totalResult] = await db.select({ count: sql<number>`count(*)` }).from(agreements);
    const [activeResult] = await db.select({ count: sql<number>`count(*)` }).from(agreements).where(eq(agreements.status, "active"));
    const [expiredResult] = await db.select({ count: sql<number>`count(*)` }).from(agreements).where(eq(agreements.status, "expired"));

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 90);
    const todayStr = new Date().toISOString().split('T')[0];
    const futureStr = futureDate.toISOString().split('T')[0];

    const [expiringResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(agreements)
      .where(and(eq(agreements.status, "active"), gte(agreements.expiryDate, todayStr), lte(agreements.expiryDate, futureStr)));

    return {
      total: Number(totalResult.count),
      active: Number(activeResult.count),
      expiringSoon: Number(expiringResult.count),
      expired: Number(expiredResult.count),
    };
  }

  async createAuditLog(log: { userId?: number; action: string; entityType: string; entityId?: number; ipAddress?: string; userAgent?: string; metadata?: any }): Promise<void> {
    await db.insert(auditLogs).values(log);
  }

  async getAuditLogs(filters?: { entityType?: string; entityId?: number; userId?: number; limit?: number }): Promise<AuditLog[]> {
    let query = db.select().from(auditLogs);
    const conditions: any[] = [];
    if (filters?.entityType) conditions.push(eq(auditLogs.entityType, filters.entityType));
    if (filters?.entityId) conditions.push(eq(auditLogs.entityId, filters.entityId));
    if (filters?.userId) conditions.push(eq(auditLogs.userId, filters.userId));
    if (conditions.length > 0) query = query.where(and(...conditions)) as any;
    return (query as any).orderBy(desc(auditLogs.createdAt)).limit(filters?.limit || 100);
  }

  async createPasswordResetToken(data: { userId: number; tokenHash: string; expiresAt: Date; requestIp?: string; userAgent?: string }): Promise<PasswordResetToken> {
    const [created] = await db.insert(passwordResetTokens).values(data).returning();
    return created;
  }

  async getPasswordResetTokenByHash(tokenHash: string): Promise<PasswordResetToken | undefined> {
    const [token] = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.tokenHash, tokenHash));
    return token;
  }

  async markPasswordResetTokenUsed(id: number): Promise<void> {
    await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, id));
  }

  async invalidateUserPasswordResetTokens(userId: number): Promise<void> {
    await db.update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(and(
        eq(passwordResetTokens.userId, userId),
        sql`${passwordResetTokens.usedAt} IS NULL`
      ));
  }

  async invalidateUserSessions(userId: number): Promise<void> {
    await db.execute(
      sql`DELETE FROM "session" WHERE sess->>'userId' = ${String(userId)}`
    );
  }

  async getCommissionStudents(filters?: { search?: string; agent?: string; provider?: string; country?: string; status?: string; agents?: string[]; providers?: string[]; statuses?: string[] }): Promise<CommissionStudent[]> {
    const conditions = [];
    if (filters?.search) {
      conditions.push(or(
        ilike(commissionStudents.studentName, `%${filters.search}%`),
        ilike(commissionStudents.studentId, `%${filters.search}%`),
        ilike(commissionStudents.agentsicId, `%${filters.search}%`),
        ilike(commissionStudents.agentName, `%${filters.search}%`)
      ));
    }
    if (filters?.agents && filters.agents.length > 0) conditions.push(inArray(commissionStudents.agentName, filters.agents));
    else if (filters?.agent) conditions.push(eq(commissionStudents.agentName, filters.agent));
    if (filters?.providers && filters.providers.length > 0) conditions.push(inArray(commissionStudents.provider, filters.providers));
    else if (filters?.provider) conditions.push(eq(commissionStudents.provider, filters.provider));
    if (filters?.country) conditions.push(eq(commissionStudents.country, filters.country));
    if (filters?.statuses && filters.statuses.length > 0) conditions.push(inArray(commissionStudents.status, filters.statuses));
    else if (filters?.status) conditions.push(eq(commissionStudents.status, filters.status));

    if (conditions.length > 0) {
      return db.select().from(commissionStudents)
        .where(and(...conditions))
        .orderBy(asc(commissionStudents.id));
    }
    return db.select().from(commissionStudents).orderBy(asc(commissionStudents.id));
  }

  async getCommissionTerms(): Promise<CommissionTerm[]> {
    return db.select().from(commissionTerms).orderBy(asc(commissionTerms.sortOrder));
  }

  async createCommissionTerm(data: { termName: string; termLabel: string; year: number; termNumber: number; sortOrder: number }): Promise<CommissionTerm> {
    const [term] = await db.insert(commissionTerms).values(data).returning();
    return term;
  }

  async deleteCommissionTerm(id: number): Promise<void> {
    await db.delete(commissionTerms).where(eq(commissionTerms.id, id));
  }

  async checkCommissionStudentDuplicates(studentName: string, agentsicId: string, provider: string, studentId: string, excludeId?: number): Promise<string | null> {
    const norm = (s: string) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");
    const nameN = norm(studentName);
    const agentsicN = norm(agentsicId);
    const providerN = norm(provider);
    const studentIdN = norm(studentId);

    const allStudents = await this.getCommissionStudents();
    for (const s of allStudents) {
      if (excludeId && s.id === excludeId) continue;
      const sName = norm(s.studentName);
      const sAgentsic = norm(s.agentsicId || "");
      const sProvider = norm(s.provider);
      const sStudentId = norm(s.studentId || "");

      if (nameN && agentsicN && providerN && sName === nameN && sAgentsic === agentsicN && sProvider === providerN) {
        return `Duplicate blocked: Student Name + Agentsic ID + Provider already exists (${s.studentName}, ${s.agentsicId}, ${s.provider})`;
      }
      if (nameN && providerN && studentIdN && sName === nameN && sProvider === providerN && sStudentId === studentIdN) {
        return `Duplicate blocked: Student Name + Provider + Student ID already exists (${s.studentName}, ${s.provider}, ${s.studentId})`;
      }
      if (providerN && studentIdN && sProvider === providerN && sStudentId === studentIdN) {
        return `Duplicate blocked: Provider + Student ID already exists (${s.provider}, ${s.studentId})`;
      }
    }
    return null;
  }

  async getCommissionStudent(id: number): Promise<CommissionStudent | undefined> {
    const [student] = await db.select().from(commissionStudents).where(eq(commissionStudents.id, id));
    return student;
  }

  async createCommissionStudent(data: InsertCommissionStudent): Promise<CommissionStudent> {
    const [created] = await db.insert(commissionStudents).values(data).returning();
    return created;
  }

  async updateCommissionStudent(id: number, data: Partial<InsertCommissionStudent>): Promise<CommissionStudent> {
    const [updated] = await db.update(commissionStudents)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(commissionStudents.id, id))
      .returning();
    return updated;
  }

  async deleteCommissionStudent(id: number): Promise<void> {
    await db.delete(commissionStudents).where(eq(commissionStudents.id, id));
  }

  async getCommissionEntries(studentId: number): Promise<CommissionEntry[]> {
    return db.select().from(commissionEntries)
      .where(eq(commissionEntries.commissionStudentId, studentId))
      .orderBy(asc(commissionEntries.termName));
  }

  async getCommissionEntry(id: number): Promise<CommissionEntry | undefined> {
    const [entry] = await db.select().from(commissionEntries).where(eq(commissionEntries.id, id));
    return entry;
  }

  async createCommissionEntry(data: InsertCommissionEntry): Promise<CommissionEntry> {
    const [created] = await db.insert(commissionEntries).values(data).returning();
    return created;
  }

  async updateCommissionEntry(id: number, data: Partial<InsertCommissionEntry>): Promise<CommissionEntry> {
    const [updated] = await db.update(commissionEntries)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(commissionEntries.id, id))
      .returning();
    return updated;
  }

  async deleteCommissionEntry(id: number): Promise<void> {
    await db.delete(commissionEntries).where(eq(commissionEntries.id, id));
  }

  async getCommissionEntriesByTerm(termName: string): Promise<CommissionEntry[]> {
    return db.select().from(commissionEntries)
      .where(eq(commissionEntries.termName, termName))
      .orderBy(asc(commissionEntries.id));
  }

  async getCommissionTrackerDashboard(): Promise<{
    totalStudents: number;
    totalCommission: number;
    totalReceived: number;
    byStatus: Record<string, number>;
    byAgent: { agent: string; count: number; total: number }[];
    byProvider: { provider: string; count: number; total: number }[];
  }> {
    const students = await db.select().from(commissionStudents);

    const byStatus: Record<string, number> = {};
    let totalCommission = 0;
    let totalReceived = 0;
    const agentMap: Record<string, { count: number; total: number }> = {};
    const providerMap: Record<string, { count: number; total: number }> = {};

    for (const s of students) {
      const st = s.status || "Under Enquiry";
      byStatus[st] = (byStatus[st] || 0) + 1;

      const tr = Number(s.totalReceived) || 0;
      totalCommission += tr;

      const entries = await db.select().from(commissionEntries)
        .where(eq(commissionEntries.commissionStudentId, s.id));

      let received = 0;
      for (const e of entries) {
        if (e.paymentStatus === "Received") {
          received += Number(e.totalAmount) || 0;
        }
      }
      totalReceived += received;

      if (!agentMap[s.agentName]) agentMap[s.agentName] = { count: 0, total: 0 };
      agentMap[s.agentName].count++;
      agentMap[s.agentName].total += tr;

      if (!providerMap[s.provider]) providerMap[s.provider] = { count: 0, total: 0 };
      providerMap[s.provider].count++;
      providerMap[s.provider].total += tr;
    }

    return {
      totalStudents: students.length,
      totalCommission,
      totalReceived,
      byStatus,
      byAgent: Object.entries(agentMap).map(([agent, v]) => ({ agent, ...v })).sort((a, b) => b.total - a.total),
      byProvider: Object.entries(providerMap).map(([provider, v]) => ({ provider, ...v })).sort((a, b) => b.total - a.total),
    };
  }

  async createUserSession(data: {
    userId: number;
    sessionToken?: string;
    ipAddress?: string;
    browser?: string;
    os?: string;
    deviceType?: string;
    location?: string;
    otpVerified?: boolean;
  }): Promise<UserSession> {
    const [session] = await db.insert(userSessions).values(data).returning();
    return session;
  }

  async getUserSessions(userId: number, activeOnly = false): Promise<UserSession[]> {
    const conditions = [eq(userSessions.userId, userId)];
    if (activeOnly) conditions.push(eq(userSessions.isActive, true));
    return db.select().from(userSessions).where(and(...conditions)).orderBy(desc(userSessions.loginAt));
  }

  async getUserSession(id: number): Promise<UserSession | undefined> {
    const [session] = await db.select().from(userSessions).where(eq(userSessions.id, id));
    return session;
  }

  async updateUserSession(id: number, data: Partial<UserSession>): Promise<UserSession> {
    const [session] = await db.update(userSessions).set(data).where(eq(userSessions.id, id)).returning();
    return session;
  }

  async deactivateUserSessions(userId: number, reason: string, exceptSessionId?: number): Promise<void> {
    const conditions = [eq(userSessions.userId, userId), eq(userSessions.isActive, true)];
    if (exceptSessionId) {
      await db.update(userSessions)
        .set({ isActive: false, logoutAt: new Date(), logoutReason: reason })
        .where(and(...conditions, sql`${userSessions.id} != ${exceptSessionId}`));
    } else {
      await db.update(userSessions)
        .set({ isActive: false, logoutAt: new Date(), logoutReason: reason })
        .where(and(...conditions));
    }
  }

  async createLoginVerificationCode(data: {
    userId: number;
    codeHash: string;
    expiresAt: Date;
  }): Promise<LoginVerificationCode> {
    await db.update(loginVerificationCodes)
      .set({ status: "invalidated" })
      .where(and(eq(loginVerificationCodes.userId, data.userId), eq(loginVerificationCodes.status, "pending")));
    const [code] = await db.insert(loginVerificationCodes).values(data).returning();
    return code;
  }

  async getActiveVerificationCode(userId: number): Promise<LoginVerificationCode | undefined> {
    const [code] = await db.select().from(loginVerificationCodes)
      .where(and(
        eq(loginVerificationCodes.userId, userId),
        eq(loginVerificationCodes.status, "pending"),
        sql`${loginVerificationCodes.expiresAt} > NOW()`
      ))
      .orderBy(desc(loginVerificationCodes.createdAt))
      .limit(1);
    return code;
  }

  async updateVerificationCode(id: number, data: Partial<LoginVerificationCode>): Promise<void> {
    await db.update(loginVerificationCodes).set(data).where(eq(loginVerificationCodes.id, id));
  }

  async createSecurityAuditLog(data: {
    userId?: number;
    eventType: string;
    ipAddress?: string;
    deviceInfo?: string;
    metadata?: any;
  }): Promise<SecurityAuditLog> {
    const [log] = await db.insert(securityAuditLogs).values(data).returning();
    return log;
  }

  async getSecurityAuditLogs(userId?: number, limit = 50): Promise<SecurityAuditLog[]> {
    const conditions = userId ? [eq(securityAuditLogs.userId, userId)] : [];
    return db.select().from(securityAuditLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(securityAuditLogs.createdAt))
      .limit(limit);
  }

  async addPasswordToHistory(userId: number, hash: string): Promise<void> {
    await db.insert(passwordHistory).values({ userId, passwordHash: hash });
  }

  async getPasswordHistory(userId: number, limit = 5): Promise<{ passwordHash: string }[]> {
    return db.select({ passwordHash: passwordHistory.passwordHash })
      .from(passwordHistory)
      .where(eq(passwordHistory.userId, userId))
      .orderBy(desc(passwordHistory.createdAt))
      .limit(limit);
  }

  async updateUserPassword(userId: number, newPasswordHash: string): Promise<void> {
    await db.update(users).set({
      passwordHash: newPasswordHash,
      passwordChangedAt: new Date(),
      forcePasswordChange: false,
      updatedAt: new Date(),
    }).where(eq(users.id, userId));
  }

  async updateUserActiveStatus(userId: number, isActive: boolean): Promise<void> {
    await db.update(users).set({ isActive, updatedAt: new Date() }).where(eq(users.id, userId));
  }

  async updateUserLoginInfo(userId: number, ip: string): Promise<void> {
    await db.update(users).set({
      lastLoginAt: new Date(),
      lastLoginIp: ip,
    }).where(eq(users.id, userId));
  }

  async getSubAgentEntries(filters?: { search?: string; agents?: string[]; providers?: string[]; statuses?: string[] }): Promise<(SubAgentEntry & { student: CommissionStudent })[]> {
    const conditions: any[] = [];
    if (filters?.search) {
      const s = `%${filters.search}%`;
      conditions.push(or(
        ilike(commissionStudents.studentName, s),
        ilike(commissionStudents.agentName, s),
        ilike(commissionStudents.agentsicId, s),
        ilike(commissionStudents.provider, s)
      ));
    }
    if (filters?.agents?.length) conditions.push(inArray(commissionStudents.agentName, filters.agents));
    if (filters?.providers?.length) conditions.push(inArray(commissionStudents.provider, filters.providers));
    if (filters?.statuses?.length) conditions.push(inArray(subAgentEntries.status, filters.statuses));

    const rows = await db.select()
      .from(subAgentEntries)
      .innerJoin(commissionStudents, eq(subAgentEntries.commissionStudentId, commissionStudents.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(commissionStudents.agentName), asc(commissionStudents.studentName));

    return rows.map(r => ({ ...r.sub_agent_entries, student: r.commission_students }));
  }

  async getSubAgentEntry(studentId: number): Promise<(SubAgentEntry & { student: CommissionStudent }) | undefined> {
    const [row] = await db.select()
      .from(subAgentEntries)
      .innerJoin(commissionStudents, eq(subAgentEntries.commissionStudentId, commissionStudents.id))
      .where(eq(subAgentEntries.commissionStudentId, studentId));
    if (!row) return undefined;
    return { ...row.sub_agent_entries, student: row.commission_students };
  }

  async upsertSubAgentEntry(commissionStudentId: number, data: Partial<InsertSubAgentEntry>): Promise<SubAgentEntry> {
    const [existing] = await db.select().from(subAgentEntries)
      .where(eq(subAgentEntries.commissionStudentId, commissionStudentId));

    if (existing) {
      const [updated] = await db.update(subAgentEntries)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(subAgentEntries.commissionStudentId, commissionStudentId))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(subAgentEntries)
        .values({ commissionStudentId, ...data })
        .returning();
      return created;
    }
  }

  async deleteSubAgentEntry(studentId: number): Promise<void> {
    await db.delete(subAgentTermEntries).where(eq(subAgentTermEntries.commissionStudentId, studentId));
    await db.delete(subAgentEntries).where(eq(subAgentEntries.commissionStudentId, studentId));
  }

  async getSubAgentTermEntries(termName: string, filters?: { search?: string; agents?: string[]; providers?: string[]; statuses?: string[] }): Promise<(SubAgentTermEntry & { student: CommissionStudent })[]> {
    const conditions: any[] = [eq(subAgentTermEntries.termName, termName)];
    if (filters?.search) {
      const s = `%${filters.search}%`;
      conditions.push(or(
        ilike(commissionStudents.studentName, s),
        ilike(commissionStudents.agentName, s),
        ilike(commissionStudents.agentsicId, s),
        ilike(commissionStudents.provider, s)
      ));
    }
    if (filters?.agents?.length) conditions.push(inArray(commissionStudents.agentName, filters.agents));
    if (filters?.providers?.length) conditions.push(inArray(commissionStudents.provider, filters.providers));
    if (filters?.statuses?.length) conditions.push(inArray(subAgentTermEntries.studentStatus, filters.statuses));

    const rows = await db.select()
      .from(subAgentTermEntries)
      .innerJoin(commissionStudents, eq(subAgentTermEntries.commissionStudentId, commissionStudents.id))
      .where(and(...conditions))
      .orderBy(asc(commissionStudents.agentName), asc(commissionStudents.studentName));

    return rows.map(r => ({ ...r.sub_agent_term_entries, student: r.commission_students }));
  }

  async getSubAgentTermEntry(id: number): Promise<(SubAgentTermEntry & { student: CommissionStudent }) | undefined> {
    const [row] = await db.select()
      .from(subAgentTermEntries)
      .innerJoin(commissionStudents, eq(subAgentTermEntries.commissionStudentId, commissionStudents.id))
      .where(eq(subAgentTermEntries.id, id));
    if (!row) return undefined;
    return { ...row.sub_agent_term_entries, student: row.commission_students };
  }

  async createSubAgentTermEntry(data: InsertSubAgentTermEntry): Promise<SubAgentTermEntry> {
    const [created] = await db.insert(subAgentTermEntries).values(data).returning();
    return created;
  }

  async updateSubAgentTermEntry(id: number, data: Partial<InsertSubAgentTermEntry>): Promise<SubAgentTermEntry> {
    const [updated] = await db.update(subAgentTermEntries)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(subAgentTermEntries.id, id))
      .returning();
    return updated;
  }

  async deleteSubAgentTermEntry(id: number): Promise<void> {
    await db.delete(subAgentTermEntries).where(eq(subAgentTermEntries.id, id));
  }

  async syncSubAgentFromMain(): Promise<{ added: number; updated: number; removed: number }> {
    const allStudents = await db.select().from(commissionStudents);
    const existingEntries = await db.select().from(subAgentEntries);
    const existingMap = new Map(existingEntries.map(e => [e.commissionStudentId, e]));
    const studentIds = new Set(allStudents.map(s => s.id));

    let added = 0, updated = 0, removed = 0;

    for (const student of allStudents) {
      const existing = existingMap.get(student.id);
      if (!existing) {
        await db.insert(subAgentEntries).values({
          commissionStudentId: student.id,
          sicReceivedTotal: student.totalReceived || "0",
          status: student.status || "Under Enquiry",
        });
        added++;
      } else {
        await db.update(subAgentEntries)
          .set({
            sicReceivedTotal: student.totalReceived || "0",
            status: student.status || "Under Enquiry",
            updatedAt: new Date(),
          })
          .where(eq(subAgentEntries.commissionStudentId, student.id));
        updated++;
      }
    }

    for (const entry of existingEntries) {
      if (!studentIds.has(entry.commissionStudentId)) {
        await db.delete(subAgentTermEntries).where(eq(subAgentTermEntries.commissionStudentId, entry.commissionStudentId));
        await db.delete(subAgentEntries).where(eq(subAgentEntries.id, entry.id));
        removed++;
      }
    }

    for (const student of allStudents) {
      const terms = await db.select().from(commissionTerms).orderBy(asc(commissionTerms.sortOrder));
      for (const term of terms) {
        const [existingTermEntry] = await db.select().from(subAgentTermEntries)
          .where(and(
            eq(subAgentTermEntries.commissionStudentId, student.id),
            eq(subAgentTermEntries.termName, term.termName)
          ));

        const [mainEntry] = await db.select().from(commissionEntries)
          .where(and(
            eq(commissionEntries.commissionStudentId, student.id),
            eq(commissionEntries.termName, term.termName)
          ));

        const mainComm = mainEntry ? String(Number(mainEntry.commissionAmount) || 0) : "0";
        const studentStatus = mainEntry?.studentStatus || student.status || "Under Enquiry";

        if (existingTermEntry) {
          await db.update(subAgentTermEntries)
            .set({ mainCommission: mainComm, studentStatus, updatedAt: new Date() })
            .where(eq(subAgentTermEntries.id, existingTermEntry.id));
        } else {
          const [subAgentEntry] = await db.select().from(subAgentEntries)
            .where(eq(subAgentEntries.commissionStudentId, student.id));
          const autoRate = subAgentEntry?.subAgentCommissionRatePct || "0";

          await db.insert(subAgentTermEntries).values({
            commissionStudentId: student.id,
            termName: term.termName,
            mainCommission: mainComm,
            commissionRateAuto: autoRate,
            commissionRateUsedPct: autoRate,
            studentStatus,
          });
        }
      }
    }

    return { added, updated, removed };
  }

  async recalcSubAgentMasterTotals(commissionStudentId: number): Promise<SubAgentEntry> {
    const termEntries = await db.select().from(subAgentTermEntries)
      .where(eq(subAgentTermEntries.commissionStudentId, commissionStudentId));

    let totalPaid = 0;
    for (const te of termEntries) {
      totalPaid += Number(te.totalPaid) || 0;
    }

    const [student] = await db.select().from(commissionStudents)
      .where(eq(commissionStudents.id, commissionStudentId));

    const received = Number(student?.totalReceived) || 0;
    const margin = Math.round((received - totalPaid + Number.EPSILON) * 100) / 100;
    const overpayWarning = received > 0 && totalPaid > received ? "❌ Overpaid" : null;

    const [updated] = await db.update(subAgentEntries)
      .set({
        subAgentPaidTotal: String(Math.round((totalPaid + Number.EPSILON) * 100) / 100),
        margin: String(margin),
        overpayWarning,
        updatedAt: new Date(),
      })
      .where(eq(subAgentEntries.commissionStudentId, commissionStudentId))
      .returning();

    return updated;
  }

  async getSubAgentDashboard(year?: number): Promise<{
    totalStudents: number;
    totalPaid: number;
    totalMargin: number;
    byStatus: Record<string, number>;
    byAgent: { agent: string; count: number; totalPaid: number }[];
    byProvider: { provider: string; count: number; totalPaid: number }[];
  }> {
    const rows = await db.select()
      .from(subAgentEntries)
      .innerJoin(commissionStudents, eq(subAgentEntries.commissionStudentId, commissionStudents.id));

    const yearTermNames = year
      ? (await db.select().from(commissionTerms).where(eq(commissionTerms.year, year))).map(t => t.termName)
      : null;

    const allTermEntries = yearTermNames
      ? await db.select().from(subAgentTermEntries).where(inArray(subAgentTermEntries.termName, yearTermNames.length > 0 ? yearTermNames : ["__none__"]))
      : await db.select().from(subAgentTermEntries);

    const termPaidByStudent: Record<number, number> = {};
    for (const te of allTermEntries) {
      const sid = te.commissionStudentId;
      termPaidByStudent[sid] = (termPaidByStudent[sid] || 0) + (Number(te.totalPaid) || 0);
    }

    const relevantStudentIds = year ? new Set(Object.keys(termPaidByStudent).map(Number)) : null;

    const byStatus: Record<string, number> = {};
    let totalPaid = 0;
    let totalMargin = 0;
    const agentMap: Record<string, { count: number; totalPaid: number }> = {};
    const providerMap: Record<string, { count: number; totalPaid: number }> = {};

    for (const r of rows) {
      const entry = r.sub_agent_entries;
      const student = r.commission_students;

      if (relevantStudentIds && !relevantStudentIds.has(entry.commissionStudentId)) continue;

      const st = entry.status || "Under Enquiry";
      byStatus[st] = (byStatus[st] || 0) + 1;

      const paid = year ? (termPaidByStudent[entry.commissionStudentId] || 0) : (Number(entry.subAgentPaidTotal) || 0);
      totalPaid += paid;
      const margin = year ? 0 : (Number(entry.margin) || 0);
      totalMargin += margin;

      if (!agentMap[student.agentName]) agentMap[student.agentName] = { count: 0, totalPaid: 0 };
      agentMap[student.agentName].count++;
      agentMap[student.agentName].totalPaid += paid;

      if (!providerMap[student.provider]) providerMap[student.provider] = { count: 0, totalPaid: 0 };
      providerMap[student.provider].count++;
      providerMap[student.provider].totalPaid += paid;
    }

    return {
      totalStudents: year ? (relevantStudentIds?.size || 0) : rows.length,
      totalPaid: Math.round((totalPaid + Number.EPSILON) * 100) / 100,
      totalMargin: Math.round((totalMargin + Number.EPSILON) * 100) / 100,
      byStatus,
      byAgent: Object.entries(agentMap).map(([agent, v]) => ({ agent, ...v })).sort((a, b) => b.totalPaid - a.totalPaid),
      byProvider: Object.entries(providerMap).map(([provider, v]) => ({ provider, ...v })).sort((a, b) => b.totalPaid - a.totalPaid),
    };
  }
}

export const storage = new DatabaseStorage();
