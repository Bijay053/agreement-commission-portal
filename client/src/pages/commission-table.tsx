import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Search, DollarSign, RotateCcw, ExternalLink, TrendingUp, Award,
} from "lucide-react";
import { AGREEMENT_STATUSES, COMMISSION_MODES, BONUS_TYPES } from "@shared/schema";

function statusBadge(status: string) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    active: { label: "Active", variant: "default" },
    draft: { label: "Draft", variant: "secondary" },
    expired: { label: "Expired", variant: "destructive" },
    terminated: { label: "Terminated", variant: "destructive" },
    renewal_in_progress: { label: "Renewal", variant: "outline" },
  };
  const s = map[status] || { label: status, variant: "secondary" as const };
  return <Badge variant={s.variant} data-testid={`badge-status-${status}`}>{s.label}</Badge>;
}

const commissionModeLabels: Record<string, string> = {
  percentage: "Percentage",
  flat: "Fixed Amount",
};

const basisLabels: Record<string, string> = {
  per_subject: "Per Subject",
  per_term: "Per Term",
  first_year: "First Year",
  full_course: "Full Course",
  per_intake: "Per Intake",
};

const bonusTypeLabels: Record<string, string> = {
  tier_per_student: "Tier Per Student",
  flat_on_target: "Flat on Target",
  country_bonus: "Country Bonus",
  tiered_flat: "Tiered Flat",
};

export default function CommissionTablePage() {
  const [, navigate] = useLocation();
  const { hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState("commission");

  const [commSearch, setCommSearch] = useState("");
  const [commProvider, setCommProvider] = useState("all");
  const [commProviderCountry, setCommProviderCountry] = useState("all");
  const [commStatus, setCommStatus] = useState("all");
  const [commMode, setCommMode] = useState("all");

  const [bonusSearch, setBonusSearch] = useState("");
  const [bonusProvider, setBonusProvider] = useState("all");
  const [bonusProviderCountry, setBonusProviderCountry] = useState("all");
  const [bonusStatus, setBonusStatus] = useState("all");
  const [bonusType, setBonusType] = useState("all");

  const { data: countries } = useQuery<any[]>({ queryKey: ["/api/countries"] });
  const { data: providers } = useQuery<any[]>({
    queryKey: ["/api/providers"],
    queryFn: async () => {
      const res = await fetch("/api/providers?status=active", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const commParams = new URLSearchParams();
  if (commSearch) commParams.set("search", commSearch);
  if (commProvider !== "all") commParams.set("providerId", commProvider);
  if (commProviderCountry !== "all") commParams.set("providerCountryId", commProviderCountry);
  if (commStatus !== "all") commParams.set("agreementStatus", commStatus);
  if (commMode !== "all") commParams.set("commissionMode", commMode);

  const { data: commissionRules, isLoading: commLoading } = useQuery<any[]>({
    queryKey: ["/api/commission-rules", commParams.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/commission-rules?${commParams.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: hasPermission("commission.view"),
  });

  const bonusParams = new URLSearchParams();
  if (bonusSearch) bonusParams.set("search", bonusSearch);
  if (bonusProvider !== "all") bonusParams.set("providerId", bonusProvider);
  if (bonusProviderCountry !== "all") bonusParams.set("providerCountryId", bonusProviderCountry);
  if (bonusStatus !== "all") bonusParams.set("agreementStatus", bonusStatus);
  if (bonusType !== "all") bonusParams.set("bonusType", bonusType);

  const { data: bonusRules, isLoading: bonusLoading } = useQuery<any[]>({
    queryKey: ["/api/bonus-rules", bonusParams.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/bonus-rules?${bonusParams.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: hasPermission("commission.view"),
  });

  const commFiltersActive = commSearch !== "" || commProvider !== "all" || commProviderCountry !== "all" || commStatus !== "all" || commMode !== "all";
  const bonusFiltersActive = bonusSearch !== "" || bonusProvider !== "all" || bonusProviderCountry !== "all" || bonusStatus !== "all" || bonusType !== "all";

  const resetCommFilters = () => {
    setCommSearch("");
    setCommProvider("all");
    setCommProviderCountry("all");
    setCommStatus("all");
    setCommMode("all");
  };

  const resetBonusFilters = () => {
    setBonusSearch("");
    setBonusProvider("all");
    setBonusProviderCountry("all");
    setBonusStatus("all");
    setBonusType("all");
  };

  const providerOptions = [
    { value: "all", label: "All Providers" },
    ...(providers?.map((p: any) => ({ value: String(p.id), label: `${p.name}${p.countryName ? ` (${p.countryName})` : ""}` })) || []),
  ];
  const countryOptions = [
    { value: "all", label: "All Countries" },
    ...(countries?.map((c: any) => ({ value: String(c.id), label: c.name })) || []),
  ];
  const statusOptions = [
    { value: "all", label: "All Statuses" },
    ...AGREEMENT_STATUSES.map(s => ({ value: s, label: s.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()) })),
  ];
  const modeOptions = [
    { value: "all", label: "All Types" },
    ...COMMISSION_MODES.map(m => ({ value: m, label: commissionModeLabels[m] })),
  ];
  const bonusTypeOptions = [
    { value: "all", label: "All Types" },
    ...BONUS_TYPES.map(t => ({ value: t, label: bonusTypeLabels[t] })),
  ];

  function formatCommissionValue(rule: any) {
    if (rule.commissionMode === "percentage") {
      return `${parseFloat(rule.percentageValue || 0)}%`;
    }
    return `${rule.currency || "AUD"} ${parseFloat(rule.flatAmount || 0).toLocaleString()}`;
  }

  function formatBonusDetails(rule: any) {
    if (rule.tiers && rule.tiers.length > 0) {
      return rule.tiers.map((t: any) => {
        const max = t.maxStudents ? t.maxStudents : "∞";
        const amt = parseFloat(t.bonusAmount).toLocaleString();
        const type = t.calculationType === "per_student" ? "/student" : " flat";
        return `${t.minStudents}–${max}: ${rule.currency} ${amt}${type}`;
      }).join(" | ");
    }
    if (rule.countryEntries && rule.countryEntries.length > 0) {
      return rule.countryEntries.map((e: any) => {
        const amt = parseFloat(e.bonusAmount).toLocaleString();
        return `${e.countryName}: ${e.studentCount} students = ${rule.currency} ${amt}`;
      }).join(" | ");
    }
    return "—";
  }

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-commission-title">Commission & Bonus</h1>
        <p className="text-sm text-muted-foreground mt-1">Master view of all commission rules and bonus structures across agreements</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList data-testid="tabs-commission-bonus">
          <TabsTrigger value="commission" data-testid="tab-commission">
            <DollarSign className="w-4 h-4 mr-1.5" />
            Commission ({commissionRules?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="bonus" data-testid="tab-bonus">
            <Award className="w-4 h-4 mr-1.5" />
            Bonus ({bonusRules?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="commission" className="space-y-4 mt-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by provider, agreement, label..."
                    value={commSearch}
                    onChange={(e) => setCommSearch(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-commission"
                  />
                </div>
                <SearchableSelect
                  value={commProvider}
                  onValueChange={setCommProvider}
                  options={providerOptions}
                  placeholder="Provider"
                  searchPlaceholder="Search providers..."
                  className="w-[180px]"
                  data-testid="select-comm-provider"
                />
                <SearchableSelect
                  value={commProviderCountry}
                  onValueChange={setCommProviderCountry}
                  options={countryOptions}
                  placeholder="Provider Country"
                  searchPlaceholder="Search countries..."
                  className="w-[170px]"
                  data-testid="select-comm-country"
                />
                <SearchableSelect
                  value={commStatus}
                  onValueChange={setCommStatus}
                  options={statusOptions}
                  placeholder="Agreement Status"
                  searchPlaceholder="Search statuses..."
                  className="w-[160px]"
                  data-testid="select-comm-status"
                />
                <SearchableSelect
                  value={commMode}
                  onValueChange={setCommMode}
                  options={modeOptions}
                  placeholder="Commission Type"
                  searchPlaceholder="Search types..."
                  className="w-[160px]"
                  data-testid="select-comm-mode"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={resetCommFilters}
                  disabled={!commFiltersActive}
                  data-testid="button-reset-commission-filters"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {commLoading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : commissionRules && commissionRules.length > 0 ? (
            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Provider</TableHead>
                      <TableHead>Agreement</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Territory</TableHead>
                      <TableHead>Study Level</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Basis</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead className="w-[60px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commissionRules.map((rule: any) => (
                      <TableRow key={rule.id} data-testid={`row-commission-${rule.id}`}>
                        <TableCell>
                          <div className="text-sm font-medium">{rule.providerName}</div>
                          {rule.providerCountryName && (
                            <div className="text-xs text-muted-foreground">{rule.providerCountryName}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <button
                            className="text-left hover:underline text-primary text-sm"
                            onClick={() => navigate(`/agreements/${rule.agreementId}`)}
                            data-testid={`link-agreement-${rule.agreementId}`}
                          >
                            <div className="font-medium">{rule.agreementCode}</div>
                            <div className="text-xs text-muted-foreground truncate max-w-[180px]">{rule.agreementTitle}</div>
                          </button>
                        </TableCell>
                        <TableCell>{statusBadge(rule.agreementStatus)}</TableCell>
                        <TableCell>
                          <div className="text-xs max-w-[120px]">
                            {rule.territoryCountries?.length > 0
                              ? rule.territoryCountries.length > 2
                                ? <Tooltip>
                                    <TooltipTrigger className="underline decoration-dotted cursor-help">
                                      {rule.territoryCountries.slice(0, 2).join(", ")} +{rule.territoryCountries.length - 2}
                                    </TooltipTrigger>
                                    <TooltipContent>{rule.territoryCountries.join(", ")}</TooltipContent>
                                  </Tooltip>
                                : rule.territoryCountries.join(", ")
                              : "—"
                            }
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{rule.studyLevel || "Any"}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{commissionModeLabels[rule.commissionMode] || rule.commissionMode}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium">{formatCommissionValue(rule)}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs">{basisLabels[rule.basis] || rule.basis}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={rule.isActive ? "default" : "secondary"} className="text-xs">
                            {rule.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/agreements/${rule.agreementId}`)}
                            data-testid={`button-view-agreement-${rule.agreementId}`}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-16 text-center">
                <DollarSign className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                <h3 className="text-lg font-medium">No commission rules found</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {commFiltersActive ? (
                    <>Try adjusting your filters or <button className="text-primary underline" onClick={resetCommFilters} data-testid="link-reset-commission-filters">reset filters</button></>
                  ) : "Commission rules added to agreements will appear here"}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="bonus" className="space-y-4 mt-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by provider, agreement..."
                    value={bonusSearch}
                    onChange={(e) => setBonusSearch(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-bonus"
                  />
                </div>
                <SearchableSelect
                  value={bonusProvider}
                  onValueChange={setBonusProvider}
                  options={providerOptions}
                  placeholder="Provider"
                  searchPlaceholder="Search providers..."
                  className="w-[180px]"
                  data-testid="select-bonus-provider"
                />
                <SearchableSelect
                  value={bonusProviderCountry}
                  onValueChange={setBonusProviderCountry}
                  options={countryOptions}
                  placeholder="Provider Country"
                  searchPlaceholder="Search countries..."
                  className="w-[170px]"
                  data-testid="select-bonus-country"
                />
                <SearchableSelect
                  value={bonusStatus}
                  onValueChange={setBonusStatus}
                  options={statusOptions}
                  placeholder="Agreement Status"
                  searchPlaceholder="Search statuses..."
                  className="w-[160px]"
                  data-testid="select-bonus-status"
                />
                <SearchableSelect
                  value={bonusType}
                  onValueChange={setBonusType}
                  options={bonusTypeOptions}
                  placeholder="Bonus Type"
                  searchPlaceholder="Search types..."
                  className="w-[160px]"
                  data-testid="select-bonus-type"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={resetBonusFilters}
                  disabled={!bonusFiltersActive}
                  data-testid="button-reset-bonus-filters"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {bonusLoading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : bonusRules && bonusRules.length > 0 ? (
            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Provider</TableHead>
                      <TableHead>Agreement</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Bonus Type</TableHead>
                      <TableHead>Currency</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead className="w-[60px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bonusRules.map((rule: any) => (
                      <TableRow key={rule.id} data-testid={`row-bonus-${rule.id}`}>
                        <TableCell>
                          <div className="text-sm font-medium">{rule.providerName}</div>
                          {rule.providerCountryName && (
                            <div className="text-xs text-muted-foreground">{rule.providerCountryName}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <button
                            className="text-left hover:underline text-primary text-sm"
                            onClick={() => navigate(`/agreements/${rule.agreementId}`)}
                            data-testid={`link-bonus-agreement-${rule.agreementId}`}
                          >
                            <div className="font-medium">{rule.agreementCode}</div>
                            <div className="text-xs text-muted-foreground truncate max-w-[180px]">{rule.agreementTitle}</div>
                          </button>
                        </TableCell>
                        <TableCell>{statusBadge(rule.agreementStatus)}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <span className="capitalize">{rule.targetType}</span>
                            <span className="text-muted-foreground"> · </span>
                            <span className="text-xs text-muted-foreground">{rule.metric?.replace(/_/g, " ")}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">{rule.periodKey}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{bonusTypeLabels[rule.bonusType] || rule.bonusType}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{rule.currency}</span>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs max-w-[280px]">
                            {formatBonusDetails(rule).length > 80 ? (
                              <Tooltip>
                                <TooltipTrigger className="text-left underline decoration-dotted cursor-help truncate block max-w-[280px]">
                                  {formatBonusDetails(rule).slice(0, 80)}...
                                </TooltipTrigger>
                                <TooltipContent className="max-w-sm whitespace-pre-wrap">{formatBonusDetails(rule)}</TooltipContent>
                              </Tooltip>
                            ) : (
                              formatBonusDetails(rule)
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/agreements/${rule.agreementId}`)}
                            data-testid={`button-view-bonus-agreement-${rule.agreementId}`}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-16 text-center">
                <Award className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                <h3 className="text-lg font-medium">No bonus rules found</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {bonusFiltersActive ? (
                    <>Try adjusting your filters or <button className="text-primary underline" onClick={resetBonusFilters} data-testid="link-reset-bonus-filters">reset filters</button></>
                  ) : "Bonus rules added to agreement targets will appear here"}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
