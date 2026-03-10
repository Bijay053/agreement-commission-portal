import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";

const actionColors: Record<string, string> = {
  AGREEMENT_CREATE: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  AGREEMENT_EDIT: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  AGREEMENT_DELETE: "bg-red-500/10 text-red-700 dark:text-red-300",
  DOC_UPLOAD: "bg-purple-500/10 text-purple-700 dark:text-purple-300",
  DOC_VIEW: "bg-gray-500/10 text-gray-700 dark:text-gray-300",
  DOC_DOWNLOAD: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  LOGIN_SUCCESS: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  LOGIN_FAILED: "bg-red-500/10 text-red-700 dark:text-red-300",
};

export default function AuditTab({ agreementId }: { agreementId: number }) {
  const { data: logs, isLoading } = useQuery<any[]>({
    queryKey: ["/api/audit-logs", `entityType=agreement&entityId=${agreementId}`],
    queryFn: async () => {
      const res = await fetch(`/api/audit-logs?entityType=agreement&entityId=${agreementId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      if (Array.isArray(json)) return json;
      return json.results || [];
    },
  });

  if (isLoading) return <div className="space-y-3">{Array.from({length: 3}).map((_,i) => <Skeleton key={i} className="h-16" />)}</div>;

  return (
    <div className="space-y-4">
      <h3 className="font-medium">Audit Trail</h3>

      {logs && logs.length > 0 ? (
        <div className="space-y-2">
          {logs.map((log: any) => (
            <Card key={log.id} data-testid={`card-audit-${log.id}`}>
              <CardContent className="p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${actionColors[log.action] || "bg-muted text-muted-foreground"}`}>
                      {log.action.replace(/_/g, " ")}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      User #{log.userId}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {log.createdAt ? format(parseISO(log.createdAt), "dd MMM yyyy HH:mm:ss") : "Unknown"}
                  </span>
                </div>
                {log.ipAddress && (
                  <p className="text-xs text-muted-foreground mt-1">IP: {log.ipAddress}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Shield className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">No audit logs for this agreement</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
