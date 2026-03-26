import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Plus, Search, Users, Loader2 } from "lucide-react";
import { CURRENCIES, getCurrencySymbol } from "@/lib/currencies";

interface Employee {
  id: string; fullName: string; email: string; phone: string; position: string;
  department: string; joinDate: string | null; salaryAmount: string;
  salaryCurrency: string; status: string;
}

async function apiRequest(url: string, options?: RequestInit) {
  const res = await fetch(url, { credentials: "include", ...options });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Request failed (${res.status})`);
  }
  return res.json();
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 border-emerald-200",
  inactive: "bg-gray-100 text-gray-700 border-gray-200",
  terminated: "bg-red-100 text-red-700 border-red-200",
};

export default function EmployeesListPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    fullName: "", email: "", phone: "", position: "", department: "",
    joinDate: "", citizenshipNo: "", panNo: "", passportNumber: "",
    permanentAddress: "", salaryAmount: "", salaryCurrency: "NPR",
    organization_id: "", department_id: "",
  });

  const { data: orgs } = useQuery<any[]>({ queryKey: ["/api/hrms/organizations"], queryFn: () => apiRequest("/api/hrms/organizations") });
  const { data: depts } = useQuery<any[]>({ queryKey: ["/api/hrms/departments"], queryFn: () => apiRequest("/api/hrms/departments") });
  const filteredDepts = form.organization_id ? depts?.filter((d: any) => d.organization_id === form.organization_id) : depts;

  const { data, isLoading } = useQuery<{ results?: Employee[] }>({
    queryKey: ["/api/employees", search, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      return apiRequest(`/api/employees${params.toString() ? `?${params}` : ''}`);
    },
  });

  const employees: Employee[] = data?.results || (Array.isArray(data) ? data : []);

  const createMutation = useMutation({
    mutationFn: (data: Record<string, string>) =>
      apiRequest("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: (newEmp: Employee) => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setShowAdd(false);
      setForm({ fullName: "", email: "", phone: "", position: "", department: "", joinDate: "", citizenshipNo: "", panNo: "", passportNumber: "", permanentAddress: "", salaryAmount: "", salaryCurrency: "NPR", organization_id: "", department_id: "" });
      toast({ title: "Employee created" });
      navigate(`/employees/${newEmp.id}`);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="p-6 max-w-6xl mx-auto" data-testid="page-employees">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-employees-title">Employees</h1>
          <p className="text-sm text-muted-foreground mt-1">{employees.length} employee{employees.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={() => setShowAdd(true)} data-testid="button-add-employee">
          <Plus className="w-4 h-4 mr-1" /> Add Employee
        </Button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search employees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-employees"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="terminated">Terminated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : employees.length === 0 ? (
        <div className="text-center py-16 border rounded-lg bg-muted/20">
          <Users className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground font-medium">No employees found</p>
          <p className="text-sm text-muted-foreground mt-1">Add your first employee to get started</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-medium">Name</TableHead>
                <TableHead className="font-medium">Email</TableHead>
                <TableHead className="font-medium">Position</TableHead>
                <TableHead className="font-medium">Department</TableHead>
                <TableHead className="font-medium">Salary</TableHead>
                <TableHead className="font-medium">Join Date</TableHead>
                <TableHead className="font-medium">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((emp) => (
                <TableRow
                  key={emp.id}
                  className="cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => navigate(`/employees/${emp.id}`)}
                  data-testid={`row-employee-${emp.id}`}
                >
                  <TableCell className="font-medium">{emp.fullName}</TableCell>
                  <TableCell className="text-muted-foreground">{emp.email}</TableCell>
                  <TableCell>{emp.position || '—'}</TableCell>
                  <TableCell>{emp.department || '—'}</TableCell>
                  <TableCell>
                    {emp.salaryAmount
                      ? `${getCurrencySymbol(emp.salaryCurrency)} ${Number(emp.salaryAmount).toLocaleString()}`
                      : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {emp.joinDate ? new Date(emp.joinDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] ${STATUS_STYLES[emp.status] || "bg-gray-100 text-gray-700"}`}>
                      {emp.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Employee</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Full Name *</label>
                <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} data-testid="input-emp-name" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Email *</label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="input-emp-email" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Phone</label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="input-emp-phone" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Position</label>
                <Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} data-testid="input-emp-position" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Organization *</label>
                <Select value={form.organization_id} onValueChange={v => setForm({ ...form, organization_id: v, department_id: "" })}>
                  <SelectTrigger data-testid="select-emp-org"><SelectValue placeholder="Select organization" /></SelectTrigger>
                  <SelectContent>
                    {orgs?.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Department</label>
                <Select value={form.department_id} onValueChange={v => {
                  const dept = filteredDepts?.find((d: any) => d.id === v);
                  setForm({ ...form, department_id: v, department: dept?.name || "" });
                }}>
                  <SelectTrigger data-testid="select-emp-dept"><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>
                    {filteredDepts?.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Join Date</label>
                <Input type="date" value={form.joinDate} onChange={(e) => setForm({ ...form, joinDate: e.target.value })} data-testid="input-emp-join-date" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Position</label>
                <Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} data-testid="input-emp-position2" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Citizenship No</label>
                <Input value={form.citizenshipNo} onChange={(e) => setForm({ ...form, citizenshipNo: e.target.value })} data-testid="input-emp-citizenship" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">PAN No</label>
                <Input value={form.panNo} onChange={(e) => setForm({ ...form, panNo: e.target.value })} data-testid="input-emp-pan" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Passport Number</label>
              <Input value={form.passportNumber} onChange={(e) => setForm({ ...form, passportNumber: e.target.value })} data-testid="input-emp-passport" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Salary</label>
              <div className="flex gap-2">
                <Select value={form.salaryCurrency} onValueChange={v => setForm({ ...form, salaryCurrency: v })}>
                  <SelectTrigger className="w-[100px]" data-testid="select-emp-currency"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input type="number" placeholder="Amount" value={form.salaryAmount}
                  onChange={e => setForm({ ...form, salaryAmount: e.target.value })}
                  data-testid="input-emp-salary" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Permanent Address</label>
              <Textarea value={form.permanentAddress} onChange={(e) => setForm({ ...form, permanentAddress: e.target.value })} rows={2} data-testid="input-emp-address" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate(form)}
              disabled={!form.fullName.trim() || !form.email.trim() || createMutation.isPending}
              data-testid="button-submit-employee"
            >
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Create Employee
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
