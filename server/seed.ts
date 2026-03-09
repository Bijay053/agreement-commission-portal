import { db } from "./db";
import { hashPassword } from "./auth";
import {
  countries, universities, users, roles, permissions,
  rolePermissions, userRoles, agreements, agreementTargets,
  agreementCommissionRules, agreementContacts, commissionTerms,
} from "@shared/schema";
import { eq, sql } from "drizzle-orm";

const COUNTRIES_DATA = [
  { iso2: "AU", name: "Australia" },
  { iso2: "BD", name: "Bangladesh" },
  { iso2: "IN", name: "India" },
  { iso2: "NP", name: "Nepal" },
  { iso2: "PK", name: "Pakistan" },
  { iso2: "LK", name: "Sri Lanka" },
  { iso2: "GB", name: "United Kingdom" },
  { iso2: "US", name: "United States" },
  { iso2: "CA", name: "Canada" },
  { iso2: "NZ", name: "New Zealand" },
  { iso2: "MY", name: "Malaysia" },
  { iso2: "SG", name: "Singapore" },
  { iso2: "PH", name: "Philippines" },
  { iso2: "VN", name: "Vietnam" },
  { iso2: "ID", name: "Indonesia" },
];

const PERMISSION_CODES = [
  { code: "agreement.view", module: "agreements", resource: "agreement", action: "read", description: "View agreements" },
  { code: "agreement.create", module: "agreements", resource: "agreement", action: "add", description: "Create agreements" },
  { code: "agreement.edit", module: "agreements", resource: "agreement", action: "update", description: "Edit agreements" },
  { code: "agreement.delete", module: "agreements", resource: "agreement", action: "delete", description: "Delete agreements" },
  { code: "agreement.export", module: "agreements", resource: "agreement", action: "export", description: "Export agreements" },
  { code: "agreement.notes.view_sensitive", module: "agreements", resource: "notes", action: "read", description: "View sensitive notes" },
  { code: "agreement.notes.edit_sensitive", module: "agreements", resource: "notes", action: "update", description: "Edit sensitive notes" },
  { code: "providers.provider.read", module: "providers", resource: "provider", action: "read", description: "View providers" },
  { code: "providers.provider.add", module: "providers", resource: "provider", action: "add", description: "Add providers" },
  { code: "providers.provider.update", module: "providers", resource: "provider", action: "update", description: "Update providers" },
  { code: "providers.provider.delete", module: "providers", resource: "provider", action: "delete", description: "Delete providers" },
  { code: "providers.provider.export", module: "providers", resource: "provider", action: "export", description: "Export providers" },
  { code: "targets.view", module: "targets", resource: "target", action: "read", description: "View targets" },
  { code: "targets.create", module: "targets", resource: "target", action: "add", description: "Create targets" },
  { code: "targets.edit", module: "targets", resource: "target", action: "update", description: "Edit targets" },
  { code: "targets.delete", module: "targets", resource: "target", action: "delete", description: "Delete targets" },
  { code: "targets.export", module: "targets", resource: "target", action: "export", description: "Export targets" },
  { code: "commission.view", module: "commission", resource: "commission_rule", action: "read", description: "View commission rules" },
  { code: "commission.create", module: "commission", resource: "commission_rule", action: "add", description: "Create commission rules" },
  { code: "commission.edit", module: "commission", resource: "commission_rule", action: "update", description: "Edit commission rules" },
  { code: "commission.delete", module: "commission", resource: "commission_rule", action: "delete", description: "Delete commission rules" },
  { code: "commission.export", module: "commission", resource: "commission_rule", action: "export", description: "Export commission rules" },
  { code: "bonus.view", module: "bonus", resource: "bonus_rule", action: "read", description: "View bonus rules" },
  { code: "bonus.create", module: "bonus", resource: "bonus_rule", action: "add", description: "Create bonus rules" },
  { code: "bonus.edit", module: "bonus", resource: "bonus_rule", action: "update", description: "Edit bonus rules" },
  { code: "bonus.delete", module: "bonus", resource: "bonus_rule", action: "delete", description: "Delete bonus rules" },
  { code: "bonus.export", module: "bonus", resource: "bonus_rule", action: "export", description: "Export bonus rules" },
  { code: "contacts.view", module: "contacts", resource: "contact", action: "read", description: "View contacts" },
  { code: "contacts.create", module: "contacts", resource: "contact", action: "add", description: "Create contacts" },
  { code: "contacts.edit", module: "contacts", resource: "contact", action: "update", description: "Edit contacts" },
  { code: "contacts.delete", module: "contacts", resource: "contact", action: "delete", description: "Delete contacts" },
  { code: "contacts.export", module: "contacts", resource: "contact", action: "export", description: "Export contacts" },
  { code: "document.list", module: "documents", resource: "document", action: "list", description: "List documents" },
  { code: "document.view_in_portal", module: "documents", resource: "document", action: "view_in_portal", description: "View documents in portal" },
  { code: "document.download", module: "documents", resource: "document", action: "download", description: "Download documents" },
  { code: "document.upload", module: "documents", resource: "document", action: "upload", description: "Upload documents" },
  { code: "document.replace", module: "documents", resource: "document", action: "replace", description: "Replace documents" },
  { code: "document.delete", module: "documents", resource: "document", action: "delete", description: "Delete documents" },
  { code: "audit.view", module: "administration", resource: "audit", action: "read", description: "View audit logs" },
  { code: "security.user.manage", module: "administration", resource: "user", action: "update", description: "Manage users" },
  { code: "security.role.manage", module: "administration", resource: "role", action: "update", description: "Manage roles" },
  { code: "security.country_scope.manage", module: "administration", resource: "country_scope", action: "update", description: "Manage country access" },
  { code: "reminders.view", module: "reminders", resource: "reminder", action: "read", description: "View reminders" },
  { code: "reminders.manage", module: "reminders", resource: "reminder", action: "update", description: "Manage reminders" },
  { code: "commission_tracker.view", module: "commission_tracker", resource: "student", action: "read", description: "View commission tracker" },
  { code: "commission_tracker.create", module: "commission_tracker", resource: "student", action: "add", description: "Add commission students" },
  { code: "commission_tracker.edit", module: "commission_tracker", resource: "student", action: "update", description: "Edit commission students" },
  { code: "commission_tracker.delete", module: "commission_tracker", resource: "student", action: "delete", description: "Delete commission students" },
  { code: "commission_tracker.student.delete_master", module: "commission_tracker", resource: "student", action: "delete_master", description: "Delete students from dashboard (admin only)" },
  { code: "commission_tracker.export", module: "commission_tracker", resource: "student", action: "export", description: "Export commission data" },
  { code: "commission_tracker.entry.view", module: "commission_tracker", resource: "entry", action: "read", description: "View term entries" },
  { code: "commission_tracker.entry.create", module: "commission_tracker", resource: "entry", action: "add", description: "Add term entries" },
  { code: "commission_tracker.entry.edit", module: "commission_tracker", resource: "entry", action: "update", description: "Edit term entries" },
  { code: "commission_tracker.entry.delete", module: "commission_tracker", resource: "entry", action: "delete", description: "Delete term entries" },
];

const ROLES_DATA = [
  { name: "Super Admin", description: "Full access to everything" },
  { name: "Agreement Admin", description: "Manages agreements, docs, and data" },
  { name: "Agreement Editor", description: "Data entry and maintenance" },
  { name: "Agreement Viewer", description: "View-only access with high security" },
  { name: "Document Viewer Only", description: "Can only view documents" },
  { name: "Compliance / Auditor", description: "Read-only plus audit logs" },
  { name: "Contact Viewer", description: "Can only view contact details" },
  { name: "Contact Manager", description: "Full contact management access" },
  { name: "Commission Viewer", description: "Can only view commission and bonus data" },
  { name: "Commission Manager", description: "Full commission and bonus management" },
  { name: "Finance Viewer", description: "View commission, bonus, documents, and agreements" },
];

const ROLE_PERMISSION_MAP: Record<string, string[]> = {
  "Super Admin": PERMISSION_CODES.map(p => p.code),
  "Agreement Admin": [
    "agreement.view", "agreement.create", "agreement.edit",
    "agreement.notes.view_sensitive", "agreement.notes.edit_sensitive",
    "providers.provider.read", "providers.provider.add", "providers.provider.update",
    "targets.view", "targets.create", "targets.edit", "targets.delete",
    "commission.view", "commission.create", "commission.edit", "commission.delete",
    "bonus.view", "bonus.create", "bonus.edit", "bonus.delete",
    "contacts.view", "contacts.create", "contacts.edit", "contacts.delete",
    "document.list", "document.view_in_portal",
    "document.download", "document.upload", "document.replace", "audit.view",
    "reminders.view",
  ],
  "Agreement Editor": [
    "agreement.view", "agreement.create", "agreement.edit",
    "providers.provider.read", "providers.provider.add", "providers.provider.update",
    "targets.view", "targets.create", "targets.edit",
    "commission.view", "commission.create", "commission.edit",
    "bonus.view", "bonus.create", "bonus.edit",
    "contacts.view", "contacts.create", "contacts.edit",
    "document.list", "document.view_in_portal",
    "document.upload", "document.replace",
  ],
  "Agreement Viewer": [
    "agreement.view", "providers.provider.read",
    "targets.view", "commission.view", "bonus.view",
    "contacts.view", "document.list", "document.view_in_portal",
  ],
  "Document Viewer Only": [
    "document.list", "document.view_in_portal",
  ],
  "Compliance / Auditor": [
    "agreement.view", "agreement.notes.view_sensitive",
    "providers.provider.read",
    "targets.view", "commission.view", "bonus.view", "contacts.view",
    "document.list", "document.view_in_portal", "document.download",
    "audit.view", "reminders.view",
  ],
  "Contact Viewer": [
    "contacts.view",
  ],
  "Contact Manager": [
    "contacts.view", "contacts.create", "contacts.edit", "contacts.delete",
  ],
  "Commission Viewer": [
    "commission.view", "bonus.view",
    "commission_tracker.view", "commission_tracker.entry.view",
  ],
  "Commission Manager": [
    "commission.view", "commission.create", "commission.edit", "commission.delete", "commission.export",
    "bonus.view", "bonus.create", "bonus.edit", "bonus.delete", "bonus.export",
    "commission_tracker.view", "commission_tracker.create", "commission_tracker.edit", "commission_tracker.delete",
    "commission_tracker.entry.view", "commission_tracker.entry.create", "commission_tracker.entry.edit", "commission_tracker.entry.delete",
    "commission_tracker.export",
  ],
  "Finance Viewer": [
    "commission.view", "bonus.view",
    "document.list", "document.view_in_portal",
    "agreement.view",
  ],
};

export async function seedDatabase() {
  const [existingUser] = await db.select().from(users).limit(1);
  if (existingUser) {
    console.log("Database already seeded, skipping...");
    return;
  }

  console.log("Seeding database...");

  await db.insert(countries).values(COUNTRIES_DATA);
  const allCountries = await db.select().from(countries);
  const countryMap = Object.fromEntries(allCountries.map(c => [c.iso2, c.id]));

  await db.insert(permissions).values(PERMISSION_CODES);
  const allPerms = await db.select().from(permissions);
  const permMap = Object.fromEntries(allPerms.map(p => [p.code, p.id]));

  await db.insert(roles).values(ROLES_DATA);
  const allRoles = await db.select().from(roles);
  const roleMap = Object.fromEntries(allRoles.map(r => [r.name, r.id]));

  for (const [roleName, permCodes] of Object.entries(ROLE_PERMISSION_MAP)) {
    for (const code of permCodes) {
      await db.insert(rolePermissions).values({
        roleId: roleMap[roleName],
        permissionId: permMap[code],
      });
    }
  }

  const defaultAdminPass = process.env.DEFAULT_ADMIN_PASSWORD || "Admin@Portal2026";
  const defaultViewerPass = process.env.DEFAULT_VIEWER_PASSWORD || "Viewer@Portal2026";
  const defaultEditorPass = process.env.DEFAULT_EDITOR_PASSWORD || "Editor@Portal2026";

  const adminHash = await hashPassword(defaultAdminPass);
  const [adminUser] = await db.insert(users).values({
    email: "au@studyinfocentre.com",
    fullName: "System Administrator",
    passwordHash: adminHash,
    isActive: true,
  }).returning();

  const viewerHash = await hashPassword(defaultViewerPass);
  const [viewerUser] = await db.insert(users).values({
    email: "viewer@studyinfocentre.com",
    fullName: "Sarah Johnson",
    passwordHash: viewerHash,
    isActive: true,
  }).returning();

  const editorHash = await hashPassword(defaultEditorPass);
  const [editorUser] = await db.insert(users).values({
    email: "editor@studyinfocentre.com",
    fullName: "Michael Chen",
    passwordHash: editorHash,
    isActive: true,
  }).returning();

  await db.insert(userRoles).values({ userId: adminUser.id, roleId: roleMap["Super Admin"] });
  await db.insert(userRoles).values({ userId: viewerUser.id, roleId: roleMap["Agreement Viewer"] });
  await db.insert(userRoles).values({ userId: editorUser.id, roleId: roleMap["Agreement Editor"] });

  const uniData = [
    { name: "University of Newcastle", countryId: countryMap["AU"], website: "https://www.newcastle.edu.au" },
    { name: "Deakin University", countryId: countryMap["AU"], website: "https://www.deakin.edu.au" },
    { name: "University of Wollongong", countryId: countryMap["AU"], website: "https://www.uow.edu.au" },
    { name: "Western Sydney University", countryId: countryMap["AU"], website: "https://www.westernsydney.edu.au" },
    { name: "Griffith University", countryId: countryMap["AU"], website: "https://www.griffith.edu.au" },
  ];
  await db.insert(universities).values(uniData);
  const allUnis = await db.select().from(universities);
  const uniMap = Object.fromEntries(allUnis.map(u => [u.name, u.id]));

  const agreementData = [
    {
      universityId: uniMap["University of Newcastle"],
      agreementCode: "UON-2026-BD-AGT-01",
      title: "2026 Agency Agreement - Bangladesh",
      agreementType: "agency",
      status: "active",
      territoryCountryId: countryMap["BD"],
      startDate: "2026-01-01",
      expiryDate: "2026-12-31",
      confidentialityLevel: "high",
      internalNotes: "Key partnership, priority renewal.",
      createdByUserId: adminUser.id,
      updatedByUserId: adminUser.id,
    },
    {
      universityId: uniMap["Deakin University"],
      agreementCode: "DEA-2026-IN-COM-01",
      title: "Commission Schedule 2026 - India",
      agreementType: "commission_schedule",
      status: "active",
      territoryCountryId: countryMap["IN"],
      startDate: "2026-02-01",
      expiryDate: "2026-06-15",
      confidentialityLevel: "high",
      createdByUserId: adminUser.id,
      updatedByUserId: adminUser.id,
    },
    {
      universityId: uniMap["University of Wollongong"],
      agreementCode: "UOW-2025-NP-AGT-01",
      title: "2025 Agency Agreement - Nepal",
      agreementType: "agency",
      status: "active",
      territoryCountryId: countryMap["NP"],
      startDate: "2025-06-01",
      expiryDate: "2026-05-31",
      confidentialityLevel: "medium",
      createdByUserId: adminUser.id,
      updatedByUserId: adminUser.id,
    },
    {
      universityId: uniMap["Western Sydney University"],
      agreementCode: "WSU-2025-PK-AGT-01",
      title: "2025 Agency Agreement - Pakistan",
      agreementType: "agency",
      status: "expired",
      territoryCountryId: countryMap["PK"],
      startDate: "2025-01-01",
      expiryDate: "2025-12-31",
      confidentialityLevel: "high",
      createdByUserId: adminUser.id,
      updatedByUserId: adminUser.id,
    },
    {
      universityId: uniMap["Griffith University"],
      agreementCode: "GRI-2026-LK-REN-01",
      title: "Renewal - Sri Lanka Territory 2026",
      agreementType: "renewal",
      status: "renewal_in_progress",
      territoryCountryId: countryMap["LK"],
      startDate: "2026-03-01",
      expiryDate: "2027-02-28",
      confidentialityLevel: "high",
      internalNotes: "Awaiting updated commission schedule from university.",
      createdByUserId: adminUser.id,
      updatedByUserId: adminUser.id,
    },
  ];
  const insertedAgreements = await db.insert(agreements).values(agreementData).returning();
  const agrMap = Object.fromEntries(insertedAgreements.map(a => [a.agreementCode, a.id]));

  await db.insert(agreementTargets).values([
    { agreementId: agrMap["UON-2026-BD-AGT-01"], targetType: "yearly", metric: "enrolments", value: "150", periodKey: "2026", createdByUserId: adminUser.id },
    { agreementId: agrMap["UON-2026-BD-AGT-01"], targetType: "intake", metric: "applications", value: "80", periodKey: "T1-2026", createdByUserId: adminUser.id },
    { agreementId: agrMap["UON-2026-BD-AGT-01"], targetType: "intake", metric: "applications", value: "100", periodKey: "T2-2026", createdByUserId: adminUser.id },
    { agreementId: agrMap["DEA-2026-IN-COM-01"], targetType: "yearly", metric: "starts", value: "200", periodKey: "2026", createdByUserId: adminUser.id },
    { agreementId: agrMap["UOW-2025-NP-AGT-01"], targetType: "monthly", metric: "applications", value: "20", periodKey: "2026-04", createdByUserId: adminUser.id },
  ]);

  await db.insert(agreementCommissionRules).values([
    {
      agreementId: agrMap["UON-2026-BD-AGT-01"],
      label: "Standard UG Commission",
      studyLevel: "UG",
      commissionMode: "percentage",
      percentageValue: "15.000",
      basis: "per_subject",
      payEvent: "census",
      subjectRules: { subjects_per_block: 2, max_subjects_per_year: 8, pay_on: "enrolled_subjects" },
      conditionsText: "Payable only if student remains enrolled until census date.",
      isActive: true,
    },
    {
      agreementId: agrMap["UON-2026-BD-AGT-01"],
      label: "PG First Year Commission",
      studyLevel: "PG",
      commissionMode: "percentage",
      percentageValue: "12.500",
      basis: "first_year",
      payEvent: "enrolment",
      isActive: true,
    },
    {
      agreementId: agrMap["DEA-2026-IN-COM-01"],
      label: "Flat Commission - All Levels",
      studyLevel: "Any",
      commissionMode: "flat",
      flatAmount: "2500.00",
      currency: "AUD",
      basis: "per_intake",
      payEvent: "enrolment",
      isActive: true,
    },
    {
      agreementId: agrMap["UOW-2025-NP-AGT-01"],
      label: "Diploma Commission",
      studyLevel: "Diploma",
      commissionMode: "percentage",
      percentageValue: "10.000",
      basis: "full_course",
      payEvent: "enrolment",
      isActive: true,
    },
  ]);

  await db.insert(agreementContacts).values([
    {
      agreementId: agrMap["UON-2026-BD-AGT-01"],
      fullName: "Dr. Amina Rahman",
      positionTitle: "International Partnerships Manager",
      phone: "+61 2 4921 5000",
      email: "a.rahman@newcastle.edu.au",
      countryId: countryMap["AU"],
      isPrimary: true,
    },
    {
      agreementId: agrMap["UON-2026-BD-AGT-01"],
      fullName: "James Wilson",
      positionTitle: "Agent Liaison Officer",
      phone: "+61 2 4921 5001",
      email: "j.wilson@newcastle.edu.au",
      countryId: countryMap["AU"],
      isPrimary: false,
    },
    {
      agreementId: agrMap["DEA-2026-IN-COM-01"],
      fullName: "Priya Sharma",
      positionTitle: "Regional Director - South Asia",
      phone: "+61 3 9244 6100",
      email: "p.sharma@deakin.edu.au",
      countryId: countryMap["AU"],
      isPrimary: true,
    },
    {
      agreementId: agrMap["UOW-2025-NP-AGT-01"],
      fullName: "Mark Thompson",
      positionTitle: "Head of International Recruitment",
      phone: "+61 2 4221 3000",
      email: "m.thompson@uow.edu.au",
      countryId: countryMap["AU"],
      isPrimary: true,
    },
    {
      agreementId: agrMap["GRI-2026-LK-REN-01"],
      fullName: "David Lee",
      positionTitle: "Partnership Development Manager",
      phone: "+61 7 3735 7111",
      email: "d.lee@griffith.edu.au",
      countryId: countryMap["AU"],
      isPrimary: true,
    },
  ]);

  await db.insert(commissionTerms).values([
    { termName: "T1_2025", termLabel: "T1 2025", year: 2025, termNumber: 1, sortOrder: 1 },
    { termName: "T2_2025", termLabel: "T2 2025", year: 2025, termNumber: 2, sortOrder: 2 },
    { termName: "T3_2025", termLabel: "T3 2025", year: 2025, termNumber: 3, sortOrder: 3 },
  ]);

  console.log("Database seeded successfully!");
}
