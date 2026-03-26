import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  User, DollarSign, Pencil, Building2, Shield, Plus, Eye, Search,
  UserX, UserCheck, MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmployeeDetailView } from "./hrms-employee-detail";

interface StaffProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  position: string | null;
  department: string | null;
  organization_id: string | null;
  organization_name: string | null;
  department_id: string | null;
  department_name: string | null;
  gender: string | null;
  country: string | null;
  marital_status: string | null;
  date_of_birth: string | null;
  join_date: string | null;
  employment_type: string;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_branch: string | null;
  citizenship_no: string | null;
  pan_no: string | null;
  passport_number: string | null;
  employee_id_number: string | null;
  permanent_address: string | null;
  temporary_address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  probation_end_date: string | null;
  contract_end_date: string | null;
  salary_amount: number | null;
  salary_currency: string;
  profile_photo_url: string | null;
  status: string;
  has_portal_access: boolean;
  user_id: number | null;
  salary_structure: {
    id: string;
    basic_salary: number;
    allowances: Record<string, number>;
    deductions: Record<string, number>;
    cit_type: string;
    cit_value: number;
    ssf_applicable: boolean;
    ssf_employee_percentage: number;
    ssf_employer_percentage: number;
    tax_applicable: boolean;
    effective_from: string | null;
  } | null;
  outstanding_advance: number;
}

interface Organization {
  id: string; name: string; short_code: string; currency: string;
  registration_label: string; pan_label: string;
}

interface Department {
  id: string; organization_id: string; name: string;
}

interface CountryTaxLabelRecord {
  id: string;
  country: string;
  tax_id_label: string;
}

function getTaxIdLabelFromList(countries: CountryTaxLabelRecord[], country?: string | null): string {
  if (!country) return 'Tax ID No.';
  const found = countries.find(c => c.country === country);
  return found?.tax_id_label || 'Tax ID No.';
}

export function StaffProfilesTab() {
  const { toast } = useToast();
  const [selectedStaff, setSelectedStaff] = useState<StaffProfile | null>(null);
  const [showSalaryDialog, setShowSalaryDialog] = useState(false);
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [showEditEmployee, setShowEditEmployee] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<StaffProfile | null>(null);
  const [viewEmployeeId, setViewEmployeeId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [statusChangeTarget, setStatusChangeTarget] = useState<{ id: string; name: string; newStatus: string } | null>(null);
  const [portalAccessTarget, setPortalAccessTarget] = useState<StaffProfile | null>(null);
  const [portalForm, setPortalForm] = useState({ password: "", portal_access: "employee", role_id: "" });
  const [portalAccessInfo, setPortalAccessInfo] = useState<any>(null);
  const [loadingAccess, setLoadingAccess] = useState(false);
  const [salaryForm, setSalaryForm] = useState({
    basic_salary: "",
    cit_type: "none",
    cit_value: "0",
    ssf_applicable: false,
    ssf_employee_percentage: "11",
    ssf_employer_percentage: "20",
    tax_applicable: true,
    effective_from: new Date().toISOString().split("T")[0],
    allowances: {} as Record<string, string>,
    deductions: {} as Record<string, string>,
  });
  const [newAllowanceName, setNewAllowanceName] = useState("");
  const [newAllowanceValue, setNewAllowanceValue] = useState("");
  const [newDeductionName, setNewDeductionName] = useState("");
  const [newDeductionValue, setNewDeductionValue] = useState("");

  const [empForm, setEmpForm] = useState({
    full_name: "", email: "", phone: "", position: "", department: "",
    organization_id: "", department_id: "", gender: "", country: "", marital_status: "",
    date_of_birth: "", join_date: new Date().toISOString().split("T")[0], employment_type: "full_time",
    probation_end_date: "", contract_end_date: "",
    citizenship_no: "", pan_no: "", passport_number: "", employee_id_number: "",
    bank_name: "", bank_account_number: "",
    bank_branch: "", permanent_address: "", temporary_address: "",
    salary_amount: "", salary_currency: "NPR",
    emergency_contact_name: "", emergency_contact_phone: "",
  });

  const { data: staff, isLoading } = useQuery<StaffProfile[]>({
    queryKey: ["/api/hrms/staff-profiles", statusFilter],
    queryFn: async () => {
      const res = await fetch(`/api/hrms/staff-profiles?status=${statusFilter}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });
  const { data: orgs } = useQuery<Organization[]>({ queryKey: ["/api/hrms/organizations"] });
  const { data: depts } = useQuery<Department[]>({ queryKey: ["/api/hrms/departments"] });
  const { data: countryLabels } = useQuery<CountryTaxLabelRecord[]>({ queryKey: ["/api/hrms/country-tax-labels"] });
  const countries = countryLabels || [];

  const createSalaryMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/hrms/salary-structures", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hrms/staff-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hrms/salary-structures"] });
      setShowSalaryDialog(false);
      toast({ title: "Salary structure saved" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateSalaryMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PATCH", `/api/hrms/salary-structures/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hrms/staff-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hrms/salary-structures"] });
      setShowSalaryDialog(false);
      toast({ title: "Salary structure updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const createEmployeeMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/employees", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hrms/staff-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setShowAddEmployee(false);
      toast({ title: "Employee added successfully" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateEmployeeMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PUT", `/api/employees/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hrms/staff-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setShowEditEmployee(false);
      setEditingEmployee(null);
      toast({ title: "Employee updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const changeStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/hrms/employees/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hrms/staff-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setStatusChangeTarget(null);
      toast({ title: "Employee status updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const grantAccessMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/hrms/employees/${data.employee_id}/portal-access`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hrms/staff-profiles"] });
      setPortalAccessTarget(null);
      setPortalAccessInfo(null);
      toast({ title: "Portal access granted successfully" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateAccessMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/hrms/employees/${data.employee_id}/portal-access`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hrms/staff-profiles"] });
      setPortalAccessTarget(null);
      setPortalAccessInfo(null);
      toast({ title: "Portal access updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const revokeAccessMutation = useMutation({
    mutationFn: (empId: string) => apiRequest("DELETE", `/api/hrms/employees/${empId}/portal-access`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hrms/staff-profiles"] });
      setPortalAccessTarget(null);
      setPortalAccessInfo(null);
      toast({ title: "Portal access revoked" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const openPortalAccess = async (s: StaffProfile) => {
    setPortalAccessTarget(s);
    setPortalForm({ password: "", portal_access: "employee", role_id: "" });
    setLoadingAccess(true);
    try {
      const res = await fetch(`/api/hrms/employees/${s.id}/portal-access`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setPortalAccessInfo(data);
        if (data.user_info) {
          setPortalForm({
            password: "",
            portal_access: data.user_info.portal_access || "employee",
            role_id: data.user_info.roles?.[0]?.id?.toString() || "",
          });
        }
      }
    } catch (e) { /* ignore */ }
    setLoadingAccess(false);
  };

  const openEditEmployee = (s: StaffProfile) => {
    setEditingEmployee(s);
    setEmpForm({
      full_name: s.full_name, email: s.email, phone: s.phone || "", position: s.position || "",
      department: s.department || "", organization_id: s.organization_id || "",
      department_id: s.department_id || "", gender: s.gender || "", country: s.country || "", marital_status: s.marital_status || "",
      date_of_birth: s.date_of_birth || "", join_date: s.join_date || "", employment_type: s.employment_type || "full_time",
      probation_end_date: s.probation_end_date || "", contract_end_date: s.contract_end_date || "",
      citizenship_no: s.citizenship_no || "", pan_no: s.pan_no || "", passport_number: s.passport_number || "", employee_id_number: s.employee_id_number || "",
      bank_name: s.bank_name || "", bank_account_number: s.bank_account_number || "",
      bank_branch: s.bank_branch || "", permanent_address: s.permanent_address || "", temporary_address: s.temporary_address || "",
      salary_amount: s.salary_amount ? String(s.salary_amount) : "", salary_currency: s.salary_currency || "NPR",
      emergency_contact_name: s.emergency_contact_name || "", emergency_contact_phone: s.emergency_contact_phone || "",
    });
    setShowEditEmployee(true);
  };

  const openSalaryDialog = (s: StaffProfile) => {
    setSelectedStaff(s);
    if (s.salary_structure) {
      const ss = s.salary_structure;
      const allowances: Record<string, string> = {};
      Object.entries(ss.allowances || {}).forEach(([k, v]) => { allowances[k] = String(v); });
      const deductions: Record<string, string> = {};
      Object.entries(ss.deductions || {}).forEach(([k, v]) => { deductions[k] = String(v); });
      setSalaryForm({
        basic_salary: String(ss.basic_salary),
        cit_type: ss.cit_type,
        cit_value: String(ss.cit_value),
        ssf_applicable: ss.ssf_applicable,
        ssf_employee_percentage: String(ss.ssf_employee_percentage),
        ssf_employer_percentage: String(ss.ssf_employer_percentage),
        tax_applicable: ss.tax_applicable,
        effective_from: ss.effective_from || new Date().toISOString().split("T")[0],
        allowances,
        deductions,
      });
    } else {
      setSalaryForm({
        basic_salary: s.salary_amount ? String(s.salary_amount) : "",
        cit_type: "none",
        cit_value: "0",
        ssf_applicable: false,
        ssf_employee_percentage: "11",
        ssf_employer_percentage: "20",
        tax_applicable: true,
        effective_from: new Date().toISOString().split("T")[0],
        allowances: {},
        deductions: {},
      });
    }
    setShowSalaryDialog(true);
  };

  const handleSaveSalary = () => {
    if (!selectedStaff) return;
    const allowances: Record<string, number> = {};
    Object.entries(salaryForm.allowances).forEach(([k, v]) => { allowances[k] = parseFloat(v) || 0; });
    const deductions: Record<string, number> = {};
    Object.entries(salaryForm.deductions).forEach(([k, v]) => { deductions[k] = parseFloat(v) || 0; });

    const payload = {
      employee_id: selectedStaff.id,
      basic_salary: parseFloat(salaryForm.basic_salary) || 0,
      allowances,
      deductions,
      cit_type: salaryForm.cit_type,
      cit_value: parseFloat(salaryForm.cit_value) || 0,
      ssf_applicable: salaryForm.ssf_applicable,
      ssf_employee_percentage: parseFloat(salaryForm.ssf_employee_percentage) || 11,
      ssf_employer_percentage: parseFloat(salaryForm.ssf_employer_percentage) || 20,
      tax_applicable: salaryForm.tax_applicable,
      effective_from: salaryForm.effective_from,
      status: "active",
    };

    if (selectedStaff.salary_structure) {
      updateSalaryMutation.mutate({ id: selectedStaff.salary_structure.id, data: payload });
    } else {
      createSalaryMutation.mutate(payload);
    }
  };

  const handleAddEmployee = () => {
    if (!empForm.full_name.trim() || !empForm.email.trim()) {
      toast({ title: "Name and email are required", variant: "destructive" });
      return;
    }
    const payload: any = {
      fullName: empForm.full_name,
      email: empForm.email,
    };
    if (empForm.phone) payload.phone = empForm.phone;
    if (empForm.position) payload.position = empForm.position;
    if (empForm.department) payload.department = empForm.department;
    if (empForm.organization_id) payload.organization_id = empForm.organization_id;
    if (empForm.department_id) payload.department_id = empForm.department_id;
    if (empForm.gender) payload.gender = empForm.gender;
    if (empForm.country) payload.country = empForm.country;
    if (empForm.marital_status) payload.marital_status = empForm.marital_status;
    if (empForm.join_date) payload.joinDate = empForm.join_date;
    if (empForm.employment_type) payload.employmentType = empForm.employment_type;
    if (empForm.citizenship_no) payload.citizenshipNo = empForm.citizenship_no;
    if (empForm.pan_no) payload.panNo = empForm.pan_no;
    if (empForm.bank_name) payload.bankName = empForm.bank_name;
    if (empForm.bank_account_number) payload.bankAccountNumber = empForm.bank_account_number;
    if (empForm.bank_branch) payload.bankBranch = empForm.bank_branch;
    if (empForm.permanent_address) payload.permanentAddress = empForm.permanent_address;
    if (empForm.temporary_address) payload.temporaryAddress = empForm.temporary_address;
    if (empForm.salary_amount) payload.salaryAmount = parseFloat(empForm.salary_amount);
    if (empForm.salary_currency) payload.salaryCurrency = empForm.salary_currency;
    if (empForm.emergency_contact_name) payload.emergencyContactName = empForm.emergency_contact_name;
    if (empForm.emergency_contact_phone) payload.emergencyContactPhone = empForm.emergency_contact_phone;
    if (empForm.date_of_birth) payload.dateOfBirth = empForm.date_of_birth;
    if (empForm.probation_end_date) payload.probationEndDate = empForm.probation_end_date;
    if (empForm.contract_end_date) payload.contractEndDate = empForm.contract_end_date;

    createEmployeeMutation.mutate(payload);
  };

  const addAllowance = () => {
    if (!newAllowanceName.trim()) return;
    setSalaryForm(prev => ({
      ...prev,
      allowances: { ...prev.allowances, [newAllowanceName.trim()]: newAllowanceValue || "0" },
    }));
    setNewAllowanceName("");
    setNewAllowanceValue("");
  };

  const addDeduction = () => {
    if (!newDeductionName.trim()) return;
    setSalaryForm(prev => ({
      ...prev,
      deductions: { ...prev.deductions, [newDeductionName.trim()]: newDeductionValue || "0" },
    }));
    setNewDeductionName("");
    setNewDeductionValue("");
  };

  const removeAllowance = (key: string) => {
    setSalaryForm(prev => {
      const a = { ...prev.allowances };
      delete a[key];
      return { ...prev, allowances: a };
    });
  };

  const removeDeduction = (key: string) => {
    setSalaryForm(prev => {
      const d = { ...prev.deductions };
      delete d[key];
      return { ...prev, deductions: d };
    });
  };

  const gross = () => {
    const basic = parseFloat(salaryForm.basic_salary) || 0;
    const allTotal = Object.values(salaryForm.allowances).reduce((s, v) => s + (parseFloat(v) || 0), 0);
    return basic + allTotal;
  };

  if (viewEmployeeId) {
    return <EmployeeDetailView employeeId={viewEmployeeId} onBack={() => setViewEmployeeId(null)} />;
  }

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-16" /></CardContent></Card>)}</div>;

  const filteredStaff = searchTerm
    ? staff?.filter(s => s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || s.email.toLowerCase().includes(searchTerm.toLowerCase()) || (s.position || '').toLowerCase().includes(searchTerm.toLowerCase()))
    : staff;

  const filteredDepts = empForm.organization_id
    ? depts?.filter(d => d.organization_id === empForm.organization_id)
    : depts;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Staff Profiles & Salary Management</h2>
          <Badge variant="outline">{staff?.length || 0} Staff</Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border rounded-md overflow-hidden">
            {(["active", "inactive", "terminated", "resigned", "all"] as const).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)} data-testid={`btn-filter-${s}`}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${statusFilter === s ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search staff..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 w-60"
              data-testid="input-search-staff"
            />
          </div>
          <Button onClick={() => {
            setEmpForm({
              full_name: "", email: "", phone: "", position: "", department: "",
              organization_id: orgs?.[0]?.id || "", department_id: "", gender: "", country: "", marital_status: "",
              join_date: new Date().toISOString().split("T")[0], employment_type: "full_time",
              citizenship_no: "", pan_no: "", passport_number: "", employee_id_number: "",
              bank_name: "", bank_account_number: "",
              bank_branch: "", permanent_address: "", temporary_address: "",
              salary_amount: "", salary_currency: "NPR",
              emergency_contact_name: "", emergency_contact_phone: "",
            });
            setShowAddEmployee(true);
          }} data-testid="btn-add-employee">
            <Plus className="w-4 h-4 mr-1" /> Add Employee
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Organization</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>Position</TableHead>
            <TableHead>Employment</TableHead>
            <TableHead className="text-right">Salary</TableHead>
            <TableHead>Tax/CIT</TableHead>
            <TableHead>Advance Due</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredStaff?.map((s) => (
            <TableRow key={s.id} data-testid={`row-staff-${s.id}`} className="cursor-pointer hover:bg-muted/50" onClick={() => setViewEmployeeId(s.id)}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{s.full_name}</p>
                    <p className="text-xs text-muted-foreground">{s.email}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  {(() => {
                    const colors: Record<string, string> = {
                      active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                      inactive: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
                      terminated: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                      resigned: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
                      on_notice: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
                    };
                    return <Badge className={`text-xs ${colors[s.status] || colors.inactive}`} data-testid={`badge-status-${s.id}`}>
                      {s.status === "on_notice" ? "On Notice" : s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                    </Badge>;
                  })()}
                  {s.has_portal_access ? (
                    <Shield className="w-3.5 h-3.5 text-primary" title="Has portal access" />
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="text-sm">{s.organization_name || "—"}</TableCell>
              <TableCell className="text-sm">{s.department_name || s.department || "—"}</TableCell>
              <TableCell className="text-sm">{s.position || "—"}</TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs capitalize">{s.employment_type?.replace("_", " ")}</Badge>
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {s.salary_structure ? `${s.salary_currency} ${s.salary_structure.basic_salary.toLocaleString()}` : s.salary_amount ? `${s.salary_currency} ${s.salary_amount.toLocaleString()}` : "Not Set"}
              </TableCell>
              <TableCell>
                {s.salary_structure ? (
                  <div className="space-y-0.5">
                    <Badge variant={s.salary_structure.cit_type !== "none" ? "default" : "secondary"} className="text-xs">
                      CIT: {s.salary_structure.cit_type === "percentage" ? `${s.salary_structure.cit_value}%` : s.salary_structure.cit_type === "flat" ? `${s.salary_structure.cit_value}` : "N/A"}
                    </Badge>
                    {s.salary_structure.ssf_applicable && <Badge variant="outline" className="text-xs ml-1">SSF</Badge>}
                  </div>
                ) : <span className="text-xs text-muted-foreground">Not configured</span>}
              </TableCell>
              <TableCell className="font-mono text-sm">
                {s.outstanding_advance > 0 ? (
                  <span className="text-red-600">{s.salary_currency} {s.outstanding_advance.toLocaleString()}</span>
                ) : <span className="text-muted-foreground">—</span>}
              </TableCell>
              <TableCell>
                <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                  <Button size="sm" variant="ghost" onClick={() => setViewEmployeeId(s.id)} data-testid={`btn-view-${s.id}`} title="View Details">
                    <Eye className="w-3 h-3" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openEditEmployee(s)} data-testid={`btn-edit-${s.id}`} title="Edit Employee">
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openSalaryDialog(s)} data-testid={`btn-salary-${s.id}`}>
                    <DollarSign className="w-3 h-3 mr-1" /> {s.salary_structure ? "Edit" : "Set"}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost" data-testid={`btn-more-${s.id}`}>
                        <MoreHorizontal className="w-3 h-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {s.status === "active" && (
                        <>
                          <DropdownMenuItem onClick={() => setStatusChangeTarget({ id: s.id, name: s.full_name, newStatus: "inactive" })} data-testid={`btn-deactivate-${s.id}`}>
                            <UserX className="w-3.5 h-3.5 mr-2 text-gray-500" /> Deactivate
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setStatusChangeTarget({ id: s.id, name: s.full_name, newStatus: "on_notice" })} data-testid={`btn-notice-${s.id}`}>
                            <UserX className="w-3.5 h-3.5 mr-2 text-orange-500" /> Put on Notice
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setStatusChangeTarget({ id: s.id, name: s.full_name, newStatus: "terminated" })} className="text-red-600" data-testid={`btn-terminate-${s.id}`}>
                            <UserX className="w-3.5 h-3.5 mr-2" /> Terminate
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setStatusChangeTarget({ id: s.id, name: s.full_name, newStatus: "resigned" })} data-testid={`btn-resign-${s.id}`}>
                            <UserX className="w-3.5 h-3.5 mr-2 text-amber-500" /> Mark as Resigned
                          </DropdownMenuItem>
                        </>
                      )}
                      {s.status !== "active" && (
                        <DropdownMenuItem onClick={() => setStatusChangeTarget({ id: s.id, name: s.full_name, newStatus: "active" })} data-testid={`btn-reactivate-${s.id}`}>
                          <UserCheck className="w-3.5 h-3.5 mr-2 text-green-500" /> Reactivate
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => openPortalAccess(s)} data-testid={`btn-portal-${s.id}`}>
                        <Shield className="w-3.5 h-3.5 mr-2 text-primary" /> {s.has_portal_access ? "Manage Access" : "Grant Portal Access"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {(!filteredStaff || filteredStaff.length === 0) && (
            <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">
              {searchTerm ? "No staff matching search." : statusFilter === "active" ? "No active staff found. Click 'Add Employee' to onboard your first employee." : `No ${statusFilter} employees found.`}
            </TableCell></TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={showAddEmployee} onOpenChange={setShowAddEmployee}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add New Employee</DialogTitle></DialogHeader>
          <div className="space-y-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Personal Information</p>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Full Name *</Label><Input value={empForm.full_name} onChange={e => setEmpForm({ ...empForm, full_name: e.target.value })} data-testid="input-emp-name" /></div>
              <div><Label>Email *</Label><Input type="email" value={empForm.email} onChange={e => setEmpForm({ ...empForm, email: e.target.value })} data-testid="input-emp-email" /></div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div><Label>Phone</Label><Input value={empForm.phone} onChange={e => setEmpForm({ ...empForm, phone: e.target.value })} data-testid="input-emp-phone" /></div>
              <div><Label>Date of Birth</Label><Input type="date" value={empForm.date_of_birth} onChange={e => setEmpForm({ ...empForm, date_of_birth: e.target.value })} data-testid="input-emp-dob" /></div>
              <div>
                <Label>Gender</Label>
                <Select value={empForm.gender} onValueChange={v => setEmpForm({ ...empForm, gender: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Marital Status</Label>
                <Select value={empForm.marital_status} onValueChange={v => setEmpForm({ ...empForm, marital_status: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single</SelectItem>
                    <SelectItem value="married">Married</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Country</Label>
                <Select value={empForm.country} onValueChange={v => setEmpForm({ ...empForm, country: v })}>
                  <SelectTrigger><SelectValue placeholder="Select Country" /></SelectTrigger>
                  <SelectContent>
                    {countries.map(c => <SelectItem key={c.country} value={c.country}>{c.country}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Position</Label><Input value={empForm.position} onChange={e => setEmpForm({ ...empForm, position: e.target.value })} data-testid="input-emp-position" /></div>
            </div>

            <hr className="border-border" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Employment & Emergency</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Organization</Label>
                <Select value={empForm.organization_id} onValueChange={v => { const selOrg = orgs?.find(o => o.id === v); setEmpForm({ ...empForm, organization_id: v, department_id: "", salary_currency: selOrg?.currency || "NPR" }); }}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{orgs?.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Department</Label>
                <Select value={empForm.department_id} onValueChange={v => {
                  const dept = depts?.find(d => d.id === v);
                  setEmpForm({ ...empForm, department_id: v, department: dept?.name || "" });
                }}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{filteredDepts?.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Employment Type</Label>
                <Select value={empForm.employment_type} onValueChange={v => setEmpForm({ ...empForm, employment_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_time">Full Time</SelectItem>
                    <SelectItem value="part_time">Part Time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="intern">Intern</SelectItem>
                    <SelectItem value="probation">Probation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Join Date</Label><Input type="date" value={empForm.join_date} onChange={e => setEmpForm({ ...empForm, join_date: e.target.value })} data-testid="input-emp-join-date" /></div>
              <div><Label>Probation End</Label><Input type="date" value={empForm.probation_end_date} onChange={e => setEmpForm({ ...empForm, probation_end_date: e.target.value })} data-testid="input-emp-probation-end" /></div>
              <div><Label>Contract End</Label><Input type="date" value={empForm.contract_end_date} onChange={e => setEmpForm({ ...empForm, contract_end_date: e.target.value })} data-testid="input-emp-contract-end" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Emergency Contact Name</Label><Input value={empForm.emergency_contact_name} onChange={e => setEmpForm({ ...empForm, emergency_contact_name: e.target.value })} data-testid="input-emp-emergency-name" /></div>
              <div><Label>Emergency Contact Phone</Label><Input value={empForm.emergency_contact_phone} onChange={e => setEmpForm({ ...empForm, emergency_contact_phone: e.target.value })} data-testid="input-emp-emergency-phone" /></div>
            </div>

            <hr className="border-border" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Identity & Documents</p>
            <div className="grid grid-cols-4 gap-4">
              <div><Label>Employee ID</Label><Input value={empForm.employee_id_number} onChange={e => setEmpForm({ ...empForm, employee_id_number: e.target.value })} placeholder="ZKT Device ID" data-testid="input-emp-id-number" /></div>
              <div><Label>Citizenship No</Label><Input value={empForm.citizenship_no} onChange={e => setEmpForm({ ...empForm, citizenship_no: e.target.value })} /></div>
              <div><Label>{getTaxIdLabelFromList(countries, empForm.country)}</Label><Input value={empForm.pan_no} onChange={e => setEmpForm({ ...empForm, pan_no: e.target.value })} /></div>
              <div><Label>Passport Number</Label><Input value={empForm.passport_number} onChange={e => setEmpForm({ ...empForm, passport_number: e.target.value })} data-testid="input-emp-passport" /></div>
            </div>

            <hr className="border-border" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bank Details</p>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Bank Name</Label><Input value={empForm.bank_name} onChange={e => setEmpForm({ ...empForm, bank_name: e.target.value })} data-testid="input-emp-bank-name" /></div>
              <div><Label>Account Number</Label><Input value={empForm.bank_account_number} onChange={e => setEmpForm({ ...empForm, bank_account_number: e.target.value })} data-testid="input-emp-bank-account" /></div>
              <div><Label>Bank Branch</Label><Input value={empForm.bank_branch} onChange={e => setEmpForm({ ...empForm, bank_branch: e.target.value })} data-testid="input-emp-bank-branch" /></div>
            </div>

            <hr className="border-border" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Address</p>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Permanent Address</Label><Input value={empForm.permanent_address} onChange={e => setEmpForm({ ...empForm, permanent_address: e.target.value })} data-testid="input-emp-perm-address" /></div>
              <div><Label>Temporary Address</Label><Input value={empForm.temporary_address} onChange={e => setEmpForm({ ...empForm, temporary_address: e.target.value })} data-testid="input-emp-temp-address" /></div>
            </div>

            <hr className="border-border" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Salary</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Salary ({empForm.salary_currency})</Label>
                <Input type="number" value={empForm.salary_amount} onChange={e => setEmpForm({ ...empForm, salary_amount: e.target.value })} data-testid="input-emp-salary" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddEmployee(false)}>Cancel</Button>
            <Button onClick={handleAddEmployee} disabled={createEmployeeMutation.isPending} data-testid="btn-save-employee">
              {createEmployeeMutation.isPending ? "Adding..." : "Add Employee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditEmployee} onOpenChange={(open) => { if (!open) { setShowEditEmployee(false); setEditingEmployee(null); } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Employee — {editingEmployee?.full_name}</DialogTitle></DialogHeader>
          <div className="space-y-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Personal Information</p>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Full Name *</Label><Input value={empForm.full_name} onChange={e => setEmpForm({ ...empForm, full_name: e.target.value })} /></div>
              <div><Label>Email *</Label><Input type="email" value={empForm.email} onChange={e => setEmpForm({ ...empForm, email: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div><Label>Phone</Label><Input value={empForm.phone} onChange={e => setEmpForm({ ...empForm, phone: e.target.value })} /></div>
              <div><Label>Date of Birth</Label><Input type="date" value={empForm.date_of_birth} onChange={e => setEmpForm({ ...empForm, date_of_birth: e.target.value })} /></div>
              <div>
                <Label>Gender</Label>
                <Select value={empForm.gender} onValueChange={v => setEmpForm({ ...empForm, gender: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Marital Status</Label>
                <Select value={empForm.marital_status} onValueChange={v => setEmpForm({ ...empForm, marital_status: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single</SelectItem>
                    <SelectItem value="married">Married</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Country</Label>
                <Select value={empForm.country} onValueChange={v => setEmpForm({ ...empForm, country: v })}>
                  <SelectTrigger><SelectValue placeholder="Select Country" /></SelectTrigger>
                  <SelectContent>
                    {countries.map(c => <SelectItem key={c.country} value={c.country}>{c.country}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Position</Label><Input value={empForm.position} onChange={e => setEmpForm({ ...empForm, position: e.target.value })} /></div>
            </div>

            <hr className="border-border" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Employment & Emergency</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Organization *</Label>
                <Select value={empForm.organization_id} onValueChange={v => { const selOrg = orgs?.find(o => o.id === v); setEmpForm({ ...empForm, organization_id: v, department_id: "", salary_currency: selOrg?.currency || "NPR" }); }}>
                  <SelectTrigger data-testid="edit-select-org"><SelectValue placeholder="Select organization" /></SelectTrigger>
                  <SelectContent>{orgs?.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Department</Label>
                <Select value={empForm.department_id} onValueChange={v => {
                  const dept = depts?.find(d => d.id === v);
                  setEmpForm({ ...empForm, department_id: v, department: dept?.name || "" });
                }}>
                  <SelectTrigger data-testid="edit-select-dept"><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>{filteredDepts?.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Employment Type</Label>
                <Select value={empForm.employment_type} onValueChange={v => setEmpForm({ ...empForm, employment_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_time">Full Time</SelectItem>
                    <SelectItem value="part_time">Part Time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="intern">Intern</SelectItem>
                    <SelectItem value="probation">Probation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Join Date</Label><Input type="date" value={empForm.join_date} onChange={e => setEmpForm({ ...empForm, join_date: e.target.value })} /></div>
              <div><Label>Probation End</Label><Input type="date" value={empForm.probation_end_date} onChange={e => setEmpForm({ ...empForm, probation_end_date: e.target.value })} /></div>
              <div><Label>Contract End</Label><Input type="date" value={empForm.contract_end_date} onChange={e => setEmpForm({ ...empForm, contract_end_date: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Emergency Contact Name</Label><Input value={empForm.emergency_contact_name} onChange={e => setEmpForm({ ...empForm, emergency_contact_name: e.target.value })} /></div>
              <div><Label>Emergency Contact Phone</Label><Input value={empForm.emergency_contact_phone} onChange={e => setEmpForm({ ...empForm, emergency_contact_phone: e.target.value })} /></div>
            </div>

            <hr className="border-border" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Identity & Documents</p>
            <div className="grid grid-cols-4 gap-4">
              <div><Label>Employee ID</Label><Input value={empForm.employee_id_number} onChange={e => setEmpForm({ ...empForm, employee_id_number: e.target.value })} placeholder="ZKT Device ID" /></div>
              <div><Label>Citizenship No</Label><Input value={empForm.citizenship_no} onChange={e => setEmpForm({ ...empForm, citizenship_no: e.target.value })} /></div>
              <div><Label>{getTaxIdLabelFromList(countries, empForm.country)}</Label><Input value={empForm.pan_no} onChange={e => setEmpForm({ ...empForm, pan_no: e.target.value })} /></div>
              <div><Label>Passport Number</Label><Input value={empForm.passport_number} onChange={e => setEmpForm({ ...empForm, passport_number: e.target.value })} /></div>
            </div>

            <hr className="border-border" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bank Details</p>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Bank Name</Label><Input value={empForm.bank_name} onChange={e => setEmpForm({ ...empForm, bank_name: e.target.value })} /></div>
              <div><Label>Account Number</Label><Input value={empForm.bank_account_number} onChange={e => setEmpForm({ ...empForm, bank_account_number: e.target.value })} /></div>
              <div><Label>Bank Branch</Label><Input value={empForm.bank_branch} onChange={e => setEmpForm({ ...empForm, bank_branch: e.target.value })} /></div>
            </div>

            <hr className="border-border" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Address</p>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Permanent Address</Label><Input value={empForm.permanent_address} onChange={e => setEmpForm({ ...empForm, permanent_address: e.target.value })} /></div>
              <div><Label>Temporary Address</Label><Input value={empForm.temporary_address} onChange={e => setEmpForm({ ...empForm, temporary_address: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEditEmployee(false); setEditingEmployee(null); }}>Cancel</Button>
            <Button onClick={() => {
              if (!editingEmployee || !empForm.full_name.trim()) return;
              const payload: any = {
                fullName: empForm.full_name, email: empForm.email,
              };
              if (empForm.phone) payload.phone = empForm.phone;
              if (empForm.position) payload.position = empForm.position;
              if (empForm.department) payload.department = empForm.department;
              payload.organization_id = empForm.organization_id || null;
              payload.department_id = empForm.department_id || null;
              if (empForm.gender) payload.gender = empForm.gender;
              if (empForm.country) payload.country = empForm.country;
              if (empForm.marital_status) payload.marital_status = empForm.marital_status;
              if (empForm.join_date) payload.joinDate = empForm.join_date;
              if (empForm.employment_type) payload.employmentType = empForm.employment_type;
              if (empForm.pan_no) payload.panNo = empForm.pan_no;
              if (empForm.citizenship_no) payload.citizenshipNo = empForm.citizenship_no;
              if (empForm.passport_number) payload.passportNumber = empForm.passport_number;
              if (empForm.employee_id_number) payload.employeeIdNumber = empForm.employee_id_number;
              if (empForm.bank_name) payload.bankName = empForm.bank_name;
              if (empForm.bank_account_number) payload.bankAccountNumber = empForm.bank_account_number;
              if (empForm.bank_branch) payload.bankBranch = empForm.bank_branch;
              if (empForm.permanent_address) payload.permanentAddress = empForm.permanent_address;
              payload.temporaryAddress = empForm.temporary_address || "";
              payload.emergencyContactName = empForm.emergency_contact_name || "";
              payload.emergencyContactPhone = empForm.emergency_contact_phone || "";
              payload.dateOfBirth = empForm.date_of_birth || null;
              payload.probationEndDate = empForm.probation_end_date || null;
              payload.contractEndDate = empForm.contract_end_date || null;
              updateEmployeeMutation.mutate({ id: editingEmployee.id, data: payload });
            }} disabled={updateEmployeeMutation.isPending} data-testid="btn-update-employee">
              {updateEmployeeMutation.isPending ? "Saving..." : "Update Employee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSalaryDialog} onOpenChange={setShowSalaryDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedStaff?.salary_structure ? "Edit" : "Set"} Salary Structure — {selectedStaff?.full_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Basic Salary ({selectedStaff?.salary_currency})</Label>
                <Input type="number" value={salaryForm.basic_salary} onChange={e => setSalaryForm({ ...salaryForm, basic_salary: e.target.value })} data-testid="input-basic-salary" />
              </div>
              <div>
                <Label>Effective From</Label>
                <Input type="date" value={salaryForm.effective_from} onChange={e => setSalaryForm({ ...salaryForm, effective_from: e.target.value })} data-testid="input-effective-from" />
              </div>
            </div>

            <Card>
              <CardHeader className="p-3"><CardTitle className="text-sm">Allowances</CardTitle></CardHeader>
              <CardContent className="p-3 pt-0 space-y-2">
                {Object.entries(salaryForm.allowances).map(([name, val]) => (
                  <div key={name} className="flex items-center gap-2">
                    <span className="text-sm flex-1">{name}</span>
                    <Input className="w-32" type="number" value={val} onChange={e => setSalaryForm(prev => ({ ...prev, allowances: { ...prev.allowances, [name]: e.target.value } }))} />
                    <Button size="sm" variant="ghost" onClick={() => removeAllowance(name)} className="text-destructive">×</Button>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <Input className="flex-1" placeholder="Allowance name" value={newAllowanceName} onChange={e => setNewAllowanceName(e.target.value)} />
                  <Input className="w-32" type="number" placeholder="Amount" value={newAllowanceValue} onChange={e => setNewAllowanceValue(e.target.value)} />
                  <Button size="sm" variant="outline" onClick={addAllowance}>Add</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-3"><CardTitle className="text-sm">Recurring Deductions</CardTitle></CardHeader>
              <CardContent className="p-3 pt-0 space-y-2">
                {Object.entries(salaryForm.deductions).map(([name, val]) => (
                  <div key={name} className="flex items-center gap-2">
                    <span className="text-sm flex-1">{name}</span>
                    <Input className="w-32" type="number" value={val} onChange={e => setSalaryForm(prev => ({ ...prev, deductions: { ...prev.deductions, [name]: e.target.value } }))} />
                    <Button size="sm" variant="ghost" onClick={() => removeDeduction(name)} className="text-destructive">×</Button>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <Input className="flex-1" placeholder="Deduction name" value={newDeductionName} onChange={e => setNewDeductionName(e.target.value)} />
                  <Input className="w-32" type="number" placeholder="Amount" value={newDeductionValue} onChange={e => setNewDeductionValue(e.target.value)} />
                  <Button size="sm" variant="outline" onClick={addDeduction}>Add</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-3"><CardTitle className="text-sm">Tax Configuration</CardTitle></CardHeader>
              <CardContent className="p-3 pt-0 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>CIT Type</Label>
                    <Select value={salaryForm.cit_type} onValueChange={v => setSalaryForm({ ...salaryForm, cit_type: v })} data-testid="select-cit-type">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not Applicable</SelectItem>
                        <SelectItem value="percentage">Percentage of Salary</SelectItem>
                        <SelectItem value="flat">Flat Amount</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {salaryForm.cit_type !== "none" && (
                    <div>
                      <Label>CIT Value {salaryForm.cit_type === "percentage" ? "(%)" : "(Amount)"}</Label>
                      <Input type="number" value={salaryForm.cit_value} onChange={e => setSalaryForm({ ...salaryForm, cit_value: e.target.value })} data-testid="input-cit-value" />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <Checkbox checked={salaryForm.ssf_applicable} onCheckedChange={(v) => setSalaryForm({ ...salaryForm, ssf_applicable: !!v })} data-testid="chk-ssf" />
                  <Label>SSF Applicable</Label>
                </div>
                {salaryForm.ssf_applicable && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Employee SSF %</Label>
                      <Input type="number" value={salaryForm.ssf_employee_percentage} onChange={e => setSalaryForm({ ...salaryForm, ssf_employee_percentage: e.target.value })} />
                    </div>
                    <div>
                      <Label>Employer SSF %</Label>
                      <Input type="number" value={salaryForm.ssf_employer_percentage} onChange={e => setSalaryForm({ ...salaryForm, ssf_employer_percentage: e.target.value })} />
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <Checkbox checked={salaryForm.tax_applicable} onCheckedChange={(v) => setSalaryForm({ ...salaryForm, tax_applicable: !!v })} data-testid="chk-tax" />
                  <Label>Income Tax Applicable (Nepal Tax Slabs)</Label>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-muted/50">
              <CardContent className="p-3">
                <p className="text-sm font-medium mb-2">Salary Summary</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span>Gross Salary:</span>
                  <span className="font-mono text-right">{selectedStaff?.salary_currency} {gross().toLocaleString()}</span>
                  {salaryForm.cit_type !== "none" && (
                    <>
                      <span>CIT Deduction:</span>
                      <span className="font-mono text-right text-red-600">
                        - {salaryForm.cit_type === "percentage" ? `${salaryForm.cit_value}% = ${(gross() * parseFloat(salaryForm.cit_value || "0") / 100).toLocaleString()}` : `${parseFloat(salaryForm.cit_value || "0").toLocaleString()}`}
                      </span>
                    </>
                  )}
                  {salaryForm.ssf_applicable && (
                    <>
                      <span>SSF (Employee {salaryForm.ssf_employee_percentage}%):</span>
                      <span className="font-mono text-right text-red-600">- {(gross() * parseFloat(salaryForm.ssf_employee_percentage || "0") / 100).toLocaleString()}</span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSalaryDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveSalary} disabled={createSalaryMutation.isPending || updateSalaryMutation.isPending} data-testid="btn-save-salary">
              {createSalaryMutation.isPending || updateSalaryMutation.isPending ? "Saving..." : "Save Salary Structure"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!portalAccessTarget} onOpenChange={open => { if (!open) { setPortalAccessTarget(null); setPortalAccessInfo(null); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              {portalAccessInfo?.has_access ? "Manage Portal Access" : "Grant Portal Access"}
            </DialogTitle>
          </DialogHeader>
          {loadingAccess ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : portalAccessInfo?.has_access ? (
            <div className="space-y-4">
              <div className="rounded-lg border p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-medium">{portalAccessInfo.user_info?.email}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Account Status</span>
                  <Badge className={portalAccessInfo.user_info?.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                    {portalAccessInfo.user_info?.is_active ? "Active" : "Disabled"}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Last Login</span>
                  <span>{portalAccessInfo.user_info?.last_login_at ? new Date(portalAccessInfo.user_info.last_login_at).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Never"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Roles</span>
                  <span>{portalAccessInfo.user_info?.roles?.map((r: any) => r.name).join(", ") || "No roles"}</span>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <Label>Portal Access Level</Label>
                  <Select value={portalForm.portal_access} onValueChange={v => setPortalForm(f => ({ ...f, portal_access: v }))}>
                    <SelectTrigger data-testid="select-portal-access"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">People Portal Only</SelectItem>
                      <SelectItem value="admin">Admin Portal Only</SelectItem>
                      <SelectItem value="both">Both Portals</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Role</Label>
                  <Select value={portalForm.role_id} onValueChange={v => setPortalForm(f => ({ ...f, role_id: v }))}>
                    <SelectTrigger data-testid="select-portal-role"><SelectValue placeholder="Select role" /></SelectTrigger>
                    <SelectContent>
                      {portalAccessInfo.available_roles?.map((r: any) => (
                        <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Reset Password (leave blank to keep current)</Label>
                  <Input type="password" value={portalForm.password} onChange={e => setPortalForm(f => ({ ...f, password: e.target.value }))} placeholder="New password (min 8 chars)" data-testid="input-reset-password" />
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="destructive" size="sm" onClick={() => { if (portalAccessTarget) revokeAccessMutation.mutate(portalAccessTarget.id); }} disabled={revokeAccessMutation.isPending} data-testid="btn-revoke-access">
                  {revokeAccessMutation.isPending ? "Revoking..." : "Revoke Access"}
                </Button>
                <Button onClick={() => {
                  if (!portalAccessTarget) return;
                  const payload: any = { employee_id: portalAccessTarget.id, portal_access: portalForm.portal_access };
                  if (portalForm.role_id) payload.role_id = parseInt(portalForm.role_id);
                  if (portalForm.password) payload.reset_password = portalForm.password;
                  updateAccessMutation.mutate(payload);
                }} disabled={updateAccessMutation.isPending} data-testid="btn-update-access">
                  {updateAccessMutation.isPending ? "Updating..." : "Update Access"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Create a login account for <strong>{portalAccessTarget?.full_name}</strong> ({portalAccessTarget?.email}).
                They will receive a temporary password and will be asked to change it on first login.
              </p>
              <div className="space-y-3">
                <div>
                  <Label>Temporary Password *</Label>
                  <Input type="password" value={portalForm.password} onChange={e => setPortalForm(f => ({ ...f, password: e.target.value }))} placeholder="Min 8 characters" data-testid="input-temp-password" />
                </div>
                <div>
                  <Label>Portal Access Level</Label>
                  <Select value={portalForm.portal_access} onValueChange={v => setPortalForm(f => ({ ...f, portal_access: v }))}>
                    <SelectTrigger data-testid="select-new-portal-access"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">People Portal Only</SelectItem>
                      <SelectItem value="admin">Admin Portal Only</SelectItem>
                      <SelectItem value="both">Both Portals</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Role</Label>
                  <Select value={portalForm.role_id} onValueChange={v => setPortalForm(f => ({ ...f, role_id: v }))}>
                    <SelectTrigger data-testid="select-new-portal-role"><SelectValue placeholder="Select role (optional)" /></SelectTrigger>
                    <SelectContent>
                      {portalAccessInfo?.available_roles?.map((r: any) => (
                        <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => {
                  if (!portalAccessTarget) return;
                  if (!portalForm.password || portalForm.password.length < 8) {
                    toast({ title: "Password must be at least 8 characters", variant: "destructive" });
                    return;
                  }
                  const payload: any = {
                    employee_id: portalAccessTarget.id,
                    password: portalForm.password,
                    portal_access: portalForm.portal_access,
                  };
                  if (portalForm.role_id) payload.role_id = parseInt(portalForm.role_id);
                  grantAccessMutation.mutate(payload);
                }} disabled={grantAccessMutation.isPending} data-testid="btn-grant-access">
                  <Shield className="w-4 h-4 mr-1" />
                  {grantAccessMutation.isPending ? "Granting..." : "Grant Portal Access"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!statusChangeTarget} onOpenChange={open => { if (!open) setStatusChangeTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {statusChangeTarget?.newStatus === "terminated" ? "Terminate Employee" :
               statusChangeTarget?.newStatus === "inactive" ? "Deactivate Employee" :
               statusChangeTarget?.newStatus === "resigned" ? "Mark as Resigned" :
               statusChangeTarget?.newStatus === "on_notice" ? "Put on Notice" :
               "Reactivate Employee"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {statusChangeTarget?.newStatus === "terminated"
                ? `Are you sure you want to terminate "${statusChangeTarget?.name}"? They will no longer appear in active views including attendance and payroll.`
                : statusChangeTarget?.newStatus === "active"
                ? `Are you sure you want to reactivate "${statusChangeTarget?.name}"? They will appear in active views again.`
                : `Are you sure you want to change the status of "${statusChangeTarget?.name}" to ${statusChangeTarget?.newStatus}?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="btn-cancel-status">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (statusChangeTarget) {
                  changeStatusMutation.mutate({ id: statusChangeTarget.id, status: statusChangeTarget.newStatus });
                }
              }}
              className={statusChangeTarget?.newStatus === "terminated" ? "bg-red-600 hover:bg-red-700" : ""}
              data-testid="btn-confirm-status"
            >
              {changeStatusMutation.isPending ? "Updating..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
