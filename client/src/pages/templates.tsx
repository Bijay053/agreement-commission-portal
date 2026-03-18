import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, Pencil, Copy, Trash2, GripVertical, X, Save, ChevronUp, ChevronDown, FileText, Download, Eye,
  Bold, Italic, Underline,
} from "lucide-react";

interface Clause {
  id: string;
  title: string;
  content: string;
  is_editable: boolean;
  order: number;
}

interface Template {
  id: string;
  name: string;
  description: string;
  templateType: string;
  clauses: Clause[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

async function apiRequest(url: string, options?: RequestInit) {
  const res = await fetch(url, { credentials: "include", ...options });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Request failed (${res.status})`);
  }
  return res.json();
}

function ClauseContentEditor({ value, onChange, index }: { value: string; onChange: (val: string) => void; index: number }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const wrapSelection = (prefix: string, suffix: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = el.value;
    const selected = text.slice(start, end);

    if (selected && text.slice(start - prefix.length, start) === prefix && text.slice(end, end + suffix.length) === suffix) {
      const newVal = text.slice(0, start - prefix.length) + selected + text.slice(end + suffix.length);
      onChange(newVal);
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start - prefix.length, end - prefix.length);
      }, 0);
      return;
    }

    if (selected && selected.startsWith(prefix) && selected.endsWith(suffix)) {
      const unwrapped = selected.slice(prefix.length, -suffix.length);
      const newVal = text.slice(0, start) + unwrapped + text.slice(end);
      onChange(newVal);
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start, start + unwrapped.length);
      }, 0);
      return;
    }

    const wrapped = prefix + selected + suffix;
    const newVal = text.slice(0, start) + wrapped + text.slice(end);
    onChange(newVal);
    setTimeout(() => {
      el.focus();
      if (selected) {
        el.setSelectionRange(start, start + wrapped.length);
      } else {
        el.setSelectionRange(start + prefix.length, start + prefix.length);
      }
    }, 0);
  };

  return (
    <div className="border rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
      <div className="flex items-center gap-0.5 px-2 py-1 bg-gray-50 border-b">
        <button
          type="button"
          onClick={() => wrapSelection("**", "**")}
          className="p-1.5 rounded hover:bg-gray-200 transition-colors"
          title="Bold (**text**)"
          data-testid={`button-bold-${index}`}
        >
          <Bold className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => wrapSelection("*", "*")}
          className="p-1.5 rounded hover:bg-gray-200 transition-colors"
          title="Italic (*text*)"
          data-testid={`button-italic-${index}`}
        >
          <Italic className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => wrapSelection("__", "__")}
          className="p-1.5 rounded hover:bg-gray-200 transition-colors"
          title="Underline (__text__)"
          data-testid={`button-underline-${index}`}
        >
          <Underline className="w-3.5 h-3.5" />
        </button>
        <span className="ml-2 text-[10px] text-gray-400">Use **bold**, *italic*, __underline__</span>
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Clause content..."
        rows={4}
        className="w-full text-sm resize-y min-h-[80px] p-3 border-0 outline-none focus:ring-0"
        data-testid={`input-clause-content-${index}`}
      />
    </div>
  );
}

export default function TemplatesPage() {
  const { toast } = useToast();
  const searchString = useSearch();
  const searchParams = useMemo(() => new URLSearchParams(searchString), [searchString]);
  const templateType = searchParams.get('type') || 'agreement';
  const typeLabel = templateType === 'offer_letter' ? 'Offer Letter' : 'Agreement';

  const [editing, setEditing] = useState<Template | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);

  useEffect(() => {
    setEditing(null);
    setIsNew(false);
    setDeleteTarget(null);
  }, [templateType]);

  const { data: templates = [], isLoading } = useQuery<Template[]>({
    queryKey: ["/api/templates", { type: templateType }],
    queryFn: () => apiRequest(`/api/templates?type=${templateType}`),
  });

  const invalidateTemplates = () => queryClient.invalidateQueries({ queryKey: ["/api/templates"] });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Template>) =>
      apiRequest("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, templateType }),
      }),
    onSuccess: () => {
      invalidateTemplates();
      setEditing(null);
      setIsNew(false);
      toast({ title: "Template created" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: Partial<Template> & { id: string }) =>
      apiRequest(`/api/templates/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      invalidateTemplates();
      setEditing(null);
      toast({ title: "Template saved" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/templates/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidateTemplates();
      setDeleteTarget(null);
      if (editing?.id === deleteTarget?.id) setEditing(null);
      toast({ title: "Template deleted" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/templates/${id}/duplicate`, { method: "POST" }),
    onSuccess: () => {
      invalidateTemplates();
      toast({ title: "Template duplicated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const seedMutation = useMutation({
    mutationFn: () =>
      apiRequest("/api/templates/seed-default", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: templateType }),
      }),
    onSuccess: () => {
      invalidateTemplates();
      toast({ title: "Default template created" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleNew = () => {
    setEditing({
      id: "",
      name: "",
      description: "",
      templateType,
      clauses: [],
      isDefault: false,
      createdAt: "",
      updatedAt: "",
    });
    setIsNew(true);
  };

  const handleEdit = (t: Template) => {
    setEditing(JSON.parse(JSON.stringify(t)));
    setIsNew(false);
  };

  const handleSave = () => {
    if (!editing) return;
    const payload = {
      name: editing.name,
      description: editing.description,
      clauses: editing.clauses,
    };
    if (isNew) {
      createMutation.mutate(payload);
    } else {
      updateMutation.mutate({ id: editing.id, ...payload });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex h-full" data-testid="page-templates">
      <div className="w-[360px] border-r bg-background flex flex-col shrink-0">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-sm font-semibold" data-testid="text-templates-title">{typeLabel} Templates</h2>
          <Button size="sm" onClick={handleNew} data-testid="button-new-template">
            <Plus className="w-4 h-4 mr-1" /> New Template
          </Button>
        </div>
        <div className="flex-1 overflow-auto p-3 space-y-2">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))
          ) : templates.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <FileText className="w-10 h-10 mx-auto text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No templates yet</p>
              <Button size="sm" variant="outline" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending} data-testid="button-seed-default">
                Create Default Template
              </Button>
            </div>
          ) : (
            templates.map((t) => (
              <Card
                key={t.id}
                className={`cursor-pointer transition-colors hover:border-primary/40 ${editing?.id === t.id ? "border-primary ring-1 ring-primary/20" : ""}`}
                onClick={() => handleEdit(t)}
                data-testid={`card-template-${t.id}`}
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{t.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t.clauses.length} clause{t.clauses.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {t.isDefault && (
                        <Badge variant="secondary" className="text-[10px] h-5">Default</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={(e) => { e.stopPropagation(); handleEdit(t); }}
                      data-testid={`button-edit-template-${t.id}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={(e) => { e.stopPropagation(); duplicateMutation.mutate(t.id); }}
                      data-testid={`button-duplicate-template-${t.id}`}
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={(e) => { e.stopPropagation(); window.open(`/api/templates/${t.id}/download?mode=view`, '_blank'); }}
                      data-testid={`button-preview-template-${t.id}`}
                      title="Preview PDF"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={(e) => { e.stopPropagation(); window.open(`/api/templates/${t.id}/download`, '_blank'); }}
                      data-testid={`button-download-template-${t.id}`}
                      title="Download PDF"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-red-500 hover:text-red-600"
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(t); }}
                      data-testid={`button-delete-template-${t.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-accent/10">
        {editing ? (
          <TemplateEditor
            template={editing}
            onChange={setEditing}
            onSave={handleSave}
            onCancel={() => { setEditing(null); setIsNew(false); }}
            isSaving={isSaving}
            isNew={isNew}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center space-y-2">
              <FileText className="w-12 h-12 mx-auto opacity-30" />
              <p className="text-sm">Select a template to edit or create a new one</p>
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.name}"? This cannot be undone.
              {deleteTarget?.isDefault && (
                <span className="block mt-2 font-medium text-red-600">
                  Warning: This is the default template. Deleting it may affect new agreements/offer letters. You can re-create it using "Create Default Template".
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TemplateEditor({
  template,
  onChange,
  onSave,
  onCancel,
  isSaving,
  isNew,
}: {
  template: Template;
  onChange: (t: Template) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
  isNew: boolean;
}) {
  const updateClause = useCallback(
    (index: number, field: keyof Clause, value: string | boolean | number) => {
      const newClauses = [...template.clauses];
      newClauses[index] = { ...newClauses[index], [field]: value };
      onChange({ ...template, clauses: newClauses });
    },
    [template, onChange]
  );

  const addClause = () => {
    const maxOrder = template.clauses.reduce((max, c) => Math.max(max, c.order), 0);
    onChange({
      ...template,
      clauses: [
        ...template.clauses,
        {
          id: `clause_${Date.now()}`,
          title: "",
          content: "",
          is_editable: true,
          order: maxOrder + 1,
        },
      ],
    });
  };

  const removeClause = (index: number) => {
    const newClauses = template.clauses.filter((_, i) => i !== index);
    newClauses.forEach((c, i) => (c.order = i + 1));
    onChange({ ...template, clauses: newClauses });
  };

  const moveClause = (index: number, direction: "up" | "down") => {
    const newClauses = [...template.clauses];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newClauses.length) return;
    [newClauses[index], newClauses[swapIndex]] = [newClauses[swapIndex], newClauses[index]];
    newClauses.forEach((c, i) => (c.order = i + 1));
    onChange({ ...template, clauses: newClauses });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold" data-testid="text-editor-title">
          {isNew ? "New Template" : "Edit Template"}
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} data-testid="button-cancel-edit">
            <X className="w-4 h-4 mr-1" /> Cancel
          </Button>
          <Button size="sm" onClick={onSave} disabled={isSaving || !template.name.trim()} data-testid="button-save-template">
            <Save className="w-4 h-4 mr-1" /> {isSaving ? "Saving..." : "Save Template"}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Template Name</label>
            <Input
              value={template.name}
              onChange={(e) => onChange({ ...template, name: e.target.value })}
              placeholder="e.g. Standard Employment Contract"
              data-testid="input-template-name"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
            <Textarea
              value={template.description}
              onChange={(e) => onChange({ ...template, description: e.target.value })}
              placeholder="Brief description of this template..."
              rows={2}
              data-testid="input-template-description"
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">
            Clauses ({template.clauses.length})
          </h3>
          <Button size="sm" variant="outline" onClick={addClause} data-testid="button-add-clause">
            <Plus className="w-4 h-4 mr-1" /> Add Clause
          </Button>
        </div>

        {template.clauses.length === 0 && (
          <div className="text-center py-8 border border-dashed rounded-lg">
            <p className="text-sm text-muted-foreground">No clauses yet. Click "Add Clause" to start building your template.</p>
          </div>
        )}

        {template.clauses.map((clause, index) => (
          <Card key={clause.id} className="group" data-testid={`card-clause-${index}`}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button
                    className="p-0.5 rounded hover:bg-accent disabled:opacity-30"
                    disabled={index === 0}
                    onClick={() => moveClause(index, "up")}
                    data-testid={`button-move-up-${index}`}
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    className="p-0.5 rounded hover:bg-accent disabled:opacity-30"
                    disabled={index === template.clauses.length - 1}
                    onClick={() => moveClause(index, "down")}
                    data-testid={`button-move-down-${index}`}
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
                <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                <Badge variant="outline" className="text-[10px] shrink-0">
                  {index + 1}
                </Badge>
                <Input
                  value={clause.title}
                  onChange={(e) => updateClause(index, "title", e.target.value)}
                  placeholder="Clause title"
                  className="flex-1 h-8 text-sm font-medium"
                  data-testid={`input-clause-title-${index}`}
                />
                <div className="flex items-center gap-2 shrink-0">
                  <label className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {clause.is_editable ? "Editable" : "Fixed"}
                  </label>
                  <Switch
                    checked={clause.is_editable}
                    onCheckedChange={(v) => updateClause(index, "is_editable", v)}
                    data-testid={`switch-editable-${index}`}
                  />
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-red-500 hover:text-red-600 shrink-0"
                  onClick={() => removeClause(index)}
                  data-testid={`button-remove-clause-${index}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              <ClauseContentEditor
                value={clause.content}
                onChange={(val) => updateClause(index, "content", val)}
                index={index}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
