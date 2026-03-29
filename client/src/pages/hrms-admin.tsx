import { useState, useRef } from "react";
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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  ChevronLeft, ChevronRight, Save, ArrowLeft, CheckCircle,
  CreditCard, RotateCcw, Loader2, AlertTriangle, FileText,
  Download, Search, BarChart3, UserX, Timer, Globe, Wifi,
  ShieldCheck, ToggleLeft, ToggleRight, Upload, Sheet, Paperclip,
} from "lucide-react";
import { StaffProfilesTab } from "./hrms-staff-profiles";
import { BonusesTab } from "./hrms-bonuses";
import { TravelExpensesTab } from "./hrms-expenses";
import { AdvancePaymentsTab } from "./hrms-advances";
import { TaxSlabsTab } from "./hrms-tax-slabs";
import { GovernmentRecordsTab } from "./hrms-govt-records";
import { CountriesTab } from "./hrms-countries";
import { FiscalYearsTab } from "./hrms-fiscal-years";
import { AttendanceSummaryTab } from "./hrms-attendance-summary";
import { HRMSDashboardTab } from "./hrms-dashboard";
import { CURRENCIES, getCurrencySymbol } from "@/lib/currencies";

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

interface Organization {
  id: string; name: string; short_code: string; address: string | null;
  country: string | null; phone: string | null; email: string | null;
  registration_number: string | null; registration_label: string;
  pan_number: string | null; pan_label: string;
  currency: string; week_off_day: number; week_off_day_name: string;
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

interface DeptAllocation { id: string; department_id: string; department_name: string; allocated_days: number; }
interface LeaveType {
  id: string; organization_id: string; name: string; code: string;
  default_days: number; is_paid: boolean; is_carry_forward: boolean;
  max_carry_forward_days: number; min_advance_days: number; requires_document: boolean;
  document_required_after_days: number; color: string; status: string;
  department_allocations?: DeptAllocation[];
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
  cover_person_id: string | null; cover_person_name: string | null;
  document_url: string | null;
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
  const [form, setForm] = useState({ name: "", short_code: "", address: "", country: "", phone: "", email: "", registration_number: "", registration_label: "Registration No.", pan_number: "", pan_label: "PAN No.", currency: "NPR", week_off_day: "6" });

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

  const openCreate = () => { setForm({ name: "", short_code: "", address: "", country: "", phone: "", email: "", registration_number: "", registration_label: "Registration No.", pan_number: "", pan_label: "PAN No.", currency: "NPR", week_off_day: "6" }); setShowForm(true); };
  const openEdit = (o: Organization) => { setForm({ name: o.name, short_code: o.short_code, address: o.address || "", country: o.country || "", phone: o.phone || "", email: o.email || "", registration_number: o.registration_number || "", registration_label: o.registration_label || "Registration No.", pan_number: o.pan_number || "", pan_label: o.pan_label || "PAN No.", currency: o.currency || "NPR", week_off_day: String(o.week_off_day ?? 6) }); setEditOrg(o); };

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
              <p>Currency: <span className="font-medium text-foreground">{o.currency || 'NPR'}</span></p>
              <p>Weekly Off: <span className="font-medium text-foreground">{o.week_off_day_name || 'Sunday'}</span></p>
              {o.registration_number && <p>{o.registration_label || 'Registration No.'}: <span className="font-medium text-foreground">{o.registration_number}</span></p>}
              {o.pan_number && <p>{o.pan_label || 'PAN No.'}: <span className="font-medium text-foreground">{o.pan_number}</span></p>}
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
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Country</Label><Input value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} data-testid="input-org-country" /></div>
              <div>
                <Label>Currency</Label>
                <Select value={form.currency} onValueChange={v => setForm({ ...form, currency: v })}>
                  <SelectTrigger data-testid="select-org-currency"><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-60">
                    {CURRENCIES.map(c => <SelectItem key={c.code} value={c.code}>{c.code} ({c.symbol})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} data-testid="input-org-phone" /></div>
            </div>
            <div>
              <Label>Weekly Off Day</Label>
              <Select value={form.week_off_day} onValueChange={v => setForm({ ...form, week_off_day: v })}>
                <SelectTrigger data-testid="select-org-week-off"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Monday</SelectItem>
                  <SelectItem value="1">Tuesday</SelectItem>
                  <SelectItem value="2">Wednesday</SelectItem>
                  <SelectItem value="3">Thursday</SelectItem>
                  <SelectItem value="4">Friday</SelectItem>
                  <SelectItem value="5">Saturday</SelectItem>
                  <SelectItem value="6">Sunday</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} data-testid="input-org-email" /></div>
            <div><Label>Address</Label><Textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} data-testid="input-org-address" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Field Label</Label>
                <Input value={form.registration_label} onChange={e => setForm({ ...form, registration_label: e.target.value })} placeholder="e.g. ACN, Registration No." className="mb-1 h-7 text-xs" data-testid="input-org-reg-label" />
                <Label>{form.registration_label || 'Registration No.'}</Label>
                <Input value={form.registration_number} onChange={e => setForm({ ...form, registration_number: e.target.value })} data-testid="input-org-reg" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Field Label</Label>
                <Input value={form.pan_label} onChange={e => setForm({ ...form, pan_label: e.target.value })} placeholder="e.g. TIN, PAN No., ABN" className="mb-1 h-7 text-xs" data-testid="input-org-pan-label" />
                <Label>{form.pan_label || 'PAN No.'}</Label>
                <Input value={form.pan_number} onChange={e => setForm({ ...form, pan_number: e.target.value })} data-testid="input-org-pan" />
              </div>
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
  const [form, setForm] = useState({ organization_id: "", name: "", code: "", default_days: 0, is_paid: true, is_carry_forward: false, max_carry_forward_days: 0, min_advance_days: 0, requires_document: false, document_required_after_days: 0, color: "#3B82F6", hide_balance_from_employee: false });
  const [deptAllocLT, setDeptAllocLT] = useState<LeaveType | null>(null);
  const [deptAllocForm, setDeptAllocForm] = useState({ department_id: "", allocated_days: 0 });

  const { data: orgs } = useQuery<Organization[]>({ queryKey: ["/api/hrms/organizations"] });
  const { data: departments } = useQuery<Department[]>({ queryKey: ["/api/hrms/departments"] });
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

  const addDeptAllocMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/hrms/leave-types/${deptAllocLT?.id}/department-allocations`, data),
    onSuccess: () => { queryClient.refetchQueries({ queryKey: ["/api/hrms/leave-types"] }); setDeptAllocForm({ department_id: "", allocated_days: 0 }); toast({ title: "Department allocation saved" }); },
  });

  const deleteDeptAllocMutation = useMutation({
    mutationFn: ({ ltId, allocId }: { ltId: string; allocId: string }) => apiRequest("DELETE", `/api/hrms/leave-types/${ltId}/department-allocations`, { allocation_id: allocId }),
    onSuccess: () => { queryClient.refetchQueries({ queryKey: ["/api/hrms/leave-types"] }); toast({ title: "Department allocation removed" }); },
  });

  const openCreate = () => { setForm({ organization_id: orgs?.[0]?.id || "", name: "", code: "", default_days: 0, is_paid: true, is_carry_forward: false, max_carry_forward_days: 0, min_advance_days: 0, requires_document: false, document_required_after_days: 0, color: "#3B82F6", hide_balance_from_employee: false }); setShowForm(true); };

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
            <TableHead>Dept Allocations</TableHead>
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
              <TableCell>
                {(lt.department_allocations || []).length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {lt.department_allocations!.map(da => (
                      <span key={da.id} className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        {da.department_name}: {da.allocated_days}d
                      </span>
                    ))}
                  </div>
                ) : <span className="text-xs text-muted-foreground">Default for all</span>}
              </TableCell>
              <TableCell>{lt.is_paid ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-red-500" />}</TableCell>
              <TableCell>{lt.is_carry_forward ? `Yes (max ${lt.max_carry_forward_days})` : "No"}</TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => { setForm({ organization_id: lt.organization_id, name: lt.name, code: lt.code, default_days: lt.default_days, is_paid: lt.is_paid, is_carry_forward: lt.is_carry_forward, max_carry_forward_days: lt.max_carry_forward_days, min_advance_days: lt.min_advance_days || 0, requires_document: lt.requires_document, document_required_after_days: lt.document_required_after_days, color: lt.color, hide_balance_from_employee: !!(lt as any).hide_balance_from_employee }); setEditLT(lt); }}><Pencil className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="sm" title="Department allocations" onClick={() => setDeptAllocLT(lt)} data-testid={`btn-dept-alloc-${lt.id}`}><Building2 className="h-3 w-3" /></Button>
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
            <div className="flex gap-6 flex-wrap">
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.is_paid} onCheckedChange={v => setForm({ ...form, is_paid: !!v })} /> Paid Leave</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.is_carry_forward} onCheckedChange={v => setForm({ ...form, is_carry_forward: !!v })} /> Carry Forward</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.requires_document} onCheckedChange={v => setForm({ ...form, requires_document: !!v })} /> Requires Document</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.hide_balance_from_employee} onCheckedChange={v => setForm({ ...form, hide_balance_from_employee: !!v })} data-testid="checkbox-hide-balance" /> Hide Balance from Employee</label>
            </div>
            {form.is_carry_forward && <div><Label>Max Carry Forward Days</Label><Input type="number" value={form.max_carry_forward_days} onChange={e => setForm({ ...form, max_carry_forward_days: parseFloat(e.target.value) || 0 })} /></div>}
            <div><Label>Min Advance Days (Pre-Inform)</Label><Input type="number" min="0" value={form.min_advance_days} onChange={e => setForm({ ...form, min_advance_days: parseInt(e.target.value) || 0 })} data-testid="input-min-advance-days" /><p className="text-xs text-muted-foreground mt-0.5">How many days before the leave date must the employee apply (0 = no restriction)</p></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowForm(false); setEditLT(null); }}>Cancel</Button>
            <Button onClick={() => editLT ? updateMutation.mutate(form) : createMutation.mutate(form)} disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-lt">
              {editLT ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deptAllocLT} onOpenChange={(open) => { if (!open) setDeptAllocLT(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Department Allocations — {deptAllocLT?.name}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Override default days ({deptAllocLT?.default_days}) for specific departments. Departments without an override use the default.
          </p>
          <div className="space-y-3">
            {(deptAllocLT?.department_allocations || []).length > 0 && (
              <div className="border rounded-lg divide-y">
                {deptAllocLT!.department_allocations!.map(da => (
                  <div key={da.id} className="flex items-center justify-between px-3 py-2" data-testid={`dept-alloc-${da.id}`}>
                    <span className="text-sm font-medium">{da.department_name}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{da.allocated_days} days</Badge>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => deleteDeptAllocMutation.mutate({ ltId: deptAllocLT!.id, allocId: da.id })}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label className="text-xs">Department</Label>
                <Select value={deptAllocForm.department_id} onValueChange={v => setDeptAllocForm(f => ({ ...f, department_id: v }))}>
                  <SelectTrigger data-testid="select-dept-alloc-dept"><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>
                    {departments?.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-24">
                <Label className="text-xs">Days</Label>
                <Input type="number" min="0" step="0.5" value={deptAllocForm.allocated_days} onChange={e => setDeptAllocForm(f => ({ ...f, allocated_days: parseFloat(e.target.value) || 0 }))} data-testid="input-dept-alloc-days" />
              </div>
              <Button size="sm" onClick={() => { if (!deptAllocForm.department_id) return; addDeptAllocMutation.mutate(deptAllocForm); }} disabled={addDeptAllocMutation.isPending || !deptAllocForm.department_id} data-testid="btn-add-dept-alloc">
                <Plus className="h-3.5 w-3.5 mr-1" /> Add
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LeaveRequestsTab() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState({ employee_id: "", leave_type_id: "", start_date: "", end_date: "", reason: "", is_half_day: false, half_day_period: "first_half", auto_approve: false });
  const [createLoading, setCreateLoading] = useState(false);

  const { data: requests, isLoading } = useQuery<LeaveRequest[]>({
    queryKey: ["/api/hrms/leave-requests", statusFilter],
    queryFn: async () => {
      const url = statusFilter === "all" ? '/api/hrms/leave-requests' : `/api/hrms/leave-requests?status=${statusFilter}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: employees } = useQuery<any[]>({
    queryKey: ["/api/hrms/staff-profiles"],
    queryFn: async () => {
      const res = await fetch("/api/hrms/staff-profiles", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: leaveTypes } = useQuery<LeaveType[]>({ queryKey: ["/api/hrms/leave-types"] });

  const handleCreate = async () => {
    if (!createForm.employee_id || !createForm.leave_type_id || !createForm.start_date || !createForm.end_date) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }
    setCreateLoading(true);
    try {
      await apiRequest("POST", "/api/hrms/leave-requests", createForm);
      queryClient.refetchQueries({ queryKey: ["/api/hrms/leave-requests"] });
      toast({ title: createForm.auto_approve ? "Leave request created and approved" : "Leave request created" });
      setShowCreateDialog(false);
      setCreateForm({ employee_id: "", leave_type_id: "", start_date: "", end_date: "", reason: "", is_half_day: false, half_day_period: "first_half", auto_approve: false });
    } catch (err: any) {
      toast({ title: err?.message || "Failed to create", variant: "destructive" });
    }
    setCreateLoading(false);
  };

  const [approveConfirmId, setApproveConfirmId] = useState<string | null>(null);
  const [rejectConfirmId, setRejectConfirmId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [adminCancelId, setAdminCancelId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const handleApprove = async () => {
    if (!approveConfirmId) return;
    setActionLoading(true);
    try {
      await apiRequest("POST", `/api/hrms/leave-requests/${approveConfirmId}/approve`);
      queryClient.refetchQueries({ queryKey: ["/api/hrms/leave-requests"] });
      toast({ title: "Leave request approved" });
      setApproveConfirmId(null);
    } catch (err: any) {
      const msg = err?.message || "Failed to approve";
      toast({ title: msg, variant: "destructive" });
    }
    setActionLoading(false);
  };

  const handleReject = async () => {
    if (!rejectConfirmId || !rejectReason.trim()) return;
    setActionLoading(true);
    try {
      await apiRequest("POST", `/api/hrms/leave-requests/${rejectConfirmId}/reject`, { rejection_reason: rejectReason });
      queryClient.refetchQueries({ queryKey: ["/api/hrms/leave-requests"] });
      toast({ title: "Leave request rejected" });
      setRejectConfirmId(null);
      setRejectReason("");
    } catch (err: any) {
      const msg = err?.message || "Failed to reject";
      toast({ title: msg, variant: "destructive" });
    }
    setActionLoading(false);
  };

  const handleAdminCancel = async () => {
    if (!adminCancelId) return;
    setActionLoading(true);
    try {
      await apiRequest("POST", `/api/hrms/leave-requests/${adminCancelId}/cancel`);
      queryClient.refetchQueries({ queryKey: ["/api/hrms/leave-requests"] });
      toast({ title: "Leave cancelled and balance restored" });
      setAdminCancelId(null);
    } catch (err: any) {
      const msg = err?.message || "Failed to cancel leave";
      toast({ title: msg, variant: "destructive" });
    }
    setActionLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Leave Requests</h3>
        <div className="flex gap-2 flex-wrap items-center">
          {["all", "pending", "approved", "rejected", "cancelled", "cancel_requested"].map(s => (
            <Button key={s} variant={statusFilter === s ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(s)} data-testid={`button-filter-${s}`}>
              {s === "cancel_requested" ? "Cancel Requested" : s.charAt(0).toUpperCase() + s.slice(1)}
            </Button>
          ))}
          <Button size="sm" onClick={() => setShowCreateDialog(true)} data-testid="button-create-leave"><Plus className="h-4 w-4 mr-1" /> Create Leave</Button>
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
              <TableHead>Cover Person</TableHead>
              <TableHead>Document</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
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
                <TableCell className="text-sm">{r.cover_person_name || "—"}</TableCell>
                <TableCell>
                  {r.document_url ? (
                    <a href={r.document_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline text-xs" data-testid={`link-admin-doc-${r.id}`}>
                      <Paperclip className="h-3 w-3" /> View
                    </a>
                  ) : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : r.status === "cancel_requested" ? "outline" : "secondary"}>
                    {r.status === "cancel_requested" ? "Cancel Requested" : r.status}
                  </Badge>
                  {r.status === "rejected" && r.rejection_reason && (
                    <p className="text-[10px] text-red-500 mt-0.5 max-w-[120px] truncate" title={r.rejection_reason}>{r.rejection_reason}</p>
                  )}
                  {r.status === "cancel_requested" && r.cancellation_reason && (
                    <p className="text-[10px] text-amber-600 mt-0.5 max-w-[120px] truncate" title={r.cancellation_reason}>{r.cancellation_reason}</p>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {r.status === "pending" && (
                      <>
                        <Button variant="ghost" size="sm" className="text-green-600" onClick={() => setApproveConfirmId(r.id)} data-testid={`button-approve-${r.id}`}><Check className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" className="text-red-500" onClick={() => { setRejectConfirmId(r.id); setRejectReason(""); }} data-testid={`button-reject-${r.id}`}><X className="h-4 w-4" /></Button>
                      </>
                    )}
                    {(r.status === "approved" || r.status === "cancel_requested") && (
                      <Button variant="ghost" size="sm" className="text-red-500 text-xs" onClick={() => setAdminCancelId(r.id)} data-testid={`button-admin-cancel-${r.id}`}>Cancel</Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {(!requests || requests.length === 0) && (
              <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No {statusFilter === "all" ? "" : statusFilter === "cancel_requested" ? "cancel requested " : statusFilter + " "}leave requests</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <Dialog open={!!approveConfirmId} onOpenChange={v => { if (!v) setApproveConfirmId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Approve Leave Request</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to approve this leave request? The employee's leave balance will be deducted and attendance records will be created.</p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setApproveConfirmId(null)}>Cancel</Button>
            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={handleApprove} disabled={actionLoading} data-testid="button-confirm-approve">
              {actionLoading && <Loader2 className="h-3 w-3 animate-spin mr-1" />} Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectConfirmId} onOpenChange={v => { if (!v) { setRejectConfirmId(null); setRejectReason(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Reject Leave Request</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Please provide a reason for rejecting this leave request. The employee will be notified with this reason.</p>
            <div>
              <Label>Rejection Reason</Label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm mt-1"
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Reason for rejection..."
                data-testid="input-rejection-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setRejectConfirmId(null); setRejectReason(""); }}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={handleReject} disabled={actionLoading || !rejectReason.trim()} data-testid="button-confirm-reject">
              {actionLoading && <Loader2 className="h-3 w-3 animate-spin mr-1" />} Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!adminCancelId} onOpenChange={v => { if (!v) setAdminCancelId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Cancel Leave</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to cancel this leave? The employee's leave balance will be restored, attendance records will be removed, and the employee will be notified.</p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAdminCancelId(null)}>No, Keep</Button>
            <Button variant="destructive" size="sm" onClick={handleAdminCancel} disabled={actionLoading} data-testid="button-confirm-admin-cancel">
              {actionLoading && <Loader2 className="h-3 w-3 animate-spin mr-1" />} Yes, Cancel Leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateDialog} onOpenChange={v => { if (!v) { setShowCreateDialog(false); setCreateForm({ employee_id: "", leave_type_id: "", start_date: "", end_date: "", reason: "", is_half_day: false, half_day_period: "first_half", auto_approve: false }); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Create Leave Request</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">Create a leave request on behalf of an employee (e.g., for email requests). Enable "Auto Approve" to immediately approve it.</p>
          <div className="space-y-3">
            <div>
              <Label>Employee *</Label>
              <Select value={createForm.employee_id} onValueChange={v => setCreateForm(f => ({ ...f, employee_id: v }))}>
                <SelectTrigger data-testid="select-create-employee"><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {employees?.filter((e: any) => e.status === "active").map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Leave Type *</Label>
              <Select value={createForm.leave_type_id} onValueChange={v => setCreateForm(f => ({ ...f, leave_type_id: v }))}>
                <SelectTrigger data-testid="select-create-leave-type"><SelectValue placeholder="Select leave type" /></SelectTrigger>
                <SelectContent>
                  {leaveTypes?.filter(lt => lt.status === "active").map(lt => (
                    <SelectItem key={lt.id} value={lt.id}>{lt.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Date *</Label>
                <Input type="date" value={createForm.start_date} onChange={e => setCreateForm(f => ({ ...f, start_date: e.target.value }))} data-testid="input-create-start-date" />
              </div>
              <div>
                <Label>End Date *</Label>
                <Input type="date" value={createForm.end_date} onChange={e => setCreateForm(f => ({ ...f, end_date: e.target.value }))} data-testid="input-create-end-date" />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={createForm.is_half_day} onChange={e => setCreateForm(f => ({ ...f, is_half_day: e.target.checked, end_date: e.target.checked ? f.start_date : f.end_date }))} className="rounded" data-testid="checkbox-create-half-day" />
                Half Day
              </label>
              {createForm.is_half_day && (
                <Select value={createForm.half_day_period} onValueChange={v => setCreateForm(f => ({ ...f, half_day_period: v }))}>
                  <SelectTrigger className="w-[130px]" data-testid="select-create-half-day-period"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="first_half">First Half</SelectItem>
                    <SelectItem value="second_half">Second Half</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <Label>Reason</Label>
              <textarea className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm mt-1" value={createForm.reason} onChange={e => setCreateForm(f => ({ ...f, reason: e.target.value }))} placeholder="Reason for leave..." data-testid="input-create-reason" />
            </div>
            <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-md border border-blue-200 dark:border-blue-800">
              <input type="checkbox" checked={createForm.auto_approve} onChange={e => setCreateForm(f => ({ ...f, auto_approve: e.target.checked }))} className="rounded" id="auto-approve-check" data-testid="checkbox-auto-approve" />
              <label htmlFor="auto-approve-check" className="text-sm font-medium cursor-pointer">Auto Approve</label>
              <span className="text-xs text-muted-foreground ml-1">— Immediately approve this leave request</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreate} disabled={createLoading} data-testid="button-confirm-create-leave">
              {createLoading && <Loader2 className="h-3 w-3 animate-spin mr-1" />} {createForm.auto_approve ? "Create & Approve" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AttendanceTab() {
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<"daily" | "weekly" | "monthly">("monthly");
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split("T")[0]);
  const [editingCell, setEditingCell] = useState<{ empId: string; day: string } | null>(null);
  const [editForm, setEditForm] = useState({ status: "present", check_in: "", check_out: "", notes: "" });
  const [searchTerm, setSearchTerm] = useState("");
  const [showDashboard, setShowDashboard] = useState(true);
  const [filterOrg, setFilterOrg] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showScheduleSettings, setShowScheduleSettings] = useState(false);
  const [scheduleEditDept, setScheduleEditDept] = useState<Department | null>(null);
  const [scheduleForm, setScheduleForm] = useState({ working_days_per_week: 6, work_start_time: "10:00", work_end_time: "18:00", late_threshold_minutes: 15, early_leave_threshold_minutes: 15 });
  const [empScheduleId, setEmpScheduleId] = useState<string | null>(null);
  const [empScheduleData, setEmpScheduleData] = useState<any>(null);
  const [empScheduleForm, setEmpScheduleForm] = useState({ working_days_per_week: "", week_off_days: "", work_start_time: "", work_end_time: "" });
  const [empScheduleLoading, setEmpScheduleLoading] = useState(false);
  const [empScheduleSaving, setEmpScheduleSaving] = useState(false);

  const { data: organizations } = useQuery<any[]>({
    queryKey: ["/api/hrms/organizations"],
    queryFn: async () => {
      const res = await fetch("/api/hrms/organizations", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });
  const { data: departments } = useQuery<any[]>({
    queryKey: ["/api/hrms/departments"],
    queryFn: async () => {
      const res = await fetch("/api/hrms/departments", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: grid, isLoading } = useQuery<any>({
    queryKey: ["/api/hrms/attendance/grid", viewMode, currentDate, filterOrg, filterDept],
    queryFn: async () => {
      const params = new URLSearchParams({ mode: viewMode, date: currentDate });
      if (filterOrg) params.append("organization_id", filterOrg);
      if (filterDept) params.append("department_id", filterDept);
      const res = await fetch(`/api/hrms/attendance/grid?${params}`, { credentials: "include" });
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

  const scheduleUpdateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PUT", `/api/hrms/departments/${id}`, data);
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/hrms/departments"] });
      setScheduleEditDept(null);
      toast({ title: "Work schedule updated" });
    },
    onError: () => toast({ title: "Failed to update schedule", variant: "destructive" }),
  });

  const openScheduleEdit = (dept: Department) => {
    setScheduleEditDept(dept);
    setScheduleForm({
      working_days_per_week: dept.working_days_per_week,
      work_start_time: dept.work_start_time || "10:00",
      work_end_time: dept.work_end_time || "18:00",
      late_threshold_minutes: dept.late_threshold_minutes,
      early_leave_threshold_minutes: dept.early_leave_threshold_minutes,
    });
  };

  const saveSchedule = () => {
    if (!scheduleEditDept) return;
    scheduleUpdateMutation.mutate({ id: scheduleEditDept.id, data: scheduleForm });
  };

  const openEmpSchedule = async (empId: string) => {
    setEmpScheduleId(empId);
    setEmpScheduleData(null);
    setEmpScheduleLoading(true);
    try {
      const res = await fetch(`/api/hrms/employees/${empId}/work-schedule`, { credentials: "include" });
      if (res.ok) {
        const d = await res.json();
        setEmpScheduleData(d);
        setEmpScheduleForm({
          working_days_per_week: d.working_days_per_week != null ? String(d.working_days_per_week) : "",
          week_off_days: d.week_off_days ? d.week_off_days.join(",") : "",
          work_start_time: d.work_start_time || "",
          work_end_time: d.work_end_time || "",
        });
      }
    } catch {}
    setEmpScheduleLoading(false);
  };

  const saveEmpSchedule = async () => {
    if (!empScheduleId) return;
    setEmpScheduleSaving(true);
    try {
      const payload: any = {
        working_days_per_week: empScheduleForm.working_days_per_week ? parseInt(empScheduleForm.working_days_per_week) : null,
        week_off_days: empScheduleForm.week_off_days ? empScheduleForm.week_off_days.split(",").map((v: string) => parseInt(v.trim())).filter((v: number) => !isNaN(v)) : null,
        work_start_time: empScheduleForm.work_start_time || null,
        work_end_time: empScheduleForm.work_end_time || null,
      };
      const res = await fetch(`/api/hrms/employees/${empScheduleId}/work-schedule`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast({ title: "Work schedule updated" });
        setEmpScheduleId(null);
        queryClient.invalidateQueries({ queryKey: ["/api/hrms/attendance/grid"] });
        queryClient.invalidateQueries({ queryKey: ["/api/hrms/staff-profiles"] });
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: "Error", description: err.message || "Failed to update", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to update", variant: "destructive" });
    }
    setEmpScheduleSaving(false);
  };

  const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const navDate = (dir: number) => {
    const d = new Date(currentDate);
    if (viewMode === "daily") d.setDate(d.getDate() + dir);
    else if (viewMode === "weekly") d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setCurrentDate(d.toISOString().split("T")[0]);
  };

  const extractTime = (isoStr: string | null) => {
    if (!isoStr) return "";
    try {
      const d = new Date(isoStr);
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    } catch {
      const tIdx = isoStr.indexOf("T");
      if (tIdx >= 0) return isoStr.substring(tIdx + 1, tIdx + 6);
      return "";
    }
  };

  const openEdit = (empId: string, day: string, existing: any) => {
    setEditingCell({ empId, day });
    setEditForm({
      status: existing?.status || "present",
      check_in: extractTime(existing?.check_in),
      check_out: extractTime(existing?.check_out),
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

  const gridStatusColors: Record<string, string> = {
    present: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    partial: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    absent: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    leave: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    half_leave: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400",
    holiday: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    day_off: "bg-gray-100 text-gray-500 dark:bg-gray-800/30 dark:text-gray-400",
    on_leave: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    half_day: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  };

  const gridStatusLabel = (gs: string) => ({
    present: "P", partial: "P*", absent: "A", leave: "L",
    half_leave: "HL", holiday: "H", day_off: "D", on_leave: "L", half_day: "H",
  }[gs] || "-");

  const statusColors = gridStatusColors;
  const statusLabel = (s: string) => gridStatusLabel(s);

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

  const allEmployees = grid?.employees || [];
  const filteredEmployees = allEmployees.filter((emp: any) => {
    if (searchTerm && !emp.full_name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !(emp.department || "").toLowerCase().includes(searchTerm.toLowerCase()) &&
        !(emp.position || "").toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (filterStatus) {
      const days = grid?.days || [];
      const todayStr = new Date().toISOString().split("T")[0];
      const latestDay = days.filter((d: string) => d <= todayStr).pop();
      if (latestDay) {
        const entry = emp.attendance[latestDay];
        const gs = entry?.grid_status || entry?.status || "absent";
        if (filterStatus === "late") {
          if (!entry?.is_late) return false;
        } else if (filterStatus === "present") {
          if (gs !== "present" && gs !== "partial" && gs !== "half_leave") return false;
        } else if (filterStatus === "on_leave") {
          if (gs !== "leave" && gs !== "on_leave") return false;
        } else if (gs !== filterStatus) return false;
      }
    }
    return true;
  });

  const totalSummary = allEmployees.reduce(
    (acc: any, emp: any) => ({
      present: acc.present + emp.summary.present,
      absent: acc.absent + emp.summary.absent,
      on_leave: acc.on_leave + emp.summary.on_leave,
      late: acc.late + emp.summary.late,
    }),
    { present: 0, absent: 0, on_leave: 0, late: 0 }
  );

  const totalStaff = allEmployees.length;
  const todayStr = new Date().toISOString().split("T")[0];
  const hasTodayInGrid = grid?.days?.includes(todayStr);
  const getGridStatus = (e: any, day: string) => e.attendance[day]?.grid_status || e.attendance[day]?.status || null;
  const todayPresent = hasTodayInGrid ? allEmployees.filter((e: any) => { const gs = getGridStatus(e, todayStr); return gs === 'present' || gs === 'partial' || gs === 'half_leave'; }).length : 0;
  const todayAbsent = hasTodayInGrid ? allEmployees.filter((e: any) => { const gs = getGridStatus(e, todayStr); return gs === 'absent'; }).length : 0;
  const todayLate = hasTodayInGrid ? allEmployees.filter((e: any) => e.attendance[todayStr]?.is_late).length : 0;
  const todayOnLeave = hasTodayInGrid ? allEmployees.filter((e: any) => { const gs = getGridStatus(e, todayStr); return gs === 'leave' || gs === 'on_leave'; }).length : 0;
  const workingStaff = hasTodayInGrid ? allEmployees.filter((e: any) => { const gs = getGridStatus(e, todayStr); return gs !== 'holiday' && gs !== 'day_off'; }).length : totalStaff;
  const attendanceRate = workingStaff > 0 && hasTodayInGrid ? Math.round((todayPresent / workingStaff) * 100) : 0;

  const topAbsentees = [...allEmployees]
    .sort((a: any, b: any) => b.summary.absent - a.summary.absent)
    .slice(0, 5)
    .filter((e: any) => e.summary.absent > 0);

  const topLateComers = [...allEmployees]
    .sort((a: any, b: any) => b.summary.late - a.summary.late)
    .slice(0, 5)
    .filter((e: any) => e.summary.late > 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold" data-testid="text-att-title">Attendance</h3>
          <Button variant={showDashboard ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => setShowDashboard(!showDashboard)} data-testid="btn-toggle-dashboard">
            <BarChart3 className="w-3.5 h-3.5 mr-1" /> Dashboard
          </Button>
          <Button variant={showScheduleSettings ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => setShowScheduleSettings(!showScheduleSettings)} data-testid="btn-toggle-schedule">
            <Settings className="w-3.5 h-3.5 mr-1" /> Work Schedule
          </Button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filterOrg} onValueChange={v => { setFilterOrg(v === "__all__" ? "" : v); setFilterDept(""); }}>
            <SelectTrigger className="w-44 h-8 text-xs" data-testid="select-att-org"><SelectValue placeholder="All Organizations" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Organizations</SelectItem>
              {organizations?.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterDept} onValueChange={v => setFilterDept(v === "__all__" ? "" : v)}>
            <SelectTrigger className="w-44 h-8 text-xs" data-testid="select-att-dept"><SelectValue placeholder="All Departments" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Departments</SelectItem>
              {(departments || []).filter((d: any) => !filterOrg || d.organization_id === filterOrg).map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={v => setFilterStatus(v === "__all__" ? "" : v)}>
            <SelectTrigger className="w-36 h-8 text-xs" data-testid="select-att-status-filter"><SelectValue placeholder="All Statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Statuses</SelectItem>
              <SelectItem value="present">Present</SelectItem>
              <SelectItem value="absent">Absent</SelectItem>
              <SelectItem value="on_leave">On Leave</SelectItem>
              <SelectItem value="half_day">Half Day</SelectItem>
              <SelectItem value="late">Late</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search employee..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-48 h-8 text-xs pl-7"
              data-testid="input-att-search"
            />
          </div>
          <div className="flex border rounded-md overflow-hidden">
            {(["daily", "weekly", "monthly"] as const).map(m => (
              <button key={m} onClick={() => setViewMode(m)} data-testid={`btn-mode-${m}`}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === m ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{m.charAt(0).toUpperCase() + m.slice(1)}</button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navDate(-1)} data-testid="btn-prev"><ChevronLeft className="h-4 w-4" /></Button>
            <span className="text-sm font-medium min-w-[160px] text-center">{periodLabel()}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navDate(1)} data-testid="btn-next"><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <Input type="date" value={currentDate} onChange={e => setCurrentDate(e.target.value)} className="w-auto h-8 text-xs" data-testid="input-att-date" />
        </div>
      </div>

      {showDashboard && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <Card><CardContent className="pt-3 pb-3">
              <div className="flex items-center gap-2"><Users className="w-4 h-4 text-primary" /><p className="text-xs text-muted-foreground">Total Staff</p></div>
              <div className="text-2xl font-bold mt-1" data-testid="text-total-staff">{totalStaff}</div>
            </CardContent></Card>
            <Card className="border-green-200 bg-green-50/50"><CardContent className="pt-3 pb-3">
              <div className="flex items-center gap-2"><Check className="w-4 h-4 text-green-600" /><p className="text-xs text-muted-foreground">{hasTodayInGrid ? "Today Present" : "Present (today N/A)"}</p></div>
              <div className="text-2xl font-bold text-green-600 mt-1" data-testid="text-today-present">{hasTodayInGrid ? todayPresent : "—"}</div>
            </CardContent></Card>
            <Card className="border-red-200 bg-red-50/50"><CardContent className="pt-3 pb-3">
              <div className="flex items-center gap-2"><UserX className="w-4 h-4 text-red-600" /><p className="text-xs text-muted-foreground">{hasTodayInGrid ? "Today Absent" : "Absent (today N/A)"}</p></div>
              <div className="text-2xl font-bold text-red-600 mt-1" data-testid="text-today-absent">{hasTodayInGrid ? todayAbsent : "—"}</div>
            </CardContent></Card>
            <Card className="border-amber-200 bg-amber-50/50"><CardContent className="pt-3 pb-3">
              <div className="flex items-center gap-2"><Timer className="w-4 h-4 text-amber-600" /><p className="text-xs text-muted-foreground">{hasTodayInGrid ? "Today Late" : "Late (today N/A)"}</p></div>
              <div className="text-2xl font-bold text-amber-600 mt-1" data-testid="text-today-late">{hasTodayInGrid ? todayLate : "—"}</div>
            </CardContent></Card>
            <Card className="border-blue-200 bg-blue-50/50"><CardContent className="pt-3 pb-3">
              <div className="flex items-center gap-2"><CalendarDays className="w-4 h-4 text-blue-600" /><p className="text-xs text-muted-foreground">{hasTodayInGrid ? "On Leave" : "Leave (today N/A)"}</p></div>
              <div className="text-2xl font-bold text-blue-600 mt-1" data-testid="text-today-leave">{hasTodayInGrid ? todayOnLeave : "—"}</div>
            </CardContent></Card>
            <Card className="border-primary/30 bg-primary/5"><CardContent className="pt-3 pb-3">
              <div className="flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" /><p className="text-xs text-muted-foreground">{hasTodayInGrid ? "Attendance Rate" : "Rate (today N/A)"}</p></div>
              <div className="text-2xl font-bold text-primary mt-1" data-testid="text-att-rate">{hasTodayInGrid ? `${attendanceRate}%` : "—"}</div>
            </CardContent></Card>
          </div>

          {(topAbsentees.length > 0 || topLateComers.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {topAbsentees.length > 0 && (
                <Card>
                  <CardHeader className="pb-2 pt-3 px-4"><CardTitle className="text-sm font-medium flex items-center gap-2"><UserX className="w-4 h-4 text-red-500" /> Most Absent ({periodLabel()})</CardTitle></CardHeader>
                  <CardContent className="px-4 pb-3">
                    <div className="space-y-1.5">
                      {topAbsentees.map((emp: any, i: number) => (
                        <div key={emp.employee_id} className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                            <span className="truncate max-w-[150px]">{emp.full_name}</span>
                          </span>
                          <Badge variant="outline" className="text-red-600 border-red-200 text-xs">{emp.summary.absent} days</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              {topLateComers.length > 0 && (
                <Card>
                  <CardHeader className="pb-2 pt-3 px-4"><CardTitle className="text-sm font-medium flex items-center gap-2"><Timer className="w-4 h-4 text-amber-500" /> Most Late ({periodLabel()})</CardTitle></CardHeader>
                  <CardContent className="px-4 pb-3">
                    <div className="space-y-1.5">
                      {topLateComers.map((emp: any, i: number) => (
                        <div key={emp.employee_id} className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                            <span className="truncate max-w-[150px]">{emp.full_name}</span>
                          </span>
                          <Badge variant="outline" className="text-amber-600 border-amber-200 text-xs">{emp.summary.late} times</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardContent className="pt-3 pb-3"><div className="text-xl font-bold text-green-600" data-testid="text-present-count">{totalSummary.present}</div><p className="text-xs text-muted-foreground">Total Present ({periodLabel()})</p></CardContent></Card>
            <Card><CardContent className="pt-3 pb-3"><div className="text-xl font-bold text-red-600" data-testid="text-absent-count">{totalSummary.absent}</div><p className="text-xs text-muted-foreground">Total Absent ({periodLabel()})</p></CardContent></Card>
            <Card><CardContent className="pt-3 pb-3"><div className="text-xl font-bold text-blue-600" data-testid="text-leave-count">{totalSummary.on_leave}</div><p className="text-xs text-muted-foreground">Total On Leave ({periodLabel()})</p></CardContent></Card>
            <Card><CardContent className="pt-3 pb-3"><div className="text-xl font-bold text-amber-600" data-testid="text-late-count">{totalSummary.late}</div><p className="text-xs text-muted-foreground">Total Late ({periodLabel()})</p></CardContent></Card>
          </div>
        </>
      )}

      {showScheduleSettings && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Settings className="w-4 h-4" /> Work Schedule Settings (per Department)
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="overflow-auto max-h-80">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Department</TableHead>
                    <TableHead className="text-xs">Working Days/Week</TableHead>
                    <TableHead className="text-xs">Start Time</TableHead>
                    <TableHead className="text-xs">End Time</TableHead>
                    <TableHead className="text-xs">Late Threshold</TableHead>
                    <TableHead className="text-xs">Early Leave Threshold</TableHead>
                    <TableHead className="text-xs w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(departments || []).filter((d: any) => !filterOrg || d.organization_id === filterOrg).map((d: any) => (
                    <TableRow key={d.id}>
                      <TableCell className="text-xs font-medium">{d.name}</TableCell>
                      <TableCell className="text-xs">{d.working_days_per_week} days</TableCell>
                      <TableCell className="text-xs">{d.work_start_time || "—"}</TableCell>
                      <TableCell className="text-xs">{d.work_end_time || "—"}</TableCell>
                      <TableCell className="text-xs">{d.late_threshold_minutes} min</TableCell>
                      <TableCell className="text-xs">{d.early_leave_threshold_minutes} min</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openScheduleEdit(d)} data-testid={`btn-edit-schedule-${d.id}`}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">These are default schedules per department. You can also override per employee in Staff Profiles → Edit Employee → Work Schedule.</p>
          </CardContent>
        </Card>
      )}

      {scheduleEditDept && (
        <Dialog open={!!scheduleEditDept} onOpenChange={v => { if (!v) setScheduleEditDept(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base">Edit Schedule — {scheduleEditDept.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Working Days/Week</Label><Input type="number" min={1} max={7} value={scheduleForm.working_days_per_week} onChange={e => setScheduleForm({ ...scheduleForm, working_days_per_week: parseInt(e.target.value) || 6 })} data-testid="input-sched-wdpw" /></div>
                <div></div>
                <div><Label className="text-xs">Start Time</Label><Input type="time" value={scheduleForm.work_start_time} onChange={e => setScheduleForm({ ...scheduleForm, work_start_time: e.target.value })} data-testid="input-sched-start" /></div>
                <div><Label className="text-xs">End Time</Label><Input type="time" value={scheduleForm.work_end_time} onChange={e => setScheduleForm({ ...scheduleForm, work_end_time: e.target.value })} data-testid="input-sched-end" /></div>
                <div><Label className="text-xs">Late Threshold (min)</Label><Input type="number" value={scheduleForm.late_threshold_minutes} onChange={e => setScheduleForm({ ...scheduleForm, late_threshold_minutes: parseInt(e.target.value) || 0 })} data-testid="input-sched-late" /></div>
                <div><Label className="text-xs">Early Leave Threshold (min)</Label><Input type="number" value={scheduleForm.early_leave_threshold_minutes} onChange={e => setScheduleForm({ ...scheduleForm, early_leave_threshold_minutes: parseInt(e.target.value) || 0 })} data-testid="input-sched-early" /></div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setScheduleEditDept(null)}>Cancel</Button>
              <Button size="sm" onClick={saveSchedule} disabled={scheduleUpdateMutation.isPending} data-testid="btn-save-schedule">
                {scheduleUpdateMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />} Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {empScheduleId && (
        <Dialog open={!!empScheduleId} onOpenChange={v => { if (!v) setEmpScheduleId(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4" /> Work Schedule — {empScheduleData?.full_name || "Loading..."}
              </DialogTitle>
              {empScheduleData?.department && <p className="text-xs text-muted-foreground">{empScheduleData.department}</p>}
            </DialogHeader>
            {empScheduleLoading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : empScheduleData ? (
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">EFFECTIVE SCHEDULE</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-muted-foreground">Working Days:</span> <span className="font-medium">{empScheduleData.effective_working_days_per_week} days/week</span></div>
                    <div><span className="text-muted-foreground">Week Off:</span> <span className="font-medium">{(empScheduleData.effective_week_off_days || []).map((d: number) => DAY_NAMES[d]).join(", ") || "None"}</span></div>
                    <div><span className="text-muted-foreground">Start Time:</span> <span className="font-medium">{empScheduleData.effective_work_start_time || "—"}</span></div>
                    <div><span className="text-muted-foreground">End Time:</span> <span className="font-medium">{empScheduleData.effective_work_end_time || "—"}</span></div>
                  </div>
                  {empScheduleData.dept_working_days_per_week != null && (
                    <p className="text-[10px] text-muted-foreground mt-2">Dept default: {empScheduleData.dept_working_days_per_week} days/week, {empScheduleData.dept_work_start_time || "—"} - {empScheduleData.dept_work_end_time || "—"}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">OVERRIDE (LEAVE BLANK TO USE DEPARTMENT DEFAULTS)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Working Days/Week</Label>
                      <Select value={empScheduleForm.working_days_per_week || "dept"} onValueChange={v => setEmpScheduleForm({ ...empScheduleForm, working_days_per_week: v === "dept" ? "" : v })}>
                        <SelectTrigger className="h-8 text-xs" data-testid="input-emp-sched-wdpw"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dept">Dept default</SelectItem>
                          <SelectItem value="5">5 days</SelectItem>
                          <SelectItem value="6">6 days</SelectItem>
                          <SelectItem value="7">7 days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Week Off Days</Label>
                      <Select value={empScheduleForm.week_off_days || "dept"} onValueChange={v => setEmpScheduleForm({ ...empScheduleForm, week_off_days: v === "dept" ? "" : v })}>
                        <SelectTrigger className="h-8 text-xs" data-testid="input-emp-sched-wod"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dept">Dept default</SelectItem>
                          <SelectItem value="6">Sat</SelectItem>
                          <SelectItem value="5,6">Fri, Sat</SelectItem>
                          <SelectItem value="0,6">Mon, Sat</SelectItem>
                          <SelectItem value="5">Fri</SelectItem>
                          <SelectItem value="0">Mon</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Work Start Time</Label>
                      <Input type="time" className="h-8 text-xs" value={empScheduleForm.work_start_time} onChange={e => setEmpScheduleForm({ ...empScheduleForm, work_start_time: e.target.value })} placeholder="Dept default" data-testid="input-emp-sched-start" />
                      {!empScheduleForm.work_start_time && <p className="text-[10px] text-muted-foreground">Dept default</p>}
                    </div>
                    <div>
                      <Label className="text-xs">Work End Time</Label>
                      <Input type="time" className="h-8 text-xs" value={empScheduleForm.work_end_time} onChange={e => setEmpScheduleForm({ ...empScheduleForm, work_end_time: e.target.value })} placeholder="Dept default" data-testid="input-emp-sched-end" />
                      {!empScheduleForm.work_end_time && <p className="text-[10px] text-muted-foreground">Dept default</p>}
                    </div>
                  </div>
                </div>
              </div>
            ) : <p className="text-sm text-muted-foreground py-4">Failed to load schedule</p>}
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setEmpScheduleId(null)}>Cancel</Button>
              <Button size="sm" onClick={saveEmpSchedule} disabled={empScheduleSaving || empScheduleLoading} data-testid="btn-save-emp-schedule">
                {empScheduleSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />} Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {isLoading ? <Skeleton className="h-60 w-full" /> : grid && viewMode === "daily" ? (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-auto max-h-[calc(100vh-320px)]">
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 z-10 bg-muted">
                  <tr>
                    <th className="text-left p-2 border-b font-medium min-w-[160px]">Employee</th>
                    <th className="p-2 border-b text-center min-w-[70px] font-medium">Status</th>
                    <th className="p-2 border-b text-center min-w-[80px] font-medium">Check In</th>
                    <th className="p-2 border-b text-center min-w-[70px] font-medium">Method</th>
                    <th className="p-2 border-b text-center min-w-[80px] font-medium">Check Out</th>
                    <th className="p-2 border-b text-center min-w-[70px] font-medium">Method</th>
                    <th className="p-2 border-b text-center min-w-[70px] font-medium">Hours</th>
                    <th className="p-2 border-b text-center min-w-[50px] font-medium">Late</th>
                    <th className="p-2 border-b text-center min-w-[60px] font-medium">Photos</th>
                    <th className="p-2 border-b text-center min-w-[80px] font-medium">Location</th>
                    <th className="p-2 border-b text-center min-w-[50px] font-medium">Notes</th>
                    <th className="p-2 border-b text-center min-w-[50px] font-medium">Edit</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((emp: any) => {
                    const day = grid.days[0];
                    const entry = emp.attendance[day];
                    const isFuture = day > new Date().toISOString().split("T")[0];
                    const formatTime = (t: string | null) => {
                      if (!t) return "—";
                      try {
                        const d = new Date(t);
                        return d.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit", hour12: true });
                      } catch { return t.substring(11, 16); }
                    };
                    const methodBadge = (method: string | null) => {
                      if (!method) return <span className="text-muted-foreground">—</span>;
                      const colors: Record<string, string> = {
                        online: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                        manual: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
                        device: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
                      };
                      return <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${colors[method] || "bg-gray-100 text-gray-700"}`}>{method === "online" ? "Remote" : method.charAt(0).toUpperCase() + method.slice(1)}</span>;
                    };
                    const calcHours = (ci: string | null, co: string | null) => {
                      if (!ci || !co) return "—";
                      try {
                        const diff = (new Date(co).getTime() - new Date(ci).getTime()) / 3600000;
                        if (diff <= 0 || diff > 24) return "—";
                        const h = Math.floor(diff);
                        const m = Math.round((diff - h) * 60);
                        return `${h}h ${m}m`;
                      } catch { return "—"; }
                    };
                    const loc = entry?.check_in_location;
                    return (
                      <tr key={emp.employee_id} className="hover:bg-muted/30 border-b" data-testid={`daily-row-${emp.employee_id}`}>
                        <td className="p-2 border-r cursor-pointer hover:bg-muted/50" onClick={() => openEmpSchedule(emp.employee_id)}>
                          <p className="font-medium truncate max-w-[140px] text-primary hover:underline">{emp.full_name}</p>
                          <p className="text-[10px] text-muted-foreground truncate max-w-[140px]">{emp.department || emp.position}</p>
                        </td>
                        <td className="p-2 text-center border-r">
                          {isFuture ? <span className="text-muted-foreground">—</span> : entry ? (
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${statusColors[entry.status] || ""}`}>
                              {entry.status === "present" ? "Present" : entry.status === "absent" ? "Absent" : entry.status === "on_leave" ? "On Leave" : entry.status === "half_day" ? "Half Day" : entry.status}
                            </span>
                          ) : <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${statusColors.absent}`}>Absent</span>}
                        </td>
                        <td className="p-2 text-center border-r font-mono">
                          {entry?.check_in ? formatTime(entry.check_in) : "—"}
                        </td>
                        <td className="p-2 text-center border-r">
                          {entry ? methodBadge(entry.check_in_method) : "—"}
                        </td>
                        <td className="p-2 text-center border-r font-mono">
                          {entry?.check_out ? formatTime(entry.check_out) : "—"}
                        </td>
                        <td className="p-2 text-center border-r">
                          {entry ? methodBadge(entry.check_out_method) : "—"}
                        </td>
                        <td className="p-2 text-center border-r font-mono">
                          {entry ? calcHours(entry.check_in, entry.check_out) : "—"}
                        </td>
                        <td className="p-2 text-center border-r">
                          {entry?.is_late ? (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                              {entry.late_minutes ? `${entry.late_minutes}m` : "Yes"}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="p-2 text-center border-r">
                          {(entry?.check_in_photo_url || entry?.check_out_photo_url) ? (
                            <div className="flex gap-1 justify-center">
                              {entry.check_in_photo_url && (
                                <a href={`/api/hrms/attendance/${entry.id}/photo?type=check_in`} target="_blank" rel="noreferrer" title="Check-in photo">
                                  <img src={`/api/hrms/attendance/${entry.id}/photo?type=check_in`} alt="In" className="w-7 h-7 rounded object-cover border hover:ring-2 hover:ring-primary" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                </a>
                              )}
                              {entry.check_out_photo_url && (
                                <a href={`/api/hrms/attendance/${entry.id}/photo?type=check_out`} target="_blank" rel="noreferrer" title="Check-out photo">
                                  <img src={`/api/hrms/attendance/${entry.id}/photo?type=check_out`} alt="Out" className="w-7 h-7 rounded object-cover border hover:ring-2 hover:ring-primary" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                </a>
                              )}
                            </div>
                          ) : "—"}
                        </td>
                        <td className="p-2 text-center border-r">
                          {loc ? (
                            <a href={`https://www.openstreetmap.org/?mlat=${loc.lat || loc.latitude}&mlon=${loc.lng || loc.longitude}#map=16/${loc.lat || loc.latitude}/${loc.lng || loc.longitude}`}
                              target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-0.5 text-[10px] text-primary hover:underline" title={`${(loc.lat || loc.latitude)?.toFixed(4)}, ${(loc.lng || loc.longitude)?.toFixed(4)}`}>
                              <MapPin className="w-3 h-3" /> Map
                            </a>
                          ) : "—"}
                        </td>
                        <td className="p-2 text-center border-r text-muted-foreground truncate max-w-[100px]">
                          {entry?.notes || "—"}
                        </td>
                        <td className="p-2 text-center">
                          {!isFuture && (
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(emp.employee_id, day, entry)} data-testid={`btn-edit-${emp.employee_id}`}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredEmployees.length === 0 && (
                    <tr><td colSpan={12} className="text-center p-8 text-muted-foreground">
                      {searchTerm ? `No employees matching "${searchTerm}"` : "No employees found"}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : grid && (
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
                  {filteredEmployees.map((emp: any) => (
                    <tr key={emp.employee_id} className="hover:bg-muted/30 border-b">
                      <td className="p-2 sticky left-0 bg-background z-[5] border-r cursor-pointer hover:bg-muted/50" onClick={() => openEmpSchedule(emp.employee_id)} data-testid={`emp-name-${emp.employee_id}`}>
                        <p className="font-medium truncate max-w-[140px] text-primary hover:underline">{emp.full_name}</p>
                        <p className="text-[10px] text-muted-foreground truncate max-w-[140px]">{emp.department || emp.position}</p>
                      </td>
                      {grid.days.map((day: string) => {
                        const entry = emp.attendance[day];
                        const { isWeekend } = formatDay(day);
                        const isFuture = day > new Date().toISOString().split("T")[0];
                        return (
                          <td key={day}
                            className={`p-0 text-center border-r ${isWeekend ? "bg-muted/30" : ""} ${!isFuture && entry?.grid_status !== 'holiday' && entry?.grid_status !== 'day_off' ? "cursor-pointer group" : ""}`}
                            onClick={() => { if (isFuture) return; const gs = entry?.grid_status; if (gs === 'holiday' || gs === 'day_off') return; openEdit(emp.employee_id, day, entry); }}
                            data-testid={`cell-${emp.employee_id}-${day}`}
                          >
                            {isFuture ? (
                              <span className="text-muted-foreground">-</span>
                            ) : entry ? (
                              <div className="relative">
                                <span className={`inline-block px-1 py-0.5 rounded text-[10px] font-medium ${gridStatusColors[entry.grid_status || entry.status] || ""}`}>
                                  {gridStatusLabel(entry.grid_status || entry.status)}
                                </span>
                                {entry.is_late && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-amber-500 rounded-full" />}
                                {entry.grid_status !== 'holiday' && entry.grid_status !== 'day_off' && (
                                  <Pencil className="h-2.5 w-2.5 absolute top-0 right-0 opacity-0 group-hover:opacity-50 text-muted-foreground" />
                                )}
                              </div>
                            ) : (
                              <div className="relative">
                                <span className="text-muted-foreground text-[10px] font-medium">-</span>
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
                  {filteredEmployees.length === 0 && (
                    <tr><td colSpan={grid.days.length + 4} className="text-center p-8 text-muted-foreground">
                      {searchTerm ? `No employees matching "${searchTerm}"` : "No employees found"}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {grid && (
        <div className="flex flex-wrap items-center gap-3 px-1 py-2 text-[11px]">
          <span className="text-muted-foreground font-medium mr-1">INDEX:</span>
          <span className="inline-flex items-center gap-1"><span className="px-1.5 py-0.5 rounded bg-red-100 text-red-800 font-medium">A</span> Absent</span>
          <span className="inline-flex items-center gap-1"><span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">D</span> Day Off</span>
          <span className="inline-flex items-center gap-1"><span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">H</span> Holiday</span>
          <span className="inline-flex items-center gap-1"><span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 font-medium">L</span> Leave</span>
          <span className="inline-flex items-center gap-1"><span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">P*</span> Partial</span>
          <span className="inline-flex items-center gap-1"><span className="px-1.5 py-0.5 rounded bg-green-100 text-green-800 font-medium">P</span> Present</span>
          <span className="inline-flex items-center gap-1"><span className="px-1.5 py-0.5 rounded bg-violet-100 text-violet-800 font-medium">HL</span> Half Leave</span>
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Late</span>
        </div>
      )}

      <Dialog open={!!editingCell} onOpenChange={open => { if (!open) setEditingCell(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Attendance — {editingCell?.day && new Date(editingCell.day + "T00:00:00").toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" })}</DialogTitle>
          </DialogHeader>
          {(() => {
            const emp = allEmployees.find((e: any) => e.employee_id === editingCell?.empId);
            const entry = emp?.attendance[editingCell?.day || ""];
            const loc = entry?.check_in_location;
            return (
              <div className="space-y-3">
                {(entry?.check_in_photo_url || entry?.check_out_photo_url || loc) && (
                  <div className="rounded-lg border p-3 bg-muted/30 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Remote Check-In Details</p>
                    {(entry?.check_in_photo_url || entry?.check_out_photo_url) && (
                      <div className="flex gap-3">
                        {entry?.check_in_photo_url && (
                          <div className="text-center">
                            <a href={`/api/hrms/attendance/${entry.id}/photo?type=check_in`} target="_blank" rel="noreferrer">
                              <img src={`/api/hrms/attendance/${entry.id}/photo?type=check_in`} alt="Check-in" className="w-20 h-20 rounded-lg object-cover border hover:ring-2 hover:ring-primary" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            </a>
                            <p className="text-[10px] text-muted-foreground mt-1">Check-in Photo</p>
                          </div>
                        )}
                        {entry?.check_out_photo_url && (
                          <div className="text-center">
                            <a href={`/api/hrms/attendance/${entry.id}/photo?type=check_out`} target="_blank" rel="noreferrer">
                              <img src={`/api/hrms/attendance/${entry.id}/photo?type=check_out`} alt="Check-out" className="w-20 h-20 rounded-lg object-cover border hover:ring-2 hover:ring-primary" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            </a>
                            <p className="text-[10px] text-muted-foreground mt-1">Check-out Photo</p>
                          </div>
                        )}
                      </div>
                    )}
                    {loc && (
                      <div className="flex items-center gap-2 text-xs">
                        <MapPin className="w-3.5 h-3.5 text-primary" />
                        <a href={`https://www.openstreetmap.org/?mlat=${loc.lat || loc.latitude}&mlon=${loc.lng || loc.longitude}#map=16/${loc.lat || loc.latitude}/${loc.lng || loc.longitude}`}
                          target="_blank" rel="noreferrer" className="text-primary hover:underline">
                          {(loc.lat || loc.latitude)?.toFixed(6)}, {(loc.lng || loc.longitude)?.toFixed(6)}
                        </a>
                      </div>
                    )}
                    {(entry?.check_in_method || entry?.check_out_method) && (
                      <div className="flex gap-3 text-xs">
                        {entry?.check_in_method && <span>Check-in method: <strong>{entry.check_in_method === "online" ? "Remote" : entry.check_in_method}</strong></span>}
                        {entry?.check_out_method && <span>Check-out method: <strong>{entry.check_out_method === "online" ? "Remote" : entry.check_out_method}</strong></span>}
                      </div>
                    )}
                  </div>
                )}
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
            );
          })()}
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

interface PayrollPayslip {
  id: string; payroll_run_id: string; employee_id: string; employee_name: string | null;
  employee_pan: string | null;
  month: number; year: number; basic_salary: number; allowances: Record<string,number>;
  gross_salary: number; cit_deduction: number; ssf_employee_deduction: number;
  ssf_employer_contribution: number; tax_deduction: number; bonus_amount: number;
  travel_reimbursement: number; advance_deduction: number; unpaid_leave_deduction: number;
  other_deductions: Record<string,number>; total_deductions: number; net_salary: number;
  working_days: number; present_days: number; status: string;
}

interface PayrollRunDetail extends PayrollRun {
  notes: string | null;
  payslips: PayrollPayslip[];
}

const PAYROLL_STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 border-slate-200",
  processing: "bg-blue-100 text-blue-700 border-blue-200",
  processed: "bg-amber-100 text-amber-700 border-amber-200",
  approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
  paid: "bg-green-100 text-green-700 border-green-200",
  completed: "bg-blue-100 text-blue-700 border-blue-200",
  cancelled: "bg-red-100 text-red-700 border-red-200",
};

const MONTHS_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function PayrollRunDetailView({ runId, onBack }: { runId: string; onBack: () => void }) {
  const { toast } = useToast();
  const [editingPayslip, setEditingPayslip] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, number>>({});

  const { data: detail, isLoading } = useQuery<PayrollRunDetail>({
    queryKey: ["/api/hrms/payroll-runs", runId],
    queryFn: async () => {
      const res = await fetch(`/api/hrms/payroll-runs/${runId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const processMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/hrms/payroll-runs/${runId}/process`);
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
    onError: (err: any) => {
      toast({ title: extractErrorMessage(err, "Failed to process"), variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/hrms/payroll-runs/${runId}/approve`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.refetchQueries({ queryKey: ["/api/hrms/payroll-runs"] });
      toast({ title: data.message });
    },
    onError: (err: any) => {
      toast({ title: extractErrorMessage(err, "Failed to approve"), variant: "destructive" });
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/hrms/payroll-runs/${runId}/mark-paid`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.refetchQueries({ queryKey: ["/api/hrms/payroll-runs"] });
      toast({ title: data.message });
    },
    onError: (err: any) => {
      toast({ title: extractErrorMessage(err, "Failed to mark paid"), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/hrms/payroll-runs/${runId}`),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/hrms/payroll-runs"] });
      toast({ title: "Payroll run deleted" });
      onBack();
    },
    onError: (err: any) => {
      toast({ title: extractErrorMessage(err, "Failed to delete"), variant: "destructive" });
    },
  });

  const updatePayslipMutation = useMutation({
    mutationFn: async ({ psId, data }: { psId: string; data: Record<string, number> }) => {
      const res = await apiRequest("PUT", `/api/hrms/payslips/${psId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/hrms/payroll-runs", runId] });
      queryClient.refetchQueries({ queryKey: ["/api/hrms/payroll-runs"] });
      setEditingPayslip(null);
      toast({ title: "Payslip updated" });
    },
    onError: (err: any) => {
      toast({ title: extractErrorMessage(err, "Failed to update"), variant: "destructive" });
    },
  });

  const [deleteConfirm, setDeleteConfirm] = useState(false);

  if (isLoading) return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
      <Skeleton className="h-40" />
    </div>
  );

  if (!detail) return <div className="text-center py-8 text-muted-foreground">Payroll run not found</div>;

  const canEdit = !['approved', 'paid'].includes(detail.status);
  const canProcess = ['draft', 'processed'].includes(detail.status);
  const canApprove = ['processed', 'completed'].includes(detail.status);
  const canMarkPaid = detail.status === 'approved';
  const canDelete = detail.status !== 'paid';

  const startEdit = (ps: PayrollPayslip) => {
    setEditingPayslip(ps.id);
    setEditValues({
      basic_salary: ps.basic_salary,
      gross_salary: ps.gross_salary,
      cit_deduction: ps.cit_deduction,
      ssf_employee_deduction: ps.ssf_employee_deduction,
      tax_deduction: ps.tax_deduction,
      bonus_amount: ps.bonus_amount,
      travel_reimbursement: ps.travel_reimbursement,
      advance_deduction: ps.advance_deduction,
      unpaid_leave_deduction: ps.unpaid_leave_deduction,
      total_deductions: ps.total_deductions,
      net_salary: ps.net_salary,
    });
  };

  const saveEdit = () => {
    if (!editingPayslip) return;
    updatePayslipMutation.mutate({ psId: editingPayslip, data: editValues });
  };

  const anyPending = processMutation.isPending || approveMutation.isPending || markPaidMutation.isPending || deleteMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={onBack} data-testid="btn-back-payroll"><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
          <h3 className="text-lg font-semibold">{MONTHS_FULL[(detail.month || 1) - 1]} {detail.year}</h3>
          <Badge className={PAYROLL_STATUS_COLORS[detail.status] || ""} variant="outline">{detail.status}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {canProcess && (
            <Button size="sm" onClick={() => processMutation.mutate()} disabled={anyPending} data-testid="btn-process-payroll">
              {processMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-1" />}
              {detail.status === 'draft' ? 'Process' : 'Reprocess'}
            </Button>
          )}
          {canApprove && (
            <Button size="sm" variant="default" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => approveMutation.mutate()} disabled={anyPending} data-testid="btn-approve-payroll">
              {approveMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-1" />}
              Approve
            </Button>
          )}
          {canMarkPaid && (
            <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700" onClick={() => markPaidMutation.mutate()} disabled={anyPending} data-testid="btn-mark-paid">
              {markPaidMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CreditCard className="w-4 h-4 mr-1" />}
              Mark Payment Made
            </Button>
          )}
          {detail.payslips && detail.payslips.length > 0 && (
            <>
              <Button size="sm" variant="outline" onClick={() => {
                fetch('/api/hrms/payslips/bulk-pdf', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ payroll_run_id: runId }),
                }).then(res => {
                  if (!res.ok) throw new Error('Download failed');
                  const ct = res.headers.get('content-type') || '';
                  if (!ct.includes('zip') && !ct.includes('octet')) throw new Error('Unexpected response');
                  return res.blob();
                }).then(blob => {
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `Payslips_${MONTHS_FULL[(detail.month || 1) - 1]}_${detail.year}.zip`;
                  a.click();
                  URL.revokeObjectURL(url);
                }).catch(() => toast({ title: "Download failed", variant: "destructive" }));
              }} data-testid="btn-download-all-payslips">
                <Download className="w-4 h-4 mr-1" /> Download All PDFs
              </Button>
              <Button size="sm" variant="outline" className="border-green-300 text-green-700 hover:bg-green-50" onClick={() => {
                window.open(`/api/hrms/payroll-runs/${runId}/export`, '_blank');
              }} data-testid="btn-export-payroll-xlsx">
                <Sheet className="w-4 h-4 mr-1" /> Export Report
              </Button>
            </>
          )}
          {canDelete && (
            <Button size="sm" variant="destructive" onClick={() => setDeleteConfirm(true)} disabled={anyPending} data-testid="btn-delete-payroll">
              <Trash2 className="w-4 h-4 mr-1" /> Delete
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Staff</p><p className="text-lg font-bold">{detail.payslips?.length || detail.payslip_count}</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Gross</p><p className="text-lg font-bold font-mono">{getCurrencySymbol(detail.currency || 'NPR')} {detail.total_gross.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Deductions</p><p className="text-lg font-bold font-mono text-red-600">{getCurrencySymbol(detail.currency || 'NPR')} {detail.total_deductions.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Net Pay</p><p className="text-lg font-bold font-mono text-green-600">{getCurrencySymbol(detail.currency || 'NPR')} {detail.total_net.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Employer SSF</p><p className="text-lg font-bold font-mono">{getCurrencySymbol(detail.currency || 'NPR')} {detail.total_employer_contribution.toLocaleString()}</p></CardContent></Card>
      </div>

      {detail.status === 'approved' && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>Approved by management. Click "Mark Payment Made" after salary transfer is complete. Payslips will then be visible to employees.</span>
        </div>
      )}
      {detail.status === 'paid' && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          <CreditCard className="w-4 h-4 shrink-0" />
          <span>Payment completed. Payslips are now visible to employees in their portal.</span>
        </div>
      )}

      {(!detail.payslips || detail.payslips.length === 0) ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No payslips generated yet</p>
            <p className="text-sm mt-1">Click "Process" to calculate salaries for all staff</p>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table className="min-w-[1800px]">
            <TableHeader>
              <TableRow className="bg-muted/50 border-b-0">
                <TableHead rowSpan={2} className="sticky left-0 bg-muted/50 z-10 w-[30px] text-center border-r">S.N</TableHead>
                <TableHead rowSpan={2} className="sticky left-[30px] bg-muted/50 z-10 w-[140px] min-w-[140px] border-r">Employee Name</TableHead>
                <TableHead rowSpan={2} className="w-[100px] text-center">Position</TableHead>
                <TableHead rowSpan={2} className="w-[80px] text-center">Join Date</TableHead>
                <TableHead rowSpan={2} className="w-[60px] text-center">Gender</TableHead>
                <TableHead rowSpan={2} className="text-center w-[50px]">Total Days</TableHead>
                <TableHead rowSpan={2} className="text-center w-[55px]">Worked Days</TableHead>
                <TableHead rowSpan={2} className="text-center w-[50px]">Paid Leave</TableHead>
                <TableHead rowSpan={2} className="text-center w-[55px]">Unpaid Leave</TableHead>
                <TableHead colSpan={3} className="text-center bg-green-50 border-x">Income</TableHead>
                <TableHead colSpan={3} className="text-center bg-red-50 border-x">Deduction</TableHead>
                <TableHead rowSpan={2} className="text-right w-[85px]">Total Salary</TableHead>
                <TableHead rowSpan={2} className="text-right w-[65px]">Bonus</TableHead>
                <TableHead rowSpan={2} className="text-right w-[60px]">CIT</TableHead>
                <TableHead rowSpan={2} className="text-right w-[90px]">Taxable (Yr)</TableHead>
                <TableHead rowSpan={2} className="text-right w-[60px]">SST</TableHead>
                <TableHead rowSpan={2} className="text-right w-[60px]">TDS</TableHead>
                <TableHead rowSpan={2} className="text-right w-[70px]">Total Tax</TableHead>
                <TableHead rowSpan={2} className="text-right w-[85px]">Net Salary</TableHead>
                <TableHead rowSpan={2} className="text-right w-[70px]">Advance</TableHead>
                <TableHead rowSpan={2} className="text-right w-[90px]">Payable Salary</TableHead>
                <TableHead rowSpan={2} className="text-center w-[70px]">Actions</TableHead>
              </TableRow>
              <TableRow className="bg-muted/30">
                <TableHead className="text-right text-xs bg-green-50/50">Arrear</TableHead>
                <TableHead className="text-right text-xs bg-green-50/50">OT Pay</TableHead>
                <TableHead className="text-right text-xs bg-green-50/50 border-r">Total</TableHead>
                <TableHead className="text-right text-xs bg-red-50/50">Leave Amt</TableHead>
                <TableHead className="text-right text-xs bg-red-50/50">Fine</TableHead>
                <TableHead className="text-right text-xs bg-red-50/50 border-r">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.payslips.map((ps: any, idx: number) => {
                const isEditing = editingPayslip === ps.id;
                return (
                  <TableRow key={ps.id} className={isEditing ? "bg-blue-50/50" : ""}>
                    <TableCell className="sticky left-0 bg-white z-10 text-center text-xs border-r">{idx + 1}</TableCell>
                    <TableCell className="sticky left-[30px] bg-white z-10 font-medium text-sm border-r">{ps.employee_name || "Unknown"}</TableCell>
                    <TableCell className="text-xs text-center">{ps.employee_position || "—"}</TableCell>
                    <TableCell className="text-xs text-center">{ps.employee_join_date || "—"}</TableCell>
                    <TableCell className="text-xs text-center capitalize">{ps.employee_gender || "—"}</TableCell>
                    <TableCell className="text-center text-xs">{ps.total_days || "—"}</TableCell>
                    <TableCell className="text-center text-xs">{ps.present_days}/{ps.working_days}</TableCell>
                    <TableCell className="text-center text-xs">{ps.paid_leave_days || 0}</TableCell>
                    <TableCell className="text-center text-xs">{ps.unpaid_leave_days || 0}</TableCell>
                    {isEditing ? (
                      <>
                        <TableCell className="text-right text-xs bg-green-50/20">0</TableCell>
                        <TableCell className="text-right text-xs bg-green-50/20">0</TableCell>
                        <TableCell className="text-right bg-green-50/20 border-r"><Input type="number" className="w-20 h-7 text-right text-xs" value={editValues.gross_salary} onChange={e => setEditValues(v => ({ ...v, gross_salary: parseFloat(e.target.value) || 0 }))} /></TableCell>
                        <TableCell className="text-right bg-red-50/20"><Input type="number" className="w-20 h-7 text-right text-xs" value={editValues.unpaid_leave_deduction} onChange={e => setEditValues(v => ({ ...v, unpaid_leave_deduction: parseFloat(e.target.value) || 0 }))} /></TableCell>
                        <TableCell className="text-right text-xs bg-red-50/20">0</TableCell>
                        <TableCell className="text-right bg-red-50/20 border-r"><Input type="number" className="w-20 h-7 text-right text-xs" value={editValues.total_deductions} onChange={e => setEditValues(v => ({ ...v, total_deductions: parseFloat(e.target.value) || 0 }))} /></TableCell>
                        <TableCell className="text-right"><Input type="number" className="w-20 h-7 text-right text-xs" value={editValues.gross_salary} onChange={e => setEditValues(v => ({ ...v, gross_salary: parseFloat(e.target.value) || 0 }))} /></TableCell>
                        <TableCell className="text-right"><Input type="number" className="w-16 h-7 text-right text-xs" value={editValues.bonus_amount} onChange={e => setEditValues(v => ({ ...v, bonus_amount: parseFloat(e.target.value) || 0 }))} /></TableCell>
                        <TableCell className="text-right"><Input type="number" className="w-16 h-7 text-right text-xs" value={editValues.cit_deduction} onChange={e => setEditValues(v => ({ ...v, cit_deduction: parseFloat(e.target.value) || 0 }))} /></TableCell>
                        <TableCell className="text-right font-mono text-xs">{((editValues.gross_salary - (editValues.cit_deduction || 0) + (editValues.bonus_amount || 0)) * 12).toLocaleString()}</TableCell>
                        <TableCell className="text-right"><Input type="number" className="w-16 h-7 text-right text-xs" value={editValues.ssf_employee_deduction} onChange={e => setEditValues(v => ({ ...v, ssf_employee_deduction: parseFloat(e.target.value) || 0 }))} /></TableCell>
                        <TableCell className="text-right"><Input type="number" className="w-16 h-7 text-right text-xs" value={editValues.tax_deduction} onChange={e => setEditValues(v => ({ ...v, tax_deduction: parseFloat(e.target.value) || 0 }))} /></TableCell>
                        <TableCell className="text-right text-xs">{((editValues.cit_deduction || 0) + (editValues.ssf_employee_deduction || 0) + (editValues.tax_deduction || 0)).toLocaleString()}</TableCell>
                        <TableCell className="text-right"><Input type="number" className="w-24 h-7 text-right text-xs font-bold" value={editValues.net_salary} onChange={e => setEditValues(v => ({ ...v, net_salary: parseFloat(e.target.value) || 0 }))} /></TableCell>
                        <TableCell className="text-right"><Input type="number" className="w-16 h-7 text-right text-xs" value={editValues.advance_deduction} onChange={e => setEditValues(v => ({ ...v, advance_deduction: parseFloat(e.target.value) || 0 }))} /></TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold">{((editValues.net_salary || 0) - (editValues.advance_deduction || 0)).toLocaleString()}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex gap-1 justify-center">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-600" onClick={saveEdit} disabled={updatePayslipMutation.isPending}><Check className="w-3.5 h-3.5" /></Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500" onClick={() => setEditingPayslip(null)}><X className="w-3.5 h-3.5" /></Button>
                          </div>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="text-right font-mono text-xs bg-green-50/20">0</TableCell>
                        <TableCell className="text-right font-mono text-xs bg-green-50/20">0</TableCell>
                        <TableCell className="text-right font-mono text-xs bg-green-50/20 border-r">{(ps.total_income || ps.gross_salary).toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono text-xs bg-red-50/20">{(ps.leave_deduction_amount || ps.unpaid_leave_deduction).toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono text-xs bg-red-50/20">0</TableCell>
                        <TableCell className="text-right font-mono text-xs bg-red-50/20 border-r">{ps.total_deductions.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{ps.gross_salary.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{ps.bonus_amount.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{ps.cit_deduction.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{(ps.taxable_amount_yearly || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{(ps.sst || ps.ssf_employee_deduction).toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{(ps.tds || ps.tax_deduction).toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{(ps.total_tax || (ps.cit_deduction + ps.ssf_employee_deduction + ps.tax_deduction)).toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold text-green-700">{ps.net_salary.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{ps.advance_deduction.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold text-green-700">{(ps.payable_salary || ps.net_salary).toLocaleString()}</TableCell>
                        {canEdit ? (
                          <TableCell className="text-center">
                            <div className="flex gap-0.5 justify-center">
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEdit(ps)} data-testid={`btn-edit-payslip-${ps.id}`}><Pencil className="w-3.5 h-3.5" /></Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => {
                                window.open(`/api/hrms/payslips/${ps.id}/pdf`, '_blank');
                              }} data-testid={`btn-dl-payslip-${ps.id}`}><Download className="w-3.5 h-3.5" /></Button>
                            </div>
                          </TableCell>
                        ) : (
                          <TableCell className="text-center">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => {
                              window.open(`/api/hrms/payslips/${ps.id}/pdf`, '_blank');
                            }} data-testid={`btn-dl-payslip-${ps.id}`}><Download className="w-3.5 h-3.5" /></Button>
                          </TableCell>
                        )}
                      </>
                    )}
                  </TableRow>
                );
              })}
              <TableRow className="bg-muted/30 font-bold">
                <TableCell className="sticky left-0 bg-muted/30 z-10 border-r"></TableCell>
                <TableCell className="sticky left-[30px] bg-muted/30 z-10 border-r">TOTAL ({detail.payslips.length} staff)</TableCell>
                <TableCell></TableCell>
                <TableCell></TableCell>
                <TableCell></TableCell>
                <TableCell></TableCell>
                <TableCell></TableCell>
                <TableCell className="text-center text-xs">{detail.payslips.reduce((s: number, p: any) => s + (p.paid_leave_days || 0), 0)}</TableCell>
                <TableCell className="text-center text-xs">{detail.payslips.reduce((s: number, p: any) => s + (p.unpaid_leave_days || 0), 0)}</TableCell>
                <TableCell className="text-right font-mono text-xs bg-green-50/20">0</TableCell>
                <TableCell className="text-right font-mono text-xs bg-green-50/20">0</TableCell>
                <TableCell className="text-right font-mono text-xs bg-green-50/20 border-r">{detail.payslips.reduce((s: number, p: any) => s + (p.total_income || p.gross_salary), 0).toLocaleString()}</TableCell>
                <TableCell className="text-right font-mono text-xs bg-red-50/20">{detail.payslips.reduce((s: number, p: any) => s + (p.leave_deduction_amount || p.unpaid_leave_deduction), 0).toLocaleString()}</TableCell>
                <TableCell className="text-right font-mono text-xs bg-red-50/20">0</TableCell>
                <TableCell className="text-right font-mono text-xs bg-red-50/20 border-r">{detail.payslips.reduce((s: number, p: any) => s + p.total_deductions, 0).toLocaleString()}</TableCell>
                <TableCell className="text-right font-mono text-xs">{detail.payslips.reduce((s: number, p: any) => s + p.gross_salary, 0).toLocaleString()}</TableCell>
                <TableCell className="text-right font-mono text-xs">{detail.payslips.reduce((s: number, p: any) => s + p.bonus_amount, 0).toLocaleString()}</TableCell>
                <TableCell className="text-right font-mono text-xs">{detail.payslips.reduce((s: number, p: any) => s + p.cit_deduction, 0).toLocaleString()}</TableCell>
                <TableCell className="text-right font-mono text-xs">{detail.payslips.reduce((s: number, p: any) => s + (p.taxable_amount_yearly || 0), 0).toLocaleString()}</TableCell>
                <TableCell className="text-right font-mono text-xs">{detail.payslips.reduce((s: number, p: any) => s + (p.sst || p.ssf_employee_deduction), 0).toLocaleString()}</TableCell>
                <TableCell className="text-right font-mono text-xs">{detail.payslips.reduce((s: number, p: any) => s + (p.tds || p.tax_deduction), 0).toLocaleString()}</TableCell>
                <TableCell className="text-right font-mono text-xs">{detail.payslips.reduce((s: number, p: any) => s + (p.total_tax || (p.cit_deduction + p.ssf_employee_deduction + p.tax_deduction)), 0).toLocaleString()}</TableCell>
                <TableCell className="text-right font-mono text-xs text-green-700">{detail.payslips.reduce((s: number, p: any) => s + p.net_salary, 0).toLocaleString()}</TableCell>
                <TableCell className="text-right font-mono text-xs">{detail.payslips.reduce((s: number, p: any) => s + p.advance_deduction, 0).toLocaleString()}</TableCell>
                <TableCell className="text-right font-mono text-xs text-green-700">{detail.payslips.reduce((s: number, p: any) => s + (p.payable_salary || p.net_salary), 0).toLocaleString()}</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payroll Run?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the payroll run for {MONTHS_FULL[(detail.month || 1) - 1]} {detail.year} and all associated payslips. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteMutation.mutate()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PayrollTab() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [form, setForm] = useState({ organization_id: "", month: new Date().getMonth() + 1, year: new Date().getFullYear() });

  const { data: orgs } = useQuery<Organization[]>({ queryKey: ["/api/hrms/organizations"] });
  const { data: runs, isLoading } = useQuery<PayrollRun[]>({ queryKey: ["/api/hrms/payroll-runs"] });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/hrms/payroll-runs", data),
    onSuccess: async (res: any) => {
      queryClient.refetchQueries({ queryKey: ["/api/hrms/payroll-runs"] });
      setShowForm(false);
      try {
        const result = await res.json();
        setSelectedRunId(result.id);
        toast({ title: "Payroll run created" });
      } catch {
        toast({ title: "Payroll run created" });
      }
    },
    onError: (err: any) => {
      toast({ title: extractErrorMessage(err, "Failed to create payroll run"), variant: "destructive" });
    },
  });

  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  if (selectedRunId) {
    return <PayrollRunDetailView runId={selectedRunId} onBack={() => setSelectedRunId(null)} />;
  }

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
              <TableHead className="text-center">Payslips</TableHead>
              <TableHead className="text-right">Gross</TableHead>
              <TableHead className="text-right">Deductions</TableHead>
              <TableHead className="text-right">Net</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs?.map(r => (
              <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedRunId(r.id)} data-testid={`row-payroll-${r.id}`}>
                <TableCell className="font-medium">{months[(r.month || 1) - 1]} {r.year}</TableCell>
                <TableCell>{r.organization_name}</TableCell>
                <TableCell className="text-center">{r.payslip_count}</TableCell>
                <TableCell className="text-right font-mono">{getCurrencySymbol(r.currency || 'NPR')} {r.total_gross.toLocaleString()}</TableCell>
                <TableCell className="text-right font-mono">{getCurrencySymbol(r.currency || 'NPR')} {r.total_deductions.toLocaleString()}</TableCell>
                <TableCell className="text-right font-medium font-mono">{getCurrencySymbol(r.currency || 'NPR')} {r.total_net.toLocaleString()}</TableCell>
                <TableCell>
                  <Badge className={PAYROLL_STATUS_COLORS[r.status] || ""} variant="outline">{r.status}</Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedRunId(r.id); }} data-testid={`btn-view-payroll-${r.id}`}>
                    <Eye className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {(!runs || runs.length === 0) && (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No payroll runs yet. Click "New Payroll Run" to get started.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Payroll Run</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div>
              <Label>Organization</Label>
              <Select value={form.organization_id} onValueChange={v => setForm({ ...form, organization_id: v })}>
                <SelectTrigger data-testid="select-payroll-org"><SelectValue placeholder="Select organization" /></SelectTrigger>
                <SelectContent>{orgs?.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Month</Label>
              <Select value={String(form.month)} onValueChange={v => setForm({ ...form, month: parseInt(v) })}>
                <SelectTrigger data-testid="select-payroll-month"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {months.map((m, i) => (
                    <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Year</Label>
              <Select value={String(form.year)} onValueChange={v => setForm({ ...form, year: parseInt(v) })}>
                <SelectTrigger data-testid="select-payroll-year"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026, 2027].map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending || !form.organization_id} data-testid="button-save-payroll">
              {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
              Create & Open
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HolidaysTab() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
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

  const handleBulkUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/hrms/holidays/bulk-upload', { method: 'POST', credentials: 'include', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Upload failed');
      queryClient.refetchQueries({ queryKey: ["/api/hrms/holidays"] });
      toast({ title: data.message || `${data.created} holidays created` });
      if (data.errors?.length > 0) {
        toast({ title: `${data.errors.length} rows had errors`, description: data.errors.slice(0, 3).join('; '), variant: "destructive" });
      }
      setShowBulkUpload(false);
    } catch (e: any) {
      toast({ title: e.message || "Upload failed", variant: "destructive" });
    }
    setUploading(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Holidays ({holidays?.length || 0})</h3>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowBulkUpload(true)} size="sm" data-testid="button-bulk-upload-holiday"><Upload className="h-4 w-4 mr-1" /> Bulk Upload</Button>
          <Button onClick={() => { setForm({ organization_id: orgs?.[0]?.id || "", name: "", date: "", is_optional: false }); setShowForm(true); }} size="sm" data-testid="button-add-holiday"><Plus className="h-4 w-4 mr-1" /> Add Holiday</Button>
        </div>
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

      <Dialog open={showBulkUpload} onOpenChange={setShowBulkUpload}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Bulk Upload Holidays</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Upload a CSV or Excel file with columns: <code className="text-xs bg-muted px-1 rounded">organization_short_code, name, date, is_optional</code></p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => window.open('/api/hrms/holidays/bulk-upload', '_blank')} data-testid="btn-download-holiday-template"><Download className="h-4 w-4 mr-1" /> Download Template</Button>
            </div>
            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">Drag and drop or click to select a CSV/Excel file</p>
              <Input
                type="file"
                accept=".csv,.xlsx"
                className="max-w-xs mx-auto"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleBulkUpload(f); }}
                disabled={uploading}
                data-testid="input-holiday-bulk-file"
              />
              {uploading && <div className="flex items-center justify-center gap-2 mt-3"><Loader2 className="h-4 w-4 animate-spin" /> <span className="text-sm">Uploading...</span></div>}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NotificationSettingsTab() {
  const { toast } = useToast();
  const { data: orgs } = useQuery<Organization[]>({ queryKey: ["/api/hrms/organizations"] });
  const [selectedOrg, setSelectedOrg] = useState("");
  const [ccEmails, setCcEmails] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");

  const effectiveOrg = selectedOrg || orgs?.[0]?.id || "";

  const { data: settings, isLoading } = useQuery<any>({
    queryKey: ["/api/hrms/notification-settings", { organization_id: effectiveOrg }],
    queryFn: async () => {
      if (!effectiveOrg) return null;
      const res = await fetch(`/api/hrms/notification-settings?organization_id=${effectiveOrg}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!effectiveOrg,
  });

  if (ccEmails === null && settings?.cc_emails !== undefined) {
    setCcEmails(settings.cc_emails || "");
  }

  const emailList = ccEmails ? ccEmails.split(",").map((e: string) => e.trim()).filter(Boolean) : [];

  const saveMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/hrms/notification-settings", data),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/hrms/notification-settings"] });
      toast({ title: "CC emails updated" });
    },
  });

  const addEmail = () => {
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast({ title: "Invalid email address", variant: "destructive" });
      return;
    }
    if (emailList.includes(trimmed)) {
      toast({ title: "Email already added", variant: "destructive" });
      return;
    }
    const updated = [...emailList, trimmed].join(", ");
    setCcEmails(updated);
    setNewEmail("");
  };

  const removeEmail = (email: string) => {
    const updated = emailList.filter((e: string) => e !== email).join(", ");
    setCcEmails(updated);
  };

  const handleSave = () => {
    saveMutation.mutate({
      organization_id: effectiveOrg,
      cc_emails: emailList.join(", "),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold" data-testid="text-notification-settings-title">Notification Settings</h3>
        <p className="text-sm text-muted-foreground">Configure CC email addresses for attendance notification emails (late arrival, early departure, missing checkout).</p>
      </div>

      <div className="max-w-xl space-y-4">
        <div>
          <Label>Organization</Label>
          <Select value={effectiveOrg} onValueChange={(v) => { setSelectedOrg(v); setCcEmails(null); }}>
            <SelectTrigger data-testid="select-notification-org"><SelectValue placeholder="Select organization" /></SelectTrigger>
            <SelectContent>{orgs?.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        {isLoading && effectiveOrg ? (
          <Skeleton className="h-32" />
        ) : effectiveOrg ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4" />
                CC Email Addresses
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                These email addresses will be CC'd on all attendance notification emails for this organization, in addition to the organization's email.
              </p>

              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="Enter email address"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addEmail(); } }}
                  data-testid="input-cc-email"
                />
                <Button onClick={addEmail} size="sm" data-testid="button-add-cc-email">
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </div>

              {emailList.length > 0 ? (
                <div className="space-y-2">
                  {emailList.map((email: string) => (
                    <div key={email} className="flex items-center justify-between px-3 py-2 bg-muted rounded-md">
                      <span className="text-sm" data-testid={`text-cc-email-${email}`}>{email}</span>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={() => removeEmail(email)} data-testid={`button-remove-cc-${email}`}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic py-2">No CC email addresses configured. Only the organization email will receive copies.</p>
              )}

              <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save-cc-emails">
                <Save className="h-4 w-4 mr-1" /> Save CC Emails
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function RemoteCheckInPermissionsTab() {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [requirePhoto, setRequirePhoto] = useState(true);
  const [requireLocation, setRequireLocation] = useState(true);

  const { data: permissions, isLoading } = useQuery<any[]>({
    queryKey: ["/api/hrms/online-checkin-permissions"],
  });

  const { data: employeesRaw } = useQuery<any>({
    queryKey: ["/api/employees"],
  });
  const employees: any[] = Array.isArray(employeesRaw) ? employeesRaw : (employeesRaw?.results || []);

  const addMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/hrms/online-checkin-permissions", data),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/hrms/online-checkin-permissions"] });
      setShowAdd(false);
      setSelectedEmployee("");
      setRequirePhoto(true);
      setRequireLocation(true);
      toast({ title: "Permission granted" });
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/hrms/online-checkin-permissions", data),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/hrms/online-checkin-permissions"] });
      toast({ title: "Permission updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/hrms/online-checkin-permissions/${id}`),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/hrms/online-checkin-permissions"] });
      toast({ title: "Permission revoked" });
    },
  });

  const existingEmployeeIds = new Set((permissions || []).map((p: any) => p.employee_id));
  const availableEmployees = (employees || []).filter((e: any) => !existingEmployeeIds.has(e.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold" data-testid="text-remote-checkin-title">Remote Check-In Permissions</h2>
          <p className="text-sm text-muted-foreground">Control which employees can check in/out remotely via the HRMS Portal</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)} data-testid="button-add-permission">
          <Plus className="h-4 w-4 mr-1" /> Grant Access
        </Button>
      </div>

      {isLoading ? <Skeleton className="h-60" /> : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Require Photo</TableHead>
                <TableHead>Require Location</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!permissions || permissions.length === 0) ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No remote check-in permissions assigned yet. Click "Grant Access" to add employees.
                  </TableCell>
                </TableRow>
              ) : permissions.map((p: any) => (
                <TableRow key={p.id} data-testid={`row-permission-${p.id}`}>
                  <TableCell className="font-medium">{p.employee_name || p.employee_id}</TableCell>
                  <TableCell>
                    <button
                      onClick={() => toggleMutation.mutate({
                        employee_id: p.employee_id,
                        is_allowed: !p.is_allowed,
                        require_photo: p.require_photo,
                        require_location: p.require_location,
                      })}
                      className="flex items-center gap-1.5 cursor-pointer"
                      data-testid={`button-toggle-${p.id}`}
                    >
                      {p.is_allowed ? (
                        <><ToggleRight className="h-5 w-5 text-green-600" /><span className="text-sm text-green-600 font-medium">Enabled</span></>
                      ) : (
                        <><ToggleLeft className="h-5 w-5 text-muted-foreground" /><span className="text-sm text-muted-foreground">Disabled</span></>
                      )}
                    </button>
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => toggleMutation.mutate({
                        employee_id: p.employee_id,
                        is_allowed: p.is_allowed,
                        require_photo: !p.require_photo,
                        require_location: p.require_location,
                      })}
                      className="flex items-center gap-1 cursor-pointer"
                      data-testid={`button-toggle-photo-${p.id}`}
                    >
                      {p.require_photo ? (
                        <Badge variant="default" className="text-xs"><Camera className="h-3 w-3 mr-1" />Required</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">Optional</Badge>
                      )}
                    </button>
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => toggleMutation.mutate({
                        employee_id: p.employee_id,
                        is_allowed: p.is_allowed,
                        require_photo: p.require_photo,
                        require_location: !p.require_location,
                      })}
                      className="flex items-center gap-1 cursor-pointer"
                      data-testid={`button-toggle-location-${p.id}`}
                    >
                      {p.require_location ? (
                        <Badge variant="default" className="text-xs"><MapPin className="h-3 w-3 mr-1" />Required</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">Optional</Badge>
                      )}
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(p.id)} data-testid={`button-revoke-${p.id}`}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Grant Remote Check-In Access</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Employee</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger data-testid="select-employee"><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {availableEmployees.map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>{e.fullName || e.full_name || e.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={requirePhoto} onCheckedChange={(c) => setRequirePhoto(!!c)} data-testid="checkbox-require-photo" />
                <span className="text-sm">Require selfie photo</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={requireLocation} onCheckedChange={(c) => setRequireLocation(!!c)} data-testid="checkbox-require-location" />
                <span className="text-sm">Require GPS location</span>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button
              onClick={() => addMutation.mutate({
                employee_id: selectedEmployee,
                is_allowed: true,
                require_photo: requirePhoto,
                require_location: requireLocation,
              })}
              disabled={!selectedEmployee || addMutation.isPending}
              data-testid="button-confirm-grant"
            >
              {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ShieldCheck className="h-4 w-4 mr-1" />}
              Grant Access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HRPoliciesTab() {
  const { toast } = useToast();
  const { data: orgs } = useQuery<Organization[]>({ queryKey: ["/api/hrms/organizations"] });
  const [selectedOrg, setSelectedOrg] = useState("");
  const orgId = selectedOrg || orgs?.[0]?.id || "";
  const { data: policies, isLoading } = useQuery<any[]>({
    queryKey: ["/api/hrms/hr-policies", orgId],
    queryFn: async () => {
      const url = orgId ? `/api/hrms/hr-policies?organization_id=${orgId}` : '/api/hrms/hr-policies';
      const res = await fetch(url, { credentials: "include" });
      return res.json();
    },
  });
  const { data: departments } = useQuery<any[]>({ queryKey: ["/api/hrms/departments"] });
  const orgDepts = (departments || []).filter((d: any) => d.organization_id === orgId);

  const [showForm, setShowForm] = useState(false);
  const [editPolicy, setEditPolicy] = useState<any>(null);
  const [form, setForm] = useState({ title: "", content: "", department_id: "", effective_date: "", is_active: true });
  const [saving, setSaving] = useState(false);
  const [viewPolicy, setViewPolicy] = useState<any>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [removeFile, setRemoveFile] = useState(false);

  const openAdd = () => { setEditPolicy(null); setForm({ title: "", content: "", department_id: "", effective_date: "", is_active: true }); setSelectedFile(null); setRemoveFile(false); setShowForm(true); };
  const openEdit = (p: any) => { setEditPolicy(p); setForm({ title: p.title, content: p.content || "", department_id: p.department_id || "", effective_date: p.effective_date || "", is_active: p.is_active }); setSelectedFile(null); setRemoveFile(false); setShowForm(true); };

  const savePolicy = async () => {
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('title', form.title);
      formData.append('content', form.content);
      formData.append('organization_id', orgId || '');
      formData.append('department_id', form.department_id);
      formData.append('effective_date', form.effective_date);
      formData.append('is_active', String(form.is_active));
      if (selectedFile) formData.append('file', selectedFile);
      if (removeFile) formData.append('remove_file', 'true');

      if (editPolicy) {
        await fetch(`/api/hrms/hr-policies/${editPolicy.id}`, { method: 'PUT', credentials: 'include', body: formData });
        toast({ title: "Policy updated" });
      } else {
        await fetch('/api/hrms/hr-policies', { method: 'POST', credentials: 'include', body: formData });
        toast({ title: "Policy created" });
      }
      queryClient.refetchQueries({ queryKey: ["/api/hrms/hr-policies"] });
      setShowForm(false);
    } catch (err: any) { toast({ title: err.message || "Failed", variant: "destructive" }); }
    setSaving(false);
  };

  const deletePolicy = async (id: string) => {
    try {
      await apiRequest("DELETE", `/api/hrms/hr-policies/${id}`);
      queryClient.refetchQueries({ queryKey: ["/api/hrms/hr-policies"] });
      toast({ title: "Policy deleted" });
    } catch (err: any) { toast({ title: "Failed to delete", variant: "destructive" }); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold" data-testid="text-hr-policies-title">HR Policies</h3>
        <div className="flex items-center gap-2">
          {orgs && orgs.length > 1 && (
            <Select value={orgId} onValueChange={setSelectedOrg}>
              <SelectTrigger className="w-[200px]" data-testid="select-policy-org"><SelectValue placeholder="Organization" /></SelectTrigger>
              <SelectContent>{orgs.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <Button size="sm" onClick={openAdd} data-testid="button-add-policy"><Plus className="h-4 w-4 mr-1" /> Add Policy</Button>
        </div>
      </div>
      {isLoading ? <Skeleton className="h-40 w-full" /> : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Effective Date</TableHead>
              <TableHead>Attachment</TableHead>
              <TableHead>Acknowledged</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {policies?.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.title}</TableCell>
                <TableCell>{p.department_name}</TableCell>
                <TableCell>{p.effective_date || "—"}</TableCell>
                <TableCell>
                  {p.file_url ? (
                    <a href={p.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline text-xs" data-testid={`link-policy-file-${p.id}`}>
                      <Paperclip className="h-3 w-3" /> View File
                    </a>
                  ) : "—"}
                </TableCell>
                <TableCell>{p.acknowledgment_count}/{p.employee_count}</TableCell>
                <TableCell><Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setViewPolicy(p)} data-testid={`button-view-policy-${p.id}`}><Eye className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(p)} data-testid={`button-edit-policy-${p.id}`}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" className="text-red-500" onClick={() => deletePolicy(p.id)} data-testid={`button-delete-policy-${p.id}`}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {(!policies || policies.length === 0) && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No policies yet</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editPolicy ? "Edit Policy" : "Add Policy"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Title</Label><input className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} data-testid="input-policy-title" /></div>
            <div><Label>Department (leave empty for all)</Label>
              <Select value={form.department_id} onValueChange={v => setForm({ ...form, department_id: v === "_all" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="All Departments" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All Departments</SelectItem>
                  {orgDepts.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Effective Date</Label><input type="date" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={form.effective_date} onChange={e => setForm({ ...form, effective_date: e.target.value })} /></div>
            <div>
              <Label>Attachment (PDF, DOC, etc.)</Label>
              <div className="flex items-center gap-2 mt-1">
                <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.png" onChange={e => { setSelectedFile(e.target.files?.[0] || null); setRemoveFile(false); }} className="text-sm" data-testid="input-policy-file" />
                {editPolicy?.file_url && !removeFile && !selectedFile && (
                  <Button variant="outline" size="sm" className="text-red-500 text-xs" onClick={() => setRemoveFile(true)}>
                    <Trash2 className="h-3 w-3 mr-1" /> Remove File
                  </Button>
                )}
                {removeFile && <span className="text-xs text-red-500">File will be removed on save</span>}
              </div>
            </div>
            <div><Label>Policy Content (optional if file attached)</Label><Textarea className="min-h-[200px]" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} data-testid="input-policy-content" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={savePolicy} disabled={saving || !form.title || (!form.content && !selectedFile && !editPolicy?.file_url)} data-testid="button-save-policy">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} {editPolicy ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewPolicy} onOpenChange={v => { if (!v) setViewPolicy(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{viewPolicy?.title}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span>Department: {viewPolicy?.department_name}</span>
              {viewPolicy?.effective_date && <span>Effective: {viewPolicy.effective_date}</span>}
              <span>{viewPolicy?.acknowledgment_count}/{viewPolicy?.employee_count} acknowledged</span>
            </div>
            {viewPolicy?.file_url && (
              <a href={viewPolicy.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline text-sm" data-testid="link-view-policy-file">
                <Paperclip className="h-4 w-4" /> Download Attached File
              </a>
            )}
            {viewPolicy?.content && (
              <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap border rounded-md p-4 bg-muted/20">{viewPolicy.content}</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DocTemplatesTab() {
  const { toast } = useToast();
  const { data: orgs } = useQuery<Organization[]>({ queryKey: ["/api/hrms/organizations"] });
  const [selectedOrg, setSelectedOrg] = useState("");
  const orgId = selectedOrg || orgs?.[0]?.id || "";
  const { data: templates, isLoading } = useQuery<any[]>({
    queryKey: ["/api/hrms/document-templates", orgId],
    queryFn: async () => {
      const url = orgId ? `/api/hrms/document-templates?organization_id=${orgId}` : '/api/hrms/document-templates';
      const res = await fetch(url, { credentials: "include" });
      return res.json();
    },
  });
  const [showForm, setShowForm] = useState(false);
  const [editTemplate, setEditTemplate] = useState<any>(null);
  const [form, setForm] = useState({ name: "", doc_type: "experience_letter", content: "", eligibility: "any", is_active: true });
  const [saving, setSaving] = useState(false);

  const defaultContent: Record<string, string> = {
    experience_letter: `To Whom It May Concern,

This is to certify that [Employee Name] has been employed with [Organization Name] as [Position] in the [Department] department from [Join Date] to [Date].

During their tenure, they have demonstrated professionalism, dedication, and a strong work ethic. We wish them all the best in their future endeavors.

This letter is being issued at the request of the employee for whatever purpose it may serve.`,
    cit_release: `To Whom It May Concern,

This is to confirm that [Employee Name], Employee ID: [Employee ID], has been employed with [Organization Name] as [Position] in the [Department] department from [Join Date].

We hereby request the release of CIT records for the above-mentioned employee.

This letter is issued for official purposes as requested by the employee.`,
  };

  const openAdd = () => { setEditTemplate(null); setForm({ name: "", doc_type: "experience_letter", content: defaultContent["experience_letter"], eligibility: "any", is_active: true }); setShowForm(true); };
  const openEdit = (t: any) => { setEditTemplate(t); setForm({ name: t.name, doc_type: t.doc_type, content: t.content, eligibility: t.eligibility || "any", is_active: t.is_active }); setShowForm(true); };

  const saveTemplate = async () => {
    setSaving(true);
    try {
      const body = { ...form, organization_id: orgId };
      if (editTemplate) {
        await apiRequest("PUT", `/api/hrms/document-templates/${editTemplate.id}`, body);
        toast({ title: "Template updated" });
      } else {
        await apiRequest("POST", "/api/hrms/document-templates", body);
        toast({ title: "Template created" });
      }
      queryClient.refetchQueries({ queryKey: ["/api/hrms/document-templates"] });
      setShowForm(false);
    } catch (err: any) { toast({ title: err.message || "Failed", variant: "destructive" }); }
    setSaving(false);
  };

  const deleteTemplate = async (id: string) => {
    try {
      await apiRequest("DELETE", `/api/hrms/document-templates/${id}`);
      queryClient.refetchQueries({ queryKey: ["/api/hrms/document-templates"] });
      toast({ title: "Template deleted" });
    } catch (err: any) { toast({ title: "Failed to delete", variant: "destructive" }); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold" data-testid="text-doc-templates-title">Document Templates</h3>
          <p className="text-sm text-muted-foreground">Templates for Experience Letters and CIT Release documents</p>
        </div>
        <div className="flex items-center gap-2">
          {orgs && orgs.length > 1 && (
            <Select value={orgId} onValueChange={setSelectedOrg}>
              <SelectTrigger className="w-[200px]" data-testid="select-template-org"><SelectValue placeholder="Organization" /></SelectTrigger>
              <SelectContent>{orgs.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <Button size="sm" onClick={openAdd} data-testid="button-add-template"><Plus className="h-4 w-4 mr-1" /> Add Template</Button>
        </div>
      </div>
      <div className="bg-muted/30 border rounded-md p-3 text-xs text-muted-foreground">
        <p className="font-medium mb-1">Available Placeholders:</p>
        <p>[Employee Name], [Position], [Department], [Join Date], [Organization Name], [Date], [Employee ID]</p>
      </div>
      {isLoading ? <Skeleton className="h-40 w-full" /> : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Eligibility</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates?.map(t => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell><Badge variant="outline">{t.doc_type_display}</Badge></TableCell>
                <TableCell className="text-sm">{t.eligibility_display || "Any Employee"}</TableCell>
                <TableCell><Badge variant={t.is_active ? "default" : "secondary"}>{t.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(t)} data-testid={`button-edit-template-${t.id}`}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" className="text-red-500" onClick={() => deleteTemplate(t.id)} data-testid={`button-delete-template-${t.id}`}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {(!templates || templates.length === 0) && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No templates yet. Add a template to get started.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editTemplate ? "Edit Template" : "Add Template"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Template Name</Label><input className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Standard Experience Letter" data-testid="input-template-name" /></div>
            <div><Label>Document Type</Label>
              <Select value={form.doc_type} onValueChange={v => setForm({ ...form, doc_type: v, content: form.content || defaultContent[v] || "" })}>
                <SelectTrigger data-testid="select-doc-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="experience_letter">Experience Letter</SelectItem>
                  <SelectItem value="cit_release">CIT Release</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Eligibility Condition</Label>
              <Select value={form.eligibility} onValueChange={v => setForm({ ...form, eligibility: v })}>
                <SelectTrigger data-testid="select-eligibility"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any Employee</SelectItem>
                  <SelectItem value="terminated">Terminated/Resigned Only</SelectItem>
                  <SelectItem value="active">Active Employees Only</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">Controls which employees can request this document type</p>
            </div>
            <div><Label>Content</Label><Textarea className="min-h-[250px] font-mono text-sm" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} data-testid="input-template-content" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={saveTemplate} disabled={saving || !form.name || !form.content} data-testid="button-save-template">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} {editTemplate ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DocRequestsTab() {
  const { toast } = useToast();
  const { data: orgs } = useQuery<Organization[]>({ queryKey: ["/api/hrms/organizations"] });
  const orgId = orgs?.[0]?.id || "";
  const [statusFilter, setStatusFilter] = useState("pending");
  const { data: requests, isLoading } = useQuery<any[]>({
    queryKey: ["/api/hrms/document-requests", orgId, statusFilter],
    queryFn: async () => {
      const res = await fetch(`/api/hrms/document-requests?organization_id=${orgId}&status=${statusFilter}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!orgId,
  });
  const [signDialog, setSignDialog] = useState<any>(null);
  const [signaturePad, setSignaturePad] = useState<string>("");
  const [signerName, setSignerName] = useState("");
  const [processing, setProcessing] = useState(false);
  const [rejectDialog, setRejectDialog] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };
  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };
  const endDraw = () => {
    setIsDrawing(false);
    if (canvasRef.current) setSignaturePad(canvasRef.current.toDataURL());
  };
  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignaturePad("");
  };

  const completeRequest = async () => {
    if (!signDialog || !signaturePad) return;
    setProcessing(true);
    try {
      await apiRequest("POST", `/api/hrms/document-requests/${signDialog.id}/process`, {
        action: "complete",
        company_signature: signaturePad,
        signed_by_name: signerName,
      });
      queryClient.refetchQueries({ queryKey: ["/api/hrms/document-requests"] });
      toast({ title: "Document generated and sent to employee" });
      setSignDialog(null);
      clearSignature();
    } catch (err: any) { toast({ title: err.message || "Failed", variant: "destructive" }); }
    setProcessing(false);
  };

  const rejectRequest = async () => {
    if (!rejectDialog) return;
    setProcessing(true);
    try {
      await apiRequest("POST", `/api/hrms/document-requests/${rejectDialog.id}/process`, {
        action: "reject",
        rejection_reason: rejectReason,
      });
      queryClient.refetchQueries({ queryKey: ["/api/hrms/document-requests"] });
      toast({ title: "Request rejected" });
      setRejectDialog(null);
      setRejectReason("");
    } catch (err: any) { toast({ title: err.message || "Failed", variant: "destructive" }); }
    setProcessing(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold" data-testid="text-doc-requests-title">Document Requests</h3>
        <div className="flex gap-2">
          {["pending", "processing", "completed", "rejected"].map(s => (
            <Button key={s} variant={statusFilter === s ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(s)} data-testid={`button-doc-filter-${s}`}>
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
              <TableHead>Document Type</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>Requested</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests?.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.employee_name}</TableCell>
                <TableCell><Badge variant="outline">{r.doc_type_display}</Badge></TableCell>
                <TableCell>{r.template_name || "—"}</TableCell>
                <TableCell className="text-sm">{r.requested_at ? new Date(r.requested_at).toLocaleDateString() : "—"}</TableCell>
                <TableCell>
                  <Badge variant={r.status === "completed" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>{r.status}</Badge>
                  {r.status === "completed" && r.signed_by_name && <p className="text-[10px] text-muted-foreground mt-0.5">Signed by: {r.signed_by_name}</p>}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {r.status === "pending" && (
                      <>
                        <Button variant="ghost" size="sm" className="text-green-600 text-xs" onClick={() => { setSignDialog(r); setSignerName(""); clearSignature(); }} data-testid={`button-sign-doc-${r.id}`}>Sign & Complete</Button>
                        <Button variant="ghost" size="sm" className="text-red-500 text-xs" onClick={() => { setRejectDialog(r); setRejectReason(""); }} data-testid={`button-reject-doc-${r.id}`}>Reject</Button>
                      </>
                    )}
                    {r.status === "completed" && r.document_url && (
                      <a href={r.document_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline text-xs" data-testid={`link-doc-download-${r.id}`}>
                        <Download className="h-3 w-3" /> Download
                      </a>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {(!requests || requests.length === 0) && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No {statusFilter} document requests</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <Dialog open={!!signDialog} onOpenChange={v => { if (!v) setSignDialog(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Sign & Complete Document</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Generating <strong>{signDialog?.doc_type_display}</strong> for <strong>{signDialog?.employee_name}</strong>.
              Please draw your signature below and enter the signatory name.
            </p>
            <div>
              <Label>Signatory Name</Label>
              <input className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={signerName} onChange={e => setSignerName(e.target.value)} placeholder="e.g. HR Manager Name" data-testid="input-signer-name" />
            </div>
            <div>
              <Label>Signature</Label>
              <div className="border rounded-md bg-white mt-1">
                <canvas
                  ref={canvasRef}
                  width={380} height={120}
                  className="cursor-crosshair w-full"
                  onMouseDown={startDraw}
                  onMouseMove={draw}
                  onMouseUp={endDraw}
                  onMouseLeave={endDraw}
                  data-testid="canvas-signature"
                />
              </div>
              <Button variant="link" size="sm" className="text-xs p-0 h-auto mt-1" onClick={clearSignature}>Clear Signature</Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSignDialog(null)}>Cancel</Button>
            <Button onClick={completeRequest} disabled={processing || !signaturePad || !signerName.trim()} data-testid="button-complete-doc">
              {processing && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Generate & Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectDialog} onOpenChange={v => { if (!v) setRejectDialog(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Reject Document Request</DialogTitle></DialogHeader>
          <div>
            <Label>Rejection Reason</Label>
            <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Reason for rejection..." data-testid="input-doc-reject-reason" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={rejectRequest} disabled={processing || !rejectReason.trim()} data-testid="button-confirm-doc-reject">
              {processing && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DocumentsTab() {
  const [subTab, setSubTab] = useState<"templates" | "requests">("templates");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b pb-2">
        <Button variant={subTab === "templates" ? "default" : "outline"} size="sm" onClick={() => setSubTab("templates")} data-testid="button-doc-subtab-templates">
          <FileText className="h-4 w-4 mr-1" /> Document Templates
        </Button>
        <Button variant={subTab === "requests" ? "default" : "outline"} size="sm" onClick={() => setSubTab("requests")} data-testid="button-doc-subtab-requests">
          <Download className="h-4 w-4 mr-1" /> Document Requests
        </Button>
      </div>
      {subTab === "templates" ? <DocTemplatesTab /> : <DocRequestsTab />}
    </div>
  );
}

const SIDEBAR_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: BarChart3, group: "Overview", permissions: [] },
  { key: "staff-profiles", label: "Staff & Salary", icon: UserCog, group: "People", permissions: ["hrms.staff.read", "hrms.salary.read", "employee.view"] },
  { key: "attendance", label: "Attendance", icon: Clock, group: "People", permissions: ["hrms.attendance.read"] },
  { key: "attendance-summary", label: "Attendance Summary", icon: FileText, group: "People", permissions: ["hrms.attendance.read"] },
  { key: "remote-checkin", label: "Remote Check-In", icon: Wifi, group: "People", permissions: ["hrms.attendance.read"] },
  { key: "leave-types", label: "Leave Types", icon: TreePalm, group: "Leave", permissions: ["hrms.leave_type.read"] },
  { key: "leave-requests", label: "Leave Requests", icon: CalendarDays, group: "Leave", permissions: ["hrms.leave_request.read", "hrms.leave_request.approve"] },
  { key: "holidays", label: "Holidays", icon: Calendar, group: "Leave", permissions: ["hrms.holiday.read"] },
  { key: "bonuses", label: "Bonuses", icon: Gift, group: "Payroll & Finance", permissions: ["hrms.bonus.read"] },
  { key: "expenses", label: "Travel Expenses", icon: Receipt, group: "Payroll & Finance", permissions: ["hrms.expense.read"] },
  { key: "advances", label: "Advances", icon: Banknote, group: "Payroll & Finance", permissions: ["hrms.advance.read"] },
  { key: "tax-slabs", label: "Tax Slabs", icon: Calculator, group: "Payroll & Finance", permissions: ["hrms.tax.read"] },
  { key: "payroll", label: "Payroll", icon: DollarSign, group: "Payroll & Finance", permissions: ["hrms.payroll.read"] },
  { key: "govt-records", label: "Govt Records", icon: Landmark, group: "Payroll & Finance", permissions: ["hrms.payroll.read"] },
  { key: "fiscal-years", label: "Fiscal Years", icon: CalendarDays, group: "Settings", permissions: ["hrms.fiscal_year.read"] },
  { key: "countries", label: "Countries", icon: Globe, group: "Settings", permissions: ["hrms.organization.read"] },
  { key: "organizations", label: "Organizations", icon: Building2, group: "Settings", permissions: ["hrms.organization.read"] },
  { key: "departments", label: "Departments", icon: Users, group: "Settings", permissions: ["hrms.department.read"] },
  { key: "hr-policies", label: "HR Policies", icon: ShieldCheck, group: "People", permissions: ["hrms.hr_policy.read"] },
  { key: "documents", label: "Documents", icon: FileText, group: "People", permissions: ["hrms.doc_template.read", "hrms.doc_request.read"] },
  { key: "notifications", label: "Notifications", icon: Bell, group: "Settings", permissions: ["hrms.notification.read", "hrms.notification.update"] },
];

const CONTENT_MAP: Record<string, React.ComponentType> = {
  "dashboard": HRMSDashboardTab,
  "staff-profiles": StaffProfilesTab,
  "attendance": AttendanceTab,
  "attendance-summary": AttendanceSummaryTab,
  "remote-checkin": RemoteCheckInPermissionsTab,
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
  "countries": CountriesTab,
  "fiscal-years": FiscalYearsTab,
  "notifications": NotificationSettingsTab,
  "hr-policies": HRPoliciesTab,
  "documents": DocumentsTab,
};

export default function HRMSAdminPage() {
  const { hasPermission } = useAuth();

  const visibleItems = SIDEBAR_ITEMS.filter(item =>
    item.permissions.length === 0 || item.permissions.some(p => hasPermission(p))
  );

  const [activeTab, setActiveTab] = useState(visibleItems[0]?.key || "staff-profiles");

  const groups = visibleItems.reduce<Record<string, typeof SIDEBAR_ITEMS>>((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {});

  const ActiveComponent = CONTENT_MAP[activeTab];

  return (
    <div className="flex h-full">
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
