// ---------------------------------------------------------------------------
// Data Loader — Loads legacy trust-scores.json and builds elizaEffect project
// ---------------------------------------------------------------------------

import trustData from "@/data/trust-scores.json";
import { buildProjectFromLegacyData, DEFAULT_CONFIG } from "./eliza-effect";
import type { Contributor, Project } from "./types";

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

let _cachedProject: Project | null = null;

export function loadProject(): Project {
  if (_cachedProject) return _cachedProject;

  const raw = (trustData as { contributors?: LegacyContributor[] }).contributors ?? [];
  const generatedAt = (trustData as { generatedAt?: string }).generatedAt;

  _cachedProject = buildProjectFromLegacyData(raw, DEFAULT_CONFIG, generatedAt);
  return _cachedProject;
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
