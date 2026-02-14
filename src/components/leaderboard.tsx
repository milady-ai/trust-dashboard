import { ContributorData, getPointsToNextTier } from "@/lib/trust-scoring";
import { formatRelativeTime } from "@/lib/utils";
import { TierBadge } from "./tier-badge";
import { ScoreBar } from "./score-bar";
import { StreakIndicator } from "./streak-indicator";

interface LeaderboardProps {
  contributors: ContributorData[];
}

export function Leaderboard({ contributors }: LeaderboardProps) {
  const sorted = [...contributors].sort((a, b) => b.trustScore - a.trustScore);

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      {/* Header */}
      <div className="grid grid-cols-[3rem_1fr_auto_10rem_5rem_5rem_6rem] items-center gap-2 border-b border-border bg-muted/50 px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        <span>#</span>
        <span>Contributor</span>
        <span>Tier</span>
        <span>Trust Score</span>
        <span className="text-center">Streak</span>
        <span className="text-center">PRs</span>
        <span className="text-right">Last Active</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-border">
        {sorted.map((contributor, index) => (
          <LeaderboardRow
            key={contributor.username}
            contributor={contributor}
            rank={index + 1}
          />
        ))}
      </div>
    </div>
  );
}

interface LeaderboardRowProps {
  contributor: ContributorData;
  rank: number;
}

function LeaderboardRow({ contributor, rank }: LeaderboardRowProps) {
  const pointsToNext = getPointsToNextTier(contributor.trustScore);
  const totalPRs = contributor.totalApprovals + contributor.totalRejections + contributor.totalCloses;
  const approvalRate = totalPRs > 0
    ? Math.round((contributor.totalApprovals / totalPRs) * 100)
    : 0;

  return (
    <div className="grid grid-cols-[3rem_1fr_auto_10rem_5rem_5rem_6rem] items-center gap-2 px-4 py-3 hover:bg-muted/30 transition-colors">
      {/* Rank */}
      <span className="text-sm font-mono text-muted-foreground">
        {rank <= 3 ? ["🥇", "🥈", "🥉"][rank - 1] : rank}
      </span>

      {/* Username + info */}
      <div className="flex items-center gap-3 min-w-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={contributor.avatarUrl}
          alt={contributor.username}
          className="h-8 w-8 rounded-full bg-muted flex-shrink-0"
          loading="lazy"
        />
        <div className="min-w-0">
          <div className="font-medium text-sm truncate">
            {contributor.username}
            {contributor.autoMergeEligible && (
              <span className="ml-1.5 text-xs text-tier-legendary" title="Auto-merge eligible">⚡</span>
            )}
          </div>
          {pointsToNext !== null && (
            <div className="text-xs text-muted-foreground">
              {pointsToNext} pts to next tier
            </div>
          )}
        </div>
      </div>

      {/* Tier badge */}
      <TierBadge tier={contributor.tier} size="sm" />

      {/* Score bar */}
      <ScoreBar score={contributor.trustScore} tier={contributor.tier} />

      {/* Streak */}
      <div className="text-center">
        <StreakIndicator
          type={contributor.currentStreakType}
          length={contributor.currentStreakLength}
        />
      </div>

      {/* PRs */}
      <div className="text-center text-sm">
        <span className="font-mono">{totalPRs}</span>
        {totalPRs > 0 && (
          <span className="text-xs text-muted-foreground ml-0.5">
            ({approvalRate}%)
          </span>
        )}
      </div>

      {/* Last active */}
      <div className="text-right text-xs text-muted-foreground">
        {formatRelativeTime(contributor.lastEventAt)}
      </div>
    </div>
  );
}
