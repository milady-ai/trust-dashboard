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
import { computeBadges, type BadgeInput } from "../src/lib/badges";
import { computeLevelStats, computeTagXp, determineCharacterClass, isAgent } from "../src/lib/levels";

const OWNER = "milady-ai";
const REPO = "milaidy";
const GITHUB_API = "https://api.github.com";

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
  return { legendary: 0, trusted: 0, established: 0, contributing: 0, probationary: 0, untested: 0, restricted: 0 };
}

function computeCurrentStreak(events: { type: EventType }[]): { type: "approve" | "negative" | null; length: number } {
  let type: "approve" | "negative" | null = null;
  let length = 0;

  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    const normalized: "approve" | "negative" | null =
      event.type === "approve" ? "approve" : event.type === "reject" || event.type === "close" ? "negative" : null;

    if (!normalized) continue;
    if (!type) { type = normalized; length = 1; continue; }
    if (type === normalized) { length++; } else { break; }
  }

  return { type, length };
}

// --- GitHub API helpers ---

function getHeaders(token?: string): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": "milaidy-trust-dashboard",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function fetchJson<T>(url: string, token?: string): Promise<T> {
  const res = await fetch(url, { headers: getHeaders(token) });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${res.status} for ${url}: ${text}`);
  }
  return (await res.json()) as T;
}

interface GitHubIssue {
  number: number;
  user: { login: string; avatar_url?: string };
  labels: Array<{ name: string }>;
  state: string;
  pull_request?: unknown;
  created_at: string;
  closed_at: string | null;
}

interface GitHubReview {
  user: { login: string };
  state: string;
  submitted_at: string;
  pull_request_url: string;
}

interface GitHubComment {
  user: { login: string };
  created_at: string;
  issue_url?: string;
}

async function fetchIssues(token?: string): Promise<GitHubIssue[]> {
  const all: GitHubIssue[] = [];
  let page = 1;
  while (true) {
    const url = `${GITHUB_API}/repos/${OWNER}/${REPO}/issues?state=all&per_page=100&page=${page}`;
    const items = await fetchJson<GitHubIssue[]>(url, token);
    if (items.length === 0) break;
    // Filter out PRs (GitHub lists PRs under /issues too)
    all.push(...items.filter((i) => !i.pull_request));
    if (items.length < 100) break;
    page++;
    await new Promise((r) => setTimeout(r, 100));
  }
  return all;
}

async function fetchAllReviews(prNumbers: number[], token?: string): Promise<Map<string, GitHubReview[]>> {
  const byUser = new Map<string, GitHubReview[]>();

  for (const prNum of prNumbers) {
    try {
      const url = `${GITHUB_API}/repos/${OWNER}/${REPO}/pulls/${prNum}/reviews?per_page=100`;
      const reviews = await fetchJson<GitHubReview[]>(url, token);
      for (const review of reviews) {
        const login = review.user?.login;
        if (!login) continue;
        if (!byUser.has(login)) byUser.set(login, []);
        byUser.get(login)!.push(review);
      }
    } catch {
      // PR may have been deleted
    }
    await new Promise((r) => setTimeout(r, 50));
  }

  return byUser;
}

async function fetchIssueComments(token?: string): Promise<Map<string, number>> {
  const commentCounts = new Map<string, number>();
  let page = 1;
  while (true) {
    const url = `${GITHUB_API}/repos/${OWNER}/${REPO}/issues/comments?per_page=100&page=${page}`;
    const comments = await fetchJson<GitHubComment[]>(url, token);
    if (comments.length === 0) break;
    for (const comment of comments) {
      const login = comment.user?.login;
      if (!login) continue;
      commentCounts.set(login, (commentCounts.get(login) ?? 0) + 1);
    }
    if (comments.length < 100) break;
    page++;
    await new Promise((r) => setTimeout(r, 100));
  }
  return commentCounts;
}

function computeLongestStreak(events: Array<{ timestamp: number }>): number {
  if (events.length === 0) return 0;

  const days = new Set<string>();
  for (const e of events) {
    days.add(new Date(e.timestamp).toISOString().slice(0, 10));
  }

  const sortedDays = [...days].sort();
  let maxStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < sortedDays.length; i++) {
    const prev = new Date(sortedDays[i - 1]);
    const curr = new Date(sortedDays[i]);
    const diffMs = curr.getTime() - prev.getTime();
    if (diffMs <= 86400000) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }

  return maxStreak;
}

// --- Main ---

async function main() {
  const token = process.env.GITHUB_TOKEN;
  const now = Date.now();

  // Fetch PRs
  console.log(`Fetching closed PRs for ${OWNER}/${REPO}...`);
  const prs = await fetchClosedPRs(OWNER, REPO, token);
  console.log(`Fetched ${prs.length} closed PRs`);

  // Fetch issues
  console.log("Fetching issues...");
  const issues = await fetchIssues(token);
  console.log(`Fetched ${issues.length} issues`);

  // Fetch reviews (across all closed PRs)
  console.log("Fetching PR reviews...");
  const prNumbers = prs.map((p) => p.number);
  const reviewsByUser = await fetchAllReviews(prNumbers, token);
  console.log(`Fetched reviews for ${reviewsByUser.size} reviewers`);

  // Fetch comments
  console.log("Fetching issue/PR comments...");
  const commentCounts = await fetchIssueComments(token);
  console.log(`Fetched comment data for ${commentCounts.size} users`);

  // Build contributor events from PRs
  const events = prs
    .map((pr) => mapPRToTrustEvent(pr))
    .filter((event): event is NonNullable<typeof event> => event !== null)
    .sort((a, b) => a.timestamp - b.timestamp);

  const { histories, avatars } = buildContributorHistories(events);

  // Build per-user issue stats
  const issuesByUser = new Map<string, GitHubIssue[]>();
  for (const issue of issues) {
    const login = issue.user?.login;
    if (!login) continue;
    if (!issuesByUser.has(login)) issuesByUser.set(login, []);
    issuesByUser.get(login)!.push(issue);
  }

  // Collect all unique usernames
  const allUsernames = new Set<string>([
    ...Object.keys(histories),
    ...issuesByUser.keys(),
    ...reviewsByUser.keys(),
    ...commentCounts.keys(),
  ]);

  const contributors = [...allUsernames]
    .map((username) => {
      const history = histories[username] ?? { contributor: username, createdAt: now, events: [] };
      const result = computeTrustScore(history, DEFAULT_CONFIG, now);
      const tierInfo = getTier(result.score, DEFAULT_CONFIG);
      const userEvents = [...history.events].sort((a, b) => a.timestamp - b.timestamp);
      const scoreHistory = computeScoreHistory(history, DEFAULT_CONFIG, now);
      const currentStreak = computeCurrentStreak(userEvents);

      const totalApprovals = userEvents.filter((e) => e.type === "approve").length;
      const totalRejections = userEvents.filter((e) => e.type === "reject").length;
      const totalCloses = userEvents.filter((e) => e.type === "close").length;
      const totalSelfCloses = userEvents.filter((e) => e.type === "selfClose").length;
      const userIssues = issuesByUser.get(username) ?? [];
      const userReviews = reviewsByUser.get(username) ?? [];
      const totalComments = commentCounts.get(username) ?? 0;

      const firstSeenAt = userEvents[0]
        ? new Date(userEvents[0].timestamp).toISOString()
        : new Date(history.createdAt).toISOString();
      const lastEventAt = userEvents.at(-1)
        ? new Date(userEvents.at(-1)!.timestamp).toISOString()
        : null;

      // Compute tag XP from PR labels
      const tagEvents = userEvents.map((e) => ({
        labels: e.labels,
        weight: e.type === "approve" ? 10 : e.type === "reject" ? 2 : 1,
      }));
      // Add issue labels to tag XP
      for (const issue of userIssues) {
        tagEvents.push({
          labels: issue.labels.map((l) => l.name),
          weight: issue.state === "closed" ? 5 : 2,
        });
      }
      const tagXp = computeTagXp(tagEvents);
      const levelStats = computeLevelStats(tagXp);

      // Compute badges
      const bugsClosed = userIssues.filter(
        (i) => i.state === "closed" && i.labels.some((l) => l.name === "bug" || l.name === "bugfix"),
      ).length;

      const longestStreak = computeLongestStreak([
        ...userEvents.map((e) => ({ timestamp: e.timestamp })),
        ...userIssues.map((i) => ({ timestamp: Date.parse(i.created_at) })),
      ]);

      const badgeInput: BadgeInput = {
        mergedPRs: totalApprovals,
        bugsClosed,
        reviewsGiven: userReviews.length,
        longestStreak,
        totalLevel: levelStats.totalLevel,
      };
      const badges = computeBadges(badgeInput);

      // Determine character class
      const agentFlag = isAgent(username);
      const characterClass = determineCharacterClass(tagXp, agentFlag);

      return {
        username,
        avatarUrl: avatars[username] ?? `https://github.com/${username}.png`,
        trustScore: result.score,
        tier: tierInfo.label,
        tierInfo,
        breakdown: result.breakdown,
        currentStreak,
        totalApprovals,
        totalRejections,
        totalCloses,
        totalSelfCloses,
        totalReviews: userReviews.length,
        totalIssues: userIssues.length,
        totalComments,
        isAgent: agentFlag,
        characterClass: characterClass.id,
        badges,
        tags: levelStats.tags,
        totalLevel: levelStats.totalLevel,
        totalXp: levelStats.totalXp,
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
      totalIssues: issues.length,
      totalReviews: [...reviewsByUser.values()].reduce((sum, r) => sum + r.length, 0),
      tierDistribution,
      avgScore,
    },
  };

  const outDir = join(process.cwd(), "src", "data");
  await mkdir(outDir, { recursive: true });
  const outFile = join(outDir, "trust-scores.json");
  await writeFile(outFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(`Wrote ${contributors.length} contributors to ${outFile}`);
  console.log(`  - ${issues.length} issues, ${reviewsByUser.size} reviewers, ${commentCounts.size} commenters`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
