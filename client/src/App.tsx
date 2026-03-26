import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AccessGuard } from "@/components/access-guard";
import { InactivityMonitor } from "@/components/inactivity-monitor";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import EmployeePortal from "@/pages/employee-portal";
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
import SubAgentCommissionPage from "@/pages/sub-agent-commission";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import VerifyOtpPage from "@/pages/verify-otp";
import ChangePasswordPage from "@/pages/change-password";
import AccountSecurityPage from "@/pages/account-security";
import TemplatesPage from "@/pages/templates";
import EmployeeDetailPage from "@/pages/employee-detail";
import SignAgreementPage from "@/pages/sign-agreement";
import SignOfferPage from "@/pages/sign-offer";
import ProviderCommissionPage from "@/pages/provider-commission";
import DropdownSettingsPage from "@/pages/dropdown-settings";
import HRMSAdminPage from "@/pages/hrms-admin";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

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
        <AccessGuard permission="commission_tracker.student.read">
          <CommissionTrackerPage />
        </AccessGuard>
      </Route>
      <Route path="/commission-tracker/:id">
        <AccessGuard permission="commission_tracker.student.read">
          <CommissionTrackerDetailPage />
        </AccessGuard>
      </Route>
      <Route path="/sub-agent-commission">
        <AccessGuard permission="sub_agent_commission.view">
          <SubAgentCommissionPage />
        </AccessGuard>
      </Route>
      <Route path="/sub-agent">
        {() => {
          window.location.replace("/sub-agent-commission" + window.location.search);
          return null;
        }}
      </Route>
      <Route path="/provider-commission">
        <AccessGuard permission="provider_commission.view">
          <ProviderCommissionPage />
        </AccessGuard>
      </Route>
      <Route path="/templates">
        <AccessGuard permission="emp_template.view">
          <TemplatesPage />
        </AccessGuard>
      </Route>
      <Route path="/employees/:id">
        {(params) => (
          <AccessGuard permission={["employee.view", "hrms.staff.read"]}>
            <EmployeeDetailPage params={params} />
          </AccessGuard>
        )}
      </Route>
      <Route path="/audit-logs">
        <AccessGuard permission="audit.view">
          <AuditLogsPage />
        </AccessGuard>
      </Route>
      <Route path="/dropdown-settings">
        <AccessGuard permission="dropdown_settings.option.read">
          <DropdownSettingsPage />
        </AccessGuard>
      </Route>
      <Route path="/hrms">
        <AccessGuard permission={["hrms.organization.read", "hrms.attendance.read", "hrms.staff.read", "hrms.salary.read", "hrms.leave_request.read", "hrms.leave_request.approve", "hrms.leave_type.read", "hrms.holiday.read", "hrms.bonus.read", "hrms.expense.read", "hrms.advance.read", "hrms.payroll.read", "hrms.tax.read", "hrms.department.read", "hrms.fiscal_year.read", "hrms.notification.read", "hrms.notification.update", "employee.view"]}>
          <HRMSAdminPage />
        </AccessGuard>
      </Route>
      <Route path="/account-security" component={AccountSecurityPage} />
      <Route path="/change-password">
        {() => <ChangePasswordPage />}
      </Route>
      <Route path="/login">{() => { window.location.href = "/"; return null; }}</Route>
      <Route path="/forgot-password">{() => { window.location.href = "/"; return null; }}</Route>
      <Route path="/reset-password">{() => { window.location.href = "/"; return null; }}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function PasswordExpiryWarning() {
  const { passwordWarning, daysUntilExpiry } = useAuth();
  const [, setLocation] = useLocation();
  const [dismissed, setDismissed] = useState(false);

  if (!passwordWarning || dismissed) return null;

  return (
    <Alert className="mx-4 mt-2 border-amber-300 bg-amber-50 dark:bg-amber-900/20" data-testid="alert-password-expiry">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertDescription className="flex items-center justify-between">
        <span className="text-sm text-amber-800 dark:text-amber-200">
          Your password will expire in {daysUntilExpiry} day(s). Please change it soon.
        </span>
        <div className="flex gap-2 ml-4">
          <Button size="sm" variant="outline" onClick={() => setLocation("/change-password")} data-testid="button-change-password-warning">
            Change Now
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
            Dismiss
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

import { useState } from "react";

function AuthenticatedApp() {
  const { user, isLoading, otpPending, passwordExpired, clearOtpPending, clearPasswordExpired } = useAuth();

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

  if (otpPending) {
    return (
      <VerifyOtpPage
        maskedEmail={otpPending.maskedEmail}
        onCancel={clearOtpPending}
      />
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

  if (passwordExpired) {
    return (
      <ChangePasswordPage
        forced={true}
        onSuccess={clearPasswordExpired}
      />
    );
  }

  const isPeoplePortal = window.location.hostname.includes("people.");

  if (isPeoplePortal) {
    return (
      <>
        <EmployeePortal />
        <InactivityMonitor />
      </>
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
          <header className="flex items-center justify-between gap-2 px-3 border-b h-11 shrink-0 bg-background/80 backdrop-blur-sm">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
          </header>
          <PasswordExpiryWarning />
          <main className="flex-1 overflow-auto bg-accent/20">
            <Router />
          </main>
        </div>
      </div>
      <InactivityMonitor />
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Switch>
          <Route path="/sign/:token">
            {(params: { token: string }) => <SignAgreementPage params={params} />}
          </Route>
          <Route path="/sign-offer/:token">
            {(params: { token: string }) => <SignOfferPage params={params} />}
          </Route>
          <Route>
            <AuthProvider>
              <AuthenticatedApp />
            </AuthProvider>
          </Route>
        </Switch>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
