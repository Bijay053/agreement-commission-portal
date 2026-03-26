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
import { Plus, Check, X, Trash2 } from "lucide-react";

interface TravelExpense {
  id: string;
  employee_id: string;
  employee_name: string | null;
  category: string;
  description: string;
  amount: number;
  expense_date: string | null;
  receipt_url: string | null;
  month: number;
  year: number;
  include_in_salary: boolean;
  status: string;
  rejection_reason: string | null;
  created_at: string | null;
}

interface Employee {
  id: string;
  fullName: string;
}

const CATEGORIES: Record<string, string> = {
  travel: "Travel",
  accommodation: "Accommodation",
  food: "Food & Meals",
  transport: "Local Transport",
  client_meeting: "Client Meeting",
  training: "Training",
  other: "Other",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  approved: "bg-blue-100 text-blue-700",
  rejected: "bg-red-100 text-red-700",
  reimbursed: "bg-green-100 text-green-700",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function TravelExpensesTab() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()));
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [form, setForm] = useState({
    employee_id: "",
    category: "travel",
    description: "",
    amount: "",
    expense_date: new Date().toISOString().split("T")[0],
    month: String(new Date().getMonth() + 1),
    year: String(new Date().getFullYear()),
    include_in_salary: true,
    receipt_url: "",
  });

  const { data: expenses, isLoading } = useQuery<TravelExpense[]>({
    queryKey: ["/api/hrms/travel-expenses", { year: filterYear }],
    queryFn: async () => {
      const res = await fetch(`/api/hrms/travel-expenses?year=${filterYear}`, { credentials: "include" });
      if (!res.ok) throw new Error(`Failed to fetch expenses: ${res.status}`);
      return res.json();
    },
  });
  const { data: employeesData } = useQuery<{ results: Employee[] } | Employee[]>({ queryKey: ["/api/employees"] });
  const employees = Array.isArray(employeesData) ? employeesData : employeesData?.results;

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/hrms/travel-expenses", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hrms/travel-expenses"] });
      setShowForm(false);
      toast({ title: "Expense added" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PATCH", `/api/hrms/travel-expenses/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hrms/travel-expenses"] });
      setRejectId(null);
      setRejectReason("");
      toast({ title: "Expense updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/hrms/travel-expenses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hrms/travel-expenses"] });
      toast({ title: "Expense deleted" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleSubmit = () => {
    if (!form.employee_id || !form.amount || !form.description) {
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

  const totalPending = expenses?.filter(e => e.status === "pending").reduce((s, e) => s + e.amount, 0) || 0;
  const totalApproved = expenses?.filter(e => e.status === "approved" || e.status === "reimbursed").reduce((s, e) => s + e.amount, 0) || 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Travel & Expense Management</h2>
          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Badge variant="outline">Pending: { totalPending.toLocaleString()}</Badge>
          <Badge variant="default">Approved: { totalApproved.toLocaleString()}</Badge>
        </div>
        <Button onClick={() => { setForm({ employee_id: "", category: "travel", description: "", amount: "", expense_date: new Date().toISOString().split("T")[0], month: String(new Date().getMonth() + 1), year: filterYear, include_in_salary: true, receipt_url: "" }); setShowForm(true); }} data-testid="btn-add-expense">
          <Plus className="w-4 h-4 mr-1" /> Add Expense
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>In Salary</TableHead>
            <TableHead>Status</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {expenses?.map((e) => (
            <TableRow key={e.id} data-testid={`row-expense-${e.id}`}>
              <TableCell className="font-medium text-sm">{e.employee_name || "Unknown"}</TableCell>
              <TableCell className="text-sm">{CATEGORIES[e.category] || e.category}</TableCell>
              <TableCell className="text-sm max-w-[200px] truncate">{e.description}</TableCell>
              <TableCell className="text-sm">{e.expense_date}</TableCell>
              <TableCell className="text-right font-mono text-sm">{ e.amount.toLocaleString()}</TableCell>
              <TableCell>{e.include_in_salary ? <Badge variant="outline" className="text-xs">Yes</Badge> : <Badge variant="secondary" className="text-xs">No</Badge>}</TableCell>
              <TableCell><span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLORS[e.status] || ""}`}>{e.status}</span></TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {e.status === "pending" && (
                    <>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateMutation.mutate({ id: e.id, data: { status: "approved" } })} title="Approve"><Check className="h-3 w-3 text-green-600" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setRejectId(e.id); setRejectReason(""); }} title="Reject"><X className="h-3 w-3 text-red-600" /></Button>
                    </>
                  )}
                  {e.status !== "reimbursed" && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteMutation.mutate(e.id)} title="Delete"><Trash2 className="h-3 w-3 text-destructive" /></Button>}
                </div>
              </TableCell>
            </TableRow>
          ))}
          {(!expenses || expenses.length === 0) && (
            <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No expenses for {filterYear}</TableCell></TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Travel / Expense</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Employee</Label>
              <Select value={form.employee_id} onValueChange={v => setForm({ ...form, employee_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {employees?.map(e => <SelectItem key={e.id} value={e.id}>{e.fullName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORIES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Amount</Label>
                <Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} data-testid="input-expense-amount" />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Describe the expense" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Expense Date</Label>
                <Input type="date" value={form.expense_date} onChange={e => setForm({ ...form, expense_date: e.target.value })} />
              </div>
              <div>
                <Label>Salary Month</Label>
                <Select value={form.month} onValueChange={v => setForm({ ...form, month: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Receipt URL (optional)</Label>
              <Input value={form.receipt_url} onChange={e => setForm({ ...form, receipt_url: e.target.value })} placeholder="https://..." />
            </div>
            <div className="flex items-center gap-3">
              <Checkbox checked={form.include_in_salary} onCheckedChange={(v) => setForm({ ...form, include_in_salary: !!v })} />
              <Label>Include in salary (reimburse with next payroll)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending} data-testid="btn-save-expense">
              {createMutation.isPending ? "Adding..." : "Add Expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectId} onOpenChange={() => setRejectId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Expense</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Rejection Reason</Label>
              <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} placeholder="Reason for rejection..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { if (rejectId) updateMutation.mutate({ id: rejectId, data: { status: "rejected", rejection_reason: rejectReason } }); }}>
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
