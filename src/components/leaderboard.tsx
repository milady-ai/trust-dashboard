import Link from "next/link";
import { ContributorData, getApprovalRate, getPointsToNextTier, getTotalPRs } from "@/lib/trust-scoring";
import { daysSince, formatRelativeTime } from "@/lib/utils";
import { TierBadge } from "./tier-badge";
import { ScoreBar } from "./score-bar";
import { StreakIndicator } from "./streak-indicator";

interface LeaderboardProps {
  contributors: ContributorData[];
}

export function Leaderboard({ contributors }: LeaderboardProps) {
  return (
    <>
      <div className="hidden md:block overflow-hidden rounded-lg border border-border">
        <div className="grid grid-cols-[3rem_1fr_auto_11rem_6rem_7rem_7rem] items-center gap-2 border-b border-border bg-muted/50 px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          <span>#</span>
          <span>Contributor</span>
          <span>Tier</span>
          <span>Trust Score</span>
          <span className="text-center">Streak</span>
          <span className="text-center">PRs</span>
          <span className="text-right">Last Active</span>
        </div>

        <div className="divide-y divide-border">
          {contributors.map((contributor, index) => (
            <DesktopRow key={contributor.username} contributor={contributor} rank={index + 1} />
          ))}
        </div>
      </div>

      <div className="md:hidden grid gap-3">
        {contributors.map((contributor, index) => (
          <MobileCard key={contributor.username} contributor={contributor} rank={index + 1} />
        ))}
      </div>
    </>
  );
}

function DesktopRow({ contributor, rank }: { contributor: ContributorData; rank: number }) {
  const pointsToNext = getPointsToNextTier(contributor.trustScore);
  const totalPRs = getTotalPRs(contributor);
  const approvalRate = Math.round(getApprovalRate(contributor));
  const joinedDays = daysSince(contributor.firstSeenAt);
  const isNew = joinedDays <= 30;

  return (
    <Link
      href={`/contributor/${contributor.username}`}
      className="grid grid-cols-[3rem_1fr_auto_11rem_6rem_7rem_7rem] items-center gap-2 px-4 py-3 hover:bg-muted/30 transition-colors"
    >
      <span className="text-sm font-mono text-muted-foreground">
        {rank <= 3 ? ["🥇", "🥈", "🥉"][rank - 1] : rank}
      </span>

      <div className="flex items-center gap-3 min-w-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://github.com/${contributor.username}.png`}
          alt={contributor.username}
          className="h-8 w-8 rounded-full bg-muted flex-shrink-0"
          loading="lazy"
        />
        <div className="min-w-0">
          <div className="font-medium text-sm truncate">{contributor.username}</div>
          <div className="text-xs text-muted-foreground">
            {pointsToNext !== null ? `${pointsToNext} pts to next tier` : "Top tier"}
            {isNew ? ` • joined ${joinedDays}d ago` : ""}
          </div>
        </div>
      </div>

      <TierBadge tier={contributor.tier} size="sm" />

      <div
        title={`Approvals: ${contributor.totalApprovals}, Rejections: ${contributor.totalRejections}, Closes: ${contributor.totalCloses}, Self-closes: ${contributor.totalSelfCloses}`}
      >
        <ScoreBar score={contributor.trustScore} tier={contributor.tier} />
      </div>

      <div className="text-center">
        <StreakIndicator type={contributor.currentStreak.type} length={contributor.currentStreak.length} />
      </div>

      <div className="text-center text-sm">
        <span className="font-mono">{totalPRs}</span>
        {totalPRs > 0 && <span className="text-xs text-muted-foreground ml-0.5">({approvalRate}%)</span>}
      </div>

      <div className="text-right text-xs text-muted-foreground">{formatRelativeTime(contributor.lastEventAt)}</div>
    </Link>
  );
}

function MobileCard({ contributor, rank }: { contributor: ContributorData; rank: number }) {
  const approvalRate = Math.round(getApprovalRate(contributor));

  return (
    <Link
      href={`/contributor/${contributor.username}`}
      className="rounded-lg border border-border bg-card p-3 hover:bg-muted/30 transition-colors"
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://github.com/${contributor.username}.png`}
            alt={contributor.username}
            className="h-9 w-9 rounded-full bg-muted"
            loading="lazy"
          />
          <div className="min-w-0">
            <div className="font-medium text-sm truncate">{rank}. {contributor.username}</div>
            <div className="text-xs text-muted-foreground">{formatRelativeTime(contributor.lastEventAt)}</div>
          </div>
        </div>
        <TierBadge tier={contributor.tier} size="sm" />
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <div className="text-muted-foreground">Score</div>
          <div className="font-mono font-semibold">{contributor.trustScore.toFixed(1)}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Streak</div>
          <div><StreakIndicator type={contributor.currentStreak.type} length={contributor.currentStreak.length} /></div>
        </div>
        <div>
          <div className="text-muted-foreground">Approval</div>
          <div className="font-mono font-semibold">{approvalRate}%</div>
        </div>
      </div>
    </Link>
  );
}
