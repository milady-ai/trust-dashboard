import trustData from "@/data/trust-scores.json";
import type { ContributorProfile } from "./contributor-types";

export interface Stats {
  totalContributors: number;
  totalEvents: number;
}

interface RawContributor {
  username?: string;
  avatarUrl?: string;
  totalApprovals?: number;
  totalRejections?: number;
  totalCloses?: number;
  totalSelfCloses?: number;
  lastEventAt?: string | null;
  firstSeenAt?: string;
  events?: ContributorProfile["events"];
}

function normalizeContributors(raw: RawContributor[]): ContributorProfile[] {
  return raw.map((c) => ({
    username: c.username ?? "unknown",
    avatarUrl: c.avatarUrl ?? `https://github.com/${c.username ?? "ghost"}.png`,
    totalApprovals: c.totalApprovals ?? 0,
    totalRejections: c.totalRejections ?? 0,
    totalCloses: c.totalCloses ?? 0,
    totalSelfCloses: c.totalSelfCloses ?? 0,
    lastEventAt: c.lastEventAt ?? null,
    firstSeenAt: c.firstSeenAt ?? new Date().toISOString(),
    events: c.events ?? [],
  }));
}

export function loadContributors(): ContributorProfile[] {
  const raw = (trustData.contributors ?? []) as unknown as RawContributor[];
  return normalizeContributors(raw);
}

export function loadStats(): Stats {
  const s = trustData.stats as { totalContributors?: number; totalEvents?: number };
  return {
    totalContributors: s.totalContributors ?? 0,
    totalEvents: s.totalEvents ?? 0,
  };
}

export function getGeneratedAt(): string {
  return trustData.generatedAt;
}
