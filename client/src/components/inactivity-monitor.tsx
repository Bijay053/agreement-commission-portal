import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock, LogOut } from "lucide-react";

const IDLE_TIMEOUT = 15 * 60 * 1000;
const WARNING_DURATION = 5 * 60 * 1000;
const HEARTBEAT_INTERVAL = 2 * 60 * 1000;

export function InactivityMonitor() {
  const { user, logout } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(300);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const resetIdleTimer = useCallback(() => {
    if (showWarning) return;
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      setCountdown(Math.floor(WARNING_DURATION / 1000));
    }, IDLE_TIMEOUT);
  }, [showWarning]);

  const handleStayLoggedIn = useCallback(async () => {
    setShowWarning(false);
    if (warningTimerRef.current) {
      clearInterval(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    resetIdleTimer();
    try {
      await fetch("/api/auth/heartbeat", { method: "POST", credentials: "include" });
    } catch {}
  }, [resetIdleTimer]);

  const handleForceLogout = useCallback(async () => {
    setShowWarning(false);
    if (warningTimerRef.current) {
      clearInterval(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    await logout();
    window.location.href = "/login?reason=inactivity";
  }, [logout]);

  useEffect(() => {
    if (!user) return;

    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart", "click"];
    const handleActivity = () => resetIdleTimer();

    events.forEach(e => document.addEventListener(e, handleActivity, { passive: true }));
    resetIdleTimer();

    heartbeatRef.current = setInterval(async () => {
      if (!showWarning) {
        try {
          await fetch("/api/auth/heartbeat", { method: "POST", credentials: "include" });
        } catch {}
      }
    }, HEARTBEAT_INTERVAL);

    return () => {
      events.forEach(e => document.removeEventListener(e, handleActivity));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [user, resetIdleTimer, showWarning]);

  useEffect(() => {
    if (!showWarning) return;
    warningTimerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          handleForceLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (warningTimerRef.current) clearInterval(warningTimerRef.current);
    };
  }, [showWarning, handleForceLogout]);

  if (!user) return null;

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;

  return (
    <Dialog open={showWarning} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[420px] p-0 gap-0 overflow-hidden" onInteractOutside={(e) => e.preventDefault()} data-testid="inactivity-dialog">
        <div className="p-6 pb-5">
          <DialogHeader className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center w-11 h-11 rounded-full shrink-0 bg-amber-100 dark:bg-amber-950/50">
                <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="space-y-1.5 pt-0.5">
                <DialogTitle className="text-base font-semibold leading-tight">Session Expiring Soon</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
                  You have been inactive for a while. For security reasons, you will be logged out unless you continue your session.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="text-center py-5 mt-2 bg-muted/30 rounded-lg border">
            <div className="text-4xl font-mono font-bold text-amber-600 dark:text-amber-400" data-testid="text-countdown">
              {minutes}:{seconds.toString().padStart(2, "0")}
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              Time remaining before automatic logout
            </p>
          </div>
        </div>
        <div className="bg-muted/40 border-t px-6 py-3.5 flex justify-end gap-2.5">
          <Button variant="outline" className="h-9 px-4 text-sm" onClick={handleForceLogout} data-testid="button-logout-now">
            <LogOut className="w-3.5 h-3.5 mr-1.5" />
            Logout Now
          </Button>
          <Button className="h-9 px-4 text-sm bg-amber-600 hover:bg-amber-700 text-white" onClick={handleStayLoggedIn} data-testid="button-stay-logged-in">
            Stay Logged In
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
