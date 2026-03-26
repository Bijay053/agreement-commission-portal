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

interface AdvancePayment {
  id: string;
  employee_id: string;
  employee_name: string | null;
  amount: number;
  reason: string | null;
  request_date: string | null;
  monthly_deduction: number;
  deduction_start_month: number;
  deduction_start_year: number;
  total_deducted: number;
  remaining_balance: number;
  status: string;
  approved_at: string | null;
  created_at: string | null;
}

interface Employee {
  id: string;
  fullName: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  approved: "bg-blue-100 text-blue-700",
  active: "bg-purple-100 text-purple-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function AdvancePaymentsTab() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    employee_id: "",
    amount: "",
    reason: "",
    request_date: new Date().toISOString().split("T")[0],
    monthly_deduction: "",
    deduction_start_month: String(new Date().getMonth() + 2 > 12 ? 1 : new Date().getMonth() + 2),
    deduction_start_year: String(new Date().getMonth() + 2 > 12 ? new Date().getFullYear() + 1 : new Date().getFullYear()),
  });

  const { data: advances, isLoading } = useQuery<AdvancePayment[]>({ queryKey: ["/api/hrms/advance-payments"] });
  const { data: employeesData } = useQuery<{ results: Employee[] } | Employee[]>({ queryKey: ["/api/employees"] });
  const employees = Array.isArray(employeesData) ? employeesData : employeesData?.results;

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/hrms/advance-payments", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hrms/advance-payments"] });
      setShowForm(false);
      toast({ title: "Advance payment recorded" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PATCH", `/api/hrms/advance-payments/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hrms/advance-payments"] });
      toast({ title: "Advance payment updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/hrms/advance-payments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hrms/advance-payments"] });
      toast({ title: "Advance payment deleted" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleSubmit = () => {
    if (!form.employee_id || !form.amount || !form.monthly_deduction) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      ...form,
      amount: parseFloat(form.amount),
      monthly_deduction: parseFloat(form.monthly_deduction),
      deduction_start_month: parseInt(form.deduction_start_month),
      deduction_start_year: parseInt(form.deduction_start_year),
    });
  };

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-16" /></CardContent></Card>)}</div>;

  const totalOutstanding = advances?.filter(a => a.status === "approved" || a.status === "active").reduce((s, a) => s + a.remaining_balance, 0) || 0;

  const installments = parseFloat(form.amount) && parseFloat(form.monthly_deduction) ? Math.ceil(parseFloat(form.amount) / parseFloat(form.monthly_deduction)) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Advance Payment Management</h2>
          <Badge variant="destructive">Outstanding: Rs {totalOutstanding.toLocaleString()}</Badge>
        </div>
        <Button onClick={() => { setForm({ employee_id: "", amount: "", reason: "", request_date: new Date().toISOString().split("T")[0], monthly_deduction: "", deduction_start_month: String(new Date().getMonth() + 2 > 12 ? 1 : new Date().getMonth() + 2), deduction_start_year: String(new Date().getMonth() + 2 > 12 ? new Date().getFullYear() + 1 : new Date().getFullYear()) }); setShowForm(true); }} data-testid="btn-add-advance">
          <Plus className="w-4 h-4 mr-1" /> Record Advance
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Request Date</TableHead>
            <TableHead className="text-right">Total Amount</TableHead>
            <TableHead className="text-right">Monthly Deduction</TableHead>
            <TableHead>Deduction From</TableHead>
            <TableHead className="text-right">Deducted</TableHead>
            <TableHead className="text-right">Remaining</TableHead>
            <TableHead>Progress</TableHead>
            <TableHead>Status</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {advances?.map((a) => {
            const progress = a.amount > 0 ? Math.round((a.total_deducted / a.amount) * 100) : 0;
            return (
              <TableRow key={a.id} data-testid={`row-advance-${a.id}`}>
                <TableCell>
                  <div>
                    <p className="font-medium text-sm">{a.employee_name || "Unknown"}</p>
                    {a.reason && <p className="text-xs text-muted-foreground truncate max-w-[150px]">{a.reason}</p>}
                  </div>
                </TableCell>
                <TableCell className="text-sm">{a.request_date}</TableCell>
                <TableCell className="text-right font-mono text-sm">Rs {a.amount.toLocaleString()}</TableCell>
                <TableCell className="text-right font-mono text-sm">Rs {a.monthly_deduction.toLocaleString()}</TableCell>
                <TableCell className="text-sm">{MONTHS[a.deduction_start_month - 1]} {a.deduction_start_year}</TableCell>
                <TableCell className="text-right font-mono text-sm">Rs {a.total_deducted.toLocaleString()}</TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {a.remaining_balance > 0 ? <span className="text-red-600">Rs {a.remaining_balance.toLocaleString()}</span> : <span className="text-green-600">Rs 0</span>}
                </TableCell>
                <TableCell>
                  <div className="w-20">
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 text-center">{progress}%</p>
                  </div>
                </TableCell>
                <TableCell><span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLORS[a.status] || ""}`}>{a.status}</span></TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {a.status === "pending" && (
                      <>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateMutation.mutate({ id: a.id, data: { status: "approved" } })} title="Approve"><Check className="h-3 w-3 text-green-600" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateMutation.mutate({ id: a.id, data: { status: "cancelled" } })} title="Cancel"><X className="h-3 w-3 text-red-600" /></Button>
                      </>
                    )}
                    {(a.status === "pending" || a.status === "cancelled") && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteMutation.mutate(a.id)} title="Delete"><Trash2 className="h-3 w-3 text-destructive" /></Button>}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
          {(!advances || advances.length === 0) && (
            <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No advance payments recorded</TableCell></TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Advance Payment</DialogTitle></DialogHeader>
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
                <Label>Advance Amount (Rs)</Label>
                <Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} data-testid="input-advance-amount" />
              </div>
              <div>
                <Label>Monthly Deduction (Rs)</Label>
                <Input type="number" value={form.monthly_deduction} onChange={e => setForm({ ...form, monthly_deduction: e.target.value })} data-testid="input-monthly-ded" />
              </div>
            </div>
            {installments > 0 && (
              <Card className="bg-muted/50">
                <CardContent className="p-3">
                  <p className="text-sm">
                    Will be deducted in <strong>{installments} installments</strong> of Rs {parseFloat(form.monthly_deduction || "0").toLocaleString()}/month
                  </p>
                </CardContent>
              </Card>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Request Date</Label>
                <Input type="date" value={form.request_date} onChange={e => setForm({ ...form, request_date: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Deduction Starts</Label>
                  <Select value={form.deduction_start_month} onValueChange={v => setForm({ ...form, deduction_start_month: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Year</Label>
                  <Input type="number" value={form.deduction_start_year} onChange={e => setForm({ ...form, deduction_start_year: e.target.value })} />
                </div>
              </div>
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} rows={2} placeholder="Reason for advance..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending} data-testid="btn-save-advance">
              {createMutation.isPending ? "Recording..." : "Record Advance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
