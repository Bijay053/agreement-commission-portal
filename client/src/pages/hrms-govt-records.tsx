import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Landmark, TrendingUp, Shield, Wallet, ChevronDown, ChevronRight } from "lucide-react";

interface StaffDetail {
  employee_id: string;
  employee_name: string;
  gross_salary: number;
  cit: number;
  ssf_employee: number;
  ssf_employer: number;
  tax: number;
  total_govt: number;
}

interface MonthlyRecord {
  month: number;
  year: number;
  employee_count: number;
  total_gross: number;
  total_cit: number;
  total_ssf_employee: number;
  total_ssf_employer: number;
  total_tax: number;
  total_payable_to_govt: number;
  staff: StaffDetail[];
}

interface GovtTaxData {
  monthly: MonthlyRecord[];
  annual_totals: {
    total_cit: number;
    total_ssf_employee: number;
    total_ssf_employer: number;
    total_tax: number;
    total_payable_to_govt: number;
  };
  year: number;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const fmt = (v: number) => v > 0 ? v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";

export function GovernmentRecordsTab() {
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()));
  const [expandedTaxMonths, setExpandedTaxMonths] = useState<Set<number>>(new Set());
  const [expandedCitMonths, setExpandedCitMonths] = useState<Set<number>>(new Set());

  const toggleTaxMonth = (month: number) => {
    setExpandedTaxMonths(prev => {
      const next = new Set(prev);
      next.has(month) ? next.delete(month) : next.add(month);
      return next;
    });
  };

  const toggleCitMonth = (month: number) => {
    setExpandedCitMonths(prev => {
      const next = new Set(prev);
      next.has(month) ? next.delete(month) : next.add(month);
      return next;
    });
  };

  const { data, isLoading } = useQuery<GovtTaxData>({
    queryKey: ["/api/hrms/government-tax-records", { year: filterYear }],
    queryFn: async () => {
      const res = await fetch(`/api/hrms/government-tax-records?year=${filterYear}`, { credentials: "include" });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      return res.json();
    },
  });

  if (isLoading) return <div className="space-y-3"><Skeleton className="h-40" /><Skeleton className="h-60" /></div>;

  const totals = data?.annual_totals;
  const monthly = data?.monthly || [];
  const hasData = monthly.some(m => m.employee_count > 0);
  const monthsWithData = monthly.filter(m => m.employee_count > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Government Records</h2>
          <p className="text-sm text-muted-foreground">Monthly staff-level breakdown of Income Tax, CIT, and SSF payable to government.</p>
        </div>
        <Select value={filterYear} onValueChange={setFilterYear}>
          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {totals && hasData && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="h-4 w-4 text-blue-500" />
                <p className="text-xs text-muted-foreground">Total CIT</p>
              </div>
              <p className="text-lg font-bold font-mono" data-testid="text-total-cit">{totals.total_cit.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Wallet className="h-4 w-4 text-green-500" />
                <p className="text-xs text-muted-foreground">SSF (Employee)</p>
              </div>
              <p className="text-lg font-bold font-mono" data-testid="text-total-ssf-emp">{totals.total_ssf_employee.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Wallet className="h-4 w-4 text-purple-500" />
                <p className="text-xs text-muted-foreground">SSF (Employer)</p>
              </div>
              <p className="text-lg font-bold font-mono" data-testid="text-total-ssf-empr">{totals.total_ssf_employer.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-orange-500" />
                <p className="text-xs text-muted-foreground">Income Tax</p>
              </div>
              <p className="text-lg font-bold font-mono" data-testid="text-total-tax">{totals.total_tax.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Landmark className="h-4 w-4 text-primary" />
                <p className="text-xs text-muted-foreground font-medium">Total to Govt</p>
              </div>
              <p className="text-xl font-bold font-mono text-primary" data-testid="text-total-govt">{totals.total_payable_to_govt.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-orange-500" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Income Tax Records — Staff Details</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Month</TableHead>
              <TableHead className="text-center">Staff</TableHead>
              <TableHead className="text-right">Gross Salary</TableHead>
              <TableHead className="text-right">Income Tax</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {monthly.map(m => {
              const isExpanded = expandedTaxMonths.has(m.month);
              const hasStaff = m.staff && m.staff.length > 0;
              return (
                <>
                  <TableRow
                    key={`tax-${m.month}`}
                    className={`${m.employee_count === 0 ? "opacity-40" : "cursor-pointer hover:bg-muted/50"}`}
                    onClick={() => hasStaff && toggleTaxMonth(m.month)}
                    data-testid={`row-tax-${m.month}`}
                  >
                    <TableCell className="w-8 px-2">
                      {hasStaff && (isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)}
                    </TableCell>
                    <TableCell className="font-semibold">{MONTHS[m.month - 1]} {m.year}</TableCell>
                    <TableCell className="text-center">{m.employee_count || "—"}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmt(m.total_gross)}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold">
                      {m.total_tax > 0 ? <span className="text-orange-600">{fmt(m.total_tax)}</span> : "—"}
                    </TableCell>
                  </TableRow>
                  {isExpanded && hasStaff && m.staff.map((s, idx) => (
                    <TableRow key={`tax-${m.month}-${s.employee_id}-${idx}`} className="bg-muted/20">
                      <TableCell></TableCell>
                      <TableCell className="pl-8 text-sm">{s.employee_name}</TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-right font-mono text-sm">{fmt(s.gross_salary)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {s.tax > 0 ? <span className="text-orange-600">{fmt(s.tax)}</span> : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </>
              );
            })}
            {hasData && totals && (
              <TableRow className="bg-muted/50 font-semibold border-t-2">
                <TableCell></TableCell>
                <TableCell className="font-bold">Annual Total</TableCell>
                <TableCell></TableCell>
                <TableCell className="text-right font-mono">{fmt(monthsWithData.reduce((s, m) => s + m.total_gross, 0))}</TableCell>
                <TableCell className="text-right font-mono text-orange-600">{fmt(totals.total_tax)}</TableCell>
              </TableRow>
            )}
            {!hasData && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No payroll data for {filterYear}. Process payroll runs to see income tax records.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-4 w-4 text-blue-500" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">CIT & SSF Records — Staff Details</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Month</TableHead>
              <TableHead className="text-center">Staff</TableHead>
              <TableHead className="text-right">CIT</TableHead>
              <TableHead className="text-right">SSF (Employee)</TableHead>
              <TableHead className="text-right">SSF (Employer)</TableHead>
              <TableHead className="text-right font-semibold">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {monthly.map(m => {
              const isExpanded = expandedCitMonths.has(m.month);
              const hasStaff = m.staff && m.staff.length > 0;
              const monthCitTotal = m.total_cit + m.total_ssf_employee + m.total_ssf_employer;
              return (
                <>
                  <TableRow
                    key={`cit-${m.month}`}
                    className={`${m.employee_count === 0 ? "opacity-40" : "cursor-pointer hover:bg-muted/50"}`}
                    onClick={() => hasStaff && toggleCitMonth(m.month)}
                    data-testid={`row-cit-${m.month}`}
                  >
                    <TableCell className="w-8 px-2">
                      {hasStaff && (isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)}
                    </TableCell>
                    <TableCell className="font-semibold">{MONTHS[m.month - 1]} {m.year}</TableCell>
                    <TableCell className="text-center">{m.employee_count || "—"}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmt(m.total_cit)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmt(m.total_ssf_employee)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmt(m.total_ssf_employer)}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold">
                      {monthCitTotal > 0 ? <span className="text-blue-600">{fmt(monthCitTotal)}</span> : "—"}
                    </TableCell>
                  </TableRow>
                  {isExpanded && hasStaff && m.staff.map((s, idx) => {
                    const staffCitTotal = s.cit + s.ssf_employee + s.ssf_employer;
                    return (
                      <TableRow key={`cit-${m.month}-${s.employee_id}-${idx}`} className="bg-muted/20">
                        <TableCell></TableCell>
                        <TableCell className="pl-8 text-sm">{s.employee_name}</TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-right font-mono text-sm">{fmt(s.cit)}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{fmt(s.ssf_employee)}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{fmt(s.ssf_employer)}</TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {staffCitTotal > 0 ? <span className="text-blue-600">{fmt(staffCitTotal)}</span> : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </>
              );
            })}
            {hasData && totals && (
              <TableRow className="bg-muted/50 font-semibold border-t-2">
                <TableCell></TableCell>
                <TableCell className="font-bold">Annual Total</TableCell>
                <TableCell></TableCell>
                <TableCell className="text-right font-mono">{fmt(totals.total_cit)}</TableCell>
                <TableCell className="text-right font-mono">{fmt(totals.total_ssf_employee)}</TableCell>
                <TableCell className="text-right font-mono">{fmt(totals.total_ssf_employer)}</TableCell>
                <TableCell className="text-right font-mono text-blue-600">
                  {fmt(totals.total_cit + totals.total_ssf_employee + totals.total_ssf_employer)}
                </TableCell>
              </TableRow>
            )}
            {!hasData && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No payroll data for {filterYear}. Process payroll runs to see CIT & SSF records.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
