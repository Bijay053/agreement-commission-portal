import type { CommissionStudent, CommissionEntry } from "@shared/schema";

export const TERM_NAMES = ["T1_2025", "T2_2025", "T3_2025"] as const;

export const STUDENT_STATUSES = ["Under Enquiry", "Claim Next Semester", "On Break", "Withdrawn", "Complete", "Active"] as const;
export const PAYMENT_STATUSES = ["Pending", "Received", "Reversed", "Hold"] as const;
export const ACADEMIC_YEARS = ["Year 1", "Year 2", "Year 3"] as const;
export const SCHOLARSHIP_TYPES = ["None", "Percent", "Fixed"] as const;
export const COURSE_LEVELS = [
  "Diploma",
  "Diploma Leading Bachelor",
  "Bachelor",
  "Master",
  "Eap leading Master",
  "PhD",
  "Certificate",
  "Other"
] as const;

function num(v: string | number | null | undefined, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function isAustralia(country: string): boolean {
  const c = (country || "").trim().toLowerCase();
  return c === "australia" || c === "au";
}

function normSch(t: string | null | undefined): string {
  const s = (t || "").trim() || "None";
  return (SCHOLARSHIP_TYPES as readonly string[]).includes(s) ? s : "None";
}

function calcScholarship(fee: number, type: string, value: number): number {
  if (type === "None") return 0;
  if (type === "Percent") return round2(fee * (value / 100));
  if (type === "Fixed") return round2(value);
  return 0;
}

export interface CalculatedEntry {
  commissionRateAuto: string;
  commissionRateUsedPct: string;
  commissionAmount: string;
  gstAmount: string;
  totalAmount: string;
  rateChangeWarning: string | null;
  scholarshipTypeAuto: string;
  scholarshipValueAuto: string;
  scholarshipTypeUsed: string;
  scholarshipValueUsed: string;
  scholarshipChangeWarning: string | null;
  scholarshipAmount: string;
  feeAfterScholarship: string;
}

export function calculateEntry(
  student: CommissionStudent,
  entry: Partial<CommissionEntry> & { feeGross?: string | null; bonus?: string | null; commissionRateOverridePct?: string | null; scholarshipTypeOverride?: string | null; scholarshipValueOverride?: string | null }
): CalculatedEntry {
  const fee = num(entry.feeGross, 0);

  const masterSchType = normSch(student.scholarshipType);
  const masterSchVal = num(student.scholarshipValue, 0);

  const overrideTypeRaw = (entry.scholarshipTypeOverride || "").trim();
  const overrideType = overrideTypeRaw ? normSch(overrideTypeRaw) : "";
  const overrideVal = num(entry.scholarshipValueOverride, 0);

  const usedSchType = overrideType ? overrideType : masterSchType;
  const usedSchVal = overrideType ? overrideVal : masterSchVal;

  let scholarshipAmount = 0;
  let feeAfterScholarship = fee;

  if (usedSchType === "None") {
    scholarshipAmount = 0;
    feeAfterScholarship = round2(fee);
  } else {
    scholarshipAmount = calcScholarship(fee, usedSchType, usedSchVal);
    feeAfterScholarship = round2(Math.max(0, fee - scholarshipAmount));
  }

  const schChanged = !!overrideType &&
    (usedSchType !== masterSchType || Math.abs(usedSchVal - masterSchVal) > 0.000001);

  const agreedPct = num(student.commissionRatePct, 0);
  const commissionRateAuto = agreedPct;

  const overridePct = num(entry.commissionRateOverridePct, 0);
  const usedPct = overridePct > 0 ? overridePct : agreedPct;

  const commChanged = overridePct > 0 && Math.abs(overridePct - agreedPct) > 0.000001;

  const commission = round2(fee * (usedPct / 100));
  const bonus = num(entry.bonus, 0);

  let gstRateDec = 0;
  if (isAustralia(student.country) && student.gstApplicable === "Yes") {
    gstRateDec = 0.10;
  }

  const gst = round2((commission + bonus) * gstRateDec);
  const total = round2(commission + bonus + gst);

  return {
    commissionRateAuto: String(commissionRateAuto),
    commissionRateUsedPct: String(usedPct),
    commissionAmount: String(commission),
    gstAmount: String(gst),
    totalAmount: String(total),
    rateChangeWarning: commChanged ? "Commission rate changed" : null,
    scholarshipTypeAuto: masterSchType,
    scholarshipValueAuto: String(masterSchVal),
    scholarshipTypeUsed: usedSchType,
    scholarshipValueUsed: String(usedSchVal),
    scholarshipChangeWarning: schChanged ? "Scholarship changed" : null,
    scholarshipAmount: String(scholarshipAmount),
    feeAfterScholarship: String(feeAfterScholarship),
  };
}

export function computeMasterStatus(termStatuses: string[]): string {
  if (termStatuses.includes("Withdrawn")) return "Withdrawn";
  if (termStatuses.includes("Complete")) return "Complete";
  if (termStatuses.includes("On Break")) return "On Break";
  if (termStatuses.includes("Claim Next Semester")) return "Claim Next Semester";
  if (termStatuses.includes("Active")) return "Active";
  return "Under Enquiry";
}

export function computeMasterFromEntries(entries: CommissionEntry[]): {
  status: string;
  notes: string;
  totalReceived: string;
} {
  const termOrder = TERM_NAMES;
  const entryByTerm: Record<string, CommissionEntry> = {};
  for (const e of entries) {
    entryByTerm[e.termName] = e;
  }

  const termStatuses: string[] = [];
  const parts: string[] = [];
  let totalAmount = 0;

  let blocked = false;
  for (const term of termOrder) {
    const e = entryByTerm[term];
    if (!e) continue;

    if (blocked) {
      continue;
    }

    const st = (e.studentStatus || "Under Enquiry").trim();
    termStatuses.push(st);

    const shortTerm = term.split("_")[0];
    parts.push(`${shortTerm}:${st}`);

    totalAmount += num(e.totalAmount, 0);

    if (st === "Withdrawn" || st === "Complete") {
      blocked = true;
    }
  }

  return {
    status: computeMasterStatus(termStatuses),
    notes: parts.join(" | "),
    totalReceived: String(round2(totalAmount)),
  };
}

export function getEligibleTerms(startIntake: string | null | undefined): string[] {
  const s = (startIntake || "").trim().toUpperCase();
  if (!s) return [...TERM_NAMES];

  const termMatch = s.match(/T\s*([123])/i);
  const yearMatch = s.match(/(20\d{2})/);

  const term = termMatch ? parseInt(termMatch[1], 10) : 1;
  const year = yearMatch ? parseInt(yearMatch[1], 10) : 2025;

  let startIdx: number;
  if (year <= 2024) startIdx = 0;
  else if (year === 2025) startIdx = Math.max(0, Math.min(2, term - 1));
  else startIdx = 2;

  return TERM_NAMES.slice(startIdx) as unknown as string[];
}

export const STATUS_COLORS: Record<string, string> = {
  "Withdrawn": "#FFC7CE",
  "Complete": "#C6EFCE",
  "On Break": "#FCE4D6",
  "Claim Next Semester": "#FFF2CC",
  "Under Enquiry": "#D9E1F2",
  "Active": "#C6EFCE",
};
