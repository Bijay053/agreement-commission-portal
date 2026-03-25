import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MultiSearchableSelect } from "@/components/ui/multi-searchable-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Search, Users, DollarSign, TrendingUp, AlertCircle,
  RefreshCw, ArrowDownUp, AlertTriangle, CalendarDays, ExternalLink, Sparkles
} from "lucide-react";
import { ScrollableTableWrapper } from "@/components/ui/scrollable-table-wrapper";
import type { CommissionStudent, SubAgentEntry, SubAgentTermEntry } from "@shared/schema";
import { intakeSortKey } from "@shared/intake-utils";

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
  const [pendingValue, setPendingValue] = useState<string | null>(null);
  const [displayValue, setDisplayValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const cellRef = useRef<HTMLTableCellElement>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  useEffect(() => {
    setDisplayValue(value);
    if (!editing && pendingValue === null) {
      setDraft(value);
    }
  }, [value, editing, pendingValue]);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  const saveScrollPosition = useCallback(() => {
    const el = cellRef.current;
    if (!el) return null;
    let scrollParent: HTMLElement | null = el.parentElement;
    while (scrollParent) {
      const ov = getComputedStyle(scrollParent).overflowY;
      if (ov === "auto" || ov === "scroll") break;
      scrollParent = scrollParent.parentElement;
    }
    if (scrollParent) {
      const top = scrollParent.scrollTop;
      const left = scrollParent.scrollLeft;
      return { el: scrollParent, top, left };
    }
    return null;
  }, []);

  const restoreScrollPosition = useCallback((saved: { el: HTMLElement; top: number; left: number } | null) => {
    if (!saved) return;
    const restore = () => { saved.el.scrollTop = saved.top; saved.el.scrollLeft = saved.left; };
    restore();
    requestAnimationFrame(restore);
    setTimeout(restore, 50);
    setTimeout(restore, 150);
  }, []);

  const handleConfirmSave = useCallback(() => {
    const scrollState = saveScrollPosition();
    if (pendingValue !== null) {
      onSaveRef.current(pendingValue);
      setDisplayValue(pendingValue);
      setDraft(pendingValue);
    }
    setPendingValue(null);
    setEditing(false);
    restoreScrollPosition(scrollState);
    setTimeout(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); }, 0);
  }, [pendingValue, saveScrollPosition, restoreScrollPosition]);

  const handleCancelEdit = useCallback(() => {
    setPendingValue(null);
    setDraft(value);
    setEditing(false);
  }, [value]);

  const commitEdit = useCallback(() => {
    const currentDraft = draftRef.current;
    setEditing(false);
    if (currentDraft !== value) {
      setPendingValue(currentDraft);
    }
    setTimeout(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); }, 0);
  }, [value]);

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
            onChange={(e) => {
              const newVal = e.target.value;
              setDraft(newVal);
              if (newVal !== value) { setPendingValue(newVal); }
              setEditing(false);
            }}
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
          type={type === "number" ? "text" : "text"}
          inputMode={type === "number" ? "decimal" : undefined}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commitEdit()}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
            if (e.key === "Escape") { setDraft(value); setEditing(false); }
          }}
          data-testid="cell-input"
        />
      </td>
    );
  }

  return (
    <td
      ref={cellRef}
      className={`px-2 py-1 border border-gray-200 dark:border-gray-700 text-xs whitespace-nowrap cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 ${align === "right" ? "text-right" : "text-left"} ${mono ? "font-mono" : ""}`}
      style={style}
      onClick={() => { if (pendingValue === null) { setDraft(value); setEditing(true); } }}
      data-testid="cell-editable"
    >
      {displayValue || "-"}
      <Dialog open={pendingValue !== null} onOpenChange={(open) => { if (!open) handleCancelEdit(); }}>
        <DialogContent className="sm:max-w-[420px]" onClick={(e) => e.stopPropagation()} data-testid="dialog-confirm-edit">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30">
                <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <DialogTitle className="text-lg">Do you want to save this change?</DialogTitle>
            </div>
            <DialogDescription>
              Change value from "{value || "(empty)"}" to "{pendingValue || "(empty)"}".
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleCancelEdit} data-testid="button-cancel-edit">Cancel</Button>
            <Button onClick={handleConfirmSave} data-testid="button-confirm-save">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </td>
  );
}

function fmt(v: string | number | null | undefined): string {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return "-";
  return n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function SubAgentProviderLink({ name, agreementId }: { name: string; agreementId?: number }) {
  const [, navigate] = useLocation();
  if (agreementId) {
    return (
      <button
        className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer text-left"
        onClick={(e) => { e.stopPropagation(); navigate(`/agreements/${agreementId}`); }}
        data-testid={`link-provider-agreement-${agreementId}`}
      >
        {name}
      </button>
    );
  }
  return <span>{name}</span>;
}

export default function SubAgentCommissionPage() {
  const { user, hasPermission } = useAuth();
  const { toast } = useToast();
  const canEdit = hasPermission("sub_agent_commission.edit");

  const [, navigate] = useLocation();
  const searchString = useSearch();
  const urlTab = new URLSearchParams(searchString).get("tab")?.toUpperCase() || "DASHBOARD";
  const [activeTab, setActiveTabState] = useState(urlTab);
  useEffect(() => { setActiveTabState(urlTab); }, [urlTab]);
  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    const params = new URLSearchParams(searchString);
    params.set("tab", tab.toLowerCase());
    navigate(`/sub-agent-commission?${params.toString()}`, { replace: true });
  };
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedIntake, setSelectedIntake] = useState("All");
  const [search, setSearch] = useState("");
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const savedScrollRef = useRef<{ top: number; left: number } | null>(null);

  const saveScrollPos = useCallback(() => {
    const el = scrollContainerRef.current?.querySelector('[class*="overflow-auto"]') as HTMLElement | null;
    if (el) savedScrollRef.current = { top: el.scrollTop, left: el.scrollLeft };
  }, []);

  const restoreScrollPos = useCallback(() => {
    const el = scrollContainerRef.current?.querySelector('[class*="overflow-auto"]') as HTMLElement | null;
    const saved = savedScrollRef.current;
    if (el && saved) {
      const restore = () => { el.scrollTop = saved.top; el.scrollLeft = saved.left; };
      restore();
      requestAnimationFrame(restore);
      setTimeout(restore, 50);
      setTimeout(restore, 200);
    }
  }, []);

  const { data: providerAgreementsMap = {} } = useQuery<Record<string, number>>({
    queryKey: ["/api/commission-tracker/provider-agreements-map"],
  });

  const termsQuery = useQuery<CommissionTerm[]>({ queryKey: ["/api/commission-tracker/terms"] });
  const terms = (termsQuery.data || []).filter(t => t.year === selectedYear).sort((a, b) => a.sortOrder - b.sortOrder);
  const years = [...new Set([...(termsQuery.data || []).map(t => t.year), new Date().getFullYear()])].sort((a, b) => b - a);

  const dashboardQuery = useQuery({
    queryKey: ["/api/sub-agent-commission/dashboard", selectedYear, selectedIntake],
    queryFn: async () => {
      const params = new URLSearchParams({ year: String(selectedYear) });
      if (selectedIntake && selectedIntake !== "All") params.set("intake", selectedIntake);
      const res = await fetch(`/api/sub-agent-commission/dashboard?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch dashboard");
      return res.json();
    },
    enabled: activeTab === "DASHBOARD",
  });

  const { data: predictionData } = useQuery<any>({
    queryKey: ["/api/sub-agent-commission/prediction", selectedYear],
    queryFn: async () => {
      const res = await fetch(`/api/sub-agent-commission/prediction/${selectedYear}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const applyFilters = useCallback(<T extends { student: any; status?: string; studentStatus?: string }>(rows: T[]): T[] => {
    let filtered = rows;
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(r => {
        const s = r.student;
        return (s.studentName || "").toLowerCase().includes(q) ||
          (s.agentName || "").toLowerCase().includes(q) ||
          (s.agentsicId || "").toLowerCase().includes(q) ||
          (s.provider || "").toLowerCase().includes(q) ||
          (s.courseName || "").toLowerCase().includes(q);
      });
    }
    if (selectedAgents.length) {
      filtered = filtered.filter(r => selectedAgents.includes(r.student.agentName));
    }
    if (selectedProviders.length) {
      filtered = filtered.filter(r => selectedProviders.includes(r.student.provider));
    }
    if (selectedStatuses.length) {
      filtered = filtered.filter(r => {
        const st = (r as any).studentStatus || (r as any).status || r.student.status || "Under Enquiry";
        return selectedStatuses.includes(st);
      });
    }
    return filtered;
  }, [search, selectedAgents, selectedProviders, selectedStatuses]);

  const masterQuery = useQuery<MasterRow[]>({
    queryKey: ["/api/sub-agent-commission/master"],
    queryFn: async () => {
      const res = await fetch("/api/sub-agent-commission/master", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: activeTab === "MASTER",
  });

  const termEntryQuery = useQuery<TermRow[]>({
    queryKey: ["/api/sub-agent-commission/terms", activeTab],
    queryFn: async () => {
      const res = await fetch(`/api/sub-agent-commission/terms/${activeTab}`, { credentials: "include" });
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
      saveScrollPos();
      const res = await apiRequest("PUT", `/api/sub-agent-commission/master/${studentId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sub-agent-commission/master"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sub-agent-commission/terms"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sub-agent-commission/dashboard"] });
      restoreScrollPos();
    },
    onError: (err: any) => {
      toast({ title: "Update Failed", description: err.message, variant: "destructive" });
    },
  });

  const updateTermEntryMutation = useMutation({
    mutationFn: async ({ termName, id, data }: { termName: string; id: number; data: any }) => {
      saveScrollPos();
      const res = await apiRequest("PUT", `/api/sub-agent-commission/terms/${termName}/entries/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sub-agent-commission/master"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sub-agent-commission/terms"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sub-agent-commission/dashboard"] });
      restoreScrollPos();
    },
    onError: (err: any) => {
      toast({ title: "Update Failed", description: err.message, variant: "destructive" });
    },
  });

  const stableSort = <T extends { id: number; student: any }>(rows: T[]): T[] => {
    return [...rows].sort((a, b) => {
      const keyA = intakeSortKey(a.student.startIntake);
      const keyB = intakeSortKey(b.student.startIntake);
      if (keyB !== keyA) return keyB - keyA;
      const agentCmp = (a.student.agentName || "").localeCompare(b.student.agentName || "");
      if (agentCmp !== 0) return agentCmp;
      const nameCmp = (a.student.studentName || "").localeCompare(b.student.studentName || "");
      if (nameCmp !== 0) return nameCmp;
      return a.id - b.id;
    });
  };

  const allMasterRows = useMemo(() => {
    const rows = (masterQuery.data || []).filter((r: any) => r && r.student);
    return stableSort(rows);
  }, [masterQuery.data]);

  const allTermRows = useMemo(() => {
    const rows = (termEntryQuery.data || []).filter((r: any) => r && r.student);
    return stableSort(rows);
  }, [termEntryQuery.data]);

  const allAgents = useMemo(() => {
    const masterAgents = allMasterRows.map(r => r.student.agentName);
    const termAgents = allTermRows.map(r => r.student.agentName);
    return [...new Set([...masterAgents, ...termAgents])].filter(Boolean).sort();
  }, [allMasterRows, allTermRows]);

  const allProviders = useMemo(() => {
    const masterProviders = allMasterRows.map(r => r.student.provider);
    const termProviders = allTermRows.map(r => r.student.provider);
    return [...new Set([...masterProviders, ...termProviders])].filter(Boolean).sort();
  }, [allMasterRows, allTermRows]);

  const filteredMasterRows = useMemo(() => applyFilters(allMasterRows), [allMasterRows, applyFilters]);
  const filteredTermRows = useMemo(() => applyFilters(allTermRows), [allTermRows, applyFilters]);

  const isLoading = activeTab === "DASHBOARD" ? dashboardQuery.isLoading
    : activeTab === "MASTER" ? masterQuery.isLoading
    : termEntryQuery.isLoading;

  return (
    <div className="flex flex-col h-full" data-testid="sub-agent-commission-page">
      <div className="flex items-center justify-between p-4 border-b bg-background">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold" data-testid="text-page-title">Sub-Agent Commission</h1>
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))} data-testid="select-year">
            <SelectTrigger className="w-[130px] h-9" data-testid="select-year-trigger">
              <CalendarDays className="h-4 w-4 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {years.map(y => (
                <SelectItem key={y} value={String(y)} data-testid={`select-year-${y}`}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            {["All", "T1", "T2", "T3"].map(i => (
              <Button
                key={i}
                variant={selectedIntake === i ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedIntake(i)}
                data-testid={`button-intake-${i}`}
              >
                {i}
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

      {activeTab !== "DASHBOARD" && (
        <div className="px-4 py-2.5 border-b bg-muted/20">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-[220px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search student, agent, ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs border-gray-300 dark:border-gray-600 rounded-md"
                data-testid="input-search"
              />
            </div>
            <div className="flex-1 max-w-[200px]">
              <MultiSearchableSelect
                options={allAgents.map(a => ({ value: a, label: a }))}
                values={selectedAgents}
                onValuesChange={setSelectedAgents}
                placeholder="All Agents"
                data-testid="filter-agents"
              />
            </div>
            <div className="flex-1 max-w-[200px]">
              <MultiSearchableSelect
                options={allProviders.map(p => ({ value: p, label: p }))}
                values={selectedProviders}
                onValuesChange={setSelectedProviders}
                placeholder="All Providers"
                data-testid="filter-providers"
              />
            </div>
            <div className="flex-1 max-w-[180px]">
              <MultiSearchableSelect
                options={STUDENT_STATUSES.map(s => ({ value: s, label: s }))}
                values={selectedStatuses}
                onValuesChange={setSelectedStatuses}
                placeholder="All Statuses"
                data-testid="filter-statuses"
              />
            </div>
            {(search || selectedAgents.length > 0 || selectedProviders.length > 0 || selectedStatuses.length > 0) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => { setSearch(""); setSelectedAgents([]); setSelectedProviders([]); setSelectedStatuses([]); }}
                data-testid="button-clear-filters"
              >
                Clear filters
              </Button>
            )}
            {(search || selectedAgents.length > 0 || selectedProviders.length > 0 || selectedStatuses.length > 0) && (
              <span className="text-xs text-muted-foreground whitespace-nowrap" data-testid="text-filter-count">
                {activeTab === "MASTER" ? filteredMasterRows.length : filteredTermRows.length} of{" "}
                {activeTab === "MASTER" ? allMasterRows.length : allTermRows.length} shown
              </span>
            )}
          </div>
        </div>
      )}

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

        <div ref={scrollContainerRef} className={`flex-1 min-h-0 p-4 ${activeTab === "DASHBOARD" ? "overflow-auto" : "flex flex-col"}`}>
          {isLoading ? (
            <div className="space-y-2 overflow-auto">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : activeTab === "DASHBOARD" ? (
            <DashboardView data={dashboardQuery.data} prediction={predictionData?.prediction} year={selectedYear} />
          ) : activeTab === "MASTER" ? (
            <MasterTable
              rows={filteredMasterRows}
              canEdit={canEdit}
              providerAgreementsMap={providerAgreementsMap}
              onUpdateRate={(studentId, rate) => updateMasterMutation.mutate({ studentId, data: { subAgentCommissionRatePct: rate } })}
              onUpdateGst={(studentId, gst) => updateMasterMutation.mutate({ studentId, data: { gstApplicable: gst } })}
            />
          ) : (
            <TermTable
              rows={filteredTermRows}
              termName={activeTab}
              canEdit={canEdit}
              providerAgreementsMap={providerAgreementsMap}
              onUpdate={(id, data) => updateTermEntryMutation.mutate({ termName: activeTab, id, data })}
            />
          )}
        </div>
      </Tabs>
    </div>
  );
}

function DashboardView({ data, prediction, year }: { data: any; prediction?: any; year: number }) {
  if (!data) return <div className="text-center text-muted-foreground py-8" data-testid="text-no-data">No data available. Click "Sync from Main" first.</div>;

  return (
    <div className="space-y-6" data-testid="dashboard-view">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card data-testid="card-total-agents">
          <CardContent className="p-3">
            <div className="flex items-start gap-2 min-w-0">
              <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 shrink-0">
                <Users className="h-4 w-4 text-indigo-600" />
              </div>
              <div className="min-w-0 overflow-hidden">
                <p className="text-[10px] text-muted-foreground">Total Agents</p>
                <p className="text-sm font-bold truncate" data-testid="text-total-agents">{data.totalAgents ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-total-students">
          <CardContent className="p-3">
            <div className="flex items-start gap-2 min-w-0">
              <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 shrink-0">
                <Users className="h-4 w-4 text-blue-600" />
              </div>
              <div className="min-w-0 overflow-hidden">
                <p className="text-[10px] text-muted-foreground">Total Students</p>
                <p className="text-sm font-bold truncate" data-testid="text-total-students">{data.totalStudents}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-total-paid">
          <CardContent className="p-3">
            <div className="flex items-start gap-2 min-w-0">
              <div className="p-1.5 rounded-lg bg-green-100 dark:bg-green-900/30 shrink-0">
                <DollarSign className="h-4 w-4 text-green-600" />
              </div>
              <div className="min-w-0 overflow-hidden">
                <p className="text-[10px] text-muted-foreground">Total Paid to Sub-Agents</p>
                <p className="text-sm font-bold truncate" title={`$${fmt(data.totalPaid)}`} data-testid="text-total-paid">${fmt(data.totalPaid)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-total-pending">
          <CardContent className="p-3">
            <div className="flex items-start gap-2 min-w-0">
              <div className="p-1.5 rounded-lg bg-orange-100 dark:bg-orange-900/30 shrink-0">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
              </div>
              <div className="min-w-0 overflow-hidden">
                <p className="text-[10px] text-muted-foreground">Total Pending</p>
                <p className="text-sm font-bold truncate" title={`$${fmt(data.totalPending ?? 0)}`} data-testid="text-total-pending">${fmt(data.totalPending ?? 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-total-margin">
          <CardContent className="p-3">
            <div className="flex items-start gap-2 min-w-0">
              <div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-900/30 shrink-0">
                <TrendingUp className="h-4 w-4 text-purple-600" />
              </div>
              <div className="min-w-0 overflow-hidden">
                <p className="text-[10px] text-muted-foreground">Total Margin</p>
                <p className="text-sm font-bold truncate" title={`$${fmt(data.totalMargin)}`} data-testid="text-total-margin">${fmt(data.totalMargin)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {prediction && (
        <Card className="border-dashed border-blue-300 bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-blue-950/20 dark:to-purple-950/20" data-testid="card-sa-prediction">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-blue-500" />
              <h3 className="text-sm font-semibold">Predicted Sub-Agent Payable - {year}</h3>
              <span className="text-[10px] text-muted-foreground ml-auto">Based on {prediction.basedOnYears?.join(", ")} data | By university &amp; course</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
              <div className="bg-white dark:bg-gray-900 rounded-lg p-3 border">
                <p className="text-[10px] text-muted-foreground">Predicted Total Payable</p>
                <p className="text-base font-bold text-blue-600" data-testid="text-sa-predicted-total">
                  ${Number(prediction.totalPredictedPaid || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-lg p-3 border">
                <p className="text-[10px] text-muted-foreground">Current Actual Paid</p>
                <p className="text-base font-bold text-green-600" data-testid="text-sa-actual-paid">
                  ${Number(prediction.totalActualPaid || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-lg p-3 border">
                <p className="text-[10px] text-muted-foreground">Students Analyzed</p>
                <p className="text-base font-bold" data-testid="text-sa-predicted-students">{prediction.studentCount || 0}</p>
              </div>
            </div>

            {prediction.terms && prediction.terms.length > 0 && (
              <div className="mb-3">
                <h4 className="text-xs font-medium text-muted-foreground mb-2">Term-wise Prediction</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {prediction.terms.map((t: any) => (
                    <div key={t.termNumber} className="bg-white dark:bg-gray-900 rounded-lg p-2.5 border">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold">{t.termLabel || t.termName}</span>
                        <Badge className={`text-[9px] px-1.5 py-0 ${t.source === 'actual' ? 'bg-green-100 text-green-700' : t.source === 'mixed' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                          {t.source === 'actual' ? 'Actual' : t.source === 'mixed' ? 'Mixed' : 'Predicted'}
                        </Badge>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Payable:</span>
                        <span className="font-mono font-bold text-blue-600">${Number(t.predictedPaid || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {t.studentCount} students
                        {t.actualStudents > 0 && t.predictedStudents > 0 && (
                          <span className="ml-1">({t.actualStudents} actual, {t.predictedStudents} predicted)</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {prediction.byProvider && prediction.byProvider.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-1.5">Prediction by University</h4>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {prediction.byProvider.map((p: any) => (
                      <div key={p.provider} className="text-xs bg-white dark:bg-gray-900 rounded px-2 py-1.5 border">
                        <div className="flex items-center justify-between">
                          <span className="truncate max-w-[140px] font-medium">{p.provider}</span>
                          <span className="font-mono font-bold text-blue-600">${Number(p.totalExpected || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex gap-3 text-[10px] text-muted-foreground mt-0.5">
                          {p.actualPaid > 0 && <span className="text-green-600">Actual: ${Number(p.actualPaid).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
                          {p.predictedPaid > 0 && <span className="text-blue-600">Predicted: ${Number(p.predictedPaid).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
                          {p.predictedStudents > 0 && <span>{p.predictedStudents} predicted students</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {prediction.byCourse && prediction.byCourse.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-1.5">Prediction by Course</h4>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {prediction.byCourse.map((c: any) => (
                      <div key={c.course} className="text-xs bg-white dark:bg-gray-900 rounded px-2 py-1.5 border">
                        <div className="flex items-center justify-between">
                          <span className="truncate max-w-[140px] font-medium">{c.course}</span>
                          <span className="font-mono font-bold text-blue-600">${Number(c.totalExpected || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex gap-3 text-[10px] text-muted-foreground mt-0.5">
                          {c.actualPaid > 0 && <span className="text-green-600">Actual: ${Number(c.actualPaid).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
                          {c.predictedPaid > 0 && <span className="text-blue-600">Predicted: ${Number(c.predictedPaid).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
                          {c.predictedStudents > 0 && <span>{c.predictedStudents} predicted students</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {(prediction.byCountry?.length > 0 || prediction.byStudyLevel?.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                {prediction.byCountry && prediction.byCountry.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-1.5">Prediction by Country</h4>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {prediction.byCountry.map((c: any) => (
                        <div key={c.country} className="text-xs bg-white dark:bg-gray-900 rounded px-2 py-1.5 border">
                          <div className="flex items-center justify-between">
                            <span className="truncate max-w-[140px] font-medium">{c.country}</span>
                            <span className="font-mono font-bold text-blue-600">${Number(c.totalExpected || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex gap-3 text-[10px] text-muted-foreground mt-0.5">
                            {c.actualPaid > 0 && <span className="text-green-600">Actual: ${Number(c.actualPaid).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
                            {c.predictedPaid > 0 && <span className="text-blue-600">Predicted: ${Number(c.predictedPaid).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
                            {c.predictedStudents > 0 && <span>{c.predictedStudents} predicted students</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {prediction.byStudyLevel && prediction.byStudyLevel.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-1.5">Prediction by Study Level</h4>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {prediction.byStudyLevel.map((l: any) => (
                        <div key={l.studyLevel} className="text-xs bg-white dark:bg-gray-900 rounded px-2 py-1.5 border">
                          <div className="flex items-center justify-between">
                            <span className="truncate max-w-[140px] font-medium">{l.studyLevel}</span>
                            <span className="font-mono font-bold text-blue-600">${Number(l.totalExpected || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex gap-3 text-[10px] text-muted-foreground mt-0.5">
                            {l.actualPaid > 0 && <span className="text-green-600">Actual: ${Number(l.actualPaid).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
                            {l.predictedPaid > 0 && <span className="text-blue-600">Predicted: ${Number(l.predictedPaid).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
                            {l.predictedStudents > 0 && <span>{l.predictedStudents} predicted students</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {prediction.histByProvider && prediction.histByProvider.length > 0 && (
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-1.5">Historical Avg by University</h4>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {prediction.histByProvider.map((p: any) => (
                      <div key={p.provider} className="flex items-center justify-between text-xs bg-white dark:bg-gray-900 rounded px-2 py-1 border">
                        <span className="truncate max-w-[140px]">{p.provider}</span>
                        <div className="flex gap-3 text-[10px]">
                          <span className="text-muted-foreground">{p.entries} entries</span>
                          <span className="font-mono">Avg: ${Number(p.avgPaid || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {prediction.histByCourse && prediction.histByCourse.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-1.5">Historical Avg by Course</h4>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {prediction.histByCourse.map((c: any) => (
                        <div key={c.course} className="flex items-center justify-between text-xs bg-white dark:bg-gray-900 rounded px-2 py-1 border">
                          <span className="truncate max-w-[140px]">{c.course}</span>
                          <div className="flex gap-3 text-[10px]">
                            <span className="text-muted-foreground">{c.entries} entries</span>
                            <span className="font-mono">Avg: ${Number(c.avgPaid || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {(prediction.histByCountry?.length > 0 || prediction.histByStudyLevel?.length > 0) && (
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                {prediction.histByCountry && prediction.histByCountry.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-1.5">Historical Avg by Country</h4>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {prediction.histByCountry.map((c: any) => (
                        <div key={c.country} className="flex items-center justify-between text-xs bg-white dark:bg-gray-900 rounded px-2 py-1 border">
                          <span className="truncate max-w-[140px]">{c.country}</span>
                          <div className="flex gap-3 text-[10px]">
                            <span className="text-muted-foreground">{c.entries} entries</span>
                            <span className="font-mono">Avg: ${Number(c.avgPaid || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {prediction.histByStudyLevel && prediction.histByStudyLevel.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-1.5">Historical Avg by Study Level</h4>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {prediction.histByStudyLevel.map((l: any) => (
                        <div key={l.studyLevel} className="flex items-center justify-between text-xs bg-white dark:bg-gray-900 rounded px-2 py-1 border">
                          <span className="truncate max-w-[140px]">{l.studyLevel}</span>
                          <div className="flex gap-3 text-[10px]">
                            <span className="text-muted-foreground">{l.entries} entries</span>
                            <span className="font-mono">Avg: ${Number(l.avgPaid || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card data-testid="card-agent-breakdown">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3">Agent-wise Summary</h3>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-1.5 font-medium">Agent</th>
                    <th className="text-right py-1.5 font-medium">Students</th>
                    <th className="text-right py-1.5 font-medium">Commission Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.byAgent || []).map((a: any) => (
                    <tr key={a.agent} className="border-b last:border-0" data-testid={`row-agent-${a.agent}`}>
                      <td className="py-1.5 truncate max-w-[180px]">{a.agent}</td>
                      <td className="py-1.5 text-right font-mono">{a.count}</td>
                      <td className="py-1.5 text-right font-mono">${fmt(a.totalPaid)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

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
      </div>
    </div>
  );
}

function MasterTable({ rows, canEdit, onUpdateRate, onUpdateGst, providerAgreementsMap }: {
  rows: MasterRow[];
  canEdit: boolean;
  onUpdateRate: (studentId: number, rate: string) => void;
  onUpdateGst: (studentId: number, gst: string) => void;
  providerAgreementsMap: Record<string, number>;
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
    <ScrollableTableWrapper data-testid="master-table">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-[#1F4E79] text-white sticky top-0 z-10">
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
                <td className="px-2 py-1 border border-gray-200 text-xs">{row.student.provider ? <SubAgentProviderLink name={row.student.provider} agreementId={providerAgreementsMap[row.student.provider]} /> : "-"}</td>
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
    </ScrollableTableWrapper>
  );
}

function TermTable({ rows, termName, canEdit, onUpdate, providerAgreementsMap }: {
  rows: TermRow[];
  termName: string;
  canEdit: boolean;
  onUpdate: (id: number, data: any) => void;
  providerAgreementsMap: Record<string, number>;
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
    <ScrollableTableWrapper data-testid="term-table">
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
                <td className="px-2 py-1 border border-gray-200 text-xs">{row.student.provider ? <SubAgentProviderLink name={row.student.provider} agreementId={providerAgreementsMap[row.student.provider]} /> : "-"}</td>
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
                        <TooltipContent>Rate overridden</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  {row.exceedsMainWarning && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger><span className="text-red-600 ml-1">❌</span></TooltipTrigger>
                        <TooltipContent>Exceeds Main Commission</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-gray-100 dark:bg-gray-800 font-semibold sticky bottom-0 z-10">
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
    </ScrollableTableWrapper>
  );
}
