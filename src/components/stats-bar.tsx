"use client";

import type { ProjectStats } from "@/lib/types";
import { formatRelativeTime } from "@/lib/utils";

interface StatsBarProps {
  stats: ProjectStats;
  generatedAt: string;
  topTier?: string;
}

export function StatsBar({ stats, generatedAt }: StatsBarProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard label="Contributors" value={stats.totalContributors.toString()} />
      <StatCard label="GitHub Events" value={stats.totalGitHubEvents.toString()} />
      <StatCard label="Avg elizaEffect" value={stats.avgElizaEffect.toFixed(1)} accent />
      <StatCard label="Last Updated" value={formatRelativeTime(generatedAt)} />
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold font-mono mt-1 ${accent ? "text-accent" : ""}`}>{value}</div>
    </div>
  );
}
