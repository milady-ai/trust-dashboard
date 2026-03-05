// ---------------------------------------------------------------------------
// Social Impact Scoring — elizaEffect
// ---------------------------------------------------------------------------
// Scores social/marketing impact on a 0–100 scale across four dimensions:
//   Posts (30pts) · Content creation (35pts) · Engagement (25pts) · Referrals (10pts)
//
// Design choices:
//   - Engagement quality over follower vanity metrics
//   - Tutorials/threads weighted heavily (deep content drives adoption)
//   - Diminishing returns to prevent spam
//   - Referrals are high-signal but hard to verify, so capped

import type { SocialPost, SocialScore } from "./types";

// ---- Config -----------------------------------------------------------------

const MAX_POST_POINTS = 30;
const MAX_CONTENT_POINTS = 35;
const MAX_ENGAGEMENT_POINTS = 25;
const MAX_REFERRAL_POINTS = 10;

const RECENCY_HALF_LIFE_DAYS = 21; // social decays faster than code

// ---- Helpers ----------------------------------------------------------------

function recencyWeight(timestampMs: number): number {
  const daysAgo = Math.max(0, (Date.now() - timestampMs) / 86_400_000);
  return Math.pow(0.5, daysAgo / RECENCY_HALF_LIFE_DAYS);
}

function diminish(rawPoints: number, maxPoints: number): number {
  if (rawPoints <= 0) return 0;
  const target = maxPoints * 2;
  return Math.min(1, Math.log(1 + rawPoints) / Math.log(1 + target));
}

function engagementScore(post: SocialPost): number {
  // Replies are most valuable (real conversation), then reposts (amplification), then likes
  return (post.replies * 3) + (post.reposts * 2) + (post.likes * 0.5);
}

// ---- Scoring Functions ------------------------------------------------------

function scorePosts(posts: SocialPost[]): number {
  if (posts.length === 0) return 0;

  let rawPoints = 0;
  for (const post of posts) {
    if (!post.verified) continue;
    const recency = recencyWeight(post.timestamp);
    rawPoints += 2.0 * recency;
  }

  return diminish(rawPoints, MAX_POST_POINTS) * MAX_POST_POINTS;
}

function scoreContent(posts: SocialPost[]): number {
  const deepContent = posts.filter((p) => p.verified && (p.isThread || p.isTutorial));
  if (deepContent.length === 0) return 0;

  let rawPoints = 0;
  for (const post of deepContent) {
    const base = post.isTutorial ? 8 : 4; // tutorials worth 2x threads
    const recency = recencyWeight(post.timestamp);
    rawPoints += base * recency;
  }

  return diminish(rawPoints, MAX_CONTENT_POINTS) * MAX_CONTENT_POINTS;
}

function scoreEngagement(posts: SocialPost[]): number {
  const verified = posts.filter((p) => p.verified);
  if (verified.length === 0) return 0;

  let rawPoints = 0;
  for (const post of verified) {
    const eng = engagementScore(post);
    const recency = recencyWeight(post.timestamp);
    // Apply sqrt to engagement to reduce impact of viral outliers
    rawPoints += Math.sqrt(Math.max(0, eng)) * recency;
  }

  return diminish(rawPoints, MAX_ENGAGEMENT_POINTS) * MAX_ENGAGEMENT_POINTS;
}

function scoreReferrals(referralCount: number): number {
  if (referralCount <= 0) return 0;
  // Each referral is worth a lot, but caps quickly
  return diminish(referralCount * 5, MAX_REFERRAL_POINTS) * MAX_REFERRAL_POINTS;
}

// ---- Public API -------------------------------------------------------------

export function computeSocialScore(posts: SocialPost[], referralCount: number): SocialScore {
  const postScore = Math.round(scorePosts(posts) * 10) / 10;
  const content = Math.round(scoreContent(posts) * 10) / 10;
  const engagement = Math.round(scoreEngagement(posts) * 10) / 10;
  const referrals = Math.round(scoreReferrals(referralCount) * 10) / 10;

  return {
    total: Math.round((postScore + content + engagement + referrals) * 10) / 10,
    posts: postScore,
    content,
    engagement,
    referrals,
  };
}
