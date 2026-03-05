import { describe, it, expect } from "vitest";
import { getTierForPercentile, assignHierarchy, getTierColor, getTierBgColor } from "./hierarchy";
import type { Contributor, ElizaEffectScore, GitHubScore, SocialScore } from "./types";

// ---- getTierForPercentile ---------------------------------------------------

describe("getTierForPercentile", () => {
  it("95+ is core", () => {
    expect(getTierForPercentile(95).tier).toBe("core");
    expect(getTierForPercentile(100).tier).toBe("core");
  });

  it("80-94 is active", () => {
    expect(getTierForPercentile(80).tier).toBe("active");
    expect(getTierForPercentile(94).tier).toBe("active");
  });

  it("50-79 is contributor", () => {
    expect(getTierForPercentile(50).tier).toBe("contributor");
    expect(getTierForPercentile(79).tier).toBe("contributor");
  });

  it("20-49 is emerging", () => {
    expect(getTierForPercentile(20).tier).toBe("emerging");
    expect(getTierForPercentile(49).tier).toBe("emerging");
  });

  it("0-19 is new", () => {
    expect(getTierForPercentile(0).tier).toBe("new");
    expect(getTierForPercentile(19).tier).toBe("new");
  });

  it("returns correct labels", () => {
    expect(getTierForPercentile(95).label).toBe("Core");
    expect(getTierForPercentile(80).label).toBe("Active");
    expect(getTierForPercentile(50).label).toBe("Contributor");
    expect(getTierForPercentile(20).label).toBe("Emerging");
    expect(getTierForPercentile(0).label).toBe("New");
  });
});

// ---- assignHierarchy --------------------------------------------------------

function makeContributor(username: string, rank: number, percentile: number, total: number): Contributor {
  const github: GitHubScore = { total: 0, prs: 0, participation: 0, impact: 0, consistency: 0 };
  const social: SocialScore = { total: 0, posts: 0, content: 0, engagement: 0, referrals: 0 };
  const elizaEffect: ElizaEffectScore = { total, github, social, rank, percentile };

  return {
    username,
    avatarUrl: "",
    githubEvents: [],
    socialPosts: [],
    socialProfiles: [],
    referralCount: 0,
    firstSeenAt: "2025-01-01",
    lastActiveAt: null,
    elizaEffect,
  };
}

describe("assignHierarchy", () => {
  it("assigns correct tier based on percentile", () => {
    const contributors = [
      makeContributor("top", 1, 96, 80),
      makeContributor("mid", 5, 60, 30),
      makeContributor("low", 10, 10, 5),
    ];
    assignHierarchy(contributors, "test");

    expect(contributors[0].hierarchy!.tier).toBe("core");
    expect(contributors[1].hierarchy!.tier).toBe("contributor");
    expect(contributors[2].hierarchy!.tier).toBe("new");
  });

  it("assigns lead role for rank 1-2", () => {
    const contributors = [
      makeContributor("leader", 1, 95, 80),
      makeContributor("co-lead", 2, 90, 60),
      makeContributor("maintainer", 3, 80, 50),
    ];
    assignHierarchy(contributors, "test");

    expect(contributors[0].hierarchy!.projectRoles[0].role).toBe("lead");
    expect(contributors[1].hierarchy!.projectRoles[0].role).toBe("lead");
    expect(contributors[2].hierarchy!.projectRoles[0].role).toBe("maintainer");
  });

  it("assigns maintainer role for rank 3-5", () => {
    const c = [makeContributor("m", 4, 70, 40)];
    assignHierarchy(c, "test");
    expect(c[0].hierarchy!.projectRoles[0].role).toBe("maintainer");
  });

  it("assigns contributor role for rank 6+", () => {
    const c = [makeContributor("c", 8, 50, 20)];
    assignHierarchy(c, "test");
    expect(c[0].hierarchy!.projectRoles[0].role).toBe("contributor");
  });

  it("assigns participant role for < 5 elizaEffect regardless of rank", () => {
    const c = [makeContributor("p", 1, 95, 3)];
    assignHierarchy(c, "test");
    expect(c[0].hierarchy!.projectRoles[0].role).toBe("participant");
  });

  it("sets projectId on role", () => {
    const c = [makeContributor("x", 1, 95, 50)];
    assignHierarchy(c, "my-project");
    expect(c[0].hierarchy!.projectRoles[0].projectId).toBe("my-project");
  });
});

// ---- Tier Color Helpers -----------------------------------------------------

describe("getTierColor", () => {
  it("returns a color class for every tier", () => {
    const tiers = ["core", "active", "contributor", "emerging", "new"] as const;
    for (const tier of tiers) {
      const color = getTierColor(tier);
      expect(color).toMatch(/^text-/);
    }
  });
});

describe("getTierBgColor", () => {
  it("returns bg classes for every tier", () => {
    const tiers = ["core", "active", "contributor", "emerging", "new"] as const;
    for (const tier of tiers) {
      const bg = getTierBgColor(tier);
      expect(bg).toMatch(/^bg-/);
    }
  });
});
