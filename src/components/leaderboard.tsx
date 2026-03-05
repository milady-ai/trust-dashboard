"use client";

import Link from "next/link";
import type { Contributor } from "@/lib/types";
import { formatRelativeTime } from "@/lib/utils";
import { getTierColor } from "@/lib/hierarchy";

interface LeaderboardProps {
  contributors: Contributor[];
}

function RankCell({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-sm font-bold text-eliza-gold">1</span>;
  if (rank === 2) return <span className="text-sm font-bold text-slate-300">2</span>;
  if (rank === 3) return <span className="text-sm font-bold text-amber-600">3</span>;
  return <span className="text-xs text-muted-foreground font-mono">{rank}</span>;
}

function EffectBar({ score, github, social, maxScore }: { score: number; github: number; social: number; maxScore: number }) {
  const fillPct = maxScore > 0 ? Math.min(100, (score / maxScore) * 100) : 0;
  const total = github + social;
  const githubShare = total > 0 ? (github / total) * 100 : 100;

  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full flex rounded-full overflow-hidden transition-all duration-500" style={{ width: `${fillPct}%` }}>
          <div className="h-full bg-github" style={{ width: `${githubShare}%` }} />
          {social > 0 && <div className="h-full bg-social" style={{ width: `${100 - githubShare}%` }} />}
        </div>
      </div>
      <span className="text-sm font-mono font-bold w-10 text-right">{score.toFixed(1)}</span>
    </div>
  );
}

function TierBadge({ tier, label }: { tier: string; label: string }) {
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wide ${getTierColor(tier as "core" | "active" | "contributor" | "emerging" | "new")}`}>
      {label}
    </span>
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

  const maxScore = contributors.reduce((max, c) => Math.max(max, c.elizaEffect.total), 0);

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
              <th className="px-4 py-3 text-right">Lines</th>
              <th className="px-4 py-3 text-right">elizaPay</th>
              <th className="px-4 py-3 text-right">Last Active</th>
            </tr>
          </thead>
          <tbody>
            {contributors.map((c) => {
              const totalMerged = c.githubEvents.filter((e) => e.type === "pr_merged").length;
              const totalLines = c.githubEvents
                .filter((e) => e.type === "pr_merged")
                .reduce((sum, e) => sum + (e.linesChanged ?? 0), 0);
              const tier = c.hierarchy?.tier ?? "new";
              const tierLabel = c.hierarchy?.tierLabel ?? "New";
              const isTop3 = c.elizaEffect.rank <= 3;

              return (
                <tr key={c.username} className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${isTop3 ? "bg-muted/20" : ""}`}>
                  <td className="px-4 py-3 text-center">
                    <RankCell rank={c.elizaEffect.rank} />
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/contributor/${c.username}`} className="flex items-center gap-3 hover:text-accent transition-colors">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={c.avatarUrl} alt="" className={`h-8 w-8 rounded-full border bg-muted ${isTop3 ? "border-eliza-gold/40 ring-1 ring-eliza-gold/20" : "border-border"}`} />
                      <div className="flex flex-col">
                        <span className="font-medium">{c.username}</span>
                        <TierBadge tier={tier} label={tierLabel} />
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <EffectBar
                      score={c.elizaEffect.total}
                      github={c.elizaEffect.github.total}
                      social={c.elizaEffect.social.total}
                      maxScore={maxScore}
                    />
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground">{totalMerged}</td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground text-xs">{totalLines >= 1000 ? `${(totalLines / 1000).toFixed(1)}k` : totalLines}</td>
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
        {contributors.map((c) => {
          const tier = c.hierarchy?.tier ?? "new";
          const tierLabel = c.hierarchy?.tierLabel ?? "New";
          const isTop3 = c.elizaEffect.rank <= 3;

          return (
            <Link
              key={c.username}
              href={`/contributor/${c.username}`}
              className={`flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors ${isTop3 ? "bg-muted/20" : ""}`}
            >
              <div className="w-6 text-center">
                <RankCell rank={c.elizaEffect.rank} />
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.avatarUrl} alt="" className={`h-8 w-8 rounded-full border bg-muted ${isTop3 ? "border-eliza-gold/40" : "border-border"}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{c.username}</span>
                  <TierBadge tier={tier} label={tierLabel} />
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <EffectBar
                    score={c.elizaEffect.total}
                    github={c.elizaEffect.github.total}
                    social={c.elizaEffect.social.total}
                    maxScore={maxScore}
                  />
                </div>
              </div>
              <PayBadge sharePercent={c.elizaPay?.sharePercent ?? 0} />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
