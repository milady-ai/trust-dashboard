// ---------------------------------------------------------------------------
// elizaEffect — Combined Scoring & elizaPay Distribution
// ---------------------------------------------------------------------------
// Combines GitHub contribution score and social impact score into a single
// elizaEffect score per contributor, then computes quadratic elizaPay shares.

import type {
  Contributor,
  ElizaEffectConfig,
  ElizaEffectScore,
  ElizaPayDistribution,
  ElizaPayShare,
  GitHubEvent,
  Project,
  ProjectStats,
  SocialPost,
} from "./types";
import { computeGitHubScore, convertLegacyEvent } from "./github-scoring";
import { computeSocialScore } from "./social-scoring";

// ---- Default Config ---------------------------------------------------------

export const DEFAULT_CONFIG: ElizaEffectConfig = {
  githubWeight: 0.6,
  socialWeight: 0.4,
  projectId: "milaidy",
  projectName: "milaidy",
  repoFullName: "milady-ai/milaidy",
};

// ---- elizaEffect Score ------------------------------------------------------

export function computeElizaEffect(
  githubEvents: GitHubEvent[],
  socialPosts: SocialPost[],
  referralCount: number,
  config: ElizaEffectConfig,
): ElizaEffectScore {
  const github = computeGitHubScore(githubEvents);
  const social = computeSocialScore(socialPosts, referralCount);

  const total = Math.round(
    (github.total * config.githubWeight + social.total * config.socialWeight) * 10,
  ) / 10;

  return {
    total,
    github,
    social,
    rank: 0,      // assigned after all contributors are scored
    percentile: 0, // assigned after all contributors are scored
  };
}

// ---- elizaPay Quadratic Distribution ----------------------------------------

export function computeElizaPay(
  contributors: Array<{ username: string; elizaEffect: number }>,
  totalPool?: number,
): ElizaPayDistribution {
  const withSqrt = contributors.map((c) => ({
    username: c.username,
    elizaEffect: c.elizaEffect,
    sqrtScore: Math.sqrt(Math.max(0, c.elizaEffect)),
  }));

  const totalSqrt = withSqrt.reduce((sum, c) => sum + c.sqrtScore, 0);

  const shares: ElizaPayShare[] = withSqrt.map((c) => ({
    username: c.username,
    elizaEffect: c.elizaEffect,
    sqrtScore: Math.round(c.sqrtScore * 1000) / 1000,
    sharePercent: totalSqrt > 0
      ? Math.round((c.sqrtScore / totalSqrt) * 10000) / 100
      : 0,
    estimatedPayout: totalPool && totalSqrt > 0
      ? Math.round((c.sqrtScore / totalSqrt) * totalPool * 100) / 100
      : undefined,
  }));

  // Sort by share descending
  shares.sort((a, b) => b.sharePercent - a.sharePercent);

  return {
    projectId: DEFAULT_CONFIG.projectId,
    totalPool,
    shares,
    generatedAt: new Date().toISOString(),
  };
}

// ---- Assign Ranks & Percentiles ---------------------------------------------

function assignRanks(contributors: Contributor[]): void {
  const sorted = [...contributors].sort(
    (a, b) => b.elizaEffect.total - a.elizaEffect.total,
  );
  const total = sorted.length;

  for (let i = 0; i < sorted.length; i++) {
    sorted[i].elizaEffect.rank = i + 1;
    sorted[i].elizaEffect.percentile =
      total > 1 ? Math.round(((total - 1 - i) / (total - 1)) * 100) : 100;
  }
}

// ---- Build Full Project from Legacy Data ------------------------------------

export function buildProjectFromLegacyData(
  rawContributors: Array<{
    username: string;
    avatarUrl: string;
    totalApprovals: number;
    totalRejections: number;
    totalCloses: number;
    totalSelfCloses?: number;
    lastEventAt?: string | null;
    firstSeenAt?: string;
    events: Array<{
      type: string;
      timestamp: number;
      linesChanged?: number;
      labels?: string[];
      prNumber?: number;
    }>;
  }>,
  config: ElizaEffectConfig = DEFAULT_CONFIG,
  generatedAt?: string,
): Project {
  const contributors: Contributor[] = rawContributors.map((raw) => {
    const githubEvents = raw.events.map(convertLegacyEvent);
    const socialPosts: SocialPost[] = []; // no social data yet
    const referralCount = 0;

    const elizaEffect = computeElizaEffect(githubEvents, socialPosts, referralCount, config);

    return {
      username: raw.username,
      avatarUrl: raw.avatarUrl ?? `https://github.com/${raw.username}.png`,
      githubEvents,
      socialPosts,
      socialProfiles: [],
      referralCount,
      firstSeenAt: raw.firstSeenAt ?? new Date().toISOString(),
      lastActiveAt: raw.lastEventAt ?? null,
      elizaEffect,
    };
  });

  assignRanks(contributors);

  // Compute elizaPay shares
  const payData = computeElizaPay(
    contributors.map((c) => ({ username: c.username, elizaEffect: c.elizaEffect.total })),
  );
  for (const contributor of contributors) {
    contributor.elizaPay = payData.shares.find((s) => s.username === contributor.username);
  }

  // Sort by elizaEffect descending
  contributors.sort((a, b) => b.elizaEffect.total - a.elizaEffect.total);

  const stats: ProjectStats = {
    totalContributors: contributors.length,
    totalGitHubEvents: contributors.reduce((sum, c) => sum + c.githubEvents.length, 0),
    totalSocialPosts: contributors.reduce((sum, c) => sum + c.socialPosts.length, 0),
    avgElizaEffect: contributors.length > 0
      ? Math.round(
          (contributors.reduce((sum, c) => sum + c.elizaEffect.total, 0) / contributors.length) * 10,
        ) / 10
      : 0,
    topContributor: contributors[0]?.username ?? "—",
  };

  return {
    id: config.projectId,
    name: config.projectName,
    repoFullName: config.repoFullName,
    config,
    contributors,
    stats,
    generatedAt: generatedAt ?? new Date().toISOString(),
  };
}
