import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Download, BarChart3, List, ChevronDown, ChevronRight, Users, FileText } from "lucide-react";
import { useAuth } from "@/lib/auth";

interface QuestionStat {
  questionId: number;
  questionText: string;
  questionType: string;
  totalAnswers: number;
  average?: number;
  distribution?: Record<string, number>;
  choiceCounts?: Record<string, number>;
  sampleAnswers?: string[];
}

interface ReportData {
  surveyId: number;
  title: string;
  totalResponses: number;
  timeline: { date: string; count: number }[];
  questionStats: QuestionStat[];
}

interface ResponseItem {
  id: number;
  submittedAt: string;
  respondentIp: string;
  answers: {
    id: number;
    questionId: number;
    questionText: string;
    questionType: string;
    answerValue: { value: any };
  }[];
}

interface ResponsesData {
  results: ResponseItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function BarChartSimple({ data, maxVal }: { data: Record<string, number>; maxVal: number }) {
  const entries = Object.entries(data).sort(([, a], [, b]) => b - a);
  if (!entries.length) return <p className="text-sm text-muted-foreground">No data</p>;

  return (
    <div className="space-y-2" data-testid="bar-chart">
      {entries.map(([label, count]) => (
        <div key={label} className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="truncate max-w-[200px]">{label}</span>
            <span className="font-medium text-muted-foreground">{count}</span>
          </div>
          <div className="h-5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${maxVal > 0 ? (count / maxVal) * 100 : 0}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function TimelineChart({ data }: { data: { date: string; count: number }[] }) {
  if (!data.length) return <p className="text-sm text-muted-foreground">No responses yet</p>;
  const maxCount = Math.max(...data.map((d) => d.count));
  const chartHeight = 120;

  return (
    <div className="space-y-2" data-testid="timeline-chart">
      <div className="flex items-end gap-1" style={{ height: chartHeight }}>
        {data.map((d, i) => (
          <div
            key={i}
            className="flex-1 bg-primary/80 rounded-t hover:bg-primary transition-colors min-w-[8px]"
            style={{ height: `${maxCount > 0 ? (d.count / maxCount) * chartHeight : 0}px` }}
            title={`${d.date}: ${d.count} responses`}
          />
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        {data.length > 0 && <span>{data[0].date}</span>}
        {data.length > 1 && <span>{data[data.length - 1].date}</span>}
      </div>
    </div>
  );
}

function QuestionStatCard({ stat }: { stat: QuestionStat }) {
  const isRating = ["rating", "star_rating", "range"].includes(stat.questionType);
  const isChoice = ["single_choice", "multiple_choice", "dropdown"].includes(stat.questionType);
  const isText = ["short_text", "long_text"].includes(stat.questionType);

  const maxVal = isChoice && stat.choiceCounts
    ? Math.max(...Object.values(stat.choiceCounts), 1)
    : isRating && stat.distribution
    ? Math.max(...Object.values(stat.distribution), 1)
    : 1;

  return (
    <Card data-testid={`stat-card-${stat.questionId}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{stat.questionText}</CardTitle>
          <Badge variant="outline" className="text-xs">{stat.totalAnswers} answers</Badge>
        </div>
        <CardDescription className="text-xs capitalize">{stat.questionType.replace("_", " ")}</CardDescription>
      </CardHeader>
      <CardContent>
        {isRating && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="text-3xl font-bold" data-testid={`text-average-${stat.questionId}`}>{stat.average ?? "—"}</div>
              <span className="text-sm text-muted-foreground">average rating</span>
            </div>
            {stat.distribution && <BarChartSimple data={stat.distribution} maxVal={maxVal} />}
          </div>
        )}
        {isChoice && stat.choiceCounts && (
          <BarChartSimple data={stat.choiceCounts} maxVal={maxVal} />
        )}
        {isText && (
          <div className="space-y-2">
            {stat.sampleAnswers?.length ? (
              stat.sampleAnswers.map((a, i) => (
                <div key={i} className="p-2 bg-muted rounded text-sm" data-testid={`text-answer-sample-${stat.questionId}-${i}`}>
                  {a || <span className="text-muted-foreground italic">Empty</span>}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No answers yet</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function SurveyReportPage() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { hasPermission } = useAuth();
  const surveyId = params.id;
  const [page, setPage] = useState(1);
  const [expandedResponse, setExpandedResponse] = useState<number | null>(null);

  const { data: report, isLoading: reportLoading } = useQuery<ReportData>({
    queryKey: ["/api/surveys", surveyId, "report"],
    queryFn: async () => {
      const res = await fetch(`/api/surveys/${surveyId}/report`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load report");
      return res.json();
    },
  });

  const { data: responsesData, isLoading: responsesLoading } = useQuery<ResponsesData>({
    queryKey: ["/api/surveys", surveyId, "responses", page],
    queryFn: async () => {
      const res = await fetch(`/api/surveys/${surveyId}/responses?page=${page}&pageSize=20`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load responses");
      return res.json();
    },
  });

  const handleExport = () => {
    window.open(`/api/surveys/${surveyId}/export`, '_blank');
  };

  const formatAnswer = (answer: { answerValue: { value: any }; questionType: string }) => {
    const val = answer.answerValue?.value;
    if (val === null || val === undefined) return "—";
    if (Array.isArray(val)) return val.join(", ");
    return String(val);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/surveys")} data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-report-title">
              {reportLoading ? <Skeleton className="h-7 w-48" /> : report?.title}
            </h1>
            <p className="text-muted-foreground text-sm">Survey Report & Responses</p>
          </div>
        </div>
        {hasPermission("survey.export") && (
          <Button variant="outline" onClick={handleExport} data-testid="button-export-csv">
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
        )}
      </div>

      {reportLoading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : report ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Users className="w-8 h-8 text-primary" />
                  <div>
                    <p className="text-2xl font-bold" data-testid="text-total-responses">{report.totalResponses}</p>
                    <p className="text-sm text-muted-foreground">Total Responses</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <FileText className="w-8 h-8 text-primary" />
                  <div>
                    <p className="text-2xl font-bold" data-testid="text-total-questions">{report.questionStats.length}</p>
                    <p className="text-sm text-muted-foreground">Questions</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Responses Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                <TimelineChart data={report.timeline} />
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="summary">
            <TabsList data-testid="tabs-report">
              <TabsTrigger value="summary" data-testid="tab-summary">
                <BarChart3 className="w-4 h-4 mr-1" /> Summary
              </TabsTrigger>
              <TabsTrigger value="responses" data-testid="tab-responses">
                <List className="w-4 h-4 mr-1" /> Responses
              </TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="space-y-4 mt-4">
              {report.questionStats.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No questions in this survey
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {report.questionStats.map((stat) => (
                    <QuestionStatCard key={stat.questionId} stat={stat} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="responses" className="mt-4">
              {responsesLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}
                </div>
              ) : !responsesData?.results?.length ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No responses yet
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Response #</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead>IP Address</TableHead>
                        <TableHead>Answers</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {responsesData.results.map((resp, idx) => (
                        <>
                          <TableRow
                            key={resp.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setExpandedResponse(expandedResponse === resp.id ? null : resp.id)}
                            data-testid={`row-response-${resp.id}`}
                          >
                            <TableCell>
                              {expandedResponse === resp.id ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </TableCell>
                            <TableCell className="font-medium">#{(page - 1) * 20 + idx + 1}</TableCell>
                            <TableCell className="text-sm">
                              {new Date(resp.submittedAt).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{resp.respondentIp || "—"}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{resp.answers.length} answers</Badge>
                            </TableCell>
                          </TableRow>
                          {expandedResponse === resp.id && (
                            <TableRow key={`${resp.id}-expanded`}>
                              <TableCell colSpan={5} className="bg-muted/30 p-4">
                                <div className="space-y-3">
                                  {resp.answers.map((answer) => (
                                    <div key={answer.id} className="flex gap-4" data-testid={`answer-detail-${answer.id}`}>
                                      <span className="text-sm font-medium min-w-[200px]">{answer.questionText}</span>
                                      <span className="text-sm">{formatAnswer(answer)}</span>
                                    </div>
                                  ))}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      ))}
                    </TableBody>
                  </Table>

                  {responsesData.totalPages > 1 && (
                    <div className="flex items-center justify-between p-4 border-t">
                      <p className="text-sm text-muted-foreground">
                        Page {responsesData.page} of {responsesData.totalPages} ({responsesData.total} total)
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={page <= 1}
                          onClick={() => setPage(page - 1)}
                          data-testid="button-prev-page"
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={page >= responsesData.totalPages}
                          onClick={() => setPage(page + 1)}
                          data-testid="button-next-page"
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </>
      ) : null}
    </div>
  );
}
