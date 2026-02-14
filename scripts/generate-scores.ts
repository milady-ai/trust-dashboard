#!/usr/bin/env bun

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  DEFAULT_CONFIG,
  computeScoreHistory,
  computeTrustScore,
  getTier,
  type EventType,
} from "../src/lib/scoring-engine";
import { buildContributorHistories, fetchClosedPRs, mapPRToTrustEvent } from "../src/lib/github-data";

const OWNER = "milady-ai";
const REPO = "milaidy";

type TierDistribution = {
  legendary: number;
  trusted: number;
  established: number;
  contributing: number;
  probationary: number;
  untested: number;
  restricted: number;
};

function emptyTierDistribution(): TierDistribution {
  return {
    legendary: 0,
    trusted: 0,
    established: 0,
    contributing: 0,
    probationary: 0,
    untested: 0,
    restricted: 0,
  };
}

function computeCurrentStreak(events: { type: EventType }[]): { type: "approve" | "negative" | null; length: number } {
  let type: "approve" | "negative" | null = null;
  let length = 0;

  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    const normalized: "approve" | "negative" | null =
      event.type === "approve"
        ? "approve"
        : event.type === "reject" || event.type === "close"
          ? "negative"
          : null;

    if (!normalized) {
      continue;
    }

    if (!type) {
      type = normalized;
      length = 1;
      continue;
    }

    if (type === normalized) {
      length++;
    } else {
      break;
    }
  }

  return { type, length };
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  const now = Date.now();

  console.log(`Fetching closed PRs for ${OWNER}/${REPO}...`);
  const prs = await fetchClosedPRs(OWNER, REPO, token);
  console.log(`Fetched ${prs.length} closed PRs`);

  const events = prs
    .map((pr) => mapPRToTrustEvent(pr))
    .filter((event): event is NonNullable<typeof event> => event !== null)
    .sort((a, b) => a.timestamp - b.timestamp);

  const { histories, avatars } = buildContributorHistories(events);

  const contributors = Object.values(histories)
    .map((history) => {
      const username = history.contributor;
      const result = computeTrustScore(history, DEFAULT_CONFIG, now);
      const tierInfo = getTier(result.score, DEFAULT_CONFIG);
      const userEvents = [...history.events].sort((a, b) => a.timestamp - b.timestamp);
      const scoreHistory = computeScoreHistory(history, DEFAULT_CONFIG, now);
      const currentStreak = computeCurrentStreak(userEvents);

      const totalApprovals = userEvents.filter((e) => e.type === "approve").length;
      const totalRejections = userEvents.filter((e) => e.type === "reject").length;
      const totalCloses = userEvents.filter((e) => e.type === "close").length;
      const totalSelfCloses = userEvents.filter((e) => e.type === "selfClose").length;
      const firstSeenAt = userEvents[0] ? new Date(userEvents[0].timestamp).toISOString() : new Date(history.createdAt).toISOString();
      const lastEventAt = userEvents.at(-1) ? new Date(userEvents.at(-1)!.timestamp).toISOString() : null;

      return {
        username,
        avatarUrl: avatars[username] ?? "https://github.com/ghost.png",
        trustScore: result.score,
        tier: tierInfo.label,
        tierInfo,
        breakdown: result.breakdown,
        currentStreak,
        totalApprovals,
        totalRejections,
        totalCloses,
        totalSelfCloses,
        lastEventAt,
        firstSeenAt,
        events: userEvents,
        scoreHistory,
        warnings: result.warnings,
      };
    })
    .sort((a, b) => b.trustScore - a.trustScore);

  const tierDistribution = emptyTierDistribution();
  for (const c of contributors) {
    tierDistribution[c.tier]++;
  }

  const avgScore =
    contributors.length > 0
      ? Number((contributors.reduce((sum, c) => sum + c.trustScore, 0) / contributors.length).toFixed(2))
      : 0;

  const payload = {
    generatedAt: new Date(now).toISOString(),
    repoFullName: `${OWNER}/${REPO}`,
    contributors,
    stats: {
      totalContributors: contributors.length,
      totalEvents: events.length,
      tierDistribution,
      avgScore,
    },
  };

  const outDir = join(process.cwd(), "src", "data");
  await mkdir(outDir, { recursive: true });
  const outFile = join(outDir, "trust-scores.json");
  await writeFile(outFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(`Wrote ${contributors.length} contributors to ${outFile}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
