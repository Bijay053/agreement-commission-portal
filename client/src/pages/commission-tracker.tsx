import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSearchableSelect } from "@/components/ui/multi-searchable-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Plus, Search, Trash2, Users, DollarSign, TrendingUp, AlertCircle,
  Settings, X, Upload, Download, Clock, CheckCircle2, FileSpreadsheet, AlertTriangle, RotateCcw
} from "lucide-react";
import type { CommissionStudent, CommissionEntry } from "@shared/schema";

type CommissionTerm = { id: number; termName: string; termLabel: string; year: number; termNumber: number; sortOrder: number; isActive: boolean };

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

const STUDENT_STATUSES = ["Under Enquiry", "Claim Next Semester", "On Break", "Withdrawn", "Complete", "Active"];
const PAYMENT_STATUSES = ["Pending", "Received", "Reversed", "Hold"];
const ACADEMIC_YEARS = ["Year 1", "Year 2", "Year 3", "Year 4"];
const COURSE_LEVELS = ["Diploma", "Diploma Leading Bachelor", "Bachelor", "Master", "Eap leading Master", "EAP leading Bachelor", "EAP + Bachelor of IT", "PhD", "Certificate", "MBA", "MPA", "BIT", "Other"];

function EditableCell({ value, onSave, type = "text", options, readOnly, width, align, mono }: {
  value: string;
  onSave: (v: string) => void;
  type?: "text" | "number" | "select" | "date";
  options?: string[];
  readOnly?: boolean;
  width?: string;
  align?: string;
  mono?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  if (readOnly) {
    return (
      <td className={`px-2 py-1 border border-gray-200 dark:border-gray-700 text-xs whitespace-nowrap ${align === "right" ? "text-right" : "text-left"} ${mono ? "font-mono" : ""}`} style={{ minWidth: width || "auto" }}>
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
            <option value="">-</option>
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
          type={type === "number" ? "number" : type === "date" ? "date" : "text"}
          step={type === "number" ? "0.01" : undefined}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => { onSave(draft); setEditing(false); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") { onSave(draft); setEditing(false); }
            if (e.key === "Escape") { setDraft(value); setEditing(false); }
          }}
          data-testid="cell-input"
        />
      </td>
    );
  }

  return (
    <td
      className={`px-2 py-1 border border-gray-200 dark:border-gray-700 text-xs whitespace-nowrap cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 ${align === "right" ? "text-right" : "text-left"} ${mono ? "font-mono" : ""}`}
      style={{ minWidth: width || "auto" }}
      onClick={() => { setDraft(value); setEditing(true); }}
      data-testid="cell-editable"
    >
      {value || <span className="text-gray-400">-</span>}
    </td>
  );
}

export default function CommissionTrackerPage() {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("DASHBOARD");
  const [search, setSearch] = useState("");
  const [agentFilters, setAgentFilters] = useState<string[]>([]);
  const [providerFilters, setProviderFilters] = useState<string[]>([]);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showTermDialog, setShowTermDialog] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);

  const canCreate = hasPermission("commission_tracker.create");
  const canEdit = hasPermission("commission_tracker.edit");
  const canDelete = hasPermission("commission_tracker.delete");
  const canDeleteMaster = hasPermission("commission_tracker.student.delete_master");

  const { data: years = [] } = useQuery<number[]>({
    queryKey: ["/api/commission-tracker/years"],
  });

  useEffect(() => {
    if (years.length > 0 && selectedYear === null) {
      setSelectedYear(years[years.length - 1]);
    }
  }, [years, selectedYear]);

  const { data: terms = [] } = useQuery<CommissionTerm[]>({
    queryKey: ["/api/commission-tracker/terms"],
  });

  const yearTerms = terms.filter(t => t.year === selectedYear);

  const { data: students, isLoading } = useQuery<CommissionStudent[]>({
    queryKey: ["/api/commission-tracker/students", { search, agents: agentFilters, providers: providerFilters, statuses: statusFilters }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (agentFilters.length) params.set("agent", agentFilters.join(","));
      if (providerFilters.length) params.set("provider", providerFilters.join(","));
      if (statusFilters.length) params.set("status", statusFilters.join(","));
      const res = await fetch(`/api/commission-tracker/students?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: allStudentProviders = [] } = useQuery<any[]>({
    queryKey: ["/api/commission-tracker/all-student-providers"],
  });

  const providersByStudent = allStudentProviders.reduce((acc: Record<number, any[]>, p: any) => {
    if (!acc[p.commissionStudentId]) acc[p.commissionStudentId] = [];
    acc[p.commissionStudentId].push(p);
    return acc;
  }, {} as Record<number, any[]>);

  const { data: allEntries = {} } = useQuery<Record<number, CommissionEntry[]>>({
    queryKey: ["/api/commission-tracker/all-entries", selectedYear],
    queryFn: async () => {
      const params = selectedYear ? `?year=${selectedYear}` : "";
      const res = await fetch(`/api/commission-tracker/all-entries${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!selectedYear,
  });

  const { data: filters } = useQuery<{
    agents: string[];
    providers: string[];
    countries: string[];
    statuses: string[];
  }>({
    queryKey: ["/api/commission-tracker/filters"],
  });

  const { data: yearDashboard } = useQuery<{
    totalStudents: number;
    totalCommission: number;
    totalReceived: number;
    activeCount: number;
    pendingPayments: number;
    paidPayments: number;
    byStatus: Record<string, number>;
  }>({
    queryKey: ["/api/commission-tracker/dashboard", selectedYear],
    queryFn: async () => {
      const res = await fetch(`/api/commission-tracker/dashboard/${selectedYear}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!selectedYear,
  });

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/commission-tracker/students"] });
    queryClient.invalidateQueries({ queryKey: ["/api/commission-tracker/all-entries"] });
    queryClient.invalidateQueries({ queryKey: ["/api/commission-tracker/dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["/api/commission-tracker/filters"] });
    queryClient.invalidateQueries({ queryKey: ["/api/commission-tracker/years"] });
    queryClient.invalidateQueries({ queryKey: ["/api/commission-tracker/terms"] });
  }, []);

  const updateStudentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, any> }) => {
      const res = await apiRequest("PATCH", `/api/commission-tracker/students/${id}`, data);
      return res.json();
    },
    onSuccess: invalidateAll,
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteStudentMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/commission-tracker/students/${id}`);
    },
    onSuccess: () => { invalidateAll(); toast({ title: "Student deleted" }); },
  });

  const removeProviderMutation = useMutation({
    mutationFn: async ({ studentId, providerId }: { studentId: number; providerId: number }) => {
      await apiRequest("DELETE", `/api/commission-tracker/students/${studentId}/providers/${providerId}`);
    },
    onSuccess: () => {
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ["/api/commission-tracker/all-student-providers"] });
      toast({ title: "Provider removed" });
    },
  });

  const createEntryMutation = useMutation({
    mutationFn: async ({ studentId, data }: { studentId: number; data: Record<string, any> }) => {
      const res = await apiRequest("POST", `/api/commission-tracker/students/${studentId}/entries`, data);
      return res.json();
    },
    onSuccess: invalidateAll,
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateEntryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, any> }) => {
      const res = await apiRequest("PATCH", `/api/commission-tracker/entries/${id}`, data);
      return res.json();
    },
    onSuccess: invalidateAll,
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteEntryMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/commission-tracker/entries/${id}`);
    },
    onSuccess: invalidateAll,
  });

  const tabs = ["DASHBOARD", ...yearTerms.map(t => t.termName)];

  useEffect(() => {
    if (activeTab !== "DASHBOARD" && !yearTerms.find(t => t.termName === activeTab)) {
      setActiveTab("DASHBOARD");
    }
  }, [selectedYear, yearTerms, activeTab]);

  return (
    <div className="flex flex-col h-full" data-testid="commission-tracker-page">
      <div className="p-3 pb-0 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-xl font-bold" data-testid="text-page-title">Commission Tracker</h1>
              <p className="text-xs text-muted-foreground">Track student commissions across intakes</p>
            </div>
            <div className="flex items-center gap-1.5 ml-4">
              <Label className="text-xs font-medium text-muted-foreground">Year:</Label>
              <Select value={selectedYear ? String(selectedYear) : ""} onValueChange={(v) => { setSelectedYear(Number(v)); setActiveTab("DASHBOARD"); }}>
                <SelectTrigger className="w-24 h-8 text-sm font-semibold" data-testid="select-year">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {canCreate && (
              <Button variant="outline" size="sm" onClick={() => window.open("/api/commission-tracker/sample-sheet", "_blank")} data-testid="button-download-sample">
                <Download className="w-3.5 h-3.5 mr-1" />
                Sample Sheet
              </Button>
            )}
            {canCreate && (
              <Dialog open={showBulkUpload} onOpenChange={setShowBulkUpload}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="button-bulk-upload">
                    <Upload className="w-3.5 h-3.5 mr-1" />
                    Bulk Upload
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Bulk Upload Students</DialogTitle>
                    <DialogDescription>Upload a CSV file to import multiple students at once</DialogDescription>
                  </DialogHeader>
                  <BulkUploadDialog onSuccess={() => { setShowBulkUpload(false); invalidateAll(); }} />
                </DialogContent>
              </Dialog>
            )}
            {canCreate && (
              <Dialog open={showTermDialog} onOpenChange={setShowTermDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="button-manage-terms">
                    <Settings className="w-3.5 h-3.5 mr-1" />
                    Manage Terms
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Manage Terms</DialogTitle>
                    <DialogDescription>Add or remove commission tracking terms</DialogDescription>
                  </DialogHeader>
                  <ManageTermsDialog terms={terms} onClose={() => setShowTermDialog(false)} />
                </DialogContent>
              </Dialog>
            )}
            {canCreate && (
              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="button-add-student">
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Add Student
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add Student</DialogTitle>
                    <DialogDescription>Add a new student enrolment to the commission tracker</DialogDescription>
                  </DialogHeader>
                  <AddStudentForm onSuccess={() => { setShowAddDialog(false); invalidateAll(); }} />
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by name, student ID, agent, Agentsic ID..."
                className="pl-8 h-8 text-xs"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-search"
              />
            </div>
            <MultiSearchableSelect values={agentFilters} onValuesChange={setAgentFilters} options={(filters?.agents || []).map(a => ({ value: a, label: a }))} placeholder="All Agents" searchPlaceholder="Search agents..." className="w-[160px] h-8 text-xs" data-testid="select-agent" />
            <MultiSearchableSelect values={providerFilters} onValuesChange={setProviderFilters} options={(filters?.providers || []).map(p => ({ value: p, label: p }))} placeholder="All Providers" searchPlaceholder="Search providers..." className="w-[160px] h-8 text-xs" data-testid="select-provider" />
            <MultiSearchableSelect values={statusFilters} onValuesChange={setStatusFilters} options={(filters?.statuses || []).map(s => ({ value: s, label: s }))} placeholder="All Statuses" searchPlaceholder="Search statuses..." className="w-[140px] h-8 text-xs" data-testid="select-status" />
            {(search || agentFilters.length > 0 || providerFilters.length > 0 || statusFilters.length > 0) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => { setSearch(""); setAgentFilters([]); setProviderFilters([]); setStatusFilters([]); }}
                data-testid="button-reset-filters"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                Reset
              </Button>
            )}
          </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-1">
          <TabsList data-testid="tabs-bar" className="w-auto">
            {tabs.map(tab => (
              <TabsTrigger key={tab} value={tab} data-testid={`tab-${tab}`}>
                {tab === "DASHBOARD" ? `Dashboard ${selectedYear || ""}` : terms.find(t => t.termName === tab)?.termLabel || tab.replace("_", " ")}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto border-t">
          {activeTab === "DASHBOARD" ? (
            <YearDashboard
              dashboard={yearDashboard}
              year={selectedYear}
              students={students || []}
              allEntries={allEntries}
              isLoading={isLoading}
              canEdit={canEdit}
              canDeleteMaster={canDeleteMaster}
              isDeleting={deleteStudentMutation.isPending}
              providersByStudent={providersByStudent}
              onRemoveProvider={(studentId, providerId) => removeProviderMutation.mutate({ studentId, providerId })}
              onUpdateStudent={(id, data) => updateStudentMutation.mutate({ id, data })}
              onDeleteStudent={(id) => deleteStudentMutation.mutate(id)}
            />
          ) : (
            <TermTable
              termName={activeTab}
              students={students || []}
              allEntries={allEntries}
              terms={terms}
              isLoading={isLoading}
              canEdit={canEdit}
              canDelete={false}
              providersByStudent={providersByStudent}
              onUpdateStudent={(id, data) => updateStudentMutation.mutate({ id, data })}
              onDeleteStudent={() => {}}
              onCreateEntry={(studentId, data) => createEntryMutation.mutate({ studentId, data })}
              onUpdateEntry={(id, data) => updateEntryMutation.mutate({ id, data })}
              onDeleteEntry={(id) => deleteEntryMutation.mutate(id)}
            />
          )}
        </div>

        {students && (
          <div className="px-3 py-1 border-t bg-muted/20">
            <p className="text-[10px] text-muted-foreground" data-testid="text-count">
              {students.length} student{students.length !== 1 ? "s" : ""}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function AddProviderButton({ studentId, studentName }: { studentId: number; studentName: string }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState("");
  const [studentIdVal, setStudentIdVal] = useState("");

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/commission-tracker/students/${studentId}/providers`, { provider, studentId: studentIdVal });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Provider added" });
      queryClient.invalidateQueries({ queryKey: ["/api/commission-tracker/all-student-providers"] });
      setOpen(false);
      setProvider("");
      setStudentIdVal("");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="text-blue-500 hover:text-blue-700 shrink-0" title="Add another provider" data-testid={`button-add-provider-${studentId}`}>
          <Plus className="h-3 w-3" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">Add Provider for {studentName}</DialogTitle>
          <DialogDescription className="text-xs">Add another provider and student ID for this student.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Provider *</Label>
            <Input value={provider} onChange={(e) => setProvider(e.target.value)} required className="h-8 text-sm" data-testid="input-new-provider" />
          </div>
          <div>
            <Label className="text-xs">Student ID</Label>
            <Input value={studentIdVal} onChange={(e) => setStudentIdVal(e.target.value)} className="h-8 text-sm" data-testid="input-new-provider-student-id" />
          </div>
        </div>
        <DialogFooter>
          <Button size="sm" onClick={() => addMutation.mutate()} disabled={!provider.trim() || addMutation.isPending} data-testid="button-submit-new-provider">
            {addMutation.isPending ? "Adding..." : "Add Provider"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function YearDashboard({ dashboard, year, students, allEntries, isLoading, canEdit, canDeleteMaster, isDeleting, providersByStudent, onRemoveProvider, onUpdateStudent, onDeleteStudent }: {
  dashboard: any;
  year: number | null;
  students: CommissionStudent[];
  allEntries: Record<number, CommissionEntry[]>;
  isLoading: boolean;
  canEdit: boolean;
  canDeleteMaster: boolean;
  isDeleting: boolean;
  providersByStudent: Record<number, any[]>;
  onRemoveProvider: (studentId: number, providerId: number) => void;
  onUpdateStudent: (id: number, data: Record<string, any>) => void;
  onDeleteStudent: (id: number) => void;
}) {
  const [deleteTarget, setDeleteTarget] = useState<CommissionStudent | null>(null);
  if (!dashboard || !year) {
    return (
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  const cards = [
    { label: "Total Students", value: dashboard.totalStudents || 0, icon: Users, color: "text-blue-500", format: "number" },
    { label: "Total Commission", value: dashboard.totalCommission || 0, icon: DollarSign, color: "text-green-500", format: "currency" },
    { label: "Total Received", value: dashboard.totalReceived || 0, icon: TrendingUp, color: "text-emerald-500", format: "currency" },
    { label: "Active Students", value: dashboard.activeCount || 0, icon: AlertCircle, color: "text-amber-500", format: "number" },
    { label: "Pending Payments", value: dashboard.pendingPayments || 0, icon: Clock, color: "text-orange-500", format: "number" },
    { label: "Paid Payments", value: dashboard.paidPayments || 0, icon: CheckCircle2, color: "text-teal-500", format: "number" },
  ];

  const getTotalForStudent = (studentId: number) => {
    const entries = allEntries[studentId] || [];
    return entries.reduce((sum, e) => sum + Number(e.totalAmount || 0), 0);
  };

  return (
    <div className="p-4 space-y-6" data-testid="year-dashboard">
      <h2 className="text-lg font-semibold">Commission Summary - {year}</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map((c, i) => (
          <Card key={i} data-testid={`card-${c.label.toLowerCase().replace(/\s+/g, "-")}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <c.icon className={`w-5 h-5 ${c.color}`} />
                <div>
                  <p className="text-[10px] text-muted-foreground">{c.label}</p>
                  <p className="text-lg font-bold">
                    {c.format === "currency"
                      ? `$${Number(c.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : c.value}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {dashboard.byStatus && Object.keys(dashboard.byStatus).length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2">By Status</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(dashboard.byStatus).map(([status, count]) => (
              <Badge key={status} className={`${STATUS_COLORS[status] || "bg-gray-100 text-gray-800"} text-xs px-2 py-1`}>
                {status}: {count as number}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {dashboard.byAgent && dashboard.byAgent.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-medium mb-2">By Agent</h3>
            <div className="space-y-1">
              {dashboard.byAgent.map((a: any) => (
                <div key={a.agent} className="flex justify-between text-xs py-1 px-2 border rounded">
                  <span>{a.agent}</span>
                  <span className="font-mono">{a.count} students / ${Number(a.total).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium mb-2">By Provider</h3>
            <div className="space-y-1">
              {dashboard.byProvider?.map((p: any) => (
                <div key={p.provider} className="flex justify-between text-xs py-1 px-2 border rounded">
                  <span className="truncate max-w-[200px]">{p.provider}</span>
                  <span className="font-mono">{p.count} students / ${Number(p.total).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-medium mb-2">All Students</h3>
        <div className="overflow-auto border rounded-lg">
          <table className="w-full text-xs border-collapse" data-testid="table-dashboard-students">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#2E75B6] text-white">
                <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] w-10">S.No</th>
                <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[100px]">Agent</th>
                <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[80px]">Agentsic ID</th>
                <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[80px]">Student ID</th>
                <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[120px]">Student Name</th>
                <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[120px]">Provider</th>
                <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[60px]">Country</th>
                <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[80px]">Intake</th>
                <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[70px]">Status</th>
                <th className="px-2 py-1.5 text-right font-medium border border-[#2060a0] min-w-[70px]">Comm. %</th>
                <th className="px-2 py-1.5 text-center font-medium border border-[#2060a0] min-w-[50px]">GST</th>
                <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[80px]">Scholarship</th>
                <th className="px-2 py-1.5 text-right font-medium border border-[#2060a0] min-w-[80px]">Total Comm.</th>
                <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[120px]">Notes</th>
                {canDeleteMaster && <th className="px-2 py-1.5 text-center font-medium border border-[#2060a0] w-10"></th>}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: canDeleteMaster ? 15 : 14 }).map((_, j) => (
                      <td key={j} className="px-2 py-1 border border-gray-200"><Skeleton className="h-3 w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : students.length > 0 ? (
                students.map((s, idx) => {
                  const statusBg = STATUS_ROW_BG[s.status || ""] || "transparent";
                  return (
                    <tr key={s.id} style={{ backgroundColor: statusBg }} data-testid={`row-dashboard-${s.id}`}>
                      <td className="px-2 py-1 border border-gray-200 text-center">{idx + 1}</td>
                      <td className="px-2 py-1 border border-gray-200">{s.agentName}</td>
                      <td className="px-2 py-1 border border-gray-200 font-mono">{s.agentsicId || "-"}</td>
                      <td className="px-2 py-1 border border-gray-200 font-mono">{s.studentId || "-"}</td>
                      <td className="px-2 py-1 border border-gray-200">{s.studentName}</td>
                      <td className="px-2 py-1 border border-gray-200">
                        <div className="flex items-center gap-1">
                          <span>{s.provider}</span>
                          {canEdit && (
                            <AddProviderButton studentId={s.id} studentName={s.studentName} />
                          )}
                        </div>
                        {providersByStudent[s.id]?.map((ap: any) => (
                          <div key={ap.id} className="text-[10px] text-blue-600 mt-0.5 flex items-center gap-1">
                            <span>{ap.provider}{ap.studentId ? ` (${ap.studentId})` : ""}</span>
                            {canEdit && (
                              <button onClick={() => onRemoveProvider(s.id, ap.id)} className="text-red-400 hover:text-red-600" data-testid={`button-remove-provider-${ap.id}`}>
                                <X className="h-2.5 w-2.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </td>
                      <td className="px-2 py-1 border border-gray-200">{s.country}</td>
                      <td className="px-2 py-1 border border-gray-200">{s.startIntake || "-"}</td>
                      <td className="px-2 py-1 border border-gray-200">
                        <Badge className={`${STATUS_COLORS[s.status || ""] || "bg-gray-100 text-gray-800"} text-[10px] px-1.5 py-0`}>
                          {s.status}
                        </Badge>
                      </td>
                      <EditableCell value={s.commissionRatePct?.toString() || ""} readOnly={!canEdit} onSave={(v) => onUpdateStudent(s.id, { commissionRatePct: v })} type="number" align="right" mono width="70px" />
                      <EditableCell value={s.gstApplicable || "Yes"} readOnly={!canEdit} onSave={(v) => onUpdateStudent(s.id, { gstApplicable: v })} type="select" options={["Yes", "No"]} width="50px" />
                      <EditableCell value={s.scholarshipType || "None"} readOnly={!canEdit} onSave={(v) => onUpdateStudent(s.id, { scholarshipType: v })} type="select" options={["None", "Percent", "Fixed"]} width="80px" />
                      <td className="px-2 py-1 border border-gray-200 text-right font-mono">${getTotalForStudent(s.id).toFixed(2)}</td>
                      <td className="px-2 py-1 border border-gray-200 max-w-[200px]">
                        {s.notes ? (
                          <TooltipProvider delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="block truncate cursor-help" data-testid={`text-notes-${s.id}`}>{s.notes}</span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[400px] whitespace-pre-wrap text-xs p-3">
                                {s.notes.split(" | ").map((part, i) => (
                                  <div key={i}>{part}</div>
                                ))}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : "-"}
                      </td>
                      {canDeleteMaster && (
                        <td className="px-1 py-1 border border-gray-200 text-center">
                          <button
                            className="text-red-500 hover:text-red-700 p-0.5"
                            onClick={() => setDeleteTarget(s)}
                            data-testid={`button-delete-master-${s.id}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={canDeleteMaster ? 15 : 14} className="px-3 py-6 text-center text-muted-foreground text-sm">
                    No students found for this year.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open && !isDeleting) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-[440px]" data-testid="dialog-delete-student">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <DialogTitle className="text-lg">Delete Student Record?</DialogTitle>
            </div>
            <DialogDescription className="sr-only">Confirm deletion of student record</DialogDescription>
          </DialogHeader>
          {deleteTarget && (
            <div className="space-y-4 pt-1">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-1.5 text-sm">
                <div className="flex gap-2"><span className="text-muted-foreground min-w-[80px]">Student:</span><span className="font-medium">{deleteTarget.studentName}</span></div>
                <div className="flex gap-2"><span className="text-muted-foreground min-w-[80px]">Student ID:</span><span className="font-mono">{deleteTarget.studentId || "-"}</span></div>
                <div className="flex gap-2"><span className="text-muted-foreground min-w-[80px]">Agentsic ID:</span><span className="font-mono">{deleteTarget.agentsicId || "-"}</span></div>
                <div className="flex gap-2"><span className="text-muted-foreground min-w-[80px]">Provider:</span><span>{deleteTarget.provider}</span></div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Are you sure you want to delete this student record? This will permanently remove the main student record and all linked term entries. This action cannot be undone.
              </p>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting} data-testid="button-cancel-delete">
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isDeleting}
              data-testid="button-confirm-delete"
              onClick={() => {
                if (deleteTarget) {
                  onDeleteStudent(deleteTarget.id);
                  setDeleteTarget(null);
                }
              }}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TermTable({ termName, students, allEntries, terms, isLoading, canEdit, canDelete, providersByStudent, onUpdateStudent, onDeleteStudent, onCreateEntry, onUpdateEntry, onDeleteEntry }: {
  termName: string;
  students: CommissionStudent[];
  allEntries: Record<number, CommissionEntry[]>;
  terms: CommissionTerm[];
  isLoading: boolean;
  canEdit: boolean;
  canDelete: boolean;
  providersByStudent?: Record<number, any[]>;
  onUpdateStudent: (id: number, data: Record<string, any>) => void;
  onDeleteStudent: (id: number) => void;
  onCreateEntry: (studentId: number, data: Record<string, any>) => void;
  onUpdateEntry: (id: number, data: Record<string, any>) => void;
  onDeleteEntry: (id: number) => void;
}) {
  const getEntry = (studentId: number): CommissionEntry | undefined => {
    return (allEntries[studentId] || []).find(e => e.termName === termName);
  };

  const isBlocked = (studentId: number): boolean => {
    const entries = allEntries[studentId] || [];
    const termOrder = terms.map(t => t.termName);
    const currentIdx = termOrder.indexOf(termName);
    for (let i = 0; i < currentIdx; i++) {
      const prev = entries.find(e => e.termName === termOrder[i]);
      if (prev && (prev.studentStatus === "Withdrawn" || prev.studentStatus === "Complete")) {
        return true;
      }
    }
    return false;
  };

  return (
    <div className="overflow-auto h-full">
      <table className="w-full text-xs border-collapse" data-testid={`table-term-${termName}`}>
        <thead className="sticky top-0 z-10">
          <tr className="bg-[#2E75B6] text-white">
            <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] w-10">S.No</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[100px]">Agent Name</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[80px]">Agentsic ID</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[80px]">Student ID</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[120px]">Student Name</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[120px]">Provider</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[60px]">Country</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[80px]">Course Level</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[120px]">Course Name</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[80px]">Academic Year</th>
            <th className="px-2 py-1.5 text-right font-medium border border-[#2060a0] min-w-[80px]">Fee (Gross)</th>
            <th className="px-2 py-1.5 text-right font-medium border border-[#2060a0] min-w-[70px]">Comm Rate (Auto)</th>
            <th className="px-2 py-1.5 text-right font-medium border border-[#2060a0] min-w-[70px]">Comm Rate Override (%)</th>
            <th className="px-2 py-1.5 text-right font-medium border border-[#2060a0] min-w-[70px]">Comm Rate Used (Auto)</th>
            <th className="px-2 py-1.5 text-right font-medium border border-[#2060a0] min-w-[80px]">Commission (Auto)</th>
            <th className="px-2 py-1.5 text-center font-medium border border-[#2060a0] min-w-[80px]">Rate Change Warning</th>
            <th className="px-2 py-1.5 text-right font-medium border border-[#2060a0] min-w-[60px]">Bonus</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[70px]">Scholarship Type (Auto)</th>
            <th className="px-2 py-1.5 text-right font-medium border border-[#2060a0] min-w-[70px]">Scholarship Value (Auto)</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[70px]">Scholarship Override Type</th>
            <th className="px-2 py-1.5 text-right font-medium border border-[#2060a0] min-w-[70px]">Scholarship Override Value</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[70px]">Scholarship Used</th>
            <th className="px-2 py-1.5 text-right font-medium border border-[#2060a0] min-w-[70px]">Scholarship Amt</th>
            <th className="px-2 py-1.5 text-right font-medium border border-[#2060a0] min-w-[80px]">Fee After Scholarship</th>
            <th className="px-2 py-1.5 text-center font-medium border border-[#2060a0] min-w-[70px]">Scholarship Warning</th>
            <th className="px-2 py-1.5 text-right font-medium border border-[#2060a0] min-w-[60px]">GST</th>
            <th className="px-2 py-1.5 text-right font-medium border border-[#2060a0] min-w-[80px]">Total</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[80px]">Payment</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[80px]">Paid Date</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[80px]">Invoice No</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[80px]">Payment Ref</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[80px]">Student Status</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[120px]">Notes</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: 33 }).map((_, j) => (
                  <td key={j} className="px-2 py-1 border border-gray-200"><Skeleton className="h-3 w-full" /></td>
                ))}
              </tr>
            ))
          ) : students.length > 0 ? (
            students.map((s, idx) => {
              const entry = getEntry(s.id);
              const blocked = isBlocked(s.id);

              if (blocked) {
                return (
                  <tr key={s.id} className="bg-gray-100 dark:bg-gray-800 opacity-50" data-testid={`row-term-${s.id}`}>
                    <td className="px-2 py-1 border border-gray-200 text-center text-gray-400">{idx + 1}</td>
                    <td className="px-2 py-1 border border-gray-200 text-gray-400">{s.agentName}</td>
                    <td className="px-2 py-1 border border-gray-200 text-gray-400 font-mono">{s.agentsicId || "-"}</td>
                    <td className="px-2 py-1 border border-gray-200 text-gray-400 font-mono">{s.studentId || "-"}</td>
                    <td className="px-2 py-1 border border-gray-200 text-gray-400">{s.studentName}</td>
                    <td className="px-2 py-1 border border-gray-200 text-gray-400">
                      <div>{s.provider}</div>
                      {providersByStudent?.[s.id]?.map((ap: any) => (
                        <div key={ap.id} className="text-[10px] text-blue-400 mt-0.5">{ap.provider}{ap.studentId ? ` (${ap.studentId})` : ""}</div>
                      ))}
                    </td>
                    <td className="px-2 py-1 border border-gray-200 text-gray-400">{s.country}</td>
                    <td colSpan={26} className="px-2 py-1 border border-gray-200 text-center text-gray-400 italic">
                      Blocked (previous term Withdrawn/Complete)
                    </td>
                  </tr>
                );
              }

              if (!entry) {
                return (
                  <tr key={s.id} className="bg-gray-50 dark:bg-gray-900" data-testid={`row-term-${s.id}`}>
                    <td className="px-2 py-1 border border-gray-200 text-center text-gray-500">{idx + 1}</td>
                    <td className="px-2 py-1 border border-gray-200 text-gray-500">{s.agentName}</td>
                    <td className="px-2 py-1 border border-gray-200 text-gray-500 font-mono">{s.agentsicId || "-"}</td>
                    <td className="px-2 py-1 border border-gray-200 text-gray-500 font-mono">{s.studentId || "-"}</td>
                    <td className="px-2 py-1 border border-gray-200 text-gray-500">{s.studentName}</td>
                    <td className="px-2 py-1 border border-gray-200 text-gray-500">
                      <div>{s.provider}</div>
                      {providersByStudent?.[s.id]?.map((ap: any) => (
                        <div key={ap.id} className="text-[10px] text-blue-400 mt-0.5">{ap.provider}{ap.studentId ? ` (${ap.studentId})` : ""}</div>
                      ))}
                    </td>
                    <td className="px-2 py-1 border border-gray-200 text-gray-500">{s.country}</td>
                    <td colSpan={26} className="px-2 py-1 border border-gray-200 text-center">
                      {canEdit ? (
                        <button
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium underline"
                          onClick={() => onCreateEntry(s.id, { termName, academicYear: "Year 1", feeGross: "0", bonus: "0", studentStatus: s.status || "Under Enquiry", paymentStatus: "Pending" })}
                          data-testid={`button-add-entry-${s.id}`}
                        >
                          + Add Entry for {termName.replace("_", " ")}
                        </button>
                      ) : (
                        <span className="text-gray-400 text-xs">No entry</span>
                      )}
                    </td>
                  </tr>
                );
              }

              const statusBg = STATUS_ROW_BG[entry.studentStatus || ""] || "transparent";

              return (
                <tr key={s.id} style={{ backgroundColor: statusBg }} data-testid={`row-term-${s.id}`}>
                  <td className="px-2 py-1 border border-gray-200 text-center text-gray-500">{idx + 1}</td>
                  <td className="px-2 py-1 border border-gray-200 text-xs">{s.agentName}</td>
                  <td className="px-2 py-1 border border-gray-200 text-xs font-mono">{s.agentsicId || "-"}</td>
                  <td className="px-2 py-1 border border-gray-200 text-xs font-mono">{s.studentId || "-"}</td>
                  <td className="px-2 py-1 border border-gray-200 text-xs">{s.studentName}</td>
                  <td className="px-2 py-1 border border-gray-200 text-xs">
                    <div>{s.provider}</div>
                    {providersByStudent?.[s.id]?.map((ap: any) => (
                      <div key={ap.id} className="text-[10px] text-blue-600 mt-0.5">{ap.provider}{ap.studentId ? ` (${ap.studentId})` : ""}</div>
                    ))}
                  </td>
                  <td className="px-2 py-1 border border-gray-200 text-xs">{s.country}</td>
                  <EditableCell value={s.courseLevel || ""} readOnly={!canEdit} onSave={(v) => onUpdateStudent(s.id, { courseLevel: v })} type="select" options={COURSE_LEVELS} width="80px" />
                  <EditableCell value={s.courseName || ""} readOnly={!canEdit} onSave={(v) => onUpdateStudent(s.id, { courseName: v })} width="120px" />
                  <EditableCell value={entry.academicYear || ""} readOnly={!canEdit} onSave={(v) => onUpdateEntry(entry.id, { academicYear: v })} type="select" options={ACADEMIC_YEARS} width="80px" />
                  <EditableCell value={entry.feeGross || "0"} readOnly={!canEdit} onSave={(v) => onUpdateEntry(entry.id, { feeGross: v || "0" })} type="number" width="80px" align="right" mono />
                  <td className="px-2 py-1 border border-gray-200 text-right font-mono text-xs bg-gray-50">{`${Number(entry.commissionRateAuto || 0)}%`}</td>
                  <EditableCell value={entry.commissionRateOverridePct || ""} readOnly={!canEdit} onSave={(v) => onUpdateEntry(entry.id, { commissionRateOverridePct: v || "" })} type="number" width="70px" align="right" mono />
                  <td className="px-2 py-1 border border-gray-200 text-right font-mono text-xs bg-gray-50">{`${Number(entry.commissionRateUsedPct || 0)}%`}</td>
                  <td className="px-2 py-1 border border-gray-200 text-right font-mono text-xs bg-gray-50">${Number(entry.commissionAmount || 0).toFixed(2)}</td>
                  <td className="px-2 py-1 border border-gray-200 text-center text-xs">{entry.rateChangeWarning ? <span className="text-amber-600 whitespace-nowrap" title={entry.rateChangeWarning}>⚠ Commission rate changed</span> : ""}</td>
                  <EditableCell value={entry.bonus || "0"} readOnly={!canEdit} onSave={(v) => onUpdateEntry(entry.id, { bonus: v || "0" })} type="number" width="60px" align="right" mono />
                  <td className="px-2 py-1 border border-gray-200 text-left text-xs bg-gray-50">{entry.scholarshipTypeAuto || "None"}</td>
                  <td className="px-2 py-1 border border-gray-200 text-right font-mono text-xs bg-gray-50">{entry.scholarshipTypeAuto === "Percent" ? `${Number(entry.scholarshipValueAuto || 0)}%` : Number(entry.scholarshipValueAuto || 0)}</td>
                  <EditableCell value={entry.scholarshipTypeOverride || ""} readOnly={!canEdit} onSave={(v) => onUpdateEntry(entry.id, { scholarshipTypeOverride: v || null })} type="select" options={["", "None", "Percent", "Fixed"]} width="70px" />
                  <EditableCell value={entry.scholarshipValueOverride?.toString() || ""} readOnly={!canEdit} onSave={(v) => onUpdateEntry(entry.id, { scholarshipValueOverride: v || null })} type="number" width="70px" align="right" mono />
                  <td className="px-2 py-1 border border-gray-200 text-left text-xs bg-gray-50">{entry.scholarshipTypeUsed || "None"} {Number(entry.scholarshipValueUsed || 0) > 0 && entry.scholarshipTypeUsed !== "None" ? `(${entry.scholarshipTypeUsed === "Percent" ? `${Number(entry.scholarshipValueUsed)}%` : `$${Number(entry.scholarshipValueUsed)}`})` : ""}</td>
                  <td className="px-2 py-1 border border-gray-200 text-right font-mono text-xs bg-gray-50">${Number(entry.scholarshipAmount || 0).toFixed(2)}</td>
                  <td className="px-2 py-1 border border-gray-200 text-right font-mono text-xs bg-gray-50">${Number(entry.feeAfterScholarship || 0).toFixed(2)}</td>
                  <td className="px-2 py-1 border border-gray-200 text-center text-xs">{entry.scholarshipChangeWarning ? <span className="text-amber-600 whitespace-nowrap" title={entry.scholarshipChangeWarning}>⚠ Scholarship changed</span> : ""}</td>
                  <td className="px-2 py-1 border border-gray-200 text-right font-mono text-xs">${Number(entry.gstAmount || 0).toFixed(2)}</td>
                  <td className="px-2 py-1 border border-gray-200 text-right font-mono text-xs font-semibold">${Number(entry.totalAmount || 0).toFixed(2)}</td>
                  <EditableCell value={entry.paymentStatus || "Pending"} readOnly={!canEdit} onSave={(v) => onUpdateEntry(entry.id, { paymentStatus: v })} type="select" options={PAYMENT_STATUSES} width="80px" />
                  <EditableCell value={entry.paidDate || ""} readOnly={!canEdit} onSave={(v) => onUpdateEntry(entry.id, { paidDate: v || null })} type="date" width="80px" />
                  <EditableCell value={entry.invoiceNo || ""} readOnly={!canEdit} onSave={(v) => onUpdateEntry(entry.id, { invoiceNo: v || null })} width="80px" />
                  <EditableCell value={entry.paymentRef || ""} readOnly={!canEdit} onSave={(v) => onUpdateEntry(entry.id, { paymentRef: v || null })} width="80px" />
                  <EditableCell value={entry.studentStatus || "Under Enquiry"} readOnly={!canEdit} onSave={(v) => onUpdateEntry(entry.id, { studentStatus: v })} type="select" options={STUDENT_STATUSES} width="80px" />
                  <EditableCell value={entry.notes || ""} readOnly={!canEdit} onSave={(v) => onUpdateEntry(entry.id, { notes: v || null })} width="120px" />
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={33} className="px-3 py-8 text-center text-muted-foreground text-sm">
                No students found.
              </td>
            </tr>
          )}
        </tbody>
        {(() => {
          const entries = students.map(s => getEntry(s.id)).filter((e): e is CommissionEntry => !!e);
          const totalCommission = entries.reduce((sum, e) => sum + Number(e.commissionAmount || 0), 0);
          const totalBonus = entries.reduce((sum, e) => sum + Number(e.bonus || 0), 0);
          const totalGst = entries.reduce((sum, e) => sum + Number(e.gstAmount || 0), 0);
          const totalAmount = entries.reduce((sum, e) => sum + Number(e.totalAmount || 0), 0);
          if (entries.length === 0) return null;
          return (
            <tfoot className="sticky bottom-0 z-10">
              <tr className="bg-[#1a4971] text-white font-semibold text-xs" data-testid={`row-totals-${termName}`}>
                {/* 1-10: S.No, Agent, AgentsicID, StudentID, Name, Provider, Country, CourseLevel, CourseName, AcademicYear */}
                <td className="px-2 py-2 border border-[#2060a0]" colSpan={10}>
                  <span className="text-white/80">Entries: {entries.length} / {students.length}</span>
                </td>
                {/* 11: Fee Gross */}
                <td className="px-2 py-2 border border-[#2060a0]"></td>
                {/* 12-14: Comm Rate Auto, Override, Used */}
                <td className="px-2 py-2 border border-[#2060a0]"></td>
                <td className="px-2 py-2 border border-[#2060a0]"></td>
                <td className="px-2 py-2 border border-[#2060a0]"></td>
                {/* 15: Commission */}
                <td className="px-2 py-2 border border-[#2060a0] text-right font-mono" data-testid={`total-commission-${termName}`}>${totalCommission.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                {/* 16: Rate Change Warning */}
                <td className="px-2 py-2 border border-[#2060a0]"></td>
                {/* 17: Bonus */}
                <td className="px-2 py-2 border border-[#2060a0] text-right font-mono" data-testid={`total-bonus-${termName}`}>${totalBonus.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                {/* 18-25: Scholarship Type Auto, Value Auto, Override Type, Override Value, Used, Amt, Fee After Scholarship, Warning */}
                <td className="px-2 py-2 border border-[#2060a0]"></td>
                <td className="px-2 py-2 border border-[#2060a0]"></td>
                <td className="px-2 py-2 border border-[#2060a0]"></td>
                <td className="px-2 py-2 border border-[#2060a0]"></td>
                <td className="px-2 py-2 border border-[#2060a0]"></td>
                <td className="px-2 py-2 border border-[#2060a0]"></td>
                <td className="px-2 py-2 border border-[#2060a0]"></td>
                <td className="px-2 py-2 border border-[#2060a0]"></td>
                {/* 26: GST */}
                <td className="px-2 py-2 border border-[#2060a0] text-right font-mono" data-testid={`total-gst-${termName}`}>${totalGst.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                {/* 27: Total */}
                <td className="px-2 py-2 border border-[#2060a0] text-right font-mono" data-testid={`total-amount-${termName}`}>${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                {/* 28-33: Payment, Paid Date, Invoice No, Payment Ref, Student Status, Notes */}
                <td className="px-2 py-2 border border-[#2060a0]"></td>
                <td className="px-2 py-2 border border-[#2060a0]"></td>
                <td className="px-2 py-2 border border-[#2060a0]"></td>
                <td className="px-2 py-2 border border-[#2060a0]"></td>
                <td className="px-2 py-2 border border-[#2060a0]"></td>
                <td className="px-2 py-2 border border-[#2060a0]"></td>
              </tr>
            </tfoot>
          );
        })()}
      </table>
    </div>
  );
}

function BulkUploadDialog({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ valid: any[]; invalid: any[]; duplicates: any[]; totalRows: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePreview = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/commission-tracker/bulk-upload/preview", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Upload failed");
      }
      const data = await res.json();
      setPreview(data);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleConfirm = async () => {
    if (!preview?.valid.length) return;
    setImporting(true);
    try {
      const res = await apiRequest("POST", "/api/commission-tracker/bulk-upload/confirm", { rows: preview.valid });
      const result = await res.json();
      toast({
        title: "Import Complete",
        description: `${result.imported} imported, ${result.failed} failed`,
      });
      if (result.imported > 0) onSuccess();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const downloadFailed = () => {
    if (!preview) return;
    const failed = [...preview.invalid, ...preview.duplicates];
    if (failed.length === 0) return;
    const headers = Object.keys(failed[0].data);
    const rows = failed.map(f => [...headers.map(h => f.data[h] || ""), f.errors.join("; ")]);
    const csv = [[...headers, "Error"].join(","), ...rows.map(r => r.map((v: string) => `"${(v || "").replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "failed_rows.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4" data-testid="bulk-upload-dialog">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => window.open("/api/commission-tracker/sample-sheet", "_blank")} data-testid="button-download-template">
          <Download className="w-3.5 h-3.5 mr-1" />
          Download Sample Template
        </Button>
      </div>

      {!preview ? (
        <div className="space-y-3">
          <div className="border-2 border-dashed rounded-lg p-6 text-center">
            <FileSpreadsheet className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-2">Upload a CSV file with student data</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              data-testid="input-file"
            />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} data-testid="button-choose-file">
              Choose File
            </Button>
            {file && <p className="text-xs text-muted-foreground mt-2">{file.name}</p>}
          </div>
          <div className="flex justify-end">
            <Button size="sm" disabled={!file || uploading} onClick={handlePreview} data-testid="button-preview">
              {uploading ? "Validating..." : "Preview & Validate"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-4 text-sm">
            <span className="font-medium">Total rows: {preview.totalRows}</span>
            <Badge className="bg-green-100 text-green-800" data-testid="badge-valid">Valid: {preview.valid.length}</Badge>
            <Badge className="bg-red-100 text-red-800" data-testid="badge-invalid">Invalid: {preview.invalid.length}</Badge>
            <Badge className="bg-yellow-100 text-yellow-800" data-testid="badge-duplicates">Duplicates: {preview.duplicates.length}</Badge>
          </div>

          {preview.invalid.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-red-600 mb-1">Invalid Rows</h4>
              <div className="max-h-32 overflow-y-auto border rounded text-xs">
                {preview.invalid.map((r, i) => (
                  <div key={i} className="flex justify-between py-1 px-2 border-b bg-red-50">
                    <span>Row {r.row}: {r.data["Student Name"] || "?"}</span>
                    <span className="text-red-600">{r.errors.join(", ")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {preview.duplicates.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-yellow-600 mb-1">Duplicate Rows</h4>
              <div className="max-h-32 overflow-y-auto border rounded text-xs">
                {preview.duplicates.map((r, i) => (
                  <div key={i} className="flex justify-between py-1 px-2 border-b bg-yellow-50">
                    <span>Row {r.row}: {r.data["Student Name"] || "?"}</span>
                    <span className="text-yellow-600">{r.errors.join(", ")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {preview.valid.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-green-600 mb-1">Valid Rows (will be imported)</h4>
              <div className="max-h-32 overflow-y-auto border rounded text-xs">
                {preview.valid.map((r, i) => (
                  <div key={i} className="py-1 px-2 border-b bg-green-50">
                    Row {r.row}: {r.data.studentName} ({r.data.agentsicId}) — {r.data.provider}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {(preview.invalid.length > 0 || preview.duplicates.length > 0) && (
                <Button variant="outline" size="sm" onClick={downloadFailed} data-testid="button-download-failed">
                  <Download className="w-3.5 h-3.5 mr-1" />
                  Download Failed Rows
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => { setPreview(null); setFile(null); }} data-testid="button-reset-upload">
                Upload Different File
              </Button>
            </div>
            <Button size="sm" disabled={preview.valid.length === 0 || importing} onClick={handleConfirm} data-testid="button-confirm-import">
              {importing ? "Importing..." : `Import ${preview.valid.length} Students`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ManageTermsDialog({ terms, onClose }: { terms: CommissionTerm[]; onClose: () => void }) {
  const { hasPermission } = useAuth();
  const canDeleteTerms = hasPermission("commission_tracker.delete");
  const { toast } = useToast();
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [termNum, setTermNum] = useState("1");
  const [deletingTerm, setDeletingTerm] = useState<CommissionTerm | null>(null);

  const createMutation = useMutation({
    mutationFn: async () => {
      const y = parseInt(year);
      const t = parseInt(termNum);
      const termName = `T${t}_${y}`;
      const termLabel = `T${t} ${y}`;
      const maxSort = terms.length > 0 ? Math.max(...terms.map(tm => tm.sortOrder)) : 0;
      const res = await apiRequest("POST", "/api/commission-tracker/terms", {
        termName, termLabel, year: y, termNumber: t, sortOrder: maxSort + 1,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/commission-tracker/terms"] });
      queryClient.invalidateQueries({ queryKey: ["/api/commission-tracker/filters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/commission-tracker/years"] });
      toast({ title: "Term added" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/commission-tracker/terms/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/commission-tracker/terms"] });
      queryClient.invalidateQueries({ queryKey: ["/api/commission-tracker/filters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/commission-tracker/years"] });
      toast({ title: "Term removed" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4" data-testid="manage-terms-dialog">
      <div className="space-y-2">
        {terms.map(t => (
          <div key={t.id} className="flex items-center justify-between py-1 px-2 border rounded text-sm">
            <span>{t.termLabel} ({t.year})</span>
            {canDeleteTerms && (
              <button
                className="text-red-500 hover:text-red-700"
                onClick={() => setDeletingTerm(t)}
                data-testid={`button-delete-term-${t.id}`}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
        {terms.length === 0 && <p className="text-sm text-muted-foreground text-center py-2">No terms configured</p>}
      </div>
      <div className="border-t pt-3">
        <p className="text-sm font-medium mb-2">Add New Term</p>
        <div className="flex items-end gap-2">
          <div>
            <Label className="text-xs">Year</Label>
            <Input value={year} onChange={(e) => setYear(e.target.value)} type="number" className="w-24 h-8 text-sm" data-testid="input-term-year" />
          </div>
          <div>
            <Label className="text-xs">Term #</Label>
            <Select value={termNum} onValueChange={setTermNum}>
              <SelectTrigger className="w-20 h-8 text-sm" data-testid="select-term-number">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">T1</SelectItem>
                <SelectItem value="2">T2</SelectItem>
                <SelectItem value="3">T3</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" onClick={() => createMutation.mutate()} disabled={createMutation.isPending} data-testid="button-add-term">
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add
          </Button>
        </div>
      </div>

      <ConfirmModal
        open={!!deletingTerm}
        onOpenChange={(open) => { if (!open) setDeletingTerm(null); }}
        variant="danger"
        title="Delete Term?"
        description={`Are you sure you want to delete ${deletingTerm?.termLabel}? All entries for this term must be removed first. This action cannot be undone.`}
        confirmText="Delete Term"
        onConfirm={() => {
          if (deletingTerm) deleteMutation.mutate(deletingTerm.id);
        }}
        data-testid="modal-delete-term"
      />
    </div>
  );
}

function AddStudentForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    agentName: "",
    studentId: "",
    agentsicId: "",
    studentName: "",
    provider: "",
    country: "Australia",
    startIntake: "",
    courseLevel: "",
    courseName: "",
    courseDurationYears: "",
  });
  const [additionalProviders, setAdditionalProviders] = useState<Array<{ provider: string; studentId: string; country: string; courseLevel: string; courseName: string; courseDurationYears: string; startIntake: string }>>([]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/commission-tracker/students", data);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to add student");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Student added successfully" });
      onSuccess();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const update = (field: string, value: string) => setForm({ ...form, [field]: value });

  const addProvider = () => {
    setAdditionalProviders([...additionalProviders, { provider: "", studentId: "", country: "Australia", courseLevel: "", courseName: "", courseDurationYears: "", startIntake: "" }]);
  };

  const updateProvider = (index: number, field: string, value: string) => {
    const updated = [...additionalProviders];
    (updated[index] as any)[field] = value;
    setAdditionalProviders(updated);
  };

  const removeProvider = (index: number) => {
    setAdditionalProviders(additionalProviders.filter((_, i) => i !== index));
  };

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); createMutation.mutate({ ...form, additionalProviders }); }}
      className="space-y-4 max-h-[70vh] overflow-y-auto pr-1"
      data-testid="form-add-student"
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Agent Name *</Label>
          <Input value={form.agentName} onChange={(e) => update("agentName", e.target.value)} required data-testid="input-agent-name" className="h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Agentsic ID *</Label>
          <Input value={form.agentsicId} onChange={(e) => update("agentsicId", e.target.value)} required data-testid="input-agentsic-id" className="h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Student Name *</Label>
          <Input value={form.studentName} onChange={(e) => update("studentName", e.target.value)} required data-testid="input-student-name" className="h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Student ID</Label>
          <Input value={form.studentId} onChange={(e) => update("studentId", e.target.value)} data-testid="input-student-id" className="h-8 text-sm" />
        </div>
      </div>

      <div className="border rounded-md p-3 space-y-3 bg-muted/30">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">Primary Provider</Label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Provider *</Label>
            <Input value={form.provider} onChange={(e) => update("provider", e.target.value)} required data-testid="input-provider" className="h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Country</Label>
            <Input value={form.country} onChange={(e) => update("country", e.target.value)} data-testid="input-country" className="h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Start Intake</Label>
            <Input value={form.startIntake} onChange={(e) => update("startIntake", e.target.value)} placeholder="e.g. T1 2025" data-testid="input-start-intake" className="h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Course Level</Label>
            <Select value={form.courseLevel || "_none"} onValueChange={(v) => update("courseLevel", v === "_none" ? "" : v)}>
              <SelectTrigger data-testid="select-course-level" className="h-8 text-sm">
                <SelectValue placeholder="Select level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Select level</SelectItem>
                {COURSE_LEVELS.map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Course Name</Label>
            <Input value={form.courseName} onChange={(e) => update("courseName", e.target.value)} data-testid="input-course-name" className="h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Course Duration (Years)</Label>
            <Input type="number" step="0.5" value={form.courseDurationYears} onChange={(e) => update("courseDurationYears", e.target.value)} data-testid="input-duration" className="h-8 text-sm" />
          </div>
        </div>
      </div>

      {additionalProviders.map((ap, idx) => (
        <div key={idx} className="border rounded-md p-3 space-y-3 bg-blue-50/50 dark:bg-blue-950/20">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold">Additional Provider {idx + 1}</Label>
            <Button type="button" variant="ghost" size="sm" onClick={() => removeProvider(idx)} className="h-6 px-2 text-xs text-red-500 hover:text-red-700" data-testid={`button-remove-provider-${idx}`}>
              <X className="h-3 w-3 mr-1" /> Remove
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Provider *</Label>
              <Input value={ap.provider} onChange={(e) => updateProvider(idx, "provider", e.target.value)} required data-testid={`input-addl-provider-${idx}`} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Student ID</Label>
              <Input value={ap.studentId} onChange={(e) => updateProvider(idx, "studentId", e.target.value)} data-testid={`input-addl-student-id-${idx}`} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Country</Label>
              <Input value={ap.country} onChange={(e) => updateProvider(idx, "country", e.target.value)} data-testid={`input-addl-country-${idx}`} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Start Intake</Label>
              <Input value={ap.startIntake} onChange={(e) => updateProvider(idx, "startIntake", e.target.value)} placeholder="e.g. T1 2025" data-testid={`input-addl-intake-${idx}`} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Course Level</Label>
              <Select value={ap.courseLevel || "_none"} onValueChange={(v) => updateProvider(idx, "courseLevel", v === "_none" ? "" : v)}>
                <SelectTrigger data-testid={`select-addl-course-level-${idx}`} className="h-8 text-sm">
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Select level</SelectItem>
                  {COURSE_LEVELS.map((l) => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Course Duration (Years)</Label>
              <Input type="number" step="0.5" value={ap.courseDurationYears} onChange={(e) => updateProvider(idx, "courseDurationYears", e.target.value)} data-testid={`input-addl-duration-${idx}`} className="h-8 text-sm" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Course Name</Label>
              <Input value={ap.courseName} onChange={(e) => updateProvider(idx, "courseName", e.target.value)} data-testid={`input-addl-course-${idx}`} className="h-8 text-sm" />
            </div>
          </div>
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={addProvider} className="w-full text-xs" data-testid="button-add-another-provider">
        <Plus className="h-3 w-3 mr-1" /> Add Another Provider
      </Button>

      <div className="flex justify-end gap-2">
        <Button type="submit" size="sm" disabled={createMutation.isPending} data-testid="button-submit-student">
          {createMutation.isPending ? "Adding..." : "Add Student"}
        </Button>
      </div>
    </form>
  );
}
