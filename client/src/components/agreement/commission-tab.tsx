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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, DollarSign, Percent, Trash2 } from "lucide-react";
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

  const defaultForm = {
    label: "",
    studyLevel: "Any",
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
                    <SearchableSelect
                      value={form.studyLevel}
                      onValueChange={v => setForm({...form, studyLevel: v})}
                      options={STUDY_LEVELS.map(l => ({ value: l, label: l }))}
                      placeholder="Select level"
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
    </div>
  );
}
