import "server-only";
import { db } from "@/lib/db";
import { APPLICATION_STATUSES, INTERVIEW_STATUSES, STATUS_CONFIG } from "@/lib/applications/status";
import { APPLICATION_SOURCES, SOURCE_LABELS } from "@/lib/applications/source";
import { fillMonthlySeries, startOfUtcMonth, topN } from "@/lib/analytics/aggregate";

/**
 * Dashboard & analytics queries. All counting happens in MySQL (COUNT / GROUP BY);
 * nothing loads every application into memory. Definitions are documented in
 * docs/features/analytics.md — keep them in sync.
 *
 * "Effective date" of an application = dateApplied, falling back to createdAt.
 * Status-based counts use the CURRENT status of each application.
 */

export async function getDashboardStats(now = new Date()) {
  const monthStart = startOfUtcMonth(now);
  const [total, thisMonth, interviews, offers, rejected, noResponse] = await Promise.all([
    db.application.count(),
    db.application.count({
      where: {
        OR: [{ dateApplied: { gte: monthStart } }, { dateApplied: null, createdAt: { gte: monthStart } }],
      },
    }),
    db.application.count({ where: { status: { in: [...INTERVIEW_STATUSES] } } }),
    db.application.count({ where: { status: "OFFER" } }),
    db.application.count({ where: { status: "REJECTED" } }),
    db.application.count({ where: { status: "NO_RESPONSE" } }),
  ]);
  return { total, thisMonth, interviews, offers, rejected, noResponse };
}

export type DashboardStats = Awaited<ReturnType<typeof getDashboardStats>>;

export async function getStatusBreakdown() {
  const rows = await db.application.groupBy({ by: ["status"], _count: { _all: true } });
  const counts = new Map(rows.map((r) => [r.status, r._count._all]));
  return APPLICATION_STATUSES.map((status) => ({
    status,
    name: STATUS_CONFIG[status].label,
    count: counts.get(status) ?? 0,
    color: STATUS_CONFIG[status].color,
  }));
}

export async function getSourceBreakdown() {
  const rows = await db.application.groupBy({ by: ["source"], _count: { _all: true } });
  const counts = new Map(rows.map((r) => [r.source, r._count._all]));
  return APPLICATION_SOURCES.map((source) => ({ name: SOURCE_LABELS[source], count: counts.get(source) ?? 0 })).filter(
    (r) => r.count > 0,
  );
}

export async function getMonthlyTrend(now = new Date(), months = 12) {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
  const rows = await db.$queryRaw<{ month: string; count: bigint | number }[]>`
    SELECT DATE_FORMAT(COALESCE(dateApplied, createdAt), '%Y-%m') AS month, COUNT(*) AS count
    FROM Application
    WHERE COALESCE(dateApplied, createdAt) >= ${from}
    GROUP BY month
    ORDER BY month`;
  return fillMonthlySeries(
    rows.map((r) => ({ month: r.month, count: Number(r.count) })),
    now,
    months,
  );
}

export async function getTechnologyBreakdown(limit = 10) {
  const rows = await db.applicationTechnology.groupBy({
    by: ["name"],
    _count: { _all: true },
    orderBy: { _count: { name: "desc" } },
    take: 50,
  });
  return topN(
    rows.map((r) => ({ name: r.name, count: r._count._all })),
    limit,
  );
}

export async function getLocationBreakdown(limit = 10) {
  const rows = await db.application.groupBy({ by: ["location"], _count: { _all: true } });
  return topN(
    rows.map((r) => ({ name: r.location || "Unspecified", count: r._count._all })),
    limit,
  );
}

export async function getEmailDeliveryBreakdown() {
  const rows = await db.email.groupBy({ by: ["emailStatus"], _count: { _all: true } });
  return rows.map((r) => ({ status: r.emailStatus, count: r._count._all }));
}

export async function getAnalytics(now = new Date()) {
  const [stats, byStatus, bySource, overTime, byTechnology, byLocation, emailDelivery] = await Promise.all([
    getDashboardStats(now),
    getStatusBreakdown(),
    getSourceBreakdown(),
    getMonthlyTrend(now),
    getTechnologyBreakdown(),
    getLocationBreakdown(),
    getEmailDeliveryBreakdown(),
  ]);
  return { stats, byStatus, bySource, overTime, byTechnology, byLocation, emailDelivery };
}

export type AnalyticsData = Awaited<ReturnType<typeof getAnalytics>>;
