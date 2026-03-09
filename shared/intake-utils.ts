export interface ParsedIntake {
  term: number;
  year: number;
}

export function parseIntake(value: string | null | undefined): ParsedIntake | null {
  if (!value || !value.trim()) return null;
  const cleaned = value.trim().replace(/[-_]/g, " ").replace(/\s+/g, " ");
  const match = cleaned.match(/^[Tt](\d)\s*(\d{4})$/);
  if (match) {
    return { term: parseInt(match[1]), year: parseInt(match[2]) };
  }
  const match2 = cleaned.match(/^(\d{4})\s*[Tt](\d)$/);
  if (match2) {
    return { term: parseInt(match2[2]), year: parseInt(match2[1]) };
  }
  return null;
}

export function normalizeIntake(value: string | null | undefined): string | null {
  const parsed = parseIntake(value);
  if (!parsed) return null;
  return `T${parsed.term} ${parsed.year}`;
}

export function intakeSortKey(value: string | null | undefined): number {
  const parsed = parseIntake(value);
  if (!parsed) return 0;
  return parsed.year * 10 + parsed.term;
}

export function compareIntake(a: string | null | undefined, b: string | null | undefined): number {
  return intakeSortKey(a) - intakeSortKey(b);
}

export function intakeFromTermName(termName: string, terms: Array<{ termName: string; termNumber: number; year: number }>): ParsedIntake | null {
  const term = terms.find(t => t.termName === termName);
  if (!term) return null;
  return { term: term.termNumber, year: term.year };
}

export function intakeSortKeyFromParsed(parsed: ParsedIntake): number {
  return parsed.year * 10 + parsed.term;
}

export const FINAL_STATUSES = ["Withdrawn", "Complete"];

export function isFinalStatus(status: string | null | undefined): boolean {
  return FINAL_STATUSES.includes(status || "");
}
