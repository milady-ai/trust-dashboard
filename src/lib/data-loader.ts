// ---------------------------------------------------------------------------
// Data Loader — Loads project data and builds elizaEffect project(s)
// ---------------------------------------------------------------------------
// Supports single project (current) and multi-project registry.
// Each project gets its own config, scoring, and hierarchy.

import trustData from "@/data/trust-scores.json";
import { buildProjectFromLegacyData, DEFAULT_CONFIG } from "./eliza-effect";
import { buildGlobalLeaderboard } from "./hierarchy";
import type {
  Contributor,
  ElizaEffectConfig,
  GlobalLeaderboardEntry,
  Project,
  ProjectRegistry,
  ProjectSummary,
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
let _registry: ProjectRegistry | null = null;

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

// ---- Multi-Project Registry -------------------------------------------------

export function loadProjectRegistry(): ProjectRegistry {
  if (_registry) return _registry;

  // Currently we only have one project; this scales to multiple data sources
  const projects = [loadProject()];

  const summaries: ProjectSummary[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    repoFullName: p.repoFullName,
    contributorCount: p.stats.totalContributors,
    avgElizaEffect: p.stats.avgElizaEffect,
    topContributor: p.stats.topContributor,
    generatedAt: p.generatedAt,
  }));

  const globalLeaderboard = buildGlobalLeaderboard(projects);

  _registry = {
    projects: summaries,
    globalLeaderboard,
    generatedAt: projects[0]?.generatedAt ?? new Date().toISOString(),
  };

  return _registry;
}

export function loadGlobalLeaderboard(): GlobalLeaderboardEntry[] {
  return loadProjectRegistry().globalLeaderboard;
}

// ---- Cross-Project Contributor Lookup ---------------------------------------

export function loadContributorAcrossProjects(username: string): {
  contributor: Contributor | undefined;
  globalEntry: GlobalLeaderboardEntry | undefined;
} {
  const contributor = loadContributor(username);
  const globalEntry = loadGlobalLeaderboard().find(
    (e) => e.username.toLowerCase() === username.toLowerCase(),
  );
  return { contributor, globalEntry };
}
