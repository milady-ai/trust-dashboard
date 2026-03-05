// ---------------------------------------------------------------------------
// elizaEffect — Combined Scoring & elizaPay Distribution
// ---------------------------------------------------------------------------
// Combines GitHub contribution score and social impact score into a single
// elizaEffect score per contributor, then computes quadratic elizaPay shares
// and assigns hierarchy positioning.

import type {
  Contributor,
  ElizaEffectConfig,
  ElizaEffectScore,
  ElizaPayDistribution,
  ElizaPayShare,
  GitHubEvent,
  OnChainExport,
  OnChainRecipient,
  ChainTarget,
  Project,
  ProjectStats,
  SocialPost,
} from "./types";
import { computeGitHubScore, convertLegacyEvent, setReferenceTime } from "./github-scoring";
import { computeSocialScore, setSocialReferenceTime } from "./social-scoring";
import { assignHierarchy } from "./hierarchy";

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
  projectId: string,
  totalPool?: number,
  generatedAt?: string,
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
    projectId,
    totalPool,
    shares,
    generatedAt: generatedAt || new Date().toISOString(),
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
      total > 1 ? Math.round(((total - (i + 1)) / total) * 100) : 100;
  }
}

// ---- On-Chain Export Generation ---------------------------------------------

export function generateOnChainExport(
  project: Project,
  chainTarget: ChainTarget,
  tokenAddress?: string,
  totalPool?: number,
): OnChainExport {
  const recipients: OnChainRecipient[] = project.contributors.map((c) => ({
    username: c.username,
    walletAddress: undefined,
    elizaEffect: c.elizaEffect.total,
    sharePercent: c.elizaPay?.sharePercent ?? 0,
    estimatedPayout: totalPool && c.elizaPay
      ? Math.round((c.elizaPay.sharePercent / 100) * totalPool * 100) / 100
      : undefined,
    rank: c.elizaEffect.rank,
    tier: c.hierarchy?.tier ?? "new",
  }));

  return {
    chainTarget,
    projectId: project.id,
    projectName: project.name,
    tokenAddress,
    totalPool,
    generatedAt: project.generatedAt,
    recipients,
  };
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
  // Pin scoring to the data generation timestamp so scores don't go stale in static builds
  const refTime = generatedAt ? new Date(generatedAt).getTime() : Date.now();
  setReferenceTime(refTime);
  setSocialReferenceTime(refTime);

  const contributors: Contributor[] = rawContributors.map((raw) => {
    const githubEvents = raw.events.map(convertLegacyEvent);
    const socialPosts: SocialPost[] = [];
    const referralCount = 0;

    const elizaEffect = computeElizaEffect(githubEvents, socialPosts, referralCount, config);

    return {
      username: raw.username,
      avatarUrl: raw.avatarUrl ?? `https://github.com/${raw.username}.png`,
      githubEvents,
      socialPosts,
      socialProfiles: [],
      referralCount,
      firstSeenAt: raw.firstSeenAt ?? (generatedAt || new Date().toISOString()),
      lastActiveAt: raw.lastEventAt ?? null,
      elizaEffect,
    };
  });

  assignRanks(contributors);

  // Assign hierarchy tiers and roles
  assignHierarchy(contributors, config.projectId);

  // Compute elizaPay shares
  const payData = computeElizaPay(
    contributors.map((c) => ({ username: c.username, elizaEffect: c.elizaEffect.total })),
    config.projectId,
    undefined,
    generatedAt,
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
