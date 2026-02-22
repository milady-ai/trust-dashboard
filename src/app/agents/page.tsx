"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { loadContributors } from "@/lib/data-loader";
import { TierBadge } from "@/components/tier-badge";
import { formatRelativeTime } from "@/lib/utils";

const allContributors = loadContributors();

export default function AgentsPage() {
  const [search, setSearch] = useState("");

  const agents = useMemo(() => {
    const filtered = allContributors.filter((c) => c.isAgent);
    const searchLower = search.trim().toLowerCase();
    if (searchLower) {
      return filtered.filter((c) => c.username.toLowerCase().includes(searchLower));
    }
    return filtered.sort((a, b) => b.trustScore - a.trustScore);
  }, [search]);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Agent Leaderboard</h1>
        <p className="text-sm text-muted-foreground">
          Automated contributors scored with the same trust model, badges, and XP levels.
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agents..."
            className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent/60"
          />
          <span className="text-sm text-muted-foreground">
            {agents.length} agent{agents.length !== 1 ? "s" : ""}
          </span>
        </div>
      </section>

      {agents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <div className="text-4xl mb-3">🤖</div>
          <h3 className="text-lg font-semibold mb-1">No agents found</h3>
          <p className="text-sm text-muted-foreground">
            Agent usernames are detected by patterns like `[bot]`, `-bot`, and known bot accounts.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {agents.map((agent, index) => (
            <Link
              key={agent.username}
              href={`/contributor/${agent.username}`}
              className="block rounded-2xl border border-border bg-card px-4 py-3 card-hover"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 shrink-0 text-sm font-mono text-muted-foreground">#{index + 1}</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://github.com/${agent.username}.png`}
                  alt={agent.username}
                  className="h-11 w-11 rounded-full border border-border bg-muted"
                  loading="lazy"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold">{agent.username}</span>
                    <span className="rounded-full border border-border bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                      bot
                    </span>
                    <TierBadge tier={agent.tier} size="sm" />
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span>Lv {agent.totalLevel}</span>
                    <span>•</span>
                    <span>{agent.totalXp.toLocaleString()} XP</span>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <div className="text-base sm:text-xl font-semibold font-mono" style={{ color: agent.tier.color }}>
                    {agent.trustScore.toFixed(1)}
                  </div>
                  <div className="text-[11px] sm:text-xs text-muted-foreground">
                    Last active {formatRelativeTime(agent.lastEventAt)}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
