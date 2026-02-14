/**
 * Trust scoring types and utilities for the dashboard.
 * Mirrors the trust-scoring.js algorithm from milady-ai/milaidy.
 */

export type TrustTier =
  | "legendary"
  | "trusted"
  | "established"
  | "contributing"
  | "probationary"
  | "untested"
  | "restricted";

export type EventType = "approve" | "reject" | "close" | "selfClose";

export interface TierConfig {
  minScore: number;
  label: TrustTier;
  description: string;
  color: string;
  bg: string;
  icon: string;
  autoMerge: boolean;
}

export const TIERS: TierConfig[] = [
  { minScore: 90, label: "legendary", description: "Elite contributor, auto-merge eligible", color: "#F59E0B", bg: "#78350F", icon: "👑", autoMerge: true },
  { minScore: 75, label: "trusted", description: "Highly trusted, expedited review", color: "#10B981", bg: "#064E3B", icon: "✅", autoMerge: false },
  { minScore: 60, label: "established", description: "Proven track record", color: "#3B82F6", bg: "#1E3A5F", icon: "🔷", autoMerge: false },
  { minScore: 45, label: "contributing", description: "Active contributor, standard review", color: "#06B6D4", bg: "#164E63", icon: "🔧", autoMerge: false },
  { minScore: 30, label: "probationary", description: "Building trust, closer scrutiny", color: "#F97316", bg: "#7C2D12", icon: "⚡", autoMerge: false },
  { minScore: 15, label: "untested", description: "New or low-activity contributor", color: "#6B7280", bg: "#1F2937", icon: "❓", autoMerge: false },
  { minScore: 0, label: "restricted", description: "Trust deficit, requires sponsor review", color: "#EF4444", bg: "#7F1D1D", icon: "🚫", autoMerge: false },
];

export function getTierForScore(score: number): TierConfig {
  for (const tier of TIERS) {
    if (score >= tier.minScore) return tier;
  }
  return TIERS[TIERS.length - 1];
}

export function getNextTier(score: number): TierConfig | null {
  const current = getTierForScore(score);
  const idx = TIERS.indexOf(current);
  return idx > 0 ? TIERS[idx - 1] : null;
}

export function getPointsToNextTier(score: number): number | null {
  const next = getNextTier(score);
  if (!next) return null;
  return Math.ceil(next.minScore - score);
}

export interface ContributorData {
  username: string;
  avatarUrl: string;
  trustScore: number;
  tier: TierConfig;
  currentStreakType: "approve" | "negative" | null;
  currentStreakLength: number;
  totalApprovals: number;
  totalRejections: number;
  totalCloses: number;
  lastEventAt: string | null;
  firstSeenAt: string;
  walletAddress: string | null;
  autoMergeEligible: boolean;
}

export interface TrustEvent {
  id: number;
  type: EventType;
  prNumber: number;
  prTitle: string;
  linesChanged: number;
  labels: string[];
  complexityBucket: string;
  weightedPoints: number;
  finalPoints: number;
  timestamp: number;
}
