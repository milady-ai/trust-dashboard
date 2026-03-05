import { describe, it, expect, beforeEach } from "vitest";
import { computeSocialScore, setSocialReferenceTime } from "./social-scoring";
import type { SocialPost } from "./types";

const NOW = new Date("2025-02-08T12:00:00Z").getTime();

beforeEach(() => {
  setSocialReferenceTime(NOW);
});

function post(opts: Partial<SocialPost> & { daysAgo?: number } = {}): SocialPost {
  const { daysAgo = 0, ...rest } = opts;
  return {
    platform: "twitter",
    url: "https://x.com/test/1",
    timestamp: NOW - daysAgo * 86_400_000,
    likes: 10,
    replies: 2,
    reposts: 3,
    verified: true,
    ...rest,
  };
}

describe("computeSocialScore", () => {
  describe("empty input", () => {
    it("returns all zeros for no posts", () => {
      const score = computeSocialScore([], 0);
      expect(score.total).toBe(0);
      expect(score.posts).toBe(0);
      expect(score.content).toBe(0);
      expect(score.engagement).toBe(0);
      expect(score.referrals).toBe(0);
    });
  });

  describe("score bounds", () => {
    it("total is between 0 and 100", () => {
      const light = computeSocialScore([post()], 0);
      expect(light.total).toBeGreaterThanOrEqual(0);
      expect(light.total).toBeLessThanOrEqual(100);

      // Max everything
      const posts = Array.from({ length: 50 }, (_, i) =>
        post({ daysAgo: i, likes: 100, replies: 50, reposts: 30, isThread: true, isTutorial: true }),
      );
      const heavy = computeSocialScore(posts, 20);
      expect(heavy.total).toBeGreaterThanOrEqual(0);
      expect(heavy.total).toBeLessThanOrEqual(100);
    });

    it("sub-scores respect their max caps", () => {
      const posts = Array.from({ length: 50 }, (_, i) =>
        post({ daysAgo: i, likes: 200, replies: 100, reposts: 50, isThread: true, isTutorial: true }),
      );
      const score = computeSocialScore(posts, 50);
      expect(score.posts).toBeLessThanOrEqual(30);
      expect(score.content).toBeLessThanOrEqual(35);
      expect(score.engagement).toBeLessThanOrEqual(25);
      expect(score.referrals).toBeLessThanOrEqual(10);
    });
  });

  describe("post scoring", () => {
    it("verified posts contribute to score", () => {
      const score = computeSocialScore([post()], 0);
      expect(score.posts).toBeGreaterThan(0);
    });

    it("unverified posts are ignored", () => {
      const score = computeSocialScore([post({ verified: false })], 0);
      expect(score.posts).toBe(0);
    });

    it("more posts = higher score", () => {
      const one = computeSocialScore([post()], 0);
      const five = computeSocialScore(
        Array.from({ length: 5 }, (_, i) => post({ daysAgo: i })),
        0,
      );
      expect(five.posts).toBeGreaterThan(one.posts);
    });
  });

  describe("content scoring", () => {
    it("tutorials score higher than threads", () => {
      const tutorial = computeSocialScore([post({ isTutorial: true })], 0);
      const thread = computeSocialScore([post({ isThread: true })], 0);
      expect(tutorial.content).toBeGreaterThan(thread.content);
    });

    it("plain posts get no content score", () => {
      const score = computeSocialScore([post()], 0);
      expect(score.content).toBe(0);
    });
  });

  describe("engagement scoring", () => {
    it("replies worth more than likes", () => {
      const replies = computeSocialScore([post({ replies: 10, likes: 0, reposts: 0 })], 0);
      const likes = computeSocialScore([post({ replies: 0, likes: 10, reposts: 0 })], 0);
      expect(replies.engagement).toBeGreaterThan(likes.engagement);
    });

    it("zero engagement = zero score", () => {
      const score = computeSocialScore([post({ likes: 0, replies: 0, reposts: 0 })], 0);
      expect(score.engagement).toBe(0);
    });
  });

  describe("referral scoring", () => {
    it("referrals contribute independently of posts", () => {
      const score = computeSocialScore([], 5);
      expect(score.referrals).toBeGreaterThan(0);
    });

    it("more referrals = higher score with diminishing returns", () => {
      const few = computeSocialScore([], 2);
      const many = computeSocialScore([], 10);
      expect(many.referrals).toBeGreaterThan(few.referrals);
      // But not 5x more — diminishing returns
      expect(many.referrals).toBeLessThan(few.referrals * 5);
    });

    it("zero referrals = zero", () => {
      const score = computeSocialScore([], 0);
      expect(score.referrals).toBe(0);
    });
  });

  describe("recency decay", () => {
    it("recent posts score higher than old posts", () => {
      const recent = computeSocialScore([post({ daysAgo: 0 })], 0);
      const old = computeSocialScore([post({ daysAgo: 90 })], 0);
      expect(recent.posts).toBeGreaterThan(old.posts);
    });
  });

  describe("total is sum of components", () => {
    it("total equals posts + content + engagement + referrals", () => {
      const score = computeSocialScore([post({ isThread: true }), post()], 3);
      const expectedTotal = Math.round((score.posts + score.content + score.engagement + score.referrals) * 10) / 10;
      expect(score.total).toBe(expectedTotal);
    });
  });
});
