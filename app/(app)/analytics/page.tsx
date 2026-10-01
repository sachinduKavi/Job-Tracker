import type { Metadata } from "next";
import { BarBreakdown, ChartCard, TrendChart } from "@/components/analytics/charts";
import { StatCards } from "@/components/analytics/stat-cards";
import { EmailStatusBadge } from "@/components/applications/status-badge";
import { PageHeader } from "@/components/shared/page-header";
import { getAnalytics } from "@/lib/analytics/service";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const data = await getAnalytics();
  return (
    <>
      <PageHeader title="Analytics" description="How your job search is going. Status counts use each application's current status." />
      <StatCards stats={data.stats} />
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Applications over time" description="Per month, last 12 months (by date applied, else date created)" className="lg:col-span-2">
          <TrendChart data={data.overTime} />
        </ChartCard>
        <ChartCard title="Applications by status">
          <BarBreakdown header="Status" data={data.byStatus.map(({ name, count }) => ({ name, count }))} />
        </ChartCard>
        <ChartCard title="Applications by source">
          <BarBreakdown header="Source" data={data.bySource} />
        </ChartCard>
        <ChartCard title="Applications by technology" description="Top 10 technologies across tech stacks">
          <BarBreakdown header="Technology" data={data.byTechnology} />
        </ChartCard>
        <ChartCard title="Applications by location" description="Top 10 locations">
          <BarBreakdown header="Location" data={data.byLocation} />
        </ChartCard>
        <ChartCard title="Email delivery" description="Delivery status of every email sent (independent of application status)" className="lg:col-span-2">
          {data.emailDelivery.length ? (
            <ul className="flex flex-wrap gap-4 text-sm">
              {data.emailDelivery.map((e) => (
                <li key={e.status} className="flex items-center gap-2">
                  <EmailStatusBadge status={e.status} />
                  <span className="font-semibold tabular-nums">{e.count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No emails sent yet.</p>
          )}
        </ChartCard>
      </div>
    </>
  );
}
