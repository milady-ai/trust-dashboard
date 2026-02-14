"use client";

import { useMemo, useState } from "react";
import { ActivityFeed } from "@/components/activity-feed";
import { Leaderboard } from "@/components/leaderboard";
import { StatsBar } from "@/components/stats-bar";
import { getGeneratedAt, loadContributors, loadStats } from "@/lib/data-loader";
import { TIERS, TrustTier, getApprovalRate, getTotalPRs } from "@/lib/trust-scoring";

type SortKey = "trustScore" | "recent" | "streak" | "approvalRate" | "prCount" | "username";

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: "trustScore", label: "Trust Score" },
  { key: "recent", label: "Recent Activity" },
  { key: "streak", label: "Streak Length" },
  { key: "approvalRate", label: "Approval Rate" },
  { key: "prCount", label: "PR Count" },
  { key: "username", label: "Username" },
];

const allContributors = loadContributors();
const stats = loadStats();
const generatedAt = getGeneratedAt();

export default function HomePage() {
  const [search, setSearch] = useState("");
  const [selectedTiers, setSelectedTiers] = useState<TrustTier[]>([]);
  const [sortBy, setSortBy] = useState<SortKey>("trustScore");

  const filteredSorted = useMemo(() => {
    const searchLower = search.trim().toLowerCase();

    const filtered = allContributors.filter((contributor) => {
      const tierPass = selectedTiers.length === 0 || selectedTiers.includes(contributor.tier.label);
      const searchPass = searchLower.length === 0 || contributor.username.toLowerCase().includes(searchLower);
      return tierPass && searchPass;
    });

    return filtered.sort((a, b) => {
      switch (sortBy) {
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
  }, [search, selectedTiers, sortBy]);

  const toggleTier = (tier: TrustTier) => {
    setSelectedTiers((prev) => (prev.includes(tier) ? prev.filter((t) => t !== tier) : [...prev, tier]));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-1">Contributor Leaderboard</h2>
        <p className="text-sm text-muted-foreground">
          Trust scores for milady-ai/milaidy contributors. Score range 0-100, earned through consistent quality contributions.
        </p>
      </div>

      <StatsBar contributors={allContributors} stats={stats} generatedAt={generatedAt} />

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

        <div className="flex flex-wrap gap-2">
          {TIERS.map((tier) => {
            const active = selectedTiers.includes(tier.label);
            return (
              <button
                key={tier.label}
                type="button"
                onClick={() => toggleTier(tier.label)}
                className={`rounded-full border px-3 py-1 text-xs capitalize transition-colors ${
                  active
                    ? "border-accent bg-accent/20 text-accent"
                    : "border-border bg-muted/30 text-muted-foreground hover:text-foreground"
                }`}
              >
                {tier.icon} {tier.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{filteredSorted.length} of {allContributors.length} contributors</span>
          {selectedTiers.length > 0 && <span>• tiers: {selectedTiers.join(", ")}</span>}
          <span>• sort: {SORT_OPTIONS.find((s) => s.key === sortBy)?.label}</span>
          {search && <span>• search: "{search}"</span>}
        </div>
      </section>

      <Leaderboard contributors={filteredSorted} />

      <ActivityFeed contributors={allContributors} />

      <footer className="text-center text-xs text-muted-foreground py-4 space-x-2">
        <a
          href="https://github.com/milady-ai/milaidy/blob/main/.github/trust-scoring.js"
          className="text-accent hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Powered by trust-scoring.js
        </a>
        <span>•</span>
        <a
          href="https://github.com/milady-ai/milaidy"
          className="text-accent hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Data from milady-ai/milaidy
        </a>
        <span>• Updated every 6 hours • Built by agents, for agents</span>
      </footer>
    </div>
  );
}
