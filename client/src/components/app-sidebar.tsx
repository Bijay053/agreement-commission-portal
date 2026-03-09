import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard, FileText, Users, Shield, LogOut, User, Building2,
  ChevronDown, ChevronRight, Circle, KeyRound, Contact, DollarSign, Calculator, ShieldCheck, ArrowDownUp,
} from "lucide-react";

const STATUS_ITEMS = [
  { key: "draft", label: "Draft", color: "text-slate-500" },
  { key: "active", label: "Active", color: "text-emerald-500" },
  { key: "renewal_in_progress", label: "Renewal in Progress", color: "text-amber-500" },
  { key: "expired", label: "Expired", color: "text-red-500" },
  { key: "terminated", label: "Terminated", color: "text-red-700" },
];

export function AppSidebar() {
  const [location, navigate] = useLocation();
  const { user, logout, hasPermission } = useAuth();
  const [agreementsExpanded, setAgreementsExpanded] = useState(true);

  const { data: statusCounts } = useQuery<Record<string, number>>({
    queryKey: ["/api/agreements/status-counts"],
    queryFn: async () => {
      const res = await fetch("/api/agreements/status-counts", { credentials: "include" });
      if (!res.ok) return {};
      return res.json();
    },
    enabled: hasPermission("agreement.view"),
    staleTime: 30000,
  });

  const mainNav = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard, show: true },
    { title: "Providers", url: "/providers", icon: Building2, show: hasPermission("providers.provider.read") },
    { title: "Contacts", url: "/contacts", icon: Contact, show: hasPermission("contacts.view") },
    { title: "Commission Table", url: "/commission", icon: DollarSign, show: hasPermission("commission.view") || hasPermission("bonus.view") },
    { title: "Commission Tracker", url: "/commission-tracker", icon: Calculator, show: hasPermission("commission_tracker.view") },
    { title: "Sub-Agent Commission", url: "/sub-agent-commission", icon: ArrowDownUp, show: hasPermission("sub_agent_commission.view") },
  ];

  const adminNav = [
    { title: "Users", url: "/users", icon: Users, show: hasPermission("security.user.manage") },
    { title: "Roles", url: "/roles", icon: KeyRound, show: hasPermission("security.role.manage") },
    { title: "Audit Logs", url: "/audit-logs", icon: Shield, show: hasPermission("audit.view") },
  ];

  const isActive = (url: string) => {
    if (url === "/") return location === "/";
    return location.startsWith(url);
  };

  const currentStatusFilter = (() => {
    if (!location.startsWith("/agreements")) return null;
    const params = new URLSearchParams(window.location.search);
    return params.get("status") || null;
  })();

  const handleAgreementsClick = () => {
    navigate("/agreements");
  };

  const handleStatusClick = (status: string) => {
    navigate(`/agreements?status=${status}`);
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
            <Shield className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold text-sidebar-foreground">Agreement Portal</p>
            <p className="text-[10px] text-muted-foreground">Study Info Centre</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.filter(i => i.show).map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    data-active={isActive(item.url)}
                    data-testid={`nav-${item.title.toLowerCase()}`}
                  >
                    <a href={item.url} onClick={(e) => { e.preventDefault(); navigate(item.url); }}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {hasPermission("agreement.view") && (
                <>
                  <SidebarMenuItem>
                    <div className="flex items-center">
                      <SidebarMenuButton
                        data-active={location.startsWith("/agreements") && !currentStatusFilter}
                        data-testid="nav-agreements"
                        onClick={(e) => {
                          e.preventDefault();
                          handleAgreementsClick();
                        }}
                        className="flex-1"
                      >
                        <FileText className="w-4 h-4" />
                        <span>Agreements</span>
                      </SidebarMenuButton>
                      <button
                        onClick={() => setAgreementsExpanded(!agreementsExpanded)}
                        className="p-1.5 rounded hover:bg-sidebar-accent shrink-0"
                        data-testid="button-toggle-agreement-statuses"
                      >
                        {agreementsExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </SidebarMenuItem>

                  {agreementsExpanded && (
                    <div className="ml-4 space-y-0.5">
                      {STATUS_ITEMS.map((item) => (
                        <SidebarMenuItem key={item.key}>
                          <SidebarMenuButton
                            data-active={currentStatusFilter === item.key}
                            data-testid={`nav-status-${item.key}`}
                            onClick={(e) => {
                              e.preventDefault();
                              handleStatusClick(item.key);
                            }}
                            className="h-8 text-xs justify-between"
                          >
                            <span className="flex items-center gap-2">
                              <Circle className={`w-2 h-2 fill-current ${item.color}`} />
                              <span>{item.label}</span>
                            </span>
                            {statusCounts && statusCounts[item.key] !== undefined && (
                              <Badge variant="secondary" className="h-5 min-w-[20px] text-[10px] px-1.5">
                                {statusCounts[item.key]}
                              </Badge>
                            )}
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </div>
                  )}
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {adminNav.some(i => i.show) && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNav.filter(i => i.show).map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      data-active={isActive(item.url)}
                      data-testid={`nav-${item.title.toLowerCase().replace(/\s/g, "-")}`}
                    >
                      <a href={item.url} onClick={(e) => { e.preventDefault(); navigate(item.url); }}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="p-3 border-t border-sidebar-border space-y-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              data-active={isActive("/account-security")}
              data-testid="nav-account-security"
            >
              <a href="/account-security" onClick={(e) => { e.preventDefault(); navigate("/account-security"); }}>
                <ShieldCheck className="w-4 h-4" />
                <span>Account Security</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{user?.user?.fullName}</p>
            <p className="text-[10px] text-muted-foreground truncate">{user?.roles?.[0]?.name || "User"}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={logout}
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
