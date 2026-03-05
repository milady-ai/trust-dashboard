import { describe, it, expect, beforeEach } from "vitest";
import { computeGitHubScore, setReferenceTime, convertLegacyEvent } from "./github-scoring";
import type { GitHubEvent } from "./types";

// Pin reference time so tests are deterministic
const NOW = new Date("2025-02-08T12:00:00Z").getTime();

beforeEach(() => {
  setReferenceTime(NOW);
});

// ---- Helpers ----------------------------------------------------------------

function mergedPR(opts: Partial<GitHubEvent> & { daysAgo?: number } = {}): GitHubEvent {
  const { daysAgo = 0, ...rest } = opts;
  return {
    type: "pr_merged",
    timestamp: NOW - daysAgo * 86_400_000,
    linesChanged: 50,
    ...rest,
  };
}

function rejection(daysAgo = 0): GitHubEvent {
  return { type: "pr_rejected", timestamp: NOW - daysAgo * 86_400_000 };
}

function closed(daysAgo = 0): GitHubEvent {
  return { type: "pr_closed", timestamp: NOW - daysAgo * 86_400_000 };
}

function review(daysAgo = 0, reviewType?: GitHubEvent["reviewType"]): GitHubEvent {
  return { type: "review_given", timestamp: NOW - daysAgo * 86_400_000, reviewType };
}

function issueClosed(daysAgo = 0): GitHubEvent {
  return { type: "issue_closed", timestamp: NOW - daysAgo * 86_400_000 };
}

// ---- Tests ------------------------------------------------------------------

describe("computeGitHubScore", () => {
  describe("empty input", () => {
    it("returns all zeros for no events", () => {
      const score = computeGitHubScore([]);
      expect(score.total).toBe(0);
      expect(score.prs).toBe(0);
      expect(score.participation).toBe(0);
      expect(score.consistency).toBe(0);
      expect(score.impact).toBe(0);
    });
  });

  describe("score bounds", () => {
    it("total is between 0 and 100", () => {
      // Light contributor
      const light = computeGitHubScore([mergedPR()]);
      expect(light.total).toBeGreaterThanOrEqual(0);
      expect(light.total).toBeLessThanOrEqual(100);

      // Heavy contributor — many events across many days
      const events: GitHubEvent[] = [];
      for (let d = 0; d < 60; d++) {
        events.push(mergedPR({ daysAgo: d, linesChanged: 500 }));
        events.push(review(d, "approve"));
      }
      const heavy = computeGitHubScore(events);
      expect(heavy.total).toBeGreaterThanOrEqual(0);
      expect(heavy.total).toBeLessThanOrEqual(100);
    });

    it("sub-scores respect their max caps", () => {
      const events: GitHubEvent[] = [];
      for (let d = 0; d < 60; d++) {
        events.push(mergedPR({ daysAgo: d, linesChanged: 5000 }));
        events.push(review(d, "request_changes"));
        events.push(issueClosed(d));
      }
      const score = computeGitHubScore(events);
      expect(score.prs).toBeLessThanOrEqual(40);
      expect(score.participation).toBeLessThanOrEqual(20);
      expect(score.consistency).toBeLessThanOrEqual(25);
      expect(score.impact).toBeLessThanOrEqual(15);
    });
  });

  describe("merged PRs scoring", () => {
    it("single recent merged PR gets nonzero score", () => {
      const score = computeGitHubScore([mergedPR()]);
      expect(score.prs).toBeGreaterThan(0);
    });

    it("more merged PRs = higher score", () => {
      const one = computeGitHubScore([mergedPR()]);
      const three = computeGitHubScore([mergedPR(), mergedPR({ daysAgo: 1 }), mergedPR({ daysAgo: 2 })]);
      expect(three.prs).toBeGreaterThan(one.prs);
    });

    it("complexity multiplier: large PRs score higher than tiny PRs", () => {
      const small = computeGitHubScore([mergedPR({ linesChanged: 10 })]);
      const large = computeGitHubScore([mergedPR({ linesChanged: 1000 })]);
      expect(large.prs).toBeGreaterThan(small.prs);
    });

    it("massive PRs (10k+) get dampened vs huge PRs", () => {
      const huge = computeGitHubScore([mergedPR({ linesChanged: 9000 })]);
      const massive = computeGitHubScore([mergedPR({ linesChanged: 50000 })]);
      // 9000 lines gets 1.4x, 50000 gets 1.2x — huge should score higher
      expect(huge.prs).toBeGreaterThan(massive.prs);
    });
  });

  describe("recency decay", () => {
    it("recent events score higher than old events", () => {
      const recent = computeGitHubScore([mergedPR({ daysAgo: 0 })]);
      const old = computeGitHubScore([mergedPR({ daysAgo: 90 })]);
      expect(recent.prs).toBeGreaterThan(old.prs);
    });

    it("45-day-old event scores ~half of a fresh event", () => {
      const fresh = computeGitHubScore([mergedPR({ daysAgo: 0 })]);
      const halfLife = computeGitHubScore([mergedPR({ daysAgo: 45 })]);
      const ratio = halfLife.prs / fresh.prs;
      expect(ratio).toBeGreaterThan(0.4);
      expect(ratio).toBeLessThan(0.6);
    });
  });

  describe("participation scoring", () => {
    it("rejections, closes, reviews all contribute", () => {
      const rejScore = computeGitHubScore([rejection()]);
      expect(rejScore.participation).toBeGreaterThan(0);

      const closeScore = computeGitHubScore([closed()]);
      expect(closeScore.participation).toBeGreaterThan(0);

      const reviewScore = computeGitHubScore([review()]);
      expect(reviewScore.participation).toBeGreaterThan(0);

      const issueScore = computeGitHubScore([issueClosed()]);
      expect(issueScore.participation).toBeGreaterThan(0);
    });

    it("reviews score higher than closes", () => {
      const revScore = computeGitHubScore([review(0, "approve")]);
      const clsScore = computeGitHubScore([closed()]);
      expect(revScore.participation).toBeGreaterThan(clsScore.participation);
    });

    it("merged PRs do NOT count in participation (no double-counting)", () => {
      const mergedOnly = computeGitHubScore([mergedPR()]);
      expect(mergedOnly.participation).toBe(0);
    });
  });

  describe("consistency scoring", () => {
    it("single event on one day = 0 consistency", () => {
      const score = computeGitHubScore([mergedPR()]);
      expect(score.consistency).toBe(0);
    });

    it("events on 2+ different days = nonzero consistency", () => {
      const score = computeGitHubScore([
        mergedPR({ daysAgo: 0 }),
        mergedPR({ daysAgo: 3 }),
      ]);
      expect(score.consistency).toBeGreaterThan(0);
    });

    it("more active days = higher consistency", () => {
      const twoDays = computeGitHubScore([
        mergedPR({ daysAgo: 0 }),
        mergedPR({ daysAgo: 1 }),
      ]);
      const tenDays = computeGitHubScore(
        Array.from({ length: 10 }, (_, i) => mergedPR({ daysAgo: i })),
      );
      expect(tenDays.consistency).toBeGreaterThan(twoDays.consistency);
    });
  });

  describe("impact scoring", () => {
    it("no merged PRs = 0 impact", () => {
      const score = computeGitHubScore([rejection(), closed()]);
      expect(score.impact).toBe(0);
    });

    it("larger PRs = higher impact", () => {
      const small = computeGitHubScore([mergedPR({ linesChanged: 10 })]);
      const big = computeGitHubScore([mergedPR({ linesChanged: 5000 })]);
      expect(big.impact).toBeGreaterThan(small.impact);
    });
  });

  describe("total is sum of components", () => {
    it("total equals prs + participation + consistency + impact", () => {
      const events = [
        mergedPR({ daysAgo: 0 }),
        mergedPR({ daysAgo: 5 }),
        review(2, "approve"),
        rejection(3),
      ];
      const score = computeGitHubScore(events);
      const expectedTotal = Math.round((score.prs + score.participation + score.consistency + score.impact) * 10) / 10;
      expect(score.total).toBe(expectedTotal);
    });
  });
});

describe("convertLegacyEvent", () => {
  it("maps approve to pr_merged", () => {
    const e = convertLegacyEvent({ type: "approve", timestamp: 1000, prNumber: 42 });
    expect(e.type).toBe("pr_merged");
    expect(e.prNumber).toBe(42);
  });

  it("maps reject to pr_rejected", () => {
    expect(convertLegacyEvent({ type: "reject", timestamp: 1000 }).type).toBe("pr_rejected");
  });

  it("maps close to pr_rejected (maintainer close)", () => {
    expect(convertLegacyEvent({ type: "close", timestamp: 1000 }).type).toBe("pr_rejected");
  });

  it("maps selfClose to pr_closed (self close = iteration)", () => {
    expect(convertLegacyEvent({ type: "selfClose", timestamp: 1000 }).type).toBe("pr_closed");
  });

  it("unknown types default to pr_closed", () => {
    expect(convertLegacyEvent({ type: "unknown_thing", timestamp: 1000 }).type).toBe("pr_closed");
  });

  it("preserves linesChanged and labels", () => {
    const e = convertLegacyEvent({ type: "approve", timestamp: 1000, linesChanged: 500, labels: ["bug"] });
    expect(e.linesChanged).toBe(500);
    expect(e.labels).toEqual(["bug"]);
  });
});
