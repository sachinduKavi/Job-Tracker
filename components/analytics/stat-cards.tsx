import { Briefcase, CalendarPlus, Clock, MessagesSquare, Trophy, XCircle, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { DashboardStats } from "@/lib/analytics/service";

const ITEMS: { key: keyof DashboardStats; label: string; icon: LucideIcon; hint: string }[] = [
  { key: "total", label: "Total applications", icon: Briefcase, hint: "All time, including drafts" },
  { key: "thisMonth", label: "This month", icon: CalendarPlus, hint: "Applied (or created) this calendar month" },
  { key: "interviews", label: "Interviews", icon: MessagesSquare, hint: "Currently in HR / technical / final interview" },
  { key: "offers", label: "Offers", icon: Trophy, hint: "Currently at Offer" },
  { key: "rejected", label: "Rejected", icon: XCircle, hint: "Currently Rejected" },
  { key: "noResponse", label: "No response", icon: Clock, hint: "Currently No Response" },
];

/** Headline numbers. Definitions: docs/features/analytics.md#metrics. */
export function StatCards({ stats }: { stats: DashboardStats }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {ITEMS.map(({ key, label, icon: Icon, hint }) => (
        <Card key={key} className="py-4" title={hint}>
          <CardContent className="space-y-2 px-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">{label}</span>
              <Icon className="size-4" />
            </div>
            <p className="text-3xl font-semibold tabular-nums" data-testid={`stat-${key}`}>
              {stats[key]}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
