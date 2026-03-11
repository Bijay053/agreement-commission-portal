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
  DOC_DELETE: "bg-red-500/10 text-red-700 dark:text-red-300",
  COMMISSION_CREATE: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  COMMISSION_EDIT: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  TARGET_CREATE: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  TARGET_EDIT: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  CONTACT_CREATE: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  CONTACT_EDIT: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  CONTACT_DELETE: "bg-red-500/10 text-red-700 dark:text-red-300",
};

const entityLabels: Record<string, string> = {
  agreement: "Agreement",
  document: "Document",
  commission: "Commission",
  target: "Target",
  contact: "Contact",
};

const entityColors: Record<string, string> = {
  agreement: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  document: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  commission: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  target: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  contact: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
};

export default function AuditTab({ agreementId }: { agreementId: number }) {
  const { data: logs, isLoading } = useQuery<any[]>({
    queryKey: ["/api/agreements", agreementId, "audit"],
    queryFn: async () => {
      const res = await fetch(`/api/agreements/${agreementId}/audit`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  if (isLoading) return <div className="space-y-3">{Array.from({length: 3}).map((_,i) => <Skeleton key={i} className="h-16" />)}</div>;

  return (
    <div className="space-y-4">
      <h3 className="font-medium">Audit Trail</h3>
      <p className="text-xs text-muted-foreground">All activity across Agreement, Commission, Targets, Contacts, and Documents</p>

      {logs && logs.length > 0 ? (
        <div className="space-y-2">
          {logs.map((log: any) => (
            <Card key={log.id} data-testid={`card-audit-${log.id}`}>
              <CardContent className="p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${entityColors[log.entityType] || "bg-muted text-muted-foreground"}`}>
                      {entityLabels[log.entityType] || log.entityType}
                    </span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${actionColors[log.action] || "bg-muted text-muted-foreground"}`}>
                      {log.action.replace(/_/g, " ")}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {log.userName || `User #${log.userId}`}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
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
