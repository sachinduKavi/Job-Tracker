import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Briefcase, Plus } from "lucide-react";
import { BarBreakdown, ChartCard, TrendChart } from "@/components/analytics/charts";
import { StatCards } from "@/components/analytics/stat-cards";
import { ApplicationsTable } from "@/components/applications/applications-table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { getDashboardStats, getMonthlyTrend, getStatusBreakdown } from "@/lib/analytics/service";
import { DEFAULT_QUERY } from "@/lib/applications/query";
import { listApplications } from "@/lib/applications/service";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const recentQuery = { ...DEFAULT_QUERY, sort: "updatedAt" as const, pageSize: 8 };
  const [stats, recent, byStatus, trend] = await Promise.all([
    getDashboardStats(),
    listApplications(recentQuery),
    getStatusBreakdown(),
    getMonthlyTrend(new Date(), 6),
  ]);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Your job search at a glance."
        actions={
          <Button asChild>
            <Link href="/applications/new">
              <Plus /> New application
            </Link>
          </Button>
        }
      />
      <StatCards stats={stats} />
      {recent.total === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="Welcome to JobTrack"
          description="Add your first application, upload your CV on the Documents page and create an email template."
          action={
            <Button asChild>
              <Link href="/applications/new">
                <Plus /> New application
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard title="Applications by status">
              <BarBreakdown header="Status" data={byStatus.filter((s) => s.count > 0).map(({ name, count }) => ({ name, count }))} />
            </ChartCard>
            <ChartCard title="Last 6 months">
              <TrendChart data={trend} />
            </ChartCard>
          </div>
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Recently updated</h2>
              <Button asChild variant="ghost" size="sm">
                <Link href="/applications">
                  All applications <ArrowRight />
                </Link>
              </Button>
            </div>
            <ApplicationsTable items={recent.items} query={recentQuery} />
          </section>
        </>
      )}
    </>
  );
}
