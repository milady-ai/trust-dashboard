// ---------------------------------------------------------------------------
// elizaEffect — Core Type Definitions
// ---------------------------------------------------------------------------

// ---- GitHub Events & Scoring ------------------------------------------------

export type GitHubEventType = "pr_merged" | "pr_closed" | "pr_rejected" | "review_given" | "issue_closed";

export interface GitHubEvent {
  type: GitHubEventType;
  timestamp: number;          // ms epoch
  prNumber?: number;
  issueNumber?: number;
  linesChanged?: number;
  filesChanged?: number;
  labels?: string[];
  reviewType?: "approve" | "request_changes" | "comment";
}

export interface GitHubScore {
  total: number;              // 0–100
  prs: number;               // merged PRs (complexity-weighted)
  participation: number;      // reviews, closes, rejections (showing up)
  impact: number;             // depth of top contributions
  consistency: number;        // regular activity over time
}

// ---- Social Impact ----------------------------------------------------------

export type SocialPlatform = "farcaster" | "twitter" | "youtube" | "other";

export interface SocialPost {
  platform: SocialPlatform;
  url: string;
  timestamp: number;          // ms epoch
  likes: number;
  replies: number;
  reposts: number;
  isThread?: boolean;         // long-form content gets bonus
  isTutorial?: boolean;       // tutorial/educational content
  verified: boolean;          // has engagement been verified
}

export interface SocialProfile {
  platform: SocialPlatform;
  handle: string;
  followers?: number;         // informational only, not scored directly
}

export interface SocialScore {
  total: number;              // 0–100
  posts: number;              // points from project-related posts
  content: number;            // points from tutorials/threads (deep content)
  engagement: number;         // points from engagement received
  referrals: number;          // points from onboarding new contributors
}

// ---- elizaEffect (Combined Score) -------------------------------------------

export interface ElizaEffectConfig {
  githubWeight: number;       // default 0.6
  socialWeight: number;       // default 0.4
  projectId: string;
  projectName: string;
  repoFullName: string;       // e.g. "milady-ai/milaidy"
}

export interface ElizaEffectScore {
  total: number;              // 0–100 (weighted combination)
  github: GitHubScore;
  social: SocialScore;
  rank: number;               // 1-indexed position in project leaderboard
  percentile: number;         // 0–100
}

// ---- Hierarchy & Positioning ------------------------------------------------

export type HierarchyTier = "core" | "active" | "contributor" | "emerging" | "new";

export interface HierarchyPosition {
  tier: HierarchyTier;
  tierLabel: string;
  tierDescription: string;
  percentileMin: number;      // minimum percentile for this tier (0–100)
  projectRoles: ProjectRole[];
}

export interface ProjectRole {
  projectId: string;
  role: "lead" | "maintainer" | "contributor" | "participant";
  rank: number;
  elizaEffect: number;
}

// ---- elizaPay (Quadratic Distribution) --------------------------------------

export interface ElizaPayShare {
  username: string;
  elizaEffect: number;
  sqrtScore: number;
  sharePercent: number;       // percentage of total pool
  estimatedPayout?: number;   // if pool size is known
}

export interface ElizaPayDistribution {
  projectId: string;
  totalPool?: number;         // total token amount to distribute
  shares: ElizaPayShare[];
  generatedAt: string;
}

// ---- On-Chain Export --------------------------------------------------------

export type ChainTarget = "ethereum" | "solana" | "base" | "arbitrum";

export interface OnChainExport {
  chainTarget: ChainTarget;
  projectId: string;
  projectName: string;
  tokenAddress?: string;
  totalPool?: number;
  generatedAt: string;
  recipients: OnChainRecipient[];
}

export interface OnChainRecipient {
  username: string;
  walletAddress?: string;     // if linked
  elizaEffect: number;
  sharePercent: number;
  estimatedPayout?: number;
  rank: number;
  tier: HierarchyTier;
}

// ---- Contributor (per-project) ----------------------------------------------

export interface Contributor {
  username: string;
  avatarUrl: string;
  githubEvents: GitHubEvent[];
  socialPosts: SocialPost[];
  socialProfiles: SocialProfile[];
  referralCount: number;
  firstSeenAt: string;
  lastActiveAt: string | null;
  elizaEffect: ElizaEffectScore;
  elizaPay?: ElizaPayShare;
  hierarchy?: HierarchyPosition;
}

// ---- Project ----------------------------------------------------------------

export interface Project {
  id: string;
  name: string;
  repoFullName: string;
  config: ElizaEffectConfig;
  contributors: Contributor[];
  stats: ProjectStats;
  generatedAt: string;
}

export interface ProjectStats {
  totalContributors: number;
  totalGitHubEvents: number;
  totalSocialPosts: number;
  avgElizaEffect: number;
  topContributor: string;
}

