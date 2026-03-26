export interface Country {
  id: number;
  iso2: string;
  name: string;
}

export interface University {
  id: number;
  name: string;
  providerType: string;
  countryId: number | null;
  website: string | null;
  notes: string | null;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export type Provider = University;

export interface User {
  id: number;
  email: string;
  fullName: string;
  passwordHash: string;
  isActive: boolean;
  passwordChangedAt: string | null;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
  forcePasswordChange: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface Role {
  id: number;
  name: string;
  description: string | null;
}

export interface Permission {
  id: number;
  code: string;
  module: string | null;
  resource: string | null;
  action: string | null;
  description: string | null;
}

export interface Agreement {
  id: number;
  universityId: number;
  agreementCode: string;
  title: string;
  agreementType: string;
  status: string;
  territoryType: string;
  territoryCountryId: number | null;
  startDate: string;
  expiryDate: string;
  autoRenew: boolean | null;
  confidentialityLevel: string;
  internalNotes: string | null;
  createdByUserId: number | null;
  updatedByUserId: number | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AgreementTarget {
  id: number;
  agreementId: number;
  targetType: string;
  metric: string;
  value: string;
  currency: string | null;
  periodKey: string;
  notes: string | null;
  bonusEnabled: boolean | null;
  bonusAmount: string | null;
  bonusCurrency: string | null;
  bonusCondition: string | null;
  bonusNotes: string | null;
  createdByUserId: number | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AgreementCommissionRule {
  id: number;
  agreementId: number;
  label: string;
  studyLevel: string | null;
  commissionMode: string;
  percentageValue: string | null;
  flatAmount: string | null;
  currency: string | null;
  basis: string;
  payEvent: string;
  subjectRules: unknown;
  conditionsText: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  priority: number;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AgreementContact {
  id: number;
  agreementId: number;
  fullName: string;
  positionTitle: string | null;
  phone: string | null;
  email: string | null;
  countryId: number | null;
  city: string | null;
  isPrimary: boolean | null;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AgreementDocument {
  id: number;
  agreementId: number;
  versionNo: number;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  status: string;
  uploadedByUserId: number | null;
  uploadNote: string | null;
  createdAt: string | null;
}

export interface CommissionTerm {
  id: number;
  termName: string;
  termLabel: string;
  year: number;
  termNumber: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: string | null;
}

export interface CommissionStudent {
  id: number;
  agentName: string;
  studentId: string | null;
  agentsicId: string | null;
  studentName: string;
  provider: string;
  country: string;
  startIntake: string | null;
  courseLevel: string | null;
  courseName: string | null;
  courseDurationYears: string | null;
  commissionRatePct: string | null;
  gstRatePct: string | null;
  gstApplicable: string;
  scholarshipType: string | null;
  scholarshipValue: string | null;
  status: string | null;
  notes: string | null;
  totalReceived: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CommissionEntry {
  id: number;
  commissionStudentId: number;
  studentProviderId: number | null;
  termName: string;
  academicYear: string | null;
  feeGross: string | null;
  commissionRateAuto: string | null;
  commissionRateOverridePct: string | null;
  commissionRateUsedPct: string | null;
  commissionAmount: string | null;
  bonus: string | null;
  gstAmount: string | null;
  totalAmount: string | null;
  paymentStatus: string | null;
  paidDate: string | null;
  invoiceNo: string | null;
  paymentRef: string | null;
  notes: string | null;
  studentStatus: string | null;
  rateChangeWarning: string | null;
  scholarshipTypeAuto: string | null;
  scholarshipValueAuto: string | null;
  scholarshipTypeOverride: string | null;
  scholarshipValueOverride: string | null;
  scholarshipTypeUsed: string | null;
  scholarshipValueUsed: string | null;
  scholarshipChangeWarning: string | null;
  scholarshipAmount: string | null;
  feeAfterScholarship: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface StudentProvider {
  id: number;
  commissionStudentId: number;
  provider: string;
  studentId: string | null;
  country: string | null;
  courseLevel: string | null;
  courseName: string | null;
  courseDurationYears: string | null;
  startIntake: string | null;
  commissionRatePct: string | null;
  gstRatePct: string | null;
  gstApplicable: string | null;
  scholarshipType: string | null;
  scholarshipValue: string | null;
  status: string | null;
  notes: string | null;
  createdAt: string | null;
}

export interface SubAgentEntry {
  id: number;
  commissionStudentId: number;
  subAgentCommissionRatePct: string | null;
  gstApplicable: string;
  sicReceivedTotal: string | null;
  subAgentPaidTotal: string | null;
  margin: string | null;
  overpayWarning: string | null;
  status: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SubAgentTermEntry {
  id: number;
  commissionStudentId: number;
  termName: string;
  academicYear: string | null;
  feeNet: string | null;
  mainCommission: string | null;
  commissionRateAuto: string | null;
  commissionRateOverridePct: string | null;
  commissionRateUsedPct: string | null;
  subAgentCommission: string | null;
  bonusPaid: string | null;
  gstPct: string | null;
  gstAmount: string | null;
  totalPaid: string | null;
  paymentStatus: string | null;
  studentStatus: string | null;
  rateOverrideWarning: string | null;
  exceedsMainWarning: string | null;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface PasswordResetToken {
  id: number;
  userId: number;
  tokenHash: string;
  expiresAt: string;
  usedAt: string | null;
  requestIp: string | null;
  userAgent: string | null;
  createdAt: string | null;
}

export interface AuditLog {
  id: number;
  userId: number | null;
  action: string;
  entityType: string;
  entityId: number | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: unknown;
  createdAt: string | null;
}

export interface TargetBonusRule {
  id: number;
  targetId: number;
  bonusType: string;
  currency: string;
  createdAt: string | null;
}

export interface TargetBonusTier {
  id: number;
  bonusRuleId: number;
  minStudents: number;
  maxStudents: number | null;
  bonusAmount: string;
  calculationType: string;
}

export interface TargetBonusCountryEntry {
  id: number;
  bonusRuleId: number;
  countryId: number;
  studentCount: number;
  bonusAmount: string;
}

export interface UserSession {
  id: number;
  userId: number;
  sessionToken: string | null;
  ipAddress: string | null;
  browser: string | null;
  os: string | null;
  deviceType: string | null;
  location: string | null;
  loginAt: string | null;
  lastActivityAt: string | null;
  logoutAt: string | null;
  logoutReason: string | null;
  isActive: boolean;
  otpVerified: boolean;
}

export interface LoginVerificationCode {
  id: number;
  userId: number;
  codeHash: string;
  createdAt: string | null;
  expiresAt: string;
  usedAt: string | null;
  attempts: number;
  resendCount: number;
  status: string;
}

export interface SecurityAuditLog {
  id: number;
  userId: number | null;
  eventType: string;
  ipAddress: string | null;
  deviceInfo: string | null;
  metadata: unknown;
  createdAt: string | null;
}

export interface PasswordHistoryEntry {
  id: number;
  userId: number;
  passwordHash: string;
  createdAt: string | null;
}

export interface AgreementNotification {
  id: number;
  agreementId: number;
  providerName: string;
  notificationType: string;
  sentDate: string | null;
  daysBeforeExpiry: number | null;
  status: string;
  recipientEmails: string | null;
}

export const AGREEMENT_TYPES = ["agency", "commission_schedule", "addendum", "renewal", "mou", "other"] as const;
export const AGREEMENT_STATUSES = ["draft", "active", "expired", "terminated", "renewal_in_progress"] as const;
export const TERRITORY_TYPES = ["global", "country_specific"] as const;
export const TARGET_TYPES = ["monthly", "intake", "yearly"] as const;
export const TARGET_METRICS = ["applications", "enrolments", "new_student_enrolments", "starts", "revenue"] as const;
export const COMMISSION_MODES = ["percentage", "flat"] as const;
export const COMMISSION_BASIS = ["per_subject", "per_term", "first_year", "full_course", "per_intake"] as const;
export const PAY_EVENTS = ["enrolment", "census", "completion"] as const;
export const STUDY_LEVELS = ["Pre-Master / Master Qualifying Program", "Foundation Studies", "ELICOS / English Program", "Bachelor", "Master", "PhD", "Master of Research", "Diploma", "Package", "Any"] as const;
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
  {
    module: "employees",
    label: "Employees",
    resources: [
      { resource: "employee", label: "Employees", actions: ["read", "add", "update", "delete"] },
    ],
  },
  {
    module: "emp_agreements",
    label: "Employment Agreements",
    resources: [
      { resource: "agreement", label: "Employment Agreements", actions: ["read", "add", "update", "delete", "send", "upload_signed", "complete", "download", "terminate"] },
    ],
  },
  {
    module: "offer_letters",
    label: "Offer Letters",
    resources: [
      { resource: "offer_letter", label: "Offer Letters", actions: ["read", "add", "update", "delete", "send", "upload_signed", "complete", "download"] },
    ],
  },
  {
    module: "emp_templates",
    label: "Employee Templates",
    resources: [
      { resource: "template", label: "Agreement / Offer Templates", actions: ["read", "add", "update", "delete", "download"] },
    ],
  },
  {
    module: "emp_documents",
    label: "Employee Documents",
    resources: [
      { resource: "document", label: "Employee Documents", actions: ["read", "upload", "replace", "delete", "download", "view_confidential"] },
    ],
  },
  {
    module: "provider_commission",
    label: "Sub Agent Commission Distribution",
    resources: [
      { resource: "entry", label: "Commission Entries", actions: ["read", "add", "update", "delete"] },
      { resource: "config", label: "Configuration", actions: ["manage"] },
    ],
  },
  {
    module: "dropdown_settings",
    label: "Dropdown Settings",
    resources: [
      { resource: "option", label: "Dropdown Options", actions: ["read", "add", "update", "delete"] },
    ],
  },
  {
    module: "hrms",
    label: "HRMS",
    resources: [
      { resource: "organization", label: "Organizations", actions: ["read", "add", "update", "delete"] },
      { resource: "department", label: "Departments", actions: ["read", "add", "update", "delete"] },
      { resource: "fiscal_year", label: "Fiscal Years", actions: ["read", "add", "update", "delete"] },
      { resource: "leave_type", label: "Leave Types", actions: ["read", "add", "update", "delete"] },
      { resource: "leave_policy", label: "Leave Policies", actions: ["read", "add", "update", "delete"] },
      { resource: "holiday", label: "Holidays", actions: ["read", "add", "update", "delete"] },
      { resource: "leave_balance", label: "Leave Balances", actions: ["read", "add"] },
      { resource: "leave_request", label: "Leave Requests", actions: ["read", "add", "update", "delete", "approve"] },
      { resource: "attendance", label: "Attendance", actions: ["read", "add", "update"] },
      { resource: "device_mapping", label: "Device Mappings", actions: ["read", "add", "delete"] },
      { resource: "online_checkin", label: "Online Check-in Permissions", actions: ["read", "add", "delete"] },
      { resource: "salary", label: "Salary Structures", actions: ["read", "add", "update"] },
      { resource: "payroll", label: "Payroll", actions: ["read", "add", "delete", "process"] },
      { resource: "payslip", label: "Payslips", actions: ["read"] },
      { resource: "notification", label: "Notification Settings", actions: ["read", "update"] },
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
  "dropdown_settings.view": "dropdown_settings.option.read",
  "dropdown_settings.create": "dropdown_settings.option.add",
  "dropdown_settings.edit": "dropdown_settings.option.update",
  "dropdown_settings.delete": "dropdown_settings.option.delete",
};
