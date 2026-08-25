/**
 * Contributor Skills & Focus Area System
 *
 * Inspired by MMORPG progression systems, this module tracks developer expertise
 * across three dimensions:
 *   - Roles: What type of contributor you are (maintainer, architect, feature developer)
 *   - Focus Areas: Which parts of the codebase you work on (docs, core, UI, infrastructure)
 *   - Skills: The technologies/disciplines you demonstrate proficiency in
 *
 * XP is earned through merged PRs (approvals) in each focus area.
 */

import type { TrustEvent } from "./scoring-engine";

// ============================================================================
// Types
// ============================================================================

export type FocusAreaKey =
  | "core"
  | "security"
  | "docs"
  | "testing"
  | "infrastructure"
  | "ui"
  | "features"
  | "bugfixes"
  | "plugins"
  | "maintenance";

export type ContributorRoleKey =
  | "maintainer"
  | "architect"
  | "security-engineer"
  | "feature-dev"
  | "bug-hunter"
  | "docs-lead"
  | "qa-engineer"
  | "infrastructure-eng"
  | "plugin-dev"
  | "contributor";

export interface FocusAreaProfile {
  key: FocusAreaKey;
  label: string;
  icon: string;
  xp: number;
  level: number;
  levelLabel: string;
  prs: number;
}

export interface ContributorRole {
  key: ContributorRoleKey;
  label: string;
  icon: string;
  description: string;
}

export interface SkillProfile {
  role: ContributorRole;
  focusAreas: FocusAreaProfile[];
  topSkills: string[];
}

// ============================================================================
// Config
// ============================================================================

const FOCUS_AREA_META: Record<FocusAreaKey, { label: string; icon: string }> = {
  core: { label: "Core", icon: "⚙️" },
  security: { label: "Security", icon: "🔒" },
  docs: { label: "Docs", icon: "📚" },
  testing: { label: "Testing", icon: "🧪" },
  infrastructure: { label: "Infrastructure", icon: "🏗️" },
  ui: { label: "UI/UX", icon: "🎨" },
  features: { label: "Features", icon: "✨" },
  bugfixes: { label: "Bug Fixes", icon: "🐛" },
  plugins: { label: "Plugins", icon: "🔌" },
  maintenance: { label: "Maintenance", icon: "🔧" },
};

const ROLE_META: Record<ContributorRoleKey, { label: string; icon: string; description: string }> = {
  maintainer: { label: "Maintainer", icon: "👑", description: "High-volume contributor across all areas" },
  architect: { label: "Architect", icon: "🏛️", description: "Core system design and critical fixes" },
  "security-engineer": { label: "Security Engineer", icon: "🔐", description: "Security-focused contributions" },
  "feature-dev": { label: "Feature Dev", icon: "🚀", description: "New feature implementation" },
  "bug-hunter": { label: "Bug Hunter", icon: "🎯", description: "Debugging and defect resolution" },
  "docs-lead": { label: "Docs Lead", icon: "📖", description: "Documentation and knowledge sharing" },
  "qa-engineer": { label: "QA Engineer", icon: "✅", description: "Testing and quality assurance" },
  "infrastructure-eng": { label: "Infrastructure", icon: "⚡", description: "CI/CD and build systems" },
  "plugin-dev": { label: "Plugin Dev", icon: "🔌", description: "Plugin and connector development" },
  contributor: { label: "Contributor", icon: "🤝", description: "General contributor" },
};

/** XP thresholds: [minXP, level, levelLabel] */
const XP_LEVELS: Array<{ minXP: number; level: number; label: string }> = [
  { minXP: 60, level: 5, label: "Master" },
  { minXP: 30, level: 4, label: "Expert" },
  { minXP: 15, level: 3, label: "Journeyman" },
  { minXP: 5, level: 2, label: "Apprentice" },
  { minXP: 1, level: 1, label: "Novice" },
  { minXP: 0, level: 0, label: "" },
];

/** Map PR labels (including category: prefixed ones) to focus area keys */
const LABEL_TO_FOCUS: Record<string, FocusAreaKey> = {
  // Security
  security: "security",
  // Core / architecture
  core: "core",
  "critical-fix": "core",
  refactor: "core",
  // Docs
  docs: "docs",
  documentation: "docs",
  // Testing
  test: "testing",
  tests: "testing",
  testing: "testing",
  // Infrastructure
  build: "infrastructure",
  ci: "infrastructure",
  deploy: "infrastructure",
  devops: "infrastructure",
  // UI
  ui: "ui",
  aesthetic: "ui",
  design: "ui",
  frontend: "ui",
  // Features
  feature: "features",
  // Bug fixes
  bugfix: "bugfixes",
  bug: "bugfixes",
  fix: "bugfixes",
  // Plugins / connectors
  plugins: "plugins",
  plugin: "plugins",
  connector: "plugins",
  connectors: "plugins",
  electron: "plugins",
  // Maintenance
  chore: "maintenance",
  maintenance: "maintenance",
  aardvark: "maintenance",
  codex: "maintenance",
};

/** Skill descriptions derived from focus areas */
const FOCUS_TO_SKILLS: Record<FocusAreaKey, string[]> = {
  core: ["Core Architecture", "System Design"],
  security: ["Security Engineering", "Vulnerability Analysis"],
  docs: ["Technical Writing", "Documentation"],
  testing: ["Test Engineering", "Quality Assurance"],
  infrastructure: ["CI/CD", "Build Systems", "DevOps"],
  ui: ["Frontend Development", "UX Design"],
  features: ["Feature Development", "Product Engineering"],
  bugfixes: ["Debugging", "Root Cause Analysis"],
  plugins: ["Plugin Development", "API Integration"],
  maintenance: ["Code Maintenance", "Dependency Management"],
};

// ============================================================================
// Helpers
// ============================================================================

function normalizeLabel(raw: string): string {
  const lower = raw.toLowerCase().replace(/\s+/g, "-");
  // Strip "category:" prefix used in milady-ai/milady labels
  return lower.startsWith("category:") ? lower.slice("category:".length) : lower;
}

function getLevelForXP(xp: number): { level: number; label: string } {
  for (const threshold of XP_LEVELS) {
    if (xp >= threshold.minXP) return { level: threshold.level, label: threshold.label };
  }
  return { level: 0, label: "" };
}

// ============================================================================
// Core computation
// ============================================================================

/**
 * Compute a contributor's skill profile from their event history.
 * Only approved (merged) PRs contribute XP — shipping production code is what matters.
 */
export function computeSkillProfile(events: TrustEvent[]): SkillProfile {
  const xpByArea: Partial<Record<FocusAreaKey, number>> = {};
  const prsByArea: Partial<Record<FocusAreaKey, number>> = {};

  let totalApprovals = 0;

  for (const event of events) {
    if (event.type !== "approve") continue;
    totalApprovals++;

    const areas = new Set<FocusAreaKey>();

    for (const rawLabel of event.labels ?? []) {
      const label = normalizeLabel(rawLabel);
      const area = LABEL_TO_FOCUS[label];
      if (area) areas.add(area);
    }

    // Unlabeled PRs contribute a small amount to "contributor" baseline
    if (areas.size === 0) {
      areas.add("features"); // default: treat as feature work
    }

    // Distribute XP: each PR contributes 1 XP per qualifying area (capped at 2 areas)
    const areaList = [...areas].slice(0, 2);
    for (const area of areaList) {
      xpByArea[area] = (xpByArea[area] ?? 0) + 1;
      prsByArea[area] = (prsByArea[area] ?? 0) + 1;
    }
  }

  // Build focus area profiles (only areas with XP)
  const focusAreas: FocusAreaProfile[] = (Object.keys(xpByArea) as FocusAreaKey[])
    .map((key) => {
      const xp = xpByArea[key] ?? 0;
      const { level, label: levelLabel } = getLevelForXP(xp);
      const meta = FOCUS_AREA_META[key];
      return {
        key,
        label: meta.label,
        icon: meta.icon,
        xp,
        level,
        levelLabel,
        prs: prsByArea[key] ?? 0,
      };
    })
    .filter((a) => a.level > 0)
    .sort((a, b) => b.xp - a.xp);

  // Determine role
  const role = determineRole(focusAreas, totalApprovals);

  // Derive top skills from top 3 focus areas
  const topSkills: string[] = [];
  for (const area of focusAreas.slice(0, 3)) {
    const skills = FOCUS_TO_SKILLS[area.key];
    for (const skill of skills) {
      if (!topSkills.includes(skill)) topSkills.push(skill);
      if (topSkills.length >= 5) break;
    }
    if (topSkills.length >= 5) break;
  }

  return { role, focusAreas, topSkills };
}

function determineRole(focusAreas: FocusAreaProfile[], totalApprovals: number): ContributorRole {
  let roleKey: ContributorRoleKey = "contributor";

  // Maintainer: high volume across many areas
  if (totalApprovals >= 50 && focusAreas.length >= 4) {
    roleKey = "maintainer";
  } else if (focusAreas.length === 0) {
    roleKey = "contributor";
  } else {
    const top = focusAreas[0];
    const topShare = top.prs / Math.max(1, totalApprovals);

    if (top.key === "security" && topShare >= 0.2) {
      roleKey = "security-engineer";
    } else if ((top.key === "core") && topShare >= 0.25) {
      roleKey = "architect";
    } else if (top.key === "docs" && topShare >= 0.3) {
      roleKey = "docs-lead";
    } else if (top.key === "testing" && topShare >= 0.3) {
      roleKey = "qa-engineer";
    } else if (top.key === "infrastructure" && topShare >= 0.3) {
      roleKey = "infrastructure-eng";
    } else if (top.key === "plugins" && topShare >= 0.3) {
      roleKey = "plugin-dev";
    } else if (top.key === "features" && topShare >= 0.3) {
      roleKey = "feature-dev";
    } else if (top.key === "bugfixes" && topShare >= 0.3) {
      roleKey = "bug-hunter";
    } else if (totalApprovals >= 20) {
      roleKey = "maintainer";
    } else {
      roleKey = "contributor";
    }
  }

  const meta = ROLE_META[roleKey];
  return { key: roleKey, ...meta };
}
