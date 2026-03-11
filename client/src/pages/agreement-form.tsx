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
import { SearchableSelect } from "@/components/ui/searchable-select";
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
    status: "active",
    notes: "",
  });

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
      setProviderForm({ name: "", providerType: "university", countryId: "", website: "", status: "active", notes: "" });
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
    if (!providerForm.name.trim() || !providerForm.providerType || !providerForm.countryId || !providerForm.website.trim()) return;
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


  if (isEdit && loadingExisting) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const providerOptions = [
    { value: "__add_new__", label: "+ Add new provider" },
    ...(providers?.map((p: any) => ({
      value: String(p.id),
      label: `${p.name}${p.countryName ? ` — ${p.countryName}` : ""}`,
    })) || []),
  ];

  const typeOptions = AGREEMENT_TYPES.map(t => ({ value: t, label: typeLabels[t] }));
  const statusOptions = AGREEMENT_STATUSES.map(s => ({ value: s, label: statusLabels[s] }));

  const territoryTypeOptions = [
    { value: "global", label: "Global (All Countries)" },
    { value: "country_specific", label: "Country-Specific" },
  ];

  const territoryCountryOptions = countries
    ?.filter((c: any) => !form.territoryCountryIds.includes(c.id))
    .map((c: any) => ({ value: String(c.id), label: c.name })) || [];

  const providerTypeOptions = PROVIDER_TYPES.map(t => ({ value: t, label: providerTypeLabels[t] }));
  const countryOptions = countries?.map((c: any) => ({ value: String(c.id), label: c.name })) || [];

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
                <Label>Provider <span className="text-red-500">*</span></Label>
                <div className="space-y-2">
                  <SearchableSelect
                    value={form.universityId}
                    onValueChange={v => {
                      if (v === "__add_new__") {
                        setShowProviderModal(true);
                      } else {
                        setForm({...form, universityId: v});
                      }
                    }}
                    options={providerOptions}
                    placeholder="Select provider"
                    searchPlaceholder="Search providers..."
                    data-testid="select-provider"
                  />
                </div>
              </div>
              <div>
                <Label>Agreement Code <span className="text-red-500">*</span></Label>
                <Input value={form.agreementCode} onChange={e => setForm({...form, agreementCode: e.target.value})} placeholder="UON-2026-BD-AGT-01" required data-testid="input-agreement-code" />
              </div>
            </div>

            <div>
              <Label>Title <span className="text-red-500">*</span></Label>
              <Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="2026 Agency Agreement - Bangladesh" required data-testid="input-title" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Type <span className="text-red-500">*</span></Label>
                <SearchableSelect
                  value={form.agreementType}
                  onValueChange={v => setForm({...form, agreementType: v})}
                  options={typeOptions}
                  placeholder="Select type"
                  searchPlaceholder="Search types..."
                  data-testid="select-type"
                />
              </div>
              <div>
                <Label>Status <span className="text-red-500">*</span></Label>
                <SearchableSelect
                  value={form.status}
                  onValueChange={v => setForm({...form, status: v})}
                  options={statusOptions}
                  placeholder="Select status"
                  searchPlaceholder="Search statuses..."
                  data-testid="select-status"
                />
              </div>
            </div>

            <div>
              <Label>Territory</Label>
              <div className="space-y-3">
                <SearchableSelect
                  value={form.territoryType}
                  onValueChange={v => setForm({...form, territoryType: v})}
                  options={territoryTypeOptions}
                  placeholder="Select territory type"
                  searchPlaceholder="Search..."
                  data-testid="select-territory-type"
                />
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
                    <SearchableSelect
                      value=""
                      onValueChange={v => toggleTerritoryCountry(parseInt(v))}
                      options={territoryCountryOptions}
                      placeholder="Add territory country..."
                      searchPlaceholder="Search countries..."
                      data-testid="select-territory-countries"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Start Date <span className="text-red-500">*</span></Label>
                <Input type="date" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} required data-testid="input-start-date" />
              </div>
              <div>
                <Label>Expiry Date <span className="text-red-500">*</span></Label>
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

      <Dialog open={showProviderModal} onOpenChange={(open) => { if (open) setProviderForm({ name: "", providerType: "university", countryId: "", website: "", status: "active", notes: "" }); setShowProviderModal(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Provider</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleProviderSubmit} className="space-y-4">
            <div>
              <Label>Provider Name <span className="text-red-500">*</span></Label>
              <Input value={providerForm.name} onChange={e => setProviderForm({...providerForm, name: e.target.value})} placeholder="University of..." required data-testid="input-provider-name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Provider Type <span className="text-red-500">*</span></Label>
                <SearchableSelect
                  value={providerForm.providerType}
                  onValueChange={v => setProviderForm({...providerForm, providerType: v})}
                  options={providerTypeOptions}
                  placeholder="Select type"
                  searchPlaceholder="Search types..."
                  data-testid="select-provider-type"
                />
              </div>
              <div>
                <Label>Country <span className="text-red-500">*</span></Label>
                <SearchableSelect
                  value={providerForm.countryId}
                  onValueChange={v => setProviderForm({...providerForm, countryId: v})}
                  options={countryOptions}
                  placeholder="Select country"
                  searchPlaceholder="Search countries..."
                  data-testid="select-provider-country"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Website <span className="text-red-500">*</span></Label>
                <Input value={providerForm.website} onChange={e => setProviderForm({...providerForm, website: e.target.value})} placeholder="https://..." required data-testid="input-provider-website" />
              </div>
              <div>
                <Label>Status <span className="text-red-500">*</span></Label>
                <SearchableSelect
                  value={providerForm.status}
                  onValueChange={v => setProviderForm({...providerForm, status: v})}
                  options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]}
                  placeholder="Select status"
                  searchPlaceholder="Search..."
                  data-testid="select-provider-status"
                />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={providerForm.notes} onChange={e => setProviderForm({...providerForm, notes: e.target.value})} placeholder="Additional notes..." />
            </div>
            <Button type="submit" className="w-full" disabled={providerMutation.isPending || !providerForm.countryId || !providerForm.providerType} data-testid="button-submit-provider">
              {providerMutation.isPending ? "Adding..." : "Add Provider"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
