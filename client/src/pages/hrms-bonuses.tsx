import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Gift, Check, X, Trash2 } from "lucide-react";

interface BonusRecord {
  id: string;
  employee_id: string;
  employee_name: string | null;
  bonus_type: string;
  amount: number;
  reason: string | null;
  month: number;
  year: number;
  is_taxable: boolean;
  status: string;
  approved_at: string | null;
  created_at: string | null;
}

interface Employee {
  id: string;
  fullName: string;
  email: string;
}

const BONUS_TYPES: Record<string, string> = {
  festival: "Festival Bonus",
  performance: "Performance Bonus",
  yearly: "Yearly Bonus",
  special: "Special Bonus",
  other: "Other",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  approved: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function BonusesTab() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()));
  const [form, setForm] = useState({
    employee_id: "",
    bonus_type: "other",
    amount: "",
    reason: "",
    month: String(new Date().getMonth() + 1),
    year: String(new Date().getFullYear()),
    is_taxable: true,
  });

  const { data: bonuses, isLoading } = useQuery<BonusRecord[]>({
    queryKey: ["/api/hrms/bonuses", { year: filterYear }],
    queryFn: async () => {
      const res = await fetch(`/api/hrms/bonuses?year=${filterYear}`, { credentials: "include" });
      if (!res.ok) throw new Error(`Failed to fetch bonuses: ${res.status}`);
      return res.json();
    },
  });
  const { data: employeesData } = useQuery<{ results: Employee[] } | Employee[]>({ queryKey: ["/api/employees"] });
  const employees = Array.isArray(employeesData) ? employeesData : employeesData?.results;

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/hrms/bonuses", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hrms/bonuses"] });
      setShowForm(false);
      toast({ title: "Bonus added" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => apiRequest("PATCH", `/api/hrms/bonuses/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hrms/bonuses"] });
      toast({ title: "Bonus status updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/hrms/bonuses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hrms/bonuses"] });
      toast({ title: "Bonus deleted" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleSubmit = () => {
    if (!form.employee_id || !form.amount) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      ...form,
      amount: parseFloat(form.amount),
      month: parseInt(form.month),
      year: parseInt(form.year),
    });
  };

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-16" /></CardContent></Card>)}</div>;

  const totalApproved = bonuses?.filter(b => b.status === "approved" || b.status === "paid").reduce((s, b) => s + b.amount, 0) || 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Bonus Management</h2>
          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Badge variant="outline">Total Approved: Rs {totalApproved.toLocaleString()}</Badge>
        </div>
        <Button onClick={() => { setForm({ employee_id: "", bonus_type: "other", amount: "", reason: "", month: String(new Date().getMonth() + 1), year: filterYear, is_taxable: true }); setShowForm(true); }} data-testid="btn-add-bonus">
          <Plus className="w-4 h-4 mr-1" /> Add Bonus
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Month</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Taxable</TableHead>
            <TableHead>Status</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bonuses?.map((b) => (
            <TableRow key={b.id} data-testid={`row-bonus-${b.id}`}>
              <TableCell className="font-medium text-sm">{b.employee_name || "Unknown"}</TableCell>
              <TableCell className="text-sm">{BONUS_TYPES[b.bonus_type] || b.bonus_type}</TableCell>
              <TableCell className="text-sm">{MONTHS[b.month - 1]} {b.year}</TableCell>
              <TableCell className="text-right font-mono text-sm">Rs {b.amount.toLocaleString()}</TableCell>
              <TableCell className="text-sm max-w-[200px] truncate">{b.reason || "—"}</TableCell>
              <TableCell>{b.is_taxable ? <Badge variant="outline" className="text-xs">Yes</Badge> : <Badge variant="secondary" className="text-xs">No</Badge>}</TableCell>
              <TableCell><span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLORS[b.status] || ""}`}>{b.status}</span></TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {b.status === "pending" && (
                    <>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => approveMutation.mutate({ id: b.id, status: "approved" })} title="Approve"><Check className="h-3 w-3 text-green-600" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => approveMutation.mutate({ id: b.id, status: "cancelled" })} title="Cancel"><X className="h-3 w-3 text-red-600" /></Button>
                    </>
                  )}
                  {b.status !== "paid" && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteMutation.mutate(b.id)} title="Delete"><Trash2 className="h-3 w-3 text-destructive" /></Button>}
                </div>
              </TableCell>
            </TableRow>
          ))}
          {(!bonuses || bonuses.length === 0) && (
            <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No bonuses for {filterYear}</TableCell></TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Bonus</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Employee</Label>
              <Select value={form.employee_id} onValueChange={v => setForm({ ...form, employee_id: v })} data-testid="select-bonus-emp">
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {employees?.map(e => <SelectItem key={e.id} value={e.id}>{e.fullName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Bonus Type</Label>
                <Select value={form.bonus_type} onValueChange={v => setForm({ ...form, bonus_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(BONUS_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Amount (Rs)</Label>
                <Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} data-testid="input-bonus-amount" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Month</Label>
                <Select value={form.month} onValueChange={v => setForm({ ...form, month: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Year</Label>
                <Input type="number" value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} rows={2} />
            </div>
            <div className="flex items-center gap-3">
              <Checkbox checked={form.is_taxable} onCheckedChange={(v) => setForm({ ...form, is_taxable: !!v })} data-testid="chk-bonus-taxable" />
              <Label>Taxable (included in tax calculation)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending} data-testid="btn-save-bonus">
              {createMutation.isPending ? "Adding..." : "Add Bonus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
