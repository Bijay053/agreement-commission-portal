import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { MultiSearchableSelect } from "@/components/ui/multi-searchable-select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, DollarSign, Percent, Trash2, Pencil, ChevronDown, ChevronRight, ArrowRight } from "lucide-react";
import { useDropdownOptions } from "@/hooks/use-dropdown-options";

const basisLabels: Record<string, string> = {
  per_subject: "Per Subject",
  per_term: "Per Term",
  first_year: "First Year",
  full_course: "Full Course",
  per_intake: "Per Intake",
};

interface YearRate {
  year: string;
  mode: string;
  value: string;
  currency: string;
  studyLevel?: string;
}

const YEAR_OPTIONS = [
  "1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year",
];

function FollowUpSection({ state, setState, studyLevelOptions, modeOptions }: {
  state: any;
  setState: (s: any) => void;
  studyLevelOptions: { value: string; label: string }[];
  modeOptions: { value: string; label: string }[];
}) {
  const yearRates: YearRate[] = state.followupYearRates || [];
  const hasFollowup = yearRates.length > 0;
  const [expanded, setExpanded] = useState(!!hasFollowup);

  const addYearRate = () => {
    const lastStudyLevel = yearRates.length > 0 ? yearRates[yearRates.length - 1].studyLevel || "" : "";
    const sameStudyRates = yearRates.filter((r: YearRate) => (r.studyLevel || "") === lastStudyLevel);
    const usedYears = sameStudyRates.map((r: YearRate) => r.year);
    const nextYear = YEAR_OPTIONS.find(y => !usedYears.includes(y)) || `Year ${sameStudyRates.length + 1}`;
    setState({
      ...state,
      followupYearRates: [...yearRates, { year: nextYear, mode: "percentage", value: "", currency: "AUD", studyLevel: lastStudyLevel }],
    });
  };

  const updateYearRate = (idx: number, field: string, val: string) => {
    const updated = [...yearRates];
    updated[idx] = { ...updated[idx], [field]: val };
    setState({ ...state, followupYearRates: updated });
  };

  const removeYearRate = (idx: number) => {
    setState({ ...state, followupYearRates: yearRates.filter((_: YearRate, i: number) => i !== idx) });
  };

  const followupLevelOptions = [{ value: "", label: "Same as above" }, ...studyLevelOptions];

  return (
    <div className="border rounded-lg">
      <button
        type="button"
        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-left hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
        data-testid="button-toggle-followup"
      >
        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
        Follow-up Commission
        {hasFollowup && <Badge variant="secondary" className="ml-auto text-[10px]">Configured</Badge>}
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t pt-3">
          <p className="text-xs text-muted-foreground">If the student progresses to a new course (e.g., Diploma → Bachelor), specify the follow-up commission rates per year. Each row can have its own study level.</p>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Year-wise Rates</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={addYearRate}
                data-testid="button-add-year-rate"
              >
                <Plus className="w-3 h-3 mr-1" /> Add Year
              </Button>
            </div>
            {yearRates.length > 0 ? (
              <div className="space-y-2">
                {yearRates.map((yr: YearRate, idx: number) => (
                  <div key={idx} className="p-2 bg-muted/30 rounded-md space-y-1.5" data-testid={`followup-year-${idx}`}>
                    <div className="flex items-center gap-2">
                      <SearchableSelect
                        value={yr.studyLevel || ""}
                        onValueChange={v => updateYearRate(idx, "studyLevel", v)}
                        options={followupLevelOptions}
                        placeholder="Study Level"
                        searchPlaceholder="Search..."
                        className="flex-1 h-8"
                      />
                      <SearchableSelect
                        value={yr.year}
                        onValueChange={v => updateYearRate(idx, "year", v)}
                        options={YEAR_OPTIONS.map(y => ({ value: y, label: y }))}
                        placeholder="Year"
                        searchPlaceholder="Search..."
                        className="w-[120px] h-8"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => removeYearRate(idx)}
                        data-testid={`button-remove-year-${idx}`}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <SearchableSelect
                        value={yr.mode || "percentage"}
                        onValueChange={v => updateYearRate(idx, "mode", v)}
                        options={modeOptions.length > 0 ? modeOptions : [{ value: "percentage", label: "%" }, { value: "flat", label: "Flat" }]}
                        placeholder="Mode"
                        searchPlaceholder="Search..."
                        className="w-[100px] h-8"
                      />
                      {(yr.mode || "percentage") === "percentage" ? (
                        <Input
                          type="number"
                          step="0.001"
                          value={yr.value}
                          onChange={e => updateYearRate(idx, "value", e.target.value)}
                          placeholder="%"
                          className="h-8 flex-1"
                          data-testid={`input-year-rate-${idx}`}
                        />
                      ) : (
                        <>
                          <Input
                            type="number"
                            step="0.01"
                            value={yr.value}
                            onChange={e => updateYearRate(idx, "value", e.target.value)}
                            placeholder="Amount"
                            className="h-8 flex-1"
                            data-testid={`input-year-rate-${idx}`}
                          />
                          <Input
                            value={yr.currency || "AUD"}
                            onChange={e => updateYearRate(idx, "currency", e.target.value)}
                            placeholder="AUD"
                            className="h-8 w-[60px]"
                          />
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-2">No year rates added. Click "Add Year" to add rates.</p>
            )}
          </div>

          <div>
            <Label className="text-xs">Follow-up Conditions</Label>
            <Textarea
              value={state.followupConditionsText || ""}
              onChange={e => setState({ ...state, followupConditionsText: e.target.value })}
              placeholder="e.g., Applicable when student progresses from Diploma to Bachelor..."
              className="text-sm"
              data-testid="input-followup-conditions"
            />
          </div>
          {hasFollowup && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive text-xs"
              onClick={() => setState({
                ...state,
                followupStudyLevel: "",
                followupYearRates: [],
                followupConditionsText: "",
              })}
              data-testid="button-clear-followup"
            >
              Clear Follow-up
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default function CommissionTab({ agreementId }: { agreementId: number }) {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canCreate = hasPermission("commission.create");
  const canEdit = hasPermission("commission.edit");
  const canDelete = hasPermission("commission.delete");
  const [showDialog, setShowDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);

  const { data: rules, isLoading } = useQuery<any[]>({
    queryKey: ["/api/agreements", agreementId, "commission-rules"],
    queryFn: async () => {
      const res = await fetch(`/api/agreements/${agreementId}/commission-rules`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/agreements/${agreementId}/commission-rules`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agreements", agreementId, "commission-rules"] });
      setShowDialog(false);
      toast({ title: "Commission rule added" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/commission-rules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agreements", agreementId, "commission-rules"] });
      toast({ title: "Commission rule deleted" });
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/commission-rules/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agreements", agreementId, "commission-rules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/commission-rules"] });
      setEditingRule(null);
      toast({ title: "Commission rule updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const { options: dropdownOpts } = useDropdownOptions();
  const baseStudyLevelOptions = (dropdownOpts.study_level || []).map((o: any) => ({ value: o.value, label: o.label }));
  const basisOptions = (dropdownOpts.commission_basis || []).map((o: any) => ({ value: o.value, label: o.label }));
  const payEventOptions = (dropdownOpts.pay_event || []).map((o: any) => ({ value: o.value, label: o.label }));
  const modeOptions = (dropdownOpts.commission_mode || []).map((o: any) => ({ value: o.value, label: o.label }));

  const defaultForm: Record<string, any> = {
    label: "",
    studyLevel: [] as string[],
    commissionMode: "percentage",
    percentageValue: "",
    flatAmount: "",
    currency: "AUD",
    basis: "per_subject",
    payEvent: "enrolment",
    conditionsText: "",
    followupStudyLevel: "",
    followupYearRates: [] as YearRate[],
    followupConditionsText: "",
  };
  const [form, setForm] = useState(defaultForm);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {
      label: form.label,
      studyLevel: form.studyLevel.length === 0 ? "Any" : form.studyLevel.join(", "),
      commissionMode: form.commissionMode,
      percentageValue: form.commissionMode === "percentage" ? form.percentageValue : null,
      flatAmount: form.commissionMode === "flat" ? form.flatAmount : null,
      currency: form.commissionMode === "flat" ? form.currency : null,
      basis: form.basis,
      payEvent: form.payEvent,
      conditionsText: form.conditionsText,
    };
    if (form.followupStudyLevel || (form.followupYearRates && form.followupYearRates.length > 0)) {
      payload.followupStudyLevel = form.followupStudyLevel || null;
      payload.followupYearRates = form.followupYearRates && form.followupYearRates.length > 0 ? form.followupYearRates : null;
      payload.followupConditionsText = form.followupConditionsText || null;
    }
    createMutation.mutate(payload);
  };

  if (isLoading) return <div className="space-y-3">{Array.from({length: 2}).map((_,i) => <Skeleton key={i} className="h-24" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium">Commission Rules</h3>
        {canCreate && (
          <Dialog open={showDialog} onOpenChange={(open) => { if (open) setForm({...defaultForm}); setShowDialog(open); }}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-commission">
                <Plus className="w-4 h-4 mr-1" /> Add Rule
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Commission Rule</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Label</Label>
                  <Input value={form.label} onChange={e => setForm({...form, label: e.target.value})} placeholder="e.g., Standard UG Commission" required data-testid="input-commission-label" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Study Level</Label>
                    <MultiSearchableSelect
                      values={form.studyLevel}
                      onValuesChange={v => setForm({...form, studyLevel: v})}
                      options={baseStudyLevelOptions}
                      placeholder="Any"
                      searchPlaceholder="Search levels..."
                    />
                  </div>
                  <div>
                    <Label>Mode</Label>
                    <SearchableSelect
                      value={form.commissionMode}
                      onValueChange={v => setForm({...form, commissionMode: v})}
                      options={modeOptions.length > 0 ? modeOptions : [{ value: "percentage", label: "Percentage" }, { value: "flat", label: "Flat Amount" }]}
                      placeholder="Select mode"
                      searchPlaceholder="Search..."
                    />
                  </div>
                </div>
                {form.commissionMode === "percentage" ? (
                  <div>
                    <Label>Percentage (%)</Label>
                    <Input type="number" step="0.001" value={form.percentageValue} onChange={e => setForm({...form, percentageValue: e.target.value})} placeholder="15.000" required data-testid="input-percentage" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Amount</Label>
                      <Input type="number" step="0.01" value={form.flatAmount} onChange={e => setForm({...form, flatAmount: e.target.value})} placeholder="2500.00" required data-testid="input-flat-amount" />
                    </div>
                    <div>
                      <Label>Currency</Label>
                      <Input value={form.currency} onChange={e => setForm({...form, currency: e.target.value})} placeholder="AUD" data-testid="input-currency" />
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Basis</Label>
                    <SearchableSelect
                      value={form.basis}
                      onValueChange={v => setForm({...form, basis: v})}
                      options={basisOptions.length > 0 ? basisOptions : [{ value: "per_subject", label: "Per Subject" }]}
                      placeholder="Select basis"
                      searchPlaceholder="Search..."
                    />
                  </div>
                  <div>
                    <Label>Pay Event</Label>
                    <SearchableSelect
                      value={form.payEvent}
                      onValueChange={v => setForm({...form, payEvent: v})}
                      options={payEventOptions.length > 0 ? payEventOptions : [{ value: "enrolment", label: "Enrolment" }]}
                      placeholder="Select pay event"
                      searchPlaceholder="Search..."
                    />
                  </div>
                </div>
                <div>
                  <Label>Conditions</Label>
                  <Textarea value={form.conditionsText} onChange={e => setForm({...form, conditionsText: e.target.value})} placeholder="Clawback conditions, withdrawal rules..." data-testid="input-conditions" />
                </div>
                <FollowUpSection
                  state={form}
                  setState={setForm}
                  studyLevelOptions={baseStudyLevelOptions}
                  modeOptions={modeOptions}
                />
                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-commission">
                  {createMutation.isPending ? "Adding..." : "Add Rule"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {rules && rules.length > 0 ? (
        <div className="space-y-3">
          {rules.map((rule: any) => (
            <Card key={rule.id} data-testid={`card-commission-${rule.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-medium">{rule.label}</h4>
                      <Badge variant="outline">{rule.studyLevel || "Any"}</Badge>
                      {rule.isActive ? (
                        <Badge variant="default">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        {rule.commissionMode === "percentage" ? (
                          <><Percent className="w-3.5 h-3.5" /> {parseFloat(rule.percentageValue).toFixed(1)}%</>
                        ) : (
                          <><DollarSign className="w-3.5 h-3.5" /> {rule.currency} {parseFloat(rule.flatAmount).toLocaleString()}</>
                        )}
                      </span>
                      <span>{basisLabels[rule.basis] || rule.basis}</span>
                      <span>Pay on: {rule.payEvent}</span>
                    </div>
                    {rule.conditionsText && (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{rule.conditionsText}</p>
                    )}
                    {(rule.followupYearRates && rule.followupYearRates.length > 0) && (() => {
                      const grouped: Record<string, any[]> = {};
                      rule.followupYearRates.forEach((yr: any) => {
                        const lvl = yr.studyLevel || rule.followupStudyLevel || "";
                        if (!grouped[lvl]) grouped[lvl] = [];
                        grouped[lvl].push(yr);
                      });
                      return (
                        <div className="mt-2 pl-3 border-l-2 border-blue-300 dark:border-blue-700">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <ArrowRight className="w-3 h-3 text-blue-500" />
                            <span className="font-medium text-foreground">Follow-up:</span>
                          </div>
                          <div className="ml-5 mt-1 space-y-1">
                            {Object.entries(grouped).map(([lvl, rates]) => (
                              <div key={lvl}>
                                {lvl && <Badge variant="outline" className="text-[10px] py-0 mb-0.5">{lvl}</Badge>}
                                <div className="space-y-0.5">
                                  {rates.map((yr: any, i: number) => (
                                    <div key={i} className="text-[11px] text-muted-foreground">
                                      {yr.year}: {yr.mode === "flat" ? `${yr.currency || "AUD"} ${parseFloat(yr.value || 0).toLocaleString()}` : `${parseFloat(yr.value || 0)}%`}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                          {rule.followupConditionsText && (
                            <p className="text-[11px] text-muted-foreground mt-0.5 ml-5">{rule.followupConditionsText}</p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-1">
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const rawLevel = rule.studyLevel || "Any";
                          const parsedLevels = rawLevel === "Any" ? [] : rawLevel.split(",").map((s: string) => s.trim()).filter(Boolean);
                          setEditingRule({
                            id: rule.id,
                            label: rule.label || "",
                            studyLevel: parsedLevels,
                            commissionMode: rule.commissionMode || "percentage",
                            percentageValue: rule.percentageValue || "",
                            flatAmount: rule.flatAmount || "",
                            currency: rule.currency || "AUD",
                            basis: rule.basis || "per_subject",
                            payEvent: rule.payEvent || "enrolment",
                            conditionsText: rule.conditionsText || "",
                            isActive: rule.isActive !== false,
                            followupStudyLevel: rule.followupStudyLevel || "",
                            followupYearRates: rule.followupYearRates || [],
                            followupConditionsText: rule.followupConditionsText || "",
                          });
                        }}
                        data-testid={`button-edit-commission-${rule.id}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(rule.id)}
                        data-testid={`button-delete-commission-${rule.id}`}
                      >
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
            <DollarSign className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">No commission rules configured</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!editingRule} onOpenChange={(open) => { if (!open) setEditingRule(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Commission Rule</DialogTitle>
          </DialogHeader>
          {editingRule && (
            <form onSubmit={(e) => {
              e.preventDefault();
              const { id, studyLevel, ...rest } = editingRule;
              const payload: any = {
                ...rest,
                studyLevel: studyLevel.length === 0 ? "Any" : studyLevel.join(", "),
                percentageValue: rest.commissionMode === "percentage" ? rest.percentageValue : null,
                flatAmount: rest.commissionMode === "flat" ? rest.flatAmount : null,
                currency: rest.commissionMode === "flat" ? rest.currency : null,
              };
              if (!payload.followupStudyLevel && (!payload.followupYearRates || payload.followupYearRates.length === 0)) {
                payload.followupStudyLevel = null;
                payload.followupYearRates = null;
                payload.followupConditionsText = null;
              }
              editMutation.mutate({ id, data: payload });
            }} className="space-y-4">
              <div>
                <Label>Label</Label>
                <Input value={editingRule.label} onChange={e => setEditingRule({...editingRule, label: e.target.value})} placeholder="e.g., Standard UG Commission" required data-testid="input-edit-commission-label" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Study Level</Label>
                  <MultiSearchableSelect
                    values={editingRule.studyLevel}
                    onValuesChange={v => setEditingRule({...editingRule, studyLevel: v})}
                    options={(() => {
                      const opts = [...baseStudyLevelOptions];
                      (editingRule.studyLevel || []).forEach((v: string) => {
                        if (!opts.find(o => o.value === v)) {
                          opts.push({ value: v, label: v });
                        }
                      });
                      return opts;
                    })()}
                    placeholder="Any"
                    searchPlaceholder="Search levels..."
                  />
                </div>
                <div>
                  <Label>Mode</Label>
                  <SearchableSelect
                    value={editingRule.commissionMode}
                    onValueChange={v => setEditingRule({...editingRule, commissionMode: v})}
                    options={modeOptions.length > 0 ? modeOptions : [{ value: "percentage", label: "Percentage" }, { value: "flat", label: "Flat Amount" }]}
                    placeholder="Select mode"
                    searchPlaceholder="Search..."
                  />
                </div>
              </div>
              {editingRule.commissionMode === "percentage" ? (
                <div>
                  <Label>Percentage (%)</Label>
                  <Input type="number" step="0.001" value={editingRule.percentageValue} onChange={e => setEditingRule({...editingRule, percentageValue: e.target.value})} placeholder="15.000" required data-testid="input-edit-percentage" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Amount</Label>
                    <Input type="number" step="0.01" value={editingRule.flatAmount} onChange={e => setEditingRule({...editingRule, flatAmount: e.target.value})} placeholder="2500.00" required data-testid="input-edit-flat-amount" />
                  </div>
                  <div>
                    <Label>Currency</Label>
                    <Input value={editingRule.currency} onChange={e => setEditingRule({...editingRule, currency: e.target.value})} placeholder="AUD" data-testid="input-edit-currency" />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Basis</Label>
                  <SearchableSelect
                    value={editingRule.basis}
                    onValueChange={v => setEditingRule({...editingRule, basis: v})}
                    options={basisOptions.length > 0 ? basisOptions : [{ value: "per_subject", label: "Per Subject" }]}
                    placeholder="Select basis"
                    searchPlaceholder="Search..."
                  />
                </div>
                <div>
                  <Label>Pay Event</Label>
                  <SearchableSelect
                    value={editingRule.payEvent}
                    onValueChange={v => setEditingRule({...editingRule, payEvent: v})}
                    options={payEventOptions.length > 0 ? payEventOptions : [{ value: "enrolment", label: "Enrolment" }]}
                    placeholder="Select pay event"
                    searchPlaceholder="Search..."
                  />
                </div>
              </div>
              <div>
                <Label>Conditions</Label>
                <Textarea value={editingRule.conditionsText} onChange={e => setEditingRule({...editingRule, conditionsText: e.target.value})} placeholder="Clawback conditions, withdrawal rules..." data-testid="input-edit-conditions" />
              </div>
              <FollowUpSection
                state={editingRule}
                setState={setEditingRule}
                studyLevelOptions={baseStudyLevelOptions}
                modeOptions={modeOptions}
              />
              <div className="flex items-center gap-2">
                <Switch
                  checked={editingRule.isActive}
                  onCheckedChange={v => setEditingRule({...editingRule, isActive: v})}
                  data-testid="switch-edit-active"
                />
                <Label>Active</Label>
              </div>
              <Button type="submit" className="w-full" disabled={editMutation.isPending} data-testid="button-submit-edit-commission">
                {editMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
