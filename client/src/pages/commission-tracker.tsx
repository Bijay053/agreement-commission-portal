import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus, Search, Eye, Trash2, Users, DollarSign, TrendingUp, AlertCircle
} from "lucide-react";
import type { CommissionStudent } from "@shared/schema";

const STATUS_COLORS: Record<string, string> = {
  "Withdrawn": "bg-red-100 text-red-800",
  "Complete": "bg-green-100 text-green-800",
  "On Break": "bg-orange-100 text-orange-800",
  "Claim Next Semester": "bg-yellow-100 text-yellow-800",
  "Under Enquiry": "bg-blue-100 text-blue-800",
  "Active": "bg-emerald-100 text-emerald-800",
};

const STATUS_ROW_COLORS: Record<string, string> = {
  "Withdrawn": "bg-red-50",
  "Complete": "bg-green-50",
  "On Break": "bg-orange-50",
  "Claim Next Semester": "bg-yellow-50",
  "Under Enquiry": "bg-blue-50/30",
  "Active": "bg-green-50/50",
};

export default function CommissionTrackerPage() {
  const [, navigate] = useLocation();
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [agentFilter, setAgentFilter] = useState("");
  const [providerFilter, setProviderFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);

  const canCreate = hasPermission("commission_tracker.create");
  const canDelete = hasPermission("commission_tracker.delete");

  const { data: students, isLoading } = useQuery<CommissionStudent[]>({
    queryKey: ["/api/commission-tracker/students", { search, agent: agentFilter, provider: providerFilter, country: countryFilter, status: statusFilter }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (agentFilter) params.set("agent", agentFilter);
      if (providerFilter) params.set("provider", providerFilter);
      if (countryFilter) params.set("country", countryFilter);
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/commission-tracker/students?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
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

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/commission-tracker/students/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/commission-tracker/students"] });
      queryClient.invalidateQueries({ queryKey: ["/api/commission-tracker/dashboard"] });
      toast({ title: "Student deleted" });
    },
  });

  const totalStudents = dashboard?.totalStudents || 0;
  const totalCommission = dashboard?.totalCommission || 0;
  const totalReceived = dashboard?.totalReceived || 0;
  const activeCount = dashboard?.byStatus?.["Active"] || 0;

  return (
    <div className="p-4 md:p-6 space-y-6" data-testid="commission-tracker-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Commission Tracker</h1>
          <p className="text-sm text-muted-foreground">Track student commissions across terms</p>
        </div>
        {canCreate && (
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-student">
                <Plus className="w-4 h-4 mr-2" />
                Add Student
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Student</DialogTitle>
              </DialogHeader>
              <AddStudentForm onSuccess={() => {
                setShowAddDialog(false);
                queryClient.invalidateQueries({ queryKey: ["/api/commission-tracker/students"] });
                queryClient.invalidateQueries({ queryKey: ["/api/commission-tracker/dashboard"] });
                queryClient.invalidateQueries({ queryKey: ["/api/commission-tracker/filters"] });
              }} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card data-testid="card-total-students">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">Total Students</p>
                <p className="text-xl font-bold">{totalStudents}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-total-commission">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">Total Commission</p>
                <p className="text-xl font-bold">${totalCommission.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-total-received">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              <div>
                <p className="text-xs text-muted-foreground">Total Received</p>
                <p className="text-xl font-bold">${totalReceived.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-active-students">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              <div>
                <p className="text-xs text-muted-foreground">Active Students</p>
                <p className="text-xl font-bold">{activeCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, student ID, agent..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search"
          />
        </div>
        <Select value={agentFilter || "_all"} onValueChange={(v) => setAgentFilter(v === "_all" ? "" : v)}>
          <SelectTrigger className="w-[180px]" data-testid="select-agent">
            <SelectValue placeholder="All Agents" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All Agents</SelectItem>
            {filters?.agents?.map((a) => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={providerFilter || "_all"} onValueChange={(v) => setProviderFilter(v === "_all" ? "" : v)}>
          <SelectTrigger className="w-[180px]" data-testid="select-provider">
            <SelectValue placeholder="All Providers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All Providers</SelectItem>
            {filters?.providers?.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter || "_all"} onValueChange={(v) => setStatusFilter(v === "_all" ? "" : v)}>
          <SelectTrigger className="w-[160px]" data-testid="select-status">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All Statuses</SelectItem>
            {filters?.statuses?.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="table-students">
            <thead>
              <tr className="bg-[#1F4E79] text-white">
                <th className="px-3 py-2 text-left font-medium w-[50px]">S.No</th>
                <th className="px-3 py-2 text-left font-medium">Agent</th>
                <th className="px-3 py-2 text-left font-medium">Student ID</th>
                <th className="px-3 py-2 text-left font-medium">Student Name</th>
                <th className="px-3 py-2 text-left font-medium">Provider</th>
                <th className="px-3 py-2 text-left font-medium">Country</th>
                <th className="px-3 py-2 text-left font-medium">Start Intake</th>
                <th className="px-3 py-2 text-left font-medium">Commission %</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Total Received</th>
                <th className="px-3 py-2 text-left font-medium">Notes</th>
                <th className="px-3 py-2 text-center font-medium w-[100px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 12 }).map((_, j) => (
                      <td key={j} className="px-3 py-2"><Skeleton className="h-4 w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : students && students.length > 0 ? (
                students.map((student, idx) => (
                  <tr
                    key={student.id}
                    className={`border-t hover:bg-muted/50 cursor-pointer ${STATUS_ROW_COLORS[student.status || ""] || ""}`}
                    onClick={() => navigate(`/commission-tracker/${student.id}`)}
                    data-testid={`row-student-${student.id}`}
                  >
                    <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                    <td className="px-3 py-2 truncate max-w-[120px]" title={student.agentName}>{student.agentName}</td>
                    <td className="px-3 py-2 font-mono text-xs">{student.studentId || "-"}</td>
                    <td className="px-3 py-2 font-medium truncate max-w-[160px]" title={student.studentName}>{student.studentName}</td>
                    <td className="px-3 py-2 truncate max-w-[140px]" title={student.provider}>{student.provider}</td>
                    <td className="px-3 py-2">{student.country}</td>
                    <td className="px-3 py-2">{student.startIntake || "-"}</td>
                    <td className="px-3 py-2">{student.commissionRatePct ? `${student.commissionRatePct}%` : "-"}</td>
                    <td className="px-3 py-2">
                      <Badge className={`${STATUS_COLORS[student.status || ""] || "bg-gray-100 text-gray-800"} text-xs`} data-testid={`badge-status-${student.id}`}>
                        {student.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      ${Number(student.totalReceived || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground truncate max-w-[180px]" title={student.notes || ""}>{student.notes || "-"}</td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => navigate(`/commission-tracker/${student.id}`)}
                          data-testid={`button-view-${student.id}`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm("Delete this student and all term entries?")) {
                                deleteMutation.mutate(student.id);
                              }
                            }}
                            data-testid={`button-delete-${student.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={12} className="px-3 py-8 text-center text-muted-foreground">
                    No students found. {canCreate ? "Click \"Add Student\" to get started." : ""}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {students && (
        <p className="text-xs text-muted-foreground" data-testid="text-count">
          Showing {students.length} student{students.length !== 1 ? "s" : ""}
        </p>
      )}
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
    country: "AU",
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
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Agent Name *</Label>
          <Input value={form.agentName} onChange={(e) => update("agentName", e.target.value)} required data-testid="input-agent-name" />
        </div>
        <div>
          <Label>Student Name *</Label>
          <Input value={form.studentName} onChange={(e) => update("studentName", e.target.value)} required data-testid="input-student-name" />
        </div>
        <div>
          <Label>Student ID</Label>
          <Input value={form.studentId} onChange={(e) => update("studentId", e.target.value)} data-testid="input-student-id" />
        </div>
        <div>
          <Label>Agentsic ID</Label>
          <Input value={form.agentsicId} onChange={(e) => update("agentsicId", e.target.value)} data-testid="input-agentsic-id" />
        </div>
        <div>
          <Label>Provider *</Label>
          <Input value={form.provider} onChange={(e) => update("provider", e.target.value)} required data-testid="input-provider" />
        </div>
        <div>
          <Label>Country</Label>
          <Input value={form.country} onChange={(e) => update("country", e.target.value)} data-testid="input-country" />
        </div>
        <div>
          <Label>Start Intake</Label>
          <Input value={form.startIntake} onChange={(e) => update("startIntake", e.target.value)} placeholder="e.g. T1 2025" data-testid="input-start-intake" />
        </div>
        <div>
          <Label>Course Level</Label>
          <Select value={form.courseLevel} onValueChange={(v) => update("courseLevel", v)}>
            <SelectTrigger data-testid="select-course-level">
              <SelectValue placeholder="Select level" />
            </SelectTrigger>
            <SelectContent>
              {["Diploma", "Diploma Leading Bachelor", "Bachelor", "Master", "Eap leading Master", "PhD", "Certificate", "Other"].map((l) => (
                <SelectItem key={l} value={l}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2">
          <Label>Course Name</Label>
          <Input value={form.courseName} onChange={(e) => update("courseName", e.target.value)} data-testid="input-course-name" />
        </div>
        <div>
          <Label>Course Duration (Years)</Label>
          <Input type="number" step="0.5" value={form.courseDurationYears} onChange={(e) => update("courseDurationYears", e.target.value)} data-testid="input-duration" />
        </div>
        <div>
          <Label>Commission Rate (%)</Label>
          <Input type="number" step="0.01" value={form.commissionRatePct} onChange={(e) => update("commissionRatePct", e.target.value)} data-testid="input-commission-rate" />
        </div>
        <div>
          <Label>GST Applicable</Label>
          <Select value={form.gstApplicable} onValueChange={(v) => update("gstApplicable", v)}>
            <SelectTrigger data-testid="select-gst">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Yes">Yes</SelectItem>
              <SelectItem value="No">No</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Scholarship Type</Label>
          <Select value={form.scholarshipType} onValueChange={(v) => update("scholarshipType", v)}>
            <SelectTrigger data-testid="select-scholarship-type">
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
            <Label>Scholarship Value</Label>
            <Input type="number" step="0.01" value={form.scholarshipValue} onChange={(e) => update("scholarshipValue", e.target.value)} data-testid="input-scholarship-value" />
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-student">
          {createMutation.isPending ? "Adding..." : "Add Student"}
        </Button>
      </div>
    </form>
  );
}
