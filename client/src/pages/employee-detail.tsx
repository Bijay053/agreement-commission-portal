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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft, Save, FileText, Upload, Download, Trash2, Send, CheckCircle, Clock,
  Loader2, Plus, Eye, Edit, UploadCloud, RefreshCw, File, FileImage, FileArchive,
  MoreHorizontal, X, Briefcase, Mail,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const CURRENCIES = [
  { code: 'NPR', label: 'NPR - Nepalese Rupee', symbol: 'रू' },
  { code: 'AUD', label: 'AUD - Australian Dollar', symbol: 'A$' },
  { code: 'USD', label: 'USD - US Dollar', symbol: '$' },
  { code: 'GBP', label: 'GBP - British Pound', symbol: '£' },
  { code: 'CAD', label: 'CAD - Canadian Dollar', symbol: 'C$' },
  { code: 'BDT', label: 'BDT - Bangladeshi Taka', symbol: '৳' },
  { code: 'EUR', label: 'EUR - Euro', symbol: '€' },
  { code: 'NZD', label: 'NZD - New Zealand Dollar', symbol: 'NZ$' },
];

const AGREEMENT_STATUSES: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  sent: { label: 'Sent for Signing', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  awaiting_signature: { label: 'Awaiting Signature', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  signed: { label: 'Signed', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  manually_signed: { label: 'Manually Signed', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  completed: { label: 'Completed', color: 'bg-green-50 text-green-700 border-green-200' },
  expired: { label: 'Expired', color: 'bg-red-50 text-red-700 border-red-200' },
  terminated: { label: 'Terminated', color: 'bg-rose-50 text-rose-700 border-rose-200' },
};

const OFFER_STATUSES: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  sent: { label: 'Sent', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  accepted: { label: 'Accepted', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { label: 'Rejected', color: 'bg-red-50 text-red-700 border-red-200' },
  manually_signed: { label: 'Manually Signed', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  completed: { label: 'Completed', color: 'bg-green-50 text-green-700 border-green-200' },
};

const DOC_CATEGORIES = [
  { key: 'id_passport', label: 'ID / Passport', icon: '🪪' },
  { key: 'contract_agreement', label: 'Contract / Agreement', icon: '📄' },
  { key: 'offer_letter', label: 'Offer Letter', icon: '📋' },
  { key: 'joining', label: 'Joining Documents', icon: '📁' },
  { key: 'cv', label: 'CV / Resume', icon: '📝' },
  { key: 'citizenship', label: 'Citizenship Certificate', icon: '🏛️' },
  { key: 'tax', label: 'Tax / PAN Document', icon: '🧾' },
  { key: 'academic', label: 'Academic Certificates', icon: '🎓' },
  { key: 'other', label: 'Other Documents', icon: '📎' },
];

interface Employee {
  id: string; fullName: string; email: string; phone: string; position: string;
  department: string; citizenshipNo: string; panNo: string; permanentAddress: string;
  joinDate: string | null; salaryAmount: string; salaryCurrency: string; status: string;
}

interface Agreement {
  id: string; employeeId: string; templateId: string | null; agreementDate: string | null;
  effectiveFrom: string | null; effectiveTo: string | null; position: string;
  grossSalary: string; salaryCurrency: string; clauses: any[]; status: string; pdfUrl: string;
  signedAt: string | null; signedPdfUrl: string; manuallySignedPdfUrl: string;
  notes: string; createdBy: string; createdAt: string;
}

interface OfferLetter {
  id: string; employeeId: string; templateId: string | null; title: string;
  position: string; department: string; proposedSalary: string; salaryCurrency: string;
  issueDate: string | null; startDate: string | null; workLocation: string;
  workingHours: string; benefits: string; probationPeriod: string;
  clauses: any[]; status: string; pdfUrl: string; signedPdfUrl: string;
  notes: string; createdBy: string; createdAt: string;
}

interface DocFile {
  id: string; category: string; categoryLabel: string; fileName: string;
  originalFileName: string; fileSize: number; fileType: string;
  uploadedBy: string; uploadedAt: string;
}

interface DocsResponse {
  total: number; summary: string;
  categories: Record<string, DocFile[]>;
}

function formatBytes(bytes: number) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getCurrencySymbol(code: string) {
  return CURRENCIES.find(c => c.code === code)?.symbol || code;
}

function StatusBadge({ status, map }: { status: string; map: Record<string, { label: string; color: string }> }) {
  const s = map[status] || { label: status, color: 'bg-gray-100 text-gray-600 border-gray-200' };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${s.color}`}>{s.label}</span>;
}

function ProfileTab({ employee, onUpdate }: { employee: Employee; onUpdate: () => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(employee);
  const { toast } = useToast();

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/employees/${employee.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Profile updated" });
      queryClient.invalidateQueries({ queryKey: ['/api/employees', employee.id] });
      setEditing(false);
      onUpdate();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleSave = () => {
    saveMutation.mutate({
      fullName: form.fullName, email: form.email, phone: form.phone,
      position: form.position, department: form.department,
      citizenshipNo: form.citizenshipNo, panNo: form.panNo,
      permanentAddress: form.permanentAddress, joinDate: form.joinDate,
      salaryAmount: form.salaryAmount, salaryCurrency: form.salaryCurrency,
      status: form.status,
    });
  };

  const fields = [
    { label: 'Full Name', key: 'fullName', type: 'text' },
    { label: 'Email', key: 'email', type: 'email' },
    { label: 'Phone', key: 'phone', type: 'text' },
    { label: 'Position', key: 'position', type: 'text' },
    { label: 'Department', key: 'department', type: 'text' },
    { label: 'Join Date', key: 'joinDate', type: 'date' },
    { label: 'Citizenship No', key: 'citizenshipNo', type: 'text' },
    { label: 'PAN No', key: 'panNo', type: 'text' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold" data-testid="text-profile-heading">Employee Profile</h3>
        <div className="flex gap-2">
          {editing ? (
            <>
              <Button variant="outline" size="sm" onClick={() => { setForm(employee); setEditing(false); }} data-testid="button-cancel-edit">Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save-profile">
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                Save
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => { setForm(employee); setEditing(true); }} data-testid="button-edit-profile">
              <Edit className="w-4 h-4 mr-1" /> Edit
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
        {fields.map(f => (
          <div key={f.key} className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{f.label}</label>
            {editing ? (
              <Input
                type={f.type}
                value={(form as any)[f.key] || ''}
                onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                data-testid={`input-${f.key}`}
              />
            ) : (
              <p className="text-sm font-medium" data-testid={`text-${f.key}`}>
                {f.type === 'date' ? formatDate((employee as any)[f.key]) : ((employee as any)[f.key] || '—')}
              </p>
            )}
          </div>
        ))}

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Salary</label>
          {editing ? (
            <div className="flex gap-2">
              <Select value={form.salaryCurrency} onValueChange={v => setForm({ ...form, salaryCurrency: v })}>
                <SelectTrigger className="w-[110px]" data-testid="select-salary-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map(c => <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input
                type="number"
                placeholder="Amount"
                value={form.salaryAmount || ''}
                onChange={e => setForm({ ...form, salaryAmount: e.target.value })}
                data-testid="input-salary-amount"
              />
            </div>
          ) : (
            <p className="text-sm font-medium" data-testid="text-salary">
              {employee.salaryAmount ? `${getCurrencySymbol(employee.salaryCurrency)} ${Number(employee.salaryAmount).toLocaleString()} ${employee.salaryCurrency}` : '—'}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</label>
          {editing ? (
            <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
              <SelectTrigger data-testid="select-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="terminated">Terminated</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Badge variant={employee.status === 'active' ? 'default' : 'secondary'}
              className={employee.status === 'active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : employee.status === 'terminated' ? 'bg-red-100 text-red-700 hover:bg-red-100' : ''}
              data-testid="badge-status"
            >
              {employee.status}
            </Badge>
          )}
        </div>

        <div className="space-y-1.5 md:col-span-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Permanent Address</label>
          {editing ? (
            <Textarea
              value={form.permanentAddress || ''}
              onChange={e => setForm({ ...form, permanentAddress: e.target.value })}
              rows={2}
              data-testid="input-permanentAddress"
            />
          ) : (
            <p className="text-sm font-medium" data-testid="text-permanentAddress">{employee.permanentAddress || '—'}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function AgreementsTab({ employeeId, employee }: { employeeId: string; employee: Employee }) {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [uploadAgreementId, setUploadAgreementId] = useState<string | null>(null);
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const [createForm, setCreateForm] = useState({
    templateId: '', position: employee.position || '', effectiveFrom: '', effectiveTo: '',
    agreementDate: '', grossSalary: employee.salaryAmount || '', salaryCurrency: employee.salaryCurrency || 'NPR',
  });

  const { data: agreements = [], isLoading } = useQuery<Agreement[]>({
    queryKey: ['/api/employment-agreements', { employeeId }],
    queryFn: async () => {
      const r = await fetch(`/api/employment-agreements?employeeId=${employeeId}`, { credentials: 'include' });
      if (!r.ok) throw new Error('Failed to fetch agreements');
      const d = await r.json();
      return d.results || d;
    },
  });

  const { data: templates = [] } = useQuery<any[]>({
    queryKey: ['/api/templates', { type: 'agreement' }],
    queryFn: async () => {
      const r = await fetch('/api/templates?type=agreement', { credentials: 'include' });
      if (!r.ok) throw new Error('Failed to fetch templates');
      return r.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/employment-agreements', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ ...data, employeeId }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Agreement created" });
      queryClient.invalidateQueries({ queryKey: ['/api/employment-agreements'] });
      setShowCreate(false);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const sendMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/employment-agreements/${id}/send-for-signing`, {
        method: 'POST', credentials: 'include',
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: (d) => {
      toast({ title: d.emailSent ? "Agreement sent for signing" : "Agreement marked as sent (email delivery pending)" });
      queryClient.invalidateQueries({ queryKey: ['/api/employment-agreements'] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/employment-agreements/${id}/status`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Status updated" });
      queryClient.invalidateQueries({ queryKey: ['/api/employment-agreements'] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const uploadSignedMutation = useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/employment-agreements/${id}/upload-signed`, {
        method: 'POST', credentials: 'include', body: fd,
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Signed agreement uploaded" });
      queryClient.invalidateQueries({ queryKey: ['/api/employment-agreements'] });
      setUploadAgreementId(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filtered = statusFilter === 'all' ? agreements : agreements.filter(a => a.status === statusFilter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Agreements</h3>
          <Badge variant="secondary" className="text-xs">{agreements.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px] h-8 text-xs" data-testid="select-agreement-status-filter">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(AGREEMENT_STATUSES).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => setShowCreate(true)} data-testid="button-create-agreement">
            <Plus className="w-4 h-4 mr-1" /> New Agreement
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No agreements found</p>
        </CardContent></Card>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs">Position</TableHead>
                <TableHead className="text-xs">Period</TableHead>
                <TableHead className="text-xs">Salary</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Created</TableHead>
                <TableHead className="text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(a => (
                <TableRow key={a.id} data-testid={`row-agreement-${a.id}`}>
                  <TableCell className="font-medium text-sm">{a.position || '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(a.effectiveFrom)} — {formatDate(a.effectiveTo)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {a.grossSalary ? `${getCurrencySymbol(a.salaryCurrency)} ${Number(a.grossSalary).toLocaleString()}` : '—'}
                  </TableCell>
                  <TableCell><StatusBadge status={a.status} map={AGREEMENT_STATUSES} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(a.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-agreement-actions-${a.id}`}>
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {a.pdfUrl && (
                          <DropdownMenuItem onClick={() => window.open(`/api/employment-agreements/${a.id}/download`, '_blank')}>
                            <Eye className="w-4 h-4 mr-2" /> View PDF
                          </DropdownMenuItem>
                        )}
                        {a.manuallySignedPdfUrl && (
                          <DropdownMenuItem onClick={() => window.open(`/api/employment-agreements/${a.id}/download?type=signed`, '_blank')}>
                            <Eye className="w-4 h-4 mr-2" /> View Signed Copy
                          </DropdownMenuItem>
                        )}
                        {a.status === 'draft' && (
                          <DropdownMenuItem onClick={() => sendMutation.mutate(a.id)}>
                            <Send className="w-4 h-4 mr-2" /> Send for Signing
                          </DropdownMenuItem>
                        )}
                        {['draft', 'sent', 'awaiting_signature'].includes(a.status) && (
                          <DropdownMenuItem onClick={() => { setUploadAgreementId(a.id); setTimeout(() => uploadRef.current?.click(), 100); }}>
                            <UploadCloud className="w-4 h-4 mr-2" /> Upload Signed Copy
                          </DropdownMenuItem>
                        )}
                        {['draft', 'sent', 'awaiting_signature'].includes(a.status) && (
                          <DropdownMenuItem onClick={() => statusMutation.mutate({ id: a.id, status: 'manually_signed' })}>
                            <CheckCircle className="w-4 h-4 mr-2" /> Mark as Manually Signed
                          </DropdownMenuItem>
                        )}
                        {['signed', 'manually_signed'].includes(a.status) && (
                          <DropdownMenuItem onClick={() => statusMutation.mutate({ id: a.id, status: 'completed' })}>
                            <CheckCircle className="w-4 h-4 mr-2" /> Mark as Completed
                          </DropdownMenuItem>
                        )}
                        {!['signed', 'completed', 'manually_signed'].includes(a.status) && (
                          <DropdownMenuItem onClick={() => statusMutation.mutate({ id: a.id, status: 'expired' })}>
                            <Clock className="w-4 h-4 mr-2" /> Mark as Expired
                          </DropdownMenuItem>
                        )}
                        {!['completed', 'terminated'].includes(a.status) && (
                          <DropdownMenuItem onClick={() => statusMutation.mutate({ id: a.id, status: 'terminated' })} className="text-red-600">
                            <X className="w-4 h-4 mr-2" /> Terminate
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <input type="file" ref={uploadRef} className="hidden" accept=".pdf,.doc,.docx,.jpg,.png"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f && uploadAgreementId) uploadSignedMutation.mutate({ id: uploadAgreementId, file: f });
          e.target.value = '';
        }}
      />

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Employment Agreement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Template</label>
              <Select value={createForm.templateId} onValueChange={v => setCreateForm({ ...createForm, templateId: v })}>
                <SelectTrigger data-testid="select-agreement-template"><SelectValue placeholder="Select template" /></SelectTrigger>
                <SelectContent>
                  {templates.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Position</label>
                <Input value={createForm.position} onChange={e => setCreateForm({ ...createForm, position: e.target.value })} data-testid="input-agreement-position" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Agreement Date</label>
                <Input type="date" value={createForm.agreementDate} onChange={e => setCreateForm({ ...createForm, agreementDate: e.target.value })} data-testid="input-agreement-date" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Effective From</label>
                <Input type="date" value={createForm.effectiveFrom} onChange={e => setCreateForm({ ...createForm, effectiveFrom: e.target.value })} data-testid="input-agreement-from" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Effective To</label>
                <Input type="date" value={createForm.effectiveTo} onChange={e => setCreateForm({ ...createForm, effectiveTo: e.target.value })} data-testid="input-agreement-to" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Gross Salary</label>
              <div className="flex gap-2">
                <Select value={createForm.salaryCurrency} onValueChange={v => setCreateForm({ ...createForm, salaryCurrency: v })}>
                  <SelectTrigger className="w-[100px]" data-testid="select-agreement-currency"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input type="number" placeholder="Amount" value={createForm.grossSalary}
                  onChange={e => setCreateForm({ ...createForm, grossSalary: e.target.value })}
                  data-testid="input-agreement-salary" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate(createForm)} disabled={createMutation.isPending} data-testid="button-submit-agreement">
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Create Agreement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OfferLettersTab({ employeeId, employee }: { employeeId: string; employee: Employee }) {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [uploadOfferId, setUploadOfferId] = useState<string | null>(null);
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const [createForm, setCreateForm] = useState({
    templateId: '', title: 'Job Offer Letter', position: employee.position || '',
    department: employee.department || '', proposedSalary: employee.salaryAmount || '',
    salaryCurrency: employee.salaryCurrency || 'NPR', issueDate: '', startDate: '',
    workLocation: '', probationPeriod: '',
  });

  const { data: offers = [], isLoading } = useQuery<OfferLetter[]>({
    queryKey: ['/api/offer-letters', { employeeId }],
    queryFn: async () => {
      const r = await fetch(`/api/offer-letters?employeeId=${employeeId}`, { credentials: 'include' });
      if (!r.ok) throw new Error('Failed to fetch offer letters');
      const d = await r.json();
      return d.results || d;
    },
  });

  const { data: templates = [] } = useQuery<any[]>({
    queryKey: ['/api/templates', { type: 'offer_letter' }],
    queryFn: async () => {
      const r = await fetch('/api/templates?type=offer_letter', { credentials: 'include' });
      if (!r.ok) throw new Error('Failed to fetch templates');
      return r.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/offer-letters', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ ...data, employeeId }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Offer letter created" });
      queryClient.invalidateQueries({ queryKey: ['/api/offer-letters'] });
      setShowCreate(false);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/offer-letters/${id}/status`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Status updated" });
      queryClient.invalidateQueries({ queryKey: ['/api/offer-letters'] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const uploadSignedMutation = useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/offer-letters/${id}/upload-signed`, {
        method: 'POST', credentials: 'include', body: fd,
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Signed offer letter uploaded" });
      queryClient.invalidateQueries({ queryKey: ['/api/offer-letters'] });
      setUploadOfferId(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/offer-letters/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error((await res.json()).message);
    },
    onSuccess: () => {
      toast({ title: "Offer letter deleted" });
      queryClient.invalidateQueries({ queryKey: ['/api/offer-letters'] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filtered = statusFilter === 'all' ? offers : offers.filter(o => o.status === statusFilter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Offer Letters</h3>
          <Badge variant="secondary" className="text-xs">{offers.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px] h-8 text-xs" data-testid="select-offer-status-filter">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(OFFER_STATUSES).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => setShowCreate(true)} data-testid="button-create-offer">
            <Plus className="w-4 h-4 mr-1" /> New Offer Letter
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Briefcase className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No offer letters found</p>
        </CardContent></Card>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs">Title</TableHead>
                <TableHead className="text-xs">Position</TableHead>
                <TableHead className="text-xs">Salary</TableHead>
                <TableHead className="text-xs">Issue Date</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(o => (
                <TableRow key={o.id} data-testid={`row-offer-${o.id}`}>
                  <TableCell className="font-medium text-sm">{o.title}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{o.position || '—'}</TableCell>
                  <TableCell className="text-sm">
                    {o.proposedSalary ? `${getCurrencySymbol(o.salaryCurrency)} ${Number(o.proposedSalary).toLocaleString()}` : '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(o.issueDate)}</TableCell>
                  <TableCell><StatusBadge status={o.status} map={OFFER_STATUSES} /></TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-offer-actions-${o.id}`}>
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {o.status === 'draft' && (
                          <DropdownMenuItem onClick={() => statusMutation.mutate({ id: o.id, status: 'sent' })}>
                            <Send className="w-4 h-4 mr-2" /> Mark as Sent
                          </DropdownMenuItem>
                        )}
                        {['draft', 'sent'].includes(o.status) && (
                          <DropdownMenuItem onClick={() => statusMutation.mutate({ id: o.id, status: 'accepted' })}>
                            <CheckCircle className="w-4 h-4 mr-2" /> Mark as Accepted
                          </DropdownMenuItem>
                        )}
                        {['draft', 'sent'].includes(o.status) && (
                          <DropdownMenuItem onClick={() => statusMutation.mutate({ id: o.id, status: 'rejected' })}>
                            <X className="w-4 h-4 mr-2" /> Mark as Rejected
                          </DropdownMenuItem>
                        )}
                        {['draft', 'sent'].includes(o.status) && (
                          <DropdownMenuItem onClick={() => { setUploadOfferId(o.id); setTimeout(() => uploadRef.current?.click(), 100); }}>
                            <UploadCloud className="w-4 h-4 mr-2" /> Upload Signed Copy
                          </DropdownMenuItem>
                        )}
                        {['accepted', 'manually_signed'].includes(o.status) && (
                          <DropdownMenuItem onClick={() => statusMutation.mutate({ id: o.id, status: 'completed' })}>
                            <CheckCircle className="w-4 h-4 mr-2" /> Mark as Completed
                          </DropdownMenuItem>
                        )}
                        {o.status === 'draft' && (
                          <DropdownMenuItem onClick={() => deleteMutation.mutate(o.id)} className="text-red-600">
                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <input type="file" ref={uploadRef} className="hidden" accept=".pdf,.doc,.docx,.jpg,.png"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f && uploadOfferId) uploadSignedMutation.mutate({ id: uploadOfferId, file: f });
          e.target.value = '';
        }}
      />

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Offer Letter</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Template (Optional)</label>
              <Select value={createForm.templateId} onValueChange={v => setCreateForm({ ...createForm, templateId: v })}>
                <SelectTrigger data-testid="select-offer-template"><SelectValue placeholder="Select template" /></SelectTrigger>
                <SelectContent>
                  {templates.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Title</label>
                <Input value={createForm.title} onChange={e => setCreateForm({ ...createForm, title: e.target.value })} data-testid="input-offer-title" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Position</label>
                <Input value={createForm.position} onChange={e => setCreateForm({ ...createForm, position: e.target.value })} data-testid="input-offer-position" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Department</label>
                <Input value={createForm.department} onChange={e => setCreateForm({ ...createForm, department: e.target.value })} data-testid="input-offer-department" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Probation Period</label>
                <Input value={createForm.probationPeriod} onChange={e => setCreateForm({ ...createForm, probationPeriod: e.target.value })} placeholder="e.g. 6 months" data-testid="input-offer-probation" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Issue Date</label>
                <Input type="date" value={createForm.issueDate} onChange={e => setCreateForm({ ...createForm, issueDate: e.target.value })} data-testid="input-offer-issue-date" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Start Date</label>
                <Input type="date" value={createForm.startDate} onChange={e => setCreateForm({ ...createForm, startDate: e.target.value })} data-testid="input-offer-start-date" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Proposed Salary</label>
              <div className="flex gap-2">
                <Select value={createForm.salaryCurrency} onValueChange={v => setCreateForm({ ...createForm, salaryCurrency: v })}>
                  <SelectTrigger className="w-[100px]" data-testid="select-offer-currency"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input type="number" placeholder="Amount" value={createForm.proposedSalary}
                  onChange={e => setCreateForm({ ...createForm, proposedSalary: e.target.value })}
                  data-testid="input-offer-salary" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Work Location</label>
              <Input value={createForm.workLocation} onChange={e => setCreateForm({ ...createForm, workLocation: e.target.value })} data-testid="input-offer-location" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate(createForm)} disabled={createMutation.isPending} data-testid="button-submit-offer">
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Create Offer Letter
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
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<DocFile | null>(null);
  const [replaceDoc, setReplaceDoc] = useState<DocFile | null>(null);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');

  const { data: docsData, isLoading } = useQuery<DocsResponse>({
    queryKey: ['/api/employees', employeeId, 'documents'],
    queryFn: async () => {
      const r = await fetch(`/api/employees/${employeeId}/documents`, { credentials: 'include' });
      if (!r.ok) throw new Error('Failed to fetch documents');
      return r.json();
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ category, file }: { category: string; file: File }) => {
      setUploading(category);
      const fd = new FormData();
      fd.append('file', file);
      fd.append('category', category);
      const res = await fetch(`/api/employees/${employeeId}/documents`, {
        method: 'POST', credentials: 'include', body: fd,
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Document uploaded" });
      queryClient.invalidateQueries({ queryKey: ['/api/employees', employeeId, 'documents'] });
      setUploading(null);
    },
    onError: (e: Error) => {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
      setUploading(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/employee-documents/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error((await res.json()).message);
    },
    onSuccess: () => {
      toast({ title: "Document deleted" });
      queryClient.invalidateQueries({ queryKey: ['/api/employees', employeeId, 'documents'] });
      setDeleteDoc(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const replaceMutation = useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/employee-documents/${id}/replace`, {
        method: 'POST', credentials: 'include', body: fd,
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Document replaced" });
      queryClient.invalidateQueries({ queryKey: ['/api/employees', employeeId, 'documents'] });
      setReplaceDoc(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const getFileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return <FileImage className="w-4 h-4 text-blue-500" />;
    if (['zip', 'rar', '7z'].includes(ext || '')) return <FileArchive className="w-4 h-4 text-amber-500" />;
    return <File className="w-4 h-4 text-slate-500" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Documents</h3>
          {docsData && <Badge variant="secondary" className="text-xs">{docsData.total}</Badge>}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : (
        <div className="space-y-4">
          {DOC_CATEGORIES.map(cat => {
            const docs = docsData?.categories?.[cat.key] || [];
            return (
              <Card key={cat.key} className="overflow-hidden">
                <CardHeader className="py-3 px-4 bg-muted/30 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{cat.icon}</span>
                    <CardTitle className="text-sm font-medium">{cat.label}</CardTitle>
                    <Badge variant="secondary" className="text-[10px] h-5">{docs.length}</Badge>
                  </div>
                  <Button
                    variant="outline" size="sm"
                    className="h-7 text-xs"
                    disabled={uploading === cat.key}
                    onClick={() => fileInputRefs.current[cat.key]?.click()}
                    data-testid={`button-upload-${cat.key}`}
                  >
                    {uploading === cat.key ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Upload className="w-3 h-3 mr-1" />}
                    Upload
                  </Button>
                  <input
                    type="file"
                    className="hidden"
                    ref={el => { fileInputRefs.current[cat.key] = el; }}
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) uploadMutation.mutate({ category: cat.key, file: f });
                      e.target.value = '';
                    }}
                  />
                </CardHeader>
                {docs.length > 0 && (
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {docs.map((doc: DocFile) => (
                        <div key={doc.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/20 transition-colors" data-testid={`doc-${doc.id}`}>
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {getFileIcon(doc.originalFileName)}
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{doc.originalFileName}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {formatBytes(doc.fileSize)} {doc.uploadedBy && `· ${doc.uploadedBy}`} · {formatDate(doc.uploadedAt)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button variant="ghost" size="icon" className="h-7 w-7"
                              onClick={() => window.open(`/api/employee-documents/${doc.id}/download`, '_blank')}
                              data-testid={`button-download-${doc.id}`}
                            >
                              <Download className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7"
                              onClick={() => { setReplaceDoc(doc); setTimeout(() => replaceInputRef.current?.click(), 100); }}
                              data-testid={`button-replace-${doc.id}`}
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600"
                              onClick={() => setDeleteDoc(doc)}
                              data-testid={`button-delete-${doc.id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <input
        type="file"
        ref={replaceInputRef}
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f && replaceDoc) replaceMutation.mutate({ id: replaceDoc.id, file: f });
          e.target.value = '';
        }}
      />

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

export default function EmployeeDetailPage({ params }: { params: { id: string } }) {
  const [, navigate] = useLocation();
  const employeeId = params.id;

  const { data: employee, isLoading } = useQuery<Employee>({
    queryKey: ['/api/employees', employeeId],
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Employee not found</p>
        <Button variant="ghost" onClick={() => navigate('/employees')}>Back to Employees</Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/employees')} data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight" data-testid="text-employee-name">{employee.fullName}</h1>
              <Badge
                variant={employee.status === 'active' ? 'default' : 'secondary'}
                className={employee.status === 'active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200' : employee.status === 'terminated' ? 'bg-red-100 text-red-700 hover:bg-red-100 border-red-200' : ''}
                data-testid="badge-employee-status"
              >
                {employee.status}
              </Badge>
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
              {employee.position && <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" />{employee.position}</span>}
              {employee.department && <span>· {employee.department}</span>}
              {employee.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{employee.email}</span>}
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 h-10" data-testid="tabs-employee">
          <TabsTrigger value="profile" className="text-sm" data-testid="tab-profile">Profile</TabsTrigger>
          <TabsTrigger value="agreements" className="text-sm" data-testid="tab-agreements">Agreements</TabsTrigger>
          <TabsTrigger value="offer-letters" className="text-sm" data-testid="tab-offer-letters">Offer Letters</TabsTrigger>
          <TabsTrigger value="documents" className="text-sm" data-testid="tab-documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardContent className="pt-6">
              <ProfileTab employee={employee} onUpdate={() => queryClient.invalidateQueries({ queryKey: ['/api/employees', employeeId] })} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agreements">
          <AgreementsTab employeeId={employeeId} employee={employee} />
        </TabsContent>

        <TabsContent value="offer-letters">
          <OfferLettersTab employeeId={employeeId} employee={employee} />
        </TabsContent>

        <TabsContent value="documents">
          <DocumentsTab employeeId={employeeId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
