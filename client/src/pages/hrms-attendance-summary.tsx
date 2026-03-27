import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Download, Search } from "lucide-react";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function AttendanceSummaryTab() {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [filterOrg, setFilterOrg] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

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

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/hrms/attendance/summary", month, year, filterOrg, filterDept],
    queryFn: async () => {
      const params = new URLSearchParams({ month, year });
      if (filterOrg) params.append("organization_id", filterOrg);
      if (filterDept) params.append("department_id", filterDept);
      const res = await fetch(`/api/hrms/attendance/summary?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const employees = data?.employees || [];
  const filtered = searchTerm
    ? employees.filter((e: any) =>
        e.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.department || "").toLowerCase().includes(searchTerm.toLowerCase())
      )
    : employees;

  const exportCSV = () => {
    if (!filtered.length) return;
    const headers = [
      "S.N", "Employee Name", "Department", "Total Days", "Total Working Days", "Week Off",
      "Public Holidays", "Total Working Hours", "Total Worked Days", "Total Worked Hours",
      "Total Leave Taken", "Total Paid Leave", "Total Unpaid Leave", "Absent Days",
      "System OverTime(hr)", "Actual OverTime(hr)"
    ];
    const csvRows = [headers.join(",")];
    filtered.forEach((e: any, i: number) => {
      csvRows.push([
        i + 1, `"${e.employee_name}"`, `"${e.department || ''}"`, e.total_days, e.total_working_days,
        e.week_off, e.public_holidays, e.total_working_hours, e.total_worked_days,
        e.total_worked_hours, e.total_leave_taken, e.total_paid_leave, e.total_unpaid_leave,
        e.absent_days, e.system_overtime, e.actual_overtime,
      ].join(","));
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance_summary_${MONTHS[parseInt(month) - 1]}_${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totals = filtered.reduce((acc: any, e: any) => ({
    total_working_days: acc.total_working_days + e.total_working_days,
    total_working_hours: acc.total_working_hours + e.total_working_hours,
    total_worked_days: acc.total_worked_days + e.total_worked_days,
    total_worked_hours: acc.total_worked_hours + e.total_worked_hours,
    total_leave_taken: acc.total_leave_taken + e.total_leave_taken,
    total_paid_leave: acc.total_paid_leave + e.total_paid_leave,
    total_unpaid_leave: acc.total_unpaid_leave + e.total_unpaid_leave,
    absent_days: acc.absent_days + e.absent_days,
    system_overtime: acc.system_overtime + e.system_overtime,
    actual_overtime: acc.actual_overtime + e.actual_overtime,
  }), {
    total_working_days: 0, total_working_hours: 0, total_worked_days: 0,
    total_worked_hours: 0, total_leave_taken: 0, total_paid_leave: 0,
    total_unpaid_leave: 0, absent_days: 0, system_overtime: 0, actual_overtime: 0,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold" data-testid="text-att-summary-title">Attendance Summary</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filterOrg} onValueChange={v => { setFilterOrg(v === "__all__" ? "" : v); setFilterDept(""); }}>
            <SelectTrigger className="w-44 h-8 text-xs" data-testid="select-summary-org"><SelectValue placeholder="All Organizations" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Organizations</SelectItem>
              {organizations?.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterDept} onValueChange={v => setFilterDept(v === "__all__" ? "" : v)}>
            <SelectTrigger className="w-44 h-8 text-xs" data-testid="select-summary-dept"><SelectValue placeholder="All Departments" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Departments</SelectItem>
              {(departments || []).filter((d: any) => !filterOrg || d.organization_id === filterOrg).map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search employee..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-44 h-8 text-xs pl-7"
              data-testid="input-summary-search"
            />
          </div>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={exportCSV} disabled={!filtered.length} data-testid="btn-export-summary">
            <Download className="w-3.5 h-3.5 mr-1" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-3 pb-3">
          <p className="text-xs text-muted-foreground">Total Employees</p>
          <p className="text-2xl font-bold" data-testid="text-summary-emp-count">{filtered.length}</p>
        </CardContent></Card>
        <Card className="border-green-200 bg-green-50/50"><CardContent className="pt-3 pb-3">
          <p className="text-xs text-muted-foreground">Total Worked Days</p>
          <p className="text-2xl font-bold text-green-600" data-testid="text-summary-worked-days">{totals.total_worked_days}</p>
        </CardContent></Card>
        <Card className="border-red-200 bg-red-50/50"><CardContent className="pt-3 pb-3">
          <p className="text-xs text-muted-foreground">Total Absent</p>
          <p className="text-2xl font-bold text-red-600" data-testid="text-summary-absent">{totals.absent_days}</p>
        </CardContent></Card>
        <Card className="border-blue-200 bg-blue-50/50"><CardContent className="pt-3 pb-3">
          <p className="text-xs text-muted-foreground">Total Leave Taken</p>
          <p className="text-2xl font-bold text-blue-600" data-testid="text-summary-leave">{totals.total_leave_taken}</p>
        </CardContent></Card>
      </div>

      {isLoading ? <Skeleton className="h-60 w-full" /> : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-auto max-h-[calc(100vh-360px)]">
              <table className="w-full text-xs border-collapse min-w-[1400px]">
                <thead className="sticky top-0 z-10 bg-muted">
                  <tr>
                    <th className="p-2 border-b text-left font-medium min-w-[40px]">S.N</th>
                    <th className="p-2 border-b text-left font-medium min-w-[160px] sticky left-0 bg-muted z-20">Employee Name</th>
                    <th className="p-2 border-b text-center font-medium min-w-[60px]">Total Days</th>
                    <th className="p-2 border-b text-center font-medium min-w-[80px]">Total Working Days</th>
                    <th className="p-2 border-b text-center font-medium min-w-[60px]">Week Off</th>
                    <th className="p-2 border-b text-center font-medium min-w-[70px]">Public Holidays</th>
                    <th className="p-2 border-b text-center font-medium min-w-[80px]">Total Working Hours</th>
                    <th className="p-2 border-b text-center font-medium min-w-[80px]">Total Worked Days</th>
                    <th className="p-2 border-b text-center font-medium min-w-[80px]">Total Worked Hours</th>
                    <th className="p-2 border-b text-center font-medium min-w-[70px]">Total Leave Taken</th>
                    <th className="p-2 border-b text-center font-medium min-w-[70px]">Total Paid Leave</th>
                    <th className="p-2 border-b text-center font-medium min-w-[80px]">Total Unpaid Leave</th>
                    <th className="p-2 border-b text-center font-medium min-w-[60px]">Absent Days</th>
                    <th className="p-2 border-b text-center font-medium min-w-[80px]">System OverTime(hr)</th>
                    <th className="p-2 border-b text-center font-medium min-w-[80px]">Actual OverTime(hr)</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={15} className="text-center p-8 text-muted-foreground">No data for {MONTHS[parseInt(month) - 1]} {year}</td></tr>
                  ) : (
                    <>
                      {filtered.map((e: any, idx: number) => (
                        <tr key={e.employee_id} className="hover:bg-muted/30 border-b" data-testid={`row-summary-${e.employee_id}`}>
                          <td className="p-2">{idx + 1}</td>
                          <td className="p-2 sticky left-0 bg-background z-[5] border-r">
                            <p className="font-medium truncate max-w-[150px]">{e.employee_name}</p>
                            {e.department && <p className="text-[10px] text-muted-foreground truncate max-w-[150px]">{e.department}</p>}
                          </td>
                          <td className="p-2 text-center">{e.total_days}</td>
                          <td className="p-2 text-center font-medium">{e.total_working_days}</td>
                          <td className="p-2 text-center">{e.week_off}</td>
                          <td className="p-2 text-center">{e.public_holidays}</td>
                          <td className="p-2 text-center font-mono">{e.total_working_hours}</td>
                          <td className="p-2 text-center">
                            <span className="text-green-600 font-medium">{e.total_worked_days}</span>
                          </td>
                          <td className="p-2 text-center font-mono">{e.total_worked_hours}</td>
                          <td className="p-2 text-center">
                            <span className={e.total_leave_taken > 0 ? "text-blue-600 font-medium" : ""}>{e.total_leave_taken}</span>
                          </td>
                          <td className="p-2 text-center">{e.total_paid_leave}</td>
                          <td className="p-2 text-center">
                            <span className={e.total_unpaid_leave > 0 ? "text-orange-600 font-medium" : ""}>{e.total_unpaid_leave}</span>
                          </td>
                          <td className="p-2 text-center">
                            <span className={e.absent_days > 0 ? "text-red-600 font-medium" : ""}>{e.absent_days}</span>
                          </td>
                          <td className="p-2 text-center font-mono">{e.system_overtime > 0 ? e.system_overtime : "—"}</td>
                          <td className="p-2 text-center font-mono">{e.actual_overtime > 0 ? e.actual_overtime : "—"}</td>
                        </tr>
                      ))}
                      <tr className="bg-muted/50 font-semibold border-t-2">
                        <td className="p-2" colSpan={2}>
                          <span className="sticky left-0">Total ({filtered.length} employees)</span>
                        </td>
                        <td className="p-2 text-center">—</td>
                        <td className="p-2 text-center">{totals.total_working_days}</td>
                        <td className="p-2 text-center">—</td>
                        <td className="p-2 text-center">—</td>
                        <td className="p-2 text-center font-mono">{Math.round(totals.total_working_hours * 100) / 100}</td>
                        <td className="p-2 text-center text-green-600">{totals.total_worked_days}</td>
                        <td className="p-2 text-center font-mono">{Math.round(totals.total_worked_hours * 100) / 100}</td>
                        <td className="p-2 text-center text-blue-600">{totals.total_leave_taken}</td>
                        <td className="p-2 text-center">{totals.total_paid_leave}</td>
                        <td className="p-2 text-center text-orange-600">{totals.total_unpaid_leave}</td>
                        <td className="p-2 text-center text-red-600">{totals.absent_days}</td>
                        <td className="p-2 text-center font-mono">{Math.round(totals.system_overtime * 100) / 100}</td>
                        <td className="p-2 text-center font-mono">{Math.round(totals.actual_overtime * 100) / 100}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
