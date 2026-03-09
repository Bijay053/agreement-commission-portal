import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Shield, Eye, EyeOff, Check, X } from "lucide-react";

interface ChangePasswordPageProps {
  forced?: boolean;
  onSuccess?: () => void;
}

export default function ChangePasswordPage({ forced, onSuccess }: ChangePasswordPageProps) {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const checks = [
    { label: "At least 8 characters", met: newPassword.length >= 8 },
    { label: "One uppercase letter", met: /[A-Z]/.test(newPassword) },
    { label: "One lowercase letter", met: /[a-z]/.test(newPassword) },
    { label: "One number", met: /[0-9]/.test(newPassword) },
    { label: "One special character", met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword) },
    { label: "Passwords match", met: newPassword.length > 0 && newPassword === confirmPassword },
  ];

  const allMet = checks.every(c => c.met);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allMet) return;
    setSubmitting(true);
    try {
      await apiRequest("POST", "/api/auth/change-password", { currentPassword, newPassword, confirmPassword });
      toast({ title: "Password Changed", description: "Your password has been updated successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      if (onSuccess) onSuccess();
      else {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to change password", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={forced ? "min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4" : "p-6 max-w-lg mx-auto"}>
      <Card className={forced ? "w-full max-w-md" : ""} data-testid="change-password-card">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
            <Shield className="w-7 h-7 text-amber-600" />
          </div>
          <CardTitle className="text-xl">
            {forced ? "Password Expired" : "Change Password"}
          </CardTitle>
          <CardDescription>
            {forced
              ? "Your password has expired. Please set a new password to continue."
              : "Update your password regularly to keep your account secure."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="form-change-password">
            <div className="space-y-1.5">
              <Label className="text-sm">Current Password</Label>
              <div className="relative">
                <Input
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  data-testid="input-current-password"
                  className="pr-10"
                />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowCurrent(!showCurrent)}>
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">New Password</Label>
              <div className="relative">
                <Input
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  data-testid="input-new-password"
                  className="pr-10"
                />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowNew(!showNew)}>
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Confirm New Password</Label>
              <div className="relative">
                <Input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  data-testid="input-confirm-password"
                  className="pr-10"
                />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowConfirm(!showConfirm)}>
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1 p-3 bg-muted/50 rounded-lg">
              <p className="text-xs font-medium mb-1.5">Password Requirements:</p>
              {checks.map((c, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs">
                  {c.met ? <Check className="w-3 h-3 text-green-600" /> : <X className="w-3 h-3 text-muted-foreground" />}
                  <span className={c.met ? "text-green-700" : "text-muted-foreground"}>{c.label}</span>
                </div>
              ))}
            </div>

            <Button type="submit" className="w-full" disabled={!allMet || submitting} data-testid="button-change-password">
              {submitting ? "Changing..." : "Change Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
