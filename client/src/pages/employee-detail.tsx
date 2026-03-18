import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, Save, FileText, Upload, Download, Trash2, Send, CheckCircle, Clock, Loader2, Plus,
} from "lucide-react";

interface Employee {
  id: string; fullName: string; email: string; phone: string; position: string;
  department: string; citizenshipNo: string; panNo: string; permanentAddress: string;
  joinDate: string | null; status: string;
}

interface EmploymentAgreement {
  id: string; employeeId: string; templateId: string | null; agreementDate: string | null;
  effectiveFrom: string | null; effectiveTo: string | null; position: string;
  grossSalary: string; clauses: any[]; status: string; pdfUrl: string;
  signedAt: string | null; signedPdfUrl: string; employeeName: string; createdAt: string;
}

interface DocFile {
  id: string; category: string; categoryLabel: string; fileName: string;
  originalFileName: string; fileSize: number; uploadedBy: string; uploadedAt: string;
}

interface DocsResponse {
  total: number; summary: string;
  categories: Record<string, DocFile[]>;
}

interface Template { id: string; name: string; clauses: any[]; }

async function apiRequest(url: string, options?: RequestInit) {
  const res = await fetch(url, { credentials: "include", ...options });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Request failed (${res.status})`);
  }
  return res.json();
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const AGREEMENT_STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-800",
  sent: "bg-amber-100 text-amber-800",
  signed: "bg-emerald-100 text-emerald-800",
};

const DOC_CATEGORIES = [
  { key: "cv", label: "CV / Resume" },
  { key: "citizenship", label: "Citizenship Certificate" },
  { key: "tax", label: "Tax / PAN Document" },
  { key: "academic", label: "Academic Certificates" },
  { key: "other", label: "Other Documents" },
];

export default function EmployeeDetailPage({ params }: { params: { id: string } }) {
  const employeeId = params.id;
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Employee>>({});

  const { data: employee, isLoading } = useQuery<Employee>({
    queryKey: ["/api/employees", employeeId],
    queryFn: () => apiRequest(`/api/employees/${employeeId}`),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Employee>) =>
      apiRequest(`/api/employees/${employeeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees", employeeId] });
      setEditing(false);
      toast({ title: "Employee updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!employee) {
    return <div className="p-6 text-center text-muted-foreground">Employee not found</div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto" data-testid="page-employee-detail">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/employees")} data-testid="button-back-employees">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold" data-testid="text-employee-name">{employee.fullName}</h1>
          <p className="text-sm text-muted-foreground">{employee.position} {employee.department ? `• ${employee.department}` : ""}</p>
        </div>
        <Badge className={employee.status === "active" ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-800"}>
          {employee.status}
        </Badge>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="mb-4">
          <TabsTrigger value="profile" data-testid="tab-profile">Profile</TabsTrigger>
          <TabsTrigger value="agreements" data-testid="tab-agreements">Agreements</TabsTrigger>
          <TabsTrigger value="documents" data-testid="tab-documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileTab
            employee={employee}
            editing={editing}
            editForm={editForm}
            onStartEdit={() => { setEditing(true); setEditForm(employee); }}
            onCancel={() => setEditing(false)}
            onSave={() => updateMutation.mutate(editForm)}
            onChange={setEditForm}
            isSaving={updateMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="agreements">
          <AgreementsTab employeeId={employeeId} employee={employee} />
        </TabsContent>

        <TabsContent value="documents">
          <DocumentsTab employeeId={employeeId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProfileTab({
  employee, editing, editForm, onStartEdit, onCancel, onSave, onChange, isSaving,
}: {
  employee: Employee; editing: boolean; editForm: Partial<Employee>;
  onStartEdit: () => void; onCancel: () => void; onSave: () => void;
  onChange: (f: Partial<Employee>) => void; isSaving: boolean;
}) {
  const fields = [
    { key: "fullName", label: "Full Name" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "position", label: "Position" },
    { key: "department", label: "Department" },
    { key: "citizenshipNo", label: "Citizenship No" },
    { key: "panNo", label: "PAN No" },
    { key: "joinDate", label: "Join Date", type: "date" },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Employee Information</CardTitle>
        {!editing ? (
          <Button size="sm" variant="outline" onClick={onStartEdit} data-testid="button-edit-profile">Edit</Button>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button size="sm" onClick={onSave} disabled={isSaving} data-testid="button-save-profile">
              <Save className="w-3.5 h-3.5 mr-1" /> {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {fields.map(({ key, label, type }) => (
            <div key={key}>
              <label className="text-xs font-medium text-muted-foreground">{label}</label>
              {editing ? (
                <Input
                  type={type || "text"}
                  value={(editForm as any)[key] || ""}
                  onChange={(e) => onChange({ ...editForm, [key]: e.target.value })}
                  className="mt-1"
                  data-testid={`input-edit-${key}`}
                />
              ) : (
                <p className="text-sm mt-1" data-testid={`text-${key}`}>{(employee as any)[key] || "—"}</p>
              )}
            </div>
          ))}
          <div className="col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Permanent Address</label>
            {editing ? (
              <Textarea
                value={editForm.permanentAddress || ""}
                onChange={(e) => onChange({ ...editForm, permanentAddress: e.target.value })}
                className="mt-1"
                rows={2}
                data-testid="input-edit-address"
              />
            ) : (
              <p className="text-sm mt-1">{employee.permanentAddress || "—"}</p>
            )}
          </div>
          {editing && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select value={editForm.status || "active"} onValueChange={(v) => onChange({ ...editForm, status: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="terminated">Terminated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AgreementsTab({ employeeId, employee }: { employeeId: string; employee: Employee }) {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    templateId: "", agreementDate: "", effectiveFrom: "", effectiveTo: "", position: "", grossSalary: "",
  });

  const { data: agreementsData, isLoading } = useQuery<{ results?: EmploymentAgreement[] }>({
    queryKey: ["/api/employment-agreements", employeeId],
    queryFn: () => apiRequest(`/api/employment-agreements?employeeId=${employeeId}`),
  });

  const agreements: EmploymentAgreement[] = agreementsData?.results || (Array.isArray(agreementsData) ? agreementsData : []);

  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
    queryFn: () => apiRequest("/api/templates"),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("/api/employment-agreements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, employeeId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employment-agreements", employeeId] });
      setShowCreate(false);
      toast({ title: "Agreement created" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const sendMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/employment-agreements/${id}/send-for-signing`, { method: "POST" }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/employment-agreements", employeeId] });
      toast({ title: "Agreement sent for signing", description: data.emailSent ? "Email sent to employee" : "Email sending may have failed" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold">Employment Agreements</h3>
        <Button size="sm" onClick={() => setShowCreate(true)} data-testid="button-create-agreement">
          <Plus className="w-4 h-4 mr-1" /> Create Agreement
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : agreements.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <FileText className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">No agreements yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {agreements.map((agr) => (
            <Card key={agr.id} data-testid={`card-agreement-${agr.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{agr.position || "Employment Agreement"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {agr.effectiveFrom} {agr.effectiveTo ? `to ${agr.effectiveTo}` : ""}
                      {agr.grossSalary ? ` • NPR ${Number(agr.grossSalary).toLocaleString()}` : ""}
                    </p>
                    {agr.signedAt && (
                      <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Signed on {new Date(agr.signedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`text-[10px] ${AGREEMENT_STATUS_COLORS[agr.status] || "bg-gray-100"}`}>
                      {agr.status}
                    </Badge>
                    {agr.status === "draft" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => sendMutation.mutate(agr.id)}
                        disabled={sendMutation.isPending}
                        data-testid={`button-send-${agr.id}`}
                      >
                        <Send className="w-3.5 h-3.5 mr-1" />
                        {sendMutation.isPending ? "Sending..." : "Send for Signing"}
                      </Button>
                    )}
                    {agr.status === "sent" && (
                      <span className="text-xs text-amber-600 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Awaiting signature
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Employment Agreement</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium mb-1 block">Template</label>
              <Select value={createForm.templateId} onValueChange={(v) => setCreateForm({ ...createForm, templateId: v })}>
                <SelectTrigger data-testid="select-template"><SelectValue placeholder="Select a template" /></SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Position</label>
              <Input value={createForm.position} onChange={(e) => setCreateForm({ ...createForm, position: e.target.value })} placeholder={employee.position} data-testid="input-agr-position" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1 block">Effective From</label>
                <Input type="date" value={createForm.effectiveFrom} onChange={(e) => setCreateForm({ ...createForm, effectiveFrom: e.target.value })} data-testid="input-agr-from" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Effective To</label>
                <Input type="date" value={createForm.effectiveTo} onChange={(e) => setCreateForm({ ...createForm, effectiveTo: e.target.value })} data-testid="input-agr-to" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1 block">Agreement Date</label>
                <Input type="date" value={createForm.agreementDate} onChange={(e) => setCreateForm({ ...createForm, agreementDate: e.target.value })} data-testid="input-agr-date" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Gross Salary (NPR)</label>
                <Input type="number" value={createForm.grossSalary} onChange={(e) => setCreateForm({ ...createForm, grossSalary: e.target.value })} data-testid="input-agr-salary" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate(createForm)}
              disabled={!createForm.templateId || createMutation.isPending}
              data-testid="button-submit-agreement"
            >
              {createMutation.isPending ? "Creating..." : "Create Agreement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DocumentsTab({ employeeId }: { employeeId: string }) {
  const { toast } = useToast();
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<DocFile | null>(null);

  const { data: docsData, isLoading } = useQuery<DocsResponse>({
    queryKey: ["/api/employees", employeeId, "documents"],
    queryFn: () => apiRequest(`/api/employees/${employeeId}/documents`),
  });

  const deleteMutation = useMutation({
    mutationFn: (docId: string) =>
      apiRequest(`/api/employee-documents/${docId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees", employeeId, "documents"] });
      setDeleteDoc(null);
      toast({ title: "Document deleted" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleUpload = async (category: string, file: File) => {
    setUploading(category);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", category);
    try {
      await apiRequest(`/api/employees/${employeeId}/documents`, {
        method: "POST",
        body: formData,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/employees", employeeId, "documents"] });
      toast({ title: "Document uploaded" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    }
    setUploading(null);
  };

  const handleDownload = async (doc: DocFile) => {
    try {
      const res = await fetch(`/api/employee-documents/${doc.id}/download`, { credentials: "include" });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.originalFileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: "Download failed", description: err.message, variant: "destructive" });
    }
  };

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="space-y-4">
      {docsData && (
        <p className="text-sm text-muted-foreground" data-testid="text-doc-summary">{docsData.summary}</p>
      )}

      <Accordion type="multiple" defaultValue={DOC_CATEGORIES.map((c) => c.key)}>
        {DOC_CATEGORIES.map(({ key, label }) => {
          const docs = docsData?.categories?.[key] || [];
          return (
            <AccordionItem key={key} value={key}>
              <AccordionTrigger className="text-sm font-medium" data-testid={`accordion-${key}`}>
                {label} ({docs.length})
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {docs.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-2 border rounded-md" data-testid={`doc-${doc.id}`}>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{doc.originalFileName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatSize(doc.fileSize)} • {new Date(doc.uploadedAt).toLocaleDateString()}
                          {doc.uploadedBy && ` • ${doc.uploadedBy}`}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0 ml-2">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDownload(doc)} data-testid={`button-download-${doc.id}`}>
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => setDeleteDoc(doc)} data-testid={`button-delete-doc-${doc.id}`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  <input
                    ref={(el) => { fileInputRefs.current[key] = el; }}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload(key, file);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    disabled={uploading === key}
                    onClick={() => fileInputRefs.current[key]?.click()}
                    data-testid={`button-upload-${key}`}
                  >
                    {uploading === key ? (
                      <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Uploading...</>
                    ) : (
                      <><Upload className="w-3.5 h-3.5 mr-1" /> Upload {label}</>
                    )}
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      <AlertDialog open={!!deleteDoc} onOpenChange={() => setDeleteDoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteDoc?.originalFileName}"? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteDoc && deleteMutation.mutate(deleteDoc.id)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
