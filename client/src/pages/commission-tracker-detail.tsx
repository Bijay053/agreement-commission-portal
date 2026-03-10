import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Edit2, Save, X, Plus, Trash2, AlertTriangle, RefreshCw } from "lucide-react";
import type { CommissionStudent, CommissionEntry } from "@shared/schema";

const STATUS_COLORS: Record<string, string> = {
  "Withdrawn": "bg-red-100 text-red-800",
  "Complete": "bg-green-100 text-green-800",
  "On Break": "bg-orange-100 text-orange-800",
  "Claim Next Semester": "bg-yellow-100 text-yellow-800",
  "Under Enquiry": "bg-blue-100 text-blue-800",
  "Active": "bg-emerald-100 text-emerald-800",
};

const PAYMENT_COLORS: Record<string, string> = {
  "Pending": "bg-yellow-100 text-yellow-800",
  "Received": "bg-green-100 text-green-800",
  "Reversed": "bg-red-100 text-red-800",
  "Hold": "bg-orange-100 text-orange-800",
};

const TERM_NAMES = ["T1_2025", "T2_2025", "T3_2025"];
const TERM_LABELS: Record<string, string> = { T1_2025: "T1 2025", T2_2025: "T2 2025", T3_2025: "T3 2025" };

type StudentWithEntries = CommissionStudent & { entries: CommissionEntry[] };

export default function CommissionTrackerDetailPage() {
  const [, params] = useRoute("/commission-tracker/:id");
  const [, navigate] = useLocation();
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const studentId = Number(params?.id);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<CommissionStudent>>({});

  const canEdit = hasPermission("commission_tracker.student.update");
  const canEditEntry = hasPermission("commission_tracker.entry.update");
  const canCreateEntry = hasPermission("commission_tracker.entry.add");
  const canDeleteEntry = hasPermission("commission_tracker.entry.delete");
  const canViewEntry = hasPermission("commission_tracker.entry.read");

  const { data: studentData, isLoading } = useQuery<StudentWithEntries>({
    queryKey: ["/api/commission-tracker/students", studentId],
  });

  const updateStudentMutation = useMutation({
    mutationFn: async (data: Partial<CommissionStudent>) => {
      const res = await apiRequest("PATCH", `/api/commission-tracker/students/${studentId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/commission-tracker/students", studentId] });
      queryClient.invalidateQueries({ queryKey: ["/api/commission-tracker/students"] });
      queryClient.invalidateQueries({ queryKey: ["/api/commission-tracker/dashboard"] });
      setEditing(false);
      toast({ title: "Student updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const recalculateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/commission-tracker/students/${studentId}/recalculate`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/commission-tracker/students", studentId] });
      queryClient.invalidateQueries({ queryKey: ["/api/commission-tracker/students"] });
      toast({ title: "Recalculated successfully" });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!studentData) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Student not found</p>
        <Button variant="link" onClick={() => navigate("/commission-tracker")}>Back to list</Button>
      </div>
    );
  }

  const student = studentData;
  const entries = student.entries || [];

  const getEntryForTerm = (term: string) => entries.find(e => e.termName === term);

  const isTermBlocked = (term: string): boolean => {
    const termIdx = TERM_NAMES.indexOf(term);
    for (let i = 0; i < termIdx; i++) {
      const prevEntry = getEntryForTerm(TERM_NAMES[i]);
      if (prevEntry) {
        const st = prevEntry.studentStatus || "";
        if (st === "Withdrawn" || st === "Complete") return true;
      }
    }
    return false;
  };

  const startEditing = () => {
    setEditForm({
      agentName: student.agentName,
      studentId: student.studentId,
      agentsicId: student.agentsicId,
      studentName: student.studentName,
      provider: student.provider,
      country: student.country,
      startIntake: student.startIntake,
      courseLevel: student.courseLevel,
      courseName: student.courseName,
      courseDurationYears: student.courseDurationYears,
      commissionRatePct: student.commissionRatePct,
      gstApplicable: student.gstApplicable,
      scholarshipType: student.scholarshipType,
      scholarshipValue: student.scholarshipValue,
    });
    setEditing(true);
  };

  return (
    <div className="p-4 md:p-6 space-y-6" data-testid="commission-tracker-detail">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/commission-tracker")} data-testid="button-back">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold" data-testid="text-student-name">{student.studentName}</h1>
          <p className="text-sm text-muted-foreground">
            {student.provider} &middot; {student.country} &middot; {student.startIntake || "N/A"}
          </p>
        </div>
        <Badge className={`${STATUS_COLORS[student.status || ""] || ""} text-sm`} data-testid="badge-student-status">
          {student.status}
        </Badge>
        {canEdit && (
          <Button variant="outline" size="sm" onClick={() => recalculateMutation.mutate()} disabled={recalculateMutation.isPending} data-testid="button-recalculate">
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Recalculate
          </Button>
        )}
      </div>

      <Card data-testid="card-student-info">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">Student Information</CardTitle>
          {canEdit && !editing && (
            <Button variant="outline" size="sm" onClick={startEditing} data-testid="button-edit-student">
              <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Label>Agent Name</Label>
                <Input value={editForm.agentName || ""} onChange={(e) => setEditForm({ ...editForm, agentName: e.target.value })} data-testid="input-edit-agent" />
              </div>
              <div>
                <Label>Student Name</Label>
                <Input value={editForm.studentName || ""} onChange={(e) => setEditForm({ ...editForm, studentName: e.target.value })} data-testid="input-edit-student-name" />
              </div>
              <div>
                <Label>Student ID</Label>
                <Input value={editForm.studentId || ""} onChange={(e) => setEditForm({ ...editForm, studentId: e.target.value })} data-testid="input-edit-student-id" />
              </div>
              <div>
                <Label>Agentsic ID</Label>
                <Input value={editForm.agentsicId || ""} onChange={(e) => setEditForm({ ...editForm, agentsicId: e.target.value })} data-testid="input-edit-agentsic" />
              </div>
              <div>
                <Label>Provider</Label>
                <Input value={editForm.provider || ""} onChange={(e) => setEditForm({ ...editForm, provider: e.target.value })} data-testid="input-edit-provider" />
              </div>
              <div>
                <Label>Country</Label>
                <Input value={editForm.country || ""} onChange={(e) => setEditForm({ ...editForm, country: e.target.value })} data-testid="input-edit-country" />
              </div>
              <div>
                <Label>Start Intake</Label>
                <Input value={editForm.startIntake || ""} onChange={(e) => setEditForm({ ...editForm, startIntake: e.target.value })} data-testid="input-edit-intake" />
              </div>
              <div>
                <Label>Course Level</Label>
                <Input value={editForm.courseLevel || ""} onChange={(e) => setEditForm({ ...editForm, courseLevel: e.target.value })} data-testid="input-edit-level" />
              </div>
              <div>
                <Label>Course Name</Label>
                <Input value={editForm.courseName || ""} onChange={(e) => setEditForm({ ...editForm, courseName: e.target.value })} data-testid="input-edit-course" />
              </div>
              <div>
                <Label>Commission Rate (%)</Label>
                <Input type="number" step="0.01" value={editForm.commissionRatePct || ""} onChange={(e) => setEditForm({ ...editForm, commissionRatePct: e.target.value })} data-testid="input-edit-rate" />
              </div>
              <div>
                <Label>GST Applicable</Label>
                <Select value={editForm.gstApplicable || "Yes"} onValueChange={(v) => setEditForm({ ...editForm, gstApplicable: v })}>
                  <SelectTrigger data-testid="select-edit-gst"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Yes">Yes</SelectItem>
                    <SelectItem value="No">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Scholarship Type</Label>
                <Select value={editForm.scholarshipType || "None"} onValueChange={(v) => setEditForm({ ...editForm, scholarshipType: v })}>
                  <SelectTrigger data-testid="select-edit-sch-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="None">None</SelectItem>
                    <SelectItem value="Percent">Percent</SelectItem>
                    <SelectItem value="Fixed">Fixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editForm.scholarshipType !== "None" && (
                <div>
                  <Label>Scholarship Value</Label>
                  <Input type="number" step="0.01" value={editForm.scholarshipValue || ""} onChange={(e) => setEditForm({ ...editForm, scholarshipValue: e.target.value })} data-testid="input-edit-sch-value" />
                </div>
              )}
              <div className="col-span-full flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEditing(false)} data-testid="button-cancel-edit">
                  <X className="w-3.5 h-3.5 mr-1" /> Cancel
                </Button>
                <Button onClick={() => updateStudentMutation.mutate(editForm)} disabled={updateStudentMutation.isPending} data-testid="button-save-student">
                  <Save className="w-3.5 h-3.5 mr-1" /> {updateStudentMutation.isPending ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <InfoField label="Agent Name" value={student.agentName} />
              <InfoField label="Student ID" value={student.studentId || "-"} />
              <InfoField label="Agentsic ID" value={student.agentsicId || "-"} />
              <InfoField label="Provider" value={student.provider} />
              <InfoField label="Country" value={student.country} />
              <InfoField label="Start Intake" value={student.startIntake || "-"} />
              <InfoField label="Course Level" value={student.courseLevel || "-"} />
              <InfoField label="Course Name" value={student.courseName || "-"} />
              <InfoField label="Course Duration" value={student.courseDurationYears ? `${student.courseDurationYears} yrs` : "-"} />
              <InfoField label="Commission Rate" value={student.commissionRatePct ? `${student.commissionRatePct}%` : "-"} />
              <InfoField label="GST Applicable" value={student.gstApplicable} />
              <InfoField label="GST Rate" value={student.gstRatePct ? `${student.gstRatePct}%` : "-"} />
              <InfoField label="Scholarship" value={student.scholarshipType === "None" ? "None" : `${student.scholarshipType}: ${student.scholarshipValue}`} />
              <InfoField label="Total Received" value={`$${Number(student.totalReceived || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} highlight />
              <div className="col-span-full">
                <InfoField label="Notes (Auto)" value={student.notes || "-"} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue={TERM_NAMES[0]} data-testid="tabs-terms">
        <TabsList>
          {TERM_NAMES.map((term) => {
            const entry = getEntryForTerm(term);
            const blocked = isTermBlocked(term);
            return (
              <TabsTrigger key={term} value={term} disabled={blocked} className={blocked ? "opacity-50" : ""} data-testid={`tab-${term}`}>
                {TERM_LABELS[term]}
                {entry && (
                  <Badge className={`ml-2 text-[10px] ${STATUS_COLORS[entry.studentStatus || ""] || ""}`}>
                    {entry.studentStatus}
                  </Badge>
                )}
                {blocked && <span className="ml-1 text-[10px] text-destructive">(Blocked)</span>}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {TERM_NAMES.map((term) => {
          const entry = getEntryForTerm(term);
          const blocked = isTermBlocked(term);

          return (
            <TabsContent key={term} value={term} data-testid={`tab-content-${term}`}>
              {blocked ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                    <p className="text-muted-foreground">This term is blocked because a previous term has status Withdrawn or Complete.</p>
                  </CardContent>
                </Card>
              ) : entry ? (
                <TermEntryCard
                  entry={entry}
                  student={student}
                  studentId={studentId}
                  canEdit={canEditEntry}
                  canDelete={canDeleteEntry}
                />
              ) : canCreateEntry ? (
                <AddEntryCard studentId={studentId} termName={term} />
              ) : (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    No entry for this term yet.
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}

function InfoField({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-medium ${highlight ? "text-green-600" : ""}`} data-testid={`info-${label.toLowerCase().replace(/\s/g, "-")}`}>{value}</p>
    </div>
  );
}

function TermEntryCard({ entry, student, studentId, canEdit, canDelete }: {
  entry: CommissionEntry;
  student: CommissionStudent;
  studentId: number;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/commission-tracker/students", studentId] });
    queryClient.invalidateQueries({ queryKey: ["/api/commission-tracker/students"] });
    queryClient.invalidateQueries({ queryKey: ["/api/commission-tracker/dashboard"] });
  };

  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await apiRequest("PATCH", `/api/commission-tracker/entries/${entry.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      invalidateAll();
      setEditing(false);
      toast({ title: "Entry updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/commission-tracker/entries/${entry.id}`);
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Entry deleted" });
    },
  });

  const startEditing = () => {
    setForm({
      academicYear: entry.academicYear || "",
      feeGross: entry.feeGross || "0",
      commissionRateOverridePct: entry.commissionRateOverridePct || "",
      bonus: entry.bonus || "0",
      paymentStatus: entry.paymentStatus || "Pending",
      paidDate: entry.paidDate || "",
      invoiceNo: entry.invoiceNo || "",
      paymentRef: entry.paymentRef || "",
      notes: entry.notes || "",
      studentStatus: entry.studentStatus || "Under Enquiry",
      scholarshipTypeOverride: entry.scholarshipTypeOverride || "",
      scholarshipValueOverride: entry.scholarshipValueOverride || "",
    });
    setEditing(true);
  };

  const update = (field: string, value: string) => setForm({ ...form, [field]: value });

  return (
    <Card data-testid={`card-entry-${entry.termName}`}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg">{TERM_LABELS[entry.termName]} Entry</CardTitle>
        <div className="flex gap-2">
          {canEdit && !editing && (
            <Button variant="outline" size="sm" onClick={startEditing} data-testid="button-edit-entry">
              <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
            </Button>
          )}
          {canDelete && !editing && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive"
              onClick={() => setShowDeleteConfirm(true)}
              data-testid="button-delete-entry"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Label>Academic Year</Label>
                <Select value={form.academicYear} onValueChange={(v) => update("academicYear", v)}>
                  <SelectTrigger data-testid="select-academic-year"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Year 1">Year 1</SelectItem>
                    <SelectItem value="Year 2">Year 2</SelectItem>
                    <SelectItem value="Year 3">Year 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fee (Gross)</Label>
                <Input type="number" step="0.01" value={form.feeGross} onChange={(e) => update("feeGross", e.target.value)} data-testid="input-fee-gross" />
              </div>
              <div>
                <Label>Commission Rate Override (%)</Label>
                <Input type="number" step="0.01" value={form.commissionRateOverridePct} onChange={(e) => update("commissionRateOverridePct", e.target.value)} placeholder="Leave blank to use master rate" data-testid="input-rate-override" />
              </div>
              <div>
                <Label>Bonus</Label>
                <Input type="number" step="0.01" value={form.bonus} onChange={(e) => update("bonus", e.target.value)} data-testid="input-bonus" />
              </div>
              <div>
                <Label>Student Status</Label>
                <Select value={form.studentStatus} onValueChange={(v) => update("studentStatus", v)}>
                  <SelectTrigger data-testid="select-student-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Under Enquiry", "Claim Next Semester", "On Break", "Withdrawn", "Complete", "Active"].map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Payment Status</Label>
                <Select value={form.paymentStatus} onValueChange={(v) => update("paymentStatus", v)}>
                  <SelectTrigger data-testid="select-payment-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Pending", "Received", "Reversed", "Hold"].map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Paid Date</Label>
                <Input type="date" value={form.paidDate} onChange={(e) => update("paidDate", e.target.value)} data-testid="input-paid-date" />
              </div>
              <div>
                <Label>Invoice No</Label>
                <Input value={form.invoiceNo} onChange={(e) => update("invoiceNo", e.target.value)} data-testid="input-invoice" />
              </div>
              <div>
                <Label>Payment Ref</Label>
                <Input value={form.paymentRef} onChange={(e) => update("paymentRef", e.target.value)} data-testid="input-payment-ref" />
              </div>
              <div>
                <Label>Scholarship Type Override</Label>
                <Select value={form.scholarshipTypeOverride || "none_override"} onValueChange={(v) => update("scholarshipTypeOverride", v === "none_override" ? "" : v)}>
                  <SelectTrigger data-testid="select-sch-override"><SelectValue placeholder="No override" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none_override">No Override</SelectItem>
                    <SelectItem value="None">None</SelectItem>
                    <SelectItem value="Percent">Percent</SelectItem>
                    <SelectItem value="Fixed">Fixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.scholarshipTypeOverride && (
                <div>
                  <Label>Scholarship Value Override</Label>
                  <Input type="number" step="0.01" value={form.scholarshipValueOverride} onChange={(e) => update("scholarshipValueOverride", e.target.value)} data-testid="input-sch-value-override" />
                </div>
              )}
              <div className="col-span-full">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} rows={2} data-testid="input-entry-notes" />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditing(false)} data-testid="button-cancel-entry-edit">
                <X className="w-3.5 h-3.5 mr-1" /> Cancel
              </Button>
              <Button onClick={() => updateMutation.mutate(form)} disabled={updateMutation.isPending} data-testid="button-save-entry">
                <Save className="w-3.5 h-3.5 mr-1" /> {updateMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <InfoField label="Academic Year" value={entry.academicYear || "-"} />
              <InfoField label="Fee (Gross)" value={`$${Number(entry.feeGross || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
              <InfoField label="Student Status" value={entry.studentStatus || "-"} />
              <div>
                <p className="text-xs text-muted-foreground">Payment Status</p>
                <Badge className={PAYMENT_COLORS[entry.paymentStatus || ""] || ""} data-testid="badge-payment-status">
                  {entry.paymentStatus}
                </Badge>
              </div>
            </div>

            <div className="border rounded-lg p-4 bg-muted/30">
              <h4 className="text-sm font-semibold mb-3">Commission Calculation</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <InfoField label="Commission Rate (Master)" value={`${Number(entry.commissionRateAuto || 0)}%`} />
                <InfoField label="Commission Rate Override" value={entry.commissionRateOverridePct ? `${entry.commissionRateOverridePct}%` : "None"} />
                <InfoField label="Commission Rate Used" value={`${Number(entry.commissionRateUsedPct || 0)}%`} />
                <InfoField label="Commission Amount" value={`$${Number(entry.commissionAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
                <InfoField label="Bonus" value={`$${Number(entry.bonus || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
                <InfoField label="GST" value={`$${Number(entry.gstAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
                <InfoField label="Total" value={`$${Number(entry.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} highlight />
                {entry.rateChangeWarning && (
                  <div className="flex items-center gap-1 text-amber-600">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span className="text-xs">{entry.rateChangeWarning}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="border rounded-lg p-4 bg-muted/30">
              <h4 className="text-sm font-semibold mb-3">Scholarship</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <InfoField label="Type (Master)" value={entry.scholarshipTypeAuto || "-"} />
                <InfoField label="Value (Master)" value={entry.scholarshipValueAuto || "-"} />
                <InfoField label="Type Used" value={entry.scholarshipTypeUsed || "-"} />
                <InfoField label="Value Used" value={entry.scholarshipValueUsed || "-"} />
                <InfoField label="Scholarship Amount" value={`$${Number(entry.scholarshipAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
                <InfoField label="Fee After Scholarship" value={`$${Number(entry.feeAfterScholarship || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
                {entry.scholarshipChangeWarning && (
                  <div className="flex items-center gap-1 text-amber-600">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span className="text-xs">{entry.scholarshipChangeWarning}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <InfoField label="Paid Date" value={entry.paidDate || "-"} />
              <InfoField label="Invoice No" value={entry.invoiceNo || "-"} />
              <InfoField label="Payment Ref" value={entry.paymentRef || "-"} />
              <InfoField label="Notes" value={entry.notes || "-"} />
            </div>
          </div>
        )}
      </CardContent>

      <ConfirmModal
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        variant="danger"
        title="Delete Term Entry?"
        description="This will permanently remove this term entry and all its associated commission data. This action cannot be undone."
        confirmText="Delete Entry"
        onConfirm={() => deleteMutation.mutate()}
        data-testid="modal-delete-entry"
      />
    </Card>
  );
}

function AddEntryCard({ studentId, termName }: { studentId: number; termName: string }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    termName,
    academicYear: "",
    feeGross: "0",
    commissionRateOverridePct: "",
    bonus: "0",
    paymentStatus: "Pending",
    paidDate: "",
    invoiceNo: "",
    paymentRef: "",
    notes: "",
    studentStatus: "Under Enquiry",
    scholarshipTypeOverride: "",
    scholarshipValueOverride: "",
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await apiRequest("POST", `/api/commission-tracker/students/${studentId}/entries`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/commission-tracker/students", studentId] });
      queryClient.invalidateQueries({ queryKey: ["/api/commission-tracker/students"] });
      queryClient.invalidateQueries({ queryKey: ["/api/commission-tracker/dashboard"] });
      toast({ title: `${TERM_LABELS[termName]} entry created` });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const update = (field: string, value: string) => setForm({ ...form, [field]: value });

  return (
    <Card data-testid={`card-add-entry-${termName}`}>
      <CardHeader>
        <CardTitle className="text-lg">Add {TERM_LABELS[termName]} Entry</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <Label>Academic Year</Label>
            <Select value={form.academicYear} onValueChange={(v) => update("academicYear", v)}>
              <SelectTrigger data-testid="select-new-academic-year"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Year 1">Year 1</SelectItem>
                <SelectItem value="Year 2">Year 2</SelectItem>
                <SelectItem value="Year 3">Year 3</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Fee (Gross)</Label>
            <Input type="number" step="0.01" value={form.feeGross} onChange={(e) => update("feeGross", e.target.value)} data-testid="input-new-fee" />
          </div>
          <div>
            <Label>Bonus</Label>
            <Input type="number" step="0.01" value={form.bonus} onChange={(e) => update("bonus", e.target.value)} data-testid="input-new-bonus" />
          </div>
          <div>
            <Label>Commission Rate Override (%)</Label>
            <Input type="number" step="0.01" value={form.commissionRateOverridePct} onChange={(e) => update("commissionRateOverridePct", e.target.value)} placeholder="Leave blank for master rate" data-testid="input-new-rate-override" />
          </div>
          <div>
            <Label>Student Status</Label>
            <Select value={form.studentStatus} onValueChange={(v) => update("studentStatus", v)}>
              <SelectTrigger data-testid="select-new-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Under Enquiry", "Claim Next Semester", "On Break", "Withdrawn", "Complete", "Active"].map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Payment Status</Label>
            <Select value={form.paymentStatus} onValueChange={(v) => update("paymentStatus", v)}>
              <SelectTrigger data-testid="select-new-payment"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Pending", "Received", "Reversed", "Hold"].map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Paid Date</Label>
            <Input type="date" value={form.paidDate} onChange={(e) => update("paidDate", e.target.value)} data-testid="input-new-paid-date" />
          </div>
          <div>
            <Label>Invoice No</Label>
            <Input value={form.invoiceNo} onChange={(e) => update("invoiceNo", e.target.value)} data-testid="input-new-invoice" />
          </div>
          <div>
            <Label>Payment Ref</Label>
            <Input value={form.paymentRef} onChange={(e) => update("paymentRef", e.target.value)} data-testid="input-new-payment-ref" />
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <Button onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending} data-testid="button-create-entry">
            <Plus className="w-3.5 h-3.5 mr-1" /> {createMutation.isPending ? "Creating..." : "Create Entry"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
