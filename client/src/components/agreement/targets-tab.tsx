import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Target, Trash2, Gift, Calculator, ChevronDown, ChevronUp } from "lucide-react";
import { TARGET_TYPES, TARGET_METRICS, BONUS_TYPES } from "@shared/schema";

const metricLabels: Record<string, string> = {
  applications: "Applications Submitted",
  enrolments: "Enrolments",
  new_student_enrolments: "New Student Enrolments",
  starts: "Student Starts",
  revenue: "Revenue",
};

const typeLabels: Record<string, string> = {
  monthly: "Monthly",
  intake: "Intake-based",
  yearly: "Yearly",
};

const bonusTypeLabels: Record<string, string> = {
  tier_per_student: "Per Student Tier Bonus",
  flat_on_target: "Flat Bonus on Target Achievement",
  country_bonus: "Country Based Bonus",
  tiered_flat: "Tiered Flat Bonus",
};

function getPeriodPlaceholder(targetType: string) {
  if (targetType === "yearly") return "2026";
  if (targetType === "monthly") return "2026-07";
  if (targetType === "intake") return "T1-2026";
  return "2026";
}

function validatePeriodKey(targetType: string, periodKey: string): string | null {
  if (targetType === "yearly" && !/^\d{4}$/.test(periodKey)) return "Must be a 4-digit year (e.g., 2026)";
  if (targetType === "monthly" && !/^\d{4}-\d{2}$/.test(periodKey)) return "Must be YYYY-MM (e.g., 2026-07)";
  if (targetType === "intake" && !/^[A-Za-z0-9]+-\d{4}$/.test(periodKey)) return "Must be like T1-2026";
  return null;
}

const defaultForm = {
  targetType: "yearly",
  metric: "enrolments",
  value: "",
  periodKey: "",
  currency: "",
  notes: "",
  bonusEnabled: false,
  bonusAmount: "",
  bonusCurrency: "AUD",
  bonusCondition: "",
  bonusNotes: "",
};

interface TierRow {
  minStudents: string;
  maxStudents: string;
  bonusAmount: string;
  calculationType: string;
}

interface CountryRow {
  countryId: string;
  studentCount: string;
  bonusAmount: string;
}

function BonusRulesSection({ targetId, canManage }: { targetId: number; canManage: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddRule, setShowAddRule] = useState(false);
  const [bonusType, setBonusType] = useState("tier_per_student");
  const [currency, setCurrency] = useState("AUD");
  const [tiers, setTiers] = useState<TierRow[]>([{ minStudents: "1", maxStudents: "5", bonusAmount: "0", calculationType: "per_student" }]);
  const [countryEntries, setCountryEntries] = useState<CountryRow[]>([{ countryId: "", studentCount: "", bonusAmount: "" }]);

  const { data: bonusRules, isLoading } = useQuery<any[]>({
    queryKey: ["/api/targets", targetId, "bonus-rules"],
    queryFn: async () => {
      const res = await fetch(`/api/targets/${targetId}/bonus-rules`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: countries } = useQuery<any[]>({ queryKey: ["/api/countries"] });

  const createRuleMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/targets/${targetId}/bonus-rules`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/targets", targetId, "bonus-rules"] });
      setShowAddRule(false);
      resetRuleForm();
      toast({ title: "Bonus rule added" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/bonus-rules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/targets", targetId, "bonus-rules"] });
      toast({ title: "Bonus rule deleted" });
    },
  });

  const resetRuleForm = () => {
    setBonusType("tier_per_student");
    setCurrency("AUD");
    setTiers([{ minStudents: "1", maxStudents: "5", bonusAmount: "0", calculationType: "per_student" }]);
    setCountryEntries([{ countryId: "", studentCount: "", bonusAmount: "" }]);
  };

  const addTierRow = () => {
    const last = tiers[tiers.length - 1];
    const nextMin = last ? String(parseInt(last.maxStudents || "0") + 1) : "1";
    setTiers([...tiers, { minStudents: nextMin, maxStudents: "", bonusAmount: "", calculationType: bonusType === "tier_per_student" ? "per_student" : "flat" }]);
  };

  const removeTierRow = (index: number) => {
    setTiers(tiers.filter((_, i) => i !== index));
  };

  const updateTier = (index: number, field: keyof TierRow, value: string) => {
    const updated = [...tiers];
    updated[index] = { ...updated[index], [field]: value };
    setTiers(updated);
  };

  const addCountryRow = () => {
    setCountryEntries([...countryEntries, { countryId: "", studentCount: "", bonusAmount: "" }]);
  };

  const removeCountryRow = (index: number) => {
    setCountryEntries(countryEntries.filter((_, i) => i !== index));
  };

  const updateCountryEntry = (index: number, field: keyof CountryRow, value: string) => {
    const updated = [...countryEntries];
    updated[index] = { ...updated[index], [field]: value };
    setCountryEntries(updated);
  };

  const handleSubmitRule = () => {
    const payload: any = { bonusType, currency };
    if (bonusType === "tier_per_student" || bonusType === "tiered_flat") {
      payload.tiers = tiers.map(t => ({
        minStudents: parseInt(t.minStudents),
        maxStudents: t.maxStudents ? parseInt(t.maxStudents) : null,
        bonusAmount: parseFloat(t.bonusAmount),
        calculationType: t.calculationType,
      }));
    }
    if (bonusType === "flat_on_target" || bonusType === "country_bonus") {
      payload.countryEntries = countryEntries.filter(e => e.countryId && e.studentCount).map(e => ({
        countryId: parseInt(e.countryId),
        studentCount: parseInt(e.studentCount),
        bonusAmount: parseFloat(e.bonusAmount),
      }));
    }
    createRuleMutation.mutate(payload);
  };

  if (isLoading) return <Skeleton className="h-16" />;

  return (
    <div className="space-y-2">
      {bonusRules && bonusRules.length > 0 && (
        <div className="space-y-2">
          {bonusRules.map((rule: any) => (
            <div key={rule.id} className="p-3 border rounded bg-accent/30 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <Badge variant="outline">{bonusTypeLabels[rule.bonusType] || rule.bonusType}</Badge>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">{rule.currency}</span>
                  {canManage && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteRuleMutation.mutate(rule.id)}>
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
              {rule.tiers && rule.tiers.length > 0 && (
                <div className="mt-1">
                  {rule.tiers.map((tier: any, i: number) => (
                    <div key={i} className="flex gap-2">
                      <span>{tier.minStudents}-{tier.maxStudents ?? "∞"} students</span>
                      <span className="font-medium">
                        {rule.currency} {parseFloat(tier.bonusAmount).toLocaleString()}
                        {tier.calculationType === "per_student" ? " per student" : " flat"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {rule.countryEntries && rule.countryEntries.length > 0 && (
                <div className="mt-1">
                  {rule.countryEntries.map((entry: any, i: number) => (
                    <div key={i} className="flex gap-2">
                      <span>{entry.countryName}: {entry.studentCount}+ students</span>
                      <span className="font-medium">{rule.currency} {parseFloat(entry.bonusAmount).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {canManage && !showAddRule && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => { resetRuleForm(); setShowAddRule(true); }}
          className="w-full"
          data-testid="button-add-bonus-rule"
        >
          <Plus className="w-3 h-3 mr-1" /> Add Bonus Rule
        </Button>
      )}

      {showAddRule && (
        <div className="p-3 border rounded space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Bonus Type</Label>
              <Select value={bonusType} onValueChange={v => { setBonusType(v); resetRuleForm(); setBonusType(v); }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BONUS_TYPES.map(t => (
                    <SelectItem key={t} value={t}>{bonusTypeLabels[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Currency</Label>
              <Input className="h-8 text-xs" value={currency} onChange={e => setCurrency(e.target.value)} placeholder="AUD" />
            </div>
          </div>

          {(bonusType === "tier_per_student" || bonusType === "tiered_flat") && (
            <div className="space-y-2">
              <Label className="text-xs font-medium">Tiers</Label>
              <div className="space-y-1">
                {tiers.map((tier, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <Input className="h-7 text-xs w-16" type="number" placeholder="From" value={tier.minStudents}
                      onChange={e => updateTier(i, "minStudents", e.target.value)} />
                    <span className="text-xs text-muted-foreground">to</span>
                    <Input className="h-7 text-xs w-16" type="number" placeholder="To/∞" value={tier.maxStudents}
                      onChange={e => updateTier(i, "maxStudents", e.target.value)} />
                    <Input className="h-7 text-xs w-20" type="number" placeholder="Amount" value={tier.bonusAmount}
                      onChange={e => updateTier(i, "bonusAmount", e.target.value)} />
                    {bonusType === "tier_per_student" && (
                      <Select value={tier.calculationType} onValueChange={v => updateTier(i, "calculationType", v)}>
                        <SelectTrigger className="h-7 text-xs w-24"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="per_student">Per Student</SelectItem>
                          <SelectItem value="flat">Flat</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeTierRow(i)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addTierRow}>
                <Plus className="w-3 h-3 mr-1" /> Add Tier
              </Button>
            </div>
          )}

          {(bonusType === "flat_on_target" || bonusType === "country_bonus") && (
            <div className="space-y-2">
              <Label className="text-xs font-medium">Country Bonuses</Label>
              <div className="space-y-1">
                {countryEntries.map((entry, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <Select value={entry.countryId} onValueChange={v => updateCountryEntry(i, "countryId", v)}>
                      <SelectTrigger className="h-7 text-xs w-28"><SelectValue placeholder="Country" /></SelectTrigger>
                      <SelectContent>
                        {countries?.map((c: any) => (
                          <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input className="h-7 text-xs w-16" type="number" placeholder="Students" value={entry.studentCount}
                      onChange={e => updateCountryEntry(i, "studentCount", e.target.value)} />
                    <Input className="h-7 text-xs w-20" type="number" placeholder="Amount" value={entry.bonusAmount}
                      onChange={e => updateCountryEntry(i, "bonusAmount", e.target.value)} />
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeCountryRow(i)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addCountryRow}>
                <Plus className="w-3 h-3 mr-1" /> Add Country
              </Button>
            </div>
          )}

          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs" onClick={handleSubmitRule} disabled={createRuleMutation.isPending}>
              {createRuleMutation.isPending ? "Saving..." : "Save Rule"}
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowAddRule(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TargetsTab({ agreementId }: { agreementId: number }) {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canManage = hasPermission("targets.manage");
  const [showDialog, setShowDialog] = useState(false);
  const [periodError, setPeriodError] = useState<string | null>(null);
  const [showBonusCalc, setShowBonusCalc] = useState<number | null>(null);
  const [calcStudents, setCalcStudents] = useState("");
  const [calcResult, setCalcResult] = useState<any>(null);
  const [expandedTarget, setExpandedTarget] = useState<number | null>(null);

  const { data: targets, isLoading } = useQuery<any[]>({
    queryKey: ["/api/agreements", agreementId, "targets"],
    queryFn: async () => {
      const res = await fetch(`/api/agreements/${agreementId}/targets`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const [form, setForm] = useState({ ...defaultForm });

  useEffect(() => {
    if (showDialog) {
      setForm({ ...defaultForm });
      setPeriodError(null);
    }
  }, [showDialog]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/agreements/${agreementId}/targets`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agreements", agreementId, "targets"] });
      setShowDialog(false);
      toast({ title: "Target added" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/targets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agreements", agreementId, "targets"] });
      toast({ title: "Target deleted" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const periodErr = validatePeriodKey(form.targetType, form.periodKey);
    if (periodErr) {
      setPeriodError(periodErr);
      return;
    }
    createMutation.mutate({
      ...form,
      currency: form.metric === "revenue" ? form.currency || "AUD" : null,
      bonusEnabled: form.bonusEnabled,
      bonusAmount: form.bonusEnabled && form.bonusAmount ? form.bonusAmount : null,
      bonusCurrency: form.bonusEnabled ? form.bonusCurrency : null,
      bonusCondition: form.bonusEnabled ? form.bonusCondition || null : null,
      bonusNotes: form.bonusEnabled ? form.bonusNotes || null : null,
    });
  };

  const handleBonusCalc = async (targetId: number) => {
    try {
      const res = await apiRequest("POST", "/api/bonus/calculate", {
        targetId,
        studentCount: parseInt(calcStudents),
      });
      const data = await res.json();
      setCalcResult(data);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  if (isLoading) return <div className="space-y-3">{Array.from({length: 2}).map((_,i) => <Skeleton key={i} className="h-20" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium">Performance Targets</h3>
        {canManage && (
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-target">
                <Plus className="w-4 h-4 mr-1" /> Add Target
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Target</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Target Type</Label>
                    <Select value={form.targetType} onValueChange={v => { setForm({...form, targetType: v}); setPeriodError(null); }}>
                      <SelectTrigger data-testid="select-target-type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TARGET_TYPES.map(t => <SelectItem key={t} value={t}>{typeLabels[t]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Metric</Label>
                    <Select value={form.metric} onValueChange={v => setForm({...form, metric: v})}>
                      <SelectTrigger data-testid="select-target-metric"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TARGET_METRICS.map(m => <SelectItem key={m} value={m}>{metricLabels[m]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Target Value</Label>
                    <Input type="number" value={form.value} onChange={e => setForm({...form, value: e.target.value})} placeholder="150" required data-testid="input-target-value" />
                  </div>
                  <div>
                    <Label>Period Key</Label>
                    <Input
                      value={form.periodKey}
                      onChange={e => { setForm({...form, periodKey: e.target.value}); setPeriodError(null); }}
                      placeholder={getPeriodPlaceholder(form.targetType)}
                      required
                      data-testid="input-period-key"
                    />
                    {periodError && <p className="text-xs text-destructive mt-1">{periodError}</p>}
                  </div>
                </div>
                {form.metric === "revenue" && (
                  <div>
                    <Label>Currency</Label>
                    <Input value={form.currency} onChange={e => setForm({...form, currency: e.target.value})} placeholder="AUD" />
                  </div>
                )}
                <div>
                  <Label>Notes</Label>
                  <Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Additional notes..." />
                </div>

                <div className="border-t pt-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Switch
                      checked={form.bonusEnabled}
                      onCheckedChange={v => setForm({...form, bonusEnabled: v})}
                      data-testid="switch-bonus-enabled"
                    />
                    <Label className="flex items-center gap-1.5">
                      <Gift className="w-4 h-4 text-primary" />
                      Enable Bonus
                    </Label>
                  </div>
                  {form.bonusEnabled && (
                    <div className="space-y-3 pl-1">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Bonus Amount</Label>
                          <Input type="number" value={form.bonusAmount} onChange={e => setForm({...form, bonusAmount: e.target.value})} placeholder="10000" data-testid="input-bonus-amount" />
                        </div>
                        <div>
                          <Label>Bonus Currency</Label>
                          <Input value={form.bonusCurrency} onChange={e => setForm({...form, bonusCurrency: e.target.value})} placeholder="AUD" data-testid="input-bonus-currency" />
                        </div>
                      </div>
                      <div>
                        <Label>Bonus Condition</Label>
                        <Input value={form.bonusCondition} onChange={e => setForm({...form, bonusCondition: e.target.value})} placeholder="If target achieved by intake deadline" data-testid="input-bonus-condition" />
                      </div>
                      <div>
                        <Label>Bonus Notes</Label>
                        <Textarea value={form.bonusNotes} onChange={e => setForm({...form, bonusNotes: e.target.value})} placeholder="Additional bonus details..." />
                      </div>
                    </div>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-target">
                  {createMutation.isPending ? "Adding..." : "Add Target"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {targets && targets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {targets.map((target: any) => (
            <Card key={target.id} data-testid={`card-target-${target.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">{typeLabels[target.targetType]}</Badge>
                      <Badge variant="secondary">{target.periodKey}</Badge>
                      {target.bonusEnabled && (
                        <Badge variant="default" className="bg-emerald-600">
                          <Gift className="w-3 h-3 mr-1" /> Bonus
                        </Badge>
                      )}
                    </div>
                    <div className="mt-2">
                      <p className="text-lg font-semibold">
                        {target.metric === "revenue" && target.currency ? `${target.currency} ` : ""}
                        {parseFloat(target.value).toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">{metricLabels[target.metric]}</p>
                    </div>
                    {target.notes && (
                      <p className="text-xs text-muted-foreground mt-1">{target.notes}</p>
                    )}
                    {target.bonusEnabled && (
                      <div className="mt-2 p-2 bg-emerald-500/10 rounded text-xs space-y-0.5">
                        {target.bonusAmount && (
                          <p className="font-medium text-emerald-700 dark:text-emerald-300">
                            Bonus: {target.bonusCurrency || "AUD"} {parseFloat(target.bonusAmount).toLocaleString()}
                          </p>
                        )}
                        {target.bonusCondition && <p className="text-muted-foreground">{target.bonusCondition}</p>}
                        {target.bonusNotes && <p className="text-muted-foreground italic">{target.bonusNotes}</p>}
                      </div>
                    )}

                    <div className="mt-2">
                      <button
                        className="text-xs text-primary flex items-center gap-1 hover:underline"
                        onClick={() => setExpandedTarget(expandedTarget === target.id ? null : target.id)}
                        data-testid={`button-toggle-bonus-rules-${target.id}`}
                      >
                        {expandedTarget === target.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        Bonus Rules
                      </button>
                      {expandedTarget === target.id && (
                        <div className="mt-2">
                          <BonusRulesSection targetId={target.id} canManage={canManage} />
                        </div>
                      )}
                    </div>

                    {showBonusCalc === target.id && (
                      <div className="mt-2 p-3 border rounded space-y-2">
                        <p className="text-xs font-medium">Preview Bonus Calculation</p>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={calcStudents}
                            onChange={e => setCalcStudents(e.target.value)}
                            placeholder="Student count"
                            className="w-32 h-8 text-xs"
                            data-testid={`input-calc-students-${target.id}`}
                          />
                          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => handleBonusCalc(target.id)} data-testid={`button-calc-bonus-${target.id}`}>
                            Calculate
                          </Button>
                        </div>
                        {calcResult && (
                          <div className="text-sm">
                            <p className="font-medium">
                              Estimated Bonus: {calcResult.breakdown?.[0]?.currency || "AUD"} {calcResult.totalBonus?.toLocaleString() || 0}
                            </p>
                            {calcResult.breakdown?.map((b: any, i: number) => (
                              <p key={i} className="text-xs text-muted-foreground">
                                {b.rule}: {b.currency} {b.amount.toLocaleString()}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => { setShowBonusCalc(showBonusCalc === target.id ? null : target.id); setCalcResult(null); setCalcStudents(""); }}
                      data-testid={`button-calc-toggle-${target.id}`}
                    >
                      <Calculator className="w-4 h-4 text-muted-foreground" />
                    </Button>
                    {canManage && (
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(target.id)} data-testid={`button-delete-target-${target.id}`}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Target className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">No targets configured</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
