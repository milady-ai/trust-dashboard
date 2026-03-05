// ---------------------------------------------------------------------------
// Data Loader — Loads project data and builds elizaEffect project(s)
// ---------------------------------------------------------------------------
// Supports single project (current) and multi-project registry.
// Each project gets its own config, scoring, and hierarchy.

import trustData from "@/data/trust-scores.json";
import { buildProjectFromLegacyData, DEFAULT_CONFIG } from "./eliza-effect";
import type {
  Contributor,
  ElizaEffectConfig,
  Project,
} from "./types";

// ---- Legacy Data Types ------------------------------------------------------

interface LegacyContributor {
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
}

// ---- Project Cache ----------------------------------------------------------

const _projectCache = new Map<string, Project>();

// ---- Single Project Loading -------------------------------------------------

export function loadProject(config?: ElizaEffectConfig): Project {
  const cfg = config ?? DEFAULT_CONFIG;
  const cached = _projectCache.get(cfg.projectId);
  if (cached) return cached;

  const raw = (trustData as { contributors?: LegacyContributor[] }).contributors ?? [];
  const generatedAt = (trustData as { generatedAt?: string }).generatedAt;

  const project = buildProjectFromLegacyData(raw, cfg, generatedAt);
  _projectCache.set(cfg.projectId, project);
  return project;
}

export function loadContributors(): Contributor[] {
  return loadProject().contributors;
}

export function loadContributor(username: string): Contributor | undefined {
  return loadContributors().find(
    (c) => c.username.toLowerCase() === username.toLowerCase(),
  );
}

export function getGeneratedAt(): string {
  return loadProject().generatedAt;
}

