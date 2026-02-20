/**
 * Badge system for Milaidy Trust Dashboard.
 * 5 badge types × 3 tiers, mapped to milaidy repo tags.
 */

export type BadgeTier = "acolyte" | "priestess" | "remilia";
export type BadgeType = "schizo-shipper" | "bug-priestess" | "oracle" | "streak-demon" | "ascended";

export interface BadgeDefinition {
  type: BadgeType;
  name: string;
  description: string;
  thresholds: Record<BadgeTier, number>;
  icon: string;
}

export interface EarnedBadge {
  type: BadgeType;
  tier: BadgeTier;
  name: string;
  icon: string;
  progress: number; // 0-1 toward next tier or 1.0 if max
  currentValue: number;
  nextThreshold: number | null;
}

export const BADGE_TIER_COLORS: Record<BadgeTier, { color: string; bg: string; border: string }> = {
  acolyte: { color: "#D97706", bg: "#78350F", border: "#D9770633" },
  priestess: { color: "#A1A1AA", bg: "#27272A", border: "#A1A1AA33" },
  remilia: { color: "#FACC15", bg: "#422006", border: "#FACC1533" },
};

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    type: "schizo-shipper",
    name: "Schizo Shipper",
    description: "Merged pull requests",
    thresholds: { acolyte: 5, priestess: 25, remilia: 100 },
    icon: "💊",
  },
  {
    type: "bug-priestess",
    name: "Bug Priestess",
    description: "Bugs fixed (issues with 'bug' or 'bugfix' label, closed)",
    thresholds: { acolyte: 3, priestess: 15, remilia: 50 },
    icon: "🔮",
  },
  {
    type: "oracle",
    name: "Oracle",
    description: "PR reviews given",
    thresholds: { acolyte: 10, priestess: 50, remilia: 200 },
    icon: "👁️",
  },
  {
    type: "streak-demon",
    name: "Streak Demon",
    description: "Longest consecutive active days",
    thresholds: { acolyte: 7, priestess: 30, remilia: 60 },
    icon: "🔥",
  },
  {
    type: "ascended",
    name: "Ascended",
    description: "Total level across all tags",
    thresholds: { acolyte: 10, priestess: 30, remilia: 50 },
    icon: "✦",
  },
];

const TIER_ORDER: BadgeTier[] = ["remilia", "priestess", "acolyte"];

export interface BadgeInput {
  mergedPRs: number;
  bugsClosed: number;
  reviewsGiven: number;
  longestStreak: number;
  totalLevel: number;
}

export function computeBadges(input: BadgeInput): EarnedBadge[] {
  const valueMap: Record<BadgeType, number> = {
    "schizo-shipper": input.mergedPRs,
    "bug-priestess": input.bugsClosed,
    oracle: input.reviewsGiven,
    "streak-demon": input.longestStreak,
    ascended: input.totalLevel,
  };

  return BADGE_DEFINITIONS.map((def) => {
    const value = valueMap[def.type];
    let earnedTier: BadgeTier | null = null;

    for (const tier of TIER_ORDER) {
      if (value >= def.thresholds[tier]) {
        earnedTier = tier;
        break;
      }
    }

    if (!earnedTier) {
      // Not yet earned — show progress toward acolyte
      return {
        type: def.type,
        tier: "acolyte" as BadgeTier,
        name: def.name,
        icon: def.icon,
        progress: Math.min(1, value / def.thresholds.acolyte),
        currentValue: value,
        nextThreshold: def.thresholds.acolyte,
      };
    }

    // Find next tier
    const tierIdx = TIER_ORDER.indexOf(earnedTier);
    const nextTier = tierIdx > 0 ? TIER_ORDER[tierIdx - 1] : null;
    const nextThreshold = nextTier ? def.thresholds[nextTier] : null;
    const progress = nextThreshold ? Math.min(1, value / nextThreshold) : 1;

    return {
      type: def.type,
      tier: earnedTier,
      name: def.name,
      icon: def.icon,
      progress,
      currentValue: value,
      nextThreshold,
    };
  });
}

export function isBadgeEarned(badge: EarnedBadge): boolean {
  return badge.currentValue >= (BADGE_DEFINITIONS.find((d) => d.type === badge.type)?.thresholds.acolyte ?? Infinity);
}
