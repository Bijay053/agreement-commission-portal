import { useState, useEffect, useRef } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Shield, Mail, RefreshCw } from "lucide-react";

interface VerifyOtpPageProps {
  maskedEmail: string;
  onCancel: () => void;
}

export default function VerifyOtpPage({ maskedEmail, onCancel }: VerifyOtpPageProps) {
  const { toast } = useToast();
  const { verifyOtp } = useAuth();
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [expiryCountdown, setExpiryCountdown] = useState(300);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setExpiryCountdown(prev => {
        if (prev <= 0) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown(prev => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleVerify = async () => {
    if (!code.trim() || code.length !== 6) {
      toast({ title: "Error", description: "Please enter the 6-digit verification code", variant: "destructive" });
      return;
    }
    setVerifying(true);
    try {
      await verifyOtp(code.trim());
    } catch (err: any) {
      const msg = err.message || "Verification failed";
      toast({ title: "Verification Failed", description: msg, variant: "destructive" });
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await apiRequest("POST", "/api/auth/resend-otp");
      toast({ title: "Code Sent", description: "A new verification code has been sent to your email" });
      setCooldown(60);
      setExpiryCountdown(300);
      setCode("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to resend code", variant: "destructive" });
    } finally {
      setResending(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md" data-testid="otp-card">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
            <Shield className="w-7 h-7 text-blue-600" />
          </div>
          <CardTitle className="text-xl">Verify Your Identity</CardTitle>
          <CardDescription className="text-sm">
            We sent a verification code to <strong>{maskedEmail}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Enter 6-digit code</label>
            <Input
              ref={inputRef}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className="text-center text-2xl tracking-[0.5em] font-mono h-14"
              maxLength={6}
              onKeyDown={(e) => { if (e.key === "Enter" && code.length === 6) handleVerify(); }}
              data-testid="input-otp"
            />
          </div>

          {expiryCountdown > 0 ? (
            <p className="text-xs text-center text-muted-foreground">
              Code expires in <span className="font-mono font-medium text-amber-600">{formatTime(expiryCountdown)}</span>
            </p>
          ) : (
            <p className="text-xs text-center text-red-500 font-medium">Code expired. Please request a new one.</p>
          )}

          <Button
            className="w-full"
            disabled={verifying || code.length !== 6 || expiryCountdown <= 0}
            onClick={handleVerify}
            data-testid="button-verify-otp"
          >
            {verifying ? "Verifying..." : "Verify & Sign In"}
          </Button>

          <div className="flex items-center justify-between pt-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={resending || cooldown > 0}
              onClick={handleResend}
              data-testid="button-resend-otp"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" />
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend Code"}
            </Button>
            <Button variant="ghost" size="sm" onClick={onCancel} data-testid="button-back-login">
              Back to Login
            </Button>
          </div>

          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
            <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <p className="text-[11px] text-muted-foreground">
              Check your email inbox (and spam folder) for the verification code. The code is valid for 5 minutes.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
