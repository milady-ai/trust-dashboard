import { describe, it, expect } from "vitest";
import { loadProject, loadContributors, loadContributor, getGeneratedAt } from "./data-loader";

describe("loadProject", () => {
  it("loads a project with the default config", () => {
    const project = loadProject();
    expect(project.id).toBe("milaidy");
    expect(project.name).toBe("milaidy");
    expect(project.repoFullName).toBe("milady-ai/milaidy");
  });

  it("has contributors", () => {
    const project = loadProject();
    expect(project.contributors.length).toBeGreaterThan(0);
  });

  it("contributors are sorted by elizaEffect descending", () => {
    const project = loadProject();
    for (let i = 1; i < project.contributors.length; i++) {
      expect(project.contributors[i - 1].elizaEffect.total)
        .toBeGreaterThanOrEqual(project.contributors[i].elizaEffect.total);
    }
  });

  it("every contributor has a rank, percentile, and hierarchy", () => {
    const project = loadProject();
    for (const c of project.contributors) {
      expect(c.elizaEffect.rank).toBeGreaterThan(0);
      expect(c.elizaEffect.percentile).toBeGreaterThanOrEqual(0);
      expect(c.hierarchy).toBeDefined();
      expect(c.hierarchy!.tier).toBeTruthy();
    }
  });

  it("every contributor has an elizaPay share", () => {
    const project = loadProject();
    const totalShare = project.contributors.reduce(
      (sum, c) => sum + (c.elizaPay?.sharePercent ?? 0),
      0,
    );
    expect(totalShare).toBeCloseTo(100, 0);
  });

  it("stats are computed correctly", () => {
    const project = loadProject();
    expect(project.stats.totalContributors).toBe(project.contributors.length);
    expect(project.stats.totalGitHubEvents).toBeGreaterThan(0);
    expect(project.stats.topContributor).toBe(project.contributors[0].username);
  });

  it("returns cached project on second call", () => {
    const a = loadProject();
    const b = loadProject();
    expect(a).toBe(b); // same reference
  });
});

describe("loadContributors", () => {
  it("returns the same list as project.contributors", () => {
    const project = loadProject();
    const contributors = loadContributors();
    expect(contributors).toBe(project.contributors);
  });
});

describe("loadContributor", () => {
  it("finds contributor by exact username", () => {
    const all = loadContributors();
    const first = all[0];
    const found = loadContributor(first.username);
    expect(found).toBe(first);
  });

  it("finds contributor case-insensitively", () => {
    const all = loadContributors();
    const first = all[0];
    const found = loadContributor(first.username.toUpperCase());
    expect(found).toBe(first);
  });

  it("returns undefined for nonexistent user", () => {
    expect(loadContributor("__nonexistent_user_xyz__")).toBeUndefined();
  });
});

describe("getGeneratedAt", () => {
  it("returns an ISO date string", () => {
    const date = getGeneratedAt();
    expect(new Date(date).getTime()).not.toBeNaN();
  });
});
