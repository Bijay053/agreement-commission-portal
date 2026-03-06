import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText, AlertTriangle, CheckCircle, Clock, TrendingUp,
  Calendar, ArrowRight, Building2,
} from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";

function StatCard({ title, value, icon: Icon, variant }: {
  title: string; value: number | string; icon: any; variant: string;
}) {
  const colors: Record<string, string> = {
    primary: "text-primary bg-primary/10",
    warning: "text-amber-600 dark:text-amber-400 bg-amber-500/10",
    success: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
    danger: "text-red-600 dark:text-red-400 bg-red-500/10",
  };

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-semibold mt-1">{value}</p>
          </div>
          <div className={`p-2.5 rounded-md ${colors[variant]}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function getStatusBadge(status: string) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    active: { label: "Active", variant: "default" },
    draft: { label: "Draft", variant: "secondary" },
    expired: { label: "Expired", variant: "destructive" },
    terminated: { label: "Terminated", variant: "destructive" },
    renewal_in_progress: { label: "Renewal", variant: "outline" },
  };
  const s = map[status] || { label: status, variant: "secondary" as const };
  return <Badge variant={s.variant} data-testid={`badge-status-${status}`}>{s.label}</Badge>;
}

function getDaysUntilExpiry(expiryDate: string) {
  const days = differenceInDays(parseISO(expiryDate), new Date());
  if (days <= 7) return <span className="text-red-600 dark:text-red-400 font-medium">{days}d</span>;
  if (days <= 30) return <span className="text-amber-600 dark:text-amber-400 font-medium">{days}d</span>;
  return <span className="text-muted-foreground">{days}d</span>;
}

export default function DashboardPage() {
  const [, navigate] = useLocation();

  const { data: stats, isLoading: statsLoading } = useQuery<{
    total: number; active: number; expiringSoon: number; expired: number;
  }>({ queryKey: ["/api/dashboard/stats"] });

  const { data: expiring, isLoading: expiringLoading } = useQuery<any[]>({
    queryKey: ["/api/dashboard/expiring"],
  });

  const { data: recent, isLoading: recentLoading } = useQuery<any[]>({
    queryKey: ["/api/dashboard/recent"],
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-dashboard-title">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Overview of your agreement portfolio</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-5"><Skeleton className="h-16" /></CardContent></Card>
          ))
        ) : (
          <>
            <StatCard title="Total Agreements" value={stats?.total ?? 0} icon={FileText} variant="primary" />
            <StatCard title="Active" value={stats?.active ?? 0} icon={CheckCircle} variant="success" />
            <StatCard title="Expiring Soon" value={stats?.expiringSoon ?? 0} icon={AlertTriangle} variant="warning" />
            <StatCard title="Expired" value={stats?.expired ?? 0} icon={Clock} variant="danger" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <div>
              <h3 className="font-medium">Expiring Soon</h3>
              <p className="text-xs text-muted-foreground">Agreements expiring within 90 days</p>
            </div>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent className="pt-0">
            {expiringLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
              </div>
            ) : expiring && expiring.length > 0 ? (
              <div className="space-y-2">
                {expiring.slice(0, 6).map((item: any) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-md bg-accent/50 cursor-pointer hover-elevate"
                    onClick={() => navigate(`/agreements/${item.id}`)}
                    data-testid={`card-expiring-${item.id}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{item.universityName}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.title}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(item.expiryDate), "dd MMM yyyy")}
                        </p>
                        <p className="text-xs">{getDaysUntilExpiry(item.expiryDate)}</p>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No agreements expiring soon</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <div>
              <h3 className="font-medium">Recent Activity</h3>
              <p className="text-xs text-muted-foreground">Recently updated agreements</p>
            </div>
            <TrendingUp className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent className="pt-0">
            {recentLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
              </div>
            ) : recent && recent.length > 0 ? (
              <div className="space-y-2">
                {recent.slice(0, 6).map((item: any) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-md bg-accent/50 cursor-pointer hover-elevate"
                    onClick={() => navigate(`/agreements/${item.id}`)}
                    data-testid={`card-recent-${item.id}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <p className="text-sm font-medium truncate">{item.universityName}</p>
                      </div>
                      <p className="text-xs text-muted-foreground truncate ml-5.5">{item.title}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {getStatusBadge(item.status)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No agreements yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
