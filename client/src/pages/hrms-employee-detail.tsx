import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  User, DollarSign, Calendar, Clock, Gift, Banknote, Receipt,
  ArrowLeft, Building2, Phone, Mail, MapPin, CreditCard, Shield,
  FileText, TrendingUp, ExternalLink, Download,
} from "lucide-react";
import { useLocation } from "wouter";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const COUNTRY_TAX_LABELS: Record<string, string> = {
  'Nepal': 'PAN No.',
  'Australia': 'TFN',
  'Bangladesh': 'TIN',
  'India': 'PAN',
  'United Kingdom': 'NI Number',
  'United States': 'SSN',
  'Canada': 'SIN',
  'New Zealand': 'IRD Number',
  'Pakistan': 'NTN',
  'Sri Lanka': 'TIN',
  'Philippines': 'TIN',
  'Malaysia': 'TIN',
  'Singapore': 'NRIC/FIN',
  'Japan': 'My Number',
  'South Korea': 'RRN',
  'Germany': 'Tax ID',
  'France': 'NIF',
  'UAE': 'TRN',
  'Saudi Arabia': 'TIN',
  'Qatar': 'QID',
  'China': 'Tax ID',
};

function getTaxIdLabel(country?: string | null): string {
  if (!country) return 'Tax ID No.';
  return COUNTRY_TAX_LABELS[country] || 'Tax ID No.';
}

const BONUS_TYPES: Record<string, string> = {
  festival: "Festival", dashain: "Dashain", performance: "Performance",
  target: "Target", attendance: "Attendance", referral: "Referral",
  joining: "Joining", retention: "Retention", commission: "Commission",
  yearly: "Year-End", special: "Special", other: "Other",
};

interface Employee360Data {
  employee: {
    id: string; full_name: string; email: string; phone: string | null;
    position: string | null; department: string | null; organization_name: string | null;
    registration_label: string; pan_label: string;
    department_name: string | null; organization_id: string | null; department_id: string | null;
    gender: string | null; country: string | null; marital_status: string | null; date_of_birth: string | null;
    join_date: string | null; employment_type: string; bank_name: string | null;
    bank_account_number: string | null; bank_branch: string | null;
    citizenship_no: string | null; pan_no: string | null; passport_number: string | null; employee_id_number: string | null;
    permanent_address: string | null; temporary_address: string | null;
    salary_currency: string; profile_photo_url: string | null; status: string;
    probation_end_date: string | null; contract_end_date: string | null;
    emergency_contact_name: string | null; emergency_contact_phone: string | null;
  };
  salary_structure: {
    id: string; basic_salary: number; allowances: Record<string, number>;
    deductions: Record<string, number>; cit_type: string; cit_value: number;
    ssf_applicable: boolean; ssf_employee_percentage: number;
    ssf_employer_percentage: number; tax_applicable: boolean;
    effective_from: string | null;
  } | null;
  attendance_summary: {
    month: number; year: number; present: number; absent: number;
    late: number; half_day: number; on_leave: number; total_records: number;
  };
  leave_balances: Array<{
    leave_type: string; leave_type_code: string; color: string;
    allocated: number; used: number; carried_forward: number; remaining: number;
  }>;
  recent_payslips: Array<{
    id: string; month: number; year: number; basic_salary: number;
    gross_salary: number; cit_deduction: number; ssf_employee_deduction: number;
    ssf_employer_contribution: number; tax_deduction: number; bonus_amount: number;
    travel_reimbursement: number; advance_deduction: number;
    unpaid_leave_deduction: number; total_deductions: number;
    net_salary: number; working_days: number; present_days: number; status: string;
  }>;
  bonuses: Array<{
    id: string; bonus_type: string; amount: number; reason: string | null;
    month: number; year: number; is_taxable: boolean; status: string;
  }>;
  advances: Array<{
    id: string; amount: number; reason: string | null; request_date: string | null;
    monthly_deduction: number; total_deducted: number;
    remaining_balance: number; status: string;
  }>;
  expenses: Array<{
    id: string; category: string; description: string; amount: number;
    expense_date: string | null; status: string; include_in_salary: boolean;
  }>;
  outstanding_advance: number;
  tax_summary: { year: number; total_tax: number; total_cit: number; total_ssf: number };
}

export function EmployeeDetailView({ employeeId, onBack }: { employeeId: string; onBack: () => void }) {
  const [, navigate] = useLocation();
  const { data, isLoading } = useQuery<Employee360Data>({
    queryKey: ["/api/hrms/employee-360", employeeId],
    queryFn: async () => {
      const res = await fetch(`/api/hrms/employee-360/${employeeId}`, { credentials: "include" });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      return res.json();
    },
  });

  if (isLoading) return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={onBack} data-testid="btn-back-staff"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Staff List</Button>
      <Skeleton className="h-40" />
      <div className="grid grid-cols-3 gap-4">{[1,2,3].map(i => <Skeleton key={i} className="h-24" />)}</div>
    </div>
  );

  if (!data) return <div className="text-center py-8 text-muted-foreground">Employee not found</div>;

  const emp = data.employee;
  const sal = data.salary_structure;
  const att = data.attendance_summary;
  const gross = sal ? sal.basic_salary + Object.values(sal.allowances).reduce((s, v) => s + v, 0) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} data-testid="btn-back-staff"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Staff List</Button>
        <Button variant="outline" size="sm" onClick={() => navigate(`/employees/${employeeId}`)} data-testid="btn-agreements-offers">
          <FileText className="w-4 h-4 mr-1" /> Agreements & Offers
        </Button>
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              {emp.profile_photo_url ? (
                <img src={emp.profile_photo_url} alt={emp.full_name} className="w-16 h-16 rounded-full object-cover" />
              ) : (
                <User className="w-8 h-8 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-bold" data-testid="text-emp-name">{emp.full_name}</h2>
                <Badge variant={emp.status === 'active' ? 'default' : 'secondary'} data-testid="badge-emp-status">{emp.status}</Badge>
                <Badge variant="outline" className="capitalize">{emp.employment_type?.replace('_', ' ')}</Badge>
                {emp.marital_status && <Badge variant="outline" className="capitalize">{emp.marital_status}</Badge>}
              </div>
              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                {emp.position && <span className="flex items-center gap-1"><Shield className="w-3 h-3" />{emp.position}</span>}
                {emp.organization_name && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{emp.organization_name}</span>}
                {emp.department_name && <span>• {emp.department_name}</span>}
              </div>
              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{emp.email}</span>
                {emp.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{emp.phone}</span>}
                {emp.join_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Joined: {emp.join_date}</span>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Gross Salary</p>
            <p className="text-lg font-bold font-mono" data-testid="text-gross-salary">{emp.salary_currency} {gross.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">This Month Attendance</p>
            <p className="text-lg font-bold" data-testid="text-present-days">{att.present} / {att.total_records} days</p>
            {att.late > 0 && <p className="text-xs text-orange-500">{att.late} late</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Outstanding Advance</p>
            <p className={`text-lg font-bold font-mono ${data.outstanding_advance > 0 ? 'text-red-600' : ''}`} data-testid="text-advance-due">
              {emp.salary_currency} {data.outstanding_advance.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Tax Paid ({data.tax_summary.year})</p>
            <p className="text-lg font-bold font-mono" data-testid="text-tax-paid">
              {emp.salary_currency} {data.tax_summary.total_tax.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="salary" className="w-full">
        <TabsList className="flex w-full overflow-x-auto">
          <TabsTrigger value="salary" data-testid="tab-360-salary"><DollarSign className="w-3 h-3 mr-1" />Salary</TabsTrigger>
          <TabsTrigger value="attendance" data-testid="tab-360-attendance"><Clock className="w-3 h-3 mr-1" />Attendance</TabsTrigger>
          <TabsTrigger value="leaves" data-testid="tab-360-leaves"><Calendar className="w-3 h-3 mr-1" />Leaves</TabsTrigger>
          <TabsTrigger value="payslips" data-testid="tab-360-payslips"><FileText className="w-3 h-3 mr-1" />Payslips</TabsTrigger>
          <TabsTrigger value="bonuses" data-testid="tab-360-bonuses"><Gift className="w-3 h-3 mr-1" />Bonuses</TabsTrigger>
          <TabsTrigger value="advances" data-testid="tab-360-advances"><Banknote className="w-3 h-3 mr-1" />Advances</TabsTrigger>
          <TabsTrigger value="expenses" data-testid="tab-360-expenses"><Receipt className="w-3 h-3 mr-1" />Expenses</TabsTrigger>
          <TabsTrigger value="tax" data-testid="tab-360-tax"><TrendingUp className="w-3 h-3 mr-1" />Tax Profile</TabsTrigger>
          <TabsTrigger value="personal" data-testid="tab-360-personal"><User className="w-3 h-3 mr-1" />Personal</TabsTrigger>
        </TabsList>

        <TabsContent value="salary">
          {sal ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">Earnings</CardTitle></CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span>Basic Salary</span><span className="font-mono">{emp.salary_currency} {sal.basic_salary.toLocaleString()}</span></div>
                    {Object.entries(sal.allowances).map(([name, val]) => (
                      <div key={name} className="flex justify-between"><span className="capitalize">{name}</span><span className="font-mono">{emp.salary_currency} {val.toLocaleString()}</span></div>
                    ))}
                    <div className="flex justify-between font-bold border-t pt-2"><span>Gross Salary</span><span className="font-mono">{emp.salary_currency} {gross.toLocaleString()}</span></div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">Deductions & Statutory</CardTitle></CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="space-y-2 text-sm">
                    {Object.entries(sal.deductions).map(([name, val]) => (
                      <div key={name} className="flex justify-between"><span className="capitalize">{name}</span><span className="font-mono text-red-600">- {emp.salary_currency} {val.toLocaleString()}</span></div>
                    ))}
                    {sal.cit_type !== 'none' && (
                      <div className="flex justify-between">
                        <span>CIT ({sal.cit_type === 'percentage' ? `${sal.cit_value}%` : 'Flat'})</span>
                        <span className="font-mono text-red-600">- {emp.salary_currency} {(sal.cit_type === 'percentage' ? gross * sal.cit_value / 100 : sal.cit_value).toLocaleString()}</span>
                      </div>
                    )}
                    {sal.ssf_applicable && (
                      <>
                        <div className="flex justify-between"><span>SSF Employee ({sal.ssf_employee_percentage}%)</span><span className="font-mono text-red-600">- {emp.salary_currency} {(gross * sal.ssf_employee_percentage / 100).toLocaleString()}</span></div>
                        <div className="flex justify-between text-blue-600"><span>SSF Employer ({sal.ssf_employer_percentage}%)</span><span className="font-mono">{emp.salary_currency} {(gross * sal.ssf_employer_percentage / 100).toLocaleString()}</span></div>
                      </>
                    )}
                    <div className="flex justify-between"><span>Income Tax</span><Badge variant={sal.tax_applicable ? 'default' : 'secondary'} className="text-xs">{sal.tax_applicable ? 'Applicable' : 'N/A'}</Badge></div>
                    {sal.effective_from && <p className="text-xs text-muted-foreground pt-2">Effective from: {sal.effective_from}</p>}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No salary structure configured. Set up salary from the Staff & Salary tab.</CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="attendance">
          <Card>
            <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">Attendance Summary — {MONTHS[att.month - 1]} {att.year}</CardTitle></CardHeader>
            <CardContent className="p-4 pt-2">
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{att.present}</p><p className="text-xs text-muted-foreground">Present</p>
                </div>
                <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{att.absent}</p><p className="text-xs text-muted-foreground">Absent</p>
                </div>
                <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-orange-600">{att.late}</p><p className="text-xs text-muted-foreground">Late</p>
                </div>
                <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-yellow-600">{att.half_day}</p><p className="text-xs text-muted-foreground">Half Day</p>
                </div>
                <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{att.on_leave}</p><p className="text-xs text-muted-foreground">On Leave</p>
                </div>
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-2xl font-bold">{att.total_records}</p><p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leaves">
          {data.leave_balances.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.leave_balances.map((lb) => (
                <Card key={lb.leave_type_code}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: lb.color }} />
                        <span className="font-medium text-sm">{lb.leave_type}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">{lb.leave_type_code}</Badge>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                      <div><p className="font-bold text-lg">{lb.allocated}</p><p className="text-muted-foreground">Allocated</p></div>
                      <div><p className="font-bold text-lg text-red-500">{lb.used}</p><p className="text-muted-foreground">Used</p></div>
                      <div><p className="font-bold text-lg text-blue-500">{lb.carried_forward}</p><p className="text-muted-foreground">Carried</p></div>
                      <div><p className="font-bold text-lg text-green-600">{lb.remaining}</p><p className="text-muted-foreground">Balance</p></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No leave balances allocated yet. Allocate leave from Leave Types tab.</CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="payslips">
          {data.recent_payslips.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">CIT</TableHead>
                  <TableHead className="text-right">SSF</TableHead>
                  <TableHead className="text-right">Tax</TableHead>
                  <TableHead className="text-right">Bonus</TableHead>
                  <TableHead className="text-right">Advance Ded.</TableHead>
                  <TableHead className="text-right">Net Pay</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">PDF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recent_payslips.map((ps) => (
                  <TableRow key={ps.id} data-testid={`row-payslip-${ps.id}`}>
                    <TableCell className="font-medium">{MONTHS[ps.month - 1]} {ps.year}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{ps.gross_salary.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-red-500">-{ps.cit_deduction.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-red-500">-{ps.ssf_employee_deduction.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-red-500">-{ps.tax_deduction.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-green-600">+{ps.bonus_amount.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-red-500">-{ps.advance_deduction.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-bold">{ps.net_salary.toLocaleString()}</TableCell>
                    <TableCell className="text-sm">{ps.present_days}/{ps.working_days}</TableCell>
                    <TableCell><Badge variant={ps.status === 'completed' ? 'default' : 'secondary'} className="text-xs">{ps.status}</Badge></TableCell>
                    <TableCell className="text-center">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => window.open(`/api/hrms/payslips/${ps.id}/pdf`, '_blank')} data-testid={`btn-dl-payslip-${ps.id}`}>
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No payslips generated yet.</CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="bonuses">
          {data.bonuses.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Taxable</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.bonuses.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium text-sm">{BONUS_TYPES[b.bonus_type] || b.bonus_type}</TableCell>
                    <TableCell className="text-sm">{MONTHS[b.month - 1]} {b.year}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{emp.salary_currency} {b.amount.toLocaleString()}</TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{b.reason || "—"}</TableCell>
                    <TableCell>{b.is_taxable ? <Badge variant="outline" className="text-xs">Yes</Badge> : <Badge variant="secondary" className="text-xs">No</Badge>}</TableCell>
                    <TableCell><Badge variant={b.status === 'paid' ? 'default' : b.status === 'approved' ? 'default' : 'secondary'} className="text-xs">{b.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No bonuses recorded.</CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="advances">
          {data.advances.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Monthly Ded.</TableHead>
                  <TableHead className="text-right">Repaid</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.advances.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-sm">{a.request_date}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{emp.salary_currency} {a.amount.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{emp.salary_currency} {a.monthly_deduction.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-green-600">{emp.salary_currency} {a.total_deducted.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-red-600">{emp.salary_currency} {a.remaining_balance.toLocaleString()}</TableCell>
                    <TableCell className="text-sm max-w-[150px] truncate">{a.reason || "—"}</TableCell>
                    <TableCell><Badge variant={a.status === 'completed' ? 'default' : a.status === 'active' ? 'default' : 'secondary'} className="text-xs">{a.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No advance payments.</CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="expenses">
          {data.expenses.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>In Salary</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.expenses.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-sm">{e.expense_date}</TableCell>
                    <TableCell className="text-sm capitalize">{e.category.replace('_', ' ')}</TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{e.description}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{emp.salary_currency} {e.amount.toLocaleString()}</TableCell>
                    <TableCell>{e.include_in_salary ? <Badge variant="outline" className="text-xs">Yes</Badge> : <Badge variant="secondary" className="text-xs">No</Badge>}</TableCell>
                    <TableCell><Badge variant={e.status === 'reimbursed' ? 'default' : e.status === 'approved' ? 'default' : 'secondary'} className="text-xs">{e.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No travel expenses recorded.</CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="tax">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">Tax Profile</CardTitle></CardHeader>
              <CardContent className="p-4 pt-0 space-y-2 text-sm">
                <div className="flex justify-between"><span>{getTaxIdLabel(emp.country)}</span><span className="font-mono">{emp.pan_no || "Not Set"}</span></div>
                <div className="flex justify-between"><span>Marital Status</span><span className="capitalize">{emp.marital_status || "Not Set"}</span></div>
                <div className="flex justify-between"><span>Tax Category</span><span>{emp.marital_status === 'married' ? 'Married Slab' : 'Single Slab'}</span></div>
                {sal && (
                  <>
                    <div className="flex justify-between"><span>CIT</span><span>{sal.cit_type === 'none' ? 'N/A' : sal.cit_type === 'percentage' ? `${sal.cit_value}%` : `${sal.cit_value}`}</span></div>
                    <div className="flex justify-between"><span>SSF</span><span>{sal.ssf_applicable ? `${sal.ssf_employee_percentage}% (Emp) + ${sal.ssf_employer_percentage}% (Er)` : 'N/A'}</span></div>
                    <div className="flex justify-between"><span>Income Tax</span><span>{sal.tax_applicable ? 'Applicable' : 'N/A'}</span></div>
                  </>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">Year-to-Date Tax Summary ({data.tax_summary.year})</CardTitle></CardHeader>
              <CardContent className="p-4 pt-0 space-y-2 text-sm">
                <div className="flex justify-between"><span>Income Tax Paid</span><span className="font-mono font-bold">{emp.salary_currency} {data.tax_summary.total_tax.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>CIT Paid</span><span className="font-mono">{emp.salary_currency} {data.tax_summary.total_cit.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>SSF Employee</span><span className="font-mono">{emp.salary_currency} {data.tax_summary.total_ssf.toLocaleString()}</span></div>
                <div className="flex justify-between border-t pt-2 font-bold">
                  <span>Total Deducted</span>
                  <span className="font-mono">{emp.salary_currency} {(data.tax_summary.total_tax + data.tax_summary.total_cit + data.tax_summary.total_ssf).toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="personal">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">Personal Information</CardTitle></CardHeader>
              <CardContent className="p-4 pt-0 space-y-2 text-sm">
                <div className="flex justify-between"><span>Date of Birth</span><span>{emp.date_of_birth || "—"}</span></div>
                <div className="flex justify-between"><span>Gender</span><span className="capitalize">{emp.gender || "—"}</span></div>
                <div className="flex justify-between"><span>Country</span><span>{emp.country || "—"}</span></div>
                <div className="flex justify-between"><span>Marital Status</span><span className="capitalize">{emp.marital_status || "—"}</span></div>
                <div className="flex justify-between"><span>Employee ID</span><span className="font-mono">{emp.employee_id_number || "—"}</span></div>
                <div className="flex justify-between"><span>Citizenship No</span><span className="font-mono">{emp.citizenship_no || "—"}</span></div>
                <div className="flex justify-between"><span>{getTaxIdLabel(emp.country)}</span><span className="font-mono">{emp.pan_no || "—"}</span></div>
                <div className="flex justify-between"><span>Passport</span><span className="font-mono">{emp.passport_number || "—"}</span></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">Bank Details</CardTitle></CardHeader>
              <CardContent className="p-4 pt-0 space-y-2 text-sm">
                <div className="flex justify-between"><span>Bank</span><span>{emp.bank_name || "—"}</span></div>
                <div className="flex justify-between"><span>Account Number</span><span className="font-mono">{emp.bank_account_number || "—"}</span></div>
                <div className="flex justify-between"><span>Branch</span><span>{emp.bank_branch || "—"}</span></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">Address</CardTitle></CardHeader>
              <CardContent className="p-4 pt-0 space-y-2 text-sm">
                <div><p className="text-muted-foreground">Permanent Address</p><p>{emp.permanent_address || "—"}</p></div>
                <div><p className="text-muted-foreground">Temporary Address</p><p>{emp.temporary_address || "—"}</p></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">Employment & Emergency</CardTitle></CardHeader>
              <CardContent className="p-4 pt-0 space-y-2 text-sm">
                <div className="flex justify-between"><span>Employment Type</span><span className="capitalize">{emp.employment_type?.replace('_', ' ')}</span></div>
                <div className="flex justify-between"><span>Join Date</span><span>{emp.join_date || "—"}</span></div>
                <div className="flex justify-between"><span>Probation End</span><span>{emp.probation_end_date || "—"}</span></div>
                <div className="flex justify-between"><span>Contract End</span><span>{emp.contract_end_date || "—"}</span></div>
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between"><span>Emergency Contact</span><span>{emp.emergency_contact_name || "—"}</span></div>
                  <div className="flex justify-between"><span>Emergency Phone</span><span>{emp.emergency_contact_phone || "—"}</span></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
