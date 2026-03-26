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
  User, DollarSign, Pencil, Building2, Shield,
} from "lucide-react";

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
  marital_status: string | null;
  date_of_birth: string | null;
  join_date: string | null;
  employment_type: string;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_branch: string | null;
  citizenship_no: string | null;
  pan_no: string | null;
  salary_amount: number | null;
  salary_currency: string;
  profile_photo_url: string | null;
  status: string;
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
  id: string; name: string; short_code: string;
}

interface Department {
  id: string; organization_id: string; name: string;
}

export function StaffProfilesTab() {
  const { toast } = useToast();
  const [selectedStaff, setSelectedStaff] = useState<StaffProfile | null>(null);
  const [showSalaryDialog, setShowSalaryDialog] = useState(false);
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

  const { data: staff, isLoading } = useQuery<StaffProfile[]>({ queryKey: ["/api/hrms/staff-profiles"] });
  const { data: orgs } = useQuery<Organization[]>({ queryKey: ["/api/hrms/organizations"] });

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

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-16" /></CardContent></Card>)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Staff Profiles & Salary Management</h2>
        <Badge variant="outline">{staff?.length || 0} Staff</Badge>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
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
          {staff?.map((s) => (
            <TableRow key={s.id} data-testid={`row-staff-${s.id}`}>
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
                      CIT: {s.salary_structure.cit_type === "percentage" ? `${s.salary_structure.cit_value}%` : s.salary_structure.cit_type === "flat" ? `Rs ${s.salary_structure.cit_value}` : "N/A"}
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
                <Button size="sm" variant="outline" onClick={() => openSalaryDialog(s)} data-testid={`btn-salary-${s.id}`}>
                  <DollarSign className="w-3 h-3 mr-1" /> {s.salary_structure ? "Edit Salary" : "Set Salary"}
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {(!staff || staff.length === 0) && (
            <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No active staff found. Add employees from the Employees page first.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>

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
    </div>
  );
}
