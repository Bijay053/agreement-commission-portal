import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AccessGuard } from "@/components/access-guard";
import { Skeleton } from "@/components/ui/skeleton";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import AgreementsListPage from "@/pages/agreements-list";
import AgreementDetailPage from "@/pages/agreement-detail";
import AgreementFormPage from "@/pages/agreement-form";
import ProvidersListPage from "@/pages/providers-list";
import UsersManagementPage from "@/pages/users-management";
import AuditLogsPage from "@/pages/audit-logs";
import RolesManagementPage from "@/pages/roles-management";
import ContactsListPage from "@/pages/contacts-list";
import CommissionTablePage from "@/pages/commission-table";
import CommissionTrackerPage from "@/pages/commission-tracker";
import CommissionTrackerDetailPage from "@/pages/commission-tracker-detail";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";

function Router() {
  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/agreements">
        <AccessGuard permission="agreement.view">
          <AgreementsListPage />
        </AccessGuard>
      </Route>
      <Route path="/agreements/new">
        <AccessGuard permission="agreement.create">
          <AgreementFormPage />
        </AccessGuard>
      </Route>
      <Route path="/agreements/:id/edit">
        <AccessGuard permission="agreement.edit">
          <AgreementFormPage />
        </AccessGuard>
      </Route>
      <Route path="/agreements/:id">
        <AccessGuard permission="agreement.view">
          <AgreementDetailPage />
        </AccessGuard>
      </Route>
      <Route path="/contacts">
        <AccessGuard permission="contacts.view">
          <ContactsListPage />
        </AccessGuard>
      </Route>
      <Route path="/commission">
        <AccessGuard permission={["commission.view", "bonus.view"]}>
          <CommissionTablePage />
        </AccessGuard>
      </Route>
      <Route path="/providers">
        <AccessGuard permission="providers.provider.read">
          <ProvidersListPage />
        </AccessGuard>
      </Route>
      <Route path="/users">
        <AccessGuard permission="security.user.manage">
          <UsersManagementPage />
        </AccessGuard>
      </Route>
      <Route path="/roles">
        <AccessGuard permission="security.role.manage">
          <RolesManagementPage />
        </AccessGuard>
      </Route>
      <Route path="/commission-tracker">
        <AccessGuard permission="commission_tracker.view">
          <CommissionTrackerPage />
        </AccessGuard>
      </Route>
      <Route path="/commission-tracker/:id">
        <AccessGuard permission="commission_tracker.view">
          <CommissionTrackerDetailPage />
        </AccessGuard>
      </Route>
      <Route path="/audit-logs">
        <AccessGuard permission="audit.view">
          <AuditLogsPage />
        </AccessGuard>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedApp() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="space-y-4 text-center">
          <Skeleton className="h-12 w-12 rounded-full mx-auto" />
          <Skeleton className="h-4 w-32 mx-auto" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Switch>
        <Route path="/forgot-password" component={ForgotPasswordPage} />
        <Route path="/reset-password" component={ResetPasswordPage} />
        <Route><LoginPage /></Route>
      </Switch>
    );
  }

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between gap-2 p-2 border-b h-12 shrink-0">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
          </header>
          <main className="flex-1 overflow-auto">
            <Router />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AuthenticatedApp />
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
