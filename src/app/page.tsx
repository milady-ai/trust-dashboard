"use client";

import { useMemo, useState } from "react";
import { ActivityFeed } from "@/components/activity-feed";
import { Leaderboard } from "@/components/leaderboard";
import { StatsBar } from "@/components/stats-bar";
import { useLiveTrustData } from "@/lib/use-live-trust-data";
import { TIERS, TrustTier, getApprovalRate, getTotalPRs } from "@/lib/trust-scoring";
import { formatRelativeTime } from "@/lib/utils";

type SortKey = "trustScore" | "recent" | "streak" | "approvalRate" | "prCount" | "username" | "level" | "xp";

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: "trustScore", label: "Trust Score" },
  { key: "level", label: "Total Level" },
  { key: "xp", label: "Total XP" },
  { key: "recent", label: "Recent Activity" },
  { key: "streak", label: "Streak Length" },
  { key: "approvalRate", label: "Approval Rate" },
  { key: "prCount", label: "PR Count" },
  { key: "username", label: "Username" },
];

function isActiveInLast30Days(lastEventAt: string | null): boolean {
  if (!lastEventAt) return false;
  const ts = Date.parse(lastEventAt);
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts <= 30 * 24 * 60 * 60 * 1000;
}

export default function HomePage() {
  const [search, setSearch] = useState("");
  const [selectedTiers, setSelectedTiers] = useState<TrustTier[]>([]);
  const [sortBy, setSortBy] = useState<SortKey>("trustScore");
  const [showHumansOnly, setShowHumansOnly] = useState(false);
  const {
    contributors: allContributors,
    stats,
    generatedAt,
    isLoading,
    isRefreshing,
    refreshError,
    nextRefreshIn,
    lastUpdatedAt,
  } = useLiveTrustData();

  const filteredSorted = useMemo(() => {
    const searchLower = search.trim().toLowerCase();

    const filtered = allContributors.filter((contributor) => {
      const tierPass = selectedTiers.length === 0 || selectedTiers.includes(contributor.tier.label);
      const searchPass = searchLower.length === 0 || contributor.username.toLowerCase().includes(searchLower);
      const agentPass = !showHumansOnly || !contributor.isAgent;
      return tierPass && searchPass && agentPass;
    });

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case "level":
          return b.totalLevel - a.totalLevel;
        case "xp":
          return b.totalXp - a.totalXp;
        case "recent":
          return new Date(b.lastEventAt || 0).getTime() - new Date(a.lastEventAt || 0).getTime();
        case "streak":
          return b.currentStreak.length - a.currentStreak.length;
        case "approvalRate":
          return getApprovalRate(b) - getApprovalRate(a);
        case "prCount":
          return getTotalPRs(b) - getTotalPRs(a);
        case "username":
          return a.username.localeCompare(b.username);
        case "trustScore":
        default:
          return b.trustScore - a.trustScore;
      }
    });
  }, [allContributors, search, selectedTiers, sortBy, showHumansOnly]);

  const activeContributors = useMemo(
    () => allContributors.filter((contributor) => isActiveInLast30Days(contributor.lastEventAt)).length,
    [allContributors],
  );

  const liveStatusLabel = isLoading
    ? "Loading live rankings..."
    : isRefreshing
      ? "Refreshing rankings..."
      : "Live · Refreshes every 60s";

  const toggleTier = (tier: TrustTier) => {
    setSelectedTiers((prev) => (prev.includes(tier) ? prev.filter((t) => t !== tier) : [...prev, tier]));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-white to-violet-50/30 dark:from-zinc-950 dark:via-zinc-900 dark:to-violet-950/20">
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-12">
        <header className="mb-2 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1.5 text-xs font-medium text-violet-600 dark:bg-violet-900/40 dark:text-violet-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-500" />
            </span>
            {liveStatusLabel}
          </div>
          <h1 className="mb-2 text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Contributor Leaderboard</h1>
          <a
            href="https://github.com/milady-ai/milaidy"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-violet-600 dark:text-zinc-400 dark:hover:text-violet-400"
          >
            View repo on GitHub ↗
          </a>
        </header>

        {!isLoading ? (
          <section className="grid grid-cols-3 gap-3">
            <StatTile label="Contributors" value={allContributors.length.toLocaleString()} />
            <StatTile label="Total Events" value={stats.totalEvents.toLocaleString()} />
            <StatTile label="Active (30d)" value={activeContributors.toLocaleString()} />
          </section>
        ) : null}

        {refreshError ? (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
            Live refresh failed. Showing latest bundled snapshot.
          </section>
        ) : null}

        <Leaderboard contributors={filteredSorted} />

        <details className="rounded-2xl border border-zinc-200 bg-white/80 dark:border-zinc-800 dark:bg-zinc-900/70">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-zinc-700 marker:hidden dark:text-zinc-200">
            Advanced filters & activity
          </summary>
          <div className="space-y-4 border-t border-zinc-200 px-4 py-4 dark:border-zinc-800">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search username..."
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent/60"
              />

              <div className="flex items-center gap-2">
                <label htmlFor="sortBy" className="text-xs text-muted-foreground">
                  Sort
                </label>
                <select
                  id="sortBy"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortKey)}
                  className="rounded-xl border border-border bg-background px-2.5 py-2 text-sm"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => setShowHumansOnly((v) => !v)}
                className={`rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                  showHumansOnly
                    ? "border-violet-300 bg-violet-50 text-violet-700"
                    : "border-border bg-muted/70 text-muted-foreground hover:text-foreground"
                }`}
              >
                {showHumansOnly ? "Humans only" : "All contributors"}
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {TIERS.map((tier) => {
                const active = selectedTiers.includes(tier.label);
                return (
                  <button
                    key={tier.label}
                    type="button"
                    onClick={() => toggleTier(tier.label)}
                    className={`rounded-full border px-3 py-1 text-xs capitalize transition-colors ${
                      active
                        ? "border-violet-300 bg-violet-50 text-violet-700"
                        : "border-border bg-muted/70 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tier.icon} {tier.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>
                {filteredSorted.length} of {allContributors.length} contributors
              </span>
              {selectedTiers.length > 0 ? <span>• tiers: {selectedTiers.join(", ")}</span> : null}
              <span>• sort: {SORT_OPTIONS.find((s) => s.key === sortBy)?.label}</span>
              {search ? <span>• search: &quot;{search}&quot;</span> : null}
              {showHumansOnly ? <span>• humans only</span> : null}
            </div>

            <StatsBar contributors={allContributors} stats={stats} generatedAt={generatedAt} />
            <ActivityFeed contributors={allContributors} />
          </div>
        </details>

        <footer className="mt-8 flex items-center justify-between text-xs text-zinc-400 dark:text-zinc-600">
          <span>Updated {formatRelativeTime(lastUpdatedAt)}</span>
          <span>Next refresh in {nextRefreshIn}s</span>
        </footer>
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-100 bg-white px-4 py-3 text-center dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">{value}</div>
      <div className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">{label}</div>
    </div>
  );
}
