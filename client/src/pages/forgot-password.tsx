import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Shield, Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Error", description: data.message || "Something went wrong", variant: "destructive" });
      } else {
        setIsSubmitted(true);
      }
    } catch {
      toast({ title: "Error", description: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">Agreement Portal</h1>
          <p className="text-sm text-muted-foreground mt-1">Study Info Centre</p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <h2 className="text-lg font-medium text-foreground text-center" data-testid="text-form-title">
              {isSubmitted ? "Check your email" : "Reset your password"}
            </h2>
          </CardHeader>
          <CardContent>
            {isSubmitted ? (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <CheckCircle className="w-12 h-12 text-green-600 dark:text-green-400" />
                </div>
                <p className="text-sm text-muted-foreground text-center" data-testid="text-success-message">
                  If an account with <span className="font-medium text-foreground">{email}</span> exists, 
                  a password reset link has been sent. Please check your email and follow the instructions.
                </p>
                <p className="text-xs text-muted-foreground text-center">
                  The link will expire in 30 minutes.
                </p>
                <div className="pt-2">
                  <Link href="/login">
                    <Button variant="outline" className="w-full" data-testid="link-back-to-login">
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back to sign in
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <p className="text-sm text-muted-foreground" data-testid="text-instructions">
                  Enter the email address associated with your account and we'll send you a link to reset your password.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      data-testid="input-email"
                      type="email"
                      placeholder="you@studyinfocentre.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                  data-testid="button-send-reset"
                >
                  {isLoading ? "Sending..." : "Send reset link"}
                </Button>

                <div className="text-center pt-2">
                  <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground" data-testid="link-back-to-login-form">
                    <span className="inline-flex items-center gap-1">
                      <ArrowLeft className="w-3 h-3" />
                      Back to sign in
                    </span>
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
