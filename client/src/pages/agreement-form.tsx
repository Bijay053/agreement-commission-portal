import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save } from "lucide-react";
import { AGREEMENT_TYPES, AGREEMENT_STATUSES, CONFIDENTIALITY_LEVELS } from "@shared/schema";

const typeLabels: Record<string, string> = {
  agency: "Agency Agreement",
  commission_schedule: "Commission Schedule",
  addendum: "Addendum",
  renewal: "Renewal",
  mou: "MOU",
  other: "Other",
};

const statusLabels: Record<string, string> = {
  draft: "Draft",
  active: "Active",
  expired: "Expired",
  terminated: "Terminated",
  renewal_in_progress: "Renewal in Progress",
};

export default function AgreementFormPage() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = params.id && params.id !== "new";
  const agreementId = isEdit ? parseInt(params.id!) : null;

  const { data: countries } = useQuery<any[]>({ queryKey: ["/api/countries"] });
  const { data: universities } = useQuery<any[]>({ queryKey: ["/api/universities"] });

  const { data: existingAgreement, isLoading: loadingExisting } = useQuery<any>({
    queryKey: ["/api/agreements", agreementId],
    queryFn: async () => {
      if (!agreementId) return null;
      const res = await fetch(`/api/agreements/${agreementId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!agreementId,
  });

  const [form, setForm] = useState({
    universityId: "",
    agreementCode: "",
    title: "",
    agreementType: "agency",
    status: "draft",
    territoryCountryId: "",
    startDate: "",
    expiryDate: "",
    autoRenew: false,
    confidentialityLevel: "high",
    internalNotes: "",
  });

  useEffect(() => {
    if (existingAgreement) {
      setForm({
        universityId: String(existingAgreement.universityId),
        agreementCode: existingAgreement.agreementCode,
        title: existingAgreement.title,
        agreementType: existingAgreement.agreementType,
        status: existingAgreement.status,
        territoryCountryId: String(existingAgreement.territoryCountryId),
        startDate: existingAgreement.startDate,
        expiryDate: existingAgreement.expiryDate,
        autoRenew: existingAgreement.autoRenew || false,
        confidentialityLevel: existingAgreement.confidentialityLevel,
        internalNotes: existingAgreement.internalNotes || "",
      });
    }
  }, [existingAgreement]);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (isEdit) {
        const res = await apiRequest("PATCH", `/api/agreements/${agreementId}`, data);
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/agreements", data);
        return res.json();
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agreements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: isEdit ? "Agreement updated" : "Agreement created" });
      navigate(`/agreements/${result.id}`);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      ...form,
      universityId: parseInt(form.universityId),
      territoryCountryId: parseInt(form.territoryCountryId),
    });
  };

  if (isEdit && loadingExisting) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(isEdit ? `/agreements/${agreementId}` : "/agreements")}
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-xl font-semibold" data-testid="text-form-title">
          {isEdit ? "Edit Agreement" : "Create New Agreement"}
        </h1>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardContent className="p-5 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>University</Label>
                <Select value={form.universityId} onValueChange={v => setForm({...form, universityId: v})}>
                  <SelectTrigger data-testid="select-university"><SelectValue placeholder="Select university" /></SelectTrigger>
                  <SelectContent>
                    {universities?.map((u: any) => (
                      <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Agreement Code</Label>
                <Input value={form.agreementCode} onChange={e => setForm({...form, agreementCode: e.target.value})} placeholder="UON-2026-BD-AGT-01" required data-testid="input-agreement-code" />
              </div>
            </div>

            <div>
              <Label>Title</Label>
              <Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="2026 Agency Agreement - Bangladesh" required data-testid="input-title" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Type</Label>
                <Select value={form.agreementType} onValueChange={v => setForm({...form, agreementType: v})}>
                  <SelectTrigger data-testid="select-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AGREEMENT_TYPES.map(t => (
                      <SelectItem key={t} value={t}>{typeLabels[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({...form, status: v})}>
                  <SelectTrigger data-testid="select-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AGREEMENT_STATUSES.map(s => (
                      <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Territory Country</Label>
                <Select value={form.territoryCountryId} onValueChange={v => setForm({...form, territoryCountryId: v})}>
                  <SelectTrigger data-testid="select-territory"><SelectValue placeholder="Select country" /></SelectTrigger>
                  <SelectContent>
                    {countries?.map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Start Date</Label>
                <Input type="date" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} required data-testid="input-start-date" />
              </div>
              <div>
                <Label>Expiry Date</Label>
                <Input type="date" value={form.expiryDate} onChange={e => setForm({...form, expiryDate: e.target.value})} required data-testid="input-expiry-date" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Confidentiality Level</Label>
                <Select value={form.confidentialityLevel} onValueChange={v => setForm({...form, confidentialityLevel: v})}>
                  <SelectTrigger data-testid="select-confidentiality"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONFIDENTIALITY_LEVELS.map(l => (
                      <SelectItem key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-3 pb-1">
                <Switch checked={form.autoRenew} onCheckedChange={v => setForm({...form, autoRenew: v})} data-testid="switch-auto-renew" />
                <Label>Auto Renew</Label>
              </div>
            </div>

            <div>
              <Label>Internal Notes (Sensitive)</Label>
              <Textarea value={form.internalNotes} onChange={e => setForm({...form, internalNotes: e.target.value})} placeholder="Internal remarks, visible only to authorized users..." rows={3} data-testid="input-internal-notes" />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(isEdit ? `/agreements/${agreementId}` : "/agreements")}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending} data-testid="button-save-agreement">
                <Save className="w-4 h-4 mr-2" />
                {mutation.isPending ? "Saving..." : isEdit ? "Update Agreement" : "Create Agreement"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
