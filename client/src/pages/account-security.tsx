import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Monitor, Smartphone, Tablet, LogOut, Clock, Globe, Key, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import ChangePasswordPage from "./change-password";

interface UserSessionData {
  id: number;
  browser: string;
  os: string;
  deviceType: string;
  ipAddress: string;
  loginAt: string;
  lastActivityAt: string;
  logoutAt: string | null;
  isActive: boolean;
  isCurrent: boolean;
}

interface SecurityLogEntry {
  id: number;
  eventType: string;
  ipAddress: string;
  deviceInfo: string | null;
  metadata: any;
  createdAt: string;
}

function getDeviceIcon(type: string) {
  if (type === "mobile") return <Smartphone className="w-4 h-4" />;
  if (type === "tablet") return <Tablet className="w-4 h-4" />;
  return <Monitor className="w-4 h-4" />;
}

function formatDate(d: string) {
  return new Date(d).toLocaleString();
}

const EVENT_LABELS: Record<string, string> = {
  "LOGIN_FAILED": "Failed login attempt",
  "OTP_SENT": "Verification code sent",
  "OTP_VERIFIED": "Verification successful",
  "OTP_FAILED": "Wrong verification code",
  "OTP_EXHAUSTED": "Too many wrong codes",
  "OTP_RESENT": "Verification code resent",
  "PASSWORD_CHANGED": "Password changed",
  "PASSWORD_CHANGE_FAILED": "Password change failed",
  "LOGOUT": "Logged out",
  "REMOTE_LOGOUT": "Session logged out remotely",
  "LOGOUT_ALL_OTHERS": "All other sessions logged out",
};

export default function AccountSecurityPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showChangePassword, setShowChangePassword] = useState(false);

  const { data: sessions, isLoading: sessionsLoading } = useQuery<UserSessionData[]>({
    queryKey: ["/api/auth/sessions"],
  });

  const { data: securityLogsData, isLoading: logsLoading } = useQuery<any>({
    queryKey: ["/api/auth/security-logs"],
  });
  const securityLogs: SecurityLogEntry[] | undefined = securityLogsData?.results ?? securityLogsData;

  const logoutSessionMutation = useMutation({
    mutationFn: async (sessionId: number) => {
      await apiRequest("POST", `/api/auth/sessions/${sessionId}/logout`);
    },
    onSuccess: () => {
      toast({ title: "Session Logged Out", description: "The selected session has been terminated." });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/sessions"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const logoutOthersMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout-others");
    },
    onSuccess: () => {
      toast({ title: "Done", description: "All other sessions have been logged out." });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/sessions"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (showChangePassword) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => setShowChangePassword(false)} className="mb-4" data-testid="button-back-security">
          Back to Account Security
        </Button>
        <ChangePasswordPage onSuccess={() => setShowChangePassword(false)} />
      </div>
    );
  }

  const activeSessions = sessions?.filter(s => s.isActive) || [];
  const recentSessions = sessions?.filter(s => !s.isActive).slice(0, 10) || [];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-xl font-semibold" data-testid="text-page-title">Account Security</h1>
          <p className="text-sm text-muted-foreground">Manage your password and active sessions</p>
        </div>
      </div>

      <Card data-testid="card-password-section">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="w-4 h-4" />
            Password
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => setShowChangePassword(true)} data-testid="button-change-password">
            Change Password
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </CardContent>
      </Card>

      <Card data-testid="card-active-sessions">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Monitor className="w-4 h-4" />
              Active Sessions ({activeSessions.length})
            </CardTitle>
            {activeSessions.length > 1 && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => logoutOthersMutation.mutate()}
                disabled={logoutOthersMutation.isPending}
                data-testid="button-logout-others"
              >
                <LogOut className="w-3 h-3 mr-1" />
                Logout All Others
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {sessionsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : activeSessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active sessions.</p>
          ) : (
            <div className="space-y-3">
              {activeSessions.map(session => (
                <div key={session.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`session-active-${session.id}`}>
                  <div className="flex items-center gap-3">
                    {getDeviceIcon(session.deviceType)}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{session.browser}</span>
                        <span className="text-xs text-muted-foreground">on {session.os}</span>
                        {session.isCurrent && <Badge variant="secondary" className="text-[10px] h-4">Current</Badge>}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1"><Globe className="w-3 h-3" />{session.ipAddress}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Last active: {formatDate(session.lastActivityAt)}</span>
                      </div>
                    </div>
                  </div>
                  {!session.isCurrent && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => logoutSessionMutation.mutate(session.id)}
                      disabled={logoutSessionMutation.isPending}
                      data-testid={`button-logout-session-${session.id}`}
                    >
                      <LogOut className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {recentSessions.length > 0 && (
        <Card data-testid="card-recent-sessions">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentSessions.map(session => (
                <div key={session.id} className="flex items-center justify-between p-2 border rounded text-sm opacity-70" data-testid={`session-recent-${session.id}`}>
                  <div className="flex items-center gap-2">
                    {getDeviceIcon(session.deviceType)}
                    <span>{session.browser} on {session.os}</span>
                    <span className="text-xs text-muted-foreground">{session.ipAddress}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDate(session.loginAt)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-security-logs">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Security Activity
          </CardTitle>
          <CardDescription>Recent security events for your account</CardDescription>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : !securityLogs || securityLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No security events recorded yet.</p>
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {securityLogs.slice(0, 30).map(log => (
                <div key={log.id} className="flex items-center justify-between py-1.5 px-2 text-xs border-b last:border-0" data-testid={`security-log-${log.id}`}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{EVENT_LABELS[log.eventType] || log.eventType}</span>
                    {log.ipAddress && <span className="text-muted-foreground">{log.ipAddress}</span>}
                  </div>
                  <span className="text-muted-foreground">{formatDate(log.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
