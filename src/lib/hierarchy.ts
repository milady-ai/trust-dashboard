// ---------------------------------------------------------------------------
// Hierarchy & Positioning — elizaEffect
// ---------------------------------------------------------------------------
// Determines contributor tiers, roles, and positioning based on elizaEffect.
//
// Tiers are based on percentile within a project:
//   core       — top 5%   (the people driving the project forward)
//   active     — top 20%  (reliable, consistent contributors)
//   contributor — top 50% (solid participants with real work)
//   emerging   — top 80%  (getting started, showing up)
//   new        — everyone else (first contributions)
//
// Roles within a project are assigned based on rank:
//   lead       — rank 1-2  (top 2 contributors)
//   maintainer — rank 3-5  (core team)
//   contributor — rank 6+  (everyone contributing)
//   participant — anyone with < 5 elizaEffect (minimal activity)

import type {
  Contributor,
  HierarchyTier,
  ProjectRole,
} from "./types";

// ---- Tier Definitions -------------------------------------------------------

interface TierDef {
  tier: HierarchyTier;
  label: string;
  description: string;
  percentileMin: number; // minimum percentile to qualify
}

const TIER_DEFS: TierDef[] = [
  { tier: "core", label: "Core", description: "Top contributors driving the project", percentileMin: 95 },
  { tier: "active", label: "Active", description: "Reliable, consistent contributors", percentileMin: 80 },
  { tier: "contributor", label: "Contributor", description: "Solid participants with real work", percentileMin: 50 },
  { tier: "emerging", label: "Emerging", description: "Getting started, showing up", percentileMin: 20 },
  { tier: "new", label: "New", description: "First contributions", percentileMin: 0 },
];

// ---- Tier Assignment --------------------------------------------------------

export function getTierForPercentile(percentile: number): TierDef {
  for (const def of TIER_DEFS) {
    if (percentile >= def.percentileMin) return def;
  }
  return TIER_DEFS[TIER_DEFS.length - 1];
}

// ---- Role Assignment --------------------------------------------------------

function getRoleForRank(rank: number, elizaEffect: number): "lead" | "maintainer" | "contributor" | "participant" {
  if (elizaEffect < 5) return "participant";
  if (rank <= 2) return "lead";
  if (rank <= 5) return "maintainer";
  return "contributor";
}

// ---- Assign Hierarchy to Contributors ---------------------------------------

export function assignHierarchy(contributors: Contributor[], projectId: string): void {
  for (const c of contributors) {
    const tierDef = getTierForPercentile(c.elizaEffect.percentile);
    const role = getRoleForRank(c.elizaEffect.rank, c.elizaEffect.total);

    const projectRole: ProjectRole = {
      projectId,
      role,
      rank: c.elizaEffect.rank,
      elizaEffect: c.elizaEffect.total,
    };

    c.hierarchy = {
      tier: tierDef.tier,
      tierLabel: tierDef.label,
      tierDescription: tierDef.description,
      percentileMin: tierDef.percentileMin,
      projectRoles: [projectRole],
    };
  }
}

// ---- Tier Color/Style Helpers (for UI) --------------------------------------

export function getTierColor(tier: HierarchyTier): string {
  switch (tier) {
    case "core": return "text-eliza-gold";
    case "active": return "text-eliza-purple";
    case "contributor": return "text-eliza-blue";
    case "emerging": return "text-eliza-green";
    case "new": return "text-muted-foreground";
  }
}

export function getTierBgColor(tier: HierarchyTier): string {
  switch (tier) {
    case "core": return "bg-eliza-gold/10 border-eliza-gold/30";
    case "active": return "bg-eliza-purple/10 border-eliza-purple/30";
    case "contributor": return "bg-eliza-blue/10 border-eliza-blue/30";
    case "emerging": return "bg-eliza-green/10 border-eliza-green/30";
    case "new": return "bg-muted/50 border-border";
  }
}

