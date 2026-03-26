import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Save, Info, Globe } from "lucide-react";

interface TaxSlabRecord {
  id: string;
  organization_id: string | null;
  fiscal_year_id: string | null;
  country: string | null;
  marital_status: string;
  slab_order: number;
  lower_limit: number;
  upper_limit: number | null;
  rate: number;
  is_active: boolean;
}

interface CountryTaxLabel {
  id: string;
  country: string;
  tax_id_label: string;
}

interface SlabRow {
  lower_limit: string;
  upper_limit: string;
  rate: string;
}

function SlabEditor({ maritalStatus, slabs, isLoading, country }: { maritalStatus: string; slabs: TaxSlabRecord[]; isLoading: boolean; country: string | null }) {
  const { toast } = useToast();

  const [rows, setRows] = useState<SlabRow[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    setInitialized(false);
  }, [country]);

  useEffect(() => {
    if (initialized) return;
    const filtered = slabs.filter(s => s.marital_status === maritalStatus && s.country === country);
    if (filtered.length > 0) {
      setRows(filtered.map(s => ({
        lower_limit: String(s.lower_limit),
        upper_limit: s.upper_limit !== null ? String(s.upper_limit) : "",
        rate: String(s.rate),
      })));
      setInitialized(true);
    } else if (!isLoading) {
      const defaults = maritalStatus === "married"
        ? [
            { lower_limit: "0", upper_limit: "600000", rate: "1" },
            { lower_limit: "600000", upper_limit: "800000", rate: "10" },
            { lower_limit: "800000", upper_limit: "1100000", rate: "20" },
            { lower_limit: "1100000", upper_limit: "2100000", rate: "30" },
            { lower_limit: "2100000", upper_limit: "", rate: "36" },
          ]
        : [
            { lower_limit: "0", upper_limit: "500000", rate: "1" },
            { lower_limit: "500000", upper_limit: "700000", rate: "10" },
            { lower_limit: "700000", upper_limit: "1000000", rate: "20" },
            { lower_limit: "1000000", upper_limit: "2000000", rate: "30" },
            { lower_limit: "2000000", upper_limit: "", rate: "36" },
          ];
      setRows(defaults);
      setInitialized(true);
    }
  }, [slabs, isLoading, maritalStatus, initialized, country]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/hrms/tax-slabs/bulk-save", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hrms/tax-slabs"] });
      toast({ title: `${maritalStatus === "married" ? "Married" : "Single"} tax slabs saved${country ? ` for ${country}` : ""}` });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleSave = () => {
    const slabData = rows.map(r => ({
      lower_limit: parseFloat(r.lower_limit) || 0,
      upper_limit: r.upper_limit ? parseFloat(r.upper_limit) : null,
      rate: parseFloat(r.rate) || 0,
    }));
    saveMutation.mutate({ marital_status: maritalStatus, slabs: slabData, country });
  };

  const addRow = () => {
    const lastRow = rows[rows.length - 1];
    const newLower = lastRow?.upper_limit || "0";
    setRows([...rows, { lower_limit: newLower, upper_limit: "", rate: "" }]);
  };

  const removeRow = (idx: number) => {
    if (rows.length <= 1) return;
    setRows(rows.filter((_, i) => i !== idx));
  };

  const updateRow = (idx: number, field: keyof SlabRow, value: string) => {
    const newRows = [...rows];
    newRows[idx] = { ...newRows[idx], [field]: value };
    if (field === "upper_limit" && idx < newRows.length - 1) {
      newRows[idx + 1] = { ...newRows[idx + 1], lower_limit: value };
    }
    setRows(newRows);
  };

  const calculateSampleTax = (annualIncome: number) => {
    let remaining = annualIncome;
    let tax = 0;
    for (const row of rows) {
      const lower = parseFloat(row.lower_limit) || 0;
      const upper = row.upper_limit ? parseFloat(row.upper_limit) : Infinity;
      const rate = (parseFloat(row.rate) || 0) / 100;
      const width = upper - lower;
      if (remaining <= 0) break;
      const taxable = Math.min(remaining, width);
      tax += taxable * rate;
      remaining -= taxable;
    }
    return tax;
  };

  if (isLoading) return <Skeleton className="h-40" />;

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>From</TableHead>
            <TableHead>To</TableHead>
            <TableHead>Rate (%)</TableHead>
            <TableHead>Tax on Slab</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, idx) => {
            const lower = parseFloat(row.lower_limit) || 0;
            const upper = row.upper_limit ? parseFloat(row.upper_limit) : null;
            const rate = (parseFloat(row.rate) || 0) / 100;
            const width = upper !== null ? upper - lower : 0;
            const taxOnSlab = width > 0 ? width * rate : 0;

            return (
              <TableRow key={idx} data-testid={`row-slab-${maritalStatus}-${idx}`}>
                <TableCell className="font-mono text-sm">{idx + 1}</TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={row.lower_limit}
                    onChange={e => updateRow(idx, "lower_limit", e.target.value)}
                    className="w-36"
                    disabled={idx > 0}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={row.upper_limit}
                    onChange={e => updateRow(idx, "upper_limit", e.target.value)}
                    placeholder={idx === rows.length - 1 ? "No limit" : ""}
                    className="w-36"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={row.rate}
                    onChange={e => updateRow(idx, "rate", e.target.value)}
                    className="w-24"
                    data-testid={`input-rate-${maritalStatus}-${idx}`}
                  />
                </TableCell>
                <TableCell className="font-mono text-sm text-muted-foreground">
                  {upper !== null ? taxOnSlab.toLocaleString() : "Unlimited"}
                </TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeRow(idx)} disabled={rows.length <= 1}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <div className="flex items-center gap-3">
        <Button size="sm" variant="outline" onClick={addRow} data-testid={`btn-add-slab-${maritalStatus}`}>
          <Plus className="h-3 w-3 mr-1" /> Add Slab
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending} data-testid={`btn-save-slabs-${maritalStatus}`}>
          <Save className="h-3 w-3 mr-1" /> {saveMutation.isPending ? "Saving..." : "Save Slabs"}
        </Button>
      </div>

      <Card className="bg-muted/50">
        <CardHeader className="p-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="h-4 w-4" /> Tax Calculation Preview ({maritalStatus === "married" ? "Married" : "Single"})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            {[500000, 800000, 1200000, 2500000].map(income => (
              <div key={income} className="space-y-1">
                <p className="text-muted-foreground">Annual: {income.toLocaleString()}</p>
                <p className="font-mono font-medium">Tax: {calculateSampleTax(income).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Monthly: {Math.round(calculateSampleTax(income) / 12).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function TaxSlabsTab() {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const { data: slabs, isLoading } = useQuery<TaxSlabRecord[]>({ queryKey: ["/api/hrms/tax-slabs"] });
  const { data: countryLabels } = useQuery<CountryTaxLabel[]>({ queryKey: ["/api/hrms/country-tax-labels"] });
  const countries = countryLabels || [];

  const filteredSlabs = (slabs || []).filter(s => s.country === selectedCountry);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Tax Slab Configuration</h2>
          <p className="text-sm text-muted-foreground">Configure income tax slabs per country for single and married employees. These slabs are used during payroll processing.</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Globe className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm font-medium">Country</Label>
        <Select value={selectedCountry || "__global__"} onValueChange={v => setSelectedCountry(v === "__global__" ? null : v)}>
          <SelectTrigger className="w-[220px]" data-testid="select-tax-country">
            <SelectValue placeholder="Select Country" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__global__">Global (Default)</SelectItem>
            {countries.map(c => (
              <SelectItem key={c.country} value={c.country}>{c.country}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedCountry && (
          <Badge variant="outline" className="text-xs">
            Slabs for {selectedCountry}
          </Badge>
        )}
      </div>

      <Tabs defaultValue="single">
        <TabsList>
          <TabsTrigger value="single" data-testid="tab-slab-single">Single / Unmarried</TabsTrigger>
          <TabsTrigger value="married" data-testid="tab-slab-married">Married / Couple</TabsTrigger>
        </TabsList>
        <TabsContent value="single">
          <SlabEditor maritalStatus="single" slabs={filteredSlabs} isLoading={isLoading} country={selectedCountry} />
        </TabsContent>
        <TabsContent value="married">
          <SlabEditor maritalStatus="married" slabs={filteredSlabs} isLoading={isLoading} country={selectedCountry} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
