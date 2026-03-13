/**
 * trust-scoring.js — Contributor Trust Scoring System for milady-ai/milaidy
 *
 * A robust, game-theory-resistant trust scoring algorithm for an agents-only
 * GitHub repository. Produces a score 0-100 and a tier label.
 *
 * Design principles:
 *   - Diminishing returns prevent grinding
 *   - Recency weighting keeps scores relevant
 *   - Complexity awareness rewards meaningful contributions
 *   - Velocity gates detect suspicious burst activity
 *   - Streak mechanics reward consistency, punish repeated failures
 *   - Time decay prevents stale trust from accumulating
 *   - Deterministic: same inputs always produce the same output
 *
 * Usage in GitHub Actions (actions/github-script):
 *   const { computeTrustScore, DEFAULT_CONFIG, getTier } = require('./.github/trust-scoring.js');
 *   const history = JSON.parse(contributorState); // from repo variable
 *   const result = computeTrustScore(history, DEFAULT_CONFIG);
 *   console.log(`Score: ${result.score}, Tier: ${result.tier}`);
 *
 * State is stored as JSON in a GitHub repo variable (<48KB limit).
 * Each contributor gets a compact event history array.
 */

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG = {
  // --- Base point values ---
  basePoints: {
    approve: 12, // PR approved and merged
    reject: -6, // PR rejected (REQUEST_CHANGES)
    close: -5, // PR closed without merge (reduced from -10 in v3)
    selfClose: -2, // Contributor closed their own PR (less punitive)
  },

  // --- Diminishing returns (logarithmic scaling) ---
  // Rate lowered to 0.08 in v3 for high-velocity repos
  diminishingRate: 0.08,

  // --- Recency weighting (exponential decay) ---
  // Half-life increased to 60 days in v3 to be less punitive
  recencyHalfLifeDays: 60,

  // --- PR complexity/size multipliers ---
  complexityBuckets: [
    { maxLines: 10, multiplier: 0.4, label: "trivial" },
    { maxLines: 50, multiplier: 0.7, label: "small" },
    { maxLines: 150, multiplier: 1.0, label: "medium" },
    { maxLines: 500, multiplier: 1.3, label: "large" },
    { maxLines: 1500, multiplier: 1.5, label: "xlarge" },
    { maxLines: Infinity, multiplier: 1.2, label: "massive" },
  ],

  // --- Category weighting (based on PR labels) ---
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

  // --- Streak mechanics ---
  streaks: {
    approvalBonus: 0.08,
    approvalMaxBonus: 0.5,
    rejectionPenalty: 0.15,
    rejectionMaxPenalty: 2.5,
  },

  // --- Time decay (inactivity) ---
  inactivityDecay: {
    gracePeriodDays: 10,
    decayRatePerDay: 0.005,
    decayFloor: 30,
    decayTarget: 40,
  },

  // --- Velocity gates ---
  // Caps raised significantly in v3 for high-velocity repos
  velocity: {
    windowDays: 7,
    softCapPRs: 80, // raised from 10 in v2
    hardCapPRs: 200, // raised from 25 in v2
    penaltyPerExcess: 0.03, // reduced from 0.15 in v2
  },

  // --- Review severity ---
  reviewSeverity: {
    critical: 1.8,
    major: 1.3,
    normal: 1.0,
    minor: 0.5,
    trivial: 0.3,
  },
  defaultReviewSeverity: "normal",

  // --- Score boundaries ---
  minScore: 0,
  maxScore: 100,
  initialScore: 40, // raised from 35 in v3

  // --- Daily point cap ---
  dailyPointCap: 80, // raised from 35 in v3

  // --- Tier thresholds ---
  tiers: [
    {
      minScore: 90,
      label: "legendary",
      description: "Elite contributor, auto-merge eligible",
    },
    {
      minScore: 75,
      label: "trusted",
      description: "Highly trusted, expedited review",
    },
    { minScore: 60, label: "established", description: "Proven track record" },
    {
      minScore: 45,
      label: "contributing",
      description: "Active contributor, standard review",
    },
    {
      minScore: 30,
      label: "probationary",
      description: "Building trust, closer scrutiny",
    },
    {
      minScore: 15,
      label: "untested",
      description: "New or low-activity contributor",
    },
    {
      minScore: 0,
      label: "restricted",
      description: "Trust deficit, requires sponsor review",
    },
  ],
};

// ============================================================================
// CORE ALGORITHM
// ============================================================================

/**
 * Compute the trust score for a contributor based on their event history.
 *
 * @param {Object} history - Contributor's event history
 * @param {string} history.contributor - GitHub username
 * @param {number} history.createdAt - Unix timestamp (ms) when first seen
 * @param {Array} history.events - Array of event objects (see below)
 * @param {number} [history.manualAdjustment] - Manual score adjustment (-50 to +50)
 * @param {Object} config - Configuration object (use DEFAULT_CONFIG)
 * @param {number} now - Current timestamp in ms (for determinism, pass explicitly)
 * @returns {Object} { score, tier, tierInfo, breakdown, warnings }
 *
 * Event object shape:
 * {
 *   type: 'approve' | 'reject' | 'close' | 'selfClose',
 *   timestamp: number,          // Unix ms
 *   linesChanged: number,       // additions + deletions
 *   labels: string[],           // PR labels
 *   reviewSeverity?: string,    // for rejections: 'critical'|'major'|'normal'|'minor'|'trivial'
 *   prNumber: number,           // for deduplication
 *   filesChanged?: number,      // optional, for future use
 * }
 */
function computeTrustScore(history, config = DEFAULT_CONFIG, now = Date.now()) {
  const { events = [], manualAdjustment = 0 } = history;
  const warnings = [];
  const breakdown = {
    rawPoints: 0,
    diminishingFactor: 0,
    recencyWeightedPoints: 0,
    streakMultiplier: 1,
    velocityPenalty: 0,
    inactivityDecay: 0,
    manualAdjustment: 0,
    approveRateBonus: 0,
    volumeBonus: 0,
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

  // Sort events chronologically (oldest first)
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);

  // Build the set of superseded close/selfClose events:
  // If a close/selfClose is followed by an approve on the same PR within 24h,
  // the close penalty is reduced to -2 (they fixed it quickly).
  const SUPERSEDE_WINDOW_MS = 24 * 60 * 60 * 1000;
  const supersededPRs = new Set();
  for (let i = 0; i < sorted.length; i++) {
    const ev = sorted[i];
    if (ev.type !== "close" && ev.type !== "selfClose") continue;
    for (let j = i + 1; j < sorted.length; j++) {
      const next = sorted[j];
      if (next.timestamp - ev.timestamp > SUPERSEDE_WINDOW_MS) break;
      if (next.type === "approve") {
        supersededPRs.add(ev.prNumber);
        break;
      }
    }
  }

  // --- Phase 1: Compute per-event weighted points ---
  let approvalCount = 0;
  let closeCount = 0;
  const currentStreak = { type: null, length: 0 };
  const dailyPoints = {}; // dateKey -> accumulated positive points
  let totalWeightedPoints = 0;

  for (const event of sorted) {
    const detail = { prNumber: event.prNumber, type: event.type };

    // 1a. Base points (superseded closes get a reduced penalty)
    const isSuperseded =
      (event.type === "close" || event.type === "selfClose") &&
      supersededPRs.has(event.prNumber);
    const basePoints = isSuperseded ? -2 : (config.basePoints[event.type] || 0);
    detail.basePoints = basePoints;

    // 1b. Diminishing returns (applies to both positive AND negative events in v3)
    let diminishingMultiplier = 1;
    if (basePoints > 0) {
      diminishingMultiplier =
        1 / (1 + config.diminishingRate * Math.log(1 + approvalCount));
      approvalCount++;
    } else if (basePoints < 0 && (event.type === "close" || event.type === "selfClose" || event.type === "reject")) {
      diminishingMultiplier =
        1 / (1 + config.diminishingRate * Math.log(1 + closeCount));
      closeCount++;
    }
    detail.diminishingMultiplier = round(diminishingMultiplier, 4);

    // 1c. Recency weighting
    const daysSinceEvent = (now - event.timestamp) / (1000 * 60 * 60 * 24);
    const recencyWeight = 0.5 ** (daysSinceEvent / config.recencyHalfLifeDays);
    detail.recencyWeight = round(recencyWeight, 4);
    detail.daysSinceEvent = round(daysSinceEvent, 1);

    // 1d. Complexity multiplier
    const complexityMultiplier = getComplexityMultiplier(
      event.linesChanged || 0,
      config,
    );
    detail.complexityMultiplier = complexityMultiplier;

    // 1e. Category multiplier
    const categoryMultiplier = getCategoryMultiplier(
      event.labels || [],
      config,
    );
    detail.categoryMultiplier = categoryMultiplier;

    // 1f. Streak multiplier
    const streakMult = updateStreak(currentStreak, event.type, config);
    detail.streakMultiplier = round(streakMult, 4);

    // 1g. Review severity (for rejections only)
    let severityMultiplier = 1;
    if (event.type === "reject" && event.reviewSeverity) {
      severityMultiplier =
        config.reviewSeverity[event.reviewSeverity] ||
        config.reviewSeverity[config.defaultReviewSeverity];
    }
    detail.severityMultiplier = severityMultiplier;

    // --- Combine all multipliers ---
    let eventPoints;
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
        diminishingMultiplier *
        recencyWeight *
        severityMultiplier *
        streakMult *
        Math.max(categoryMultiplier, 0.8);
    }

    detail.weightedPoints = round(eventPoints, 4);

    // 1h. Daily cap enforcement (positive points only)
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

  // --- Phase 2: Velocity gate ---
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
    velocityMultiplier = Math.max(
      0.1,
      1 - excess * config.velocity.penaltyPerExcess,
    );
    warnings.push(
      `Velocity warning: ${recentPRs} PRs in ${config.velocity.windowDays} days (soft cap: ${config.velocity.softCapPRs})`,
    );
  }

  breakdown.velocityPenalty = round(1 - velocityMultiplier, 4);

  const adjustedPoints =
    totalWeightedPoints > 0
      ? totalWeightedPoints * velocityMultiplier
      : totalWeightedPoints;

  // --- Phase 2b: Approve-rate bonus ---
  // Reward contributors who consistently get PRs merged
  let approveRateBonus = 0;
  const totalEvents = approvalCount + closeCount;
  if (totalEvents > 0 && approvalCount > 0) {
    const approveRate = approvalCount / totalEvents;
    let rateMultiplier = 1;
    if (approveRate >= 0.9) rateMultiplier = 1.5;
    else if (approveRate >= 0.8) rateMultiplier = 1.3;
    else if (approveRate >= 0.7) rateMultiplier = 1.2;
    else if (approveRate >= 0.6) rateMultiplier = 1.1;
    if (rateMultiplier > 1) {
      const positivePoints = breakdown.eventDetails
        .filter((d) => d.finalPoints > 0)
        .reduce((sum, d) => sum + d.finalPoints, 0);
      const boostedPositive = positivePoints * velocityMultiplier * rateMultiplier;
      const originalPositive = positivePoints * velocityMultiplier;
      approveRateBonus = round(boostedPositive - originalPositive, 4);
    }
  }
  breakdown.approveRateBonus = approveRateBonus;

  // --- Phase 2c: Volume bonus ---
  const volumeBonus = round(Math.min(10, Math.sqrt(approvalCount) * 1.5), 4);
  breakdown.volumeBonus = volumeBonus;

  // --- Phase 3: Convert points to score ---
  let score = config.initialScore + adjustedPoints + approveRateBonus + volumeBonus;

  // --- Phase 4: Inactivity decay ---
  const lastEventTime = sorted[sorted.length - 1].timestamp;
  const daysSinceLastEvent = (now - lastEventTime) / (1000 * 60 * 60 * 24);

  if (daysSinceLastEvent > config.inactivityDecay.gracePeriodDays) {
    const decayDays =
      daysSinceLastEvent - config.inactivityDecay.gracePeriodDays;
    const decayAmount = decayDays * config.inactivityDecay.decayRatePerDay;
    const target = config.inactivityDecay.decayTarget;
    if (score > target) {
      const maxDecay =
        score - Math.max(target, config.inactivityDecay.decayFloor);
      const actualDecay = Math.min(maxDecay, (score - target) * decayAmount);
      score -= actualDecay;
      breakdown.inactivityDecay = round(actualDecay, 4);
    }
  }

  // --- Phase 5: Manual adjustment ---
  if (manualAdjustment !== 0) {
    const clampedAdj = Math.max(-50, Math.min(50, manualAdjustment));
    score += clampedAdj;
    breakdown.manualAdjustment = clampedAdj;
  }

  // --- Phase 6: Final clamp ---
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

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get complexity multiplier based on lines changed.
 */
function getComplexityMultiplier(linesChanged, config) {
  for (const bucket of config.complexityBuckets) {
    if (linesChanged <= bucket.maxLines) {
      return bucket.multiplier;
    }
  }
  return 1.0; // fallback
}

/**
 * Get category multiplier from PR labels. Highest multiplier wins.
 */
function getCategoryMultiplier(labels, config) {
  if (!labels || labels.length === 0) return config.defaultCategoryWeight;

  // Common label aliases used in milady-ai repos
  const labelAliases = {
    tests: "test",
    testing: "test",
    documentation: "docs",
    bug: "bugfix",
    fix: "bugfix",
  };

  let maxWeight = 0;
  let found = false;
  for (const label of labels) {
    let normalized = label.toLowerCase().replace(/\s+/g, "-");
    // Strip "category:" prefix used in milady-ai/milady labels (e.g. "category:security")
    if (normalized.startsWith("category:")) {
      normalized = normalized.slice("category:".length);
    }
    // Apply aliases
    normalized = labelAliases[normalized] ?? normalized;
    if (config.categoryWeights[normalized] !== undefined) {
      maxWeight = Math.max(maxWeight, config.categoryWeights[normalized]);
      found = true;
    }
  }
  return found ? maxWeight : config.defaultCategoryWeight;
}

/**
 * Update streak state and return the streak multiplier for this event.
 * Mutates currentStreak in place.
 *
 * Approvals: additive bonus up to cap
 * Rejections/closes: compounding penalty up to cap
 */
function updateStreak(currentStreak, eventType, config) {
  const isPositive = eventType === "approve";
  const isNegative = eventType === "reject" || eventType === "close";

  if (isPositive) {
    if (currentStreak.type === "approve") {
      currentStreak.length++;
    } else {
      currentStreak.type = "approve";
      currentStreak.length = 1;
    }
    // Additive bonus: 1 + min(length * bonus, maxBonus)
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
    // Compounding penalty: min(1 + length * penalty, maxPenalty)
    const penalty = Math.min(
      1 + (currentStreak.length - 1) * config.streaks.rejectionPenalty,
      config.streaks.rejectionMaxPenalty,
    );
    return penalty; // applied to negative base points, making them more negative
  }

  // selfClose doesn't affect streaks
  return 1;
}

/**
 * Get the tier for a given score.
 */
function getTier(score, config = DEFAULT_CONFIG) {
  for (const tier of config.tiers) {
    if (score >= tier.minScore) {
      return tier;
    }
  }
  return config.tiers[config.tiers.length - 1];
}

/**
 * Round to N decimal places.
 */
function round(n, decimals) {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

// ============================================================================
// STATE MANAGEMENT HELPERS
// ============================================================================

/**
 * Create a fresh contributor state object.
 */
function createContributorState(contributor) {
  return {
    contributor,
    createdAt: Date.now(),
    events: [],
    manualAdjustment: 0,
  };
}

/**
 * Add an event to a contributor's history.
 * Keeps only the most recent N events to stay under the 48KB repo variable limit.
 * With ~200 bytes per event, 200 events per contributor ≈ 40KB for ~1 contributor.
 * For multi-contributor storage, reduce maxEvents.
 */
function addEvent(state, event, maxEvents = 150) {
  state.events.push({
    type: event.type,
    timestamp: event.timestamp || Date.now(),
    linesChanged: event.linesChanged || 0,
    labels: event.labels || [],
    reviewSeverity: event.reviewSeverity || undefined,
    prNumber: event.prNumber,
  });

  // Prune oldest events if over limit
  if (state.events.length > maxEvents) {
    state.events = state.events.slice(state.events.length - maxEvents);
  }

  return state;
}

/**
 * Compact state for storage. Strips undefined fields, shortens keys.
 * Use when approaching the 48KB limit.
 */
function compactState(state) {
  return {
    c: state.contributor,
    t: state.createdAt,
    m: state.manualAdjustment || 0,
    e: state.events.map((e) => ({
      y: e.type[0], // a=approve, r=reject, c=close, s=selfClose
      ts: e.timestamp,
      l: e.linesChanged,
      lb: e.labels,
      ...(e.reviewSeverity ? { rs: e.reviewSeverity[0] } : {}),
      p: e.prNumber,
    })),
  };
}

/**
 * Expand compacted state back to full form.
 */
function expandState(compact) {
  const typeMap = { a: "approve", r: "reject", c: "close", s: "selfClose" };
  const severityMap = {
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
      type: typeMap[e.y] || e.y,
      timestamp: e.ts,
      linesChanged: e.l,
      labels: e.lb || [],
      reviewSeverity: e.rs ? severityMap[e.rs] || e.rs : undefined,
      prNumber: e.p,
    })),
  };
}

// ============================================================================
// EXAMPLE SCENARIOS
// ============================================================================

/**
 * Run example scenarios to demonstrate scoring behavior.
 * Call with: node trust-scoring.js --examples
 */
function runExamples() {
  const NOW = new Date("2026-02-14T18:00:00Z").getTime();
  const DAY = 24 * 60 * 60 * 1000;

  console.log("=".repeat(70));
  console.log("TRUST SCORING SYSTEM — EXAMPLE SCENARIOS");
  console.log("=".repeat(70));

  // --- Scenario 1: Steady Eddie ---
  // 10 approvals over 3 months, mixed sizes, all clean
  const steadyEddie = {
    contributor: "steady-eddie",
    createdAt: NOW - 90 * DAY,
    events: Array.from({ length: 10 }, (_, i) => ({
      type: "approve",
      timestamp: NOW - (90 - i * 9) * DAY,
      linesChanged: 50 + i * 30,
      labels: ["bugfix"],
      prNumber: 100 + i,
    })),
  };
  printScenario(
    "Scenario 1: Steady Eddie",
    "10 approvals over 90 days, growing complexity",
    steadyEddie,
    NOW,
  );

  // --- Scenario 2: Speed Demon ---
  // 8 PRs in 3 days, all approved (gaming attempt)
  const speedDemon = {
    contributor: "speed-demon",
    createdAt: NOW - 3 * DAY,
    events: Array.from({ length: 8 }, (_, i) => ({
      type: "approve",
      timestamp: NOW - 3 * DAY + i * (8 * 60 * 60 * 1000), // every 8 hours
      linesChanged: 15,
      labels: ["chore"],
      prNumber: 200 + i,
    })),
  };
  printScenario(
    "Scenario 2: Speed Demon",
    "8 trivial chore PRs in 3 days (gaming)",
    speedDemon,
    NOW,
  );

  // --- Scenario 3: Security Hero ---
  // 3 security fixes, all approved, moderate pace
  const securityHero = {
    contributor: "security-hero",
    createdAt: NOW - 60 * DAY,
    events: [
      {
        type: "approve",
        timestamp: NOW - 50 * DAY,
        linesChanged: 200,
        labels: ["security"],
        prNumber: 300,
      },
      {
        type: "approve",
        timestamp: NOW - 30 * DAY,
        linesChanged: 350,
        labels: ["security", "critical-fix"],
        prNumber: 301,
      },
      {
        type: "approve",
        timestamp: NOW - 10 * DAY,
        linesChanged: 150,
        labels: ["security"],
        prNumber: 302,
      },
    ],
  };
  printScenario(
    "Scenario 3: Security Hero",
    "3 security fixes over 2 months",
    securityHero,
    NOW,
  );

  // --- Scenario 4: Rough Start ---
  // First 3 PRs rejected, then 5 approved
  const roughStart = {
    contributor: "rough-start",
    createdAt: NOW - 60 * DAY,
    events: [
      {
        type: "reject",
        timestamp: NOW - 55 * DAY,
        linesChanged: 100,
        labels: ["feature"],
        prNumber: 400,
        reviewSeverity: "major",
      },
      {
        type: "reject",
        timestamp: NOW - 50 * DAY,
        linesChanged: 80,
        labels: ["feature"],
        prNumber: 401,
        reviewSeverity: "normal",
      },
      {
        type: "close",
        timestamp: NOW - 48 * DAY,
        linesChanged: 200,
        labels: ["feature"],
        prNumber: 402,
      },
      {
        type: "approve",
        timestamp: NOW - 40 * DAY,
        linesChanged: 60,
        labels: ["bugfix"],
        prNumber: 403,
      },
      {
        type: "approve",
        timestamp: NOW - 30 * DAY,
        linesChanged: 120,
        labels: ["bugfix"],
        prNumber: 404,
      },
      {
        type: "approve",
        timestamp: NOW - 20 * DAY,
        linesChanged: 200,
        labels: ["feature"],
        prNumber: 405,
      },
      {
        type: "approve",
        timestamp: NOW - 10 * DAY,
        linesChanged: 180,
        labels: ["feature"],
        prNumber: 406,
      },
      {
        type: "approve",
        timestamp: NOW - 5 * DAY,
        linesChanged: 250,
        labels: ["core"],
        prNumber: 407,
      },
    ],
  };
  printScenario(
    "Scenario 4: Rough Start",
    "3 rejections then 5 approvals (redemption arc)",
    roughStart,
    NOW,
  );

  // --- Scenario 5: Gone Ghost ---
  // Good contributor who went inactive 120 days ago
  const goneGhost = {
    contributor: "gone-ghost",
    createdAt: NOW - 200 * DAY,
    events: Array.from({ length: 8 }, (_, i) => ({
      type: "approve",
      timestamp: NOW - (200 - i * 10) * DAY,
      linesChanged: 100 + i * 20,
      labels: ["feature"],
      prNumber: 500 + i,
    })),
  };
  printScenario(
    "Scenario 5: Gone Ghost",
    "8 approvals but last activity 120+ days ago",
    goneGhost,
    NOW,
  );

  // --- Scenario 6: Typo Farmer ---
  // Many tiny documentation PRs (trying to game via volume)
  const typoFarmer = {
    contributor: "typo-farmer",
    createdAt: NOW - 30 * DAY,
    events: Array.from({ length: 15 }, (_, i) => ({
      type: "approve",
      timestamp: NOW - (30 - i * 2) * DAY,
      linesChanged: 3 + Math.floor(Math.random() * 5),
      labels: ["docs"],
      prNumber: 600 + i,
    })),
  };
  printScenario(
    "Scenario 6: Typo Farmer",
    "15 tiny doc PRs over 30 days (gaming via volume)",
    typoFarmer,
    NOW,
  );

  // --- Scenario 7: Brand New ---
  // Just arrived, no PRs
  const brandNew = {
    contributor: "brand-new",
    createdAt: NOW,
    events: [],
  };
  printScenario("Scenario 7: Brand New", "No PRs yet", brandNew, NOW);
}

function printScenario(name, description, history, now) {
  console.log(`\n${"—".repeat(70)}`);
  console.log(`${name}`);
  console.log(`${description}`);
  console.log(`${"—".repeat(70)}`);

  const result = computeTrustScore(history, DEFAULT_CONFIG, now);
  console.log(`Score: ${result.score} / 100`);
  console.log(`Tier:  ${result.tier} — ${result.tierInfo.description}`);

  if (result.warnings.length > 0) {
    console.log(`Warnings:`);
    result.warnings.forEach((w) => {
      console.log(`  ⚠ ${w}`);
    });
  }

  console.log(`Breakdown:`);
  console.log(
    `  Weighted points sum: ${result.breakdown.recencyWeightedPoints}`,
  );
  console.log(
    `  Velocity penalty:    ${(result.breakdown.velocityPenalty * 100).toFixed(1)}%`,
  );
  console.log(`  Inactivity decay:    ${result.breakdown.inactivityDecay}`);
  console.log(`  Manual adjustment:   ${result.breakdown.manualAdjustment}`);
}

// ============================================================================
// MODULE EXPORTS
// ============================================================================

module.exports = {
  computeTrustScore,
  DEFAULT_CONFIG,
  getTier,
  createContributorState,
  addEvent,
  compactState,
  expandState,
};

// Run examples if executed directly
if (require.main === module) {
  if (process.argv.includes("--examples")) {
    runExamples();
  } else {
    console.log("Usage: node trust-scoring.js --examples");
    console.log("Or require() as a module in GitHub Actions.");
  }
}
