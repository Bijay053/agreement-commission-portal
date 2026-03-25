import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Search, Plus, Settings, Copy, Pencil, Trash2, Percent, X, ChevronDown, Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2, RotateCcw, History, ArrowRight,
} from "lucide-react";
import { useDropdownOptions } from "@/hooks/use-dropdown-options";

const DEGREE_LEVELS = [
  { value: "any", label: "Any" },
  { value: "undergraduate", label: "Undergraduate" },
  { value: "postgraduate", label: "Postgraduate" },
  { value: "vet", label: "VET" },
  { value: "foundation", label: "Foundation" },
  { value: "diploma", label: "Diploma" },
  { value: "phd", label: "PhD" },
  { value: "english", label: "English Language" },
];

const COMMISSION_BASIS = [
  { value: "1_year", label: "1 Year" },
  { value: "2_semesters", label: "2 Semesters" },
  { value: "full_course", label: "Full Course" },
  { value: "per_semester", label: "Per Semester" },
  { value: "per_year", label: "Per Year" },
  { value: "per_trimester", label: "Per Trimester" },
  { value: "one_time", label: "One Time" },
];

const TERRITORY_OPTIONS = [
  "Global",
  "South Asia",
  "Afghanistan",
  "Albania",
  "Algeria",
  "Argentina",
  "Armenia",
  "Australia",
  "Austria",
  "Azerbaijan",
  "Bahrain",
  "Bangladesh",
  "Belgium",
  "Bhutan",
  "Bolivia",
  "Bosnia and Herzegovina",
  "Brazil",
  "Brunei",
  "Bulgaria",
  "Cambodia",
  "Cameroon",
  "Canada",
  "Chile",
  "China",
  "Colombia",
  "Costa Rica",
  "Croatia",
  "Cyprus",
  "Czech Republic",
  "Denmark",
  "Dominican Republic",
  "Ecuador",
  "Egypt",
  "El Salvador",
  "Estonia",
  "Ethiopia",
  "Fiji",
  "Finland",
  "France",
  "Georgia",
  "Germany",
  "Ghana",
  "Greece",
  "Guatemala",
  "Honduras",
  "Hong Kong",
  "Hungary",
  "Iceland",
  "India",
  "Indonesia",
  "Iran",
  "Iraq",
  "Ireland",
  "Israel",
  "Italy",
  "Jamaica",
  "Japan",
  "Jordan",
  "Kazakhstan",
  "Kenya",
  "Kuwait",
  "Kyrgyzstan",
  "Laos",
  "Latvia",
  "Lebanon",
  "Libya",
  "Lithuania",
  "Luxembourg",
  "Macau",
  "Malaysia",
  "Maldives",
  "Malta",
  "Mauritius",
  "Mexico",
  "Moldova",
  "Mongolia",
  "Montenegro",
  "Morocco",
  "Myanmar",
  "Nepal",
  "Netherlands",
  "New Zealand",
  "Nicaragua",
  "Nigeria",
  "North Macedonia",
  "Norway",
  "Oman",
  "Pakistan",
  "Palestine",
  "Panama",
  "Papua New Guinea",
  "Paraguay",
  "Peru",
  "Philippines",
  "Poland",
  "Portugal",
  "Qatar",
  "Romania",
  "Russia",
  "Rwanda",
  "Saudi Arabia",
  "Serbia",
  "Singapore",
  "Slovakia",
  "Slovenia",
  "Somalia",
  "South Africa",
  "South Korea",
  "Spain",
  "Sri Lanka",
  "Sudan",
  "Sweden",
  "Switzerland",
  "Syria",
  "Taiwan",
  "Tajikistan",
  "Tanzania",
  "Thailand",
  "Tonga",
  "Trinidad and Tobago",
  "Tunisia",
  "Turkey",
  "Turkmenistan",
  "Uganda",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Uruguay",
  "Uzbekistan",
  "Vanuatu",
  "Venezuela",
  "Vietnam",
  "Yemen",
  "Zambia",
  "Zimbabwe",
];

interface CommissionEntry {
  id: number;
  providerName: string;
  degreeLevel: string;
  territory: string;
  commissionValue: string;
  commissionType: string;
  currency: string;
  commissionBasis: string;
  notes: string;
  isActive: boolean;
  copiedFromRuleId: number | null;
  subAgentCommission: string | null;
  subAgentPercentage: string | null;
  effectiveSubAgentPercentage: string | null;
  ruleLabel: string | null;
  followupStudyLevel: string | null;
  followupYearRates: { year: string; mode: string; value: string; currency: string }[] | null;
  followupConditionsText: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CopyRule {
  ruleId: number;
  label: string;
  providerName: string;
  studyLevel: string;
  commissionMode: string;
  percentageValue: string | null;
  flatAmount: string | null;
  currency: string;
  basis: string;
  agreementCode: string;
  agreementTitle: string;
  alreadyCopied: boolean;
}

const degreeLabelMap: Record<string, string> = Object.fromEntries(DEGREE_LEVELS.map(d => [d.value, d.label]));
const basisLabelMap: Record<string, string> = Object.fromEntries(COMMISSION_BASIS.map(b => [b.value, b.label]));

function MultiTerritorySelect({
  value,
  onChange,
  testIdPrefix = "",
}: {
  value: string[];
  onChange: (v: string[]) => void;
  testIdPrefix?: string;
}) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const filtered = TERRITORY_OPTIONS.filter(t =>
    t.toLowerCase().includes(searchTerm.toLowerCase())
  );

  function toggle(territory: string) {
    if (value.includes(territory)) {
      onChange(value.filter(v => v !== territory));
    } else {
      onChange([...value, territory]);
    }
  }

  function remove(territory: string) {
    onChange(value.filter(v => v !== territory));
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className="flex flex-wrap items-center gap-1 min-h-[38px] w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm cursor-pointer"
        onClick={() => setOpen(!open)}
        data-testid={`${testIdPrefix}territory-select`}
      >
        {value.length === 0 && (
          <span className="text-muted-foreground">Select territories...</span>
        )}
        {value.map(t => (
          <Badge key={t} variant="secondary" className="text-xs gap-1">
            {t}
            <X
              className="w-3 h-3 cursor-pointer"
              onClick={(e) => { e.stopPropagation(); remove(t); }}
            />
          </Badge>
        ))}
        <ChevronDown className="w-4 h-4 ml-auto text-muted-foreground shrink-0" />
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-md shadow-md max-h-[250px] overflow-hidden">
          <div className="p-2 border-b">
            <Input
              placeholder="Search countries..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="h-8"
              autoFocus
              data-testid={`${testIdPrefix}territory-search`}
            />
          </div>
          <div className="overflow-y-auto max-h-[200px]">
            {filtered.map(t => (
              <div
                key={t}
                className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-accent text-sm ${
                  (t === "Global" || t === "South Asia") ? "font-semibold bg-muted/50" : ""
                }`}
                onClick={() => toggle(t)}
                data-testid={`${testIdPrefix}territory-option-${t.toLowerCase().replace(/\s/g, "-")}`}
              >
                <Checkbox checked={value.includes(t)} className="pointer-events-none" />
                <span>{t}</span>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">No matches</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProviderCommissionPage() {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const canView = hasPermission("provider_commission.view");
  const canAdd = hasPermission("provider_commission.add");
  const canEdit = hasPermission("provider_commission.edit");
  const canDelete = hasPermission("provider_commission.delete");
  const canManage = hasPermission("provider_commission.manage");

  const [search, setSearch] = useState("");
  const [filterDegree, setFilterDegree] = useState("all");
  const [filterBasis, setFilterBasis] = useState("all");
  const [showInactive, setShowInactive] = useState(false);

  const { data: dropdownOpts = {} } = useDropdownOptions();
  const studyLevelOptions = [
    { value: "any", label: "Any" },
    ...(dropdownOpts.study_level || []).map((o: any) => ({ value: o.value, label: o.label })),
  ];

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<CommissionEntry | null>(null);

  const [formProvider, setFormProvider] = useState("");
  const [formDegree, setFormDegree] = useState("any");
  const [formTerritories, setFormTerritories] = useState<string[]>([]);
  const [formValue, setFormValue] = useState("");
  const [formType, setFormType] = useState("percentage");
  const [formCurrency, setFormCurrency] = useState("AUD");
  const [formBasis, setFormBasis] = useState("full_course");
  const [formNotes, setFormNotes] = useState("");

  const [configPct, setConfigPct] = useState("");
  const [selectedRules, setSelectedRules] = useState<number[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkResult, setBulkResult] = useState<{ created: number; errors: string[]; totalRows: number } | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [editingProviderPct, setEditingProviderPct] = useState<string | null>(null);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [providerPctValue, setProviderPctValue] = useState("");

  const { data: entries = [], isLoading } = useQuery<CommissionEntry[]>({
    queryKey: ["/api/provider-commission", showInactive ? "all" : "active"],
    queryFn: async () => {
      const res = await fetch(`/api/provider-commission?activeOnly=${showInactive ? "false" : "true"}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    enabled: canView,
  });

  const { data: config } = useQuery<{ subAgentPercentage: string }>({
    queryKey: ["/api/provider-commission/config"],
    queryFn: async () => {
      const res = await fetch("/api/provider-commission/config", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: copyRules = [], isLoading: copyLoading } = useQuery<CopyRule[]>({
    queryKey: ["/api/provider-commission/copy-rules"],
    queryFn: async () => {
      const res = await fetch("/api/provider-commission/copy-rules", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: copyOpen,
  });

  const addMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/provider-commission", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to add");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider-commission"] });
      toast({ title: "Entry added" });
      setAddOpen(false);
      resetForm();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await fetch(`/api/provider-commission/${id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to update");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider-commission"] });
      toast({ title: "Entry updated" });
      setEditOpen(false);
      setEditEntry(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/provider-commission/${id}`, {
        method: "DELETE", credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider-commission"] });
      toast({ title: "Entry deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const configMutation = useMutation({
    mutationFn: async (pct: string) => {
      const res = await fetch("/api/provider-commission/config", {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subAgentPercentage: pct }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider-commission"] });
      queryClient.invalidateQueries({ queryKey: ["/api/provider-commission/config"] });
      toast({ title: "Sub-agent percentage updated" });
      setConfigOpen(false);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const copyMutation = useMutation({
    mutationFn: async (ruleIds: number[]) => {
      const res = await fetch("/api/provider-commission/copy-rules", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruleIds }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to copy");
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider-commission"] });
      queryClient.invalidateQueries({ queryKey: ["/api/provider-commission/copy-rules"] });
      toast({ title: `Copied ${data.created} entries (${data.skipped} skipped)` });
      setCopyOpen(false);
      setSelectedRules([]);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const providerPctMutation = useMutation({
    mutationFn: async ({ providerName, subAgentPercentage }: { providerName: string; subAgentPercentage: string | null }) => {
      const res = await fetch("/api/provider-commission/provider-percentage", {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerName, subAgentPercentage }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to update");
      }
      return res.json();
    },
    onSuccess: async (data: any) => {
      await queryClient.refetchQueries({ queryKey: ["/api/provider-commission", showInactive ? "all" : "active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/provider-commission/audit-log"] });
      toast({ title: `Updated sub-agent % for ${data.providerName}` });
      setEditingProviderPct(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const { data: auditLogs = [] } = useQuery<any[]>({
    queryKey: ["/api/provider-commission/audit-log"],
    queryFn: async () => {
      const res = await fetch("/api/provider-commission/audit-log", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: showAuditLog,
  });

  async function handleBulkUpload() {
    if (!bulkFile) return;
    setBulkUploading(true);
    setBulkResult(null);
    try {
      const formData = new FormData();
      formData.append("file", bulkFile);
      const res = await fetch("/api/provider-commission/bulk-upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Upload failed");
      setBulkResult(data);
      if (data.created > 0) {
        queryClient.invalidateQueries({ queryKey: ["/api/provider-commission"] });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setBulkUploading(false);
    }
  }

  function handleDownloadSample() {
    window.open("/api/provider-commission/sample", "_blank");
  }

  function resetForm() {
    setFormProvider("");
    setFormDegree("any");
    setFormTerritories([]);
    setFormValue("");
    setFormType("percentage");
    setFormCurrency("AUD");
    setFormBasis("full_course");
    setFormNotes("");
  }

  function openEdit(e: CommissionEntry) {
    setEditEntry(e);
    setFormProvider(e.providerName);
    setFormDegree(e.degreeLevel);
    setFormTerritories(e.territory ? e.territory.split(",").map(t => t.trim()).filter(Boolean) : []);
    setFormValue(e.commissionValue);
    setFormType(e.commissionType);
    setFormCurrency(e.currency);
    setFormBasis(e.commissionBasis);
    setFormNotes(e.notes);
    setEditOpen(true);
  }

  function formatTerritoryDisplay(territory: string) {
    if (!territory) return null;
    const parts = territory.split(",").map(t => t.trim()).filter(Boolean);
    if (parts.length === 0) return null;
    if (parts.length <= 2) return parts.join(", ");
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help">{parts[0]}, {parts[1]} +{parts.length - 2}</span>
        </TooltipTrigger>
        <TooltipContent className="max-w-[300px]">{parts.join(", ")}</TooltipContent>
      </Tooltip>
    );
  }

  const filtered = entries.filter(e => {
    if (search) {
      const s = search.toLowerCase();
      if (!e.providerName.toLowerCase().includes(s) && !e.territory.toLowerCase().includes(s)) return false;
    }
    if (filterDegree !== "all" && e.degreeLevel !== filterDegree) return false;
    if (filterBasis !== "all" && e.commissionBasis !== filterBasis) return false;
    return true;
  });

  const subPct = config?.subAgentPercentage || "70.00";

  if (!canView) {
    return (
      <div className="p-8 text-center text-muted-foreground" data-testid="no-access">
        You don't have permission to view this page.
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4" data-testid="provider-commission-page">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" data-testid="page-title">Sub Agent Commission Distribution</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage provider commission rates and auto-calculate sub-agent commission
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAuditLog(true)}
            data-testid="btn-audit-log"
          >
            <History className="w-4 h-4 mr-1" />
            Audit Log
          </Button>
          {canManage && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setConfigPct(subPct); setConfigOpen(true); }}
              data-testid="btn-config"
            >
              <Settings className="w-4 h-4 mr-1" />
              Sub-Agent: {subPct}%
            </Button>
          )}
          {canAdd && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCopyOpen(true)}
              data-testid="btn-copy"
            >
              <Copy className="w-4 h-4 mr-1" />
              Copy from Agreements
            </Button>
          )}
          {canAdd && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setBulkFile(null); setBulkResult(null); setBulkOpen(true); }}
              data-testid="btn-bulk-upload"
            >
              <Upload className="w-4 h-4 mr-1" />
              Bulk Upload
            </Button>
          )}
          {canAdd && (
            <Button
              size="sm"
              onClick={() => { resetForm(); setAddOpen(true); }}
              data-testid="btn-add"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Entry
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search provider or territory..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search"
              />
            </div>
            <Select value={filterDegree} onValueChange={setFilterDegree}>
              <SelectTrigger className="w-[160px]" data-testid="filter-degree">
                <SelectValue placeholder="Study Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                {studyLevelOptions.map(d => (
                  <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterBasis} onValueChange={setFilterBasis}>
              <SelectTrigger className="w-[160px]" data-testid="filter-basis">
                <SelectValue placeholder="Basis" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Basis</SelectItem>
                {COMMISSION_BASIS.map(b => (
                  <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Checkbox
                id="showInactive"
                checked={showInactive}
                onCheckedChange={v => setShowInactive(!!v)}
                data-testid="checkbox-inactive"
              />
              <Label htmlFor="showInactive" className="text-sm whitespace-nowrap">Show Inactive</Label>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                setSearch("");
                setFilterDegree("all");
                setFilterBasis("all");
                setShowInactive(false);
              }}
              disabled={search === "" && filterDegree === "all" && filterBasis === "all" && !showInactive}
              data-testid="btn-reset-filters"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="empty-state">
              No commission entries found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Study Level</TableHead>
                    <TableHead>Territory</TableHead>
                    <TableHead className="text-right">Commission</TableHead>
                    <TableHead>Basis</TableHead>
                    <TableHead>Follow-up</TableHead>
                    <TableHead className="text-right">Sub-Agent %</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    const grouped: { key: string; entries: CommissionEntry[] }[] = [];
                    filtered.forEach((entry) => {
                      const last = grouped[grouped.length - 1];
                      if (last && last.key === entry.providerName) {
                        last.entries.push(entry);
                      } else {
                        grouped.push({ key: entry.providerName, entries: [entry] });
                      }
                    });

                    return grouped.map((group) => {
                      const firstEntry = group.entries[0];
                      const rowCount = group.entries.length;
                      return group.entries.map((entry, idx) => (
                        <TableRow
                          key={entry.id}
                          data-testid={`row-entry-${entry.id}`}
                          className={idx === 0 && rowCount > 1 ? "border-t-2 border-border" : ""}
                        >
                          {idx === 0 && (
                            <TableCell rowSpan={rowCount} className="font-medium align-top border-r border-border/50" data-testid={`text-provider-${firstEntry.id}`}>
                              <div className="text-sm font-medium">{firstEntry.providerName}</div>
                              {editingProviderPct === firstEntry.providerName ? (
                                <div className="mt-1.5 space-y-1">
                                  <div className="flex items-center gap-1">
                                    <Percent className="w-3 h-3 text-muted-foreground shrink-0" />
                                    <Input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      max="100"
                                      value={providerPctValue}
                                      onChange={e => setProviderPctValue(e.target.value)}
                                      className="h-6 w-16 text-xs px-1 text-center"
                                      autoFocus
                                      onKeyDown={e => {
                                        if (e.key === "Escape") setEditingProviderPct(null);
                                      }}
                                      data-testid={`input-provider-pct-${firstEntry.id}`}
                                    />
                                    <span className="text-xs text-muted-foreground">%</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="default"
                                      size="sm"
                                      className="h-6 text-xs px-2"
                                      onClick={() => {
                                        const newVal = providerPctValue.trim();
                                        providerPctMutation.mutate({
                                          providerName: firstEntry.providerName,
                                          subAgentPercentage: newVal === subPct ? null : (newVal || null),
                                        });
                                      }}
                                      disabled={providerPctMutation.isPending}
                                      data-testid={`btn-save-provider-pct-${firstEntry.id}`}
                                    >
                                      Save
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-6 text-xs px-2"
                                      onClick={() => setEditingProviderPct(null)}
                                      data-testid={`btn-cancel-provider-pct-${firstEntry.id}`}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div
                                  className={`flex items-center gap-1 mt-1 text-xs text-muted-foreground ${canEdit ? "cursor-pointer hover:text-foreground" : ""}`}
                                  onClick={() => {
                                    if (canEdit) {
                                      setEditingProviderPct(firstEntry.providerName);
                                      setProviderPctValue(firstEntry.subAgentPercentage || subPct);
                                    }
                                  }}
                                  data-testid={`btn-edit-provider-pct-${firstEntry.id}`}
                                >
                                  <Percent className="w-3 h-3 shrink-0" />
                                  <span>Sub-Agent: {firstEntry.effectiveSubAgentPercentage || subPct}%</span>
                                  {firstEntry.subAgentPercentage && (
                                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400">(custom)</span>
                                  )}
                                </div>
                              )}
                            </TableCell>
                          )}
                          <TableCell className="text-sm" data-testid={`text-label-${entry.id}`}>
                            {entry.ruleLabel || <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell data-testid={`text-degree-${entry.id}`}>
                            <Badge variant="outline">{entry.degreeLevel === 'any' ? 'Any' : entry.degreeLevel}</Badge>
                          </TableCell>
                          <TableCell data-testid={`text-territory-${entry.id}`}>
                            {formatTerritoryDisplay(entry.territory) || <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-right font-mono" data-testid={`text-commission-${entry.id}`}>
                            {entry.commissionType === "percentage" ? (
                              <span>{entry.commissionValue}%</span>
                            ) : (
                              <span>{entry.currency} {entry.commissionValue}</span>
                            )}
                          </TableCell>
                          <TableCell data-testid={`text-basis-${entry.id}`}>
                            {basisLabelMap[entry.commissionBasis] || entry.commissionBasis}
                          </TableCell>
                          <TableCell data-testid={`text-followup-${entry.id}`}>
                            {(entry.followupStudyLevel || (entry.followupYearRates && entry.followupYearRates.length > 0)) ? (
                              <div className="flex items-start gap-1">
                                <ArrowRight className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                                <div>
                                  {entry.followupStudyLevel && <div className="text-xs font-medium">{entry.followupStudyLevel}</div>}
                                  {entry.followupYearRates && entry.followupYearRates.length > 0 && (
                                    <div className="space-y-0.5">
                                      {entry.followupYearRates.map((yr, i) => (
                                        <div key={i} className="text-[11px] text-muted-foreground">
                                          {yr.year}: {yr.mode === "flat" ? `${yr.currency || "AUD"} ${parseFloat(yr.value || "0").toLocaleString()}` : `${parseFloat(yr.value || "0")}%`}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono" data-testid={`text-subagent-${entry.id}`}>
                            {entry.subAgentCommission ? (
                              <div>
                                {entry.commissionType === "percentage" ? (
                                  <span className="text-emerald-600 dark:text-emerald-400">{entry.subAgentCommission}%</span>
                                ) : (
                                  <span className="text-emerald-600 dark:text-emerald-400">{entry.currency} {entry.subAgentCommission}</span>
                                )}
                                <div className="text-[10px] text-muted-foreground">
                                  ({entry.effectiveSubAgentPercentage}%)
                                </div>
                                {entry.followupYearRates && entry.followupYearRates.length > 0 && (() => {
                                  const pct = parseFloat(entry.effectiveSubAgentPercentage || "0");
                                  return (
                                    <div className="mt-1 pt-1 border-t border-border/50 text-left">
                                      <div className="text-[10px] text-muted-foreground font-sans mb-0.5">Follow-up:</div>
                                      {entry.followupYearRates.map((yr, i) => {
                                        const origVal = parseFloat(yr.value || "0");
                                        const subVal = pct > 0 ? (origVal * pct / 100).toFixed(2) : "0";
                                        return (
                                          <div key={i} className="text-[11px] text-emerald-600 dark:text-emerald-400 font-sans">
                                            {yr.year}: {yr.mode === "flat" ? `${yr.currency || "AUD"} ${parseFloat(subVal).toLocaleString()}` : `${subVal}%`}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                })()}
                              </div>
                            ) : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={entry.isActive ? "default" : "secondary"} data-testid={`badge-active-${entry.id}`}>
                              {entry.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {entry.notes && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge variant="outline" className="cursor-help text-xs">Note</Badge>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-[300px]">{entry.notes}</TooltipContent>
                                </Tooltip>
                              )}
                              {canEdit && (
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(entry)} data-testid={`btn-edit-${entry.id}`}>
                                  <Pencil className="w-4 h-4" />
                                </Button>
                              )}
                              {canDelete && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => {
                                  if (confirm("Delete this entry?")) deleteMutation.mutate(entry.id);
                                }} data-testid={`btn-delete-${entry.id}`}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ));
                    });
                  })()}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="text-xs text-muted-foreground mt-3" data-testid="text-count">
            {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
          </div>
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Commission Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Provider Name *</Label>
              <Input
                value={formProvider}
                onChange={e => setFormProvider(e.target.value)}
                placeholder="Type provider name..."
                data-testid="input-provider"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Study Level</Label>
                <Select value={formDegree} onValueChange={setFormDegree}>
                  <SelectTrigger data-testid="select-degree">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {studyLevelOptions.map(d => (
                      <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Territory</Label>
                <MultiTerritorySelect
                  value={formTerritories}
                  onChange={setFormTerritories}
                  testIdPrefix="add-"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Commission Type</Label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger data-testid="select-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="flat">Flat Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Value *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formValue}
                  onChange={e => setFormValue(e.target.value)}
                  placeholder={formType === "percentage" ? "e.g. 15" : "e.g. 500"}
                  data-testid="input-value"
                />
              </div>
              {formType === "flat" && (
                <div>
                  <Label>Currency</Label>
                  <Select value={formCurrency} onValueChange={setFormCurrency}>
                    <SelectTrigger data-testid="select-currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AUD">AUD</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="NPR">NPR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div>
              <Label>Commission Basis</Label>
              <Select value={formBasis} onValueChange={setFormBasis}>
                <SelectTrigger data-testid="select-basis">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMMISSION_BASIS.map(b => (
                    <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
                placeholder="Optional notes..."
                rows={2}
                data-testid="input-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} data-testid="btn-cancel-add">Cancel</Button>
            <Button
              onClick={() => addMutation.mutate({
                providerName: formProvider.trim(),
                degreeLevel: formDegree,
                territory: formTerritories,
                commissionValue: formValue,
                commissionType: formType,
                currency: formCurrency,
                commissionBasis: formBasis,
                notes: formNotes,
              })}
              disabled={!formProvider.trim() || !formValue || addMutation.isPending}
              data-testid="btn-submit-add"
            >
              {addMutation.isPending ? "Adding..." : "Add Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={v => { setEditOpen(v); if (!v) setEditEntry(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Commission Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Provider Name *</Label>
              <Input
                value={formProvider}
                onChange={e => setFormProvider(e.target.value)}
                placeholder="Type provider name..."
                data-testid="edit-input-provider"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Study Level</Label>
                <Select value={formDegree} onValueChange={setFormDegree}>
                  <SelectTrigger data-testid="edit-select-degree">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {studyLevelOptions.map(d => (
                      <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Territory</Label>
                <MultiTerritorySelect
                  value={formTerritories}
                  onChange={setFormTerritories}
                  testIdPrefix="edit-"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Commission Type</Label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger data-testid="edit-select-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="flat">Flat Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Value *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formValue}
                  onChange={e => setFormValue(e.target.value)}
                  data-testid="edit-input-value"
                />
              </div>
              {formType === "flat" && (
                <div>
                  <Label>Currency</Label>
                  <Select value={formCurrency} onValueChange={setFormCurrency}>
                    <SelectTrigger data-testid="edit-select-currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AUD">AUD</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="NPR">NPR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div>
              <Label>Commission Basis</Label>
              <Select value={formBasis} onValueChange={setFormBasis}>
                <SelectTrigger data-testid="edit-select-basis">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMMISSION_BASIS.map(b => (
                    <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
                rows={2}
                data-testid="edit-input-notes"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="editActive"
                checked={editEntry?.isActive}
                onCheckedChange={() => {
                  if (editEntry) setEditEntry({ ...editEntry, isActive: !editEntry.isActive });
                }}
                data-testid="edit-checkbox-active"
              />
              <Label htmlFor="editActive" className="text-sm">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditOpen(false); setEditEntry(null); }} data-testid="btn-cancel-edit">Cancel</Button>
            <Button
              onClick={() => {
                if (!editEntry) return;
                editMutation.mutate({
                  id: editEntry.id,
                  data: {
                    providerName: formProvider.trim(),
                    degreeLevel: formDegree,
                    territory: formTerritories,
                    commissionValue: formValue,
                    commissionType: formType,
                    currency: formCurrency,
                    commissionBasis: formBasis,
                    notes: formNotes,
                    isActive: editEntry.isActive,
                  },
                });
              }}
              disabled={!formProvider.trim() || editMutation.isPending}
              data-testid="btn-submit-edit"
            >
              {editMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Config Dialog */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Sub-Agent Commission Percentage</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Set the global percentage of the main commission that sub-agents receive.
            </p>
            <div>
              <Label>Percentage (%)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={configPct}
                  onChange={e => setConfigPct(e.target.value)}
                  data-testid="input-config-pct"
                />
                <Percent className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Example: If main commission is 15% and sub-agent percentage is {configPct || "70"}%, the sub-agent gets{" "}
                {((15 * parseFloat(configPct || "70")) / 100).toFixed(2)}%
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigOpen(false)} data-testid="btn-cancel-config">Cancel</Button>
            <Button
              onClick={() => configMutation.mutate(configPct)}
              disabled={configMutation.isPending}
              data-testid="btn-submit-config"
            >
              {configMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Copy from Agreements Dialog */}
      <Dialog open={copyOpen} onOpenChange={v => { setCopyOpen(v); if (!v) setSelectedRules([]); }}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Copy from Existing Agreement Commission Rules</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Select commission rules to copy into the Sub Agent Commission Distribution table.
            </p>
          </DialogHeader>
          {copyLoading ? (
            <div className="space-y-2 py-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : copyRules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No commission rules found.</div>
          ) : (
            <div className="overflow-y-auto max-h-[50vh] border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selectedRules.length === copyRules.filter(r => !r.alreadyCopied).length && copyRules.filter(r => !r.alreadyCopied).length > 0}
                        onCheckedChange={(v) => {
                          if (v) {
                            setSelectedRules(copyRules.filter(r => !r.alreadyCopied).map(r => r.ruleId));
                          } else {
                            setSelectedRules([]);
                          }
                        }}
                        data-testid="checkbox-select-all"
                      />
                    </TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Agreement</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Commission</TableHead>
                    <TableHead>Basis</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {copyRules.map(rule => (
                    <TableRow key={rule.ruleId} className={rule.alreadyCopied ? "opacity-50" : ""} data-testid={`copy-row-${rule.ruleId}`}>
                      <TableCell>
                        <Checkbox
                          checked={selectedRules.includes(rule.ruleId)}
                          disabled={rule.alreadyCopied}
                          onCheckedChange={(v) => {
                            if (v) {
                              setSelectedRules([...selectedRules, rule.ruleId]);
                            } else {
                              setSelectedRules(selectedRules.filter(id => id !== rule.ruleId));
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell className="text-sm">{rule.label || "—"}</TableCell>
                      <TableCell className="font-medium">{rule.providerName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{rule.agreementCode}</TableCell>
                      <TableCell>{rule.studyLevel}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {rule.commissionMode === "percentage" && rule.percentageValue
                          ? `${rule.percentageValue}%`
                          : `${rule.currency} ${rule.flatAmount}`}
                      </TableCell>
                      <TableCell>{rule.basis}</TableCell>
                      <TableCell>
                        <Badge variant={rule.alreadyCopied ? "secondary" : "outline"}>
                          {rule.alreadyCopied ? "Copied" : "Available"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCopyOpen(false); setSelectedRules([]); }} data-testid="btn-cancel-copy">Cancel</Button>
            <Button
              onClick={() => copyMutation.mutate(selectedRules)}
              disabled={selectedRules.length === 0 || copyMutation.isPending}
              data-testid="btn-submit-copy"
            >
              {copyMutation.isPending ? "Copying..." : `Copy ${selectedRules.length} Selected`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Upload Dialog */}
      <Dialog open={bulkOpen} onOpenChange={v => { setBulkOpen(v); if (!v) { setBulkFile(null); setBulkResult(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk Upload Commission Entries</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Upload an Excel file (.xlsx) to add multiple commission entries at once.
            </p>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadSample}
                data-testid="btn-download-sample"
              >
                <Download className="w-4 h-4 mr-1" />
                Download Sample Sheet
              </Button>
              <span className="text-xs text-muted-foreground">Use this as a template</span>
            </div>

            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
              <input
                type="file"
                accept=".xlsx,.xls"
                id="bulk-file-input"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setBulkFile(file);
                    setBulkResult(null);
                  }
                }}
                data-testid="input-bulk-file"
              />
              {bulkFile ? (
                <div className="flex items-center justify-center gap-2">
                  <FileSpreadsheet className="w-8 h-8 text-emerald-600" />
                  <div className="text-left">
                    <p className="font-medium text-sm">{bulkFile.name}</p>
                    <p className="text-xs text-muted-foreground">{(bulkFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => { setBulkFile(null); setBulkResult(null); }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <label htmlFor="bulk-file-input" className="cursor-pointer">
                  <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">Click to select Excel file</p>
                  <p className="text-xs text-muted-foreground mt-1">Supports .xlsx files</p>
                </label>
              )}
            </div>

            {bulkResult && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <span className="text-sm font-medium">
                    {bulkResult.created} of {bulkResult.totalRows} entries created successfully
                  </span>
                </div>
                {bulkResult.errors.length > 0 && (
                  <div className="p-3 rounded-md bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      <span className="text-sm font-medium">{bulkResult.errors.length} errors:</span>
                    </div>
                    <ul className="text-xs space-y-1 max-h-[150px] overflow-y-auto">
                      {bulkResult.errors.map((err, i) => (
                        <li key={i}>• {err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBulkOpen(false); setBulkFile(null); setBulkResult(null); }} data-testid="btn-cancel-bulk">
              {bulkResult ? "Close" : "Cancel"}
            </Button>
            {!bulkResult && (
              <Button
                onClick={handleBulkUpload}
                disabled={!bulkFile || bulkUploading}
                data-testid="btn-submit-bulk"
              >
                {bulkUploading ? "Uploading..." : "Upload & Import"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAuditLog} onOpenChange={setShowAuditLog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle data-testid="audit-log-title">Sub-Agent % Change History</DialogTitle>
          </DialogHeader>
          <div className="overflow-auto flex-1">
            {auditLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8" data-testid="audit-log-empty">No changes recorded yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Changed By</TableHead>
                    <TableHead>Old Value</TableHead>
                    <TableHead>New Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.map((log: any) => (
                    <TableRow key={log.id} data-testid={`audit-row-${log.id}`}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {log.createdAt ? new Date(log.createdAt).toLocaleString() : "-"}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{log.providerName}</TableCell>
                      <TableCell className="text-sm">{log.changedByName || "Unknown"}</TableCell>
                      <TableCell className="text-sm">{log.oldValue || "-"}</TableCell>
                      <TableCell className="text-sm">{log.newValue || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
