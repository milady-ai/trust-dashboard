// ---------------------------------------------------------------------------
// GitHub Contribution Scoring — elizaEffect
// ---------------------------------------------------------------------------
// Scores GitHub activity on a 0–100 scale across four dimensions:
//   PRs merged (35pts) · Reviews given (25pts) · Issues closed (20pts) · Consistency (20pts)
//
// Key design choices:
//   - Diminishing returns on volume (log curve) to resist spam
//   - Complexity weighting on PRs (files touched, lines changed)
//   - Recency bias: recent activity counts more
//   - Consistency rewards steady contributors over burst activity

import type { GitHubEvent, GitHubScore } from "./types";

// ---- Config -----------------------------------------------------------------

const MAX_PR_POINTS = 35;
const MAX_REVIEW_POINTS = 25;
const MAX_ISSUE_POINTS = 20;
const MAX_CONSISTENCY_POINTS = 20;

const RECENCY_HALF_LIFE_DAYS = 30;  // activity loses half its weight every 30 days

// ---- Helpers ----------------------------------------------------------------

function recencyWeight(timestampMs: number): number {
  const daysAgo = Math.max(0, (Date.now() - timestampMs) / 86_400_000);
  return Math.pow(0.5, daysAgo / RECENCY_HALF_LIFE_DAYS);
}

function complexityMultiplier(event: GitHubEvent): number {
  const lines = event.linesChanged ?? 0;
  const files = event.filesChanged ?? 1;

  // Small: <50 lines → 0.8x, Medium: 50-500 → 1.0x, Large: 500-2000 → 1.3x, Huge: 2000+ → 1.5x (capped)
  let lineMult = 1.0;
  if (lines < 50) lineMult = 0.8;
  else if (lines < 500) lineMult = 1.0;
  else if (lines < 2000) lineMult = 1.3;
  else lineMult = 1.5;

  // Cross-cutting changes (many files) get a small bonus
  const fileMult = files > 10 ? 1.2 : files > 5 ? 1.1 : 1.0;

  return lineMult * fileMult;
}

// Diminishing returns: log curve that flattens as count grows
// Returns 0–1 value that maps raw accumulated points to the max bucket
function diminish(rawPoints: number, maxPoints: number): number {
  if (rawPoints <= 0) return 0;
  // ln(1 + x) / ln(1 + target) where target is the "full score" threshold
  const target = maxPoints * 2; // need ~2x the max in raw points to hit 100%
  return Math.min(1, Math.log(1 + rawPoints) / Math.log(1 + target));
}

// ---- Scoring Functions ------------------------------------------------------

function scorePRs(events: GitHubEvent[]): number {
  const prs = events.filter((e) => e.type === "pr_merged");
  if (prs.length === 0) return 0;

  let rawPoints = 0;
  for (const pr of prs) {
    const base = 3; // base points per merged PR
    const complexity = complexityMultiplier(pr);
    const recency = recencyWeight(pr.timestamp);
    rawPoints += base * complexity * recency;
  }

  return diminish(rawPoints, MAX_PR_POINTS) * MAX_PR_POINTS;
}

function scoreReviews(events: GitHubEvent[]): number {
  const reviews = events.filter((e) => e.type === "review_given");
  if (reviews.length === 0) return 0;

  let rawPoints = 0;
  for (const review of reviews) {
    // Approvals with substance and change requests are worth more than bare comments
    let base = 1.5;
    if (review.reviewType === "approve") base = 2.0;
    if (review.reviewType === "request_changes") base = 2.5; // most valuable
    const recency = recencyWeight(review.timestamp);
    rawPoints += base * recency;
  }

  return diminish(rawPoints, MAX_REVIEW_POINTS) * MAX_REVIEW_POINTS;
}

function scoreIssues(events: GitHubEvent[]): number {
  const issues = events.filter((e) => e.type === "issue_closed");
  if (issues.length === 0) return 0;

  let rawPoints = 0;
  for (const issue of issues) {
    const recency = recencyWeight(issue.timestamp);
    rawPoints += 2.0 * recency;
  }

  return diminish(rawPoints, MAX_ISSUE_POINTS) * MAX_ISSUE_POINTS;
}

function scoreConsistency(events: GitHubEvent[]): number {
  if (events.length === 0) return 0;

  // Count distinct active weeks in the last 90 days
  const now = Date.now();
  const ninetyDaysAgo = now - 90 * 86_400_000;
  const activeWeeks = new Set<number>();

  for (const event of events) {
    if (event.timestamp >= ninetyDaysAgo) {
      const weekNum = Math.floor((now - event.timestamp) / (7 * 86_400_000));
      activeWeeks.add(weekNum);
    }
  }

  // 13 possible weeks in 90 days — score proportionally
  const weekRatio = activeWeeks.size / 13;
  return weekRatio * MAX_CONSISTENCY_POINTS;
}

// ---- Public API -------------------------------------------------------------

export function computeGitHubScore(events: GitHubEvent[]): GitHubScore {
  const prs = Math.round(scorePRs(events) * 10) / 10;
  const reviews = Math.round(scoreReviews(events) * 10) / 10;
  const issues = Math.round(scoreIssues(events) * 10) / 10;
  const consistency = Math.round(scoreConsistency(events) * 10) / 10;

  return {
    total: Math.round((prs + reviews + issues + consistency) * 10) / 10,
    prs,
    reviews,
    issues,
    consistency,
  };
}

// Convert legacy event data (from trust-scores.json) to GitHubEvent format
export function convertLegacyEvent(event: {
  type: string;
  timestamp: number;
  linesChanged?: number;
  labels?: string[];
  prNumber?: number;
}): GitHubEvent {
  const typeMap: Record<string, GitHubEvent["type"]> = {
    approve: "pr_merged",
    reject: "pr_rejected",
    close: "pr_closed",
    selfClose: "pr_closed",
  };

  return {
    type: typeMap[event.type] ?? "pr_closed",
    timestamp: event.timestamp,
    prNumber: event.prNumber,
    linesChanged: event.linesChanged,
    filesChanged: undefined,
    labels: event.labels,
  };
}
