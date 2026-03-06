import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { format, parseISO } from "date-fns";
import { Info, Lock, Globe, MapPin } from "lucide-react";

const typeLabels: Record<string, string> = {
  agency: "Agency Agreement",
  commission_schedule: "Commission Schedule",
  addendum: "Addendum",
  renewal: "Renewal",
  mou: "Memorandum of Understanding",
  other: "Other",
};

export default function OverviewTab({ agreement }: { agreement: any }) {
  const { hasPermission } = useAuth();

  const territoryDisplay = agreement.territoryType === "global"
    ? "Global"
    : agreement.territories?.map((t: any) => t.name).join(", ") || "—";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-3">
          <h3 className="font-medium flex items-center gap-2">
            <Info className="w-4 h-4 text-muted-foreground" />
            Agreement Details
          </h3>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Agreement Code</p>
              <p className="text-sm font-mono mt-0.5">{agreement.agreementCode}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Type</p>
              <p className="text-sm mt-0.5">{typeLabels[agreement.agreementType] || agreement.agreementType}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Start Date</p>
              <p className="text-sm mt-0.5">{format(parseISO(agreement.startDate), "dd MMMM yyyy")}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Expiry Date</p>
              <p className="text-sm mt-0.5">{format(parseISO(agreement.expiryDate), "dd MMMM yyyy")}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Auto Renew</p>
              <p className="text-sm mt-0.5">{agreement.autoRenew ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Territory</p>
              <div className="flex items-center gap-1 mt-0.5">
                {agreement.territoryType === "global" ? (
                  <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                ) : (
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                )}
                <p className="text-sm">{territoryDisplay}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <h3 className="font-medium flex items-center gap-2">
            <Lock className="w-4 h-4 text-muted-foreground" />
            Internal Notes
          </h3>
        </CardHeader>
        <CardContent className="pt-0">
          {hasPermission("agreement.notes.view_sensitive") ? (
            agreement.internalNotes ? (
              <p className="text-sm text-foreground whitespace-pre-wrap">{agreement.internalNotes}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">No internal notes</p>
            )
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="w-4 h-4" />
              <span>You do not have permission to view sensitive notes</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
