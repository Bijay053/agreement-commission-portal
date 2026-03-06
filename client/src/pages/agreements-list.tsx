import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Search, Plus, FileText, Building2, MapPin, Calendar, Filter,
} from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { AGREEMENT_STATUSES } from "@shared/schema";

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

function getTypeBadge(type: string) {
  const labels: Record<string, string> = {
    agency: "Agency",
    commission_schedule: "Commission",
    addendum: "Addendum",
    renewal: "Renewal",
    mou: "MOU",
    other: "Other",
  };
  return <Badge variant="outline">{labels[type] || type}</Badge>;
}

export default function AgreementsListPage() {
  const [, navigate] = useLocation();
  const { hasPermission } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [countryFilter, setCountryFilter] = useState<string>("all");

  const queryParams = new URLSearchParams();
  if (search) queryParams.set("search", search);
  if (statusFilter && statusFilter !== "all") queryParams.set("status", statusFilter);
  if (countryFilter && countryFilter !== "all") queryParams.set("countryId", countryFilter);
  const queryString = queryParams.toString();

  const { data: agreements, isLoading } = useQuery<any[]>({
    queryKey: ["/api/agreements", queryString],
    queryFn: async () => {
      const res = await fetch(`/api/agreements?${queryString}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch agreements");
      return res.json();
    },
  });

  const { data: countries } = useQuery<any[]>({ queryKey: ["/api/countries"] });

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-agreements-title">Agreements</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage university partnership agreements</p>
        </div>
        {hasPermission("agreement.create") && (
          <Button onClick={() => navigate("/agreements/new")} data-testid="button-create-agreement">
            <Plus className="w-4 h-4 mr-2" />
            New Agreement
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search agreements, universities..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                data-testid="input-search-agreements"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]" data-testid="select-status-filter">
                <Filter className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {AGREEMENT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={countryFilter} onValueChange={setCountryFilter}>
              <SelectTrigger className="w-[160px]" data-testid="select-country-filter">
                <MapPin className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Countries</SelectItem>
                {countries?.map((c: any) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-20" /></CardContent></Card>
          ))}
        </div>
      ) : agreements && agreements.length > 0 ? (
        <div className="space-y-2">
          {agreements.map((agr: any) => {
            const daysLeft = differenceInDays(parseISO(agr.expiryDate), new Date());
            return (
              <Card
                key={agr.id}
                className="cursor-pointer hover-elevate transition-all"
                onClick={() => navigate(`/agreements/${agr.id}`)}
                data-testid={`card-agreement-${agr.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-muted-foreground">{agr.agreementCode}</span>
                        {getStatusBadge(agr.status)}
                        {getTypeBadge(agr.agreementType)}
                      </div>
                      <h3 className="text-base font-medium mt-1.5 truncate">{agr.title}</h3>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5" />
                          {agr.universityName}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5" />
                          {agr.territoryCountry}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          {format(parseISO(agr.startDate), "dd MMM yyyy")} - {format(parseISO(agr.expiryDate), "dd MMM yyyy")}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {agr.status === "active" && (
                        <div className={`text-sm font-medium ${
                          daysLeft <= 7 ? "text-red-600 dark:text-red-400" :
                          daysLeft <= 30 ? "text-amber-600 dark:text-amber-400" :
                          daysLeft <= 90 ? "text-yellow-600 dark:text-yellow-400" :
                          "text-emerald-600 dark:text-emerald-400"
                        }`}>
                          {daysLeft > 0 ? `${daysLeft} days left` : "Expired"}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
            <h3 className="text-lg font-medium">No agreements found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {search || statusFilter !== "all" || countryFilter !== "all"
                ? "Try adjusting your filters"
                : "Create your first agreement to get started"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
