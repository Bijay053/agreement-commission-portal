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
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()} data-testid="inactivity-dialog">
        <DialogHeader className="text-center">
          <div className="mx-auto w-14 h-14 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mb-2">
            <Clock className="w-7 h-7 text-amber-600" />
          </div>
          <DialogTitle>Session About to Expire</DialogTitle>
          <DialogDescription>
            You will be logged out due to inactivity.
          </DialogDescription>
        </DialogHeader>
        <div className="text-center py-4">
          <div className="text-4xl font-mono font-bold text-amber-600" data-testid="text-countdown">
            {minutes}:{seconds.toString().padStart(2, "0")}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Click "Stay Logged In" to continue your session.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={handleForceLogout} data-testid="button-logout-now">
            <LogOut className="w-4 h-4 mr-1" />
            Logout Now
          </Button>
          <Button className="flex-1" onClick={handleStayLoggedIn} data-testid="button-stay-logged-in">
            Stay Logged In
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
