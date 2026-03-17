import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Lock, Mail, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

export default function LoginPage() {
  const { login } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();

  const params = new URLSearchParams(window.location.search);
  const reason = params.get("reason");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const result = await login(email, password);
      if (result.requiresOtp) {
        toast({ title: "Verification Required", description: "A verification code has been sent to your email." });
      }
    } catch (err: any) {
      toast({ title: "Login failed", description: err.message || "Invalid credentials", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden" style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #2563eb 50%, #1d4ed8 100%)" }}>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full bg-blue-300/20 blur-3xl" />
          <div className="absolute top-1/2 left-1/3 w-48 h-48 rounded-full bg-sky-200/30 blur-2xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20">
              <span className="text-2xl font-bold">S</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Study Info Centre</h2>
              <p className="text-sm text-blue-200">Agreement Portal</p>
            </div>
          </div>
          <h1 className="text-4xl font-bold leading-tight mb-4">
            Manage Agreements<br />
            <span className="text-blue-200">& Commissions</span>
          </h1>
          <p className="text-blue-100 text-lg leading-relaxed max-w-md">
            Streamline your university agreements, track commissions, and manage contacts all in one place.
          </p>
          <div className="mt-12 grid grid-cols-3 gap-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <p className="text-2xl font-bold">100+</p>
              <p className="text-sm text-blue-200 mt-1">Agreements</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <p className="text-2xl font-bold">50+</p>
              <p className="text-sm text-blue-200 mt-1">Providers</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <p className="text-2xl font-bold">24/7</p>
              <p className="text-sm text-blue-200 mt-1">Monitoring</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md">
          <div className="text-center mb-8 lg:text-left">
            <div className="lg:hidden flex items-center justify-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                <span className="text-lg font-bold text-primary-foreground">S</span>
              </div>
              <div>
                <h2 className="text-sm font-semibold">Study Info Centre</h2>
                <p className="text-xs text-muted-foreground">Agreement Portal</p>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>
            <p className="text-sm text-muted-foreground mt-2">Sign in to access your dashboard</p>
          </div>

          {reason === "inactivity" && (
            <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-800 dark:text-amber-200 text-center" data-testid="text-inactivity-notice">
              You were logged out due to inactivity. Please sign in again.
            </div>
          )}
          {reason === "expired" && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-800 dark:text-red-200 text-center" data-testid="text-session-expired-notice">
              Your session has expired. Please sign in again.
            </div>
          )}

          <Card className="shadow-lg border-0 bg-card/80 backdrop-blur-sm">
            <CardContent className="p-8">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">Email address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      data-testid="input-email"
                      type="email"
                      placeholder="you@studyinfocentre.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-11"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                    <a href="/forgot-password" className="text-xs text-primary hover:text-primary/80 transition-colors" data-testid="link-forgot-password">
                      Forgot password?
                    </a>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="password"
                      data-testid="input-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10 h-11"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      data-testid="button-toggle-password"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 text-sm font-medium"
                  disabled={isLoading}
                  data-testid="button-login"
                >
                  {isLoading ? "Signing in..." : "Sign in"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground mt-6">
            Secure access managed by Study Info Centre
          </p>
        </div>
      </div>
    </div>
  );
}
