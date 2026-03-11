import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation, useSearch } from "wouter";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Building2, MapPin, Calendar, Edit, FileText,
  Target, DollarSign, Users, Shield, Clock, Globe,
} from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import OverviewTab from "@/components/agreement/overview-tab";
import CommissionTab from "@/components/agreement/commission-tab";
import TargetsTab from "@/components/agreement/targets-tab";
import ContactsTab from "@/components/agreement/contacts-tab";
import DocumentsTab from "@/components/agreement/documents-tab";
import AuditTab from "@/components/agreement/audit-tab";

function getStatusBadge(status: string) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    active: { label: "Active", variant: "default" },
    draft: { label: "Draft", variant: "secondary" },
    expired: { label: "Expired", variant: "destructive" },
    terminated: { label: "Terminated", variant: "destructive" },
    renewal_in_progress: { label: "Renewal in Progress", variant: "outline" },
  };
  const s = map[status] || { label: status, variant: "secondary" as const };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

export default function AgreementDetailPage() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const { hasPermission } = useAuth();
  const agreementId = parseInt(params.id!);
  const initialTab = new URLSearchParams(searchString).get("tab") || "overview";

  const { data: agreement, isLoading } = useQuery<any>({
    queryKey: ["/api/agreements", agreementId],
    queryFn: async () => {
      const res = await fetch(`/api/agreements/${agreementId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!agreement) {
    return (
      <div className="p-6 max-w-7xl mx-auto text-center py-20">
        <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
        <h2 className="text-lg font-medium">Agreement not found</h2>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/agreements")}>
          Back to Agreements
        </Button>
      </div>
    );
  }

  const daysLeft = differenceInDays(parseISO(agreement.expiryDate), new Date());
  const territoryDisplay = agreement.territoryType === "global"
    ? "Global"
    : agreement.territories?.map((t: any) => t.name).join(", ") || "—";

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/agreements")}
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-muted-foreground">{agreement.agreementCode}</span>
            {getStatusBadge(agreement.status)}
          </div>
          <h1 className="text-xl font-semibold mt-1 truncate" data-testid="text-agreement-title">
            {agreement.title}
          </h1>
        </div>
        {hasPermission("agreement.edit") && (
          <Button
            variant="outline"
            onClick={() => navigate(`/agreements/${agreementId}/edit`)}
            data-testid="button-edit-agreement"
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3.5">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Building2 className="w-3.5 h-3.5" /> Provider
            </div>
            <p className="text-sm font-medium truncate">{agreement.universityName}</p>
            {agreement.providerCountryName && (
              <p className="text-xs text-muted-foreground">{agreement.providerCountryName}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3.5">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              {agreement.territoryType === "global" ? <Globe className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />} Territory
            </div>
            <p className="text-sm font-medium">{territoryDisplay}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3.5">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Calendar className="w-3.5 h-3.5" /> Period
            </div>
            <p className="text-sm font-medium">
              {format(parseISO(agreement.startDate), "dd MMM yy")} - {format(parseISO(agreement.expiryDate), "dd MMM yy")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3.5">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Clock className="w-3.5 h-3.5" /> Time Remaining
            </div>
            <p className={`text-sm font-medium ${
              daysLeft <= 7 ? "text-red-600 dark:text-red-400" :
              daysLeft <= 30 ? "text-amber-600 dark:text-amber-400" :
              daysLeft <= 90 ? "text-yellow-600 dark:text-yellow-400" :
              "text-emerald-600 dark:text-emerald-400"
            }`}>
              {daysLeft > 0 ? `${daysLeft} days` : daysLeft === 0 ? "Today" : "Expired"}
            </p>
          </CardContent>
        </Card>
      </div>

      {!hasPermission("agreement.edit") && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 text-amber-700 dark:text-amber-300 rounded-md text-sm">
          <Shield className="w-4 h-4" />
          <span>View Only - You do not have edit permissions for this agreement</span>
        </div>
      )}

      <Tabs
        defaultValue={initialTab}
        onValueChange={(v) => navigate(`/agreements/${agreementId}?tab=${v}`, { replace: true })}
        className="space-y-4"
      >
        <TabsList data-testid="tabs-agreement-detail">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <FileText className="w-3.5 h-3.5 mr-1.5" /> Overview
          </TabsTrigger>
          {hasPermission("commission.view") && (
            <TabsTrigger value="commission" data-testid="tab-commission">
              <DollarSign className="w-3.5 h-3.5 mr-1.5" /> Commission
            </TabsTrigger>
          )}
          {hasPermission("targets.view") && (
            <TabsTrigger value="targets" data-testid="tab-targets">
              <Target className="w-3.5 h-3.5 mr-1.5" /> Targets
            </TabsTrigger>
          )}
          {hasPermission("contacts.view") && (
            <TabsTrigger value="contacts" data-testid="tab-contacts">
              <Users className="w-3.5 h-3.5 mr-1.5" /> Contacts
            </TabsTrigger>
          )}
          {hasPermission("document.list") && (
            <TabsTrigger value="documents" data-testid="tab-documents">
              <FileText className="w-3.5 h-3.5 mr-1.5" /> Documents
            </TabsTrigger>
          )}
          {hasPermission("audit.view") && (
            <TabsTrigger value="audit" data-testid="tab-audit">
              <Shield className="w-3.5 h-3.5 mr-1.5" /> Audit
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab agreement={agreement} />
        </TabsContent>
        {hasPermission("commission.view") && (
          <TabsContent value="commission">
            <CommissionTab agreementId={agreementId} />
          </TabsContent>
        )}
        {hasPermission("targets.view") && (
          <TabsContent value="targets">
            <TargetsTab agreementId={agreementId} />
          </TabsContent>
        )}
        {hasPermission("contacts.view") && (
          <TabsContent value="contacts">
            <ContactsTab agreementId={agreementId} />
          </TabsContent>
        )}
        {hasPermission("document.list") && (
          <TabsContent value="documents">
            <DocumentsTab agreementId={agreementId} />
          </TabsContent>
        )}
        {hasPermission("audit.view") && (
          <TabsContent value="audit">
            <AuditTab agreementId={agreementId} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
