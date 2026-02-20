import Link from "next/link";
import trustScoresData from "@/data/trust-scores.json";
import { EventTimeline } from "@/components/contributor/event-timeline";
import { ScoreBreakdownViz } from "@/components/contributor/score-breakdown";
import { ScoreSparkline } from "@/components/contributor/score-sparkline";
import { VelocityGauge } from "@/components/contributor/velocity-gauge";
import { BadgeDisplay } from "@/components/badge-display";
import { TagDisplay } from "@/components/tag-display";
import { CharacterClassBadge } from "@/components/character-class";
import type { ContributorProfile, TrustScoresDataFile } from "@/lib/contributor-types";
import type { EarnedBadge } from "@/lib/badges";
import type { CharacterClass, TagScore } from "@/lib/levels";
import { TIERS, getNextTier, getPointsToNextTier, getTierForScore } from "@/lib/trust-scoring";

function normalizeData(input: unknown): ContributorProfile[] {
  if (Array.isArray(input)) return input as ContributorProfile[];

  const maybeDataFile = input as Partial<TrustScoresDataFile>;
  if (maybeDataFile && Array.isArray(maybeDataFile.contributors)) {
    return maybeDataFile.contributors;
  }

  return [];
}

/** Safely access new fields that may not exist in older JSON data */
function safeProfile(p: ContributorProfile) {
  return {
    totalReviews: p.totalReviews ?? 0,
    totalIssues: p.totalIssues ?? 0,
    totalComments: p.totalComments ?? 0,
    isAgent: p.isAgent ?? false,
    characterClass: (p.characterClass ?? "anon") as CharacterClass,
    badges: (p.badges ?? []) as EarnedBadge[],
    tags: (p.tags ?? []) as TagScore[],
    totalLevel: p.totalLevel ?? 0,
    totalXp: p.totalXp ?? 0,
  };
}

function normalizeTimestamp(ts: number): number {
  return ts < 1_000_000_000_000 ? ts * 1000 : ts;
}

function formatPct(value: number): string {
  return `${Math.max(0, value).toFixed(1)}%`;
}

function estimateDaysToNextTier(profile: ContributorProfile): string {
  const pointsNeeded = getPointsToNextTier(profile.trustScore);
  if (!pointsNeeded || profile.scoreHistory.length < 2) return "At top tier";

  const history = [...profile.scoreHistory].sort((a, b) => a.timestamp - b.timestamp).slice(-10);
  const first = history[0];
  const last = history[history.length - 1];
  const deltaScore = last.score - first.score;
  const elapsedDays = Math.max(1, (normalizeTimestamp(last.timestamp) - normalizeTimestamp(first.timestamp)) / 86_400_000);
  const ratePerDay = deltaScore / elapsedDays;

  if (ratePerDay <= 0.05) return "Trend too flat to estimate";

  const days = Math.ceil(pointsNeeded / ratePerDay);
  if (days < 1) return "< 1 day at current pace";
  return `${days} days at current pace`;
}

export const dynamicParams = false;

export async function generateStaticParams(): Promise<Array<{ username: string }>> {
  const contributors = normalizeData(trustScoresData);
  return contributors.map((contributor) => ({ username: contributor.username }));
}

export default async function ContributorDetailPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const contributors = normalizeData(trustScoresData);

  const sorted = [...contributors].sort((a, b) => b.trustScore - a.trustScore);
  const profile = contributors.find((entry) => entry.username.toLowerCase() === username.toLowerCase());

  if (!profile) {
    return (
      <div className="mx-auto max-w-3xl rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">Leaderboard &gt; {username}</p>
        <h2 className="mt-2 text-2xl font-bold">Contributor not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">We couldn&apos;t find a contributor with that username.</p>
        <Link href="/" className="mt-4 inline-block text-accent hover:underline">&larr; Back to Leaderboard</Link>
      </div>
    );
  }

  const safe = safeProfile(profile);
  const tier = getTierForScore(profile.trustScore);
  const rank = sorted.findIndex((entry) => entry.username === profile.username) + 1;
  const total = sorted.length;
  const totalPRs = profile.totalApprovals + profile.totalRejections + profile.totalCloses;
  const approvalRate = totalPRs > 0 ? (profile.totalApprovals / totalPRs) * 100 : 0;
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weeklyVelocity = profile.events.filter((event) => normalizeTimestamp(event.timestamp) >= weekAgo).length;

  const nextTier = getNextTier(profile.trustScore);
  const pointsToNext = getPointsToNextTier(profile.trustScore);
  const tierMin = tier.minScore;
  const tierMax = nextTier ? nextTier.minScore : 100;
  const tierProgress = Math.min(100, Math.max(0, ((profile.trustScore - tierMin) / Math.max(1, tierMax - tierMin)) * 100));

  const streakText = profile.currentStreakType === "approve"
    ? `${"🔥".repeat(Math.min(5, profile.currentStreakLength))}${profile.currentStreakLength > 5 ? ` ×${profile.currentStreakLength}` : ""}`
    : profile.currentStreakType === "negative"
      ? `${"⚠️".repeat(Math.min(3, profile.currentStreakLength))}${profile.currentStreakLength > 3 ? ` ×${profile.currentStreakLength}` : ""}`
      : "No active streak";

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="space-y-2">
        <Link href="/" className="inline-block text-sm text-accent hover:underline">&larr; Back to Leaderboard</Link>
        <div className="text-xs text-muted-foreground">Leaderboard &gt; {profile.username}</div>
      </div>

      {/* Hero section */}
      <section className="rounded-xl border border-border bg-card p-4 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={profile.avatarUrl} alt={profile.username} className="h-16 w-16 rounded-full border border-border bg-muted" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-bold">@{profile.username}</h1>
                {safe.isAgent && <span className="text-lg" title="Agent/Bot">🤖</span>}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm text-muted-foreground">Rank #{rank} of {total}</p>
                <CharacterClassBadge characterClass={safe.characterClass} size="sm" />
              </div>
              {profile.autoMergeEligible && (
                <span className="mt-2 inline-flex rounded-full border border-tier-legendary/40 px-2.5 py-1 text-xs text-tier-legendary">
                  Auto-merge eligible
                </span>
              )}
            </div>
          </div>

          <div className="text-left md:text-right">
            <span
              className="inline-flex items-center rounded-full border px-3 py-1 text-sm capitalize"
              style={{ borderColor: `${tier.color}66`, color: tier.color, backgroundColor: `${tier.bg}` }}
            >
              {tier.icon} {tier.label}
            </span>
            <div className="mt-2 text-4xl font-bold font-mono" style={{ color: tier.color }}>
              {profile.trustScore.toFixed(1)}
            </div>
            <div className="text-xs text-muted-foreground">Trust score (0-100)</div>
          </div>
        </div>
      </section>

      {/* Stats cards */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <InfoCard label="Current Score" value={profile.trustScore.toFixed(1)} subtitle={`${tier.label} tier`} accent={tier.color} />
        <InfoCard label="Total Level" value={String(safe.totalLevel)} subtitle={`${safe.totalXp.toLocaleString()} XP`} />
        <InfoCard label="Approval Rate" value={formatPct(approvalRate)} subtitle={`${profile.totalApprovals}/${totalPRs || 0} approvals`} />
        <InfoCard label="Current Streak" value={streakText} subtitle={profile.currentStreakType ? `${profile.currentStreakType} streak` : "No streak"} />
        <InfoCard label="Weekly Velocity" value={`${weeklyVelocity}/10`} subtitle="soft cap per week" />
      </section>

      {/* Badges */}
      <section className="rounded-xl border border-border bg-card p-4 md:p-5">
        <h3 className="text-lg font-semibold mb-3">Badges</h3>
        <BadgeDisplay badges={safe.badges} />
      </section>

      {/* Tags & Levels */}
      <section className="rounded-xl border border-border bg-card p-4 md:p-5">
        <h3 className="text-lg font-semibold mb-3">Tags & Levels</h3>
        <TagDisplay tags={safe.tags} />
      </section>

      {/* Activity stats */}
      {(safe.totalReviews > 0 || safe.totalIssues > 0 || safe.totalComments > 0) && (
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <InfoCard label="Reviews Given" value={String(safe.totalReviews)} subtitle="PR reviews" />
          <InfoCard label="Issues" value={String(safe.totalIssues)} subtitle="issues created/closed" />
          <InfoCard label="Comments" value={String(safe.totalComments)} subtitle="issue & PR comments" />
        </section>
      )}

      <ScoreBreakdownViz breakdown={profile.breakdown} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <ScoreSparkline history={profile.scoreHistory} />
        <VelocityGauge weeklyCount={weeklyVelocity} softCap={10} hardCap={25} />
      </div>

      {/* Next Tier Progress */}
      <section className="rounded-xl border border-border bg-card p-4 md:p-5">
        <h3 className="text-lg font-semibold mb-3">Next Tier Progress</h3>
        {nextTier && pointsToNext !== null ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground capitalize">{tier.label} &rarr; {nextTier.label}</span>
              <span className="font-mono">{pointsToNext.toFixed(1)} points needed</span>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full" style={{ width: `${tierProgress}%`, backgroundColor: tier.color }} />
            </div>
            <div className="mt-2 text-xs text-muted-foreground">Est. {estimateDaysToNextTier(profile)}</div>
          </>
        ) : (
          <div className="text-sm text-tier-legendary">Top tier reached. No higher tier available.</div>
        )}
      </section>

      <EventTimeline username={profile.username} events={profile.events} eventDetails={profile.breakdown.eventDetails} />

      <section className="text-center text-xs text-muted-foreground pb-3">
        Tier thresholds: {TIERS.map((tierLine) => `${tierLine.label} ${tierLine.minScore}+`).join(" · ")}
      </section>
    </div>
  );
}

function InfoCard({
  label,
  value,
  subtitle,
  accent,
}: {
  label: string;
  value: string;
  subtitle: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-xl font-bold font-mono" style={accent ? { color: accent } : undefined}>{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>
    </div>
  );
}
