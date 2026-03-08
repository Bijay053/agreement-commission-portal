import { useAuth } from "@/lib/auth";
import { ShieldX } from "lucide-react";

interface AccessGuardProps {
  permission: string | string[];
  children: React.ReactNode;
}

export function AccessGuard({ permission, children }: AccessGuardProps) {
  const { hasPermission, hasAnyPermission } = useAuth();

  const hasAccess = Array.isArray(permission)
    ? hasAnyPermission(...permission)
    : hasPermission(permission);

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4" data-testid="access-denied">
        <ShieldX className="w-16 h-16 text-muted-foreground/40 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          You do not have permission to view this page. Contact your administrator if you believe this is an error.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
