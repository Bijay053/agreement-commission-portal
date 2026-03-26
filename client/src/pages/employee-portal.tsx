import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
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
} from "lucide-react";

type Tab = "profile" | "attendance" | "leave" | "payslips";

export default function EmployeePortal() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("profile");

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: "profile", label: "My Profile", icon: User },
    { key: "attendance", label: "Attendance", icon: Clock },
    { key: "leave", label: "Leave", icon: Calendar },
    { key: "payslips", label: "Payslips", icon: FileText },
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
              <p className="text-sm font-semibold leading-tight">People & HRMS</p>
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
        {activeTab === "profile" && <ProfileTab />}
        {activeTab === "attendance" && <AttendanceTab />}
        {activeTab === "leave" && <LeaveTab />}
        {activeTab === "payslips" && <PayslipsTab />}
      </main>
    </div>
  );
}

function ProfileTab() {
  const { data: profile, isLoading } = useQuery<any>({
    queryKey: ["/api/hrms/my/profile"],
  });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-40" /><Skeleton className="h-60" /></div>;
  if (!profile) return <div className="text-center py-12 text-muted-foreground">No employee profile found linked to your account.</div>;

  const infoRows = [
    { label: "Full Name", value: profile.full_name },
    { label: "Email", value: profile.email },
    { label: "Phone", value: profile.phone },
    { label: "Organization", value: profile.organization_name },
    { label: "Department", value: profile.department_name },
    { label: "Designation", value: profile.designation },
    { label: "Employment Type", value: profile.employment_type },
    { label: "Join Date", value: profile.join_date },
  ].filter(r => r.value);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold" data-testid="text-profile-title">My Profile</h2>
        <p className="text-sm text-muted-foreground">Your employee information</p>
      </div>
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary">
              {profile.full_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
            </div>
            <div>
              <h3 className="text-xl font-semibold" data-testid="text-employee-name">{profile.full_name}</h3>
              <p className="text-sm text-muted-foreground">{profile.designation || "Employee"}</p>
              {profile.department_name && <Badge variant="outline" className="mt-1">{profile.department_name}</Badge>}
            </div>
          </div>
          <div className="space-y-3">
            {infoRows.map(row => (
              <div key={row.label} className="flex justify-between py-2 border-b last:border-0">
                <span className="text-sm text-muted-foreground">{row.label}</span>
                <span className="text-sm font-medium" data-testid={`text-${row.label.toLowerCase().replace(/\s+/g, '-')}`}>{row.value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AttendanceTab() {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/hrms/my/attendance", { month, year }],
    queryFn: async () => {
      const res = await fetch(`/api/hrms/my/attendance?month=${month}&year=${year}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const records = data?.records || [];
  const summary = data?.summary || {};

  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold" data-testid="text-attendance-title">My Attendance</h2>
          <p className="text-sm text-muted-foreground">Your attendance records</p>
        </div>
        <div className="flex gap-2">
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
                <TableHead>Status</TableHead>
                <TableHead>Check In</TableHead>
                <TableHead>Check Out</TableHead>
                <TableHead>Late</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No attendance records for this period</TableCell></TableRow>
              ) : records.map((r: any) => (
                <TableRow key={r.date}>
                  <TableCell className="font-medium">{r.date}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === "present" ? "default" : r.status === "absent" ? "destructive" : "outline"}>
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{r.check_in || "—"}</TableCell>
                  <TableCell>{r.check_out || "—"}</TableCell>
                  <TableCell>{r.is_late ? <Badge variant="destructive" className="text-xs">{r.late_minutes}m</Badge> : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function LeaveTab() {
  const { toast } = useToast();
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ leave_type_id: "", start_date: "", end_date: "", reason: "" });

  const { data: balance, isLoading: balLoading } = useQuery<any[]>({
    queryKey: ["/api/hrms/my/leave-balance"],
  });

  const { data: requests, isLoading: reqLoading } = useQuery<any[]>({
    queryKey: ["/api/hrms/my/leave-requests"],
  });

  const submitMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/hrms/my/leave-requests", data),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/hrms/my/leave-requests"] });
      queryClient.refetchQueries({ queryKey: ["/api/hrms/my/leave-balance"] });
      setShowRequestForm(false);
      setLeaveForm({ leave_type_id: "", start_date: "", end_date: "", reason: "" });
      toast({ title: "Leave request submitted" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to submit", description: err.message, variant: "destructive" });
    },
  });

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
            {(balance || []).map((b: any) => (
              <Card key={b.leave_type_id || b.leave_type}>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{b.leave_type_name || b.leave_type}</p>
                  <p className="text-lg font-bold" data-testid={`text-balance-${b.leave_type_name || b.leave_type}`}>{b.remaining ?? b.balance ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground">of {b.allocated ?? b.total ?? 0}</p>
                </CardContent>
              </Card>
            ))}
            {(!balance || balance.length === 0) && <p className="text-sm text-muted-foreground col-span-4">No leave balance configured</p>}
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {(!requests || requests.length === 0) ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No leave requests</TableCell></TableRow>
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
                    <SelectItem key={b.leave_type_id || b.id} value={b.leave_type_id || b.id}>{b.leave_type_name || b.leave_type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Date</Label>
                <input type="date" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={leaveForm.start_date} onChange={e => setLeaveForm({ ...leaveForm, start_date: e.target.value })} data-testid="input-leave-start" />
              </div>
              <div>
                <Label>End Date</Label>
                <input type="date" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={leaveForm.end_date} onChange={e => setLeaveForm({ ...leaveForm, end_date: e.target.value })} data-testid="input-leave-end" />
              </div>
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea value={leaveForm.reason} onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })} placeholder="Reason for leave..." data-testid="input-leave-reason" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRequestForm(false)}>Cancel</Button>
            <Button onClick={() => submitMutation.mutate(leaveForm)} disabled={submitMutation.isPending} data-testid="button-submit-leave">Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PayslipsTab() {
  const { data: payslips, isLoading } = useQuery<any[]>({
    queryKey: ["/api/hrms/my/payslips"],
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold" data-testid="text-payslips-title">My Payslips</h2>
        <p className="text-sm text-muted-foreground">View and download your payslips</p>
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
                  <TableCell>{Number(p.gross_salary || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell>{Number(p.total_deductions || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="font-semibold">{Number(p.net_salary || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell><Badge variant="default">{p.status}</Badge></TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => handleDownload(p.id)} data-testid={`button-download-payslip-${p.id}`}>
                      <Download className="h-4 w-4" />
                    </Button>
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
