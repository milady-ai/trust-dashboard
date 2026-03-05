"use client";

import type { Stats } from "@/lib/data-loader";
import { formatRelativeTime } from "@/lib/utils";

interface StatsBarProps {
  stats: Stats;
  generatedAt: string;
}

export function StatsBar({ stats, generatedAt }: StatsBarProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Total Contributors" value={stats.totalContributors.toString()} />
        <StatCard label="Total Events" value={stats.totalEvents.toString()} />
        <StatCard label="Last Updated" value={formatRelativeTime(generatedAt)} />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold font-mono mt-1">{value}</div>
    </div>
  );
}
