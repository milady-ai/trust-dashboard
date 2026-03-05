import { NextResponse } from "next/server";

export const dynamic = "force-static";

// In static export mode, this endpoint documents the social post submission API.
// When deployed with a server (remove output: "export" from next.config), POST will accept submissions.
export async function GET() {
  return NextResponse.json({
    endpoint: "/api/social",
    description: "Social post submission for elizaEffect scoring",
    method: "POST (requires server deployment)",
    fields: {
      required: {
        username: "string — GitHub username",
        platform: "farcaster | twitter | youtube | other",
        url: "string — URL to the social post",
        likes: "number",
        replies: "number",
        reposts: "number",
      },
      optional: {
        isThread: "boolean — long-form thread content",
        isTutorial: "boolean — tutorial/educational content (2x weight)",
      },
    },
    note: "Posts are created with verified: false. Verification happens asynchronously.",
  });
}
