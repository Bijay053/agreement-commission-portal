import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Shield, Lock, Eye, EyeOff, ArrowLeft, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link, useSearch, useLocation } from "wouter";

function PasswordRule({ met, label }: { met: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {met ? (
        <CheckCircle className="w-3.5 h-3.5 text-green-600 dark:text-green-400 shrink-0" />
      ) : (
        <XCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      )}
      <span className={met ? "text-green-700 dark:text-green-400" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}

export default function ResetPasswordPage() {
  const { toast } = useToast();
  const search = useSearch();
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(search);
  const token = params.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const hasMinLength = newPassword.length >= 12;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasNumber = /\d/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const allRulesMet = hasMinLength && hasUppercase && hasLowercase && hasNumber && passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      toast({ title: "Error", description: "No reset token found. Please use the link from your email.", variant: "destructive" });
      return;
    }

    if (!allRulesMet) {
      toast({ title: "Error", description: "Please meet all password requirements.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Reset failed", description: data.message || "Something went wrong", variant: "destructive" });
      } else {
        toast({ title: "Password reset successful", description: "You can now sign in with your new password." });
        setLocation("/login");
      }
    } catch {
      toast({ title: "Error", description: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <XCircle className="w-12 h-12 text-destructive mx-auto" />
                <h2 className="text-lg font-medium text-foreground" data-testid="text-invalid-token">Invalid Reset Link</h2>
                <p className="text-sm text-muted-foreground">
                  This password reset link is invalid or has expired. Please request a new one.
                </p>
                <Link href="/forgot-password">
                  <Button className="w-full" data-testid="link-request-new-reset">
                    Request new reset link
                  </Button>
                </Link>
                <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground" data-testid="link-back-to-login">
                  <span className="inline-flex items-center gap-1 mt-2">
                    <ArrowLeft className="w-3 h-3" />
                    Back to sign in
                  </span>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">{window.location.hostname.includes("people.") ? "People & HRMS" : "Agreement Portal"}</h1>
          <p className="text-sm text-muted-foreground mt-1">Study Info Centre</p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <h2 className="text-lg font-medium text-foreground text-center" data-testid="text-form-title">
              Set your new password
            </h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="newPassword"
                    data-testid="input-new-password"
                    type={showNewPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pl-10 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    data-testid="button-toggle-new-password"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    data-testid="input-confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    data-testid="button-toggle-confirm-password"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 p-3 rounded-md bg-muted/50" data-testid="password-requirements">
                <p className="text-xs font-medium text-foreground mb-2">Password requirements:</p>
                <PasswordRule met={hasMinLength} label="At least 12 characters" />
                <PasswordRule met={hasUppercase} label="At least one uppercase letter" />
                <PasswordRule met={hasLowercase} label="At least one lowercase letter" />
                <PasswordRule met={hasNumber} label="At least one number" />
                <PasswordRule met={passwordsMatch} label="Passwords match" />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || !allRulesMet}
                data-testid="button-reset-password"
              >
                {isLoading ? "Resetting..." : "Reset password"}
              </Button>

              <div className="text-center pt-2">
                <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground" data-testid="link-back-to-login">
                  <span className="inline-flex items-center gap-1">
                    <ArrowLeft className="w-3 h-3" />
                    Back to sign in
                  </span>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
