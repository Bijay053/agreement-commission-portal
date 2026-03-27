import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Users, UserCheck, UserX, Clock, CalendarDays, Cake,
  TreePalm, Calendar, AlertCircle, FileWarning,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const GENDER_COLORS: Record<string, string> = {
  male: "#8B5CF6",
  female: "#EC4899",
  other: "#F59E0B",
  unknown: "#9CA3AF",
};

const MARITAL_COLORS: Record<string, string> = {
  single: "#5EEAD4",
  married: "#C4B5FD",
  divorced: "#FB923C",
  widowed: "#94A3B8",
  unknown: "#D1D5DB",
};

export function HRMSDashboardTab() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/hrms/dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/hrms/dashboard", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch dashboard");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-16" /></CardContent></Card>)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const genderData = Object.entries(data.gender_distribution || {}).map(([key, value]) => ({
    name: key.charAt(0).toUpperCase() + key.slice(1),
    value: value as number,
    color: GENDER_COLORS[key] || "#9CA3AF",
  }));
  const genderTotal = genderData.reduce((s, d) => s + d.value, 0);

  const maritalData = Object.entries(data.marital_status_distribution || {}).map(([key, value]) => ({
    name: key.charAt(0).toUpperCase() + key.slice(1),
    value: value as number,
    color: MARITAL_COLORS[key] || "#D1D5DB",
  }));

  const todayStr = new Date().toLocaleDateString("en", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold" data-testid="text-dashboard-title">HRMS Dashboard</h2>
        <p className="text-sm text-muted-foreground">{todayStr}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="pt-3 pb-3">
          <div className="flex items-center gap-2"><Users className="w-4 h-4 text-primary" /><p className="text-xs text-muted-foreground">Total Employees</p></div>
          <div className="text-2xl font-bold mt-1" data-testid="text-dash-total">{data.total_employees}</div>
        </CardContent></Card>
        <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20"><CardContent className="pt-3 pb-3">
          <div className="flex items-center gap-2"><UserCheck className="w-4 h-4 text-green-600" /><p className="text-xs text-muted-foreground">Present Today</p></div>
          <div className="text-2xl font-bold text-green-600 mt-1" data-testid="text-dash-present">{data.present_today}</div>
        </CardContent></Card>
        <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/20"><CardContent className="pt-3 pb-3">
          <div className="flex items-center gap-2"><UserX className="w-4 h-4 text-red-600" /><p className="text-xs text-muted-foreground">Absent Today</p></div>
          <div className="text-2xl font-bold text-red-600 mt-1" data-testid="text-dash-absent">{data.absent_today}</div>
        </CardContent></Card>
        <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20"><CardContent className="pt-3 pb-3">
          <div className="flex items-center gap-2"><CalendarDays className="w-4 h-4 text-blue-600" /><p className="text-xs text-muted-foreground">On Leave</p></div>
          <div className="text-2xl font-bold text-blue-600 mt-1" data-testid="text-dash-leave">{data.on_leave_today}</div>
        </CardContent></Card>
        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20"><CardContent className="pt-3 pb-3">
          <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-amber-600" /><p className="text-xs text-muted-foreground">Late Today</p></div>
          <div className="text-2xl font-bold text-amber-600 mt-1" data-testid="text-dash-late">{data.late_today}</div>
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-base font-semibold text-center">Gender</CardTitle>
            <p className="text-xs text-muted-foreground text-center">Employee based on gender</p>
          </CardHeader>
          <CardContent className="pb-4 px-4">
            <div className="flex items-center justify-center gap-8">
              {genderData.map(g => {
                const pct = genderTotal > 0 ? Math.round((g.value / genderTotal) * 100) : 0;
                return (
                  <div key={g.name} className="text-center">
                    <div className="relative mx-auto w-20 h-28 mb-2">
                      {g.name.toLowerCase() === 'male' ? (
                        <svg viewBox="0 0 80 120" className="w-20 h-28">
                          <circle cx="40" cy="18" r="14" fill="#D1D5DB" />
                          <rect x="25" y="36" width="30" height="40" rx="5" fill="#D1D5DB" />
                          <rect x="28" y="76" width="10" height="35" rx="4" fill={g.color} />
                          <rect x="42" y="76" width="10" height="35" rx="4" fill={g.color} />
                          <rect x="10" y="40" width="12" height="30" rx="5" fill="#D1D5DB" />
                          <rect x="58" y="40" width="12" height="30" rx="5" fill="#D1D5DB" />
                        </svg>
                      ) : g.name.toLowerCase() === 'female' ? (
                        <svg viewBox="0 0 80 120" className="w-20 h-28">
                          <circle cx="40" cy="18" r="14" fill="#D1D5DB" />
                          <path d="M25 36 L20 90 L40 80 L60 90 L55 36 Z" fill={g.color} rx="5" />
                          <rect x="25" y="36" width="30" height="20" rx="5" fill="#D1D5DB" />
                          <rect x="10" y="40" width="12" height="30" rx="5" fill="#D1D5DB" />
                          <rect x="58" y="40" width="12" height="30" rx="5" fill="#D1D5DB" />
                          <rect x="28" y="88" width="10" height="22" rx="4" fill="#D1D5DB" />
                          <rect x="42" y="88" width="10" height="22" rx="4" fill="#D1D5DB" />
                        </svg>
                      ) : (
                        <div className="w-16 h-16 rounded-full mx-auto mt-4 flex items-center justify-center text-2xl" style={{ backgroundColor: g.color + '30' }}>?</div>
                      )}
                    </div>
                    <p className="text-2xl font-bold" style={{ color: g.color }}>{pct}%</p>
                    <p className="text-xs text-muted-foreground uppercase font-medium">{g.name} <span className="text-muted-foreground">({g.value})</span></p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-0 pt-4 px-4">
            <CardTitle className="text-base font-semibold text-center">Marital Status</CardTitle>
            <p className="text-xs text-muted-foreground text-center">Employee Based On Marital Status</p>
          </CardHeader>
          <CardContent className="pb-4 px-4">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={maritalData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {maritalData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [`${value} employees`, name]}
                    contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-1">
              {maritalData.map(d => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                  <span>{d.name} ({d.value})</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2 pt-4 px-4 bg-slate-600 dark:bg-slate-800 rounded-t-lg">
            <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
              <Cake className="w-4 h-4" /> Birthdays & Anniversary
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {(!data.upcoming_birthdays || data.upcoming_birthdays.length === 0) ? (
              <div className="p-6 text-center text-muted-foreground text-sm">No upcoming birthdays in the next 30 days</div>
            ) : (
              <div className="divide-y max-h-[300px] overflow-auto">
                {data.upcoming_birthdays.map((b: any) => (
                  <div key={b.id} className="flex items-center justify-between p-3 hover:bg-muted/30" data-testid={`birthday-${b.id}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <Cake className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{b.name}</p>
                        <p className="text-xs text-muted-foreground">{b.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs">Birthday</Badge>
                      <span className="text-sm font-semibold text-right min-w-[80px]">
                        {b.days_until === 0 ? "Today!" : `${b.days_until} Day${b.days_until > 1 ? 's' : ''} To Go`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 pt-4 px-4 bg-slate-600 dark:bg-slate-800 rounded-t-lg">
            <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Events & Holidays
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {(!data.upcoming_holidays || data.upcoming_holidays.length === 0) ? (
              <div className="p-6 text-center text-muted-foreground text-sm">No upcoming holidays</div>
            ) : (
              <div className="divide-y max-h-[300px] overflow-auto">
                {data.upcoming_holidays.map((h: any) => (
                  <div key={h.id} className="flex items-center justify-between p-3 hover:bg-muted/30" data-testid={`holiday-${h.id}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{h.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(h.date + "T00:00:00").toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" })}
                          {h.organization ? ` · ${h.organization}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {h.is_optional && <Badge variant="outline" className="text-xs">Optional</Badge>}
                      <span className="text-sm font-semibold min-w-[80px] text-right">
                        {h.days_until === 0 ? "Today" : `${h.days_until} day${h.days_until > 1 ? 's' : ''}`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {data.contracts_ending_soon && data.contracts_ending_soon.length > 0 && (
        <Card className="border-orange-200">
          <CardHeader className="pb-2 pt-4 px-4 bg-orange-600 dark:bg-orange-800 rounded-t-lg">
            <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
              <FileWarning className="w-4 h-4" /> Contracts Ending Soon
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-auto max-h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Employee</TableHead>
                    <TableHead className="text-xs">Department</TableHead>
                    <TableHead className="text-xs">Contract End Date</TableHead>
                    <TableHead className="text-xs">Days Remaining</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.contracts_ending_soon.map((c: any) => (
                    <TableRow key={c.id} data-testid={`contract-ending-${c.id}`}>
                      <TableCell className="text-xs">
                        <p className="font-medium">{c.name}</p>
                        <p className="text-muted-foreground">{c.email}</p>
                      </TableCell>
                      <TableCell className="text-xs">{c.department || "—"}</TableCell>
                      <TableCell className="text-xs">
                        {new Date(c.contract_end_date + "T00:00:00").toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric" })}
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${
                          c.days_remaining <= 7
                            ? "bg-red-100 text-red-700 hover:bg-red-200"
                            : c.days_remaining <= 30
                            ? "bg-orange-100 text-orange-700 hover:bg-orange-200"
                            : "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                        }`}>
                          {c.days_remaining === 0 ? "Today" : `${c.days_remaining} day${c.days_remaining > 1 ? "s" : ""}`}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TreePalm className="w-4 h-4 text-blue-600" /> On Leave Today
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {(!data.on_leave_list || data.on_leave_list.length === 0) ? (
              <div className="p-6 text-center text-muted-foreground text-sm">No one is on leave today</div>
            ) : (
              <div className="divide-y max-h-[280px] overflow-auto">
                {data.on_leave_list.map((l: any) => (
                  <div key={l.id} className="flex items-center justify-between p-3 hover:bg-muted/30" data-testid={`leave-today-${l.id}`}>
                    <div>
                      <p className="text-sm font-medium">{l.name}</p>
                      <p className="text-xs text-muted-foreground">{l.department}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary" className="text-xs">{l.leave_type}</Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {l.start_date === l.end_date ? l.start_date : `${l.start_date} — ${l.end_date}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600" /> Pending Leave Requests
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {(!data.pending_leave_requests || data.pending_leave_requests.length === 0) ? (
              <div className="p-6 text-center text-muted-foreground text-sm">No pending leave requests</div>
            ) : (
              <div className="overflow-auto max-h-[280px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Employee</TableHead>
                      <TableHead className="text-xs">Leave Date</TableHead>
                      <TableHead className="text-xs">Days</TableHead>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs">Reason</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.pending_leave_requests.map((lr: any, idx: number) => (
                      <TableRow key={lr.id} data-testid={`pending-leave-${lr.id}`}>
                        <TableCell className="text-xs">
                          <p className="font-medium">{lr.employee_name}</p>
                        </TableCell>
                        <TableCell className="text-xs">
                          {lr.start_date === lr.end_date ? lr.start_date : `${lr.start_date} to ${lr.end_date}`}
                        </TableCell>
                        <TableCell className="text-xs font-medium">{lr.days}</TableCell>
                        <TableCell className="text-xs">{lr.leave_type}</TableCell>
                        <TableCell className="text-xs max-w-[120px] truncate">{lr.reason || "—"}</TableCell>
                        <TableCell>
                          <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-200 text-xs">Pending</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
