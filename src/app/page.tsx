"use client";

import { useMemo, useState } from "react";
import { ActivityFeed } from "@/components/activity-feed";
import { Leaderboard } from "@/components/leaderboard";
import { StatsBar } from "@/components/stats-bar";
import { getGeneratedAt, loadContributors, loadStats } from "@/lib/data-loader";

type SortKey = "recent" | "approvalRate" | "prCount" | "username";

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: "recent", label: "Recent Activity" },
  { key: "approvalRate", label: "Approval Rate" },
  { key: "prCount", label: "PR Count" },
  { key: "username", label: "Username" },
];

const allContributors = loadContributors();
const stats = loadStats();
const generatedAt = getGeneratedAt();

function getTotalPRs(c: (typeof allContributors)[number]) {
  return c.totalApprovals + c.totalRejections + c.totalCloses + c.totalSelfCloses;
}

function getApprovalRate(c: (typeof allContributors)[number]) {
  const total = getTotalPRs(c);
  return total > 0 ? (c.totalApprovals / total) * 100 : 0;
}

export default function HomePage() {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("recent");

  const filteredSorted = useMemo(() => {
    const searchLower = search.trim().toLowerCase();

    const filtered = allContributors.filter((contributor) => {
      return searchLower.length === 0 || contributor.username.toLowerCase().includes(searchLower);
    });

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case "recent":
          return new Date(b.lastEventAt || 0).getTime() - new Date(a.lastEventAt || 0).getTime();
        case "approvalRate":
          return getApprovalRate(b) - getApprovalRate(a);
        case "prCount":
          return getTotalPRs(b) - getTotalPRs(a);
        case "username":
          return a.username.localeCompare(b.username);
        default:
          return 0;
      }
    });
  }, [search, sortBy]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-1">Contributor Dashboard</h2>
        <p className="text-sm text-muted-foreground">
          Activity overview for milady-ai/milaidy contributors.
        </p>
      </div>

      <StatsBar stats={stats} generatedAt={generatedAt} />

      <section className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search username..."
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <div className="flex items-center gap-2">
            <label htmlFor="sortBy" className="text-xs text-muted-foreground">Sort by</label>
            <select
              id="sortBy"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="rounded-md border border-border bg-background px-2 py-2 text-sm"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{filteredSorted.length} of {allContributors.length} contributors</span>
          <span>· sort: {SORT_OPTIONS.find((s) => s.key === sortBy)?.label}</span>
          {search && <span>· search: &quot;{search}&quot;</span>}
        </div>
      </section>

      <Leaderboard contributors={filteredSorted} />

      <ActivityFeed contributors={allContributors} />

      <footer className="text-center text-xs text-muted-foreground py-4 space-x-2">
        <a
          href="https://github.com/milady-ai/milaidy"
          className="text-accent hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Data from milady-ai/milaidy
        </a>
        <span>· Built by agents, for agents</span>
      </footer>
    </div>
  );
}
