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
import { Landmark, TrendingUp, Shield, Wallet, Building2 } from "lucide-react";

interface Organization {
  id: string;
  name: string;
}

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
  const currentMonth = new Date().getMonth() + 1;
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()));
  const [filterMonth, setFilterMonth] = useState(String(currentMonth));
  const [recordType, setRecordType] = useState("tax");
  const [filterOrg, setFilterOrg] = useState("all");

  const { data: orgs } = useQuery<Organization[]>({ queryKey: ["/api/hrms/organizations"] });

  const { data, isLoading } = useQuery<GovtTaxData>({
    queryKey: ["/api/hrms/government-tax-records", { year: filterYear, organization_id: filterOrg }],
    queryFn: async () => {
      const params = new URLSearchParams({ year: filterYear });
      if (filterOrg !== "all") params.set("organization_id", filterOrg);
      const res = await fetch(`/api/hrms/government-tax-records?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      return res.json();
    },
  });

  if (isLoading) return <div className="space-y-3"><Skeleton className="h-40" /><Skeleton className="h-60" /></div>;

  const totals = data?.annual_totals;
  const monthly = data?.monthly || [];
  const hasData = monthly.some(m => m.employee_count > 0);
  const hasSSF = monthly.some(m => m.total_ssf_employee > 0 || m.total_ssf_employer > 0);

  const selectedMonth = monthly.find(m => m.month === parseInt(filterMonth));

  const typeOptions: { value: string; label: string; icon: JSX.Element }[] = [
    { value: "tax", label: "Income Tax", icon: <TrendingUp className="h-4 w-4 text-orange-500" /> },
    { value: "cit", label: "CIT", icon: <Shield className="h-4 w-4 text-blue-500" /> },
  ];
  if (hasSSF) {
    typeOptions.push({ value: "ssf", label: "SSF", icon: <Wallet className="h-4 w-4 text-green-500" /> });
  }

  const summaryCards = [];
  if (totals && hasData) {
    summaryCards.push({ icon: <Shield className="h-4 w-4 text-blue-500" />, label: "Total CIT", value: totals.total_cit, testId: "text-total-cit" });
    if (hasSSF) {
      summaryCards.push({ icon: <Wallet className="h-4 w-4 text-green-500" />, label: "SSF (Employee)", value: totals.total_ssf_employee, testId: "text-total-ssf-emp" });
      summaryCards.push({ icon: <Wallet className="h-4 w-4 text-purple-500" />, label: "SSF (Employer)", value: totals.total_ssf_employer, testId: "text-total-ssf-empr" });
    }
    summaryCards.push({ icon: <TrendingUp className="h-4 w-4 text-orange-500" />, label: "Income Tax", value: totals.total_tax, testId: "text-total-tax" });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Government Records</h2>
          <p className="text-sm text-muted-foreground">Monthly staff-level breakdown of Income Tax, CIT, and SSF payable to government.</p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Select value={filterYear} onValueChange={setFilterYear}>
          <SelectTrigger className="w-24" data-testid="select-year"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterMonth} onValueChange={setFilterMonth}>
          <SelectTrigger className="w-40" data-testid="select-month"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Months</SelectItem>
            {MONTHS.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={recordType} onValueChange={setRecordType}>
          <SelectTrigger className="w-36" data-testid="select-record-type"><SelectValue /></SelectTrigger>
          <SelectContent>
            {typeOptions.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {orgs && orgs.length > 1 && (
          <Select value={filterOrg} onValueChange={setFilterOrg}>
            <SelectTrigger className="w-52" data-testid="select-organization">
              <Building2 className="h-4 w-4 mr-1 text-muted-foreground" />
              <SelectValue placeholder="All Organizations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Organizations</SelectItem>
              {orgs.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {summaryCards.length > 0 && totals && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {summaryCards.map(c => (
            <Card key={c.testId}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  {c.icon}
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                </div>
                <p className="text-lg font-bold font-mono" data-testid={c.testId}>{c.value.toLocaleString()}</p>
              </CardContent>
            </Card>
          ))}
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

      {!hasData && (
        <div className="text-center text-muted-foreground py-12 border rounded-md">
          No payroll data for {filterYear}. Process payroll runs to see government records.
        </div>
      )}

      {hasData && (() => {
        const monthsToShow = filterMonth === "all"
          ? monthly.filter(m => m.employee_count > 0)
          : selectedMonth && selectedMonth.employee_count > 0
            ? [selectedMonth]
            : [];

        if (monthsToShow.length === 0 && filterMonth !== "all") {
          return (
            <div className="text-center text-muted-foreground py-12 border rounded-md">
              No payroll data for {MONTHS[parseInt(filterMonth) - 1]} {filterYear}.
            </div>
          );
        }

        return (
          <div className="space-y-5">
            {recordType === "tax" && (
              <>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-orange-500" />
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Income Tax Records</h3>
                </div>
                {monthsToShow.map(m => (
                  <div key={`tax-${m.month}`} className="border rounded-lg overflow-hidden" data-testid={`section-tax-${m.month}`}>
                    <div className="bg-muted/40 px-4 py-2 flex items-center justify-between border-b">
                      <span className="font-semibold text-sm">{MONTHS[m.month - 1]} {m.year}</span>
                      <span className="text-xs text-muted-foreground">{m.employee_count} staff</span>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead className="text-right">Gross Salary</TableHead>
                          <TableHead className="text-right">Income Tax</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {m.staff.map((s, idx) => (
                          <TableRow key={`${s.employee_id}-${idx}`}>
                            <TableCell className="text-sm">{s.employee_name}</TableCell>
                            <TableCell className="text-right font-mono text-sm">{fmt(s.gross_salary)}</TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {s.tax > 0 ? <span className="text-orange-600 font-medium">{fmt(s.tax)}</span> : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/30 font-semibold">
                          <TableCell className="font-bold text-sm">Total</TableCell>
                          <TableCell className="text-right font-mono text-sm">{fmt(m.total_gross)}</TableCell>
                          <TableCell className="text-right font-mono text-sm text-orange-600">{fmt(m.total_tax)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                ))}
                {filterMonth === "all" && totals && monthsToShow.length > 1 && (
                  <div className="border rounded-lg overflow-hidden border-orange-200 bg-orange-50/30">
                    <Table>
                      <TableBody>
                        <TableRow className="font-bold">
                          <TableCell className="text-sm">Annual Total ({filterYear})</TableCell>
                          <TableCell className="text-right font-mono">{fmt(monthly.reduce((s, m) => s + m.total_gross, 0))}</TableCell>
                          <TableCell className="text-right font-mono text-orange-600 text-base">{fmt(totals.total_tax)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}
              </>
            )}

            {recordType === "cit" && (
              <>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-blue-500" />
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">CIT Records</h3>
                </div>
                {monthsToShow.map(m => (
                  <div key={`cit-${m.month}`} className="border rounded-lg overflow-hidden" data-testid={`section-cit-${m.month}`}>
                    <div className="bg-muted/40 px-4 py-2 flex items-center justify-between border-b">
                      <span className="font-semibold text-sm">{MONTHS[m.month - 1]} {m.year}</span>
                      <span className="text-xs text-muted-foreground">{m.employee_count} staff</span>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead className="text-right">CIT Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {m.staff.map((s, idx) => (
                          <TableRow key={`${s.employee_id}-${idx}`}>
                            <TableCell className="text-sm">{s.employee_name}</TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {s.cit > 0 ? <span className="text-blue-600 font-medium">{fmt(s.cit)}</span> : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/30 font-semibold">
                          <TableCell className="font-bold text-sm">Total</TableCell>
                          <TableCell className="text-right font-mono text-sm text-blue-600">{fmt(m.total_cit)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                ))}
                {filterMonth === "all" && totals && monthsToShow.length > 1 && (
                  <div className="border rounded-lg overflow-hidden border-blue-200 bg-blue-50/30">
                    <Table>
                      <TableBody>
                        <TableRow className="font-bold">
                          <TableCell className="text-sm">Annual Total ({filterYear})</TableCell>
                          <TableCell className="text-right font-mono text-blue-600 text-base">{fmt(totals.total_cit)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}
              </>
            )}

            {recordType === "ssf" && hasSSF && (
              <>
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-green-500" />
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">SSF Records</h3>
                </div>
                {monthsToShow.filter(m => m.total_ssf_employee > 0 || m.total_ssf_employer > 0).map(m => {
                  const monthSsfTotal = m.total_ssf_employee + m.total_ssf_employer;
                  return (
                    <div key={`ssf-${m.month}`} className="border rounded-lg overflow-hidden" data-testid={`section-ssf-${m.month}`}>
                      <div className="bg-muted/40 px-4 py-2 flex items-center justify-between border-b">
                        <span className="font-semibold text-sm">{MONTHS[m.month - 1]} {m.year}</span>
                        <span className="text-xs text-muted-foreground">{m.employee_count} staff</span>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Employee</TableHead>
                            <TableHead className="text-right">SSF (Employee)</TableHead>
                            <TableHead className="text-right">SSF (Employer)</TableHead>
                            <TableHead className="text-right font-semibold">Total SSF</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {m.staff.filter(s => s.ssf_employee > 0 || s.ssf_employer > 0).map((s, idx) => (
                            <TableRow key={`${s.employee_id}-${idx}`}>
                              <TableCell className="text-sm">{s.employee_name}</TableCell>
                              <TableCell className="text-right font-mono text-sm">{fmt(s.ssf_employee)}</TableCell>
                              <TableCell className="text-right font-mono text-sm">{fmt(s.ssf_employer)}</TableCell>
                              <TableCell className="text-right font-mono text-sm">
                                <span className="text-green-600 font-medium">{fmt(s.ssf_employee + s.ssf_employer)}</span>
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-muted/30 font-semibold">
                            <TableCell className="font-bold text-sm">Total</TableCell>
                            <TableCell className="text-right font-mono text-sm">{fmt(m.total_ssf_employee)}</TableCell>
                            <TableCell className="text-right font-mono text-sm">{fmt(m.total_ssf_employer)}</TableCell>
                            <TableCell className="text-right font-mono text-sm text-green-600">{fmt(monthSsfTotal)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  );
                })}
                {filterMonth === "all" && totals && (
                  <div className="border rounded-lg overflow-hidden border-green-200 bg-green-50/30">
                    <Table>
                      <TableBody>
                        <TableRow className="font-bold">
                          <TableCell className="text-sm">Annual Total ({filterYear})</TableCell>
                          <TableCell className="text-right font-mono">{fmt(totals.total_ssf_employee)}</TableCell>
                          <TableCell className="text-right font-mono">{fmt(totals.total_ssf_employer)}</TableCell>
                          <TableCell className="text-right font-mono text-green-600 text-base">{fmt(totals.total_ssf_employee + totals.total_ssf_employer)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })()}
    </div>
  );
}
