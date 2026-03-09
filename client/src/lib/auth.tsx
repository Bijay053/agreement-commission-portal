import { createContext, useContext, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "./queryClient";
import type { User, Role } from "@shared/schema";

interface AuthUser {
  user: Omit<User, "passwordHash">;
  permissions: string[];
  roles: Role[];
  passwordExpired?: boolean;
  passwordWarning?: boolean;
  daysUntilExpiry?: number | null;
}

interface OtpPendingState {
  maskedEmail: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  otpPending: OtpPendingState | null;
  passwordExpired: boolean;
  passwordWarning: boolean;
  daysUntilExpiry: number | null;
  login: (email: string, password: string) => Promise<{ requiresOtp: boolean; maskedEmail?: string }>;
  verifyOtp: (code: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  clearOtpPending: () => void;
  clearPasswordExpired: () => void;
  hasPermission: (code: string) => boolean;
  hasAnyPermission: (...codes: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [otpPending, setOtpPending] = useState<OtpPendingState | null>(null);
  const [passwordExpired, setPasswordExpired] = useState(false);
  const [passwordWarning, setPasswordWarning] = useState(false);
  const [daysUntilExpiry, setDaysUntilExpiry] = useState<number | null>(null);

  const { data: authData, isLoading } = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (res.status === 401) return null;
        if (!res.ok) return null;
        const data = await res.json();
        if (data.passwordExpired) setPasswordExpired(true);
        if (data.passwordWarning) {
          setPasswordWarning(true);
          setDaysUntilExpiry(data.daysUntilExpiry);
        }
        return data;
      } catch {
        return null;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiRequest("POST", "/api/auth/login", { email, password });
    const data = await res.json();
    if (data.requiresOtp) {
      setOtpPending({ maskedEmail: data.email });
      return { requiresOtp: true, maskedEmail: data.email };
    }
    queryClient.setQueryData(["/api/auth/me"], data);
    return { requiresOtp: false };
  }, [queryClient]);

  const verifyOtp = useCallback(async (code: string) => {
    const res = await apiRequest("POST", "/api/auth/verify-otp", { code });
    const data = await res.json();
    setOtpPending(null);
    if (data.passwordExpired) setPasswordExpired(true);
    if (data.passwordWarning) {
      setPasswordWarning(true);
      setDaysUntilExpiry(data.daysUntilExpiry);
    }
    queryClient.setQueryData(["/api/auth/me"], data);
    return data;
  }, [queryClient]);

  const logout = useCallback(async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
    } catch {}
    setOtpPending(null);
    setPasswordExpired(false);
    setPasswordWarning(false);
    setDaysUntilExpiry(null);
    queryClient.setQueryData(["/api/auth/me"], null);
    queryClient.clear();
  }, [queryClient]);

  const clearOtpPending = useCallback(() => {
    setOtpPending(null);
  }, []);

  const clearPasswordExpired = useCallback(() => {
    setPasswordExpired(false);
    queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
  }, [queryClient]);

  const hasPermission = useCallback((code: string) => {
    return authData?.permissions?.includes(code) ?? false;
  }, [authData]);

  const hasAnyPermission = useCallback((...codes: string[]) => {
    return codes.some(code => authData?.permissions?.includes(code));
  }, [authData]);

  return (
    <AuthContext.Provider value={{
      user: authData ?? null,
      isLoading,
      otpPending,
      passwordExpired,
      passwordWarning,
      daysUntilExpiry,
      login,
      verifyOtp,
      logout,
      clearOtpPending,
      clearPasswordExpired,
      hasPermission,
      hasAnyPermission,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
