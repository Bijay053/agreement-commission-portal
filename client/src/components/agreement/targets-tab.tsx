import { useState } from "react";
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Target, Trash2 } from "lucide-react";
import { TARGET_TYPES, TARGET_METRICS } from "@shared/schema";

const metricLabels: Record<string, string> = {
  applications: "Applications Submitted",
  enrolments: "Enrolments",
  starts: "Student Starts",
  revenue: "Revenue",
};

const typeLabels: Record<string, string> = {
  monthly: "Monthly",
  intake: "Intake-based",
  yearly: "Yearly",
};

export default function TargetsTab({ agreementId }: { agreementId: number }) {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canManage = hasPermission("targets.manage");
  const [showDialog, setShowDialog] = useState(false);

  const { data: targets, isLoading } = useQuery<any[]>({
    queryKey: ["/api/agreements", agreementId, "targets"],
    queryFn: async () => {
      const res = await fetch(`/api/agreements/${agreementId}/targets`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

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

  const [form, setForm] = useState({
    targetType: "yearly",
    metric: "enrolments",
    value: "",
    periodKey: "",
    currency: "",
    notes: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      ...form,
      currency: form.metric === "revenue" ? form.currency || "AUD" : null,
    });
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
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Target</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Target Type</Label>
                    <Select value={form.targetType} onValueChange={v => setForm({...form, targetType: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TARGET_TYPES.map(t => <SelectItem key={t} value={t}>{typeLabels[t]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Metric</Label>
                    <Select value={form.metric} onValueChange={v => setForm({...form, metric: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
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
                    <Input value={form.periodKey} onChange={e => setForm({...form, periodKey: e.target.value})} placeholder="2026, T1-2026, 2026-07" required data-testid="input-period-key" />
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
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">{typeLabels[target.targetType]}</Badge>
                      <Badge variant="secondary">{target.periodKey}</Badge>
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
                  </div>
                  {canManage && (
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(target.id)} data-testid={`button-delete-target-${target.id}`}>
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
            <Target className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">No targets configured</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
