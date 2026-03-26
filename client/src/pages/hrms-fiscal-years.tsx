import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, CalendarDays, Star, Info } from "lucide-react";

interface FiscalYear {
  id: string;
  organization_id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
}

interface Organization {
  id: string;
  name: string;
  country: string | null;
}

const COUNTRY_FY_HINTS: Record<string, { label: string; hint: string }> = {
  "Nepal": { label: "Nepali Fiscal Year (Shrawan–Ashadh)", hint: "Mid-July to mid-July (e.g., 2082/83 → Jul 16 2025 – Jul 15 2026)" },
  "Australia": { label: "Australian Financial Year", hint: "July 1 to June 30 (e.g., FY 2025-26 → Jul 1 2025 – Jun 30 2026)" },
  "India": { label: "Indian Financial Year", hint: "April 1 to March 31 (e.g., FY 2025-26 → Apr 1 2025 – Mar 31 2026)" },
  "United Kingdom": { label: "UK Tax Year", hint: "April 6 to April 5 (e.g., 2025/26 → Apr 6 2025 – Apr 5 2026)" },
  "United States": { label: "US Federal Fiscal Year", hint: "October 1 to September 30 (or calendar year Jan–Dec)" },
  "Canada": { label: "Canadian Fiscal Year", hint: "April 1 to March 31 (federal) or calendar year" },
  "New Zealand": { label: "NZ Financial Year", hint: "April 1 to March 31" },
  "Bangladesh": { label: "Bangladesh Fiscal Year", hint: "July 1 to June 30" },
  "Pakistan": { label: "Pakistan Fiscal Year", hint: "July 1 to June 30" },
  "Japan": { label: "Japanese Fiscal Year", hint: "April 1 to March 31" },
  "Kenya": { label: "Kenyan Fiscal Year", hint: "July 1 to June 30" },
  "UAE": { label: "UAE Calendar Year", hint: "January 1 to December 31" },
  "Saudi Arabia": { label: "Saudi Fiscal Year", hint: "January 1 to December 31 (Gregorian)" },
  "Singapore": { label: "Singapore Year of Assessment", hint: "January 1 to December 31 (calendar year)" },
  "Malaysia": { label: "Malaysian Year of Assessment", hint: "January 1 to December 31 (calendar year)" },
  "South Korea": { label: "Korean Fiscal Year", hint: "January 1 to December 31" },
  "Germany": { label: "German Fiscal Year", hint: "January 1 to December 31 (calendar year)" },
  "France": { label: "French Fiscal Year", hint: "January 1 to December 31 (calendar year)" },
  "China": { label: "Chinese Fiscal Year", hint: "January 1 to December 31 (calendar year)" },
  "Philippines": { label: "Philippine Fiscal Year", hint: "January 1 to December 31 (calendar year)" },
  "Sri Lanka": { label: "Sri Lankan Year of Assessment", hint: "April 1 to March 31" },
  "Qatar": { label: "Qatar Fiscal Year", hint: "January 1 to December 31 (calendar year)" },
};

function extractErrorMessage(err: any, fallback: string): string {
  try {
    const text = err?.message || "";
    const jsonPart = text.includes("{") ? text.substring(text.indexOf("{")) : "";
    if (jsonPart) {
      const parsed = JSON.parse(jsonPart);
      return parsed.message || parsed.error || fallback;
    }
    const colonIdx = text.indexOf(": ");
    if (colonIdx > 0) return text.substring(colonIdx + 2) || fallback;
    return text || fallback;
  } catch {
    return fallback;
  }
}

export function FiscalYearsTab() {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const canWrite = hasPermission("hrms.fiscal_year.add");
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("__all__");
  const [form, setForm] = useState({
    organization_id: "",
    name: "",
    start_date: "",
    end_date: "",
    is_current: false,
  });

  const { data: fiscalYears, isLoading } = useQuery<FiscalYear[]>({ queryKey: ["/api/hrms/fiscal-years"] });
  const { data: orgs } = useQuery<Organization[]>({ queryKey: ["/api/hrms/organizations"] });

  const filtered = (fiscalYears || []).filter(fy =>
    selectedOrgId === "__all__" || fy.organization_id === selectedOrgId
  );

  const getOrgName = (orgId: string) => orgs?.find(o => o.id === orgId)?.name || "Unknown";
  const getOrgCountry = (orgId: string) => orgs?.find(o => o.id === orgId)?.country || null;

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/hrms/fiscal-years", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hrms/fiscal-years"] });
      setShowDialog(false);
      toast({ title: "Fiscal year created" });
    },
    onError: (err: any) => toast({ title: extractErrorMessage(err, "Failed to create fiscal year"), variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PUT", `/api/hrms/fiscal-years/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hrms/fiscal-years"] });
      setShowDialog(false);
      toast({ title: "Fiscal year updated" });
    },
    onError: (err: any) => toast({ title: extractErrorMessage(err, "Failed to update fiscal year"), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/hrms/fiscal-years/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hrms/fiscal-years"] });
      toast({ title: "Fiscal year deleted" });
    },
    onError: (err: any) => toast({ title: extractErrorMessage(err, "Failed to delete fiscal year"), variant: "destructive" }),
  });

  const openAdd = () => {
    const firstOrg = selectedOrgId !== "__all__" ? selectedOrgId : orgs?.[0]?.id || "";
    setEditingId(null);
    setForm({ organization_id: firstOrg, name: "", start_date: "", end_date: "", is_current: false });
    setShowDialog(true);
  };

  const openEdit = (fy: FiscalYear) => {
    setEditingId(fy.id);
    setForm({
      organization_id: fy.organization_id,
      name: fy.name,
      start_date: fy.start_date || "",
      end_date: fy.end_date || "",
      is_current: fy.is_current,
    });
    setShowDialog(true);
  };

  const handleSave = () => {
    if (!form.organization_id || !form.name.trim() || !form.start_date || !form.end_date) {
      toast({ title: "All fields are required", variant: "destructive" });
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const countryHint = getOrgCountry(form.organization_id);
  const fyHint = countryHint ? COUNTRY_FY_HINTS[countryHint] : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Fiscal Year Configuration</h2>
          <p className="text-sm text-muted-foreground">
            Set up fiscal years per organization to match each country's local calendar. Payroll, tax calculations, leave balances, and holidays reference the active fiscal year.
          </p>
        </div>
        {canWrite && (
          <Button size="sm" onClick={openAdd} data-testid="btn-add-fiscal-year">
            <Plus className="h-3 w-3 mr-1" /> Add Fiscal Year
          </Button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm font-medium">Organization</Label>
        <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
          <SelectTrigger className="w-[260px]" data-testid="select-fy-org-filter">
            <SelectValue placeholder="All Organizations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Organizations</SelectItem>
            {(orgs || []).map(o => (
              <SelectItem key={o.id} value={o.id}>
                {o.name} {o.country ? `(${o.country})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Fiscal Year Name</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Status</TableHead>
                {canWrite && <TableHead className="w-24 text-center">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={canWrite ? 6 : 5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : !filtered.length ? (
                <TableRow><TableCell colSpan={canWrite ? 6 : 5} className="text-center py-8 text-muted-foreground">
                  No fiscal years configured. Add one to get started.
                </TableCell></TableRow>
              ) : (
                filtered.map(fy => {
                  const orgCountry = getOrgCountry(fy.organization_id);
                  return (
                    <TableRow key={fy.id} data-testid={`row-fy-${fy.id}`}>
                      <TableCell>
                        <div>
                          <span className="font-medium">{getOrgName(fy.organization_id)}</span>
                          {orgCountry && <span className="text-xs text-muted-foreground ml-2">({orgCountry})</span>}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{fy.name}</TableCell>
                      <TableCell className="text-sm">{fy.start_date || "—"}</TableCell>
                      <TableCell className="text-sm">{fy.end_date || "—"}</TableCell>
                      <TableCell>
                        {fy.is_current ? (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            <Star className="h-3 w-3 mr-1" /> Current
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">Past / Future</Badge>
                        )}
                      </TableCell>
                      {canWrite && (
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(fy)} data-testid={`btn-edit-fy-${fy.id}`}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { if (confirm(`Delete fiscal year "${fy.name}"?`)) deleteMutation.mutate(fy.id); }} data-testid={`btn-delete-fy-${fy.id}`}>
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="bg-muted/50">
        <CardHeader className="p-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="h-4 w-4" /> Country Fiscal Year Reference
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
            {Object.entries(COUNTRY_FY_HINTS).slice(0, 12).map(([country, info]) => (
              <div key={country} className="flex flex-col">
                <span className="font-medium">{country}</span>
                <span className="text-muted-foreground">{info.hint}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Fiscal Year" : "Add Fiscal Year"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Organization *</Label>
              <Select value={form.organization_id} onValueChange={v => setForm({ ...form, organization_id: v })}>
                <SelectTrigger data-testid="select-fy-org">
                  <SelectValue placeholder="Select Organization" />
                </SelectTrigger>
                <SelectContent>
                  {(orgs || []).map(o => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name} {o.country ? `(${o.country})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {fyHint && (
              <div className="rounded-md bg-blue-50 dark:bg-blue-950 p-3 text-sm">
                <p className="font-medium text-blue-800 dark:text-blue-200">{fyHint.label}</p>
                <p className="text-blue-600 dark:text-blue-300 text-xs mt-1">{fyHint.hint}</p>
              </div>
            )}

            <div>
              <Label>Fiscal Year Name *</Label>
              <Input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder={fyHint ? (countryHint === "Nepal" ? "e.g., 2082/83" : "e.g., FY 2025-26") : "e.g., FY 2025-26"}
                data-testid="input-fy-name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date *</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={e => setForm({ ...form, start_date: e.target.value })}
                  data-testid="input-fy-start"
                />
              </div>
              <div>
                <Label>End Date *</Label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={e => setForm({ ...form, end_date: e.target.value })}
                  data-testid="input-fy-end"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={form.is_current}
                onCheckedChange={v => setForm({ ...form, is_current: v })}
                data-testid="switch-fy-current"
              />
              <Label className="text-sm">Mark as current fiscal year</Label>
              <p className="text-xs text-muted-foreground">(Only one per organization can be current)</p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending} data-testid="btn-save-fy">
                {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
