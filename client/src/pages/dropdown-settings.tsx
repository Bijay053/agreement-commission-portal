import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, GripVertical, Save } from "lucide-react";

const CATEGORIES = [
  { key: "study_level", label: "Study Level" },
  { key: "commission_basis", label: "Basis" },
  { key: "pay_event", label: "Pay Event" },
  { key: "commission_mode", label: "Mode" },
  { key: "agreement_type", label: "Agreement Type" },
];

interface DropdownOption {
  id: number;
  category: string;
  value: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
}

function CategoryPanel({ category }: { category: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newValue, setNewValue] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");

  const { data: options, isLoading } = useQuery<DropdownOption[]>({
    queryKey: ["/api/admin/dropdown-options", category],
    queryFn: async () => {
      const res = await fetch(`/api/admin/dropdown-options?category=${category}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const addMutation = useMutation({
    mutationFn: async (data: { category: string; value: string; label: string }) => {
      const res = await apiRequest("POST", "/api/admin/dropdown-options", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dropdown-options", category] });
      queryClient.invalidateQueries({ queryKey: ["/api/dropdown-options"] });
      setNewValue("");
      setNewLabel("");
      toast({ title: "Option added" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<DropdownOption> & { id: number }) => {
      const res = await apiRequest("PATCH", "/api/admin/dropdown-options", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dropdown-options", category] });
      queryClient.invalidateQueries({ queryKey: ["/api/dropdown-options"] });
      setEditingId(null);
      toast({ title: "Option updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/dropdown-options?id=${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dropdown-options", category] });
      queryClient.invalidateQueries({ queryKey: ["/api/dropdown-options"] });
      toast({ title: "Option deleted" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleAdd = () => {
    if (!newLabel.trim()) return;
    const value = newValue.trim() || newLabel.trim().toLowerCase().replace(/[\s\/]+/g, "_");
    addMutation.mutate({ category, value, label: newLabel.trim() });
  };

  if (isLoading) return <div className="p-4 text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Label (display name)</label>
          <Input
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            placeholder="e.g., Graduate Certificate"
            data-testid={`input-new-label-${category}`}
          />
        </div>
        <div className="flex-1">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Value (optional, auto-generated)</label>
          <Input
            value={newValue}
            onChange={e => setNewValue(e.target.value)}
            placeholder="auto-generated from label"
            data-testid={`input-new-value-${category}`}
          />
        </div>
        <Button onClick={handleAdd} disabled={!newLabel.trim() || addMutation.isPending} data-testid={`button-add-${category}`}>
          <Plus className="w-4 h-4 mr-1" /> Add
        </Button>
      </div>

      <div className="border rounded-lg divide-y">
        {options && options.length > 0 ? options.map((opt) => (
          <div key={opt.id} className="flex items-center gap-3 px-3 py-2.5 group hover:bg-muted/30" data-testid={`option-row-${opt.id}`}>
            <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0" />
            <div className="flex-1 min-w-0">
              {editingId === opt.id ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editLabel}
                    onChange={e => setEditLabel(e.target.value)}
                    className="h-8 text-sm"
                    data-testid={`input-edit-label-${opt.id}`}
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === "Enter") updateMutation.mutate({ id: opt.id, label: editLabel });
                      if (e.key === "Escape") setEditingId(null);
                    }}
                  />
                  <Button size="sm" variant="ghost" onClick={() => updateMutation.mutate({ id: opt.id, label: editLabel })} data-testid={`button-save-edit-${opt.id}`}>
                    <Save className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <button
                  className="text-sm text-left hover:underline"
                  onClick={() => { setEditingId(opt.id); setEditLabel(opt.label); }}
                  data-testid={`button-edit-label-${opt.id}`}
                >
                  {opt.label}
                </button>
              )}
              <div className="text-[10px] text-muted-foreground mt-0.5">value: {opt.value}</div>
            </div>
            <Badge variant={opt.isActive ? "default" : "secondary"} className="text-[10px] shrink-0">
              {opt.isActive ? "Active" : "Inactive"}
            </Badge>
            <Switch
              checked={opt.isActive}
              onCheckedChange={(v) => updateMutation.mutate({ id: opt.id, isActive: v })}
              data-testid={`switch-active-${opt.id}`}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => {
                if (confirm(`Delete "${opt.label}"?`)) deleteMutation.mutate(opt.id);
              }}
              data-testid={`button-delete-${opt.id}`}
            >
              <Trash2 className="w-3.5 h-3.5 text-destructive" />
            </Button>
          </div>
        )) : (
          <div className="p-6 text-center text-sm text-muted-foreground">No options configured</div>
        )}
      </div>
    </div>
  );
}

export default function DropdownSettingsPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Dropdown Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage configurable dropdown options used across the portal</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="study_level">
            <TabsList className="mb-4 flex-wrap h-auto gap-1">
              {CATEGORIES.map(c => (
                <TabsTrigger key={c.key} value={c.key} data-testid={`tab-${c.key}`}>{c.label}</TabsTrigger>
              ))}
            </TabsList>
            {CATEGORIES.map(c => (
              <TabsContent key={c.key} value={c.key}>
                <CategoryPanel category={c.key} />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
