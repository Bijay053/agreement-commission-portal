import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Landmark, TrendingUp, Shield, Wallet } from "lucide-react";

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

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function GovernmentRecordsTab() {
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()));

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Government Tax & CIT Records</h2>
          <p className="text-sm text-muted-foreground">Monthly breakdown of CIT, SSF, and income tax payable to government from processed payroll.</p>
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
              <p className="text-lg font-bold font-mono" data-testid="text-total-cit">{ totals.total_cit.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Wallet className="h-4 w-4 text-green-500" />
                <p className="text-xs text-muted-foreground">SSF (Employee)</p>
              </div>
              <p className="text-lg font-bold font-mono" data-testid="text-total-ssf-emp">{ totals.total_ssf_employee.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Wallet className="h-4 w-4 text-purple-500" />
                <p className="text-xs text-muted-foreground">SSF (Employer)</p>
              </div>
              <p className="text-lg font-bold font-mono" data-testid="text-total-ssf-empr">{ totals.total_ssf_employer.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-orange-500" />
                <p className="text-xs text-muted-foreground">Income Tax</p>
              </div>
              <p className="text-lg font-bold font-mono" data-testid="text-total-tax">{ totals.total_tax.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Landmark className="h-4 w-4 text-primary" />
                <p className="text-xs text-muted-foreground font-medium">Total Payable to Govt</p>
              </div>
              <p className="text-xl font-bold font-mono text-primary" data-testid="text-total-govt">{ totals.total_payable_to_govt.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Month</TableHead>
            <TableHead className="text-center">Employees</TableHead>
            <TableHead className="text-right">Gross Salary</TableHead>
            <TableHead className="text-right">CIT</TableHead>
            <TableHead className="text-right">SSF (Employee)</TableHead>
            <TableHead className="text-right">SSF (Employer)</TableHead>
            <TableHead className="text-right">Income Tax</TableHead>
            <TableHead className="text-right font-semibold">Total to Govt</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {monthly.map(m => (
            <TableRow key={m.month} className={m.employee_count === 0 ? "opacity-40" : ""} data-testid={`row-govt-${m.month}`}>
              <TableCell className="font-medium">{MONTHS[m.month - 1]} {m.year}</TableCell>
              <TableCell className="text-center">{m.employee_count || "—"}</TableCell>
              <TableCell className="text-right font-mono text-sm">{m.total_gross > 0 ? `${m.total_gross.toLocaleString()}` : "—"}</TableCell>
              <TableCell className="text-right font-mono text-sm">{m.total_cit > 0 ? `${m.total_cit.toLocaleString()}` : "—"}</TableCell>
              <TableCell className="text-right font-mono text-sm">{m.total_ssf_employee > 0 ? `${m.total_ssf_employee.toLocaleString()}` : "—"}</TableCell>
              <TableCell className="text-right font-mono text-sm">{m.total_ssf_employer > 0 ? `${m.total_ssf_employer.toLocaleString()}` : "—"}</TableCell>
              <TableCell className="text-right font-mono text-sm">{m.total_tax > 0 ? `${m.total_tax.toLocaleString()}` : "—"}</TableCell>
              <TableCell className="text-right font-mono text-sm font-semibold">
                {m.total_payable_to_govt > 0 ? (
                  <span className="text-primary">{ m.total_payable_to_govt.toLocaleString()}</span>
                ) : "—"}
              </TableCell>
            </TableRow>
          ))}
          {!hasData && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                No payroll data for {filterYear}. Process payroll runs to see government tax records.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {hasData && totals && (
        <Table>
          <TableBody>
            <TableRow className="bg-muted/50 font-semibold">
              <TableCell className="font-bold">Annual Totals {filterYear}</TableCell>
              <TableCell></TableCell>
              <TableCell></TableCell>
              <TableCell className="text-right font-mono">{ totals.total_cit.toLocaleString()}</TableCell>
              <TableCell className="text-right font-mono">{ totals.total_ssf_employee.toLocaleString()}</TableCell>
              <TableCell className="text-right font-mono">{ totals.total_ssf_employer.toLocaleString()}</TableCell>
              <TableCell className="text-right font-mono">{ totals.total_tax.toLocaleString()}</TableCell>
              <TableCell className="text-right font-mono text-primary text-lg">{ totals.total_payable_to_govt.toLocaleString()}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      )}
    </div>
  );
}
