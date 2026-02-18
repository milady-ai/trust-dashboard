# Trust Scoring

## Source of Truth

The canonical algorithm lives in `milady-ai/milaidy`:

- `milady-ai/milaidy/.github/trust-scoring.js`

This repo mirrors that logic in:

- `src/lib/scoring-engine.ts`

Run `bun run verify:scoring` to confirm parity against `reference-trust-scoring.js`.

## Overview

Each contributor receives a trust score in the range **0-100** based on PR outcomes.

- Starting score: **35**
- Tier thresholds: `src/lib/scoring-engine.ts` (`DEFAULT_CONFIG.tiers`)

The score is derived from weighted PR events and anti-gaming modifiers:

1. Base points by event type
2. Diminishing returns on approvals
3. Recency weighting (exponential decay)
4. Complexity and category multipliers
5. Streak bonuses / penalties
6. Daily positive-point cap
7. Weekly velocity gate
8. Inactivity decay toward a baseline
9. Manual adjustment (maintainer override)

## Event Types (Base Points)

Defined in `DEFAULT_CONFIG.basePoints`:

- `approve`: +12 (merged PR)
- `reject`: -6 (CHANGES_REQUESTED)
- `close`: -10 (closed without merge)
- `selfClose`: -2 (author closed their own PR)

Event extraction and mapping from GitHub happens in `src/lib/github-data.ts`.

## Diminishing Returns (Approvals Only)

Approvals decay logarithmically as the number of prior approvals increases:

```
multiplier = 1 / (1 + diminishingRate * ln(1 + priorApprovals))
```

Default: `diminishingRate = 0.2`.

## Recency Weight (All Events)

Events lose influence over time with a half-life:

```
weight = 0.5 ^ (daysSinceEvent / recencyHalfLifeDays)
```

Default: `recencyHalfLifeDays = 45`.

## Complexity Multiplier (Approvals Only)

Based on lines changed (additions + deletions):

- <= 10: 0.4x
- <= 50: 0.7x
- <= 150: 1.0x
- <= 500: 1.3x
- <= 1500: 1.5x
- > 1500: 1.2x

## Category Multiplier (All Events)

Based on PR labels (highest weight wins, no stacking). Examples:

- `security`: 1.8x
- `core`: 1.3x
- `feature`: 1.1x
- `docs`: 0.6x
- `chore`: 0.5x

If no matching label is present, `defaultCategoryWeight` applies (default: 0.8).

## Streak Mechanics

Consecutive approvals gain a bonus; consecutive rejections/closes gain a penalty.

- Approval bonus: `+8%` per consecutive approval (max `+50%`)
- Rejection penalty: `+15%` per consecutive rejection/close (max `2.5x`)

## Daily Positive-Point Cap

Positive points are capped per calendar day:

- `dailyPointCap = 35`

Negative points are not capped.

## Velocity Gate (Weekly)

If PR throughput is suspiciously high in the last 7 days, positive gains are reduced/zeroed:

- Soft cap: `10 PRs / 7d` (penalty starts)
- Hard cap: `25 PRs / 7d` (positive points zeroed)
- Penalty per excess PR (above soft cap): `0.15`

Negative points are not reduced by the velocity gate.

## Inactivity Decay

After `10` days without events, scores above the target decay toward a baseline:

- Grace period: 10 days
- Target: 40
- Floor: 30
- Decay rate: 0.5% per day after grace

## Final Score

The final score is clamped and rounded:

- Clamp: `[0, 100]`
- Round: `2` decimals

