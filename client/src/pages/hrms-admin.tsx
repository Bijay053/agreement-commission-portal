import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2, Users, Calendar, TreePalm, Clock, DollarSign,
  Plus, Pencil, Trash2, Check, X, Eye, MapPin, Camera,
  Bell, Settings, Briefcase, UserCheck, CalendarDays,
  Gift, Receipt, Banknote, UserCog, Landmark, Calculator,
  ChevronLeft, ChevronRight, Save,
} from "lucide-react";
import { StaffProfilesTab } from "./hrms-staff-profiles";
import { BonusesTab } from "./hrms-bonuses";
import { TravelExpensesTab } from "./hrms-expenses";
import { AdvancePaymentsTab } from "./hrms-advances";
import { TaxSlabsTab } from "./hrms-tax-slabs";
import { GovernmentRecordsTab } from "./hrms-govt-records";

interface Organization {
  id: string; name: string; short_code: string; address: string | null;
  country: string | null; phone: string | null; email: string | null;
  registration_number: string | null; pan_number: string | null;
  status: string; created_at: string | null;
}

interface Department {
  id: string; organization_id: string; organization_name: string | null;
  name: string; head_employee_id: string | null;
  working_days_per_week: number; work_start_time: string | null;
  work_end_time: string | null; late_threshold_minutes: number;
  early_leave_threshold_minutes: number; status: string;
}

interface FiscalYearType {
  id: string; organization_id: string; name: string;
  start_date: string | null; end_date: string | null; is_current: boolean;
}

interface LeaveType {
  id: string; organization_id: string; name: string; code: string;
  default_days: number; is_paid: boolean; is_carry_forward: boolean;
  max_carry_forward_days: number; requires_document: boolean;
  document_required_after_days: number; color: string; status: string;
}

interface Holiday {
  id: string; organization_id: string; name: string;
  date: string | null; is_optional: boolean; fiscal_year_id: string | null;
}

interface LeaveRequest {
  id: string; employee_id: string; employee_name: string | null;
  leave_type_id: string; leave_type_name: string | null;
  leave_type_color: string | null;
  start_date: string | null; end_date: string | null;
  days_count: number; is_half_day: boolean; reason: string | null;
  status: string; approver_name: string | null;
  approved_at: string | null; rejection_reason: string | null;
  created_at: string | null;
}


interface SalaryStructure {
  id: string; employee_id: string; employee_name: string | null;
  basic_salary: number; allowances: Record<string, number>;
  cit_type: string; cit_value: number; ssf_applicable: boolean;
  ssf_employee_percentage: number; ssf_employer_percentage: number;
  tax_applicable: boolean; effective_from: string | null; status: string;
}

interface PayrollRun {
  id: string; organization_id: string; organization_name: string | null;
  month: number; year: number; status: string;
  total_gross: number; total_deductions: number; total_net: number;
  total_employer_contribution: number; payslip_count: number;
  processed_at: string | null; created_at: string | null;
}

function OrgTab() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editOrg, setEditOrg] = useState<Organization | null>(null);
  const [form, setForm] = useState({ name: "", short_code: "", address: "", country: "", phone: "", email: "", registration_number: "", pan_number: "" });

  const { data: orgs, isLoading } = useQuery<Organization[]>({ queryKey: ["/api/hrms/organizations"] });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/hrms/organizations", data),
    onSuccess: () => { queryClient.refetchQueries({ queryKey: ["/api/hrms/organizations"] }); setShowForm(false); toast({ title: "Organization created" }); },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/hrms/organizations/${editOrg?.id}`, data),
    onSuccess: () => { queryClient.refetchQueries({ queryKey: ["/api/hrms/organizations"] }); setEditOrg(null); toast({ title: "Organization updated" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/hrms/organizations/${id}`),
    onSuccess: () => { queryClient.refetchQueries({ queryKey: ["/api/hrms/organizations"] }); toast({ title: "Organization deleted" }); },
  });

  const openCreate = () => { setForm({ name: "", short_code: "", address: "", country: "", phone: "", email: "", registration_number: "", pan_number: "" }); setShowForm(true); };
  const openEdit = (o: Organization) => { setForm({ name: o.name, short_code: o.short_code, address: o.address || "", country: o.country || "", phone: o.phone || "", email: o.email || "", registration_number: o.registration_number || "", pan_number: o.pan_number || "" }); setEditOrg(o); };

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold" data-testid="text-org-title">Organizations ({orgs?.length || 0})</h3>
        <Button onClick={openCreate} size="sm" data-testid="button-add-org"><Plus className="h-4 w-4 mr-1" /> Add Organization</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {orgs?.map(o => (
          <Card key={o.id} data-testid={`card-org-${o.id}`}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <CardTitle className="text-base">{o.name}</CardTitle>
                <Badge variant={o.status === "active" ? "default" : "secondary"}>{o.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              <p>Code: <span className="font-medium text-foreground">{o.short_code}</span></p>
              {o.country && <p>Country: {o.country}</p>}
              {o.email && <p>Email: {o.email}</p>}
              {o.phone && <p>Phone: {o.phone}</p>}
              <div className="flex gap-2 mt-3">
                <Button variant="outline" size="sm" onClick={() => openEdit(o)} data-testid={`button-edit-org-${o.id}`}><Pencil className="h-3 w-3 mr-1" /> Edit</Button>
                <Button variant="outline" size="sm" className="text-red-500" onClick={() => deleteMutation.mutate(o.id)} data-testid={`button-delete-org-${o.id}`}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showForm || !!editOrg} onOpenChange={(open) => { if (!open) { setShowForm(false); setEditOrg(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editOrg ? "Edit Organization" : "Add Organization"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} data-testid="input-org-name" /></div>
              <div><Label>Short Code</Label><Input value={form.short_code} onChange={e => setForm({ ...form, short_code: e.target.value })} data-testid="input-org-code" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Country</Label><Input value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} data-testid="input-org-country" /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} data-testid="input-org-phone" /></div>
            </div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} data-testid="input-org-email" /></div>
            <div><Label>Address</Label><Textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} data-testid="input-org-address" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Registration No.</Label><Input value={form.registration_number} onChange={e => setForm({ ...form, registration_number: e.target.value })} data-testid="input-org-reg" /></div>
              <div><Label>PAN No.</Label><Input value={form.pan_number} onChange={e => setForm({ ...form, pan_number: e.target.value })} data-testid="input-org-pan" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowForm(false); setEditOrg(null); }}>Cancel</Button>
            <Button onClick={() => editOrg ? updateMutation.mutate(form) : createMutation.mutate(form)} disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-org">
              {editOrg ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DeptTab() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editDept, setEditDept] = useState<Department | null>(null);
  const [form, setForm] = useState({ organization_id: "", name: "", working_days_per_week: 6, work_start_time: "10:00", work_end_time: "18:00", late_threshold_minutes: 15, early_leave_threshold_minutes: 15 });

  const { data: orgs } = useQuery<Organization[]>({ queryKey: ["/api/hrms/organizations"] });
  const { data: depts, isLoading } = useQuery<Department[]>({ queryKey: ["/api/hrms/departments"] });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/hrms/departments", data),
    onSuccess: () => { queryClient.refetchQueries({ queryKey: ["/api/hrms/departments"] }); setShowForm(false); toast({ title: "Department created" }); },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/hrms/departments/${editDept?.id}`, data),
    onSuccess: () => { queryClient.refetchQueries({ queryKey: ["/api/hrms/departments"] }); setEditDept(null); toast({ title: "Department updated" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/hrms/departments/${id}`),
    onSuccess: () => { queryClient.refetchQueries({ queryKey: ["/api/hrms/departments"] }); toast({ title: "Department deleted" }); },
  });

  const openCreate = () => { setForm({ organization_id: orgs?.[0]?.id || "", name: "", working_days_per_week: 6, work_start_time: "10:00", work_end_time: "18:00", late_threshold_minutes: 15, early_leave_threshold_minutes: 15 }); setShowForm(true); };
  const openEdit = (d: Department) => { setForm({ organization_id: d.organization_id, name: d.name, working_days_per_week: d.working_days_per_week, work_start_time: d.work_start_time || "10:00", work_end_time: d.work_end_time || "18:00", late_threshold_minutes: d.late_threshold_minutes, early_leave_threshold_minutes: d.early_leave_threshold_minutes }); setEditDept(d); };

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold" data-testid="text-dept-title">Departments ({depts?.length || 0})</h3>
        <Button onClick={openCreate} size="sm" data-testid="button-add-dept"><Plus className="h-4 w-4 mr-1" /> Add Department</Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Organization</TableHead>
            <TableHead>Working Days</TableHead>
            <TableHead>Hours</TableHead>
            <TableHead>Late Threshold</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {depts?.map(d => (
            <TableRow key={d.id} data-testid={`row-dept-${d.id}`}>
              <TableCell className="font-medium">{d.name}</TableCell>
              <TableCell>{d.organization_name}</TableCell>
              <TableCell>{d.working_days_per_week} days/week</TableCell>
              <TableCell>{d.work_start_time} - {d.work_end_time}</TableCell>
              <TableCell>{d.late_threshold_minutes} min</TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(d)} data-testid={`button-edit-dept-${d.id}`}><Pencil className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="sm" className="text-red-500" onClick={() => deleteMutation.mutate(d.id)} data-testid={`button-delete-dept-${d.id}`}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={showForm || !!editDept} onOpenChange={(open) => { if (!open) { setShowForm(false); setEditDept(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editDept ? "Edit Department" : "Add Department"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Organization</Label>
              <Select value={form.organization_id} onValueChange={v => setForm({ ...form, organization_id: v })}>
                <SelectTrigger data-testid="select-dept-org"><SelectValue placeholder="Select organization" /></SelectTrigger>
                <SelectContent>{orgs?.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Department Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} data-testid="input-dept-name" /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Working Days/Week</Label><Input type="number" value={form.working_days_per_week} onChange={e => setForm({ ...form, working_days_per_week: parseInt(e.target.value) || 0 })} data-testid="input-dept-days" /></div>
              <div><Label>Start Time</Label><Input type="time" value={form.work_start_time} onChange={e => setForm({ ...form, work_start_time: e.target.value })} data-testid="input-dept-start" /></div>
              <div><Label>End Time</Label><Input type="time" value={form.work_end_time} onChange={e => setForm({ ...form, work_end_time: e.target.value })} data-testid="input-dept-end" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Late Threshold (min)</Label><Input type="number" value={form.late_threshold_minutes} onChange={e => setForm({ ...form, late_threshold_minutes: parseInt(e.target.value) || 0 })} data-testid="input-dept-late" /></div>
              <div><Label>Early Leave Threshold (min)</Label><Input type="number" value={form.early_leave_threshold_minutes} onChange={e => setForm({ ...form, early_leave_threshold_minutes: parseInt(e.target.value) || 0 })} data-testid="input-dept-early" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowForm(false); setEditDept(null); }}>Cancel</Button>
            <Button onClick={() => editDept ? updateMutation.mutate(form) : createMutation.mutate(form)} disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-dept">
              {editDept ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LeaveTypesTab() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editLT, setEditLT] = useState<LeaveType | null>(null);
  const [form, setForm] = useState({ organization_id: "", name: "", code: "", default_days: 0, is_paid: true, is_carry_forward: false, max_carry_forward_days: 0, requires_document: false, document_required_after_days: 0, color: "#3B82F6" });

  const { data: orgs } = useQuery<Organization[]>({ queryKey: ["/api/hrms/organizations"] });
  const { data: leaveTypes, isLoading } = useQuery<LeaveType[]>({ queryKey: ["/api/hrms/leave-types"] });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/hrms/leave-types", data),
    onSuccess: () => { queryClient.refetchQueries({ queryKey: ["/api/hrms/leave-types"] }); setShowForm(false); toast({ title: "Leave type created" }); },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/hrms/leave-types/${editLT?.id}`, data),
    onSuccess: () => { queryClient.refetchQueries({ queryKey: ["/api/hrms/leave-types"] }); setEditLT(null); toast({ title: "Leave type updated" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/hrms/leave-types/${id}`),
    onSuccess: () => { queryClient.refetchQueries({ queryKey: ["/api/hrms/leave-types"] }); toast({ title: "Leave type deleted" }); },
  });

  const openCreate = () => { setForm({ organization_id: orgs?.[0]?.id || "", name: "", code: "", default_days: 0, is_paid: true, is_carry_forward: false, max_carry_forward_days: 0, requires_document: false, document_required_after_days: 0, color: "#3B82F6" }); setShowForm(true); };

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Leave Types ({leaveTypes?.length || 0})</h3>
        <Button onClick={openCreate} size="sm" data-testid="button-add-leave-type"><Plus className="h-4 w-4 mr-1" /> Add Leave Type</Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Code</TableHead>
            <TableHead>Default Days</TableHead>
            <TableHead>Paid</TableHead>
            <TableHead>Carry Forward</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leaveTypes?.map(lt => (
            <TableRow key={lt.id}>
              <TableCell><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: lt.color }} />{lt.name}</div></TableCell>
              <TableCell>{lt.code}</TableCell>
              <TableCell>{lt.default_days}</TableCell>
              <TableCell>{lt.is_paid ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-red-500" />}</TableCell>
              <TableCell>{lt.is_carry_forward ? `Yes (max ${lt.max_carry_forward_days})` : "No"}</TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => { setForm({ organization_id: lt.organization_id, name: lt.name, code: lt.code, default_days: lt.default_days, is_paid: lt.is_paid, is_carry_forward: lt.is_carry_forward, max_carry_forward_days: lt.max_carry_forward_days, requires_document: lt.requires_document, document_required_after_days: lt.document_required_after_days, color: lt.color }); setEditLT(lt); }}><Pencil className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="sm" className="text-red-500" onClick={() => deleteMutation.mutate(lt.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={showForm || !!editLT} onOpenChange={(open) => { if (!open) { setShowForm(false); setEditLT(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editLT ? "Edit Leave Type" : "Add Leave Type"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Organization</Label>
              <Select value={form.organization_id} onValueChange={v => setForm({ ...form, organization_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select organization" /></SelectTrigger>
                <SelectContent>{orgs?.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} data-testid="input-lt-name" /></div>
              <div><Label>Code</Label><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} data-testid="input-lt-code" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Default Days</Label><Input type="number" value={form.default_days} onChange={e => setForm({ ...form, default_days: parseFloat(e.target.value) || 0 })} /></div>
              <div><Label>Color</Label><Input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} /></div>
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.is_paid} onCheckedChange={v => setForm({ ...form, is_paid: !!v })} /> Paid Leave</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.is_carry_forward} onCheckedChange={v => setForm({ ...form, is_carry_forward: !!v })} /> Carry Forward</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.requires_document} onCheckedChange={v => setForm({ ...form, requires_document: !!v })} /> Requires Document</label>
            </div>
            {form.is_carry_forward && <div><Label>Max Carry Forward Days</Label><Input type="number" value={form.max_carry_forward_days} onChange={e => setForm({ ...form, max_carry_forward_days: parseFloat(e.target.value) || 0 })} /></div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowForm(false); setEditLT(null); }}>Cancel</Button>
            <Button onClick={() => editLT ? updateMutation.mutate(form) : createMutation.mutate(form)} disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-lt">
              {editLT ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LeaveRequestsTab() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("pending");

  const { data: requests, isLoading } = useQuery<LeaveRequest[]>({
    queryKey: ["/api/hrms/leave-requests", statusFilter],
    queryFn: async () => {
      const res = await fetch(`/api/hrms/leave-requests?status=${statusFilter}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/hrms/leave-requests/${id}/approve`),
    onSuccess: () => { queryClient.refetchQueries({ queryKey: ["/api/hrms/leave-requests"] }); toast({ title: "Leave request approved" }); },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/hrms/leave-requests/${id}/reject`, { rejection_reason: "Rejected by admin" }),
    onSuccess: () => { queryClient.refetchQueries({ queryKey: ["/api/hrms/leave-requests"] }); toast({ title: "Leave request rejected" }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Leave Requests</h3>
        <div className="flex gap-2">
          {["pending", "approved", "rejected", "cancelled"].map(s => (
            <Button key={s} variant={statusFilter === s ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(s)} data-testid={`button-filter-${s}`}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? <Skeleton className="h-40 w-full" /> : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Leave Type</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
              {statusFilter === "pending" && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests?.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.employee_name || "Unknown"}</TableCell>
                <TableCell><div className="flex items-center gap-2">{r.leave_type_color && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: r.leave_type_color }} />}{r.leave_type_name}</div></TableCell>
                <TableCell>{r.start_date}</TableCell>
                <TableCell>{r.end_date}</TableCell>
                <TableCell>{r.days_count}{r.is_half_day ? " (Half)" : ""}</TableCell>
                <TableCell className="max-w-[200px] truncate">{r.reason}</TableCell>
                <TableCell><Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>{r.status}</Badge></TableCell>
                {statusFilter === "pending" && (
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="text-green-600" onClick={() => approveMutation.mutate(r.id)} data-testid={`button-approve-${r.id}`}><Check className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" className="text-red-500" onClick={() => rejectMutation.mutate(r.id)} data-testid={`button-reject-${r.id}`}><X className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {(!requests || requests.length === 0) && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No {statusFilter} leave requests</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function AttendanceTab() {
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<"daily" | "weekly" | "monthly">("monthly");
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split("T")[0]);
  const [editingCell, setEditingCell] = useState<{ empId: string; day: string } | null>(null);
  const [editForm, setEditForm] = useState({ status: "present", check_in: "", check_out: "", notes: "" });

  const { data: grid, isLoading } = useQuery<any>({
    queryKey: ["/api/hrms/attendance/grid", viewMode, currentDate],
    queryFn: async () => {
      const res = await fetch(`/api/hrms/attendance/grid?mode=${viewMode}&date=${currentDate}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest("POST", "/api/hrms/attendance", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/hrms/attendance/grid"] });
      setEditingCell(null);
      toast({ title: "Attendance updated" });
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  const navigate = (dir: number) => {
    const d = new Date(currentDate);
    if (viewMode === "daily") d.setDate(d.getDate() + dir);
    else if (viewMode === "weekly") d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setCurrentDate(d.toISOString().split("T")[0]);
  };

  const openEdit = (empId: string, day: string, existing: any) => {
    setEditingCell({ empId, day });
    setEditForm({
      status: existing?.status || "present",
      check_in: existing?.check_in ? existing.check_in.substring(0, 5) : "",
      check_out: existing?.check_out ? existing.check_out.substring(0, 5) : "",
      notes: existing?.notes || "",
    });
  };

  const saveEdit = () => {
    if (!editingCell) return;
    saveMutation.mutate({
      employee_id: editingCell.empId,
      date: editingCell.day,
      status: editForm.status,
      check_in: editForm.check_in ? `${editingCell.day}T${editForm.check_in}:00` : null,
      check_out: editForm.check_out ? `${editingCell.day}T${editForm.check_out}:00` : null,
      check_in_method: "manual",
      check_out_method: "manual",
      notes: editForm.notes,
    });
  };

  const statusColors: Record<string, string> = {
    present: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    absent: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    on_leave: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    half_day: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  };

  const statusLabel = (s: string) => ({ present: "P", absent: "A", on_leave: "L", half_day: "H" }[s] || "-");

  const formatDay = (d: string) => {
    const dt = new Date(d + "T00:00:00");
    const dayNum = dt.getDate();
    const dayName = dt.toLocaleDateString("en", { weekday: "short" });
    const isSun = dt.getDay() === 0;
    const isSat = dt.getDay() === 6;
    return { dayNum, dayName, isSun, isSat, isWeekend: isSun || isSat };
  };

  const periodLabel = () => {
    if (!grid) return "";
    if (viewMode === "daily") return new Date(grid.date_from + "T00:00:00").toLocaleDateString("en", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    if (viewMode === "weekly") {
      const f = new Date(grid.date_from + "T00:00:00");
      const t = new Date(grid.date_to + "T00:00:00");
      return `${f.toLocaleDateString("en", { month: "short", day: "numeric" })} - ${t.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}`;
    }
    return new Date(grid.date_from + "T00:00:00").toLocaleDateString("en", { year: "numeric", month: "long" });
  };

  const totalSummary = grid?.employees?.reduce(
    (acc: any, emp: any) => ({
      present: acc.present + emp.summary.present,
      absent: acc.absent + emp.summary.absent,
      on_leave: acc.on_leave + emp.summary.on_leave,
      late: acc.late + emp.summary.late,
    }),
    { present: 0, absent: 0, on_leave: 0, late: 0 }
  ) || { present: 0, absent: 0, on_leave: 0, late: 0 };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold" data-testid="text-att-title">Attendance</h3>
        <div className="flex items-center gap-2">
          <div className="flex border rounded-md overflow-hidden">
            {(["daily", "weekly", "monthly"] as const).map(m => (
              <button key={m} onClick={() => setViewMode(m)} data-testid={`btn-mode-${m}`}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === m ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{m.charAt(0).toUpperCase() + m.slice(1)}</button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(-1)} data-testid="btn-prev"><ChevronLeft className="h-4 w-4" /></Button>
            <span className="text-sm font-medium min-w-[160px] text-center">{periodLabel()}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(1)} data-testid="btn-next"><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <Input type="date" value={currentDate} onChange={e => setCurrentDate(e.target.value)} className="w-auto h-8 text-xs" data-testid="input-att-date" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-3 pb-3"><div className="text-xl font-bold text-green-600" data-testid="text-present-count">{totalSummary.present}</div><p className="text-xs text-muted-foreground">Present</p></CardContent></Card>
        <Card><CardContent className="pt-3 pb-3"><div className="text-xl font-bold text-red-600" data-testid="text-absent-count">{totalSummary.absent}</div><p className="text-xs text-muted-foreground">Absent</p></CardContent></Card>
        <Card><CardContent className="pt-3 pb-3"><div className="text-xl font-bold text-blue-600" data-testid="text-leave-count">{totalSummary.on_leave}</div><p className="text-xs text-muted-foreground">On Leave</p></CardContent></Card>
        <Card><CardContent className="pt-3 pb-3"><div className="text-xl font-bold text-amber-600" data-testid="text-late-count">{totalSummary.late}</div><p className="text-xs text-muted-foreground">Late</p></CardContent></Card>
      </div>

      {isLoading ? <Skeleton className="h-60 w-full" /> : grid && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-auto max-h-[calc(100vh-320px)]">
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 z-10 bg-muted">
                  <tr>
                    <th className="text-left p-2 border-b font-medium sticky left-0 bg-muted z-20 min-w-[160px]">Employee</th>
                    {grid.days.map((day: string) => {
                      const { dayNum, dayName, isWeekend } = formatDay(day);
                      return (
                        <th key={day} className={`p-1 border-b text-center min-w-[36px] ${isWeekend ? "bg-muted/70" : ""}`}>
                          <div className="font-medium">{dayNum}</div>
                          <div className={`text-[10px] ${isWeekend ? "text-red-500" : "text-muted-foreground"}`}>{dayName}</div>
                        </th>
                      );
                    })}
                    <th className="p-2 border-b text-center min-w-[36px] font-medium">P</th>
                    <th className="p-2 border-b text-center min-w-[36px] font-medium">A</th>
                    <th className="p-2 border-b text-center min-w-[36px] font-medium">L</th>
                  </tr>
                </thead>
                <tbody>
                  {grid.employees.map((emp: any) => (
                    <tr key={emp.employee_id} className="hover:bg-muted/30 border-b">
                      <td className="p-2 sticky left-0 bg-background z-[5] border-r">
                        <p className="font-medium truncate max-w-[140px]">{emp.full_name}</p>
                        <p className="text-[10px] text-muted-foreground truncate max-w-[140px]">{emp.department || emp.position}</p>
                      </td>
                      {grid.days.map((day: string) => {
                        const entry = emp.attendance[day];
                        const { isWeekend } = formatDay(day);
                        const isFuture = day > new Date().toISOString().split("T")[0];
                        return (
                          <td key={day}
                            className={`p-0 text-center border-r cursor-pointer group ${isWeekend ? "bg-muted/30" : ""}`}
                            onClick={() => !isFuture && openEdit(emp.employee_id, day, entry)}
                            data-testid={`cell-${emp.employee_id}-${day}`}
                          >
                            {isFuture ? (
                              <span className="text-muted-foreground">-</span>
                            ) : entry ? (
                              <div className="relative">
                                <span className={`inline-block px-1 py-0.5 rounded text-[10px] font-medium ${statusColors[entry.status] || ""}`}>
                                  {statusLabel(entry.status)}
                                </span>
                                {entry.is_late && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-amber-500 rounded-full" />}
                                <Pencil className="h-2.5 w-2.5 absolute top-0 right-0 opacity-0 group-hover:opacity-50 text-muted-foreground" />
                              </div>
                            ) : (
                              <div className="relative">
                                <span className="text-red-400 text-[10px] font-medium">A</span>
                                <Pencil className="h-2.5 w-2.5 absolute top-0 right-0 opacity-0 group-hover:opacity-50 text-muted-foreground" />
                              </div>
                            )}
                          </td>
                        );
                      })}
                      <td className="p-1 text-center font-medium text-green-600">{emp.summary.present}</td>
                      <td className="p-1 text-center font-medium text-red-600">{emp.summary.absent}</td>
                      <td className="p-1 text-center font-medium text-blue-600">{emp.summary.on_leave}</td>
                    </tr>
                  ))}
                  {grid.employees.length === 0 && (
                    <tr><td colSpan={grid.days.length + 4} className="text-center p-8 text-muted-foreground">No employees found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!editingCell} onOpenChange={open => { if (!open) setEditingCell(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Attendance — {editingCell?.day && new Date(editingCell.day + "T00:00:00").toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" })}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Status</Label>
              <Select value={editForm.status} onValueChange={v => setEditForm(f => ({ ...f, status: v }))}>
                <SelectTrigger data-testid="select-att-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                  <SelectItem value="on_leave">On Leave</SelectItem>
                  <SelectItem value="half_day">Half Day</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editForm.status !== "absent" && editForm.status !== "on_leave" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Check In</Label>
                  <Input type="time" value={editForm.check_in} onChange={e => setEditForm(f => ({ ...f, check_in: e.target.value }))} data-testid="input-checkin" />
                </div>
                <div>
                  <Label>Check Out</Label>
                  <Input type="time" value={editForm.check_out} onChange={e => setEditForm(f => ({ ...f, check_out: e.target.value }))} data-testid="input-checkout" />
                </div>
              </div>
            )}
            <div>
              <Label>Notes</Label>
              <Input value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" data-testid="input-att-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCell(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={saveMutation.isPending} data-testid="btn-save-att">
              <Save className="h-4 w-4 mr-1" /> {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PayrollTab() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ organization_id: "", month: new Date().getMonth() + 1, year: new Date().getFullYear() });

  const { data: orgs } = useQuery<Organization[]>({ queryKey: ["/api/hrms/organizations"] });
  const { data: runs, isLoading } = useQuery<PayrollRun[]>({ queryKey: ["/api/hrms/payroll-runs"] });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/hrms/payroll-runs", data),
    onSuccess: () => { queryClient.refetchQueries({ queryKey: ["/api/hrms/payroll-runs"] }); setShowForm(false); toast({ title: "Payroll run created" }); },
  });

  const processMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/hrms/payroll-runs/${id}/process`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.refetchQueries({ queryKey: ["/api/hrms/payroll-runs"] });
      toast({
        title: data.payslip_count > 0 ? "Payroll processed" : "No payslips generated",
        description: data.message,
        variant: data.payslip_count > 0 ? "default" : "destructive",
      });
    },
    onError: () => { toast({ title: "Failed to process payroll", variant: "destructive" }); },
  });

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Payroll Runs</h3>
        <Button onClick={() => { setForm({ organization_id: orgs?.[0]?.id || "", month: new Date().getMonth() + 1, year: new Date().getFullYear() }); setShowForm(true); }} size="sm" data-testid="button-add-payroll"><Plus className="h-4 w-4 mr-1" /> New Payroll Run</Button>
      </div>

      {isLoading ? <Skeleton className="h-40 w-full" /> : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead>Organization</TableHead>
              <TableHead>Payslips</TableHead>
              <TableHead>Gross</TableHead>
              <TableHead>Deductions</TableHead>
              <TableHead>Net</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs?.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{months[r.month - 1]} {r.year}</TableCell>
                <TableCell>{r.organization_name}</TableCell>
                <TableCell>{r.payslip_count}</TableCell>
                <TableCell>Rs. {r.total_gross.toLocaleString()}</TableCell>
                <TableCell>Rs. {r.total_deductions.toLocaleString()}</TableCell>
                <TableCell className="font-medium">Rs. {r.total_net.toLocaleString()}</TableCell>
                <TableCell><Badge variant={r.status === "completed" ? "default" : r.status === "processing" ? "secondary" : "outline"}>{r.status}</Badge></TableCell>
                <TableCell>
                  {r.status === "draft" && (
                    <Button variant="default" size="sm" onClick={() => processMutation.mutate(r.id)} disabled={processMutation.isPending} data-testid={`button-process-${r.id}`}>
                      Process
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {(!runs || runs.length === 0) && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No payroll runs yet</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Payroll Run</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Organization</Label>
              <Select value={form.organization_id} onValueChange={v => setForm({ ...form, organization_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select organization" /></SelectTrigger>
                <SelectContent>{orgs?.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Month</Label>
                <Select value={String(form.month)} onValueChange={v => setForm({ ...form, month: parseInt(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{months.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Year</Label><Input type="number" value={form.year} onChange={e => setForm({ ...form, year: parseInt(e.target.value) || 2026 })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending} data-testid="button-save-payroll">Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HolidaysTab() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ organization_id: "", name: "", date: "", is_optional: false });

  const { data: orgs } = useQuery<Organization[]>({ queryKey: ["/api/hrms/organizations"] });
  const { data: holidays, isLoading } = useQuery<Holiday[]>({ queryKey: ["/api/hrms/holidays"] });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/hrms/holidays", data),
    onSuccess: () => { queryClient.refetchQueries({ queryKey: ["/api/hrms/holidays"] }); setShowForm(false); toast({ title: "Holiday added" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/hrms/holidays/${id}`),
    onSuccess: () => { queryClient.refetchQueries({ queryKey: ["/api/hrms/holidays"] }); toast({ title: "Holiday deleted" }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Holidays ({holidays?.length || 0})</h3>
        <Button onClick={() => { setForm({ organization_id: orgs?.[0]?.id || "", name: "", date: "", is_optional: false }); setShowForm(true); }} size="sm" data-testid="button-add-holiday"><Plus className="h-4 w-4 mr-1" /> Add Holiday</Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {holidays?.map(h => (
            <TableRow key={h.id}>
              <TableCell>{h.date}</TableCell>
              <TableCell className="font-medium">{h.name}</TableCell>
              <TableCell><Badge variant={h.is_optional ? "outline" : "default"}>{h.is_optional ? "Optional" : "Mandatory"}</Badge></TableCell>
              <TableCell><Button variant="ghost" size="sm" className="text-red-500" onClick={() => deleteMutation.mutate(h.id)}><Trash2 className="h-3 w-3" /></Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Holiday</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Organization</Label>
              <Select value={form.organization_id} onValueChange={v => setForm({ ...form, organization_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select organization" /></SelectTrigger>
                <SelectContent>{orgs?.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Holiday Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} data-testid="input-holiday-name" /></div>
            <div><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} data-testid="input-holiday-date" /></div>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.is_optional} onCheckedChange={v => setForm({ ...form, is_optional: !!v })} /> Optional Holiday</label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending} data-testid="button-save-holiday">Add Holiday</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const SIDEBAR_ITEMS = [
  { key: "staff-profiles", label: "Staff & Salary", icon: UserCog, group: "People" },
  { key: "attendance", label: "Attendance", icon: Clock, group: "People" },
  { key: "leave-types", label: "Leave Types", icon: TreePalm, group: "Leave" },
  { key: "leave-requests", label: "Leave Requests", icon: CalendarDays, group: "Leave" },
  { key: "holidays", label: "Holidays", icon: Calendar, group: "Leave" },
  { key: "bonuses", label: "Bonuses", icon: Gift, group: "Payroll & Finance" },
  { key: "expenses", label: "Travel Expenses", icon: Receipt, group: "Payroll & Finance" },
  { key: "advances", label: "Advances", icon: Banknote, group: "Payroll & Finance" },
  { key: "tax-slabs", label: "Tax Slabs", icon: Calculator, group: "Payroll & Finance" },
  { key: "payroll", label: "Payroll", icon: DollarSign, group: "Payroll & Finance" },
  { key: "govt-records", label: "Govt Records", icon: Landmark, group: "Payroll & Finance" },
  { key: "organizations", label: "Organizations", icon: Building2, group: "Settings" },
  { key: "departments", label: "Departments", icon: Users, group: "Settings" },
];

const CONTENT_MAP: Record<string, React.ComponentType> = {
  "staff-profiles": StaffProfilesTab,
  "attendance": AttendanceTab,
  "organizations": OrgTab,
  "departments": DeptTab,
  "leave-types": LeaveTypesTab,
  "leave-requests": LeaveRequestsTab,
  "holidays": HolidaysTab,
  "bonuses": BonusesTab,
  "expenses": TravelExpensesTab,
  "advances": AdvancePaymentsTab,
  "tax-slabs": TaxSlabsTab,
  "payroll": PayrollTab,
  "govt-records": GovernmentRecordsTab,
};

export default function HRMSAdminPage() {
  const [activeTab, setActiveTab] = useState("staff-profiles");

  const groups = SIDEBAR_ITEMS.reduce<Record<string, typeof SIDEBAR_ITEMS>>((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {});

  const ActiveComponent = CONTENT_MAP[activeTab];

  return (
    <div className="flex h-[calc(100vh-64px)]">
      <aside className="w-56 shrink-0 border-r bg-muted/30 overflow-y-auto">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            <h1 className="text-sm font-bold" data-testid="text-hrms-title">HRMS</h1>
          </div>
        </div>
        <nav className="p-2 space-y-4">
          {Object.entries(groups).map(([group, items]) => (
            <div key={group}>
              <p className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{group}</p>
              <div className="space-y-0.5">
                {items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => setActiveTab(item.key)}
                      data-testid={`tab-${item.key}`}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                        isActive
                          ? "bg-primary text-primary-foreground font-medium"
                          : "hover:bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto p-6">
        {ActiveComponent && <ActiveComponent />}
      </main>
    </div>
  );
}
