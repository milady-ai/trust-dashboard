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

const NOW = Date.parse("2026-02-18T00:00:00.000Z");

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
    name: "Daily cap enforcement",
    history: makeHistory("daily-cap", [
      { type: "approve", prNumber: 30, timestamp: daysAgo(1), linesChanged: 1500, labels: ["security"] },
      { type: "approve", prNumber: 31, timestamp: daysAgo(1) + 60_000, linesChanged: 1500, labels: ["security"] },
    ]),
  },
  {
    name: "Velocity hard cap (>25 PRs/7d)",
    history: makeHistory(
      "velocity",
      Array.from({ length: 26 }, (_, idx) => ({
        type: "approve" as const,
        prNumber: 100 + idx,
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
  console.error(`\\nverify:scoring failed (${failures}/${scenarios.length} scenarios)`);
  process.exit(1);
}

console.log(`verify:scoring passed (${scenarios.length} scenarios)`);

