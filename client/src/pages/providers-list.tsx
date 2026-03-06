import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Search, Plus, Building2, MapPin, Globe2, Filter, Edit, Eye,
} from "lucide-react";
import { PROVIDER_TYPES, PROVIDER_STATUSES } from "@shared/schema";

const providerTypeLabels: Record<string, string> = {
  university: "University",
  college: "College",
  b2b_company: "B2B Company",
  other: "Other",
};

export default function ProvidersListPage() {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canManage = hasPermission("agreement.create");

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [viewingProvider, setViewingProvider] = useState<any>(null);

  const queryParams = new URLSearchParams();
  if (search) queryParams.set("search", search);
  if (typeFilter !== "all") queryParams.set("providerType", typeFilter);
  if (statusFilter !== "all") queryParams.set("status", statusFilter);
  if (countryFilter !== "all") queryParams.set("countryId", countryFilter);
  const queryString = queryParams.toString();

  const { data: providers, isLoading } = useQuery<any[]>({
    queryKey: ["/api/providers", queryString],
    queryFn: async () => {
      const res = await fetch(`/api/providers?${queryString}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: countries } = useQuery<any[]>({ queryKey: ["/api/countries"] });

  const defaultForm = {
    name: "",
    providerType: "university",
    countryId: "",
    website: "",
    notes: "",
    status: "active",
  };
  const [form, setForm] = useState({ ...defaultForm });

  const openCreate = () => {
    setForm({ ...defaultForm });
    setEditingId(null);
    setShowDialog(true);
  };

  const openEdit = (provider: any) => {
    setForm({
      name: provider.name,
      providerType: provider.providerType,
      countryId: provider.countryId ? String(provider.countryId) : "",
      website: provider.website || "",
      notes: provider.notes || "",
      status: provider.status,
    });
    setEditingId(provider.id);
    setShowDialog(true);
  };

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingId) {
        const res = await apiRequest("PATCH", `/api/providers/${editingId}`, data);
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/providers", data);
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/providers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/universities"] });
      setShowDialog(false);
      toast({ title: editingId ? "Provider updated" : "Provider added" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({
      ...form,
      countryId: form.countryId ? parseInt(form.countryId) : null,
    });
  };

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-providers-title">Providers</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage universities, colleges, and B2B partners</p>
        </div>
        {canManage && (
          <Button onClick={openCreate} data-testid="button-create-provider">
            <Plus className="w-4 h-4 mr-2" />
            Add Provider
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search providers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                data-testid="input-search-providers"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]" data-testid="select-type-filter">
                <Filter className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {PROVIDER_TYPES.map(t => (
                  <SelectItem key={t} value={t}>{providerTypeLabels[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {PROVIDER_STATUSES.map(s => (
                  <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={countryFilter} onValueChange={setCountryFilter}>
              <SelectTrigger className="w-[160px]" data-testid="select-country-filter">
                <MapPin className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Countries</SelectItem>
                {countries?.map((c: any) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-16" /></CardContent></Card>
          ))}
        </div>
      ) : providers && providers.length > 0 ? (
        <div className="space-y-2">
          {providers.map((provider: any) => (
            <Card key={provider.id} data-testid={`card-provider-${provider.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-medium">{provider.name}</h3>
                      <Badge variant="outline">{providerTypeLabels[provider.providerType] || provider.providerType}</Badge>
                      <Badge variant={provider.status === "active" ? "default" : "secondary"}>
                        {provider.status === "active" ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-1.5 text-sm text-muted-foreground">
                      {provider.countryName && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" /> {provider.countryName}
                        </span>
                      )}
                      {provider.website && (
                        <span className="flex items-center gap-1">
                          <Globe2 className="w-3.5 h-3.5" /> {provider.website}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setViewingProvider(provider)}
                      data-testid={`button-view-provider-${provider.id}`}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    {canManage && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(provider)}
                        data-testid={`button-edit-provider-${provider.id}`}
                      >
                        <Edit className="w-4 h-4" />
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
          <CardContent className="py-16 text-center">
            <Building2 className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
            <h3 className="text-lg font-medium">No providers found</h3>
            <p className="text-sm text-muted-foreground mt-1">Add your first provider to get started</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Provider" : "Add Provider"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Provider Name</Label>
              <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="University of..." required data-testid="input-provider-name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Provider Type</Label>
                <Select value={form.providerType} onValueChange={v => setForm({...form, providerType: v})}>
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
                <Select value={form.countryId} onValueChange={v => setForm({...form, countryId: v})}>
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
              <Input value={form.website} onChange={e => setForm({...form, website: e.target.value})} placeholder="https://..." data-testid="input-provider-website" />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm({...form, status: v})}>
                <SelectTrigger data-testid="select-provider-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROVIDER_STATUSES.map(s => (
                    <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Additional notes..." />
            </div>
            <Button type="submit" className="w-full" disabled={saveMutation.isPending} data-testid="button-submit-provider">
              {saveMutation.isPending ? "Saving..." : editingId ? "Update Provider" : "Add Provider"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingProvider} onOpenChange={() => setViewingProvider(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Provider Details</DialogTitle>
          </DialogHeader>
          {viewingProvider && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Name</p>
                  <p className="text-sm font-medium">{viewingProvider.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Type</p>
                  <p className="text-sm">{providerTypeLabels[viewingProvider.providerType]}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Country</p>
                  <p className="text-sm">{viewingProvider.countryName || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant={viewingProvider.status === "active" ? "default" : "secondary"}>
                    {viewingProvider.status === "active" ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Website</p>
                  <p className="text-sm">{viewingProvider.website || "—"}</p>
                </div>
              </div>
              {viewingProvider.notes && (
                <div>
                  <p className="text-xs text-muted-foreground">Notes</p>
                  <p className="text-sm whitespace-pre-wrap">{viewingProvider.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
