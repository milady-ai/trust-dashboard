"use client";

import Link from "next/link";
import type { Contributor } from "@/lib/types";
import { formatRelativeTime } from "@/lib/utils";

interface LeaderboardProps {
  contributors: Contributor[];
}

function EffectBar({ score, github, social }: { score: number; github: number; social: number }) {
  const total = github + social;
  const githubPct = total > 0 ? (github / total) * 100 : 0;

  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden flex">
        <div className="h-full bg-github" style={{ width: `${githubPct}%` }} />
        <div className="h-full bg-social" style={{ width: `${100 - githubPct}%` }} />
      </div>
      <span className="text-sm font-mono font-bold w-10 text-right">{score.toFixed(1)}</span>
    </div>
  );
}

function PayBadge({ sharePercent }: { sharePercent: number }) {
  if (sharePercent <= 0) return null;
  return (
    <span className="inline-flex items-center rounded-full bg-eliza-gold/10 border border-eliza-gold/30 px-2 py-0.5 text-xs font-mono text-eliza-gold">
      {sharePercent.toFixed(1)}%
    </span>
  );
}

export function Leaderboard({ contributors }: LeaderboardProps) {
  if (contributors.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
        No contributors found.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Desktop table */}
      <div className="hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wide">
              <th className="px-4 py-3 text-left w-10">#</th>
              <th className="px-4 py-3 text-left">Contributor</th>
              <th className="px-4 py-3 text-left">elizaEffect</th>
              <th className="px-4 py-3 text-right">Merged</th>
              <th className="px-4 py-3 text-right">Events</th>
              <th className="px-4 py-3 text-right">elizaPay</th>
              <th className="px-4 py-3 text-right">Last Active</th>
            </tr>
          </thead>
          <tbody>
            {contributors.map((c) => {
              const totalMerged = c.githubEvents.filter((e) => e.type === "pr_merged").length;
              const totalEvents = c.githubEvents.length;

              return (
                <tr key={c.username} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                    {c.elizaEffect.rank}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/contributor/${c.username}`} className="flex items-center gap-3 hover:text-accent transition-colors">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={c.avatarUrl} alt="" className="h-8 w-8 rounded-full border border-border bg-muted" />
                      <span className="font-medium">{c.username}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <EffectBar
                      score={c.elizaEffect.total}
                      github={c.elizaEffect.github.total}
                      social={c.elizaEffect.social.total}
                    />
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground">{totalMerged}</td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground">{totalEvents}</td>
                  <td className="px-4 py-3 text-right">
                    <PayBadge sharePercent={c.elizaPay?.sharePercent ?? 0} />
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                    {formatRelativeTime(c.lastActiveAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden divide-y divide-border">
        {contributors.map((c) => (
          <Link
            key={c.username}
            href={`/contributor/${c.username}`}
            className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
          >
            <span className="text-xs text-muted-foreground font-mono w-6">{c.elizaEffect.rank}</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.avatarUrl} alt="" className="h-8 w-8 rounded-full border border-border bg-muted" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{c.username}</div>
              <div className="flex items-center gap-2 mt-1">
                <EffectBar
                  score={c.elizaEffect.total}
                  github={c.elizaEffect.github.total}
                  social={c.elizaEffect.social.total}
                />
              </div>
            </div>
            <PayBadge sharePercent={c.elizaPay?.sharePercent ?? 0} />
          </Link>
        ))}
      </div>
    </div>
  );
}
