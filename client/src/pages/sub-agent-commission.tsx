import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MultiSearchableSelect } from "@/components/ui/multi-searchable-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Search, Users, DollarSign, TrendingUp, AlertCircle,
  RefreshCw, ArrowDownUp, AlertTriangle
} from "lucide-react";
import type { CommissionStudent, SubAgentEntry, SubAgentTermEntry } from "@shared/schema";

type CommissionTerm = { id: number; termName: string; termLabel: string; year: number; termNumber: number; sortOrder: number; isActive: boolean };

type MasterRow = SubAgentEntry & { student: CommissionStudent };
type TermRow = SubAgentTermEntry & { student: CommissionStudent };

const STATUS_COLORS: Record<string, string> = {
  "Withdrawn": "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  "Complete": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  "On Break": "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  "Claim Next Semester": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  "Under Enquiry": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  "Active": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
};

const STATUS_ROW_BG: Record<string, string> = {
  "Withdrawn": "#FFC7CE",
  "Complete": "#C6EFCE",
  "On Break": "#FCE4D6",
  "Claim Next Semester": "#FFF2CC",
  "Under Enquiry": "#D9E1F2",
  "Active": "#C6EFCE",
};

const PAYMENT_STATUS_BG: Record<string, { bg: string; fg: string }> = {
  "PO Send": { bg: "#FFF2CC", fg: "#7F6000" },
  "Payment Made": { bg: "#D9EAD3", fg: "#274E13" },
  "Hold": { bg: "#F4CCCC", fg: "#990000" },
  "Invoice Waiting": { bg: "transparent", fg: "inherit" },
};

const STUDENT_STATUSES = ["Under Enquiry", "Claim Next Semester", "On Break", "Withdrawn", "Complete", "Active"];
const PAYMENT_STATUSES = ["Invoice Waiting", "PO Send", "Payment Made", "Hold"];
const ACADEMIC_YEARS = ["Year 1", "Year 2", "Year 3"];

function EditableCell({ value, onSave, type = "text", options, readOnly, width, align, mono, highlightStyle }: {
  value: string;
  onSave: (v: string) => void;
  type?: "text" | "number" | "select";
  options?: string[];
  readOnly?: boolean;
  width?: string;
  align?: string;
  mono?: boolean;
  highlightStyle?: { bg: string; fg: string };
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  const style: any = { minWidth: width || "auto" };
  if (highlightStyle) {
    style.backgroundColor = highlightStyle.bg;
    style.color = highlightStyle.fg;
  }

  if (readOnly) {
    return (
      <td className={`px-2 py-1 border border-gray-200 dark:border-gray-700 text-xs whitespace-nowrap ${align === "right" ? "text-right" : "text-left"} ${mono ? "font-mono" : ""}`} style={style} data-testid="cell-readonly">
        {value || "-"}
      </td>
    );
  }

  if (editing) {
    if (type === "select" && options) {
      return (
        <td className="px-1 py-0 border border-blue-400 bg-blue-50 dark:bg-blue-900/20" style={{ minWidth: width || "auto" }}>
          <select
            className="w-full text-xs bg-transparent outline-none py-1"
            value={draft}
            onChange={(e) => { setDraft(e.target.value); onSave(e.target.value); setEditing(false); }}
            onBlur={() => setEditing(false)}
            autoFocus
            data-testid="cell-select"
          >
            {options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </td>
      );
    }
    return (
      <td className="px-1 py-0 border border-blue-400 bg-blue-50 dark:bg-blue-900/20" style={{ minWidth: width || "auto" }}>
        <input
          ref={inputRef}
          className={`w-full text-xs bg-transparent outline-none py-1 ${align === "right" ? "text-right" : ""} ${mono ? "font-mono" : ""}`}
          type={type === "number" ? "number" : "text"}
          step={type === "number" ? "0.01" : undefined}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => { onSave(draft); setEditing(false); }}
          onKeyDown={(e) => { if (e.key === "Enter") { onSave(draft); setEditing(false); } if (e.key === "Escape") setEditing(false); }}
          data-testid="cell-input"
        />
      </td>
    );
  }

  return (
    <td
      className={`px-2 py-1 border border-gray-200 dark:border-gray-700 text-xs whitespace-nowrap cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 ${align === "right" ? "text-right" : "text-left"} ${mono ? "font-mono" : ""}`}
      style={style}
      onClick={() => { setDraft(value); setEditing(true); }}
      data-testid="cell-editable"
    >
      {value || "-"}
    </td>
  );
}

function fmt(v: string | number | null | undefined): string {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return "-";
  return n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function SubAgentCommissionPage() {
  const { user, hasPermission } = useAuth();
  const { toast } = useToast();
  const canEdit = hasPermission("sub_agent_commission.edit");

  const [activeTab, setActiveTab] = useState("DASHBOARD");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [search, setSearch] = useState("");
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

  const termsQuery = useQuery<CommissionTerm[]>({ queryKey: ["/api/commission-tracker/terms"] });
  const terms = (termsQuery.data || []).filter(t => t.year === selectedYear).sort((a, b) => a.sortOrder - b.sortOrder);
  const years = [...new Set((termsQuery.data || []).map(t => t.year))].sort((a, b) => b - a);

  const dashboardQuery = useQuery({
    queryKey: ["/api/sub-agent-commission/dashboard", selectedYear],
    queryFn: async () => {
      const res = await fetch(`/api/sub-agent-commission/dashboard?year=${selectedYear}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch dashboard");
      return res.json();
    },
    enabled: activeTab === "DASHBOARD",
  });

  const buildFilterParams = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (selectedAgents.length) params.set("agents", selectedAgents.join(","));
    if (selectedProviders.length) params.set("providers", selectedProviders.join(","));
    if (selectedStatuses.length) params.set("statuses", selectedStatuses.join(","));
    return params.toString();
  }, [search, selectedAgents, selectedProviders, selectedStatuses]);

  const masterQuery = useQuery<MasterRow[]>({
    queryKey: ["/api/sub-agent-commission/master", buildFilterParams()],
    queryFn: async () => {
      const params = buildFilterParams();
      const url = `/api/sub-agent-commission/master${params ? `?${params}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: activeTab === "MASTER",
  });

  const termEntryQuery = useQuery<TermRow[]>({
    queryKey: ["/api/sub-agent-commission/terms", activeTab, buildFilterParams()],
    queryFn: async () => {
      const params = buildFilterParams();
      const url = `/api/sub-agent-commission/terms/${activeTab}${params ? `?${params}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: activeTab !== "DASHBOARD" && activeTab !== "MASTER",
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/sub-agent-commission/sync");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Sync Complete", description: `Added: ${data.added}, Updated: ${data.updated}, Removed: ${data.removed}` });
      queryClient.invalidateQueries({ queryKey: ["/api/sub-agent-commission/master"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sub-agent-commission/terms"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sub-agent-commission/dashboard"] });
    },
    onError: (err: any) => {
      toast({ title: "Sync Failed", description: err.message, variant: "destructive" });
    },
  });

  const updateMasterMutation = useMutation({
    mutationFn: async ({ studentId, data }: { studentId: number; data: any }) => {
      const res = await apiRequest("PUT", `/api/sub-agent-commission/master/${studentId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sub-agent-commission/master"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sub-agent-commission/terms"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sub-agent-commission/dashboard"] });
    },
    onError: (err: any) => {
      toast({ title: "Update Failed", description: err.message, variant: "destructive" });
    },
  });

  const updateTermEntryMutation = useMutation({
    mutationFn: async ({ termName, id, data }: { termName: string; id: number; data: any }) => {
      const res = await apiRequest("PUT", `/api/sub-agent-commission/terms/${termName}/entries/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sub-agent-commission/master"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sub-agent-commission/terms"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sub-agent-commission/dashboard"] });
    },
    onError: (err: any) => {
      toast({ title: "Update Failed", description: err.message, variant: "destructive" });
    },
  });

  const allMasterRows = masterQuery.data || [];
  const allAgents = [...new Set(allMasterRows.map(r => r.student.agentName))].sort();
  const allProviders = [...new Set(allMasterRows.map(r => r.student.provider))].sort();

  const isLoading = activeTab === "DASHBOARD" ? dashboardQuery.isLoading
    : activeTab === "MASTER" ? masterQuery.isLoading
    : termEntryQuery.isLoading;

  return (
    <div className="flex flex-col h-full" data-testid="sub-agent-commission-page">
      <div className="flex items-center justify-between p-4 border-b bg-background">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold" data-testid="text-page-title">Sub-Agent Commission</h1>
          <div className="flex items-center gap-1">
            {years.map(y => (
              <Button
                key={y}
                variant={selectedYear === y ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedYear(y)}
                data-testid={`button-year-${y}`}
              >
                {y}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              data-testid="button-sync"
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${syncMutation.isPending ? "animate-spin" : ""}`} />
              {syncMutation.isPending ? "Syncing..." : "Sync from Main"}
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search student, agent, ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
            data-testid="input-search"
          />
        </div>
        <MultiSearchableSelect
          options={allAgents.map(a => ({ value: a, label: a }))}
          values={selectedAgents}
          onValuesChange={setSelectedAgents}
          placeholder="All Agents"
          data-testid="filter-agents"
        />
        <MultiSearchableSelect
          options={allProviders.map(p => ({ value: p, label: p }))}
          values={selectedProviders}
          onValuesChange={setSelectedProviders}
          placeholder="All Providers"
          data-testid="filter-providers"
        />
        <MultiSearchableSelect
          options={STUDENT_STATUSES.map(s => ({ value: s, label: s }))}
          values={selectedStatuses}
          onValuesChange={setSelectedStatuses}
          placeholder="All Statuses"
          data-testid="filter-statuses"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <div className="border-b px-4">
          <TabsList className="bg-transparent h-auto p-0 gap-0">
            <TabsTrigger value="DASHBOARD" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 text-sm" data-testid="tab-dashboard">
              DASHBOARD
            </TabsTrigger>
            <TabsTrigger value="MASTER" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 text-sm" data-testid="tab-master">
              MASTER
            </TabsTrigger>
            {terms.map(t => (
              <TabsTrigger key={t.termName} value={t.termName} className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 text-sm" data-testid={`tab-${t.termName}`}>
                {t.termLabel}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : activeTab === "DASHBOARD" ? (
            <DashboardView data={dashboardQuery.data} />
          ) : activeTab === "MASTER" ? (
            <MasterTable
              rows={allMasterRows}
              canEdit={canEdit}
              onUpdateRate={(studentId, rate) => updateMasterMutation.mutate({ studentId, data: { subAgentCommissionRatePct: rate } })}
              onUpdateGst={(studentId, gst) => updateMasterMutation.mutate({ studentId, data: { gstApplicable: gst } })}
            />
          ) : (
            <TermTable
              rows={termEntryQuery.data || []}
              termName={activeTab}
              canEdit={canEdit}
              onUpdate={(id, data) => updateTermEntryMutation.mutate({ termName: activeTab, id, data })}
            />
          )}
        </div>
      </Tabs>
    </div>
  );
}

function DashboardView({ data }: { data: any }) {
  if (!data) return <div className="text-center text-muted-foreground py-8" data-testid="text-no-data">No data available. Click "Sync from Main" first.</div>;

  return (
    <div className="space-y-6" data-testid="dashboard-view">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card data-testid="card-total-students">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Students</p>
                <p className="text-2xl font-bold" data-testid="text-total-students">{data.totalStudents}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-total-paid">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Paid to Sub-Agents</p>
                <p className="text-2xl font-bold" data-testid="text-total-paid">${fmt(data.totalPaid)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-total-margin">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <TrendingUp className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Margin</p>
                <p className="text-2xl font-bold" data-testid="text-total-margin">${fmt(data.totalMargin)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card data-testid="card-status-breakdown">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3">Status Breakdown</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(data.byStatus || {}).map(([status, count]) => (
                <Badge key={status} className={STATUS_COLORS[status] || "bg-gray-100 text-gray-800"} data-testid={`badge-status-${status}`}>
                  {status}: {count as number}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-agent-breakdown">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3">By Agent</h3>
            <div className="space-y-1 max-h-48 overflow-auto">
              {(data.byAgent || []).map((a: any) => (
                <div key={a.agent} className="flex justify-between text-sm" data-testid={`row-agent-${a.agent}`}>
                  <span className="truncate mr-2">{a.agent}</span>
                  <span className="font-mono text-muted-foreground">{a.count} students / ${fmt(a.totalPaid)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MasterTable({ rows, canEdit, onUpdateRate, onUpdateGst }: {
  rows: MasterRow[];
  canEdit: boolean;
  onUpdateRate: (studentId: number, rate: string) => void;
  onUpdateGst: (studentId: number, gst: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground" data-testid="text-empty-master">
        <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-40" />
        <p className="text-lg font-medium">No sub-agent entries</p>
        <p className="text-sm">Click "Sync from Main" to import students from the main commission tracker.</p>
      </div>
    );
  }

  return (
    <div className="overflow-auto border rounded-lg" data-testid="master-table">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-[#1F4E79] text-white">
            <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[40px]">S.No</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[80px]">Agentsic ID</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[120px]">Agent Name</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[120px]">Student Name</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[120px]">Provider</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[70px]">Country</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[80px]">Start Intake</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[150px]">Course Name</th>
            <th className="px-2 py-1.5 text-right font-medium border border-[#2060a0] min-w-[90px]">SIC Received</th>
            <th className="px-2 py-1.5 text-right font-medium border border-[#2060a0] min-w-[70px]">Sub Rate (%)</th>
            <th className="px-2 py-1.5 text-center font-medium border border-[#2060a0] min-w-[60px]">GST</th>
            <th className="px-2 py-1.5 text-right font-medium border border-[#2060a0] min-w-[90px]">Sub Paid</th>
            <th className="px-2 py-1.5 text-right font-medium border border-[#2060a0] min-w-[80px]">Margin</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[80px]">Warning</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[80px]">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const st = row.status || "Under Enquiry";
            const bgColor = STATUS_ROW_BG[st] || "";
            return (
              <tr key={row.id} style={{ backgroundColor: bgColor }} data-testid={`row-master-${row.id}`}>
                <td className="px-2 py-1 border border-gray-200 text-xs text-center">{idx + 1}</td>
                <td className="px-2 py-1 border border-gray-200 text-xs">{row.student.agentsicId || "-"}</td>
                <td className="px-2 py-1 border border-gray-200 text-xs">{row.student.agentName}</td>
                <td className="px-2 py-1 border border-gray-200 text-xs font-medium">{row.student.studentName}</td>
                <td className="px-2 py-1 border border-gray-200 text-xs">{row.student.provider}</td>
                <td className="px-2 py-1 border border-gray-200 text-xs">{row.student.country}</td>
                <td className="px-2 py-1 border border-gray-200 text-xs">{row.student.startIntake || "-"}</td>
                <td className="px-2 py-1 border border-gray-200 text-xs">{row.student.courseName || "-"}</td>
                <td className="px-2 py-1 border border-gray-200 text-xs text-right font-mono">{fmt(row.sicReceivedTotal)}</td>
                <EditableCell
                  value={String(Number(row.subAgentCommissionRatePct) || 0)}
                  onSave={(v) => onUpdateRate(row.commissionStudentId, v)}
                  type="number"
                  readOnly={!canEdit}
                  width="70px"
                  align="right"
                  mono
                />
                <EditableCell
                  value={row.gstApplicable || "No"}
                  onSave={(v) => onUpdateGst(row.commissionStudentId, v)}
                  type="select"
                  options={["Yes", "No"]}
                  readOnly={!canEdit}
                  width="60px"
                  align="center"
                />
                <td className="px-2 py-1 border border-gray-200 text-xs text-right font-mono">{fmt(row.subAgentPaidTotal)}</td>
                <td className="px-2 py-1 border border-gray-200 text-xs text-right font-mono">{fmt(row.margin)}</td>
                <td className="px-2 py-1 border border-gray-200 text-xs">
                  {row.overpayWarning && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <span className="text-red-600 font-medium" data-testid="text-overpay-warning">❌ Overpaid</span>
                        </TooltipTrigger>
                        <TooltipContent>Sub-agent paid exceeds SIC received</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </td>
                <td className="px-2 py-1 border border-gray-200 text-xs">
                  <Badge className={`text-[10px] py-0 ${STATUS_COLORS[st] || "bg-gray-100 text-gray-800"}`} data-testid={`badge-status-${row.id}`}>
                    {st}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TermTable({ rows, termName, canEdit, onUpdate }: {
  rows: TermRow[];
  termName: string;
  canEdit: boolean;
  onUpdate: (id: number, data: any) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground" data-testid="text-empty-term">
        <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-40" />
        <p className="text-lg font-medium">No entries for this term</p>
        <p className="text-sm">Sync from main tracker to populate term entries.</p>
      </div>
    );
  }

  const totals = rows.reduce((acc, r) => ({
    feeNet: acc.feeNet + (Number(r.feeNet) || 0),
    mainComm: acc.mainComm + (Number(r.mainCommission) || 0),
    subComm: acc.subComm + (Number(r.subAgentCommission) || 0),
    bonus: acc.bonus + (Number(r.bonusPaid) || 0),
    gst: acc.gst + (Number(r.gstAmount) || 0),
    totalPaid: acc.totalPaid + (Number(r.totalPaid) || 0),
  }), { feeNet: 0, mainComm: 0, subComm: 0, bonus: 0, gst: 0, totalPaid: 0 });

  return (
    <div className="overflow-auto border rounded-lg" data-testid="term-table">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-[#1F4E79] text-white sticky top-0 z-10">
            <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[35px]">S.No</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[80px]">Agentsic ID</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[110px]">Agent Name</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[110px]">Student Name</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[110px]">Provider</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[65px]">Country</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[75px]">Intake</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[130px]">Course</th>
            <th className="px-2 py-1.5 text-center font-medium border border-[#2060a0] min-w-[70px]">Acad Year</th>
            <th className="px-2 py-1.5 text-right font-medium border border-[#2060a0] min-w-[80px]">Fee (Net)</th>
            <th className="px-2 py-1.5 text-right font-medium border border-[#2060a0] min-w-[80px]">Main Comm</th>
            <th className="px-2 py-1.5 text-right font-medium border border-[#2060a0] min-w-[60px]">Rate (Auto)</th>
            <th className="px-2 py-1.5 text-right font-medium border border-[#2060a0] min-w-[70px]">Rate Override</th>
            <th className="px-2 py-1.5 text-right font-medium border border-[#2060a0] min-w-[60px]">Rate Used</th>
            <th className="px-2 py-1.5 text-right font-medium border border-[#2060a0] min-w-[80px]">Sub Comm</th>
            <th className="px-2 py-1.5 text-right font-medium border border-[#2060a0] min-w-[70px]">Bonus</th>
            <th className="px-2 py-1.5 text-right font-medium border border-[#2060a0] min-w-[50px]">GST %</th>
            <th className="px-2 py-1.5 text-right font-medium border border-[#2060a0] min-w-[60px]">GST</th>
            <th className="px-2 py-1.5 text-right font-medium border border-[#2060a0] min-w-[80px]">Total Paid</th>
            <th className="px-2 py-1.5 text-center font-medium border border-[#2060a0] min-w-[90px]">Payment Status</th>
            <th className="px-2 py-1.5 text-center font-medium border border-[#2060a0] min-w-[90px]">Student Status</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[80px]">Warnings</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const st = row.studentStatus || "Under Enquiry";
            const bgColor = STATUS_ROW_BG[st] || "";
            const payStatus = row.paymentStatus || "Invoice Waiting";
            const payHighlight = PAYMENT_STATUS_BG[payStatus] || PAYMENT_STATUS_BG["Invoice Waiting"];

            return (
              <tr key={row.id} style={{ backgroundColor: bgColor }} data-testid={`row-term-${row.id}`}>
                <td className="px-2 py-1 border border-gray-200 text-xs text-center">{idx + 1}</td>
                <td className="px-2 py-1 border border-gray-200 text-xs">{row.student.agentsicId || "-"}</td>
                <td className="px-2 py-1 border border-gray-200 text-xs">{row.student.agentName}</td>
                <td className="px-2 py-1 border border-gray-200 text-xs font-medium">{row.student.studentName}</td>
                <td className="px-2 py-1 border border-gray-200 text-xs">{row.student.provider}</td>
                <td className="px-2 py-1 border border-gray-200 text-xs">{row.student.country}</td>
                <td className="px-2 py-1 border border-gray-200 text-xs">{row.student.startIntake || "-"}</td>
                <td className="px-2 py-1 border border-gray-200 text-xs">{row.student.courseName || "-"}</td>
                <EditableCell
                  value={row.academicYear || "Year 1"}
                  onSave={(v) => onUpdate(row.id, { academicYear: v })}
                  type="select"
                  options={ACADEMIC_YEARS}
                  readOnly={!canEdit}
                  width="70px"
                  align="center"
                />
                <EditableCell
                  value={String(Number(row.feeNet) || 0)}
                  onSave={(v) => onUpdate(row.id, { feeNet: v })}
                  type="number"
                  readOnly={!canEdit}
                  width="80px"
                  align="right"
                  mono
                />
                <td className="px-2 py-1 border border-gray-200 text-xs text-right font-mono">{fmt(row.mainCommission)}</td>
                <td className="px-2 py-1 border border-gray-200 text-xs text-right font-mono">{fmt(row.commissionRateAuto)}</td>
                <EditableCell
                  value={row.commissionRateOverridePct ? String(Number(row.commissionRateOverridePct)) : ""}
                  onSave={(v) => onUpdate(row.id, { commissionRateOverridePct: v || null })}
                  type="number"
                  readOnly={!canEdit}
                  width="70px"
                  align="right"
                  mono
                />
                <td className="px-2 py-1 border border-gray-200 text-xs text-right font-mono">{fmt(row.commissionRateUsedPct)}</td>
                <td className="px-2 py-1 border border-gray-200 text-xs text-right font-mono">{fmt(row.subAgentCommission)}</td>
                <EditableCell
                  value={String(Number(row.bonusPaid) || 0)}
                  onSave={(v) => onUpdate(row.id, { bonusPaid: v })}
                  type="number"
                  readOnly={!canEdit}
                  width="70px"
                  align="right"
                  mono
                />
                <EditableCell
                  value={String(Number(row.gstPct) || 0)}
                  onSave={(v) => onUpdate(row.id, { gstPct: v })}
                  type="number"
                  readOnly={!canEdit}
                  width="50px"
                  align="right"
                  mono
                />
                <td className="px-2 py-1 border border-gray-200 text-xs text-right font-mono">{fmt(row.gstAmount)}</td>
                <td className="px-2 py-1 border border-gray-200 text-xs text-right font-mono font-semibold">{fmt(row.totalPaid)}</td>
                <EditableCell
                  value={payStatus}
                  onSave={(v) => onUpdate(row.id, { paymentStatus: v })}
                  type="select"
                  options={PAYMENT_STATUSES}
                  readOnly={!canEdit}
                  width="90px"
                  align="center"
                  highlightStyle={payHighlight}
                />
                <td className="px-2 py-1 border border-gray-200 text-xs text-center">
                  <Badge className={`text-[10px] py-0 ${STATUS_COLORS[st] || "bg-gray-100 text-gray-800"}`}>
                    {st}
                  </Badge>
                </td>
                <td className="px-2 py-1 border border-gray-200 text-xs">
                  {row.rateOverrideWarning && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger><span className="text-amber-600">⚠</span></TooltipTrigger>
                        <TooltipContent>{row.rateOverrideWarning}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  {row.exceedsMainWarning && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger><span className="text-red-600 ml-1">❌</span></TooltipTrigger>
                        <TooltipContent>{row.exceedsMainWarning}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-gray-100 dark:bg-gray-800 font-semibold sticky bottom-0">
            <td colSpan={9} className="px-2 py-1.5 border border-gray-300 text-xs text-right">TOTALS</td>
            <td className="px-2 py-1.5 border border-gray-300 text-xs text-right font-mono">{fmt(totals.feeNet)}</td>
            <td className="px-2 py-1.5 border border-gray-300 text-xs text-right font-mono">{fmt(totals.mainComm)}</td>
            <td colSpan={3} className="px-2 py-1.5 border border-gray-300 text-xs"></td>
            <td className="px-2 py-1.5 border border-gray-300 text-xs text-right font-mono">{fmt(totals.subComm)}</td>
            <td className="px-2 py-1.5 border border-gray-300 text-xs text-right font-mono">{fmt(totals.bonus)}</td>
            <td className="px-2 py-1.5 border border-gray-300 text-xs"></td>
            <td className="px-2 py-1.5 border border-gray-300 text-xs text-right font-mono">{fmt(totals.gst)}</td>
            <td className="px-2 py-1.5 border border-gray-300 text-xs text-right font-mono font-bold">{fmt(totals.totalPaid)}</td>
            <td colSpan={3} className="px-2 py-1.5 border border-gray-300 text-xs"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
