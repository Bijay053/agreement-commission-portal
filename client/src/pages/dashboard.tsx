import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText, AlertTriangle, CheckCircle, Clock, TrendingUp,
  Calendar, ArrowRight, Building2, Bell, Shield, RefreshCw,
  Search, Mail, Filter,
} from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

function StatCard({ title, value, icon: Icon, variant }: {
  title: string; value: number | string; icon: any; variant: string;
}) {
  const colors: Record<string, string> = {
    primary: "text-primary bg-primary/10",
    warning: "text-amber-600 dark:text-amber-400 bg-amber-500/10",
    success: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
    danger: "text-red-600 dark:text-red-400 bg-red-500/10",
    orange: "text-orange-600 dark:text-orange-400 bg-orange-500/10",
  };

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-semibold mt-1">{value}</p>
          </div>
          <div className={`p-2.5 rounded-md shrink-0 ${colors[variant]}`}>
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

function getUrgencyBadge(urgency: string) {
  const map: Record<string, { label: string; className: string }> = {
    critical: { label: "Critical", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800" },
    warning: { label: "Warning", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800" },
    expired: { label: "Expired", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-300 dark:border-red-700" },
    renewal_pending: { label: "Renewal Pending", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800" },
  };
  const u = map[urgency] || { label: urgency, className: "" };
  return <Badge variant="outline" className={u.className} data-testid={`badge-urgency-${urgency}`}>{u.label}</Badge>;
}

function getDaysUntilExpiry(expiryDate: string) {
  const days = differenceInDays(parseISO(expiryDate), new Date());
  if (days < 0) return <span className="text-red-600 dark:text-red-400 font-medium">{Math.abs(days)}d overdue</span>;
  if (days <= 7) return <span className="text-red-600 dark:text-red-400 font-medium">{days}d</span>;
  if (days <= 30) return <span className="text-amber-600 dark:text-amber-400 font-medium">{days}d</span>;
  return <span className="text-muted-foreground">{days}d</span>;
}

function getNotificationTypeBadge(type: string) {
  const map: Record<string, { label: string; className: string }> = {
    reminder_90d: { label: "90-Day Reminder", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
    reminder_60d: { label: "60-Day Reminder", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
    reminder_30d: { label: "30-Day Reminder", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    reminder_14d: { label: "14-Day Urgent", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
    reminder_7d: { label: "7-Day Critical", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
    expired: { label: "Expired", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
    renewal_delay: { label: "Renewal Delay", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  };
  const n = map[type] || { label: type, className: "" };
  return <Badge variant="outline" className={n.className}>{n.label}</Badge>;
}

export default function DashboardPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [alertFilter, setAlertFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [triggeringCheck, setTriggeringCheck] = useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery<{
    total: number; active: number; expiringSoon: number; expired: number;
  }>({ queryKey: ["/api/dashboard/stats"] });

  const { data: expiring, isLoading: expiringLoading } = useQuery<any[]>({
    queryKey: ["/api/dashboard/expiring"],
  });

  const { data: recent, isLoading: recentLoading } = useQuery<any[]>({
    queryKey: ["/api/dashboard/recent"],
  });

  const { data: alertsData, isLoading: alertsLoading } = useQuery<{
    alerts: any[];
    summary: { expiring90: number; expiring30: number; expired: number; renewalPending: number };
  }>({
    queryKey: ["/api/agreements/alerts"],
  });

  const { data: notifications, isLoading: notificationsLoading } = useQuery<any[]>({
    queryKey: ["/api/agreement-notifications"],
  });

  const handleTriggerCheck = async () => {
    setTriggeringCheck(true);
    try {
      const res = await apiRequest("POST", "/api/agreements/trigger-notification-check");
      const data = await res.json();
      toast({ title: "Notification Check Complete", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/agreement-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agreements/alerts"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setTriggeringCheck(false);
    }
  };

  const filteredAlerts = alertsData?.alerts?.filter((a: any) => {
    if (alertFilter !== "all" && a.urgency !== alertFilter) return false;
    if (searchTerm && !a.universityName.toLowerCase().includes(searchTerm.toLowerCase()) && !a.countryName.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  }) || [];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-dashboard-title">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Overview of your agreement portfolio</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList data-testid="tabs-dashboard">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="alerts" data-testid="tab-alerts" className="gap-1.5">
            <Bell className="w-3.5 h-3.5" />
            Agreement Alerts
            {alertsData?.summary && (alertsData.summary.expired + alertsData.summary.renewalPending + alertsData.summary.expiring30) > 0 && (
              <span className="ml-1 bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5 font-semibold leading-none">
                {alertsData.summary.expired + alertsData.summary.renewalPending + alertsData.summary.expiring30}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="notifications" data-testid="tab-notifications" className="gap-1.5">
            <Mail className="w-3.5 h-3.5" />
            Notification Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-4">
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
        </TabsContent>

        <TabsContent value="alerts" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {alertsLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}><CardContent className="p-5"><Skeleton className="h-16" /></CardContent></Card>
              ))
            ) : (
              <>
                <StatCard title="Expiring (90 days)" value={alertsData?.summary?.expiring90 ?? 0} icon={AlertTriangle} variant="warning" />
                <StatCard title="Expiring (30 days)" value={alertsData?.summary?.expiring30 ?? 0} icon={Clock} variant="orange" />
                <StatCard title="Expired" value={alertsData?.summary?.expired ?? 0} icon={Shield} variant="danger" />
                <StatCard title="Renewal Pending" value={alertsData?.summary?.renewalPending ?? 0} icon={RefreshCw} variant="orange" />
              </>
            )}
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-medium">Agreement Alerts</h3>
                  <p className="text-xs text-muted-foreground">Agreements requiring attention</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search provider..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 w-48"
                      data-testid="input-alert-search"
                    />
                  </div>
                  <Select value={alertFilter} onValueChange={setAlertFilter}>
                    <SelectTrigger className="w-44" data-testid="select-alert-filter">
                      <Filter className="w-3.5 h-3.5 mr-1.5" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Alerts</SelectItem>
                      <SelectItem value="critical">Critical (30 days)</SelectItem>
                      <SelectItem value="warning">Warning (90 days)</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                      <SelectItem value="renewal_pending">Renewal Pending</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTriggerCheck}
                    disabled={triggeringCheck}
                    data-testid="button-trigger-check"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${triggeringCheck ? "animate-spin" : ""}`} />
                    {triggeringCheck ? "Checking..." : "Run Check Now"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {alertsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
                </div>
              ) : filteredAlerts.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-2 pr-4 font-medium text-muted-foreground">Provider</th>
                        <th className="pb-2 pr-4 font-medium text-muted-foreground">Country</th>
                        <th className="pb-2 pr-4 font-medium text-muted-foreground">Agreement</th>
                        <th className="pb-2 pr-4 font-medium text-muted-foreground">Expiry Date</th>
                        <th className="pb-2 pr-4 font-medium text-muted-foreground">Days</th>
                        <th className="pb-2 pr-4 font-medium text-muted-foreground">Status</th>
                        <th className="pb-2 font-medium text-muted-foreground">Urgency</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAlerts.map((alert: any) => (
                        <tr
                          key={alert.id}
                          className="border-b last:border-0 cursor-pointer hover:bg-accent/50 transition-colors"
                          onClick={() => navigate(`/agreements/${alert.id}`)}
                          data-testid={`row-alert-${alert.id}`}
                        >
                          <td className="py-3 pr-4 font-medium">{alert.universityName}</td>
                          <td className="py-3 pr-4 text-muted-foreground">{alert.countryName}</td>
                          <td className="py-3 pr-4">
                            <span className="text-xs text-muted-foreground">{alert.agreementCode}</span>
                          </td>
                          <td className="py-3 pr-4">
                            {format(parseISO(alert.expiryDate), "dd MMM yyyy")}
                          </td>
                          <td className="py-3 pr-4">{getDaysUntilExpiry(alert.expiryDate)}</td>
                          <td className="py-3 pr-4">{getStatusBadge(alert.status)}</td>
                          <td className="py-3">{getUrgencyBadge(alert.urgency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm font-medium">No agreement alerts</p>
                  <p className="text-xs mt-1">All agreements are in good standing</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Notification Log</h3>
                  <p className="text-xs text-muted-foreground">History of automated email notifications sent</p>
                </div>
                <Mail className="w-4 h-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {notificationsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
                </div>
              ) : notifications && notifications.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-2 pr-4 font-medium text-muted-foreground">Date</th>
                        <th className="pb-2 pr-4 font-medium text-muted-foreground">Provider</th>
                        <th className="pb-2 pr-4 font-medium text-muted-foreground">Type</th>
                        <th className="pb-2 pr-4 font-medium text-muted-foreground">Days to Expiry</th>
                        <th className="pb-2 pr-4 font-medium text-muted-foreground">Status</th>
                        <th className="pb-2 font-medium text-muted-foreground">Recipients</th>
                      </tr>
                    </thead>
                    <tbody>
                      {notifications.map((notif: any) => (
                        <tr
                          key={notif.id}
                          className="border-b last:border-0 hover:bg-accent/50 transition-colors cursor-pointer"
                          onClick={() => notif.agreementId && navigate(`/agreements/${notif.agreementId}`)}
                          data-testid={`row-notification-${notif.id}`}
                        >
                          <td className="py-3 pr-4 text-muted-foreground whitespace-nowrap">
                            {notif.sentDate ? format(new Date(notif.sentDate), "dd MMM yyyy HH:mm") : "—"}
                          </td>
                          <td className="py-3 pr-4 font-medium">{notif.providerName}</td>
                          <td className="py-3 pr-4">{getNotificationTypeBadge(notif.notificationType)}</td>
                          <td className="py-3 pr-4">
                            {notif.daysBeforeExpiry !== null && notif.daysBeforeExpiry !== undefined ? (
                              <span className={notif.daysBeforeExpiry < 0 ? "text-red-600 dark:text-red-400 font-medium" : notif.daysBeforeExpiry <= 14 ? "text-amber-600 dark:text-amber-400 font-medium" : ""}>
                                {notif.daysBeforeExpiry < 0 ? `${Math.abs(notif.daysBeforeExpiry)}d overdue` : `${notif.daysBeforeExpiry}d`}
                              </span>
                            ) : "—"}
                          </td>
                          <td className="py-3 pr-4">
                            <Badge variant={notif.status === "sent" ? "default" : "secondary"} className="text-xs">
                              {notif.status === "sent" ? "Sent" : notif.status}
                            </Badge>
                          </td>
                          <td className="py-3 text-xs text-muted-foreground max-w-[200px] truncate">
                            {notif.recipientEmails || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Mail className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm font-medium">No notifications sent yet</p>
                  <p className="text-xs mt-1">Automated notifications will appear here once they are sent</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
