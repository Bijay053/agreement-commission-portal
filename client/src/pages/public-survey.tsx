import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Star, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { getCsrfToken } from "@/lib/queryClient";

interface SurveyQuestion {
  id: number;
  questionText: string;
  questionType: string;
  options: string[];
  isRequired: boolean;
  sortOrder: number;
  config: Record<string, any>;
}

interface SurveyData {
  title: string;
  description: string;
  uuid: string;
  questions: SurveyQuestion[];
  closed?: boolean;
  message?: string;
}

function StarRating({ value, onChange, max = 5 }: { value: number; onChange: (v: number) => void; max?: number }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1" data-testid="star-rating-group">
      {Array.from({ length: max }, (_, i) => i + 1).map((star) => (
        <button
          key={star}
          type="button"
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(star)}
          className="focus:outline-none"
          data-testid={`star-${star}`}
        >
          <Star
            className={`w-8 h-8 transition-colors ${
              star <= (hover || value) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

function QuestionRenderer({
  question,
  value,
  onChange,
}: {
  question: SurveyQuestion;
  value: any;
  onChange: (val: any) => void;
}) {
  const { questionType, options, config } = question;

  switch (questionType) {
    case "short_text":
      return (
        <Input
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Your answer..."
          data-testid={`input-question-${question.id}`}
        />
      );

    case "long_text":
      return (
        <Textarea
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Your answer..."
          rows={4}
          data-testid={`textarea-question-${question.id}`}
        />
      );

    case "rating": {
      const min = config.min || 1;
      const max = config.max || 5;
      return (
        <div className="flex gap-2 flex-wrap" data-testid={`rating-group-${question.id}`}>
          {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((num) => (
            <Button
              key={num}
              type="button"
              variant={value === num ? "default" : "outline"}
              size="sm"
              onClick={() => onChange(num)}
              className="w-10 h-10"
              data-testid={`rating-${question.id}-${num}`}
            >
              {num}
            </Button>
          ))}
        </div>
      );
    }

    case "star_rating": {
      const max = config.max || 5;
      return <StarRating value={value || 0} onChange={onChange} max={max} />;
    }

    case "range": {
      const min = config.min || 0;
      const max = config.max || 100;
      const step = config.step || 1;
      return (
        <div className="space-y-2">
          <Slider
            value={[value ?? min]}
            onValueChange={([v]) => onChange(v)}
            min={min}
            max={max}
            step={step}
            data-testid={`slider-question-${question.id}`}
          />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{min}</span>
            <span className="font-medium text-foreground">{value ?? min}</span>
            <span>{max}</span>
          </div>
        </div>
      );
    }

    case "single_choice":
      return (
        <RadioGroup value={value || ""} onValueChange={onChange} data-testid={`radio-group-${question.id}`}>
          {(options || []).map((opt, idx) => (
            <div key={idx} className="flex items-center space-x-2">
              <RadioGroupItem value={opt} id={`q${question.id}-opt-${idx}`} data-testid={`radio-${question.id}-${idx}`} />
              <Label htmlFor={`q${question.id}-opt-${idx}`} className="cursor-pointer">{opt}</Label>
            </div>
          ))}
        </RadioGroup>
      );

    case "multiple_choice": {
      const selected: string[] = value || [];
      return (
        <div className="space-y-2" data-testid={`checkbox-group-${question.id}`}>
          {(options || []).map((opt, idx) => (
            <div key={idx} className="flex items-center space-x-2">
              <Checkbox
                checked={selected.includes(opt)}
                onCheckedChange={(checked) => {
                  if (checked) onChange([...selected, opt]);
                  else onChange(selected.filter((s) => s !== opt));
                }}
                id={`q${question.id}-chk-${idx}`}
                data-testid={`checkbox-${question.id}-${idx}`}
              />
              <Label htmlFor={`q${question.id}-chk-${idx}`} className="cursor-pointer">{opt}</Label>
            </div>
          ))}
        </div>
      );
    }

    case "dropdown":
      return (
        <Select value={value || ""} onValueChange={onChange}>
          <SelectTrigger data-testid={`select-question-${question.id}`}>
            <SelectValue placeholder="Select an option..." />
          </SelectTrigger>
          <SelectContent>
            {(options || []).map((opt, idx) => (
              <SelectItem key={idx} value={opt} data-testid={`select-option-${question.id}-${idx}`}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    default:
      return <p className="text-muted-foreground">Unsupported question type</p>;
  }
}

export default function PublicSurveyPage() {
  const params = useParams<{ slug: string }>();
  const [survey, setSurvey] = useState<SurveyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);
  const [duplicate, setDuplicate] = useState(false);

  useEffect(() => {
    fetch(`/api/surveys/public/${params.slug}`)
      .then(async (res) => {
        const data = await res.json();
        if (data.closed) {
          setClosed(true);
          setSurvey(data);
        } else if (!res.ok) {
          setError(data.message || "Survey not found");
        } else {
          setSurvey(data);
        }
      })
      .catch(() => setError("Failed to load survey"))
      .finally(() => setLoading(false));
  }, [params.slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!survey) return;
    setSubmitting(true);
    setError(null);

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const csrfToken = getCsrfToken();
      if (csrfToken) headers["X-CSRFToken"] = csrfToken;

      const res = await fetch(`/api/surveys/public/${params.slug}/submit`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          answers,
          website_url: (document.getElementById("website_url") as HTMLInputElement)?.value || "",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.duplicate) {
          setDuplicate(true);
        } else {
          setError(data.message || "Failed to submit");
        }
      } else {
        setSubmitted(true);
      }
    } catch {
      setError("Failed to submit survey");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (closed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <XCircle className="w-16 h-16 text-red-400 mx-auto" />
            <h2 className="text-xl font-semibold" data-testid="text-survey-closed">This survey is closed</h2>
            <p className="text-muted-foreground">This survey is no longer accepting responses.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !survey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <XCircle className="w-16 h-16 text-red-400 mx-auto" />
            <h2 className="text-xl font-semibold" data-testid="text-survey-error">{error}</h2>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
            <h2 className="text-xl font-semibold" data-testid="text-survey-success">Thank you!</h2>
            <p className="text-muted-foreground">Your response has been submitted successfully.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (duplicate) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <CheckCircle2 className="w-16 h-16 text-blue-500 mx-auto" />
            <h2 className="text-xl font-semibold" data-testid="text-survey-duplicate">Already Submitted</h2>
            <p className="text-muted-foreground">You have already submitted a response for this survey.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!survey) return null;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl" data-testid="text-survey-title">{survey.title}</CardTitle>
            {survey.description && (
              <CardDescription className="text-base" data-testid="text-survey-description">{survey.description}</CardDescription>
            )}
          </CardHeader>
        </Card>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="hidden" aria-hidden="true">
            <label htmlFor="website_url">Website</label>
            <input type="text" id="website_url" name="website_url" tabIndex={-1} autoComplete="off" />
          </div>

          {survey.questions.map((question) => (
            <Card key={question.id}>
              <CardContent className="pt-6 space-y-3">
                <Label className="text-base font-medium" data-testid={`label-question-${question.id}`}>
                  {question.questionText}
                  {question.isRequired && <span className="text-red-500 ml-1">*</span>}
                </Label>
                <QuestionRenderer
                  question={question}
                  value={answers[String(question.id)]}
                  onChange={(val) => setAnswers((prev) => ({ ...prev, [String(question.id)]: val }))}
                />
              </CardContent>
            </Card>
          ))}

          {error && (
            <p className="text-sm text-red-500" data-testid="text-submit-error">{error}</p>
          )}

          <Button
            type="submit"
            disabled={submitting}
            className="w-full"
            size="lg"
            data-testid="button-submit-survey"
          >
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Submit
          </Button>
        </form>
      </div>
    </div>
  );
}
