// ---------------------------------------------------------------------------
// GitHub Contribution Scoring — elizaEffect
// ---------------------------------------------------------------------------
// Scores GitHub activity on a 0–100 scale across four dimensions:
//   Merged PRs (40pts) · Participation (20pts) · Consistency (25pts) · Impact (15pts)
//
// Philosophy:
//   - Every event means you showed up. Showing up has value.
//   - Merged PRs are gold, but closes/rejections still count — you wrote code,
//     got feedback, iterated. That's how real development works.
//   - Small focused PRs are often better than huge dumps. Don't penalize small work.
//   - Massive line counts get capped — a 100k line commit isn't 100x a 1k feature.
//   - Recency matters but doesn't obliterate last month's work.
//   - Consistency rewards showing up regularly, not just one heroic weekend.
//   - Scores should spread meaningfully across a real contributor pool.

import type { GitHubEvent, GitHubScore } from "./types";

// ---- Config -----------------------------------------------------------------

const MAX_MERGED_POINTS = 40;
const MAX_PARTICIPATION_POINTS = 20;
const MAX_CONSISTENCY_POINTS = 25;
const MAX_IMPACT_POINTS = 15;

// Recency: half-life of 45 days — gentler decay so recent work stays relevant
const RECENCY_HALF_LIFE_DAYS = 45;

// ---- Reference Time ---------------------------------------------------------
// All scoring is relative to a reference timestamp (usually when data was generated).
// This prevents scores from going stale in static builds.

let _referenceTime = Date.now();

export function setReferenceTime(ms: number): void {
  _referenceTime = ms;
}

// ---- Helpers ----------------------------------------------------------------

function recencyWeight(timestampMs: number): number {
  const daysAgo = Math.max(0, (_referenceTime - timestampMs) / 86_400_000);
  return Math.pow(0.5, daysAgo / RECENCY_HALF_LIFE_DAYS);
}

function complexityMultiplier(event: GitHubEvent): number {
  const lines = event.linesChanged ?? 0;

  // Small PRs are good work. Don't penalize them.
  // Tiny (<10 lines): config fix, typo — still 1.0x
  // Small (10-100): focused fix/feature — 1.0x
  // Medium (100-500): solid feature — 1.15x
  // Large (500-2000): significant work — 1.3x
  // Huge (2000-10000): major feature — 1.4x
  // Massive (10000+): capped — likely generated/vendor, 1.2x (still credit, but dampened)
  if (lines < 100) return 1.0;
  if (lines < 500) return 1.15;
  if (lines < 2000) return 1.3;
  if (lines < 10000) return 1.4;
  return 1.2; // massive PRs get dampened — probably generated/vendor code
}

// Softened diminishing returns using tanh-like curve
// More generous than log — rewards genuine volume without making top scores impossible
function diminish(rawPoints: number, maxPoints: number): number {
  if (rawPoints <= 0) return 0;
  const target = maxPoints * 1.5;
  return rawPoints / Math.sqrt(rawPoints * rawPoints + target * target);
}

// ---- Scoring Functions ------------------------------------------------------

// Merged PRs: the core value signal
function scoreMergedPRs(events: GitHubEvent[]): number {
  const merged = events.filter((e) => e.type === "pr_merged");
  if (merged.length === 0) return 0;

  let rawPoints = 0;
  for (const pr of merged) {
    const base = 4.0;
    const complexity = complexityMultiplier(pr);
    const recency = recencyWeight(pr.timestamp);
    rawPoints += base * complexity * recency;
  }

  return diminish(rawPoints, MAX_MERGED_POINTS) * MAX_MERGED_POINTS;
}

// Participation: closes, rejections, reviews — you showed up and contributed
// A rejection means you submitted work and got feedback. That's valuable.
// A close means you're iterating, cleaning up, or triaging. Also valuable.
// Reviews mean you're helping others. Huge value.
function scoreParticipation(events: GitHubEvent[]): number {
  let rawPoints = 0;

  for (const event of events) {
    const recency = recencyWeight(event.timestamp);

    switch (event.type) {
      case "review_given":
        // Reviews are high-value participation
        if (event.reviewType === "request_changes") rawPoints += 3.0 * recency;
        else if (event.reviewType === "approve") rawPoints += 2.5 * recency;
        else rawPoints += 2.0 * recency;
        break;
      case "pr_rejected":
        // You submitted work, got feedback. That's learning, not failure.
        rawPoints += 1.5 * recency;
        break;
      case "pr_closed":
        // Closing a PR is normal — iterating, opening a better one, maintainer triage
        rawPoints += 1.0 * recency;
        break;
      case "issue_closed":
        rawPoints += 2.0 * recency;
        break;
      // pr_merged already scored in its own bucket — don't double-count
    }
  }

  if (rawPoints <= 0) return 0;
  return diminish(rawPoints, MAX_PARTICIPATION_POINTS) * MAX_PARTICIPATION_POINTS;
}

// Consistency: how regularly do you show up?
// Rewards showing up multiple days over time. A single event is not "consistent."
// Three signals: active days (volume), weekly coverage (breadth), longevity (time span)
function scoreConsistency(events: GitHubEvent[]): number {
  if (events.length === 0) return 0;

  const now = _referenceTime;
  const timestamps = events.map((e) => e.timestamp);
  const earliest = Math.min(...timestamps);
  const latest = Math.max(...timestamps);

  // Active days — how many distinct days did you contribute?
  const activeDays = new Set(
    timestamps.map((ts) => Math.floor(ts / 86_400_000)),
  ).size;

  // You need at least 2 active days to get any consistency credit.
  // 1 event = you showed up once, not consistent.
  if (activeDays < 2) return 0;

  // Active weeks in last 60 days — are you still around?
  const sixtyDaysAgo = now - 60 * 86_400_000;
  const recentWeeks = new Set(
    timestamps
      .filter((ts) => ts >= sixtyDaysAgo)
      .map((ts) => Math.floor((now - ts) / (7 * 86_400_000))),
  ).size;
  const maxRecentWeeks = 9;

  // How many days has this person been around? (first event to latest)
  const spanDays = Math.max(1, (latest - earliest) / 86_400_000);

  // Three sub-signals:

  // 1. Active days score — log scaled, so 2 days → some credit, 15+ days → near max
  //    This is the core signal: how many days did you actually work?
  const dayScore = Math.min(1, Math.log(activeDays) / Math.log(20)); // 20 active days ≈ 100%

  // 2. Weekly coverage — what fraction of recent weeks had activity?
  const weekScore = maxRecentWeeks > 0 ? recentWeeks / maxRecentWeeks : 0;

  // 3. Longevity — how long have you been contributing?
  //    Being around for 2+ weeks matters more than a single weekend burst.
  const longevityScore = Math.min(1, spanDays / 21); // 3 weeks ≈ full credit

  // Blend: 40% active days, 35% weekly coverage, 25% longevity
  const consistencyRatio = dayScore * 0.4 + weekScore * 0.35 + longevityScore * 0.25;

  return Math.min(MAX_CONSISTENCY_POINTS, consistencyRatio * MAX_CONSISTENCY_POINTS);
}

// Impact: were your PRs substantial? Rewards depth over volume.
// Looks at the top PRs by complexity — did you do any real heavy lifting?
function scoreImpact(events: GitHubEvent[]): number {
  const merged = events.filter((e) => e.type === "pr_merged");
  if (merged.length === 0) return 0;

  // Sort by lines changed descending, take top 5
  const topPRs = [...merged]
    .sort((a, b) => (b.linesChanged ?? 0) - (a.linesChanged ?? 0))
    .slice(0, 5);

  let rawPoints = 0;
  for (const pr of topPRs) {
    const lines = pr.linesChanged ?? 0;
    const recency = recencyWeight(pr.timestamp);

    let impactValue = 0;
    if (lines >= 5000) impactValue = 5.0;       // major feature/refactor
    else if (lines >= 1000) impactValue = 4.0;   // significant feature
    else if (lines >= 500) impactValue = 3.0;    // solid feature
    else if (lines >= 100) impactValue = 2.0;    // meaningful change
    else impactValue = 1.0;                       // small but still impact

    rawPoints += impactValue * recency;
  }

  return diminish(rawPoints, MAX_IMPACT_POINTS) * MAX_IMPACT_POINTS;
}

// ---- Public API -------------------------------------------------------------

export function computeGitHubScore(events: GitHubEvent[]): GitHubScore {
  const prs = Math.round(scoreMergedPRs(events) * 10) / 10;
  const participation = Math.round(scoreParticipation(events) * 10) / 10;
  const consistency = Math.round(scoreConsistency(events) * 10) / 10;
  const impact = Math.round(scoreImpact(events) * 10) / 10;

  return {
    total: Math.round((prs + participation + consistency + impact) * 10) / 10,
    prs,
    participation,
    impact,
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
