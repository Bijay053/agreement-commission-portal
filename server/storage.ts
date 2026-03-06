import { db } from "./db";
import { eq, and, desc, asc, gte, lte, ilike, sql, or, inArray, aliasedTable } from "drizzle-orm";
import {
  users, roles, permissions, rolePermissions, userRoles, userCountryAccess,
  countries, universities, agreements, agreementTerritories, agreementTargets,
  agreementCommissionRules, agreementContacts, agreementDocuments, auditLogs,
  targetBonusRules, targetBonusTiers, targetBonusCountry, passwordResetTokens,
  type User, type InsertUser, type Agreement, type InsertAgreement,
  type AgreementTarget, type InsertTarget, type AgreementCommissionRule,
  type InsertCommissionRule, type AgreementContact, type InsertContact,
  type AgreementDocument, type InsertDocument, type University, type InsertUniversity,
  type Country, type Role, type Permission, type AuditLog,
  type TargetBonusRule, type TargetBonusTier, type TargetBonusCountryEntry,
  type PasswordResetToken,
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
  createBonusRule(rule: any): Promise<TargetBonusRule>;
  deleteBonusRule(id: number): Promise<void>;
  createBonusTier(tier: any): Promise<TargetBonusTier>;
  createBonusCountryEntry(entry: any): Promise<TargetBonusCountryEntry>;

  getCommissionRules(agreementId: number): Promise<AgreementCommissionRule[]>;
  createCommissionRule(rule: InsertCommissionRule): Promise<AgreementCommissionRule>;
  updateCommissionRule(id: number, data: Partial<InsertCommissionRule>): Promise<AgreementCommissionRule>;
  deleteCommissionRule(id: number): Promise<void>;

  getContacts(agreementId: number): Promise<AgreementContact[]>;
  getAllContacts(filters?: { q?: string; providerId?: number; providerCountryId?: number; contactCountryId?: number; agreementStatus?: string }): Promise<any[]>;
  createContact(contact: InsertContact): Promise<AgreementContact>;
  updateContact(id: number, data: Partial<InsertContact>): Promise<AgreementContact>;
  deleteContact(id: number): Promise<void>;

  getDocuments(agreementId: number): Promise<AgreementDocument[]>;
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
  invalidateUserSessions(userId: number): Promise<void>;
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
    return [...new Set(result.map(r => r.code))];
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

  async updateUserPassword(userId: number, passwordHash: string): Promise<void> {
    await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId));
  }

  async invalidateUserSessions(userId: number): Promise<void> {
    await db.execute(
      sql`DELETE FROM "session" WHERE sess->>'userId' = ${String(userId)}`
    );
  }
}

export const storage = new DatabaseStorage();
