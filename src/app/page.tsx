"use client";

import { useMemo, useState } from "react";
import { ActivityFeed } from "@/components/activity-feed";
import { Leaderboard } from "@/components/leaderboard";
import { StatsBar } from "@/components/stats-bar";
import { getGeneratedAt, loadProject } from "@/lib/data-loader";

type SortKey = "elizaEffect" | "elizaPay" | "github" | "social" | "recent" | "username";

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: "elizaEffect", label: "elizaEffect Score" },
  { key: "elizaPay", label: "elizaPay Share" },
  { key: "github", label: "GitHub Score" },
  { key: "social", label: "Social Score" },
  { key: "recent", label: "Recent Activity" },
  { key: "username", label: "Username" },
];

const project = loadProject();
const generatedAt = getGeneratedAt();

export default function HomePage() {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("elizaEffect");

  const filteredSorted = useMemo(() => {
    const searchLower = search.trim().toLowerCase();

    const filtered = project.contributors.filter((c) => {
      return searchLower.length === 0 || c.username.toLowerCase().includes(searchLower);
    });

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case "elizaEffect":
          return b.elizaEffect.total - a.elizaEffect.total;
        case "elizaPay":
          return (b.elizaPay?.sharePercent ?? 0) - (a.elizaPay?.sharePercent ?? 0);
        case "github":
          return b.elizaEffect.github.total - a.elizaEffect.github.total;
        case "social":
          return b.elizaEffect.social.total - a.elizaEffect.social.total;
        case "recent":
          return new Date(b.lastActiveAt || 0).getTime() - new Date(a.lastActiveAt || 0).getTime();
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
        <h2 className="text-2xl font-bold mb-1">
          <span className="text-accent">eliza</span>Effect Leaderboard
        </h2>
        <p className="text-sm text-muted-foreground">
          Combined GitHub contribution + social impact scoring for {project.repoFullName}.
          {" "}Weights: {Math.round(project.config.githubWeight * 100)}% GitHub / {Math.round(project.config.socialWeight * 100)}% Social.
        </p>
      </div>

      <StatsBar stats={project.stats} generatedAt={generatedAt} />

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-github" /> GitHub
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-social" /> Social
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-eliza-gold" /> elizaPay share (quadratic)
        </span>
      </div>

      <section className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contributor..."
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
          <span>{filteredSorted.length} of {project.contributors.length} contributors</span>
          <span>· sort: {SORT_OPTIONS.find((s) => s.key === sortBy)?.label}</span>
          {search && <span>· search: &quot;{search}&quot;</span>}
        </div>
      </section>

      <Leaderboard contributors={filteredSorted} />

      <ActivityFeed contributors={project.contributors} />

      <footer className="text-center text-xs text-muted-foreground py-4 space-x-2">
        <a
          href="https://github.com/milady-ai/milaidy"
          className="text-accent hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Data from {project.repoFullName}
        </a>
        <span>· elizaEffect scoring · quadratic elizaPay distribution</span>
      </footer>
    </div>
  );
}
