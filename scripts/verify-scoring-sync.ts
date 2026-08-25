#!/usr/bin/env bun

import { createRequire } from "node:module";
import { DEFAULT_CONFIG, computeTrustScore, type ContributorState } from "../src/lib/scoring-engine";

const require = createRequire(import.meta.url);
const reference = require("../reference-trust-scoring.js") as {
  DEFAULT_CONFIG: unknown;
  computeTrustScore: (history: ContributorState, config: unknown, now: number) => {
    score: number;
    tier: string;
    warnings: string[];
  };
};

const NOW = Date.parse("2026-03-13T00:00:00.000Z");

function daysAgo(days: number): number {
  return NOW - days * 24 * 60 * 60 * 1000;
}

function makeHistory(contributor: string, events: ContributorState["events"]): ContributorState {
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const createdAt = sorted[0]?.timestamp ?? NOW;
  return { contributor, createdAt, events: sorted };
}

const scenarios: Array<{ name: string; history: ContributorState }> = [
  {
    name: "Brand new (no events)",
    history: makeHistory("brand-new", []),
  },
  {
    name: "Single approval",
    history: makeHistory("one-approve", [
      { type: "approve", prNumber: 1, timestamp: daysAgo(2), linesChanged: 42, labels: ["bugfix"] },
    ]),
  },
  {
    name: "Mixed approvals with recency + complexity + category",
    history: makeHistory("mixed", [
      { type: "approve", prNumber: 10, timestamp: daysAgo(40), linesChanged: 20, labels: ["docs"] },
      { type: "approve", prNumber: 11, timestamp: daysAgo(12), linesChanged: 300, labels: ["core"] },
      { type: "approve", prNumber: 12, timestamp: daysAgo(3), linesChanged: 900, labels: ["security"] },
    ]),
  },
  {
    name: "Rejection severity + close + self-close",
    history: makeHistory("negatives", [
      {
        type: "reject",
        prNumber: 20,
        timestamp: daysAgo(6),
        linesChanged: 120,
        labels: ["feature"],
        reviewSeverity: "major",
      },
      { type: "close", prNumber: 21, timestamp: daysAgo(5), linesChanged: 50, labels: ["core"] },
      { type: "selfClose", prNumber: 22, timestamp: daysAgo(4), linesChanged: 10, labels: ["docs"] },
      { type: "approve", prNumber: 23, timestamp: daysAgo(2), linesChanged: 80, labels: ["bugfix"] },
    ]),
  },
  {
    name: "Daily cap enforcement (security PRs hit 80pt daily cap)",
    history: makeHistory("daily-cap", [
      { type: "approve", prNumber: 30, timestamp: daysAgo(1), linesChanged: 1500, labels: ["security"] },
      { type: "approve", prNumber: 31, timestamp: daysAgo(1) + 60_000, linesChanged: 1500, labels: ["security"] },
      { type: "approve", prNumber: 32, timestamp: daysAgo(1) + 120_000, linesChanged: 1500, labels: ["security"] },
      { type: "approve", prNumber: 33, timestamp: daysAgo(1) + 180_000, linesChanged: 1500, labels: ["security"] },
      { type: "approve", prNumber: 34, timestamp: daysAgo(1) + 240_000, linesChanged: 1500, labels: ["security"] },
      { type: "approve", prNumber: 35, timestamp: daysAgo(1) + 300_000, linesChanged: 1500, labels: ["security"] },
    ]),
  },
  {
    name: "Velocity hard cap (>200 PRs/7d)",
    history: makeHistory(
      "velocity",
      Array.from({ length: 201 }, (_, idx) => ({
        type: "approve" as const,
        prNumber: 100 + idx,
        timestamp: daysAgo(1) + idx * 60_000,
        linesChanged: 20,
        labels: ["chore"],
      })),
    ),
  },
  {
    name: "Velocity soft cap (>80 but <200 PRs/7d)",
    history: makeHistory(
      "velocity-soft",
      Array.from({ length: 90 }, (_, idx) => ({
        type: "approve" as const,
        prNumber: 200 + idx,
        timestamp: daysAgo(1) + idx * 60_000,
        linesChanged: 20,
        labels: ["chore"],
      })),
    ),
  },
  {
    name: "Inactivity decay",
    history: makeHistory("inactive", [
      { type: "approve", prNumber: 200, timestamp: daysAgo(40), linesChanged: 500, labels: ["core"] },
      { type: "approve", prNumber: 201, timestamp: daysAgo(39), linesChanged: 500, labels: ["core"] },
      { type: "approve", prNumber: 202, timestamp: daysAgo(38), linesChanged: 500, labels: ["core"] },
    ]),
  },
  {
    name: "Superseded close (close followed by approve within 24h)",
    history: makeHistory("superseded", [
      { type: "close", prNumber: 300, timestamp: daysAgo(10), linesChanged: 200, labels: ["core"] },
      { type: "approve", prNumber: 300, timestamp: daysAgo(10) + 60 * 60 * 1000, linesChanged: 200, labels: ["core"] },
    ]),
  },
  {
    name: "High approval-rate bonus (≥90% approval rate)",
    history: makeHistory("high-rate", [
      { type: "approve", prNumber: 400, timestamp: daysAgo(20), linesChanged: 100, labels: ["bugfix"] },
      { type: "approve", prNumber: 401, timestamp: daysAgo(18), linesChanged: 100, labels: ["bugfix"] },
      { type: "approve", prNumber: 402, timestamp: daysAgo(16), linesChanged: 100, labels: ["bugfix"] },
      { type: "approve", prNumber: 403, timestamp: daysAgo(14), linesChanged: 100, labels: ["bugfix"] },
      { type: "approve", prNumber: 404, timestamp: daysAgo(12), linesChanged: 100, labels: ["bugfix"] },
      { type: "approve", prNumber: 405, timestamp: daysAgo(10), linesChanged: 100, labels: ["bugfix"] },
      { type: "approve", prNumber: 406, timestamp: daysAgo(8), linesChanged: 100, labels: ["bugfix"] },
      { type: "approve", prNumber: 407, timestamp: daysAgo(6), linesChanged: 100, labels: ["bugfix"] },
      { type: "approve", prNumber: 408, timestamp: daysAgo(4), linesChanged: 100, labels: ["bugfix"] },
      { type: "reject", prNumber: 409, timestamp: daysAgo(2), linesChanged: 50, labels: ["bugfix"] },
    ]),
  },
  {
    name: "Category label normalization (category: prefix)",
    history: makeHistory("category-labels", [
      { type: "approve", prNumber: 500, timestamp: daysAgo(5), linesChanged: 200, labels: ["category:security"] },
      { type: "approve", prNumber: 501, timestamp: daysAgo(3), linesChanged: 100, labels: ["category:feature"] },
    ]),
  },
];

let failures = 0;

for (const scenario of scenarios) {
  const ours = computeTrustScore(scenario.history, DEFAULT_CONFIG, NOW);
  const theirs = reference.computeTrustScore(scenario.history, reference.DEFAULT_CONFIG, NOW);

  const scoreOk = Object.is(ours.score, theirs.score);
  const tierOk = ours.tier === theirs.tier;

  if (!scoreOk || !tierOk) {
    failures++;
    console.error(`FAIL: ${scenario.name}`);
    console.error(`  ours:   score=${ours.score} tier=${ours.tier}`);
    console.error(`  theirs: score=${theirs.score} tier=${theirs.tier}`);
    console.error(`  ours warnings:   ${ours.warnings.join(" | ")}`);
    console.error(`  theirs warnings: ${theirs.warnings.join(" | ")}`);
  }
}

if (failures > 0) {
  console.error(`\nverify:scoring failed (${failures}/${scenarios.length} scenarios)`);
  process.exit(1);
}

console.log(`verify:scoring passed (${scenarios.length} scenarios)`);

