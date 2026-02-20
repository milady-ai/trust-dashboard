import trustData from "@/data/trust-scores.json";
import {
  type ContributorData,
  type TrustStats,
  getTierConfig,
  getTierForScore,
  type TrustTier,
} from "./trust-scoring";

interface RawContributor {
  username?: string;
  avatarUrl?: string;
  trustScore?: number;
  tier?: TrustTier;
  tierInfo?: { label?: TrustTier };
  breakdown?: ContributorData["breakdown"];
  currentStreak?: { type: "approve" | "negative" | null; length: number };
  currentStreakType?: "approve" | "negative" | null;
  currentStreakLength?: number;
  totalApprovals?: number;
  totalRejections?: number;
  totalCloses?: number;
  totalSelfCloses?: number;
  totalReviews?: number;
  totalIssues?: number;
  totalComments?: number;
  isAgent?: boolean;
  characterClass?: string;
  badges?: ContributorData["badges"];
  tags?: ContributorData["tags"];
  totalLevel?: number;
  totalXp?: number;
  lastEventAt?: string | null;
  firstSeenAt?: string;
  walletAddress?: string | null;
  autoMergeEligible?: boolean;
  events?: ContributorData["events"];
  scoreHistory?: ContributorData["scoreHistory"];
  warnings?: string[];
}

function normalizeContributors(raw: RawContributor[]): ContributorData[] {
  return raw.map((contributor) => {
    const tierLabel = contributor.tier ?? contributor.tierInfo?.label ?? getTierForScore(contributor.trustScore ?? 0).label;
    const tier = getTierConfig(tierLabel);

    const currentStreak = contributor.currentStreak ?? {
      type: contributor.currentStreakType ?? null,
      length: contributor.currentStreakLength ?? 0,
    };

    const breakdown = contributor.breakdown ?? {
      rawPoints: 0,
      diminishingFactor: 0,
      recencyWeightedPoints: 0,
      streakMultiplier: 1,
      velocityPenalty: 0,
      inactivityDecay: 0,
      manualAdjustment: 0,
      eventDetails: [],
    };

    return {
      username: contributor.username ?? "unknown",
      avatarUrl: contributor.avatarUrl ?? `https://github.com/${contributor.username ?? "ghost"}.png`,
      trustScore: contributor.trustScore ?? 0,
      tier,
      tierInfo: tier,
      breakdown,
      currentStreak,
      currentStreakType: currentStreak.type === "approve" ? "approve" : currentStreak.type ? "negative" : null,
      currentStreakLength: currentStreak.length,
      totalApprovals: contributor.totalApprovals ?? 0,
      totalRejections: contributor.totalRejections ?? 0,
      totalCloses: contributor.totalCloses ?? 0,
      totalSelfCloses: contributor.totalSelfCloses ?? 0,
      totalReviews: contributor.totalReviews ?? 0,
      totalIssues: contributor.totalIssues ?? 0,
      totalComments: contributor.totalComments ?? 0,
      isAgent: contributor.isAgent ?? false,
      characterClass: (contributor.characterClass as ContributorData["characterClass"]) ?? "anon",
      badges: contributor.badges ?? [],
      tags: contributor.tags ?? [],
      totalLevel: contributor.totalLevel ?? 0,
      totalXp: contributor.totalXp ?? 0,
      lastEventAt: contributor.lastEventAt ?? null,
      firstSeenAt: contributor.firstSeenAt ?? new Date().toISOString(),
      walletAddress: contributor.walletAddress ?? null,
      autoMergeEligible: contributor.autoMergeEligible ?? tier.autoMerge,
      events: contributor.events ?? [],
      scoreHistory: contributor.scoreHistory ?? [],
      warnings: contributor.warnings ?? [],
    };
  });
}

export function getContributors(): ContributorData[] {
  const raw = (trustData.contributors ?? []) as unknown as RawContributor[];
  return normalizeContributors(raw);
}

export function getStats(): TrustStats {
  return trustData.stats as TrustStats;
}

export function getGeneratedAt(): string {
  return trustData.generatedAt;
}

// Backward-compatible aliases
export const loadContributors = getContributors;
export const loadStats = getStats;
