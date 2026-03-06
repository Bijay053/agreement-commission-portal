import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  date,
  timestamp,
  numeric,
  jsonb,
  serial,
  bigserial,
  smallserial,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const countries = pgTable("countries", {
  id: serial("id").primaryKey(),
  iso2: varchar("iso2", { length: 2 }).notNull().unique(),
  name: varchar("name", { length: 128 }).notNull(),
});

export const universities = pgTable("universities", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  countryId: integer("country_id").references(() => countries.id),
  website: varchar("website", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 64 }).notNull().unique(),
  description: text("description"),
});

export const permissions = pgTable("permissions", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 64 }).notNull().unique(),
  description: text("description"),
});

export const rolePermissions = pgTable("role_permissions", {
  id: serial("id").primaryKey(),
  roleId: integer("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  permissionId: integer("permission_id").notNull().references(() => permissions.id, { onDelete: "cascade" }),
});

export const userRoles = pgTable("user_roles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  roleId: integer("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
});

export const userCountryAccess = pgTable("user_country_access", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  countryId: integer("country_id").notNull().references(() => countries.id, { onDelete: "cascade" }),
});

export const agreements = pgTable("agreements", {
  id: serial("id").primaryKey(),
  universityId: integer("university_id").notNull().references(() => universities.id),
  agreementCode: varchar("agreement_code", { length: 64 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  agreementType: varchar("agreement_type", { length: 32 }).notNull(),
  status: varchar("status", { length: 24 }).notNull().default("draft"),
  territoryCountryId: integer("territory_country_id").notNull().references(() => countries.id),
  startDate: date("start_date").notNull(),
  expiryDate: date("expiry_date").notNull(),
  autoRenew: boolean("auto_renew").default(false),
  confidentialityLevel: varchar("confidentiality_level", { length: 16 }).notNull().default("high"),
  internalNotes: text("internal_notes"),
  createdByUserId: integer("created_by_user_id").references(() => users.id),
  updatedByUserId: integer("updated_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const agreementTargets = pgTable("agreement_targets", {
  id: serial("id").primaryKey(),
  agreementId: integer("agreement_id").notNull().references(() => agreements.id, { onDelete: "cascade" }),
  targetType: varchar("target_type", { length: 16 }).notNull(),
  metric: varchar("metric", { length: 24 }).notNull(),
  value: numeric("value", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }),
  periodKey: varchar("period_key", { length: 32 }).notNull(),
  notes: text("notes"),
  createdByUserId: integer("created_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const agreementCommissionRules = pgTable("agreement_commission_rules", {
  id: serial("id").primaryKey(),
  agreementId: integer("agreement_id").notNull().references(() => agreements.id, { onDelete: "cascade" }),
  label: varchar("label", { length: 255 }).notNull(),
  studyLevel: varchar("study_level", { length: 32 }),
  commissionMode: varchar("commission_mode", { length: 16 }).notNull(),
  percentageValue: numeric("percentage_value", { precision: 6, scale: 3 }),
  flatAmount: numeric("flat_amount", { precision: 12, scale: 2 }),
  currency: varchar("currency", { length: 3 }),
  basis: varchar("basis", { length: 24 }).notNull(),
  payEvent: varchar("pay_event", { length: 24 }).notNull().default("enrolment"),
  subjectRules: jsonb("subject_rules"),
  conditionsText: text("conditions_text"),
  effectiveFrom: date("effective_from"),
  effectiveTo: date("effective_to"),
  priority: integer("priority").notNull().default(100),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const agreementContacts = pgTable("agreement_contacts", {
  id: serial("id").primaryKey(),
  agreementId: integer("agreement_id").notNull().references(() => agreements.id, { onDelete: "cascade" }),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  positionTitle: varchar("position_title", { length: 255 }),
  phone: varchar("phone", { length: 64 }),
  email: varchar("email", { length: 255 }),
  countryId: integer("country_id").references(() => countries.id),
  isPrimary: boolean("is_primary").default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const agreementDocuments = pgTable("agreement_documents", {
  id: serial("id").primaryKey(),
  agreementId: integer("agreement_id").notNull().references(() => agreements.id, { onDelete: "cascade" }),
  versionNo: integer("version_no").notNull(),
  originalFilename: varchar("original_filename", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 64 }).notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  storagePath: text("storage_path").notNull(),
  status: varchar("status", { length: 16 }).notNull().default("active"),
  uploadedByUserId: integer("uploaded_by_user_id").references(() => users.id),
  uploadNote: text("upload_note"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  action: varchar("action", { length: 64 }).notNull(),
  entityType: varchar("entity_type", { length: 32 }).notNull(),
  entityId: integer("entity_id"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAgreementSchema = createInsertSchema(agreements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTargetSchema = createInsertSchema(agreementTargets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCommissionRuleSchema = createInsertSchema(agreementCommissionRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContactSchema = createInsertSchema(agreementContacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDocumentSchema = createInsertSchema(agreementDocuments).omit({
  id: true,
  createdAt: true,
});

export const insertUniversitySchema = createInsertSchema(universities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export type Country = typeof countries.$inferSelect;
export type University = typeof universities.$inferSelect;
export type User = typeof users.$inferSelect;
export type Role = typeof roles.$inferSelect;
export type Permission = typeof permissions.$inferSelect;
export type Agreement = typeof agreements.$inferSelect;
export type AgreementTarget = typeof agreementTargets.$inferSelect;
export type AgreementCommissionRule = typeof agreementCommissionRules.$inferSelect;
export type AgreementContact = typeof agreementContacts.$inferSelect;
export type AgreementDocument = typeof agreementDocuments.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertAgreement = z.infer<typeof insertAgreementSchema>;
export type InsertTarget = z.infer<typeof insertTargetSchema>;
export type InsertCommissionRule = z.infer<typeof insertCommissionRuleSchema>;
export type InsertContact = z.infer<typeof insertContactSchema>;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type InsertUniversity = z.infer<typeof insertUniversitySchema>;

export const AGREEMENT_TYPES = ["agency", "commission_schedule", "addendum", "renewal", "mou", "other"] as const;
export const AGREEMENT_STATUSES = ["draft", "active", "expired", "terminated", "renewal_in_progress"] as const;
export const TARGET_TYPES = ["monthly", "intake", "yearly"] as const;
export const TARGET_METRICS = ["applications", "enrolments", "starts", "revenue"] as const;
export const COMMISSION_MODES = ["percentage", "flat"] as const;
export const COMMISSION_BASIS = ["per_subject", "per_term", "first_year", "full_course", "per_intake"] as const;
export const PAY_EVENTS = ["enrolment", "census", "completion"] as const;
export const STUDY_LEVELS = ["UG", "PG", "Diploma", "ELICOS", "Package", "Any"] as const;
export const CONFIDENTIALITY_LEVELS = ["low", "medium", "high"] as const;
