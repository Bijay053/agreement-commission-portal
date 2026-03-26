import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Globe } from "lucide-react";
import { useAuth } from "@/lib/auth";

interface CountryTaxLabel {
  id: string;
  country: string;
  tax_id_label: string;
}

export function CountriesTab() {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const canWrite = hasPermission("hrms.organization.add");
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ country: "", tax_id_label: "" });

  const { data: countries, isLoading } = useQuery<CountryTaxLabel[]>({ queryKey: ["/api/hrms/country-tax-labels"] });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/hrms/country-tax-labels", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hrms/country-tax-labels"] });
      setShowDialog(false);
      toast({ title: "Country added" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PATCH", `/api/hrms/country-tax-labels/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hrms/country-tax-labels"] });
      setShowDialog(false);
      toast({ title: "Country updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/hrms/country-tax-labels/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hrms/country-tax-labels"] });
      toast({ title: "Country removed" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const openAdd = () => {
    setEditingId(null);
    setForm({ country: "", tax_id_label: "" });
    setShowDialog(true);
  };

  const openEdit = (c: CountryTaxLabel) => {
    setEditingId(c.id);
    setForm({ country: c.country, tax_id_label: c.tax_id_label });
    setShowDialog(true);
  };

  const handleSave = () => {
    if (!form.country.trim()) {
      toast({ title: "Country name is required", variant: "destructive" });
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Countries & Tax ID Labels</h2>
          <p className="text-sm text-muted-foreground">Manage the list of countries available in employee forms and their corresponding tax ID field labels (e.g., PAN, TFN, TIN).</p>
        </div>
        {canWrite && (
          <Button size="sm" onClick={openAdd} data-testid="btn-add-country">
            <Plus className="h-3 w-3 mr-1" /> Add Country
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Country</TableHead>
                <TableHead>Tax ID Label</TableHead>
                {canWrite && <TableHead className="w-24 text-center">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : !countries?.length ? (
                <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No countries configured</TableCell></TableRow>
              ) : (
                countries.map(c => (
                  <TableRow key={c.id} data-testid={`row-country-${c.id}`}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                        {c.country}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.tax_id_label}</TableCell>
                    {canWrite && (
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(c)} data-testid={`btn-edit-country-${c.id}`}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { if (confirm(`Remove ${c.country}?`)) deleteMutation.mutate(c.id); }} data-testid={`btn-delete-country-${c.id}`}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Country" : "Add Country"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Country Name *</Label>
              <Input
                value={form.country}
                onChange={e => setForm({ ...form, country: e.target.value })}
                placeholder="e.g., Kenya"
                data-testid="input-country-name"
              />
            </div>
            <div>
              <Label>Tax ID Label</Label>
              <Input
                value={form.tax_id_label}
                onChange={e => setForm({ ...form, tax_id_label: e.target.value })}
                placeholder="e.g., KRA PIN"
                data-testid="input-tax-label"
              />
              <p className="text-xs text-muted-foreground mt-1">This label appears on employee forms and payslips for this country&apos;s tax identification number.</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending} data-testid="btn-save-country">
                {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
