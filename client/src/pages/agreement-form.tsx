import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Save, Plus, X, Globe } from "lucide-react";
import { AGREEMENT_TYPES, AGREEMENT_STATUSES, PROVIDER_TYPES } from "@shared/schema";

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

const providerTypeLabels: Record<string, string> = {
  university: "University",
  college: "College",
  b2b_company: "B2B Company",
  other: "Other",
};

export default function AgreementFormPage() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = params.id && params.id !== "new";
  const agreementId = isEdit ? parseInt(params.id!) : null;

  const { data: countries } = useQuery<any[]>({ queryKey: ["/api/countries"] });
  const { data: providers } = useQuery<any[]>({ queryKey: ["/api/universities"] });

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
    territoryType: "country_specific",
    territoryCountryIds: [] as number[],
    startDate: "",
    expiryDate: "",
    autoRenew: false,
    internalNotes: "",
  });

  const [showProviderModal, setShowProviderModal] = useState(false);
  const [providerForm, setProviderForm] = useState({
    name: "",
    providerType: "university",
    countryId: "",
    website: "",
    notes: "",
  });
  const [providerSearch, setProviderSearch] = useState("");

  useEffect(() => {
    if (existingAgreement) {
      setForm({
        universityId: String(existingAgreement.universityId),
        agreementCode: existingAgreement.agreementCode,
        title: existingAgreement.title,
        agreementType: existingAgreement.agreementType,
        status: existingAgreement.status,
        territoryType: existingAgreement.territoryType || "country_specific",
        territoryCountryIds: existingAgreement.territories?.map((t: any) => t.id) || [],
        startDate: existingAgreement.startDate,
        expiryDate: existingAgreement.expiryDate,
        autoRenew: existingAgreement.autoRenew || false,
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

  const providerMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/providers", data);
      return res.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/universities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/providers"] });
      setForm({ ...form, universityId: String(result.id) });
      setShowProviderModal(false);
      setProviderForm({ name: "", providerType: "university", countryId: "", website: "", notes: "" });
      toast({ title: "Provider added" });
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
      territoryCountryIds: form.territoryType === "global" ? [] : form.territoryCountryIds,
    });
  };

  const handleProviderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    providerMutation.mutate({
      ...providerForm,
      countryId: providerForm.countryId ? parseInt(providerForm.countryId) : null,
    });
  };

  const toggleTerritoryCountry = (id: number) => {
    setForm(prev => ({
      ...prev,
      territoryCountryIds: prev.territoryCountryIds.includes(id)
        ? prev.territoryCountryIds.filter(c => c !== id)
        : [...prev.territoryCountryIds, id],
    }));
  };

  const filteredProviders = providers?.filter(p =>
    !providerSearch || p.name.toLowerCase().includes(providerSearch.toLowerCase())
  );

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
                <Label>Provider</Label>
                <div className="space-y-2">
                  <Input
                    placeholder="Search providers..."
                    value={providerSearch}
                    onChange={e => setProviderSearch(e.target.value)}
                    className="mb-1"
                    data-testid="input-provider-search"
                  />
                  <Select value={form.universityId} onValueChange={v => {
                    if (v === "__add_new__") {
                      setShowProviderModal(true);
                    } else {
                      setForm({...form, universityId: v});
                    }
                  }}>
                    <SelectTrigger data-testid="select-provider"><SelectValue placeholder="Select provider" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__add_new__">
                        <span className="flex items-center gap-1 text-primary">
                          <Plus className="w-3.5 h-3.5" /> Add new provider
                        </span>
                      </SelectItem>
                      {filteredProviders?.map((p: any) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name}{p.countryName ? ` — ${p.countryName}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            </div>

            <div>
              <Label>Territory</Label>
              <div className="space-y-3">
                <Select value={form.territoryType} onValueChange={v => setForm({...form, territoryType: v})}>
                  <SelectTrigger data-testid="select-territory-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global (All Countries)</SelectItem>
                    <SelectItem value="country_specific">Country-Specific</SelectItem>
                  </SelectContent>
                </Select>
                {form.territoryType === "country_specific" && (
                  <div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {form.territoryCountryIds.map(id => {
                        const country = countries?.find((c: any) => c.id === id);
                        return country ? (
                          <Badge key={id} variant="secondary" className="gap-1">
                            {country.name}
                            <button type="button" onClick={() => toggleTerritoryCountry(id)}>
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        ) : null;
                      })}
                    </div>
                    <Select onValueChange={v => toggleTerritoryCountry(parseInt(v))}>
                      <SelectTrigger data-testid="select-territory-countries"><SelectValue placeholder="Add territory country..." /></SelectTrigger>
                      <SelectContent>
                        {countries?.filter((c: any) => !form.territoryCountryIds.includes(c.id)).map((c: any) => (
                          <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
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

            <div className="flex items-center gap-3">
              <Switch checked={form.autoRenew} onCheckedChange={v => setForm({...form, autoRenew: v})} data-testid="switch-auto-renew" />
              <Label>Auto Renew</Label>
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

      <Dialog open={showProviderModal} onOpenChange={setShowProviderModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Provider</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleProviderSubmit} className="space-y-4">
            <div>
              <Label>Provider Name</Label>
              <Input value={providerForm.name} onChange={e => setProviderForm({...providerForm, name: e.target.value})} placeholder="University of..." required data-testid="input-provider-name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Provider Type</Label>
                <Select value={providerForm.providerType} onValueChange={v => setProviderForm({...providerForm, providerType: v})}>
                  <SelectTrigger data-testid="select-provider-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROVIDER_TYPES.map(t => (
                      <SelectItem key={t} value={t}>{providerTypeLabels[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Country</Label>
                <Select value={providerForm.countryId} onValueChange={v => setProviderForm({...providerForm, countryId: v})}>
                  <SelectTrigger data-testid="select-provider-country"><SelectValue placeholder="Select country" /></SelectTrigger>
                  <SelectContent>
                    {countries?.map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Website</Label>
              <Input value={providerForm.website} onChange={e => setProviderForm({...providerForm, website: e.target.value})} placeholder="https://..." data-testid="input-provider-website" />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={providerForm.notes} onChange={e => setProviderForm({...providerForm, notes: e.target.value})} placeholder="Additional notes..." />
            </div>
            <Button type="submit" className="w-full" disabled={providerMutation.isPending} data-testid="button-submit-provider">
              {providerMutation.isPending ? "Adding..." : "Add Provider"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
