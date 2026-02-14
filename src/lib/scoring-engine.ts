export type TrustTier =
  | "legendary"
  | "trusted"
  | "established"
  | "contributing"
  | "probationary"
  | "untested"
  | "restricted";

export type EventType = "approve" | "reject" | "close" | "selfClose";
export type ReviewSeverity = "critical" | "major" | "normal" | "minor" | "trivial";

export interface TierConfig {
  minScore: number;
  label: TrustTier;
  description: string;
}

export interface ComplexityBucket {
  maxLines: number;
  multiplier: number;
  label: string;
}

export interface TrustScoringConfig {
  basePoints: Record<EventType, number>;
  diminishingRate: number;
  recencyHalfLifeDays: number;
  complexityBuckets: ComplexityBucket[];
  categoryWeights: Record<string, number>;
  defaultCategoryWeight: number;
  streaks: {
    approvalBonus: number;
    approvalMaxBonus: number;
    rejectionPenalty: number;
    rejectionMaxPenalty: number;
  };
  inactivityDecay: {
    gracePeriodDays: number;
    decayRatePerDay: number;
    decayFloor: number;
    decayTarget: number;
  };
  velocity: {
    windowDays: number;
    softCapPRs: number;
    hardCapPRs: number;
    penaltyPerExcess: number;
  };
  reviewSeverity: Record<ReviewSeverity, number>;
  defaultReviewSeverity: ReviewSeverity;
  minScore: number;
  maxScore: number;
  initialScore: number;
  dailyPointCap: number;
  tiers: TierConfig[];
}

export interface TrustEvent {
  type: EventType;
  timestamp: number;
  linesChanged: number;
  labels: string[];
  reviewSeverity?: ReviewSeverity;
  prNumber: number;
  filesChanged?: number;
}

export interface ContributorState {
  contributor: string;
  createdAt: number;
  events: TrustEvent[];
  manualAdjustment?: number;
}

export interface EventBreakdown {
  prNumber: number;
  type: EventType;
  basePoints: number;
  diminishingMultiplier: number;
  recencyWeight: number;
  daysSinceEvent: number;
  complexityMultiplier: number;
  categoryMultiplier: number;
  streakMultiplier: number;
  severityMultiplier: number;
  weightedPoints: number;
  cappedBy?: number;
  finalPoints: number;
}

export interface ScoreBreakdown {
  rawPoints: number;
  diminishingFactor: number;
  recencyWeightedPoints: number;
  streakMultiplier: number;
  velocityPenalty: number;
  inactivityDecay: number;
  manualAdjustment: number;
  eventDetails: EventBreakdown[];
}

export interface TrustScoreResult {
  score: number;
  tier: TrustTier;
  tierInfo: TierConfig;
  breakdown: ScoreBreakdown;
  warnings: string[];
}

export interface ScoreHistoryPoint {
  timestamp: number;
  score: number;
}

export const DEFAULT_CONFIG: TrustScoringConfig = {
  basePoints: {
    approve: 12,
    reject: -6,
    close: -5,
    selfClose: -2,
  },
  diminishingRate: 0.2,
  recencyHalfLifeDays: 45,
  complexityBuckets: [
    { maxLines: 10, multiplier: 0.4, label: "trivial" },
    { maxLines: 50, multiplier: 0.7, label: "small" },
    { maxLines: 150, multiplier: 1.0, label: "medium" },
    { maxLines: 500, multiplier: 1.3, label: "large" },
    { maxLines: 1500, multiplier: 1.5, label: "xlarge" },
    { maxLines: Number.POSITIVE_INFINITY, multiplier: 1.2, label: "massive" },
  ],
  categoryWeights: {
    security: 1.8,
    "critical-fix": 1.5,
    core: 1.3,
    feature: 1.1,
    bugfix: 1.0,
    refactor: 0.9,
    docs: 0.6,
    chore: 0.5,
    aesthetic: 0.4,
    test: 0.8,
  },
  defaultCategoryWeight: 0.8,
  streaks: {
    approvalBonus: 0.08,
    approvalMaxBonus: 0.5,
    rejectionPenalty: 0.15,
    rejectionMaxPenalty: 2.5,
  },
  inactivityDecay: {
    gracePeriodDays: 10,
    decayRatePerDay: 0.005,
    decayFloor: 30,
    decayTarget: 40,
  },
  velocity: {
    windowDays: 7,
    softCapPRs: 15,
    hardCapPRs: 40,
    penaltyPerExcess: 0.15,
  },
  reviewSeverity: {
    critical: 1.8,
    major: 1.3,
    normal: 1.0,
    minor: 0.5,
    trivial: 0.3,
  },
  defaultReviewSeverity: "normal",
  minScore: 0,
  maxScore: 100,
  initialScore: 35,
  dailyPointCap: 50,
  tiers: [
    { minScore: 90, label: "legendary", description: "Elite contributor, auto-merge eligible" },
    { minScore: 75, label: "trusted", description: "Highly trusted, expedited review" },
    { minScore: 60, label: "established", description: "Proven track record" },
    { minScore: 45, label: "contributing", description: "Active contributor, standard review" },
    { minScore: 30, label: "probationary", description: "Building trust, closer scrutiny" },
    { minScore: 15, label: "untested", description: "New or low-activity contributor" },
    { minScore: 0, label: "restricted", description: "Trust deficit, requires sponsor review" },
  ],
};

export function computeTrustScore(
  history: ContributorState,
  config: TrustScoringConfig = DEFAULT_CONFIG,
  now: number = Date.now(),
): TrustScoreResult {
  const { events = [], manualAdjustment = 0 } = history;
  const warnings: string[] = [];
  const breakdown: ScoreBreakdown = {
    rawPoints: 0,
    diminishingFactor: 0,
    recencyWeightedPoints: 0,
    streakMultiplier: 1,
    velocityPenalty: 0,
    inactivityDecay: 0,
    manualAdjustment: 0,
    eventDetails: [],
  };

  if (events.length === 0) {
    const score = config.initialScore;
    return {
      score,
      tier: getTier(score, config).label,
      tierInfo: getTier(score, config),
      breakdown,
      warnings: ["No events recorded — using initial score"],
    };
  }

  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);

  // Detect superseded closes: if a close/selfClose is followed by an approve
  // from the same contributor within 24 hours, treat the close as superseded (-2)
  const SUPERSEDE_WINDOW_MS = 24 * 60 * 60 * 1000;
  const supersededPRs = new Set<number>();
  for (let i = 0; i < sorted.length; i++) {
    const ev = sorted[i];
    if (ev.type !== "close" && ev.type !== "selfClose") continue;
    // Look ahead for an approve within 24h
    for (let j = i + 1; j < sorted.length; j++) {
      const next = sorted[j];
      if (next.timestamp - ev.timestamp > SUPERSEDE_WINDOW_MS) break;
      if (next.type === "approve") {
        supersededPRs.add(ev.prNumber);
        break;
      }
    }
  }

  let approvalCount = 0;
  const currentStreak: { type: "approve" | "negative" | null; length: number } = {
    type: null,
    length: 0,
  };
  const dailyPoints: Record<string, number> = {};
  let totalWeightedPoints = 0;

  for (const event of sorted) {
    const detail: EventBreakdown = {
      prNumber: event.prNumber,
      type: event.type,
      basePoints: 0,
      diminishingMultiplier: 1,
      recencyWeight: 1,
      daysSinceEvent: 0,
      complexityMultiplier: 1,
      categoryMultiplier: 1,
      streakMultiplier: 1,
      severityMultiplier: 1,
      weightedPoints: 0,
      finalPoints: 0,
    };

    const isSuperseded = (event.type === "close" || event.type === "selfClose") && supersededPRs.has(event.prNumber);
    const basePoints = isSuperseded ? -2 : (config.basePoints[event.type] ?? 0);
    detail.basePoints = basePoints;

    let diminishingMultiplier = 1;
    if (basePoints > 0) {
      diminishingMultiplier = 1 / (1 + config.diminishingRate * Math.log(1 + approvalCount));
      approvalCount++;
    }
    detail.diminishingMultiplier = round(diminishingMultiplier, 4);

    const daysSinceEvent = (now - event.timestamp) / (1000 * 60 * 60 * 24);
    const recencyWeight = 0.5 ** (daysSinceEvent / config.recencyHalfLifeDays);
    detail.recencyWeight = round(recencyWeight, 4);
    detail.daysSinceEvent = round(daysSinceEvent, 1);

    const complexityMultiplier = getComplexityMultiplier(event.linesChanged || 0, config);
    detail.complexityMultiplier = complexityMultiplier;

    const categoryMultiplier = getCategoryMultiplier(event.labels || [], config);
    detail.categoryMultiplier = categoryMultiplier;

    const streakMult = updateStreak(currentStreak, event.type, config);
    detail.streakMultiplier = round(streakMult, 4);

    let severityMultiplier = 1;
    if (event.type === "reject" && event.reviewSeverity) {
      severityMultiplier =
        config.reviewSeverity[event.reviewSeverity] ??
        config.reviewSeverity[config.defaultReviewSeverity];
    }
    detail.severityMultiplier = severityMultiplier;

    let eventPoints: number;
    if (basePoints >= 0) {
      eventPoints =
        basePoints *
        diminishingMultiplier *
        recencyWeight *
        complexityMultiplier *
        categoryMultiplier *
        streakMult;
    } else {
      eventPoints =
        basePoints *
        recencyWeight *
        severityMultiplier *
        streakMult *
        Math.max(categoryMultiplier, 0.8);
    }

    detail.weightedPoints = round(eventPoints, 4);

    if (eventPoints > 0) {
      const dateKey = new Date(event.timestamp).toISOString().slice(0, 10);
      const currentDayTotal = dailyPoints[dateKey] || 0;
      const remaining = Math.max(0, config.dailyPointCap - currentDayTotal);
      const capped = Math.min(eventPoints, remaining);
      if (capped < eventPoints) {
        detail.cappedBy = round(eventPoints - capped, 4);
        warnings.push(
          `Daily cap hit on ${dateKey}: PR #${event.prNumber} capped from ${round(eventPoints, 2)} to ${round(capped, 2)}`,
        );
      }
      dailyPoints[dateKey] = currentDayTotal + capped;
      eventPoints = capped;
    }

    detail.finalPoints = round(eventPoints, 4);
    totalWeightedPoints += eventPoints;
    breakdown.eventDetails.push(detail);
  }

  breakdown.recencyWeightedPoints = round(totalWeightedPoints, 4);

  const recentWindow = now - config.velocity.windowDays * 24 * 60 * 60 * 1000;
  const recentPRs = sorted.filter((e) => e.timestamp >= recentWindow).length;
  let velocityMultiplier = 1;

  if (recentPRs > config.velocity.hardCapPRs) {
    velocityMultiplier = 0;
    warnings.push(
      `VELOCITY HARD CAP: ${recentPRs} PRs in ${config.velocity.windowDays} days (limit: ${config.velocity.hardCapPRs})`,
    );
  } else if (recentPRs > config.velocity.softCapPRs) {
    const excess = recentPRs - config.velocity.softCapPRs;
    velocityMultiplier = Math.max(0.1, 1 - excess * config.velocity.penaltyPerExcess);
    warnings.push(
      `Velocity warning: ${recentPRs} PRs in ${config.velocity.windowDays} days (soft cap: ${config.velocity.softCapPRs})`,
    );
  }

  breakdown.velocityPenalty = round(1 - velocityMultiplier, 4);

  const adjustedPoints = totalWeightedPoints > 0 ? totalWeightedPoints * velocityMultiplier : totalWeightedPoints;

  let score = config.initialScore + adjustedPoints;

  const lastEventTime = sorted[sorted.length - 1].timestamp;
  const daysSinceLastEvent = (now - lastEventTime) / (1000 * 60 * 60 * 24);

  if (daysSinceLastEvent > config.inactivityDecay.gracePeriodDays) {
    const decayDays = daysSinceLastEvent - config.inactivityDecay.gracePeriodDays;
    const decayAmount = decayDays * config.inactivityDecay.decayRatePerDay;
    const target = config.inactivityDecay.decayTarget;
    if (score > target) {
      const maxDecay = score - Math.max(target, config.inactivityDecay.decayFloor);
      const actualDecay = Math.min(maxDecay, (score - target) * decayAmount);
      score -= actualDecay;
      breakdown.inactivityDecay = round(actualDecay, 4);
    }
  }

  if (manualAdjustment !== 0) {
    const clampedAdj = Math.max(-50, Math.min(50, manualAdjustment));
    score += clampedAdj;
    breakdown.manualAdjustment = clampedAdj;
  }

  score = Math.max(config.minScore, Math.min(config.maxScore, score));
  score = round(score, 2);

  const tierInfo = getTier(score, config);

  return {
    score,
    tier: tierInfo.label,
    tierInfo,
    breakdown,
    warnings,
  };
}

export function computeScoreHistory(
  history: ContributorState,
  config: TrustScoringConfig = DEFAULT_CONFIG,
  now: number = Date.now(),
): ScoreHistoryPoint[] {
  const sorted = [...(history.events ?? [])].sort((a, b) => a.timestamp - b.timestamp);

  if (sorted.length === 0) {
    return [{ timestamp: now, score: config.initialScore }];
  }

  const points: ScoreHistoryPoint[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const sliceHistory: ContributorState = {
      ...history,
      events: sorted.slice(0, i + 1),
    };
    const eventTimestamp = sorted[i].timestamp;
    const result = computeTrustScore(sliceHistory, config, eventTimestamp);
    points.push({ timestamp: eventTimestamp, score: result.score });
  }

  return points;
}

export function getComplexityMultiplier(linesChanged: number, config: TrustScoringConfig): number {
  for (const bucket of config.complexityBuckets) {
    if (linesChanged <= bucket.maxLines) {
      return bucket.multiplier;
    }
  }
  return 1.0;
}

export function getCategoryMultiplier(labels: string[], config: TrustScoringConfig): number {
  if (!labels || labels.length === 0) return config.defaultCategoryWeight;

  let maxWeight = 0;
  let found = false;
  for (const label of labels) {
    const normalizedLabel = label.toLowerCase().replace(/\s+/g, "-");
    if (config.categoryWeights[normalizedLabel] !== undefined) {
      maxWeight = Math.max(maxWeight, config.categoryWeights[normalizedLabel]);
      found = true;
    }
  }
  return found ? maxWeight : config.defaultCategoryWeight;
}

export function updateStreak(
  currentStreak: { type: "approve" | "negative" | null; length: number },
  eventType: EventType,
  config: TrustScoringConfig,
): number {
  const isPositive = eventType === "approve";
  const isNegative = eventType === "reject" || eventType === "close";

  if (isPositive) {
    if (currentStreak.type === "approve") {
      currentStreak.length++;
    } else {
      currentStreak.type = "approve";
      currentStreak.length = 1;
    }

    const bonus = Math.min(
      (currentStreak.length - 1) * config.streaks.approvalBonus,
      config.streaks.approvalMaxBonus,
    );
    return 1 + bonus;
  }

  if (isNegative) {
    if (currentStreak.type === "negative") {
      currentStreak.length++;
    } else {
      currentStreak.type = "negative";
      currentStreak.length = 1;
    }

    const penalty = Math.min(
      1 + (currentStreak.length - 1) * config.streaks.rejectionPenalty,
      config.streaks.rejectionMaxPenalty,
    );
    return penalty;
  }

  return 1;
}

export function getTier(score: number, config: TrustScoringConfig = DEFAULT_CONFIG): TierConfig {
  for (const tier of config.tiers) {
    if (score >= tier.minScore) {
      return tier;
    }
  }
  return config.tiers[config.tiers.length - 1];
}

export function round(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

export function createContributorState(contributor: string): ContributorState {
  return {
    contributor,
    createdAt: Date.now(),
    events: [],
    manualAdjustment: 0,
  };
}

export function addEvent(
  state: ContributorState,
  event: Partial<TrustEvent> & Pick<TrustEvent, "type" | "prNumber">,
  maxEvents = 150,
): ContributorState {
  state.events.push({
    type: event.type,
    timestamp: event.timestamp ?? Date.now(),
    linesChanged: event.linesChanged ?? 0,
    labels: event.labels ?? [],
    reviewSeverity: event.reviewSeverity,
    prNumber: event.prNumber,
    filesChanged: event.filesChanged,
  });

  if (state.events.length > maxEvents) {
    state.events = state.events.slice(state.events.length - maxEvents);
  }

  return state;
}

interface CompactEvent {
  y: string;
  ts: number;
  l: number;
  lb: string[];
  rs?: string;
  p: number;
}

export interface CompactState {
  c: string;
  t: number;
  m: number;
  e: CompactEvent[];
}

export function compactState(state: ContributorState): CompactState {
  return {
    c: state.contributor,
    t: state.createdAt,
    m: state.manualAdjustment || 0,
    e: state.events.map((e) => ({
      y: e.type[0],
      ts: e.timestamp,
      l: e.linesChanged,
      lb: e.labels,
      ...(e.reviewSeverity ? { rs: e.reviewSeverity[0] } : {}),
      p: e.prNumber,
    })),
  };
}

export function expandState(compact: CompactState): ContributorState {
  const typeMap: Record<string, EventType> = {
    a: "approve",
    r: "reject",
    c: "close",
    s: "selfClose",
  };
  const severityMap: Record<string, ReviewSeverity> = {
    c: "critical",
    m: "major",
    n: "normal",
    i: "minor",
    t: "trivial",
  };

  return {
    contributor: compact.c,
    createdAt: compact.t,
    manualAdjustment: compact.m || 0,
    events: compact.e.map((e) => ({
      type: typeMap[e.y] ?? (e.y as EventType),
      timestamp: e.ts,
      linesChanged: e.l,
      labels: e.lb || [],
      reviewSeverity: e.rs ? severityMap[e.rs] ?? (e.rs as ReviewSeverity) : undefined,
      prNumber: e.p,
    })),
  };
}
