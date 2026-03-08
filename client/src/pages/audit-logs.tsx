import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Clock, User } from "lucide-react";
import { format, parseISO } from "date-fns";

const actionColors: Record<string, string> = {
  AGREEMENT_CREATE: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  AGREEMENT_EDIT: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  AGREEMENT_DELETE: "bg-red-500/10 text-red-700 dark:text-red-300",
  DOC_UPLOAD: "bg-purple-500/10 text-purple-700 dark:text-purple-300",
  DOC_VIEW: "bg-gray-500/10 text-gray-700 dark:text-gray-300",
  LOGIN_SUCCESS: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  LOGIN_FAILED: "bg-red-500/10 text-red-700 dark:text-red-300",
  LOGOUT: "bg-gray-500/10 text-gray-700 dark:text-gray-300",
};

export default function AuditLogsPage() {
  const { data: logs, isLoading } = useQuery<any[]>({
    queryKey: ["/api/audit-logs"],
  });

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-audit-title">Audit Logs</h1>
        <p className="text-sm text-muted-foreground mt-1">System activity and security events</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-12" /></CardContent></Card>
          ))}
        </div>
      ) : logs && logs.length > 0 ? (
        <div className="space-y-2">
          {logs.map((log: any) => (
            <Card key={log.id} data-testid={`card-audit-log-${log.id}`}>
              <CardContent className="p-3.5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded ${actionColors[log.action] || "bg-muted text-muted-foreground"}`}>
                      {log.action.replace(/_/g, " ")}
                    </span>
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <User className="w-3 h-3" /> User #{log.userId || "System"}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {log.entityType} {log.entityId ? `#${log.entityId}` : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {log.ipAddress && <span>IP: {log.ipAddress}</span>}
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {log.createdAt ? format(parseISO(log.createdAt), "dd MMM yyyy HH:mm:ss") : "Unknown"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <Shield className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">No audit logs available</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
