import type { SubAgentEntry, SubAgentTermEntry } from "@shared/schema";

export const SUB_AGENT_PAYMENT_STATUSES = ["Invoice Waiting", "PO Send", "Payment Made", "Hold"] as const;
export const SUB_AGENT_ACADEMIC_YEARS = ["Year 1", "Year 2", "Year 3"] as const;

function num(v: string | number | null | undefined, fallback = 0): number {
  if (v === null || v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

export interface SubAgentCalcInput {
  feeNet: number;
  mainCommission: number;
  commissionRateAuto: number;
  commissionRateOverridePct: number | null;
  bonusPaid: number;
  gstPct: number;
  gstApplicable: boolean;
}

export interface SubAgentCalcResult {
  commissionRateUsedPct: string;
  subAgentCommission: string;
  gstAmount: string;
  totalPaid: string;
  rateOverrideWarning: string | null;
  exceedsMainWarning: string | null;
}

export function calculateSubAgentTermEntry(input: SubAgentCalcInput): SubAgentCalcResult {
  const { feeNet, mainCommission, commissionRateAuto, commissionRateOverridePct, bonusPaid, gstPct, gstApplicable } = input;

  const overrideRate = num(commissionRateOverridePct, 0);
  const usedRate = overrideRate > 0 ? overrideRate : commissionRateAuto;

  const subComm = round2(feeNet * (usedRate / 100));

  const rateOverrideWarning =
    overrideRate > 0 && Math.abs(overrideRate - commissionRateAuto) > 0.000001
      ? "⚠ Rate overridden"
      : null;

  const exceedsMainWarning =
    mainCommission > 0 && subComm > mainCommission
      ? "❌ Exceeds Main Commission"
      : null;

  const gst = gstApplicable && gstPct > 0
    ? round2((subComm + bonusPaid) * (gstPct / 100))
    : 0;

  const totalPaid = round2(subComm + bonusPaid + gst);

  return {
    commissionRateUsedPct: String(usedRate),
    subAgentCommission: String(subComm),
    gstAmount: String(gst),
    totalPaid: String(totalPaid),
    rateOverrideWarning,
    exceedsMainWarning,
  };
}

export interface MasterTotalsInput {
  sicReceivedTotal: number;
  subAgentPaidTotal: number;
}

export interface MasterTotalsResult {
  margin: string;
  overpayWarning: string | null;
}

export function calculateMasterTotals(input: MasterTotalsInput): MasterTotalsResult {
  const margin = round2(input.sicReceivedTotal - input.subAgentPaidTotal);
  const overpayWarning =
    input.sicReceivedTotal > 0 && input.subAgentPaidTotal > input.sicReceivedTotal
      ? "❌ Overpaid"
      : null;

  return { margin: String(margin), overpayWarning };
}
