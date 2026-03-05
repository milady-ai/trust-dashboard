import Link from "next/link";
import type { ContributorProfile } from "@/lib/contributor-types";
import { formatRelativeTime } from "@/lib/utils";

interface LeaderboardProps {
  contributors: ContributorProfile[];
}

function getTotalPRs(c: ContributorProfile) {
  return c.totalApprovals + c.totalRejections + c.totalCloses + c.totalSelfCloses;
}

function getApprovalRate(c: ContributorProfile) {
  const total = getTotalPRs(c);
  return total > 0 ? Math.round((c.totalApprovals / total) * 100) : 0;
}

export function Leaderboard({ contributors }: LeaderboardProps) {
  return (
    <>
      <div className="hidden md:block overflow-hidden rounded-lg border border-border">
        <div className="grid grid-cols-[3rem_1fr_6rem_6rem_7rem] items-center gap-2 border-b border-border bg-muted/50 px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          <span>#</span>
          <span>Contributor</span>
          <span className="text-center">PRs</span>
          <span className="text-center">Approval</span>
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

function DesktopRow({ contributor, rank }: { contributor: ContributorProfile; rank: number }) {
  const totalPRs = getTotalPRs(contributor);
  const approvalRate = getApprovalRate(contributor);

  return (
    <Link
      href={`/contributor/${contributor.username}`}
      className="grid grid-cols-[3rem_1fr_6rem_6rem_7rem] items-center gap-2 px-4 py-3 hover:bg-muted/30 transition-colors"
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
        <div className="font-medium text-sm truncate">{contributor.username}</div>
      </div>

      <div className="text-center text-sm font-mono">{totalPRs}</div>

      <div className="text-center text-sm">
        {totalPRs > 0 && <span className="font-mono">{approvalRate}%</span>}
      </div>

      <div className="text-right text-xs text-muted-foreground">{formatRelativeTime(contributor.lastEventAt)}</div>
    </Link>
  );
}

function MobileCard({ contributor, rank }: { contributor: ContributorProfile; rank: number }) {
  const totalPRs = getTotalPRs(contributor);
  const approvalRate = getApprovalRate(contributor);

  return (
    <Link
      href={`/contributor/${contributor.username}`}
      className="rounded-lg border border-border bg-card p-3 hover:bg-muted/30 transition-colors"
    >
      <div className="flex items-center gap-2 mb-2">
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

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <div className="text-muted-foreground">PRs</div>
          <div className="font-mono font-semibold">{totalPRs}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Approval</div>
          <div className="font-mono font-semibold">{approvalRate}%</div>
        </div>
      </div>
    </Link>
  );
}
