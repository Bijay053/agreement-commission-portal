import { db } from "./db";
import { eq, and, desc, asc, gte, lte, ilike, sql, or } from "drizzle-orm";
import {
  users, roles, permissions, rolePermissions, userRoles, userCountryAccess,
  countries, universities, agreements, agreementTargets, agreementCommissionRules,
  agreementContacts, agreementDocuments, auditLogs,
  type User, type InsertUser, type Agreement, type InsertAgreement,
  type AgreementTarget, type InsertTarget, type AgreementCommissionRule,
  type InsertCommissionRule, type AgreementContact, type InsertContact,
  type AgreementDocument, type InsertDocument, type University, type InsertUniversity,
  type Country, type Role, type Permission, type AuditLog,
} from "@shared/schema";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUsers(): Promise<User[]>;

  getRoles(): Promise<Role[]>;
  getPermissions(): Promise<Permission[]>;
  getUserRoles(userId: number): Promise<Role[]>;
  getUserPermissions(userId: number): Promise<string[]>;
  assignRole(userId: number, roleId: number): Promise<void>;
  removeRole(userId: number, roleId: number): Promise<void>;

  getCountries(): Promise<Country[]>;
  getUniversities(): Promise<University[]>;
  createUniversity(uni: InsertUniversity): Promise<University>;

  getAgreements(filters?: { status?: string; countryId?: number; search?: string }): Promise<any[]>;
  getAgreement(id: number): Promise<any>;
  createAgreement(agreement: InsertAgreement): Promise<Agreement>;
  updateAgreement(id: number, data: Partial<InsertAgreement>): Promise<Agreement>;
  deleteAgreement(id: number): Promise<void>;

  getTargets(agreementId: number): Promise<AgreementTarget[]>;
  createTarget(target: InsertTarget): Promise<AgreementTarget>;
  updateTarget(id: number, data: Partial<InsertTarget>): Promise<AgreementTarget>;
  deleteTarget(id: number): Promise<void>;

  getCommissionRules(agreementId: number): Promise<AgreementCommissionRule[]>;
  createCommissionRule(rule: InsertCommissionRule): Promise<AgreementCommissionRule>;
  updateCommissionRule(id: number, data: Partial<InsertCommissionRule>): Promise<AgreementCommissionRule>;
  deleteCommissionRule(id: number): Promise<void>;

  getContacts(agreementId: number): Promise<AgreementContact[]>;
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

  async getCountries(): Promise<Country[]> {
    return db.select().from(countries).orderBy(asc(countries.name));
  }

  async getUniversities(): Promise<University[]> {
    return db.select().from(universities).orderBy(asc(universities.name));
  }

  async createUniversity(uni: InsertUniversity): Promise<University> {
    const [created] = await db.insert(universities).values(uni).returning();
    return created;
  }

  async getAgreements(filters?: { status?: string; countryId?: number; search?: string }): Promise<any[]> {
    let query = db
      .select({
        id: agreements.id,
        agreementCode: agreements.agreementCode,
        title: agreements.title,
        agreementType: agreements.agreementType,
        status: agreements.status,
        startDate: agreements.startDate,
        expiryDate: agreements.expiryDate,
        autoRenew: agreements.autoRenew,
        confidentialityLevel: agreements.confidentialityLevel,
        createdAt: agreements.createdAt,
        universityName: universities.name,
        universityId: agreements.universityId,
        territoryCountryId: agreements.territoryCountryId,
        territoryCountry: countries.name,
      })
      .from(agreements)
      .innerJoin(universities, eq(agreements.universityId, universities.id))
      .innerJoin(countries, eq(agreements.territoryCountryId, countries.id));

    const conditions: any[] = [];
    if (filters?.status) conditions.push(eq(agreements.status, filters.status));
    if (filters?.countryId) conditions.push(eq(agreements.territoryCountryId, filters.countryId));
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
        territoryCountryId: agreements.territoryCountryId,
        startDate: agreements.startDate,
        expiryDate: agreements.expiryDate,
        autoRenew: agreements.autoRenew,
        confidentialityLevel: agreements.confidentialityLevel,
        internalNotes: agreements.internalNotes,
        createdByUserId: agreements.createdByUserId,
        updatedByUserId: agreements.updatedByUserId,
        createdAt: agreements.createdAt,
        updatedAt: agreements.updatedAt,
        universityName: universities.name,
        territoryCountry: countries.name,
      })
      .from(agreements)
      .innerJoin(universities, eq(agreements.universityId, universities.id))
      .innerJoin(countries, eq(agreements.territoryCountryId, countries.id))
      .where(eq(agreements.id, id));
    return result;
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
        territoryCountry: countries.name,
      })
      .from(agreements)
      .innerJoin(universities, eq(agreements.universityId, universities.id))
      .innerJoin(countries, eq(agreements.territoryCountryId, countries.id))
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
        territoryCountry: countries.name,
      })
      .from(agreements)
      .innerJoin(universities, eq(agreements.universityId, universities.id))
      .innerJoin(countries, eq(agreements.territoryCountryId, countries.id))
      .orderBy(desc(agreements.updatedAt))
      .limit(limit);
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
}

export const storage = new DatabaseStorage();
