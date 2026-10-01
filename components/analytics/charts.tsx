"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Chart primitives. Every chart is single-series (one validated hue, --viz-series-1);
 * category identity comes from the axis label, never colour. Each chart has a hover
 * tooltip and a "View as table" fallback for accessibility.
 */

export interface CategoryDatum {
  name: string;
  count: number;
}

const TICK = { fill: "var(--muted-foreground)", fontSize: 12 };

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value?: number; payload?: { name?: string; label?: string } }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="font-medium">{label ?? item.payload?.name ?? item.payload?.label}</p>
      <p className="text-muted-foreground">
        <span className="font-semibold text-foreground">{item.value}</span> application{item.value === 1 ? "" : "s"}
      </p>
    </div>
  );
}

function DataTable({ rows, header }: { rows: { label: string; count: number }[]; header: string }) {
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">View as table</summary>
      <table className="mt-2 w-full text-left text-xs">
        <thead>
          <tr className="border-b text-muted-foreground">
            <th className="py-1 font-medium">{header}</th>
            <th className="py-1 text-right font-medium">Applications</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b last:border-0">
              <td className="py-1">{r.label}</td>
              <td className="py-1 text-right tabular-nums">{r.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

export function ChartCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** Horizontal bars for categorical breakdowns (status, source, technology, location). */
export function BarBreakdown({ data, header = "Category" }: { data: CategoryDatum[]; header?: string }) {
  if (data.every((d) => d.count === 0)) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No data yet.</p>;
  }
  const height = Math.max(120, data.length * 32 + 16);
  return (
    <>
      <div style={{ height }} role="img" aria-label={`${header} breakdown bar chart`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 36, bottom: 0, left: 0 }}>
            <XAxis type="number" hide allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={130} tickLine={false} axisLine={false} tick={TICK} interval={0} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.6 }} />
            <Bar dataKey="count" fill="var(--viz-series-1)" radius={[0, 4, 4, 0]} barSize={18} isAnimationActive={false}>
              <LabelList dataKey="count" position="right" className="fill-muted-foreground text-xs" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <DataTable header={header} rows={data.map((d) => ({ label: d.name, count: d.count }))} />
    </>
  );
}

/** Monthly trend (area + 2px line, crosshair tooltip). */
export function TrendChart({ data }: { data: { label: string; count: number }[] }) {
  return (
    <>
      <div className="h-64" role="img" aria-label="Applications per month">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--viz-series-1)" stopOpacity={0.25} />
                <stop offset="100%" stopColor="var(--viz-series-1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={TICK} interval="preserveStartEnd" minTickGap={16} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={TICK} />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }} />
            <Area
              type="linear"
              dataKey="count"
              stroke="var(--viz-series-1)"
              strokeWidth={2}
              fill="url(#trendFill)"
              activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <DataTable header="Month" rows={data.map((d) => ({ label: d.label, count: d.count }))} />
    </>
  );
}
