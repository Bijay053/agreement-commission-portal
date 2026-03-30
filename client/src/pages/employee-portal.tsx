import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  User, Clock, Calendar, FileText, LogOut, Shield, ChevronLeft, ChevronRight,
  CheckCircle, XCircle, AlertCircle, Download, Briefcase,
  Camera, MapPin, Loader2, RefreshCw, Paperclip, Upload, File,
  DollarSign, Eye, EyeOff, Building2, Receipt, Lock, Send, Plus, KeyRound,
} from "lucide-react";

type Tab = "profile" | "attendance" | "leave" | "payslips" | "hr-policies" | "documents" | "change-password";

export default function EmployeePortal() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [showSalary, setShowSalary] = useState(false);

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: "profile", label: "My Profile", icon: User },
    { key: "attendance", label: "Attendance", icon: Clock },
    { key: "leave", label: "Leave", icon: Calendar },
    { key: "payslips", label: "Payslips", icon: FileText },
    { key: "hr-policies", label: "HR Policies", icon: Shield },
    { key: "documents", label: "Documents", icon: Download },
    { key: "change-password", label: "Change Password", icon: KeyRound },
  ];

  return (
    <div className="flex h-screen bg-background">
      <aside className="w-56 shrink-0 border-r bg-muted/30 flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-xs font-bold text-primary-foreground">SIC</span>
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight">HRMS Portal</p>
              <p className="text-[10px] text-muted-foreground">Study Info Centre</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                data-testid={`tab-${tab.key}`}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground font-medium"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t">
          <div className="flex items-center gap-2 mb-3 px-1">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
              {user?.user?.fullName?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "U"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate">{user?.user?.fullName || "Employee"}</p>
              <p className="text-[10px] text-muted-foreground truncate">{user?.user?.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            data-testid="button-logout"
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6">
        {activeTab === "profile" && <ProfileTab showSalary={showSalary} setShowSalary={setShowSalary} />}
        {activeTab === "attendance" && <AttendanceTab />}
        {activeTab === "leave" && <LeaveTab />}
        {activeTab === "payslips" && <PayslipsTab showSalary={showSalary} setShowSalary={setShowSalary} />}
        {activeTab === "hr-policies" && <HRPoliciesTab />}
        {activeTab === "documents" && <DocumentsTab />}
        {activeTab === "change-password" && <ChangePasswordTab />}
      </main>
    </div>
  );
}

function ProfileTab({ showSalary, setShowSalary }: { showSalary: boolean; setShowSalary: (v: boolean) => void }) {
  const { data: profile, isLoading } = useQuery<any>({
    queryKey: ["/api/hrms/my/profile"],
  });
  const { toast } = useToast();
  const [profileSubTab, setProfileSubTab] = useState<string>("personal");
  const [otpStep, setOtpStep] = useState<'idle' | 'sending' | 'input' | 'verifying'>('idle');
  const [otpCode, setOtpCode] = useState('');
  const [otpMaskedEmail, setOtpMaskedEmail] = useState('');
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ category: 'travel', description: '', amount: '', expense_date: new Date().toISOString().split('T')[0], receipt_url: '' });
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [receiptFileName, setReceiptFileName] = useState('');
  const receiptInputRef = useRef<HTMLInputElement>(null);

  const sendOtpMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/hrms/confidential/send-otp');
      return res.json();
    },
    onSuccess: (data: any) => {
      setOtpMaskedEmail(data.maskedEmail || '');
      setOtpStep('input');
      toast({ title: 'OTP sent', description: `Check your email (${data.maskedEmail})` });
    },
    onError: (err: any) => {
      setOtpStep('idle');
      toast({ title: 'Failed to send OTP', description: err.message, variant: 'destructive' });
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await apiRequest('POST', '/api/hrms/confidential/verify-otp', { code });
      return res.json();
    },
    onSuccess: () => {
      setShowSalary(true);
      setOtpStep('idle');
      setOtpCode('');
      toast({ title: 'Verified', description: 'Salary details are now visible' });
    },
    onError: (err: any) => {
      setOtpStep('input');
      toast({ title: 'Verification failed', description: err.message, variant: 'destructive' });
    },
  });

  const submitExpenseMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/hrms/my/expenses', data);
      return res.json();
    },
    onSuccess: () => {
      setShowExpenseForm(false);
      setExpenseForm({ category: 'travel', description: '', amount: '', expense_date: new Date().toISOString().split('T')[0], receipt_url: '' });
      setReceiptFileName('');
      toast({ title: 'Expense submitted', description: 'Your expense has been submitted for approval' });
      queryClient.invalidateQueries({ queryKey: ["/api/hrms/my/profile"] });
    },
    onError: (err: any) => {
      toast({ title: 'Failed to submit', description: err.message, variant: 'destructive' });
    },
  });

  const handleRequestOtp = () => {
    setOtpStep('sending');
    sendOtpMutation.mutate();
  };

  const handleVerifyOtp = () => {
    if (otpCode.length !== 6) return;
    setOtpStep('verifying');
    verifyOtpMutation.mutate(otpCode);
  };

  const handleHideSalary = () => {
    setShowSalary(false);
    setOtpCode('');
    setOtpStep('idle');
  };

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-40" /><Skeleton className="h-60" /></div>;
  if (!profile) return <div className="text-center py-12 text-muted-foreground">No employee profile found linked to your account.</div>;

  const currency = profile.salary_currency || profile.organization_currency || 'NPR';
  const ss = profile.salary_structure;
  const fmtAmt = (v: number) => `${currency} ${v?.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) || '0'}`;
  const MONTHS = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const att = profile.attendance_summary || {};
  const taxSum = profile.tax_summary || {};
  const empType = profile.employment_type?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());

  const subTabs: { key: string; label: string; icon: any }[] = [
    { key: "personal", label: "Personal", icon: User },
    { key: "leaves", label: "Leaves", icon: Calendar },
    { key: "payslips", label: "Payslips", icon: FileText },
    ...(profile.can_expense ? [{ key: "expenses", label: "Expenses", icon: Receipt }] : []),
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary shrink-0">
              {profile.full_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xl font-semibold" data-testid="text-employee-name">{profile.full_name}</h3>
                <Badge variant="default" className="text-xs">{profile.status || 'active'}</Badge>
                {empType && <Badge variant="outline" className="text-xs">{empType}</Badge>}
                {profile.marital_status && <Badge variant="outline" className="text-xs">{profile.marital_status}</Badge>}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {profile.position && <span>{profile.position}</span>}
                {profile.department && <span> · {profile.department}</span>}
                {profile.organization && <span> · {profile.organization}</span>}
              </p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1 flex-wrap">
                {profile.email && <span>✉ {profile.email}</span>}
                {profile.phone && <span>☎ {profile.phone}</span>}
                {profile.join_date && <span>📅 Joined: {profile.join_date}</span>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-1 gap-3">
        <Card className="bg-muted/30">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">This Month Attendance</p>
            <p className="text-lg font-bold mt-1" data-testid="text-summary-attendance">{att.present || 0} / {att.total_records || 0} days</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-1 border-b overflow-x-auto pb-px">
        {subTabs.map(t => (
          <button
            key={t.key}
            onClick={() => setProfileSubTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              profileSubTab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            data-testid={`tab-profile-${t.key}`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {profileSubTab === "leaves" && (
        <Card>
          <CardContent className="p-5">
            <h4 className="font-semibold mb-3">Leave Balances</h4>
            {(profile.leave_balances || []).length > 0 ? (
              <div className="grid sm:grid-cols-2 gap-3">
                {profile.leave_balances.map((lb: any) => (
                  <div key={lb.leave_type_code} className="border rounded-lg p-3" data-testid={`leave-balance-${lb.leave_type_code}`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">{lb.leave_type}</span>
                      {lb.hide_balance ? (
                        <Badge variant="outline" className="text-xs">Available</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">{lb.remaining} remaining</Badge>
                      )}
                    </div>
                    {!lb.hide_balance && (
                      <>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div className="bg-primary rounded-full h-2" style={{ width: `${Math.min(100, lb.allocated > 0 ? (lb.used / lb.allocated) * 100 : 0)}%` }} />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                          <span>Used: {lb.used}</span>
                          <span>Allocated: {lb.allocated}</span>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No leave balances allocated yet</p>
            )}
          </CardContent>
        </Card>
      )}

      {profileSubTab === "payslips" && (
        <Card>
          <CardContent className="p-5">
            <h4 className="font-semibold mb-3">Recent Payslips</h4>
            {(profile.recent_payslips || []).length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Deductions</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">PDF</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profile.recent_payslips.map((ps: any) => (
                    <TableRow key={ps.id} data-testid={`payslip-row-${ps.id}`}>
                      <TableCell className="text-sm">{MONTHS[ps.month]} {ps.year}</TableCell>
                      <TableCell className="text-sm text-right">{showSalary ? fmtAmt(ps.gross_salary) : '****'}</TableCell>
                      <TableCell className="text-sm text-right text-red-600">{showSalary ? `- ${fmtAmt(ps.total_deductions)}` : '****'}</TableCell>
                      <TableCell className="text-sm text-right font-semibold">{showSalary ? fmtAmt(ps.net_salary) : '****'}</TableCell>
                      <TableCell><Badge variant={ps.status === 'paid' ? 'default' : 'outline'} className="text-xs">{ps.status}</Badge></TableCell>
                      <TableCell className="text-right">
                        {ps.view_token && (
                          <a href={`/api/hrms/payslips/public/${ps.view_token}/pdf`} target="_blank" rel="noreferrer">
                            <Button variant="ghost" size="sm"><Download className="h-3.5 w-3.5" /></Button>
                          </a>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">No payslips generated yet</p>
            )}
          </CardContent>
        </Card>
      )}

      {profileSubTab === "expenses" && profile.can_expense && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold">Expenses</h4>
              {profile.can_submit_expense && (
                <Button size="sm" variant="outline" onClick={() => setShowExpenseForm(true)} data-testid="button-add-expense">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Submit Expense
                </Button>
              )}
            </div>
            {(profile.expenses || []).length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Receipt</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profile.expenses.map((e: any) => (
                    <TableRow key={e.id} data-testid={`expense-row-${e.id}`}>
                      <TableCell className="text-sm">{e.expense_date || '—'}</TableCell>
                      <TableCell className="text-sm capitalize">{e.category?.replace(/_/g, ' ')}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{e.description || '—'}</TableCell>
                      <TableCell className="text-sm text-right font-medium">{fmtAmt(e.amount)}</TableCell>
                      <TableCell>
                        {e.receipt_url ? (
                          <a href={e.receipt_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs flex items-center gap-1" data-testid={`link-receipt-${e.id}`}>
                            <Paperclip className="h-3 w-3" /> View
                          </a>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={e.status === 'approved' ? 'default' : e.status === 'rejected' ? 'destructive' : 'outline'} className="text-xs">
                          {e.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">No expenses recorded</p>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={showExpenseForm} onOpenChange={setShowExpenseForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Submit Expense</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Category</Label>
              <Select value={expenseForm.category} onValueChange={v => setExpenseForm(f => ({ ...f, category: v }))}>
                <SelectTrigger data-testid="select-expense-category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="travel">Travel</SelectItem>
                  <SelectItem value="accommodation">Accommodation</SelectItem>
                  <SelectItem value="food">Food & Meals</SelectItem>
                  <SelectItem value="transport">Local Transport</SelectItem>
                  <SelectItem value="client_meeting">Client Meeting</SelectItem>
                  <SelectItem value="training">Training</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={expenseForm.description}
                onChange={e => setExpenseForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Describe the expense..."
                rows={3}
                data-testid="input-expense-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Amount ({currency})</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={expenseForm.amount}
                  onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  data-testid="input-expense-amount"
                />
              </div>
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={expenseForm.expense_date}
                  onChange={e => setExpenseForm(f => ({ ...f, expense_date: e.target.value }))}
                  data-testid="input-expense-date"
                />
              </div>
            </div>
            <div>
              <Label>Bill / Receipt</Label>
              <input
                ref={receiptInputRef}
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                data-testid="input-expense-receipt"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploadingReceipt(true);
                  try {
                    const fd = new FormData();
                    fd.append('file', file);
                    const res = await fetch('/api/hrms/expense-receipt-upload', { method: 'POST', body: fd, credentials: 'include' });
                    if (!res.ok) throw new Error('Upload failed');
                    const data = await res.json();
                    setExpenseForm(f => ({ ...f, receipt_url: data.url }));
                    setReceiptFileName(file.name);
                    toast({ title: 'Receipt uploaded' });
                  } catch {
                    toast({ title: 'Upload failed', variant: 'destructive' });
                  } finally {
                    setUploadingReceipt(false);
                  }
                }}
              />
              {expenseForm.receipt_url ? (
                <div className="flex items-center gap-2 mt-1.5 p-2 bg-green-50 border border-green-200 rounded-md">
                  <File className="h-4 w-4 text-green-600 shrink-0" />
                  <span className="text-sm text-green-700 truncate flex-1">{receiptFileName || 'Receipt uploaded'}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-red-500 hover:text-red-700"
                    onClick={() => { setExpenseForm(f => ({ ...f, receipt_url: '' })); setReceiptFileName(''); }}
                    data-testid="button-remove-receipt"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full mt-1.5"
                  onClick={() => receiptInputRef.current?.click()}
                  disabled={uploadingReceipt}
                  data-testid="button-upload-receipt"
                >
                  {uploadingReceipt ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Upload className="h-4 w-4 mr-1.5" />}
                  {uploadingReceipt ? 'Uploading...' : 'Upload Bill / Receipt'}
                </Button>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExpenseForm(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!expenseForm.description.trim()) return;
                if (!expenseForm.amount || Number(expenseForm.amount) <= 0) return;
                submitExpenseMutation.mutate({
                  category: expenseForm.category,
                  description: expenseForm.description,
                  amount: Number(expenseForm.amount),
                  expense_date: expenseForm.expense_date,
                  receipt_url: expenseForm.receipt_url || undefined,
                });
              }}
              disabled={submitExpenseMutation.isPending || uploadingReceipt || !expenseForm.description.trim() || !expenseForm.amount}
              data-testid="button-submit-expense"
            >
              {submitExpenseMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {profileSubTab === "personal" && (
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-5">
              <h4 className="font-semibold mb-3">Personal Information</h4>
              <div className="space-y-2">
                {[
                  { label: "Date of Birth", value: profile.date_of_birth },
                  { label: "Gender", value: profile.gender },
                  { label: "Country", value: profile.country },
                  { label: "Marital Status", value: profile.marital_status },
                  { label: "Employee ID", value: profile.employee_id_number },
                  { label: "Citizenship No", value: profile.citizenship_no },
                  { label: "PAN", value: profile.pan_no },
                  { label: "Passport", value: profile.passport_number },
                ].map(row => (
                  <div key={row.label} className="flex justify-between py-1.5 border-b last:border-0">
                    <span className="text-sm text-muted-foreground">{row.label}</span>
                    <span className="text-sm font-medium">{row.value || '—'}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <h4 className="font-semibold mb-3">Bank Details</h4>
              <div className="space-y-2">
                {[
                  { label: "Bank", value: profile.bank_name },
                  { label: "Account Number", value: showSalary ? profile.bank_account_number : profile.bank_account_number ? '••••' + profile.bank_account_number.slice(-4) : null },
                  { label: "Branch", value: profile.bank_branch },
                ].map(row => (
                  <div key={row.label} className="flex justify-between py-1.5 border-b last:border-0">
                    <span className="text-sm text-muted-foreground">{row.label}</span>
                    <span className="text-sm font-medium">{row.value || '—'}</span>
                  </div>
                ))}
              </div>
              <h4 className="font-semibold mb-3 mt-6">Address</h4>
              <div className="space-y-2">
                <div className="py-1.5 border-b">
                  <p className="text-xs text-muted-foreground">Permanent Address</p>
                  <p className="text-sm">{profile.permanent_address || '—'}</p>
                </div>
                <div className="py-1.5">
                  <p className="text-xs text-muted-foreground">Temporary Address</p>
                  <p className="text-sm">{profile.temporary_address || '—'}</p>
                </div>
              </div>
              <h4 className="font-semibold mb-3 mt-6">Employment & Emergency</h4>
              <div className="space-y-2">
                {[
                  { label: "Employment Type", value: empType },
                  { label: "Join Date", value: profile.join_date },
                  { label: "Probation End", value: profile.probation_end_date },
                  { label: "Contract End", value: profile.contract_end_date },
                  { label: "Emergency Contact", value: profile.emergency_contact_name },
                  { label: "Emergency Phone", value: profile.emergency_contact_phone },
                ].map(row => (
                  <div key={row.label} className="flex justify-between py-1.5 border-b last:border-0">
                    <span className="text-sm text-muted-foreground">{row.label}</span>
                    <span className="text-sm font-medium">{row.value || '—'}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function AttendanceTab() {
  const { toast } = useToast();
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [showCheckin, setShowCheckin] = useState(false);

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/hrms/my/attendance", { month, year }],
    queryFn: async () => {
      const res = await fetch(`/api/hrms/my/attendance?month=${month}&year=${year}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const records = data?.records || [];
  const summary = data?.summary || {};
  const today = data?.today;
  const onlineAllowed = data?.online_checkin_allowed;
  const requirePhoto = data?.require_photo ?? true;
  const requireLocation = data?.require_location ?? true;

  const hasCheckedIn = today?.check_in;
  const hasCheckedOut = today?.check_out;

  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold" data-testid="text-attendance-title">My Attendance</h2>
          <p className="text-sm text-muted-foreground">Your attendance records</p>
        </div>
        <div className="flex items-center gap-2">
          {onlineAllowed && (
            <Button
              onClick={() => setShowCheckin(true)}
              size="sm"
              data-testid="button-remote-checkin"
              variant={hasCheckedIn && !hasCheckedOut ? "destructive" : "default"}
            >
              <Clock className="h-4 w-4 mr-1" />
              {!hasCheckedIn ? "Check In" : !hasCheckedOut ? "Check Out" : "Done Today"}
            </Button>
          )}
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {onlineAllowed && (
        <TodayStatusCard today={today} />
      )}

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-green-600" data-testid="text-present-count">{summary.present || 0}</p><p className="text-xs text-muted-foreground">Present</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-red-600" data-testid="text-absent-count">{summary.absent || 0}</p><p className="text-xs text-muted-foreground">Absent</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-amber-600" data-testid="text-late-count">{summary.late || 0}</p><p className="text-xs text-muted-foreground">Late</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-blue-600" data-testid="text-leave-count">{summary.on_leave || 0}</p><p className="text-xs text-muted-foreground">On Leave</p></CardContent></Card>
        </div>
      )}

      {isLoading ? <Skeleton className="h-60" /> : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Day</TableHead>
                <TableHead>Check In</TableHead>
                <TableHead>Check Out</TableHead>
                <TableHead>Working Hours</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Late</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No attendance records for this period</TableCell></TableRow>
              ) : records.map((r: any) => {
                const dayName = r.date ? new Date(r.date + "T00:00:00").toLocaleDateString("en", { weekday: "short" }) : "—";
                const isSunday = r.date ? new Date(r.date + "T00:00:00").getDay() === 0 : false;
                const calcWorkHours = (ci: string | null, co: string | null) => {
                  if (!ci || !co) return "—";
                  try {
                    const diff = (new Date(co).getTime() - new Date(ci).getTime()) / 3600000;
                    if (diff <= 0 || diff > 24) return "—";
                    const h = Math.floor(diff);
                    const m = Math.round((diff - h) * 60);
                    return `${h}h ${m}m`;
                  } catch { return "—"; }
                };
                return (
                  <TableRow key={r.date} data-testid={`row-attendance-${r.date}`}>
                    <TableCell className="font-medium">{r.date}</TableCell>
                    <TableCell className={isSunday ? "text-red-500 font-medium" : ""}>{dayName}</TableCell>
                    <TableCell>{r.check_in ? new Date(r.check_in).toLocaleTimeString() : "—"}</TableCell>
                    <TableCell>{r.check_out ? new Date(r.check_out).toLocaleTimeString() : "—"}</TableCell>
                    <TableCell className="font-mono text-sm">{calcWorkHours(r.check_in, r.check_out)}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "present" ? "default" : r.status === "absent" ? "destructive" : "outline"}>
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{r.is_late ? <Badge variant="destructive" className="text-xs">{r.late_minutes}m</Badge> : "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {showCheckin && (
        <RemoteCheckInDialog
          open={showCheckin}
          onClose={() => setShowCheckin(false)}
          isCheckOut={!!hasCheckedIn && !hasCheckedOut}
          alreadyDone={!!hasCheckedIn && !!hasCheckedOut}
          requirePhoto={requirePhoto}
          requireLocation={requireLocation}
          onSuccess={() => {
            refetch();
            queryClient.refetchQueries({ queryKey: ["/api/hrms/my/attendance"] });
          }}
        />
      )}
    </div>
  );
}

function TodayStatusCard({ today }: { today: any }) {
  const nowStr = new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Today — {nowStr}</p>
            {today ? (
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-sm">In: {today.check_in ? new Date(today.check_in).toLocaleTimeString() : "—"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${today.check_out ? "bg-red-500" : "bg-muted-foreground/30"}`} />
                  <span className="text-sm">Out: {today.check_out ? new Date(today.check_out).toLocaleTimeString() : "—"}</span>
                </div>
                {today.is_late && (
                  <Badge variant="destructive" className="text-xs">Late by {today.late_minutes}m</Badge>
                )}
                {today.work_hours > 0 && (
                  <span className="text-sm text-muted-foreground">{today.work_hours}h worked</span>
                )}
              </div>
            ) : (
              <p className="text-sm mt-1 text-muted-foreground">Not checked in yet</p>
            )}
          </div>
          <Badge variant={today?.check_in ? "default" : "outline"} className="text-xs">
            {!today ? "Absent" : today.check_out ? "Completed" : "Checked In"}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function RemoteCheckInDialog({
  open, onClose, isCheckOut, alreadyDone, requirePhoto, requireLocation, onSuccess,
}: {
  open: boolean; onClose: () => void; isCheckOut: boolean; alreadyDone: boolean;
  requirePhoto: boolean; requireLocation: boolean; onSuccess: () => void;
}) {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err: any) {
      setCameraError("Camera access denied. Please allow camera permission.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    setCapturedPhoto(dataUrl);
    canvas.toBlob(blob => {
      if (blob) setPhotoBlob(blob);
    }, "image/jpeg", 0.8);
    stopCamera();
  }, [stopCamera]);

  const retakePhoto = useCallback(() => {
    setCapturedPhoto(null);
    setPhotoBlob(null);
    startCamera();
  }, [startCamera]);

  const getLocation = useCallback(() => {
    setLocationLoading(true);
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError("Geolocation not supported");
      setLocationLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationLoading(false);
      },
      err => {
        setLocationError(err.code === 1 ? "Location access denied. Please allow location permission." : "Could not get location. Please try again.");
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }, []);

  useEffect(() => {
    if (open && !alreadyDone) {
      if (requirePhoto) startCamera();
      if (requireLocation) getLocation();
    }
    return () => stopCamera();
  }, [open]);

  const handleSubmit = async () => {
    if (requirePhoto && !photoBlob) {
      toast({ title: "Please take a selfie first", variant: "destructive" });
      return;
    }
    if (requireLocation && !location) {
      toast({ title: "Please allow location access", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      let photoUrl: string | undefined;
      if (photoBlob) {
        const formData = new FormData();
        formData.append("photo", photoBlob, "selfie.jpg");
        const uploadRes = await fetch("/api/hrms/attendance/photo-upload", {
          method: "POST", body: formData, credentials: "include",
        });
        if (!uploadRes.ok) throw new Error("Photo upload failed");
        const uploadData = await uploadRes.json();
        photoUrl = uploadData.url;
      }

      const endpoint = isCheckOut ? "/api/hrms/attendance/online-checkout" : "/api/hrms/attendance/online-checkin";
      const body: any = {};
      if (location) body.location = { lat: location.lat, lng: location.lng };
      if (photoUrl) body.photo_url = photoUrl;
      try { body.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch {};

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed");
      }

      toast({ title: isCheckOut ? "Checked out successfully" : "Checked in successfully" });
      onSuccess();
      onClose();
    } catch (err: any) {
      toast({ title: err.message || "Something went wrong", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (alreadyDone) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Already Done</DialogTitle></DialogHeader>
          <div className="text-center py-6">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">You have already checked in and out today.</p>
          </div>
          <DialogFooter><Button onClick={onClose}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={() => { stopCamera(); onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isCheckOut ? <><Clock className="h-5 w-5 text-red-500" /> Remote Check Out</> : <><Clock className="h-5 w-5 text-green-500" /> Remote Check In</>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {requirePhoto && (
            <div>
              <Label className="text-sm font-medium flex items-center gap-1.5 mb-2">
                <Camera className="h-4 w-4" /> Live Selfie
              </Label>
              {cameraError ? (
                <div className="bg-destructive/10 rounded-lg p-4 text-center">
                  <p className="text-sm text-destructive">{cameraError}</p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={startCamera}>
                    <RefreshCw className="h-3 w-3 mr-1" /> Retry
                  </Button>
                </div>
              ) : capturedPhoto ? (
                <div className="relative">
                  <img src={capturedPhoto} alt="Selfie" className="w-full rounded-lg border" data-testid="img-selfie-preview" />
                  <Button
                    variant="secondary" size="sm"
                    className="absolute bottom-2 right-2"
                    onClick={retakePhoto}
                    data-testid="button-retake-photo"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" /> Retake
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <video
                    ref={videoRef}
                    className="w-full rounded-lg border bg-black"
                    autoPlay playsInline muted
                    style={{ transform: "scaleX(-1)" }}
                    data-testid="video-camera"
                  />
                  {cameraActive && (
                    <Button
                      className="absolute bottom-3 left-1/2 -translate-x-1/2"
                      onClick={capturePhoto}
                      data-testid="button-capture-photo"
                    >
                      <Camera className="h-4 w-4 mr-1" /> Capture
                    </Button>
                  )}
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>
          )}

          <div>
            <Label className="text-sm font-medium flex items-center gap-1.5 mb-2">
              <MapPin className="h-4 w-4" /> Your Location
            </Label>
            {locationLoading ? (
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Getting your location...</span>
              </div>
            ) : locationError ? (
              <div className="bg-destructive/10 rounded-lg p-3">
                <p className="text-sm text-destructive">{locationError}</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={getLocation}>
                  <RefreshCw className="h-3 w-3 mr-1" /> Retry
                </Button>
              </div>
            ) : location ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Location captured</span>
                  <span className="text-xs text-muted-foreground ml-auto">{location.lat.toFixed(6)}, {location.lng.toFixed(6)}</span>
                </div>
                <div className="rounded-lg overflow-hidden border h-48 relative" data-testid="map-location">
                  <a href={`https://www.openstreetmap.org/?mlat=${location.lat}&mlon=${location.lng}#map=16/${location.lat}/${location.lng}`} target="_blank" rel="noreferrer" className="block w-full h-full">
                    <img
                      src={`https://staticmap.openstreetmap.de/staticmap.php?center=${location.lat},${location.lng}&zoom=16&size=600x200&markers=${location.lat},${location.lng},ol-marker`}
                      alt="Location map"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        target.parentElement!.innerHTML = `<div class="flex items-center justify-center h-full bg-muted text-sm text-muted-foreground">📍 ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)} — <a href="https://www.openstreetmap.org/?mlat=${location.lat}&mlon=${location.lng}#map=16/${location.lat}/${location.lng}" target="_blank" rel="noreferrer" class="text-primary underline ml-1">View on Map</a></div>`;
                      }}
                    />
                  </a>
                </div>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={getLocation}>
                <MapPin className="h-3 w-3 mr-1" /> Get Location
              </Button>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { stopCamera(); onClose(); }}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || (requirePhoto && !capturedPhoto) || (requireLocation && !location)}
            variant={isCheckOut ? "destructive" : "default"}
            data-testid={isCheckOut ? "button-submit-checkout" : "button-submit-checkin"}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : isCheckOut ? <LogOut className="h-4 w-4 mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
            {submitting ? "Submitting..." : isCheckOut ? "Confirm Check Out" : "Confirm Check In"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LeaveTab() {
  const { toast } = useToast();
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ leave_type_id: "", start_date: "", end_date: "", reason: "", cover_person_id: "", is_half_day: false, half_day_period: "morning" });
  const [documentFile, setDocumentFile] = useState<globalThis.File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelRequestId, setCancelRequestId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  const { data: balance, isLoading: balLoading } = useQuery<any[]>({
    queryKey: ["/api/hrms/my/leave-balance"],
  });

  const { data: requests, isLoading: reqLoading } = useQuery<any[]>({
    queryKey: ["/api/hrms/my/leave-requests"],
  });

  const { data: policy } = useQuery<any>({
    queryKey: ["/api/hrms/my/leave-policy"],
  });

  const leaveDays = (() => {
    if (leaveForm.is_half_day) return 0.5;
    if (!leaveForm.start_date || !leaveForm.end_date) return 0;
    const s = new Date(leaveForm.start_date);
    const e = new Date(leaveForm.end_date);
    if (e < s) return 0;
    return Math.floor((e.getTime() - s.getTime()) / 86400000) + 1;
  })();

  const needsCoverPerson = policy?.require_cover_person && leaveDays >= (policy?.require_cover_after_days || 1);

  const advanceNoticeWarning = (() => {
    if (!leaveForm.start_date) return null;
    const startDate = new Date(leaveForm.start_date + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysAhead = Math.floor((startDate.getTime() - today.getTime()) / 86400000);

    const selectedBalance = balance?.find((b: any) => b.leave_type_id === leaveForm.leave_type_id);
    if (selectedBalance?.min_advance_days && selectedBalance.min_advance_days > 0 && daysAhead < selectedBalance.min_advance_days) {
      return `${selectedBalance.leave_type_name || 'This leave type'} requires at least ${selectedBalance.min_advance_days} days advance notice`;
    }

    if (!policy) return null;
    const rules: any[] = policy.advance_notice_rules || [];
    if (rules.length > 0 && leaveDays > 0) {
      const sorted = [...rules].sort((a, b) => b.min_leave_days - a.min_leave_days);
      for (const rule of sorted) {
        if (leaveDays >= rule.min_leave_days) {
          if (daysAhead < rule.advance_notice_days) {
            return `Leave of ${rule.min_leave_days}+ days requires ${rule.advance_notice_days} days advance notice`;
          }
          break;
        }
      }
    } else if (policy.min_days_advance_notice > 0 && daysAhead < policy.min_days_advance_notice) {
      return `Leave must be requested at least ${policy.min_days_advance_notice} days in advance`;
    }
    return null;
  })();

  const needsDocument = policy?.require_document_after_days && leaveDays >= policy.require_document_after_days;

  const submitLeave = async () => {
    setUploading(true);
    try {
      let documentUrl: string | undefined;
      if (documentFile) {
        const formData = new FormData();
        formData.append("document", documentFile);
        const uploadRes = await fetch("/api/hrms/leave-requests/upload-document", {
          method: "POST", body: formData, credentials: "include",
        });
        if (!uploadRes.ok) throw new Error("Document upload failed");
        const uploadData = await uploadRes.json();
        documentUrl = uploadData.url;
      }
      const body: any = { ...leaveForm };
      if (documentUrl) body.document_url = documentUrl;
      const res = await fetch("/api/hrms/my/leave-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to submit");
      }
      queryClient.refetchQueries({ queryKey: ["/api/hrms/my/leave-requests"] });
      queryClient.refetchQueries({ queryKey: ["/api/hrms/my/leave-balance"] });
      setShowRequestForm(false);
      setLeaveForm({ leave_type_id: "", start_date: "", end_date: "", reason: "", cover_person_id: "", is_half_day: false, half_day_period: "morning" });
      setDocumentFile(null);
      toast({ title: "Leave request submitted" });
    } catch (err: any) {
      toast({ title: "Failed to submit", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const statusIcon = (s: string) => {
    if (s === "approved") return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (s === "rejected") return <XCircle className="h-4 w-4 text-red-500" />;
    return <AlertCircle className="h-4 w-4 text-amber-500" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold" data-testid="text-leave-title">Leave Management</h2>
          <p className="text-sm text-muted-foreground">Your leave balance and requests</p>
        </div>
        <Button onClick={() => setShowRequestForm(true)} size="sm" data-testid="button-request-leave">Request Leave</Button>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-3">Leave Balance</h3>
        {balLoading ? <Skeleton className="h-20" /> : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(balance || []).filter((b: any) => b.is_paid !== false).map((b: any) => (
              <Card key={b.leave_type_id || b.leave_type}>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{b.leave_type_name || b.leave_type}</p>
                  {b.hide_balance_from_employee ? (
                    <p className="text-sm text-muted-foreground mt-1" data-testid={`text-balance-${b.leave_type_name || b.leave_type}`}>Available</p>
                  ) : (
                    <>
                      <p className="text-lg font-bold" data-testid={`text-balance-${b.leave_type_name || b.leave_type}`}>{b.remaining_days ?? b.remaining ?? b.balance ?? 0}</p>
                      <p className="text-[10px] text-muted-foreground">of {b.allocated_days ?? b.allocated ?? b.total ?? 0}</p>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
            {(!balance || balance.filter((b: any) => b.is_paid !== false).length === 0) && <p className="text-sm text-muted-foreground col-span-4">No leave balance configured</p>}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-3">Leave Requests</h3>
        {reqLoading ? <Skeleton className="h-40" /> : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Cover Person</TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(!requests || requests.length === 0) ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No leave requests</TableCell></TableRow>
                ) : requests.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.leave_type_name || r.leave_type}</TableCell>
                    <TableCell>{r.start_date}</TableCell>
                    <TableCell>{r.end_date}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {statusIcon(r.status)}
                        <span className="text-sm capitalize">{r.status}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">{r.reason || "—"}</TableCell>
                    <TableCell>{r.cover_person_name || "—"}</TableCell>
                    <TableCell>
                      {r.document_url ? (
                        <a href={r.document_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline text-xs" data-testid={`link-doc-${r.id}`}>
                          <Paperclip className="h-3 w-3" /> View
                        </a>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      {r.status === 'pending' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700 h-7 text-xs"
                          data-testid={`button-cancel-leave-${r.id}`}
                          onClick={async () => {
                            if (!confirm('Are you sure you want to cancel this pending leave request?')) return;
                            try {
                              const res = await fetch(`/api/hrms/my/leave-requests/${r.id}/cancel`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } });
                              if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || 'Failed'); }
                              queryClient.refetchQueries({ queryKey: ['/api/hrms/my/leave-requests'] });
                              queryClient.refetchQueries({ queryKey: ['/api/hrms/my/leave-balance'] });
                              toast({ title: 'Leave request cancelled' });
                            } catch (err: any) { toast({ title: err.message, variant: 'destructive' }); }
                          }}
                        >
                          Cancel
                        </Button>
                      )}
                      {r.status === 'approved' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-amber-600 hover:text-amber-800 h-7 text-xs"
                          data-testid={`button-request-cancel-${r.id}`}
                          onClick={() => { setCancelRequestId(r.id); setCancelReason(""); setShowCancelDialog(true); }}
                        >
                          Request Cancel
                        </Button>
                      )}
                      {r.status === 'cancel_requested' && (
                        <span className="text-xs text-amber-600">Cancel Pending</span>
                      )}
                      {r.rejection_reason && r.status === 'rejected' && (
                        <span className="text-xs text-red-500" title={r.rejection_reason}>Reason: {r.rejection_reason.length > 30 ? r.rejection_reason.substring(0, 30) + '...' : r.rejection_reason}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      <Dialog open={showRequestForm} onOpenChange={setShowRequestForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request Leave</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Leave Type</Label>
              <Select value={leaveForm.leave_type_id} onValueChange={v => setLeaveForm({ ...leaveForm, leave_type_id: v })}>
                <SelectTrigger data-testid="select-leave-type"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {(balance || []).map((b: any) => (
                    <SelectItem key={b.leave_type_id || b.id} value={b.leave_type_id || b.id}>{b.leave_type_name || b.leave_type}{b.is_paid === false ? ' (Unpaid)' : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Duration</Label>
              <div className="flex gap-2 mt-1">
                <Button
                  type="button"
                  variant={!leaveForm.is_half_day ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setLeaveForm({ ...leaveForm, is_half_day: false })}
                  data-testid="button-full-day"
                >
                  Full Day
                </Button>
                <Button
                  type="button"
                  variant={leaveForm.is_half_day ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setLeaveForm({ ...leaveForm, is_half_day: true, end_date: leaveForm.start_date || "" })}
                  data-testid="button-half-day"
                >
                  Half Day (50%)
                </Button>
              </div>
            </div>
            {leaveForm.is_half_day && (
              <div>
                <Label>Half Day Period</Label>
                <Select value={leaveForm.half_day_period} onValueChange={v => setLeaveForm({ ...leaveForm, half_day_period: v })}>
                  <SelectTrigger data-testid="select-half-day-period"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">First Half (Morning)</SelectItem>
                    <SelectItem value="afternoon">Second Half (Afternoon)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className={leaveForm.is_half_day ? "" : "grid grid-cols-2 gap-3"}>
              <div>
                <Label>{leaveForm.is_half_day ? "Date" : "Start Date"}</Label>
                <input type="date" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={leaveForm.start_date} onChange={e => setLeaveForm({ ...leaveForm, start_date: e.target.value, ...(leaveForm.is_half_day ? { end_date: e.target.value } : {}) })} data-testid="input-leave-start" />
              </div>
              {!leaveForm.is_half_day && (
                <div>
                  <Label>End Date</Label>
                  <input type="date" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={leaveForm.end_date} onChange={e => setLeaveForm({ ...leaveForm, end_date: e.target.value })} data-testid="input-leave-end" />
                </div>
              )}
            </div>
            {advanceNoticeWarning && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                <p className="text-sm text-amber-800 dark:text-amber-200">{advanceNoticeWarning}</p>
              </div>
            )}

            {leaveDays > 0 && (
              <div className="flex items-center gap-2 p-2 rounded-md bg-muted/40">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{leaveDays} day{leaveDays !== 1 ? "s" : ""} requested</span>
                {policy?.max_consecutive_days && leaveDays > policy.max_consecutive_days && (
                  <Badge variant="destructive" className="text-[10px] ml-auto">Exceeds max {policy.max_consecutive_days} days</Badge>
                )}
                {(() => {
                  const sel = balance?.find((b: any) => b.leave_type_id === leaveForm.leave_type_id);
                  if (sel && sel.is_paid !== false) {
                    const rem = sel.remaining_days ?? sel.remaining ?? sel.balance ?? 0;
                    if (rem <= 0) return <Badge variant="destructive" className="text-[10px] ml-auto">Balance: 0 days</Badge>;
                    if (rem < leaveDays) return <Badge variant="destructive" className="text-[10px] ml-auto">Only {rem} day{rem !== 1 ? 's' : ''} available</Badge>;
                  }
                  if (sel && sel.is_paid === false) {
                    return <Badge variant="outline" className="text-[10px] ml-auto">Unpaid Leave</Badge>;
                  }
                  return null;
                })()}
              </div>
            )}

            <div>
              <Label>Reason</Label>
              <Textarea value={leaveForm.reason} onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })} placeholder="Reason for leave..." data-testid="input-leave-reason" />
            </div>

            <div>
              <Label className="flex items-center gap-1.5 mb-1">
                Cover Person During Leave
                {needsCoverPerson && <Badge variant="destructive" className="text-[10px]">Required</Badge>}
              </Label>
              <p className="text-[10px] text-muted-foreground mb-2">
                Select a colleague who will cover your responsibilities
              </p>
              <Select value={leaveForm.cover_person_id} onValueChange={v => setLeaveForm({ ...leaveForm, cover_person_id: v })}>
                <SelectTrigger data-testid="select-cover-person"><SelectValue placeholder="Select cover person" /></SelectTrigger>
                <SelectContent>
                  {(policy?.colleagues || []).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="flex items-center gap-1.5 mb-2">
                <Paperclip className="h-3.5 w-3.5" /> Evidence / Medical Report
                {needsDocument && (
                  <Badge variant="destructive" className="text-[10px]">Required for {policy.require_document_after_days}+ days</Badge>
                )}
              </Label>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) setDocumentFile(f);
                }}
                data-testid="input-leave-document"
              />
              {documentFile ? (
                <div className="flex items-center gap-2 p-2.5 rounded-md border bg-muted/30">
                  <File className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm truncate flex-1">{documentFile.name}</span>
                  <span className="text-xs text-muted-foreground">{(documentFile.size / 1024).toFixed(0)} KB</span>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { setDocumentFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>
                    <XCircle className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="button-upload-document"
                >
                  <Upload className="h-4 w-4 mr-1" /> Upload Document
                </Button>
              )}
              <p className="text-[10px] text-muted-foreground mt-1">Accepted: PDF, JPG, PNG, DOC, DOCX</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowRequestForm(false); setDocumentFile(null); }}>Cancel</Button>
            <Button onClick={submitLeave} disabled={uploading || !!advanceNoticeWarning} data-testid="button-submit-leave">
              {uploading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {uploading ? "Submitting..." : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCancelDialog} onOpenChange={v => { if (!v) { setShowCancelDialog(false); setCancelRequestId(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request Leave Cancellation</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This approved leave requires admin approval to cancel. Please provide a reason.
            </p>
            <div>
              <Label>Reason for Cancellation</Label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm mt-1"
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                placeholder="Why do you need to cancel this leave?"
                data-testid="input-cancel-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCancelDialog(false); setCancelRequestId(null); }}>Close</Button>
            <Button
              variant="destructive"
              disabled={!cancelReason.trim() || cancelSubmitting}
              data-testid="button-submit-cancel-request"
              onClick={async () => {
                if (!cancelRequestId || !cancelReason.trim()) return;
                setCancelSubmitting(true);
                try {
                  const res = await fetch(`/api/hrms/my/leave-requests/${cancelRequestId}/cancel`, {
                    method: 'POST', credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cancellation_reason: cancelReason }),
                  });
                  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || 'Failed'); }
                  queryClient.refetchQueries({ queryKey: ['/api/hrms/my/leave-requests'] });
                  queryClient.refetchQueries({ queryKey: ['/api/hrms/my/leave-balance'] });
                  toast({ title: 'Cancellation request submitted for admin approval' });
                  setShowCancelDialog(false);
                  setCancelRequestId(null);
                } catch (err: any) { toast({ title: err.message, variant: 'destructive' }); }
                setCancelSubmitting(false);
              }}
            >
              {cancelSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PayslipsTab({ showSalary, setShowSalary }: { showSalary: boolean; setShowSalary: (v: boolean) => void }) {
  const { toast } = useToast();
  const { data: payslips, isLoading } = useQuery<any[]>({
    queryKey: ["/api/hrms/my/payslips"],
  });
  const [otpStep, setOtpStep] = useState<'idle' | 'sending' | 'input' | 'verifying'>('idle');
  const [otpCode, setOtpCode] = useState('');
  const [otpMaskedEmail, setOtpMaskedEmail] = useState('');

  const sendOtpMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/hrms/confidential/send-otp');
      return res.json();
    },
    onSuccess: (data: any) => {
      setOtpMaskedEmail(data.maskedEmail || '');
      setOtpStep('input');
      toast({ title: 'OTP sent', description: `Check your email (${data.maskedEmail})` });
    },
    onError: (err: any) => {
      setOtpStep('idle');
      toast({ title: 'Failed to send OTP', description: err.message, variant: 'destructive' });
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await apiRequest('POST', '/api/hrms/confidential/verify-otp', { code });
      return res.json();
    },
    onSuccess: () => {
      setShowSalary(true);
      setOtpStep('idle');
      setOtpCode('');
      toast({ title: 'Verified', description: 'Salary details are now visible' });
    },
    onError: (err: any) => {
      setOtpStep('input');
      toast({ title: 'Verification failed', description: err.message, variant: 'destructive' });
    },
  });

  const handleDownload = async (id: string) => {
    const res = await fetch(`/api/hrms/my/payslips/${id}/pdf`, { credentials: "include" });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payslip-${id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fmtAmt = (v: number) => Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold" data-testid="text-payslips-title">My Payslips</h2>
          <p className="text-sm text-muted-foreground">View and download your payslips</p>
        </div>
        {!showSalary && (
          <div className="flex items-center gap-2">
            {otpStep === 'idle' && (
              <Button variant="outline" size="sm" onClick={() => { setOtpStep('sending'); sendOtpMutation.mutate(); }} data-testid="button-payslip-otp">
                <Lock className="h-3.5 w-3.5 mr-1.5" />
                Verify OTP to view amounts
              </Button>
            )}
            {otpStep === 'sending' && <p className="text-xs text-muted-foreground">Sending OTP...</p>}
            {otpStep === 'input' && (
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">OTP sent to {otpMaskedEmail}</p>
                <Input className="w-28 h-8 text-center text-sm" placeholder="Enter OTP" maxLength={6} value={otpCode} onChange={e => setOtpCode(e.target.value)} data-testid="input-payslip-otp" />
                <Button size="sm" className="h-8" onClick={() => { setOtpStep('verifying'); verifyOtpMutation.mutate(otpCode); }} disabled={otpCode.length < 4} data-testid="button-verify-payslip-otp">Verify</Button>
              </div>
            )}
            {otpStep === 'verifying' && <p className="text-xs text-muted-foreground">Verifying...</p>}
          </div>
        )}
      </div>

      {isLoading ? <Skeleton className="h-60" /> : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Gross Salary</TableHead>
                <TableHead>Deductions</TableHead>
                <TableHead>Net Salary</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!payslips || payslips.length === 0) ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No payslips available</TableCell></TableRow>
              ) : payslips.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.month_name || p.month}/{p.year}</TableCell>
                  <TableCell>{showSalary ? fmtAmt(p.gross_salary) : '****'}</TableCell>
                  <TableCell>{showSalary ? fmtAmt(p.total_deductions) : '****'}</TableCell>
                  <TableCell className="font-semibold">{showSalary ? fmtAmt(p.net_salary) : '****'}</TableCell>
                  <TableCell><Badge variant="default">{p.status}</Badge></TableCell>
                  <TableCell>
                    {showSalary ? (
                      <div className="flex gap-1">
                        {p.view_token && (
                          <Button variant="ghost" size="sm" onClick={() => window.open(`/api/hrms/payslips/public/${p.view_token}/pdf`, '_blank')} title="View payslip" data-testid={`button-view-payslip-${p.id}`}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => handleDownload(p.id)} title="Download payslip" data-testid={`button-download-payslip-${p.id}`}>
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function HRPoliciesTab() {
  const { toast } = useToast();
  const { data: policies, isLoading } = useQuery<any[]>({ queryKey: ["/api/hrms/my/hr-policies"] });
  const [viewPolicy, setViewPolicy] = useState<any>(null);
  const [acknowledging, setAcknowledging] = useState<string | null>(null);

  const acknowledgePolicy = async (policyId: string) => {
    setAcknowledging(policyId);
    try {
      const res = await fetch(`/api/hrms/my/hr-policies/${policyId}/acknowledge`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed');
      queryClient.refetchQueries({ queryKey: ['/api/hrms/my/hr-policies'] });
      toast({ title: 'Policy acknowledged' });
    } catch (err: any) { toast({ title: 'Failed to acknowledge', variant: 'destructive' }); }
    setAcknowledging(null);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold" data-testid="text-my-policies-title">HR Policies</h3>
      <p className="text-sm text-muted-foreground">Review company policies and acknowledge them</p>
      {isLoading ? <Skeleton className="h-40 w-full" /> : (
        <div className="space-y-3">
          {policies?.map(p => (
            <div key={p.id} className="border rounded-lg p-4 space-y-2" data-testid={`policy-card-${p.id}`}>
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-medium">{p.title}</h4>
                  <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                    <span>{p.department_name}</span>
                    {p.effective_date && <span>Effective: {p.effective_date}</span>}
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  {p.acknowledged ? (
                    <Badge variant="default" className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" /> Acknowledged</Badge>
                  ) : (
                    <Badge variant="destructive">Not Acknowledged</Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setViewPolicy(p)} data-testid={`button-view-policy-${p.id}`}>
                  <Eye className="h-3.5 w-3.5 mr-1" /> View Policy
                </Button>
                {p.file_url && (
                  <a href={p.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline text-xs" data-testid={`link-policy-file-${p.id}`}>
                    <Paperclip className="h-3 w-3" /> Attachment
                  </a>
                )}
                {!p.acknowledged && (
                  <Button size="sm" onClick={() => acknowledgePolicy(p.id)} disabled={acknowledging === p.id} data-testid={`button-ack-policy-${p.id}`}>
                    {acknowledging === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CheckCircle className="h-3.5 w-3.5 mr-1" />}
                    Acknowledge
                  </Button>
                )}
              </div>
            </div>
          ))}
          {(!policies || policies.length === 0) && (
            <div className="text-center text-muted-foreground py-8">No policies to review</div>
          )}
        </div>
      )}

      <Dialog open={!!viewPolicy} onOpenChange={v => { if (!v) setViewPolicy(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{viewPolicy?.title}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span>{viewPolicy?.department_name}</span>
              {viewPolicy?.effective_date && <span>Effective: {viewPolicy.effective_date}</span>}
            </div>
            {viewPolicy?.file_url && (
              <a href={viewPolicy.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline text-sm" data-testid="link-policy-file">
                <Paperclip className="h-4 w-4" /> Download Attached File
              </a>
            )}
            {viewPolicy?.content && (
              <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap border rounded-md p-4 bg-muted/20">{viewPolicy.content}</div>
            )}
            {viewPolicy && !viewPolicy.acknowledged && (
              <div className="flex justify-end pt-2">
                <Button onClick={() => { acknowledgePolicy(viewPolicy.id); setViewPolicy(null); }} data-testid="button-ack-policy-dialog">
                  <CheckCircle className="h-4 w-4 mr-1" /> I Acknowledge This Policy
                </Button>
              </div>
            )}
            {viewPolicy?.acknowledged && (
              <p className="text-sm text-green-600 flex items-center gap-1"><CheckCircle className="h-4 w-4" /> Acknowledged on {new Date(viewPolicy.acknowledged_at).toLocaleDateString()}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DocumentsTab() {
  const { toast } = useToast();
  const { data: docData, isLoading } = useQuery<any>({ queryKey: ["/api/hrms/my/document-requests"] });
  const requests = docData?.requests || [];
  const availableTypes = docData?.available_types || [];
  const [requesting, setRequesting] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState("");

  const requestDocument = async () => {
    if (!selectedDocType) return;
    setRequesting(true);
    try {
      const res = await fetch('/api/hrms/my/document-requests', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc_type: selectedDocType }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || 'Failed'); }
      queryClient.refetchQueries({ queryKey: ['/api/hrms/my/document-requests'] });
      toast({ title: 'Document request submitted' });
      setSelectedDocType("");
    } catch (err: any) { toast({ title: err.message, variant: 'destructive' }); }
    setRequesting(false);
  };

  const selectedType = availableTypes.find((t: any) => t.doc_type === selectedDocType);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold" data-testid="text-my-documents-title">Document Requests</h3>
      <p className="text-sm text-muted-foreground">Request official documents from HR</p>

      <div className="border rounded-lg p-4 space-y-3">
        <Label>Select Document Type</Label>
        <div className="flex items-center gap-2">
          <Select value={selectedDocType} onValueChange={setSelectedDocType}>
            <SelectTrigger className="w-[280px]" data-testid="select-doc-type">
              <SelectValue placeholder="Choose a document..." />
            </SelectTrigger>
            <SelectContent>
              {availableTypes.map((t: any) => (
                <SelectItem key={t.doc_type} value={t.doc_type} disabled={!t.eligible || t.has_pending}>
                  {t.doc_type_display}
                  {!t.eligible && " (Not eligible)"}
                  {t.has_pending && " (Pending)"}
                </SelectItem>
              ))}
              {availableTypes.length === 0 && (
                <SelectItem value="_none" disabled>No document types available</SelectItem>
              )}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={requestDocument} disabled={requesting || !selectedDocType || !selectedType?.eligible || selectedType?.has_pending} data-testid="button-request-document">
            {requesting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
            <Send className="h-3.5 w-3.5 mr-1" /> Request
          </Button>
        </div>
        {selectedType && !selectedType.eligible && selectedType.reason && (
          <p className="text-xs text-amber-600 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {selectedType.reason}</p>
        )}
        {selectedType?.has_pending && (
          <p className="text-xs text-amber-600 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> You already have a pending request for this document</p>
        )}
      </div>

      <h4 className="font-medium text-sm mt-4">My Requests</h4>
      {isLoading ? <Skeleton className="h-32 w-full" /> : (
        <div className="space-y-2">
          {requests?.map((r: any) => (
            <div key={r.id} className="border rounded-lg p-3 flex items-center justify-between" data-testid={`doc-request-${r.id}`}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{r.doc_type_display}</span>
                  <Badge variant={r.status === "completed" ? "default" : r.status === "rejected" ? "destructive" : "secondary"} className="text-xs">
                    {r.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">Requested: {r.requested_at ? new Date(r.requested_at).toLocaleDateString() : ""}</p>
                {r.status === "rejected" && r.rejection_reason && (
                  <p className="text-xs text-red-500 mt-0.5">Reason: {r.rejection_reason}</p>
                )}
                {r.status === "completed" && r.completed_at && (
                  <p className="text-xs text-green-600 mt-0.5">Completed: {new Date(r.completed_at).toLocaleDateString()}</p>
                )}
              </div>
              {r.status === "completed" && r.document_url && (
                <a href={r.document_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline text-sm" data-testid={`link-download-doc-${r.id}`}>
                  <Download className="h-4 w-4" /> Download
                </a>
              )}
            </div>
          ))}
          {(!requests || requests.length === 0) && (
            <div className="text-center text-muted-foreground py-8">No document requests yet</div>
          )}
        </div>
      )}
    </div>
  );
}

function ChangePasswordTab() {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const rules = [
    { label: "At least 8 characters", met: newPassword.length >= 8 },
    { label: "One uppercase letter", met: /[A-Z]/.test(newPassword) },
    { label: "One lowercase letter", met: /[a-z]/.test(newPassword) },
    { label: "One number", met: /\d/.test(newPassword) },
    { label: "One special character", met: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword) },
  ];
  const allMet = rules.every(r => r.met) && newPassword.length > 0;
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allMet || !passwordsMatch || !currentPassword) return;
    setSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/auth/change-password", {
        currentPassword,
        newPassword,
        confirmPassword,
      });
      if (!res.ok) {
        const data = await res.json();
        toast({ title: "Error", description: data.message || "Failed to change password", variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Password changed successfully" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      toast({ title: "Error", description: "Failed to change password", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-xl font-bold mb-1" data-testid="text-change-password-title">Change Password</h2>
      <p className="text-sm text-muted-foreground mb-6">Update your password to keep your account secure.</p>
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  data-testid="input-current-password"
                />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowCurrent(!showCurrent)}>
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  data-testid="input-new-password"
                />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowNew(!showNew)}>
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div className="space-y-1 mt-2">
                {rules.map(r => (
                  <div key={r.label} className="flex items-center gap-2 text-xs">
                    {r.met ? <CheckCircle className="h-3 w-3 text-green-600" /> : <XCircle className="h-3 w-3 text-muted-foreground" />}
                    <span className={r.met ? "text-green-700" : "text-muted-foreground"}>{r.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                data-testid="input-confirm-password"
              />
              {confirmPassword && !passwordsMatch && (
                <p className="text-xs text-red-500">Passwords do not match</p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={!allMet || !passwordsMatch || !currentPassword || submitting}
              data-testid="button-change-password"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <KeyRound className="h-4 w-4 mr-2" />}
              Change Password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
