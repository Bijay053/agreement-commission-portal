import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { format, parseISO } from "date-fns";
import { Info, Lock } from "lucide-react";

const typeLabels: Record<string, string> = {
  agency: "Agency Agreement",
  commission_schedule: "Commission Schedule",
  addendum: "Addendum",
  renewal: "Renewal",
  mou: "Memorandum of Understanding",
  other: "Other",
};

const confidentialityColors: Record<string, string> = {
  high: "text-red-600 dark:text-red-400 bg-red-500/10",
  medium: "text-amber-600 dark:text-amber-400 bg-amber-500/10",
  low: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
};

export default function OverviewTab({ agreement }: { agreement: any }) {
  const { hasPermission } = useAuth();

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
              <p className="text-xs text-muted-foreground">Confidentiality</p>
              <div className="mt-0.5">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${confidentialityColors[agreement.confidentialityLevel]}`}>
                  <Lock className="w-3 h-3" />
                  {agreement.confidentialityLevel.toUpperCase()}
                </span>
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
