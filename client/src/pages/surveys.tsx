import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Plus, Trash2, Copy, BarChart3, GripVertical, ArrowUp, ArrowDown,
  ClipboardList, Eye, Pencil, ExternalLink, Loader2,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

interface SurveyQuestion {
  id?: number;
  questionText: string;
  questionType: string;
  options: string[];
  isRequired: boolean;
  sortOrder: number;
  config: Record<string, any>;
}

interface Survey {
  id: number;
  uuid: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
  responseCount: number;
  questions?: SurveyQuestion[];
}

const QUESTION_TYPES = [
  { value: "short_text", label: "Short Text" },
  { value: "long_text", label: "Long Text" },
  { value: "rating", label: "Rating (1-N)" },
  { value: "star_rating", label: "Star Rating" },
  { value: "range", label: "Range/Slider" },
  { value: "single_choice", label: "Single Choice (Radio)" },
  { value: "multiple_choice", label: "Multiple Choice (Checkboxes)" },
  { value: "dropdown", label: "Dropdown" },
];

function QuestionEditor({
  question,
  index,
  total,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  question: SurveyQuestion;
  index: number;
  total: number;
  onChange: (q: SurveyQuestion) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const hasOptions = ["single_choice", "multiple_choice", "dropdown"].includes(question.questionType);
  const hasRatingConfig = ["rating", "star_rating"].includes(question.questionType);
  const hasRangeConfig = question.questionType === "range";

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-background" data-testid={`question-editor-${index}`}>
      <div className="flex items-start gap-2">
        <div className="flex flex-col gap-1 mt-1">
          <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={onMoveUp} disabled={index === 0} data-testid={`button-move-up-${index}`}>
            <ArrowUp className="w-3 h-3" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={onMoveDown} disabled={index === total - 1} data-testid={`button-move-down-${index}`}>
            <ArrowDown className="w-3 h-3" />
          </Button>
        </div>
        <div className="flex-1 space-y-3">
          <div className="flex gap-2">
            <Input
              value={question.questionText}
              onChange={(e) => onChange({ ...question, questionText: e.target.value })}
              placeholder="Question text"
              className="flex-1"
              data-testid={`input-question-text-${index}`}
            />
            <Select value={question.questionType} onValueChange={(v) => onChange({ ...question, questionType: v, options: ["single_choice", "multiple_choice", "dropdown"].includes(v) ? question.options.length ? question.options : ["Option 1"] : [], config: {} })}>
              <SelectTrigger className="w-48" data-testid={`select-question-type-${index}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUESTION_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {hasOptions && (
            <div className="space-y-2 pl-2">
              <Label className="text-xs text-muted-foreground">Options</Label>
              {question.options.map((opt, oi) => (
                <div key={oi} className="flex gap-2 items-center">
                  <Input
                    value={opt}
                    onChange={(e) => {
                      const newOpts = [...question.options];
                      newOpts[oi] = e.target.value;
                      onChange({ ...question, options: newOpts });
                    }}
                    placeholder={`Option ${oi + 1}`}
                    className="flex-1"
                    data-testid={`input-option-${index}-${oi}`}
                  />
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => {
                    const newOpts = question.options.filter((_, i) => i !== oi);
                    onChange({ ...question, options: newOpts });
                  }} data-testid={`button-remove-option-${index}-${oi}`}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...question, options: [...question.options, `Option ${question.options.length + 1}`] })} data-testid={`button-add-option-${index}`}>
                <Plus className="w-3 h-3 mr-1" /> Add Option
              </Button>
            </div>
          )}

          {hasRatingConfig && (
            <div className="flex gap-4 pl-2">
              <div className="space-y-1">
                <Label className="text-xs">Min</Label>
                <Input type="number" value={question.config.min || 1} onChange={(e) => onChange({ ...question, config: { ...question.config, min: parseInt(e.target.value) || 1 } })} className="w-20" data-testid={`input-rating-min-${index}`} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Max</Label>
                <Input type="number" value={question.config.max || 5} onChange={(e) => onChange({ ...question, config: { ...question.config, max: parseInt(e.target.value) || 5 } })} className="w-20" data-testid={`input-rating-max-${index}`} />
              </div>
            </div>
          )}

          {hasRangeConfig && (
            <div className="flex gap-4 pl-2">
              <div className="space-y-1">
                <Label className="text-xs">Min</Label>
                <Input type="number" value={question.config.min || 0} onChange={(e) => onChange({ ...question, config: { ...question.config, min: parseInt(e.target.value) || 0 } })} className="w-20" data-testid={`input-range-min-${index}`} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Max</Label>
                <Input type="number" value={question.config.max || 100} onChange={(e) => onChange({ ...question, config: { ...question.config, max: parseInt(e.target.value) || 100 } })} className="w-20" data-testid={`input-range-max-${index}`} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Step</Label>
                <Input type="number" value={question.config.step || 1} onChange={(e) => onChange({ ...question, config: { ...question.config, step: parseInt(e.target.value) || 1 } })} className="w-20" data-testid={`input-range-step-${index}`} />
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Switch
              checked={question.isRequired}
              onCheckedChange={(v) => onChange({ ...question, isRequired: v })}
              data-testid={`switch-required-${index}`}
            />
            <Label className="text-sm">Required</Label>
          </div>
        </div>
        <Button type="button" variant="ghost" size="icon" className="text-red-500 hover:text-red-700 shrink-0" onClick={onRemove} data-testid={`button-remove-question-${index}`}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function SurveyDialog({
  open,
  onOpenChange,
  editSurvey,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editSurvey: Survey | null;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("draft");
  const [captchaEnabled, setCaptchaEnabled] = useState(false);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setStatus("draft");
    setCaptchaEnabled(false);
    setQuestions([]);
  };

  useEffect(() => {
    if (editSurvey) {
      setLoadingDetail(true);
      fetch(`/api/surveys/${editSurvey.id}`, { credentials: "include" })
        .then((r) => r.json())
        .then((data) => {
          setTitle(data.title);
          setDescription(data.description);
          setStatus(data.status);
          setCaptchaEnabled(data.captchaEnabled || false);
          setQuestions(data.questions || []);
        })
        .finally(() => setLoadingDetail(false));
    } else {
      resetForm();
    }
  }, [editSurvey]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title,
        description,
        status,
        captchaEnabled,
        questions: questions.map((q, i) => ({
          ...(q.id ? { id: q.id } : {}),
          questionText: q.questionText,
          questionType: q.questionType,
          options: q.options,
          isRequired: q.isRequired,
          sortOrder: i,
          config: q.config,
        })),
      };
      if (editSurvey) {
        const res = await apiRequest("PUT", `/api/surveys/${editSurvey.id}`, payload);
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/surveys", payload);
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/surveys"] });
      toast({ title: editSurvey ? "Survey updated" : "Survey created" });
      onOpenChange(false);
      resetForm();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        questionText: "",
        questionType: "short_text",
        options: [],
        isRequired: true,
        sortOrder: questions.length,
        config: {},
      },
    ]);
  };

  const moveQuestion = (from: number, to: number) => {
    const newQ = [...questions];
    const [moved] = newQ.splice(from, 1);
    newQ.splice(to, 0, moved);
    setQuestions(newQ);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="dialog-title-survey">{editSurvey ? "Edit Survey" : "Create Survey"}</DialogTitle>
        </DialogHeader>

        {loadingDetail ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Survey title" data-testid="input-survey-title" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Survey description (optional)" rows={3} data-testid="input-survey-description" />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={captchaEnabled}
                onCheckedChange={setCaptchaEnabled}
                data-testid="switch-captcha-enabled"
              />
              <div>
                <Label className="cursor-pointer">CAPTCHA Ready</Label>
                <p className="text-xs text-muted-foreground">Flag this survey for future CAPTCHA integration</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger data-testid="select-survey-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Questions</Label>
                <Button type="button" variant="outline" size="sm" onClick={addQuestion} data-testid="button-add-question">
                  <Plus className="w-3 h-3 mr-1" /> Add Question
                </Button>
              </div>
              {questions.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No questions yet. Click "Add Question" to start.</p>
              )}
              {questions.map((q, i) => (
                <QuestionEditor
                  key={i}
                  question={q}
                  index={i}
                  total={questions.length}
                  onChange={(updated) => {
                    const newQ = [...questions];
                    newQ[i] = updated;
                    setQuestions(newQ);
                  }}
                  onRemove={() => setQuestions(questions.filter((_, j) => j !== i))}
                  onMoveUp={() => moveQuestion(i, i - 1)}
                  onMoveDown={() => moveQuestion(i, i + 1)}
                />
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-survey">Cancel</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !title.trim()} data-testid="button-save-survey">
            {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {editSurvey ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SurveysPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const [, navigate] = useLocation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editSurvey, setEditSurvey] = useState<Survey | null>(null);

  const { data: surveys, isLoading } = useQuery<Survey[]>({
    queryKey: ["/api/surveys"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/surveys/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/surveys"] });
      toast({ title: "Survey deleted" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const copyLink = (uuid: string) => {
    const url = `${window.location.origin}/survey/${uuid}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copied!", description: url });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" data-testid="badge-status-active">Active</Badge>;
      case "closed":
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" data-testid="badge-status-closed">Closed</Badge>;
      default:
        return <Badge variant="secondary" data-testid="badge-status-draft">Draft</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Surveys</h1>
          <p className="text-muted-foreground text-sm">Create and manage surveys, collect responses</p>
        </div>
        {hasPermission("survey.create") && (
          <Button onClick={() => { setEditSurvey(null); setDialogOpen(true); }} data-testid="button-create-survey">
            <Plus className="w-4 h-4 mr-2" /> Create Survey
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : !surveys?.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardList className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2" data-testid="text-no-surveys">No surveys yet</h3>
            <p className="text-muted-foreground mb-4">Create your first survey to start collecting responses</p>
            {hasPermission("survey.create") && (
              <Button onClick={() => { setEditSurvey(null); setDialogOpen(true); }} data-testid="button-create-first-survey">
                <Plus className="w-4 h-4 mr-2" /> Create Survey
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Survey</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Responses</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {surveys.map((survey) => (
                <TableRow key={survey.id} data-testid={`row-survey-${survey.id}`}>
                  <TableCell>
                    <div>
                      <p className="font-medium" data-testid={`text-survey-title-${survey.id}`}>{survey.title}</p>
                      {survey.description && (
                        <p className="text-sm text-muted-foreground truncate max-w-xs">{survey.description}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(survey.status)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" data-testid={`text-response-count-${survey.id}`}>{survey.responseCount}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(survey.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" onClick={() => copyLink(survey.uuid)} title="Copy public link" data-testid={`button-copy-link-${survey.id}`}>
                        <Copy className="w-4 h-4" />
                      </Button>
                      {survey.status === "active" && (
                        <Button variant="ghost" size="icon" onClick={() => window.open(`/survey/${survey.uuid}`, '_blank')} title="Preview survey" data-testid={`button-preview-${survey.id}`}>
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => navigate(`/surveys/${survey.id}/report`)} title="View report" data-testid={`button-report-${survey.id}`}>
                        <BarChart3 className="w-4 h-4" />
                      </Button>
                      {hasPermission("survey.edit") && (
                        <Button variant="ghost" size="icon" onClick={() => { setEditSurvey(survey); setDialogOpen(true); }} title="Edit survey" data-testid={`button-edit-${survey.id}`}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                      )}
                      {hasPermission("survey.delete") && (
                        <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700" onClick={() => { if (confirm("Delete this survey and all its responses?")) deleteMutation.mutate(survey.id); }} title="Delete survey" data-testid={`button-delete-${survey.id}`}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {dialogOpen && (
        <SurveyDialog open={dialogOpen} onOpenChange={setDialogOpen} editSurvey={editSurvey} />
      )}
    </div>
  );
}
