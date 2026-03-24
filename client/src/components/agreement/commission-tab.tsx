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
import { Plus, DollarSign, Percent, Trash2, Pencil } from "lucide-react";
import { COMMISSION_MODES, COMMISSION_BASIS, PAY_EVENTS, STUDY_LEVELS } from "@shared/schema";

const basisLabels: Record<string, string> = {
  per_subject: "Per Subject",
  per_term: "Per Term",
  first_year: "First Year",
  full_course: "Full Course",
  per_intake: "Per Intake",
};

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

  const baseStudyLevelOptions = STUDY_LEVELS.filter(l => l !== "Any").map(l => ({ value: l, label: l }));

  const defaultForm = {
    label: "",
    studyLevel: [] as string[],
    commissionMode: "percentage",
    percentageValue: "",
    flatAmount: "",
    currency: "AUD",
    basis: "per_subject",
    payEvent: "enrolment",
    conditionsText: "",
  };
  const [form, setForm] = useState(defaultForm);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      ...form,
      studyLevel: form.studyLevel.length === 0 ? "Any" : form.studyLevel.join(", "),
      percentageValue: form.commissionMode === "percentage" ? form.percentageValue : null,
      flatAmount: form.commissionMode === "flat" ? form.flatAmount : null,
      currency: form.commissionMode === "flat" ? form.currency : null,
    });
  };

  if (isLoading) return <div className="space-y-3">{Array.from({length: 2}).map((_,i) => <Skeleton key={i} className="h-24" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium">Commission Rules</h3>
        {canCreate && (
          <Dialog open={showDialog} onOpenChange={(open) => { if (open) setForm(defaultForm); setShowDialog(open); }}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-commission">
                <Plus className="w-4 h-4 mr-1" /> Add Rule
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
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
                      options={[
                        { value: "percentage", label: "Percentage" },
                        { value: "flat", label: "Flat Amount" },
                      ]}
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
                      options={COMMISSION_BASIS.map(b => ({ value: b, label: basisLabels[b] }))}
                      placeholder="Select basis"
                      searchPlaceholder="Search..."
                    />
                  </div>
                  <div>
                    <Label>Pay Event</Label>
                    <SearchableSelect
                      value={form.payEvent}
                      onValueChange={v => setForm({...form, payEvent: v})}
                      options={PAY_EVENTS.map(p => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }))}
                      placeholder="Select pay event"
                      searchPlaceholder="Search..."
                    />
                  </div>
                </div>
                <div>
                  <Label>Conditions</Label>
                  <Textarea value={form.conditionsText} onChange={e => setForm({...form, conditionsText: e.target.value})} placeholder="Clawback conditions, withdrawal rules..." data-testid="input-conditions" />
                </div>
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Commission Rule</DialogTitle>
          </DialogHeader>
          {editingRule && (
            <form onSubmit={(e) => {
              e.preventDefault();
              const { id, ...data } = editingRule;
              editMutation.mutate({
                id,
                data: {
                  ...data,
                  studyLevel: data.studyLevel.length === 0 ? "Any" : data.studyLevel.join(", "),
                  percentageValue: data.commissionMode === "percentage" ? data.percentageValue : null,
                  flatAmount: data.commissionMode === "flat" ? data.flatAmount : null,
                  currency: data.commissionMode === "flat" ? data.currency : null,
                },
              });
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
                    options={[
                      { value: "percentage", label: "Percentage" },
                      { value: "flat", label: "Flat Amount" },
                    ]}
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
                    options={COMMISSION_BASIS.map(b => ({ value: b, label: basisLabels[b] }))}
                    placeholder="Select basis"
                    searchPlaceholder="Search..."
                  />
                </div>
                <div>
                  <Label>Pay Event</Label>
                  <SearchableSelect
                    value={editingRule.payEvent}
                    onValueChange={v => setEditingRule({...editingRule, payEvent: v})}
                    options={PAY_EVENTS.map(p => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }))}
                    placeholder="Select pay event"
                    searchPlaceholder="Search..."
                  />
                </div>
              </div>
              <div>
                <Label>Conditions</Label>
                <Textarea value={editingRule.conditionsText} onChange={e => setEditingRule({...editingRule, conditionsText: e.target.value})} placeholder="Clawback conditions, withdrawal rules..." data-testid="input-edit-conditions" />
              </div>
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
