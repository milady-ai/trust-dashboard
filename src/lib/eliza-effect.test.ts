import { describe, it, expect, beforeEach } from "vitest";
import {
  computeElizaEffect,
  computeElizaPay,
  buildProjectFromLegacyData,
  DEFAULT_CONFIG,
  generateOnChainExport,
} from "./eliza-effect";
import { setReferenceTime } from "./github-scoring";
import { setSocialReferenceTime } from "./social-scoring";
import type { GitHubEvent, SocialPost } from "./types";

const NOW = new Date("2025-02-08T12:00:00Z").getTime();

beforeEach(() => {
  setReferenceTime(NOW);
  setSocialReferenceTime(NOW);
});

// ---- computeElizaEffect -----------------------------------------------------

describe("computeElizaEffect", () => {
  it("returns 0 for empty inputs", () => {
    const score = computeElizaEffect([], [], 0, DEFAULT_CONFIG);
    expect(score.total).toBe(0);
    expect(score.github.total).toBe(0);
    expect(score.social.total).toBe(0);
  });

  it("weights GitHub at 60% and Social at 40%", () => {
    const events: GitHubEvent[] = [
      { type: "pr_merged", timestamp: NOW, linesChanged: 100 },
    ];
    const score = computeElizaEffect(events, [], 0, DEFAULT_CONFIG);
    // Social is 0, so total = github * 0.6 + 0 * 0.4
    const expected = Math.round(score.github.total * 0.6 * 10) / 10;
    expect(score.total).toBe(expected);
  });

  it("initializes rank and percentile to 0 (assigned later)", () => {
    const score = computeElizaEffect([], [], 0, DEFAULT_CONFIG);
    expect(score.rank).toBe(0);
    expect(score.percentile).toBe(0);
  });

  it("custom weights work", () => {
    const config = { ...DEFAULT_CONFIG, githubWeight: 0.8, socialWeight: 0.2 };
    const events: GitHubEvent[] = [
      { type: "pr_merged", timestamp: NOW, linesChanged: 50 },
    ];
    const score = computeElizaEffect(events, [], 0, config);
    const expected = Math.round(score.github.total * 0.8 * 10) / 10;
    expect(score.total).toBe(expected);
  });
});

// ---- computeElizaPay --------------------------------------------------------

describe("computeElizaPay", () => {
  it("returns empty shares for no contributors", () => {
    const dist = computeElizaPay([], "test");
    expect(dist.shares).toHaveLength(0);
  });

  it("single contributor gets 100% share", () => {
    const dist = computeElizaPay(
      [{ username: "alice", elizaEffect: 50 }],
      "test",
    );
    expect(dist.shares).toHaveLength(1);
    expect(dist.shares[0].sharePercent).toBe(100);
  });

  it("uses quadratic (sqrt) distribution", () => {
    const dist = computeElizaPay(
      [
        { username: "alice", elizaEffect: 100 },
        { username: "bob", elizaEffect: 25 },
      ],
      "test",
    );
    // sqrt(100) = 10, sqrt(25) = 5, total = 15
    // alice: 10/15 = 66.67%, bob: 5/15 = 33.33%
    const alice = dist.shares.find((s) => s.username === "alice")!;
    const bob = dist.shares.find((s) => s.username === "bob")!;
    expect(alice.sharePercent).toBeCloseTo(66.67, 1);
    expect(bob.sharePercent).toBeCloseTo(33.33, 1);
  });

  it("shares sum to ~100%", () => {
    const dist = computeElizaPay(
      [
        { username: "a", elizaEffect: 80 },
        { username: "b", elizaEffect: 40 },
        { username: "c", elizaEffect: 10 },
      ],
      "test",
    );
    const totalPercent = dist.shares.reduce((sum, s) => sum + s.sharePercent, 0);
    expect(totalPercent).toBeCloseTo(100, 0);
  });

  it("computes estimated payouts when pool is provided", () => {
    const dist = computeElizaPay(
      [{ username: "alice", elizaEffect: 50 }],
      "test",
      1_000_000,
    );
    expect(dist.shares[0].estimatedPayout).toBe(1_000_000);
  });

  it("zero elizaEffect gets 0% share", () => {
    const dist = computeElizaPay(
      [
        { username: "active", elizaEffect: 50 },
        { username: "inactive", elizaEffect: 0 },
      ],
      "test",
    );
    const inactive = dist.shares.find((s) => s.username === "inactive")!;
    expect(inactive.sharePercent).toBe(0);
    expect(inactive.sqrtScore).toBe(0);
  });

  it("sorts shares by sharePercent descending", () => {
    const dist = computeElizaPay(
      [
        { username: "low", elizaEffect: 5 },
        { username: "high", elizaEffect: 80 },
        { username: "mid", elizaEffect: 30 },
      ],
      "test",
    );
    expect(dist.shares[0].username).toBe("high");
    expect(dist.shares[1].username).toBe("mid");
    expect(dist.shares[2].username).toBe("low");
  });
});

// ---- buildProjectFromLegacyData ---------------------------------------------

describe("buildProjectFromLegacyData", () => {
  const legacyContributors = [
    {
      username: "alice",
      avatarUrl: "https://github.com/alice.png",
      totalApprovals: 5,
      totalRejections: 1,
      totalCloses: 0,
      events: [
        { type: "approve", timestamp: NOW - 86_400_000, linesChanged: 200, prNumber: 1 },
        { type: "approve", timestamp: NOW - 2 * 86_400_000, linesChanged: 100, prNumber: 2 },
        { type: "reject", timestamp: NOW - 3 * 86_400_000, prNumber: 3 },
      ],
    },
    {
      username: "bob",
      avatarUrl: "https://github.com/bob.png",
      totalApprovals: 1,
      totalRejections: 0,
      totalCloses: 1,
      events: [
        { type: "approve", timestamp: NOW - 86_400_000, linesChanged: 50, prNumber: 10 },
      ],
    },
  ];

  it("builds a project with correct metadata", () => {
    const project = buildProjectFromLegacyData(legacyContributors, DEFAULT_CONFIG, new Date(NOW).toISOString());
    expect(project.id).toBe("milaidy");
    expect(project.name).toBe("milaidy");
    expect(project.repoFullName).toBe("milady-ai/milaidy");
  });

  it("assigns ranks (higher score = lower rank number)", () => {
    const project = buildProjectFromLegacyData(legacyContributors, DEFAULT_CONFIG, new Date(NOW).toISOString());
    const alice = project.contributors.find((c) => c.username === "alice")!;
    const bob = project.contributors.find((c) => c.username === "bob")!;
    expect(alice.elizaEffect.rank).toBe(1);
    expect(bob.elizaEffect.rank).toBe(2);
  });

  it("assigns percentiles", () => {
    const project = buildProjectFromLegacyData(legacyContributors, DEFAULT_CONFIG, new Date(NOW).toISOString());
    const alice = project.contributors.find((c) => c.username === "alice")!;
    expect(alice.elizaEffect.percentile).toBeGreaterThan(0);
  });

  it("assigns hierarchy tiers", () => {
    const project = buildProjectFromLegacyData(legacyContributors, DEFAULT_CONFIG, new Date(NOW).toISOString());
    for (const c of project.contributors) {
      expect(c.hierarchy).toBeDefined();
      expect(["core", "active", "contributor", "emerging", "new"]).toContain(c.hierarchy!.tier);
    }
  });

  it("assigns elizaPay shares", () => {
    const project = buildProjectFromLegacyData(legacyContributors, DEFAULT_CONFIG, new Date(NOW).toISOString());
    for (const c of project.contributors) {
      expect(c.elizaPay).toBeDefined();
      expect(c.elizaPay!.sharePercent).toBeGreaterThanOrEqual(0);
    }
    const totalShare = project.contributors.reduce((sum, c) => sum + (c.elizaPay?.sharePercent ?? 0), 0);
    expect(totalShare).toBeCloseTo(100, 0);
  });

  it("sorts contributors by elizaEffect descending", () => {
    const project = buildProjectFromLegacyData(legacyContributors, DEFAULT_CONFIG, new Date(NOW).toISOString());
    for (let i = 1; i < project.contributors.length; i++) {
      expect(project.contributors[i - 1].elizaEffect.total)
        .toBeGreaterThanOrEqual(project.contributors[i].elizaEffect.total);
    }
  });

  it("computes correct project stats", () => {
    const project = buildProjectFromLegacyData(legacyContributors, DEFAULT_CONFIG, new Date(NOW).toISOString());
    expect(project.stats.totalContributors).toBe(2);
    expect(project.stats.totalGitHubEvents).toBe(4); // 3 alice + 1 bob
    expect(project.stats.totalSocialPosts).toBe(0);
    expect(project.stats.topContributor).toBe("alice");
    expect(project.stats.avgElizaEffect).toBeGreaterThan(0);
  });

  it("converts legacy events correctly", () => {
    const project = buildProjectFromLegacyData(legacyContributors, DEFAULT_CONFIG, new Date(NOW).toISOString());
    const alice = project.contributors.find((c) => c.username === "alice")!;
    const merged = alice.githubEvents.filter((e) => e.type === "pr_merged");
    const rejected = alice.githubEvents.filter((e) => e.type === "pr_rejected");
    expect(merged.length).toBe(2);
    expect(rejected.length).toBe(1);
  });
});

// ---- generateOnChainExport --------------------------------------------------

describe("generateOnChainExport", () => {
  it("generates export with correct structure", () => {
    const project = buildProjectFromLegacyData(
      [{ username: "alice", avatarUrl: "", totalApprovals: 1, totalRejections: 0, totalCloses: 0,
         events: [{ type: "approve", timestamp: NOW, linesChanged: 50, prNumber: 1 }] }],
      DEFAULT_CONFIG,
      new Date(NOW).toISOString(),
    );
    const exp = generateOnChainExport(project, "ethereum", "0xABC", 1_000_000);
    expect(exp.chainTarget).toBe("ethereum");
    expect(exp.projectId).toBe("milaidy");
    expect(exp.tokenAddress).toBe("0xABC");
    expect(exp.totalPool).toBe(1_000_000);
    expect(exp.recipients).toHaveLength(1);
    expect(exp.recipients[0].username).toBe("alice");
    expect(exp.recipients[0].rank).toBe(1);
    expect(exp.recipients[0].sharePercent).toBe(100);
  });
});
