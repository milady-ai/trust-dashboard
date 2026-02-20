"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { loadContributors } from "@/lib/data-loader";
import { TierBadge } from "@/components/tier-badge";
import { BadgeDisplay } from "@/components/badge-display";
import { CharacterClassBadge } from "@/components/character-class";
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
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-1">Agent Leaderboard</h2>
        <p className="text-sm text-muted-foreground">
          Automated contributors and bots. Scored with the same trust algorithm as human contributors.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agents..."
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <span className="text-sm text-muted-foreground">
            {agents.length} agent{agents.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {agents.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/50 p-12 text-center">
          <div className="text-4xl mb-3">🤖</div>
          <h3 className="text-lg font-semibold mb-1">No agents found</h3>
          <p className="text-sm text-muted-foreground">
            Agent contributors are auto-detected by username patterns (e.g., [bot], -bot) or configured in the agent list.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {agents.map((agent, index) => (
            <Link
              key={agent.username}
              href={`/contributor/${agent.username}`}
              className="rounded-lg border border-border bg-card p-4 card-hover block"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-sm font-mono text-muted-foreground w-6">
                    {index + 1}
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://github.com/${agent.username}.png`}
                    alt={agent.username}
                    className="h-10 w-10 rounded-full bg-muted flex-shrink-0"
                    loading="lazy"
                  />
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate flex items-center gap-2">
                      {agent.username}
                      <span className="text-xs text-muted-foreground">🤖</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <CharacterClassBadge characterClass={agent.characterClass} size="sm" />
                      <BadgeDisplay badges={agent.badges} compact />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="text-right hidden sm:block">
                    <div className="text-xs text-muted-foreground">Level</div>
                    <div className="text-sm font-mono font-bold">{agent.totalLevel}</div>
                  </div>
                  <div className="text-right hidden sm:block">
                    <div className="text-xs text-muted-foreground">XP</div>
                    <div className="text-sm font-mono">{agent.totalXp.toLocaleString()}</div>
                  </div>
                  <TierBadge tier={agent.tier} size="sm" />
                  <div className="text-right">
                    <div className="text-lg font-mono font-bold" style={{ color: agent.tier.color }}>
                      {agent.trustScore.toFixed(1)}
                    </div>
                    <div className="text-xs text-muted-foreground">{formatRelativeTime(agent.lastEventAt)}</div>
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
