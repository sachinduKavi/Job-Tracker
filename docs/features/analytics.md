# Analytics

## Purpose

See how the job search is going: volume, pipeline, what works (sources), what's in demand
(technologies) and where (locations).

## User Flow

- **Dashboard (`/`)**: the six headline metrics, applications by status, last 6 months.
- **Analytics (`/analytics`)**: the metrics plus applications over time (12 months), by status,
  source, technology, location, and an email delivery summary.
- Hover any bar/point for a tooltip; **View as table** under each chart shows the numbers.

## Metrics

All status-based metrics use each application's **current** status.

| Metric | Definition |
| --- | --- |
| Total Applications | count of all applications, including drafts |
| Applications This Month | applications whose *effective date* is in the current UTC calendar month |
| Interviews | current status ∈ {HR Screening, Technical Interview, Final Interview} |
| Offers | current status = Offer |
| Rejected | current status = Rejected |
| No Response | current status = No Response |

**Effective date** = `dateApplied`, falling back to `createdAt` when no date is set (drafts).

## Charts

| Chart | Calculation |
| --- | --- |
| Applications over time | `COUNT(*)` grouped by `DATE_FORMAT(COALESCE(dateApplied, createdAt), '%Y-%m')` for the last 12 months (6 on the dashboard); empty months filled with 0 |
| By status | `GROUP BY status`, all 10 statuses in lifecycle order (0 included on /analytics; dashboard hides zeros) |
| By source | `GROUP BY source`, sources with ≥ 1 application |
| By technology | `GROUP BY ApplicationTechnology.name`, top 10 + "Other"; grouping is case-insensitive (collation), so "React" and "react" count together |
| By location | `GROUP BY location` (`NULL` → "Unspecified"), top 10 + "Other" |
| Email delivery | `GROUP BY Email.emailStatus` |

An application with several technologies counts once per technology.

## Architecture & Implementation

- `lib/analytics/service.ts` — all counting in MySQL (`count`, `groupBy`, one parameterised
  raw query for the monthly series); queries run in parallel.
- `lib/analytics/aggregate.ts` (pure) — month buckets, gap filling, top-N + "Other".
- `components/analytics/charts.tsx` — Recharts (client): horizontal bars for categories,
  area/line for the time series; `stat-cards.tsx` for metrics.

## Chart design decisions

- One validated series colour (`--viz-series-1`: `#2a78d6` light / `#3987e5` dark, checked with
  the palette validator for lightness, chroma and ≥ 3:1 contrast against the card surface).
  Category identity comes from axis labels, never colour.
- Thin bars (18 px) with rounded data ends, value labels at the bar tip, recessive grid.
- Every chart has a hover tooltip and a table view (accessibility, exact numbers).
- No dual axes.

## Database Changes

None (reads existing tables; uses indexes on status, source, dates, location, technology name).

## Server Actions / API

None — Server Components call the service directly.

## Validation / Security

Read-only, authenticated pages; no user input reaches the SQL except via parameters.

## Testing

Unit: `fillMonthlySeries`, `lastMonths` (year boundary), `topN`
(`tests/unit/query-and-analytics.test.ts`). Integration: metrics, status breakdown, 12-month
window, case-insensitive technology grouping (`tests/integration/documents-templates-analytics.test.ts`).

## Error Handling

Database errors render the page error state with retry. Empty data shows "No data yet."

## Known Limitations

- Calendar months are UTC.
- Metrics reflect current status only (no funnel/conversion over time yet).

## Future Improvements

Funnel conversion rates from `StatusHistory`, response-time metrics, date-range filters on the
analytics page, CSV export.
