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
  const searchString = useSearch();
  const canViewCommission = hasPermission("commission.view");
  const canViewBonus = hasPermission("bonus.view");
  const urlTab = new URLSearchParams(searchString).get("tab") || "";
  const [activeTab, setActiveTabState] = useState(
    urlTab === "commission" || urlTab === "bonus" ? urlTab : (canViewCommission ? "commission" : "bonus")
  );
  useEffect(() => { if (urlTab === "commission" || urlTab === "bonus") setActiveTabState(urlTab); }, [urlTab]);
  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    navigate(`/commission?tab=${tab}`, { replace: true });
  };

  const [commSearch, setCommSearch] = useState("");
  const [commProviders, setCommProviders] = useState<string[]>([]);
  const [commProviderCountries, setCommProviderCountries] = useState<string[]>([]);
  const [commStatuses, setCommStatuses] = useState<string[]>([]);
  const [commModes, setCommModes] = useState<string[]>([]);

  const [bonusSearch, setBonusSearch] = useState("");
  const [bonusProviders, setBonusProviders] = useState<string[]>([]);
  const [bonusProviderCountries, setBonusProviderCountries] = useState<string[]>([]);
  const [bonusStatuses, setBonusStatuses] = useState<string[]>([]);
  const [bonusTypes, setBonusTypes] = useState<string[]>([]);

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
  if (commProviders.length > 0) commParams.set("providerId", commProviders.join(","));
  if (commProviderCountries.length > 0) commParams.set("providerCountryId", commProviderCountries.join(","));
  if (commStatuses.length > 0) commParams.set("agreementStatus", commStatuses.join(","));
  if (commModes.length > 0) commParams.set("commissionMode", commModes.join(","));

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
  if (bonusProviders.length > 0) bonusParams.set("providerId", bonusProviders.join(","));
  if (bonusProviderCountries.length > 0) bonusParams.set("providerCountryId", bonusProviderCountries.join(","));
  if (bonusStatuses.length > 0) bonusParams.set("agreementStatus", bonusStatuses.join(","));
  if (bonusTypes.length > 0) bonusParams.set("bonusType", bonusTypes.join(","));

  const { data: bonusRules, isLoading: bonusLoading } = useQuery<any[]>({
    queryKey: ["/api/bonus-rules", bonusParams.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/bonus-rules?${bonusParams.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: hasPermission("bonus.view"),
  });

  const commFiltersActive = commSearch !== "" || commProviders.length > 0 || commProviderCountries.length > 0 || commStatuses.length > 0 || commModes.length > 0;
  const bonusFiltersActive = bonusSearch !== "" || bonusProviders.length > 0 || bonusProviderCountries.length > 0 || bonusStatuses.length > 0 || bonusTypes.length > 0;

  const resetCommFilters = () => {
    setCommSearch("");
    setCommProviders([]);
    setCommProviderCountries([]);
    setCommStatuses([]);
    setCommModes([]);
  };

  const resetBonusFilters = () => {
    setBonusSearch("");
    setBonusProviders([]);
    setBonusProviderCountries([]);
    setBonusStatuses([]);
    setBonusTypes([]);
  };

  const providerOptions = providers?.map((p: any) => ({ value: String(p.id), label: `${p.name}${p.countryName ? ` (${p.countryName})` : ""}` })) || [];
  const countryOptions = countries?.map((c: any) => ({ value: String(c.id), label: c.name })) || [];
  const statusOptions = AGREEMENT_STATUSES.map(s => ({ value: s, label: s.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()) }));
  const modeOptions = COMMISSION_MODES.map(m => ({ value: m, label: commissionModeLabels[m] }));
  const bonusTypeOptions = BONUS_TYPES.map(t => ({ value: t, label: bonusTypeLabels[t] }));

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
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-commission-title">Commission & Bonus</h1>
        <p className="text-sm text-muted-foreground mt-1">Master view of all commission rules and bonus structures across agreements</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList data-testid="tabs-commission-bonus">
          {canViewCommission && (
            <TabsTrigger value="commission" data-testid="tab-commission">
              <DollarSign className="w-4 h-4 mr-1.5" />
              Commission ({commissionRules?.length || 0})
            </TabsTrigger>
          )}
          {canViewBonus && (
            <TabsTrigger value="bonus" data-testid="tab-bonus">
              <Award className="w-4 h-4 mr-1.5" />
              Bonus ({bonusRules?.length || 0})
            </TabsTrigger>
          )}
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
                <MultiSearchableSelect
                  values={commProviders}
                  onValuesChange={setCommProviders}
                  options={providerOptions}
                  placeholder="Provider"
                  searchPlaceholder="Search providers..."
                  className="w-[180px]"
                  data-testid="select-comm-provider"
                />
                <MultiSearchableSelect
                  values={commProviderCountries}
                  onValuesChange={setCommProviderCountries}
                  options={countryOptions}
                  placeholder="Provider Country"
                  searchPlaceholder="Search countries..."
                  className="w-[170px]"
                  data-testid="select-comm-country"
                />
                <MultiSearchableSelect
                  values={commStatuses}
                  onValuesChange={setCommStatuses}
                  options={statusOptions}
                  placeholder="Agreement Status"
                  searchPlaceholder="Search statuses..."
                  className="w-[160px]"
                  data-testid="select-comm-status"
                />
                <MultiSearchableSelect
                  values={commModes}
                  onValuesChange={setCommModes}
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
                <Table className="table-fixed w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[14%]">Provider</TableHead>
                      <TableHead className="w-[16%]">Agreement</TableHead>
                      <TableHead className="w-[10%]">Territory</TableHead>
                      <TableHead className="w-[14%]">Label</TableHead>
                      <TableHead className="w-[8%]">Level</TableHead>
                      <TableHead className="w-[9%]">Type</TableHead>
                      <TableHead className="w-[9%]">Value</TableHead>
                      <TableHead className="w-[9%]">Basis</TableHead>
                      <TableHead className="w-[7%]">Active</TableHead>
                      <TableHead className="w-[4%]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      const grouped: { key: string; rules: any[] }[] = [];
                      commissionRules.forEach((rule: any) => {
                        const groupKey = `${rule.providerName}-${rule.agreementId}`;
                        const last = grouped[grouped.length - 1];
                        if (last && last.key === groupKey) {
                          last.rules.push(rule);
                        } else {
                          grouped.push({ key: groupKey, rules: [rule] });
                        }
                      });

                      return grouped.map((group) => {
                        const firstRule = group.rules[0];
                        const rowCount = group.rules.length;
                        return group.rules.map((rule: any, idx: number) => (
                          <TableRow
                            key={rule.id}
                            data-testid={`row-commission-${rule.id}`}
                            className={idx === 0 && rowCount > 1 ? "border-t-2 border-border" : ""}
                          >
                            {idx === 0 && (
                              <>
                                <TableCell rowSpan={rowCount} className="align-top border-r border-border/50">
                                  <div className="text-sm font-medium truncate">{firstRule.providerName}</div>
                                  {firstRule.providerCountryName && (
                                    <div className="text-xs text-muted-foreground truncate">{firstRule.providerCountryName}</div>
                                  )}
                                </TableCell>
                                <TableCell rowSpan={rowCount} className="align-top border-r border-border/50">
                                  <button
                                    className="text-left hover:underline text-primary text-sm w-full"
                                    onClick={() => navigate(`/agreements/${firstRule.agreementId}`)}
                                    data-testid={`link-agreement-${firstRule.agreementId}`}
                                  >
                                    <div className="font-medium truncate">{firstRule.agreementCode}</div>
                                    <div className="text-xs text-muted-foreground truncate">{firstRule.agreementTitle}</div>
                                  </button>
                                </TableCell>
                                <TableCell rowSpan={rowCount} className="align-top border-r border-border/50">
                                  <div className="text-xs truncate">
                                    {firstRule.territoryCountries?.length > 0
                                      ? firstRule.territoryCountries.length > 2
                                        ? <Tooltip>
                                            <TooltipTrigger className="underline decoration-dotted cursor-help">
                                              {firstRule.territoryCountries.slice(0, 2).join(", ")} +{firstRule.territoryCountries.length - 2}
                                            </TooltipTrigger>
                                            <TooltipContent>{firstRule.territoryCountries.join(", ")}</TooltipContent>
                                          </Tooltip>
                                        : firstRule.territoryCountries.join(", ")
                                      : "—"
                                    }
                                  </div>
                                </TableCell>
                              </>
                            )}
                            <TableCell>
                              <span className="text-sm truncate block">{rule.label || "—"}</span>
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
                              {idx === 0 && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => navigate(`/agreements/${rule.agreementId}`)}
                                  data-testid={`button-view-agreement-${rule.agreementId}`}
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ));
                      });
                    })()}
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
                <MultiSearchableSelect
                  values={bonusProviders}
                  onValuesChange={setBonusProviders}
                  options={providerOptions}
                  placeholder="Provider"
                  searchPlaceholder="Search providers..."
                  className="w-[180px]"
                  data-testid="select-bonus-provider"
                />
                <MultiSearchableSelect
                  values={bonusProviderCountries}
                  onValuesChange={setBonusProviderCountries}
                  options={countryOptions}
                  placeholder="Provider Country"
                  searchPlaceholder="Search countries..."
                  className="w-[170px]"
                  data-testid="select-bonus-country"
                />
                <MultiSearchableSelect
                  values={bonusStatuses}
                  onValuesChange={setBonusStatuses}
                  options={statusOptions}
                  placeholder="Agreement Status"
                  searchPlaceholder="Search statuses..."
                  className="w-[160px]"
                  data-testid="select-bonus-status"
                />
                <MultiSearchableSelect
                  values={bonusTypes}
                  onValuesChange={setBonusTypes}
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
                <Table className="table-fixed w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[15%]">Provider</TableHead>
                      <TableHead className="w-[18%]">Agreement</TableHead>
                      <TableHead className="w-[10%]">Status</TableHead>
                      <TableHead className="w-[15%]">Target</TableHead>
                      <TableHead className="w-[10%]">Bonus Type</TableHead>
                      <TableHead className="w-[7%]">Currency</TableHead>
                      <TableHead className="w-[21%]">Details</TableHead>
                      <TableHead className="w-[4%]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      const grouped: { key: string; rules: any[] }[] = [];
                      bonusRules.forEach((rule: any) => {
                        const groupKey = `${rule.providerName}-${rule.agreementId}`;
                        const last = grouped[grouped.length - 1];
                        if (last && last.key === groupKey) {
                          last.rules.push(rule);
                        } else {
                          grouped.push({ key: groupKey, rules: [rule] });
                        }
                      });

                      return grouped.map((group) => {
                        const firstRule = group.rules[0];
                        const rowCount = group.rules.length;
                        return group.rules.map((rule: any, idx: number) => (
                      <TableRow
                        key={rule.id}
                        data-testid={`row-bonus-${rule.id}`}
                        className={idx === 0 && rowCount > 1 ? "border-t-2 border-border" : ""}
                      >
                        {idx === 0 && (
                          <>
                            <TableCell rowSpan={rowCount} className="align-top border-r border-border/50">
                              <div className="text-sm font-medium truncate">{firstRule.providerName}</div>
                              {firstRule.providerCountryName && (
                                <div className="text-xs text-muted-foreground truncate">{firstRule.providerCountryName}</div>
                              )}
                            </TableCell>
                            <TableCell rowSpan={rowCount} className="align-top border-r border-border/50">
                              <button
                                className="text-left hover:underline text-primary text-sm w-full"
                                onClick={() => navigate(`/agreements/${firstRule.agreementId}`)}
                                data-testid={`link-bonus-agreement-${firstRule.agreementId}`}
                              >
                                <div className="font-medium truncate">{firstRule.agreementCode}</div>
                                <div className="text-xs text-muted-foreground truncate">{firstRule.agreementTitle}</div>
                              </button>
                            </TableCell>
                            <TableCell rowSpan={rowCount} className="align-top border-r border-border/50">
                              {statusBadge(firstRule.agreementStatus)}
                            </TableCell>
                          </>
                        )}
                        <TableCell>
                          <div className="text-sm truncate">
                            <span className="capitalize">{rule.targetType}</span>
                            <span className="text-muted-foreground"> · </span>
                            <span className="text-xs text-muted-foreground">{rule.metric?.replace(/_/g, " ")}</span>
                          </div>
                          <div className="text-xs text-muted-foreground truncate">{rule.periodKey}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{bonusTypeLabels[rule.bonusType] || rule.bonusType}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{rule.currency}</span>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs">
                            {formatBonusDetails(rule).length > 60 ? (
                              <Tooltip>
                                <TooltipTrigger className="text-left underline decoration-dotted cursor-help truncate block">
                                  {formatBonusDetails(rule).slice(0, 60)}...
                                </TooltipTrigger>
                                <TooltipContent className="max-w-sm whitespace-pre-wrap">{formatBonusDetails(rule)}</TooltipContent>
                              </Tooltip>
                            ) : (
                              <span className="truncate block">{formatBonusDetails(rule)}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {idx === 0 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => navigate(`/agreements/${rule.agreementId}`)}
                              data-testid={`button-view-bonus-agreement-${rule.agreementId}`}
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                        ));
                      });
                    })()}
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