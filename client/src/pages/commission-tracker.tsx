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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus, Search, Trash2, Users, DollarSign, TrendingUp, AlertCircle,
  Settings, Save, X, Check
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
  const [activeTab, setActiveTab] = useState("MASTER");
  const [search, setSearch] = useState("");
  const [agentFilter, setAgentFilter] = useState("");
  const [providerFilter, setProviderFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showTermDialog, setShowTermDialog] = useState(false);

  const canCreate = hasPermission("commission_tracker.create");
  const canEdit = hasPermission("commission_tracker.edit");
  const canDelete = hasPermission("commission_tracker.delete");

  const { data: terms = [] } = useQuery<CommissionTerm[]>({
    queryKey: ["/api/commission-tracker/terms"],
  });

  const { data: students, isLoading } = useQuery<CommissionStudent[]>({
    queryKey: ["/api/commission-tracker/students", { search, agent: agentFilter, provider: providerFilter, status: statusFilter }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (agentFilter) params.set("agent", agentFilter);
      if (providerFilter) params.set("provider", providerFilter);
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/commission-tracker/students?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: allEntries = {} } = useQuery<Record<number, CommissionEntry[]>>({
    queryKey: ["/api/commission-tracker/all-entries"],
  });

  const { data: filters } = useQuery<{
    agents: string[];
    providers: string[];
    countries: string[];
    statuses: string[];
  }>({
    queryKey: ["/api/commission-tracker/filters"],
  });

  const { data: dashboard } = useQuery<{
    totalStudents: number;
    totalCommission: number;
    totalReceived: number;
    byStatus: Record<string, number>;
  }>({
    queryKey: ["/api/commission-tracker/dashboard"],
  });

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/commission-tracker/students"] });
    queryClient.invalidateQueries({ queryKey: ["/api/commission-tracker/all-entries"] });
    queryClient.invalidateQueries({ queryKey: ["/api/commission-tracker/dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["/api/commission-tracker/filters"] });
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

  const totalStudents = dashboard?.totalStudents || 0;
  const totalCommission = dashboard?.totalCommission || 0;
  const totalReceived = dashboard?.totalReceived || 0;
  const activeCount = dashboard?.byStatus?.["Active"] || 0;

  const tabs = ["MASTER", ...terms.map(t => t.termName)];

  return (
    <div className="flex flex-col h-full" data-testid="commission-tracker-page">
      <div className="p-3 pb-0 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold" data-testid="text-page-title">Commission Tracker</h1>
            <p className="text-xs text-muted-foreground">Track student commissions across terms</p>
          </div>
          <div className="flex items-center gap-2">
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
                    <DialogDescription>Add a new student to the commission tracker</DialogDescription>
                  </DialogHeader>
                  <AddStudentForm onSuccess={() => { setShowAddDialog(false); invalidateAll(); }} />
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Card data-testid="card-total-students">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-500" />
                <div>
                  <p className="text-[10px] text-muted-foreground">Total Students</p>
                  <p className="text-lg font-bold">{totalStudents}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="card-total-commission">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-500" />
                <div>
                  <p className="text-[10px] text-muted-foreground">Total Commission</p>
                  <p className="text-lg font-bold">${totalCommission.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="card-total-received">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <div>
                  <p className="text-[10px] text-muted-foreground">Total Received</p>
                  <p className="text-lg font-bold">${totalReceived.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="card-active-students">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <div>
                  <p className="text-[10px] text-muted-foreground">Active Students</p>
                  <p className="text-lg font-bold">{activeCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by name, student ID, agent..."
              className="pl-8 h-8 text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search"
            />
          </div>
          <Select value={agentFilter || "_all"} onValueChange={(v) => setAgentFilter(v === "_all" ? "" : v)}>
            <SelectTrigger className="w-[160px] h-8 text-xs" data-testid="select-agent">
              <SelectValue placeholder="All Agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All Agents</SelectItem>
              {filters?.agents?.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={providerFilter || "_all"} onValueChange={(v) => setProviderFilter(v === "_all" ? "" : v)}>
            <SelectTrigger className="w-[160px] h-8 text-xs" data-testid="select-provider">
              <SelectValue placeholder="All Providers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All Providers</SelectItem>
              {filters?.providers?.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter || "_all"} onValueChange={(v) => setStatusFilter(v === "_all" ? "" : v)}>
            <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="select-status">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All Statuses</SelectItem>
              {filters?.statuses?.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col mt-2">
        <div className="flex-1 overflow-auto border-t">
          {activeTab === "MASTER" ? (
            <MasterTable
              students={students || []}
              allEntries={allEntries}
              terms={terms}
              isLoading={isLoading}
              canEdit={canEdit}
              canDelete={canDelete}
              onUpdateStudent={(id, data) => updateStudentMutation.mutate({ id, data })}
              onDeleteStudent={(id) => {
                if (confirm("Delete this student and all their term entries?")) deleteStudentMutation.mutate(id);
              }}
            />
          ) : (
            <TermTable
              termName={activeTab}
              students={students || []}
              allEntries={allEntries}
              terms={terms}
              isLoading={isLoading}
              canEdit={canEdit}
              onCreateEntry={(studentId, data) => createEntryMutation.mutate({ studentId, data })}
              onUpdateEntry={(id, data) => updateEntryMutation.mutate({ id, data })}
              onDeleteEntry={(id) => deleteEntryMutation.mutate(id)}
            />
          )}
        </div>

        <div className="flex items-center border-t bg-muted/30 overflow-x-auto" data-testid="tabs-bar">
          {tabs.map(tab => (
            <button
              key={tab}
              className={`px-4 py-1.5 text-xs font-medium border-r whitespace-nowrap transition-colors ${
                activeTab === tab
                  ? "bg-white dark:bg-gray-800 text-primary border-t-2 border-t-primary"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
              onClick={() => setActiveTab(tab)}
              data-testid={`tab-${tab}`}
            >
              {tab === "MASTER" ? "MASTER" : terms.find(t => t.termName === tab)?.termLabel || tab.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {students && (
        <div className="px-3 py-1 border-t bg-muted/20">
          <p className="text-[10px] text-muted-foreground" data-testid="text-count">
            {students.length} student{students.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}
    </div>
  );
}

function MasterTable({ students, allEntries, terms, isLoading, canEdit, canDelete, onUpdateStudent, onDeleteStudent }: {
  students: CommissionStudent[];
  allEntries: Record<number, CommissionEntry[]>;
  terms: CommissionTerm[];
  isLoading: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onUpdateStudent: (id: number, data: Record<string, any>) => void;
  onDeleteStudent: (id: number) => void;
}) {
  return (
    <div className="overflow-auto h-full">
      <table className="w-full text-xs border-collapse" data-testid="table-master">
        <thead className="sticky top-0 z-10">
          <tr className="bg-[#1F4E79] text-white">
            <th className="px-2 py-1.5 text-left font-medium border border-[#1a4060] w-10">S.No</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#1a4060] min-w-[120px]">Agent Name</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#1a4060] min-w-[90px]">Student ID</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#1a4060] min-w-[80px]">Agentsic ID</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#1a4060] min-w-[140px]">Student Name</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#1a4060] min-w-[140px]">Provider</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#1a4060] min-w-[70px]">Country</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#1a4060] min-w-[90px]">Start Intake</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#1a4060] min-w-[100px]">Course Level</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#1a4060] min-w-[140px]">Course Name</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#1a4060] min-w-[50px]">Duration</th>
            <th className="px-2 py-1.5 text-right font-medium border border-[#1a4060] min-w-[70px]">Comm %</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#1a4060] min-w-[50px]">GST</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#1a4060] min-w-[80px]">Scholarship</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#1a4060] min-w-[80px]">Status</th>
            <th className="px-2 py-1.5 text-right font-medium border border-[#1a4060] min-w-[90px]">Total Received</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#1a4060] min-w-[160px]">Notes</th>
            {canDelete && <th className="px-2 py-1.5 text-center font-medium border border-[#1a4060] w-10"></th>}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: canDelete ? 18 : 17 }).map((_, j) => (
                  <td key={j} className="px-2 py-1 border border-gray-200"><Skeleton className="h-3 w-full" /></td>
                ))}
              </tr>
            ))
          ) : students.length > 0 ? (
            students.map((s, idx) => (
              <tr key={s.id} style={{ backgroundColor: STATUS_ROW_BG[s.status || ""] || "transparent" }} data-testid={`row-student-${s.id}`}>
                <td className="px-2 py-1 border border-gray-200 text-center text-gray-500">{idx + 1}</td>
                <EditableCell value={s.agentName} readOnly={!canEdit} onSave={(v) => onUpdateStudent(s.id, { agentName: v })} width="120px" />
                <EditableCell value={s.studentId || ""} readOnly={!canEdit} onSave={(v) => onUpdateStudent(s.id, { studentId: v })} width="90px" mono />
                <EditableCell value={s.agentsicId || ""} readOnly={!canEdit} onSave={(v) => onUpdateStudent(s.id, { agentsicId: v })} width="80px" mono />
                <EditableCell value={s.studentName} readOnly={!canEdit} onSave={(v) => onUpdateStudent(s.id, { studentName: v })} width="140px" />
                <EditableCell value={s.provider} readOnly={!canEdit} onSave={(v) => onUpdateStudent(s.id, { provider: v })} width="140px" />
                <EditableCell value={s.country} readOnly={!canEdit} onSave={(v) => onUpdateStudent(s.id, { country: v })} width="70px" />
                <EditableCell value={s.startIntake || ""} readOnly={!canEdit} onSave={(v) => onUpdateStudent(s.id, { startIntake: v })} width="90px" />
                <EditableCell value={s.courseLevel || ""} readOnly={!canEdit} onSave={(v) => onUpdateStudent(s.id, { courseLevel: v })} type="select" options={COURSE_LEVELS} width="100px" />
                <EditableCell value={s.courseName || ""} readOnly={!canEdit} onSave={(v) => onUpdateStudent(s.id, { courseName: v })} width="140px" />
                <EditableCell value={s.courseDurationYears || ""} readOnly={!canEdit} onSave={(v) => onUpdateStudent(s.id, { courseDurationYears: v })} type="number" width="50px" align="right" />
                <EditableCell value={s.commissionRatePct || ""} readOnly={!canEdit} onSave={(v) => onUpdateStudent(s.id, { commissionRatePct: v })} type="number" width="70px" align="right" mono />
                <EditableCell value={s.gstApplicable || "No"} readOnly={!canEdit} onSave={(v) => onUpdateStudent(s.id, { gstApplicable: v })} type="select" options={["Yes", "No"]} width="50px" />
                <td className="px-2 py-1 border border-gray-200 text-xs">
                  {s.scholarshipType !== "None" ? `${s.scholarshipType}: ${s.scholarshipValue}` : "-"}
                </td>
                <td className="px-2 py-1 border border-gray-200">
                  <Badge className={`${STATUS_COLORS[s.status || ""] || "bg-gray-100 text-gray-800"} text-[10px] px-1.5 py-0`} data-testid={`badge-status-${s.id}`}>
                    {s.status}
                  </Badge>
                </td>
                <td className="px-2 py-1 border border-gray-200 text-right font-mono text-xs">
                  ${Number(s.totalReceived || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="px-2 py-1 border border-gray-200 text-xs text-gray-600 max-w-[160px] truncate" title={s.notes || ""}>
                  {s.notes || "-"}
                </td>
                {canDelete && (
                  <td className="px-1 py-1 border border-gray-200 text-center">
                    <button
                      className="text-red-500 hover:text-red-700 p-0.5"
                      onClick={() => onDeleteStudent(s.id)}
                      data-testid={`button-delete-${s.id}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </td>
                )}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={canDelete ? 18 : 17} className="px-3 py-8 text-center text-muted-foreground text-sm">
                No students found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function TermTable({ termName, students, allEntries, terms, isLoading, canEdit, onCreateEntry, onUpdateEntry, onDeleteEntry }: {
  termName: string;
  students: CommissionStudent[];
  allEntries: Record<number, CommissionEntry[]>;
  terms: CommissionTerm[];
  isLoading: boolean;
  canEdit: boolean;
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
            <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[80px]">Student ID</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[70px]">Agentsic ID</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[120px]">Student Name</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[120px]">Provider</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[60px]">Country</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[80px]">Academic Year</th>
            <th className="px-2 py-1.5 text-right font-medium border border-[#2060a0] min-w-[80px]">Fee (Gross)</th>
            <th className="px-2 py-1.5 text-right font-medium border border-[#2060a0] min-w-[60px]">Comm % Override</th>
            <th className="px-2 py-1.5 text-right font-medium border border-[#2060a0] min-w-[60px]">Comm % Used</th>
            <th className="px-2 py-1.5 text-right font-medium border border-[#2060a0] min-w-[80px]">Commission</th>
            <th className="px-2 py-1.5 text-right font-medium border border-[#2060a0] min-w-[60px]">Bonus</th>
            <th className="px-2 py-1.5 text-right font-medium border border-[#2060a0] min-w-[60px]">GST</th>
            <th className="px-2 py-1.5 text-right font-medium border border-[#2060a0] min-w-[80px]">Total</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[80px]">Payment</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[80px]">Paid Date</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[80px]">Invoice No</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[80px]">Payment Ref</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[80px]">Student Status</th>
            <th className="px-2 py-1.5 text-left font-medium border border-[#2060a0] min-w-[120px]">Notes</th>
            <th className="px-2 py-1.5 text-center font-medium border border-[#2060a0] w-10"></th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: 22 }).map((_, j) => (
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
                    <td className="px-2 py-1 border border-gray-200 text-gray-400 font-mono">{s.studentId || "-"}</td>
                    <td className="px-2 py-1 border border-gray-200 text-gray-400 font-mono">{s.agentsicId || "-"}</td>
                    <td className="px-2 py-1 border border-gray-200 text-gray-400">{s.studentName}</td>
                    <td className="px-2 py-1 border border-gray-200 text-gray-400">{s.provider}</td>
                    <td className="px-2 py-1 border border-gray-200 text-gray-400">{s.country}</td>
                    <td colSpan={15} className="px-2 py-1 border border-gray-200 text-center text-gray-400 italic">
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
                    <td className="px-2 py-1 border border-gray-200 text-gray-500 font-mono">{s.studentId || "-"}</td>
                    <td className="px-2 py-1 border border-gray-200 text-gray-500 font-mono">{s.agentsicId || "-"}</td>
                    <td className="px-2 py-1 border border-gray-200 text-gray-500">{s.studentName}</td>
                    <td className="px-2 py-1 border border-gray-200 text-gray-500">{s.provider}</td>
                    <td className="px-2 py-1 border border-gray-200 text-gray-500">{s.country}</td>
                    <td colSpan={14} className="px-2 py-1 border border-gray-200 text-center">
                      {canEdit ? (
                        <button
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium underline"
                          onClick={() => onCreateEntry(s.id, { termName, academicYear: "Year 1", feeGross: "0", bonus: "0", studentStatus: "Under Enquiry", paymentStatus: "Pending" })}
                          data-testid={`button-add-entry-${s.id}`}
                        >
                          + Add Entry for {termName.replace("_", " ")}
                        </button>
                      ) : (
                        <span className="text-gray-400 text-xs">No entry</span>
                      )}
                    </td>
                    <td className="px-1 py-1 border border-gray-200"></td>
                  </tr>
                );
              }

              const statusBg = STATUS_ROW_BG[entry.studentStatus || ""] || "transparent";

              return (
                <tr key={s.id} style={{ backgroundColor: statusBg }} data-testid={`row-term-${s.id}`}>
                  <td className="px-2 py-1 border border-gray-200 text-center text-gray-500">{idx + 1}</td>
                  <td className="px-2 py-1 border border-gray-200 text-xs">{s.agentName}</td>
                  <td className="px-2 py-1 border border-gray-200 text-xs font-mono">{s.studentId || "-"}</td>
                  <td className="px-2 py-1 border border-gray-200 text-xs font-mono">{s.agentsicId || "-"}</td>
                  <td className="px-2 py-1 border border-gray-200 text-xs">{s.studentName}</td>
                  <td className="px-2 py-1 border border-gray-200 text-xs">{s.provider}</td>
                  <td className="px-2 py-1 border border-gray-200 text-xs">{s.country}</td>
                  <EditableCell value={entry.academicYear || ""} readOnly={!canEdit} onSave={(v) => onUpdateEntry(entry.id, { academicYear: v })} type="select" options={ACADEMIC_YEARS} width="80px" />
                  <EditableCell value={entry.feeGross || "0"} readOnly={!canEdit} onSave={(v) => onUpdateEntry(entry.id, { feeGross: v || "0" })} type="number" width="80px" align="right" mono />
                  <EditableCell value={entry.commissionRateOverridePct || ""} readOnly={!canEdit} onSave={(v) => onUpdateEntry(entry.id, { commissionRateOverridePct: v || null })} type="number" width="60px" align="right" mono />
                  <td className="px-2 py-1 border border-gray-200 text-right font-mono text-xs">{entry.commissionRateUsedPct || "-"}</td>
                  <td className="px-2 py-1 border border-gray-200 text-right font-mono text-xs">${Number(entry.commissionAmount || 0).toFixed(2)}</td>
                  <EditableCell value={entry.bonus || "0"} readOnly={!canEdit} onSave={(v) => onUpdateEntry(entry.id, { bonus: v || "0" })} type="number" width="60px" align="right" mono />
                  <td className="px-2 py-1 border border-gray-200 text-right font-mono text-xs">${Number(entry.gstAmount || 0).toFixed(2)}</td>
                  <td className="px-2 py-1 border border-gray-200 text-right font-mono text-xs font-semibold">${Number(entry.totalAmount || 0).toFixed(2)}</td>
                  <EditableCell value={entry.paymentStatus || "Pending"} readOnly={!canEdit} onSave={(v) => onUpdateEntry(entry.id, { paymentStatus: v })} type="select" options={PAYMENT_STATUSES} width="80px" />
                  <EditableCell value={entry.paidDate || ""} readOnly={!canEdit} onSave={(v) => onUpdateEntry(entry.id, { paidDate: v || null })} type="date" width="80px" />
                  <EditableCell value={entry.invoiceNo || ""} readOnly={!canEdit} onSave={(v) => onUpdateEntry(entry.id, { invoiceNo: v || null })} width="80px" />
                  <EditableCell value={entry.paymentRef || ""} readOnly={!canEdit} onSave={(v) => onUpdateEntry(entry.id, { paymentRef: v || null })} width="80px" />
                  <EditableCell value={entry.studentStatus || "Under Enquiry"} readOnly={!canEdit} onSave={(v) => onUpdateEntry(entry.id, { studentStatus: v })} type="select" options={STUDENT_STATUSES} width="80px" />
                  <EditableCell value={entry.notes || ""} readOnly={!canEdit} onSave={(v) => onUpdateEntry(entry.id, { notes: v || null })} width="120px" />
                  <td className="px-1 py-1 border border-gray-200 text-center">
                    {canEdit && (
                      <button
                        className="text-red-500 hover:text-red-700 p-0.5"
                        onClick={() => {
                          if (confirm("Delete this entry?")) onDeleteEntry(entry.id);
                        }}
                        data-testid={`button-delete-entry-${entry.id}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={22} className="px-3 py-8 text-center text-muted-foreground text-sm">
                No students found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ManageTermsDialog({ terms, onClose }: { terms: CommissionTerm[]; onClose: () => void }) {
  const { hasPermission } = useAuth();
  const canDeleteTerms = hasPermission("commission_tracker.delete");
  const { toast } = useToast();
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [termNum, setTermNum] = useState("1");

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
      toast({ title: "Term removed" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4" data-testid="manage-terms-dialog">
      <div className="space-y-2">
        {terms.map(t => (
          <div key={t.id} className="flex items-center justify-between py-1 px-2 border rounded text-sm">
            <span>{t.termLabel}</span>
            {canDeleteTerms && (
              <button
                className="text-red-500 hover:text-red-700"
                onClick={() => {
                  if (confirm(`Delete term ${t.termLabel}? Entries must be removed first.`)) deleteMutation.mutate(t.id);
                }}
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
    commissionRatePct: "",
    gstApplicable: "Yes",
    scholarshipType: "None",
    scholarshipValue: "0",
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await apiRequest("POST", "/api/commission-tracker/students", data);
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

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }}
      className="space-y-4"
      data-testid="form-add-student"
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Agent Name *</Label>
          <Input value={form.agentName} onChange={(e) => update("agentName", e.target.value)} required data-testid="input-agent-name" className="h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Student Name *</Label>
          <Input value={form.studentName} onChange={(e) => update("studentName", e.target.value)} required data-testid="input-student-name" className="h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Student ID</Label>
          <Input value={form.studentId} onChange={(e) => update("studentId", e.target.value)} data-testid="input-student-id" className="h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Agentsic ID</Label>
          <Input value={form.agentsicId} onChange={(e) => update("agentsicId", e.target.value)} data-testid="input-agentsic-id" className="h-8 text-sm" />
        </div>
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
        <div>
          <Label className="text-xs">Commission Rate (%)</Label>
          <Input type="number" step="0.01" value={form.commissionRatePct} onChange={(e) => update("commissionRatePct", e.target.value)} data-testid="input-commission-rate" className="h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs">GST Applicable</Label>
          <Select value={form.gstApplicable} onValueChange={(v) => update("gstApplicable", v)}>
            <SelectTrigger data-testid="select-gst" className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Yes">Yes</SelectItem>
              <SelectItem value="No">No</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Scholarship Type</Label>
          <Select value={form.scholarshipType} onValueChange={(v) => update("scholarshipType", v)}>
            <SelectTrigger data-testid="select-scholarship-type" className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="None">None</SelectItem>
              <SelectItem value="Percent">Percent</SelectItem>
              <SelectItem value="Fixed">Fixed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {form.scholarshipType !== "None" && (
          <div>
            <Label className="text-xs">Scholarship Value</Label>
            <Input type="number" step="0.01" value={form.scholarshipValue} onChange={(e) => update("scholarshipValue", e.target.value)} data-testid="input-scholarship-value" className="h-8 text-sm" />
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Button type="submit" size="sm" disabled={createMutation.isPending} data-testid="button-submit-student">
          {createMutation.isPending ? "Adding..." : "Add Student"}
        </Button>
      </div>
    </form>
  );
}
