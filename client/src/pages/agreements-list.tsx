import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MultiSearchableSelect } from "@/components/ui/multi-searchable-select";
import {
  Search, Plus, FileText, Building2, MapPin, Calendar, Filter, Globe, RotateCcw,
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
  const searchString = useSearch();
  const { hasPermission } = useAuth();

  const urlParams = new URLSearchParams(searchString);
  const urlStatus = urlParams.get("status") || "";

  const [search, setSearch] = useState("");
  const [statusFilters, setStatusFilters] = useState<string[]>(urlStatus ? [urlStatus] : []);
  const [territoryCountryFilters, setTerritoryCountryFilters] = useState<string[]>([]);
  const [providerCountryFilters, setProviderCountryFilters] = useState<string[]>([]);
  const [providerFilters, setProviderFilters] = useState<string[]>([]);

  useEffect(() => {
    setStatusFilters(urlStatus ? [urlStatus] : []);
  }, [urlStatus]);

  const queryParams = new URLSearchParams();
  if (search) queryParams.set("search", search);
  if (statusFilters.length > 0) queryParams.set("status", statusFilters.join(","));
  if (territoryCountryFilters.length > 0) queryParams.set("countryId", territoryCountryFilters.join(","));
  if (providerCountryFilters.length > 0) queryParams.set("providerCountryId", providerCountryFilters.join(","));
  if (providerFilters.length > 0) queryParams.set("providerId", providerFilters.join(","));
  const queryString = queryParams.toString();

  const { data: agreementsData, isLoading } = useQuery<{ count: number; next: string | null; previous: string | null; results: any[] }>({
    queryKey: ["/api/agreements", queryString],
    queryFn: async () => {
      const res = await fetch(`/api/agreements?${queryString}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch agreements");
      const json = await res.json();
      if (Array.isArray(json)) return { count: json.length, next: null, previous: null, results: json };
      return json;
    },
  });
  const agreements = agreementsData?.results;

  const { data: countries } = useQuery<any[]>({ queryKey: ["/api/countries"] });
  const { data: providers } = useQuery<any[]>({
    queryKey: ["/api/providers"],
    queryFn: async () => {
      const res = await fetch("/api/providers?status=active", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const handleStatusChange = (values: string[]) => {
    setStatusFilters(values);
    if (values.length > 0) {
      navigate(`/agreements?status=${values.join(",")}`);
    } else {
      navigate("/agreements");
    }
  };

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-agreements-title">Agreements</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage provider partnership agreements</p>
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
                placeholder="Search agreements, providers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                data-testid="input-search-agreements"
              />
            </div>
            <MultiSearchableSelect
              values={statusFilters}
              onValuesChange={handleStatusChange}
              options={AGREEMENT_STATUSES.map((s) => ({
                value: s,
                label: s.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
              }))}
              placeholder="All Statuses"
              searchPlaceholder="Search statuses..."
              className="w-[160px]"
              data-testid="select-status-filter"
            />
            <MultiSearchableSelect
              values={providerFilters}
              onValuesChange={setProviderFilters}
              options={providers?.map((p: any) => ({
                value: String(p.id),
                label: `${p.name}${p.countryName ? ` (${p.countryName})` : ""}`,
              })) || []}
              placeholder="All Providers"
              searchPlaceholder="Search providers..."
              className="w-[180px]"
              data-testid="select-provider-filter"
            />
            <MultiSearchableSelect
              values={providerCountryFilters}
              onValuesChange={setProviderCountryFilters}
              options={countries?.map((c: any) => ({
                value: String(c.id),
                label: c.name,
              })) || []}
              placeholder="All Provider Countries"
              searchPlaceholder="Search countries..."
              className="w-[180px]"
              data-testid="select-provider-country-filter"
            />
            <MultiSearchableSelect
              values={territoryCountryFilters}
              onValuesChange={setTerritoryCountryFilters}
              options={countries?.map((c: any) => ({
                value: String(c.id),
                label: c.name,
              })) || []}
              placeholder="All Territories"
              searchPlaceholder="Search territories..."
              className="w-[180px]"
              data-testid="select-territory-country-filter"
            />
            <Button
              variant="outline"
              size="default"
              onClick={() => {
                setSearch("");
                setStatusFilters([]);
                setProviderFilters([]);
                setProviderCountryFilters([]);
                setTerritoryCountryFilters([]);
                navigate("/agreements");
              }}
              disabled={!search && statusFilters.length === 0 && providerFilters.length === 0 && providerCountryFilters.length === 0 && territoryCountryFilters.length === 0}
              data-testid="button-reset-filters"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset Filters
            </Button>
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
                        {agr.territoryType === "global" && (
                          <Badge variant="outline" className="gap-1">
                            <Globe className="w-3 h-3" /> Global
                          </Badge>
                        )}
                        {agr.territoryType === "south_asia" && (
                          <Badge variant="outline" className="gap-1">
                            <MapPin className="w-3 h-3" /> South Asia
                          </Badge>
                        )}
                      </div>
                      <h3 className="text-base font-medium mt-1.5 truncate">{agr.title}</h3>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5" />
                          {agr.universityName}
                          {agr.providerCountryName && <span className="text-xs">({agr.providerCountryName})</span>}
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
              {search || statusFilters.length > 0 || territoryCountryFilters.length > 0 || providerCountryFilters.length > 0 || providerFilters.length > 0
                ? <>Try adjusting your filters or <span className="text-foreground underline cursor-pointer" data-testid="link-reset-filters" onClick={() => { setSearch(""); setStatusFilters([]); setProviderFilters([]); setProviderCountryFilters([]); setTerritoryCountryFilters([]); navigate("/agreements"); }}>Reset filters</span></>
                : "Create your first agreement to get started"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
