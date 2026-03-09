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
  providerType: varchar("provider_type", { length: 32 }).notNull().default("university"),
  countryId: integer("country_id").references(() => countries.id),
  website: varchar("website", { length: 255 }),
  notes: text("notes"),
  status: varchar("status", { length: 16 }).notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  passwordChangedAt: timestamp("password_changed_at"),
  lastLoginAt: timestamp("last_login_at"),
  lastLoginIp: varchar("last_login_ip", { length: 45 }),
  forcePasswordChange: boolean("force_password_change").notNull().default(false),
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
  module: varchar("module", { length: 64 }),
  resource: varchar("resource", { length: 64 }),
  action: varchar("action", { length: 64 }),
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
  territoryType: varchar("territory_type", { length: 16 }).notNull().default("country_specific"),
  territoryCountryId: integer("territory_country_id").references(() => countries.id),
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

export const agreementTerritories = pgTable("agreement_territories", {
  id: serial("id").primaryKey(),
  agreementId: integer("agreement_id").notNull().references(() => agreements.id, { onDelete: "cascade" }),
  countryId: integer("country_id").notNull().references(() => countries.id),
});

export const agreementTargets = pgTable("agreement_targets", {
  id: serial("id").primaryKey(),
  agreementId: integer("agreement_id").notNull().references(() => agreements.id, { onDelete: "cascade" }),
  targetType: varchar("target_type", { length: 16 }).notNull(),
  metric: varchar("metric", { length: 32 }).notNull(),
  value: numeric("value", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }),
  periodKey: varchar("period_key", { length: 32 }).notNull(),
  notes: text("notes"),
  bonusEnabled: boolean("bonus_enabled").default(false),
  bonusAmount: numeric("bonus_amount", { precision: 12, scale: 2 }),
  bonusCurrency: varchar("bonus_currency", { length: 3 }),
  bonusCondition: text("bonus_condition"),
  bonusNotes: text("bonus_notes"),
  createdByUserId: integer("created_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const targetBonusRules = pgTable("target_bonus_rules", {
  id: serial("id").primaryKey(),
  targetId: integer("target_id").notNull().references(() => agreementTargets.id, { onDelete: "cascade" }),
  bonusType: varchar("bonus_type", { length: 32 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("AUD"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const targetBonusTiers = pgTable("target_bonus_tiers", {
  id: serial("id").primaryKey(),
  bonusRuleId: integer("bonus_rule_id").notNull().references(() => targetBonusRules.id, { onDelete: "cascade" }),
  minStudents: integer("min_students").notNull(),
  maxStudents: integer("max_students"),
  bonusAmount: numeric("bonus_amount", { precision: 12, scale: 2 }).notNull(),
  calculationType: varchar("calculation_type", { length: 16 }).notNull().default("per_student"),
});

export const targetBonusCountry = pgTable("target_bonus_country", {
  id: serial("id").primaryKey(),
  bonusRuleId: integer("bonus_rule_id").notNull().references(() => targetBonusRules.id, { onDelete: "cascade" }),
  countryId: integer("country_id").notNull().references(() => countries.id),
  studentCount: integer("student_count").notNull(),
  bonusAmount: numeric("bonus_amount", { precision: 12, scale: 2 }).notNull(),
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
  city: varchar("city", { length: 255 }),
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

export const commissionTerms = pgTable("commission_terms", {
  id: serial("id").primaryKey(),
  termName: varchar("term_name", { length: 16 }).notNull().unique(),
  termLabel: varchar("term_label", { length: 32 }).notNull(),
  year: integer("year").notNull(),
  termNumber: integer("term_number").notNull(),
  sortOrder: integer("sort_order").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const commissionStudents = pgTable("commission_students", {
  id: serial("id").primaryKey(),
  agentName: varchar("agent_name", { length: 255 }).notNull(),
  studentId: varchar("student_id", { length: 64 }),
  agentsicId: varchar("agentsic_id", { length: 64 }),
  studentName: varchar("student_name", { length: 255 }).notNull(),
  provider: varchar("provider", { length: 255 }).notNull(),
  country: varchar("country", { length: 64 }).notNull().default("AU"),
  startIntake: varchar("start_intake", { length: 32 }),
  courseLevel: varchar("course_level", { length: 64 }),
  courseName: varchar("course_name", { length: 500 }),
  courseDurationYears: numeric("course_duration_years", { precision: 4, scale: 1 }),
  commissionRatePct: numeric("commission_rate_pct", { precision: 8, scale: 4 }),
  gstRatePct: numeric("gst_rate_pct", { precision: 5, scale: 2 }).default("10"),
  gstApplicable: varchar("gst_applicable", { length: 3 }).notNull().default("Yes"),
  scholarshipType: varchar("scholarship_type", { length: 16 }).default("None"),
  scholarshipValue: numeric("scholarship_value", { precision: 12, scale: 2 }).default("0"),
  status: varchar("status", { length: 32 }).default("Under Enquiry"),
  notes: text("notes"),
  totalReceived: numeric("total_received", { precision: 14, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const commissionEntries = pgTable("commission_entries", {
  id: serial("id").primaryKey(),
  commissionStudentId: integer("commission_student_id").notNull().references(() => commissionStudents.id, { onDelete: "cascade" }),
  studentProviderId: integer("student_provider_id").references(() => studentProviders.id, { onDelete: "cascade" }),
  termName: varchar("term_name", { length: 16 }).notNull(),
  academicYear: varchar("academic_year", { length: 16 }),
  feeGross: numeric("fee_gross", { precision: 12, scale: 2 }).default("0"),
  commissionRateAuto: numeric("commission_rate_auto", { precision: 8, scale: 4 }),
  commissionRateOverridePct: numeric("commission_rate_override_pct", { precision: 8, scale: 4 }),
  commissionRateUsedPct: numeric("commission_rate_used_pct", { precision: 8, scale: 4 }),
  commissionAmount: numeric("commission_amount", { precision: 12, scale: 2 }).default("0"),
  bonus: numeric("bonus", { precision: 12, scale: 2 }).default("0"),
  gstAmount: numeric("gst_amount", { precision: 12, scale: 2 }).default("0"),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).default("0"),
  paymentStatus: varchar("payment_status", { length: 16 }).default("Pending"),
  paidDate: date("paid_date"),
  invoiceNo: varchar("invoice_no", { length: 64 }),
  paymentRef: varchar("payment_ref", { length: 128 }),
  notes: text("notes"),
  studentStatus: varchar("student_status", { length: 32 }).default("Under Enquiry"),
  rateChangeWarning: varchar("rate_change_warning", { length: 128 }),
  scholarshipTypeAuto: varchar("scholarship_type_auto", { length: 16 }),
  scholarshipValueAuto: numeric("scholarship_value_auto", { precision: 12, scale: 2 }),
  scholarshipTypeOverride: varchar("scholarship_type_override", { length: 16 }),
  scholarshipValueOverride: numeric("scholarship_value_override", { precision: 12, scale: 2 }),
  scholarshipTypeUsed: varchar("scholarship_type_used", { length: 16 }),
  scholarshipValueUsed: numeric("scholarship_value_used", { precision: 12, scale: 2 }),
  scholarshipChangeWarning: varchar("scholarship_change_warning", { length: 128 }),
  scholarshipAmount: numeric("scholarship_amount", { precision: 12, scale: 2 }).default("0"),
  feeAfterScholarship: numeric("fee_after_scholarship", { precision: 12, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const studentProviders = pgTable("student_providers", {
  id: serial("id").primaryKey(),
  commissionStudentId: integer("commission_student_id").notNull().references(() => commissionStudents.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 255 }).notNull(),
  studentId: varchar("student_id", { length: 64 }),
  country: varchar("country", { length: 64 }).default("Australia"),
  courseLevel: varchar("course_level", { length: 64 }),
  courseName: varchar("course_name", { length: 500 }),
  courseDurationYears: numeric("course_duration_years", { precision: 4, scale: 1 }),
  startIntake: varchar("start_intake", { length: 32 }),
  commissionRatePct: numeric("commission_rate_pct", { precision: 8, scale: 4 }),
  gstRatePct: numeric("gst_rate_pct", { precision: 5, scale: 2 }).default("10"),
  gstApplicable: varchar("gst_applicable", { length: 3 }).default("Yes"),
  scholarshipType: varchar("scholarship_type", { length: 16 }).default("None"),
  scholarshipValue: numeric("scholarship_value", { precision: 12, scale: 2 }).default("0"),
  status: varchar("status", { length: 32 }).default("Under Enquiry"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const subAgentEntries = pgTable("sub_agent_entries", {
  id: serial("id").primaryKey(),
  commissionStudentId: integer("commission_student_id").notNull().references(() => commissionStudents.id, { onDelete: "cascade" }),
  subAgentCommissionRatePct: numeric("sub_agent_commission_rate_pct", { precision: 8, scale: 4 }).default("0"),
  gstApplicable: varchar("gst_applicable", { length: 3 }).notNull().default("No"),
  sicReceivedTotal: numeric("sic_received_total", { precision: 14, scale: 2 }).default("0"),
  subAgentPaidTotal: numeric("sub_agent_paid_total", { precision: 14, scale: 2 }).default("0"),
  margin: numeric("margin", { precision: 14, scale: 2 }).default("0"),
  overpayWarning: varchar("overpay_warning", { length: 128 }),
  status: varchar("status", { length: 32 }).default("Under Enquiry"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const subAgentTermEntries = pgTable("sub_agent_term_entries", {
  id: serial("id").primaryKey(),
  commissionStudentId: integer("commission_student_id").notNull().references(() => commissionStudents.id, { onDelete: "cascade" }),
  termName: varchar("term_name", { length: 16 }).notNull(),
  academicYear: varchar("academic_year", { length: 16 }).default("Year 1"),
  feeNet: numeric("fee_net", { precision: 12, scale: 2 }).default("0"),
  mainCommission: numeric("main_commission", { precision: 12, scale: 2 }).default("0"),
  commissionRateAuto: numeric("commission_rate_auto", { precision: 8, scale: 4 }).default("0"),
  commissionRateOverridePct: numeric("commission_rate_override_pct", { precision: 8, scale: 4 }),
  commissionRateUsedPct: numeric("commission_rate_used_pct", { precision: 8, scale: 4 }).default("0"),
  subAgentCommission: numeric("sub_agent_commission", { precision: 12, scale: 2 }).default("0"),
  bonusPaid: numeric("bonus_paid", { precision: 12, scale: 2 }).default("0"),
  gstPct: numeric("gst_pct", { precision: 5, scale: 2 }).default("0"),
  gstAmount: numeric("gst_amount", { precision: 12, scale: 2 }).default("0"),
  totalPaid: numeric("total_paid", { precision: 12, scale: 2 }).default("0"),
  paymentStatus: varchar("payment_status", { length: 32 }).default("Invoice Waiting"),
  studentStatus: varchar("student_status", { length: 32 }).default("Under Enquiry"),
  rateOverrideWarning: varchar("rate_override_warning", { length: 128 }),
  exceedsMainWarning: varchar("exceeds_main_warning", { length: 128 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 64 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  requestIp: varchar("request_ip", { length: 45 }),
  userAgent: text("user_agent"),
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

export const userSessions = pgTable("user_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sessionToken: varchar("session_token", { length: 128 }),
  ipAddress: varchar("ip_address", { length: 45 }),
  browser: varchar("browser", { length: 128 }),
  os: varchar("os", { length: 64 }),
  deviceType: varchar("device_type", { length: 32 }),
  location: varchar("location", { length: 255 }),
  loginAt: timestamp("login_at").defaultNow(),
  lastActivityAt: timestamp("last_activity_at").defaultNow(),
  logoutAt: timestamp("logout_at"),
  logoutReason: varchar("logout_reason", { length: 32 }),
  isActive: boolean("is_active").notNull().default(true),
  otpVerified: boolean("otp_verified").notNull().default(false),
});

export const loginVerificationCodes = pgTable("login_verification_codes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  codeHash: varchar("code_hash", { length: 128 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  attempts: integer("attempts").notNull().default(0),
  resendCount: integer("resend_count").notNull().default(0),
  status: varchar("status", { length: 16 }).notNull().default("pending"),
});

export const securityAuditLogs = pgTable("security_audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  eventType: varchar("event_type", { length: 64 }).notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  deviceInfo: text("device_info"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const passwordHistory = pgTable("password_history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const agreementNotifications = pgTable("agreement_notifications", {
  id: serial("id").primaryKey(),
  agreementId: integer("agreement_id").notNull().references(() => agreements.id, { onDelete: "cascade" }),
  providerName: varchar("provider_name", { length: 255 }).notNull(),
  notificationType: varchar("notification_type", { length: 64 }).notNull(),
  sentDate: timestamp("sent_date").defaultNow(),
  daysBeforeExpiry: integer("days_before_expiry"),
  status: varchar("status", { length: 32 }).notNull().default("sent"),
  recipientEmails: text("recipient_emails"),
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

export const insertBonusRuleSchema = createInsertSchema(targetBonusRules).omit({
  id: true,
  createdAt: true,
});

export const insertBonusTierSchema = createInsertSchema(targetBonusTiers).omit({
  id: true,
});

export const insertBonusCountrySchema = createInsertSchema(targetBonusCountry).omit({
  id: true,
});

export const insertCommissionStudentSchema = createInsertSchema(commissionStudents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCommissionEntrySchema = createInsertSchema(commissionEntries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStudentProviderSchema = createInsertSchema(studentProviders).omit({
  id: true,
  createdAt: true,
});

export const insertAgreementNotificationSchema = createInsertSchema(agreementNotifications).omit({
  id: true,
  sentDate: true,
});

export const insertSubAgentEntrySchema = createInsertSchema(subAgentEntries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSubAgentTermEntrySchema = createInsertSchema(subAgentTermEntries).omit({
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
export type Provider = University;
export type User = typeof users.$inferSelect;
export type Role = typeof roles.$inferSelect;
export type Permission = typeof permissions.$inferSelect;
export type Agreement = typeof agreements.$inferSelect;
export type AgreementTarget = typeof agreementTargets.$inferSelect;
export type AgreementCommissionRule = typeof agreementCommissionRules.$inferSelect;
export type AgreementContact = typeof agreementContacts.$inferSelect;
export type AgreementDocument = typeof agreementDocuments.$inferSelect;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type TargetBonusRule = typeof targetBonusRules.$inferSelect;
export type TargetBonusTier = typeof targetBonusTiers.$inferSelect;
export type TargetBonusCountryEntry = typeof targetBonusCountry.$inferSelect;
export type CommissionTerm = typeof commissionTerms.$inferSelect;
export type CommissionStudent = typeof commissionStudents.$inferSelect;
export type CommissionEntry = typeof commissionEntries.$inferSelect;
export type StudentProvider = typeof studentProviders.$inferSelect;
export type SubAgentEntry = typeof subAgentEntries.$inferSelect;
export type SubAgentTermEntry = typeof subAgentTermEntries.$inferSelect;
export type UserSession = typeof userSessions.$inferSelect;
export type LoginVerificationCode = typeof loginVerificationCodes.$inferSelect;
export type SecurityAuditLog = typeof securityAuditLogs.$inferSelect;
export type PasswordHistoryEntry = typeof passwordHistory.$inferSelect;
export type InsertCommissionStudent = z.infer<typeof insertCommissionStudentSchema>;
export type InsertCommissionEntry = z.infer<typeof insertCommissionEntrySchema>;
export type InsertStudentProvider = z.infer<typeof insertStudentProviderSchema>;
export type InsertAgreementNotification = z.infer<typeof insertAgreementNotificationSchema>;
export type AgreementNotification = typeof agreementNotifications.$inferSelect;
export type InsertSubAgentEntry = z.infer<typeof insertSubAgentEntrySchema>;
export type InsertSubAgentTermEntry = z.infer<typeof insertSubAgentTermEntrySchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertAgreement = z.infer<typeof insertAgreementSchema>;
export type InsertTarget = z.infer<typeof insertTargetSchema>;
export type InsertCommissionRule = z.infer<typeof insertCommissionRuleSchema>;
export type InsertContact = z.infer<typeof insertContactSchema>;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type InsertUniversity = z.infer<typeof insertUniversitySchema>;
export type InsertProvider = InsertUniversity;

export const AGREEMENT_TYPES = ["agency", "commission_schedule", "addendum", "renewal", "mou", "other"] as const;
export const AGREEMENT_STATUSES = ["draft", "active", "expired", "terminated", "renewal_in_progress"] as const;
export const TERRITORY_TYPES = ["global", "country_specific"] as const;
export const TARGET_TYPES = ["monthly", "intake", "yearly"] as const;
export const TARGET_METRICS = ["applications", "enrolments", "new_student_enrolments", "starts", "revenue"] as const;
export const COMMISSION_MODES = ["percentage", "flat"] as const;
export const COMMISSION_BASIS = ["per_subject", "per_term", "first_year", "full_course", "per_intake"] as const;
export const PAY_EVENTS = ["enrolment", "census", "completion"] as const;
export const STUDY_LEVELS = ["UG", "PG", "Diploma", "ELICOS", "Package", "Any"] as const;
export const PROVIDER_TYPES = ["university", "college", "b2b_company", "other"] as const;
export const PROVIDER_STATUSES = ["active", "inactive"] as const;
export const BONUS_TYPES = ["tier_per_student", "flat_on_target", "country_bonus", "tiered_flat"] as const;
export const BONUS_CALCULATION_TYPES = ["per_student", "flat"] as const;

export const PERMISSION_ACTIONS = ["read", "add", "update", "delete", "export"] as const;

export const PERMISSION_REGISTRY = [
  {
    module: "agreements",
    label: "Agreements",
    resources: [
      { resource: "agreement", label: "Agreements", actions: ["read", "add", "update", "delete", "export"] },
      { resource: "notes", label: "Sensitive Notes", actions: ["read", "update"] },
    ],
  },
  {
    module: "providers",
    label: "Providers",
    resources: [
      { resource: "provider", label: "Providers", actions: ["read", "add", "update", "delete", "export"] },
    ],
  },
  {
    module: "targets",
    label: "Targets",
    resources: [
      { resource: "target", label: "Agreement Targets", actions: ["read", "add", "update", "delete", "export"] },
    ],
  },
  {
    module: "commission",
    label: "Commission Rules",
    resources: [
      { resource: "commission_rule", label: "Commission Rules", actions: ["read", "add", "update", "delete", "export"] },
    ],
  },
  {
    module: "bonus",
    label: "Bonus Rules",
    resources: [
      { resource: "bonus_rule", label: "Bonus Rules", actions: ["read", "add", "update", "delete", "export"] },
    ],
  },
  {
    module: "contacts",
    label: "Contacts",
    resources: [
      { resource: "contact", label: "Agreement Contacts", actions: ["read", "add", "update", "delete", "export"] },
    ],
  },
  {
    module: "commission_tracker",
    label: "Commission Tracker",
    resources: [
      { resource: "student", label: "Commission Students", actions: ["read", "add", "update", "delete", "export", "delete_master"] },
      { resource: "entry", label: "Term Entries", actions: ["read", "add", "update", "delete"] },
      { resource: "master", label: "Master Sheet", actions: ["edit"] },
    ],
  },
  {
    module: "sub_agent_commission",
    label: "Sub-Agent Commission",
    resources: [
      { resource: "entry", label: "Sub-Agent Entries", actions: ["read", "add", "update", "delete"] },
    ],
  },
  {
    module: "documents",
    label: "Documents",
    resources: [
      { resource: "document", label: "Agreement Documents", actions: ["list", "view_in_portal", "download", "upload", "replace", "delete"] },
    ],
  },
  {
    module: "administration",
    label: "Administration",
    resources: [
      { resource: "user", label: "Users", actions: ["read", "add", "update", "delete"] },
      { resource: "role", label: "Roles", actions: ["read", "add", "update", "delete"] },
      { resource: "country_scope", label: "Country Access", actions: ["read", "update"] },
      { resource: "audit", label: "Audit Logs", actions: ["read"] },
    ],
  },
  {
    module: "reminders",
    label: "Reminder Settings",
    resources: [
      { resource: "reminder", label: "Reminders", actions: ["read", "update"] },
    ],
  },
] as const;

export type PermissionModule = typeof PERMISSION_REGISTRY[number];
export type PermissionResource = PermissionModule["resources"][number];

export const LEGACY_PERMISSION_MAP: Record<string, string> = {
  "agreement.view": "agreements.agreement.read",
  "agreement.create": "agreements.agreement.add",
  "agreement.edit": "agreements.agreement.update",
  "agreement.delete": "agreements.agreement.delete",
  "agreement.notes.view_sensitive": "agreements.notes.read",
  "agreement.notes.edit_sensitive": "agreements.notes.update",
  "targets.view": "targets.target.read",
  "targets.create": "targets.target.add",
  "targets.edit": "targets.target.update",
  "targets.delete": "targets.target.delete",
  "targets.export": "targets.target.export",
  "commission.view": "commission.commission_rule.read",
  "commission.create": "commission.commission_rule.add",
  "commission.edit": "commission.commission_rule.update",
  "commission.delete": "commission.commission_rule.delete",
  "commission.export": "commission.commission_rule.export",
  "bonus.view": "bonus.bonus_rule.read",
  "bonus.create": "bonus.bonus_rule.add",
  "bonus.edit": "bonus.bonus_rule.update",
  "bonus.delete": "bonus.bonus_rule.delete",
  "bonus.export": "bonus.bonus_rule.export",
  "commission_tracker.view": "commission_tracker.student.read",
  "commission_tracker.create": "commission_tracker.student.add",
  "commission_tracker.edit": "commission_tracker.student.update",
  "commission_tracker.delete": "commission_tracker.student.delete",
  "commission_tracker.export": "commission_tracker.student.export",
  "commission_tracker.entry.view": "commission_tracker.entry.read",
  "commission_tracker.entry.create": "commission_tracker.entry.add",
  "commission_tracker.entry.edit": "commission_tracker.entry.update",
  "commission_tracker.entry.delete": "commission_tracker.entry.delete",
  "commission_tracker.student.delete_master": "commission_tracker.student.delete_master",
  "commission_tracker.master.edit": "commission_tracker.master.edit",
  "contacts.view": "contacts.contact.read",
  "contacts.create": "contacts.contact.add",
  "contacts.edit": "contacts.contact.update",
  "contacts.delete": "contacts.contact.delete",
  "contacts.export": "contacts.contact.export",
  "sub_agent_commission.view": "sub_agent_commission.entry.read",
  "sub_agent_commission.create": "sub_agent_commission.entry.add",
  "sub_agent_commission.edit": "sub_agent_commission.entry.update",
  "sub_agent_commission.delete": "sub_agent_commission.entry.delete",
  "document.list": "documents.document.list",
  "document.view_in_portal": "documents.document.view_in_portal",
  "document.download": "documents.document.download",
  "document.upload": "documents.document.upload",
  "document.replace": "documents.document.replace",
  "document.delete": "documents.document.delete",
  "audit.view": "administration.audit.read",
  "security.user.manage": "administration.user.update",
  "security.role.manage": "administration.role.update",
  "security.country_scope.manage": "administration.country_scope.update",
  "reminders.view": "reminders.reminder.read",
  "reminders.manage": "reminders.reminder.update",
};
