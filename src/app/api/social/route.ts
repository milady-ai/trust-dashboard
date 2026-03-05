import { NextResponse } from "next/server";

export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/social",
    description: "Social post submission schema for elizaEffect scoring",
    status: "static",
    schema: {
      username: "string — GitHub username",
      platform: "farcaster | twitter | youtube | other",
      url: "string — URL to the social post",
      likes: "number",
      replies: "number",
      reposts: "number",
      isThread: "boolean (optional) — long-form thread content",
      isTutorial: "boolean (optional) — tutorial/educational content (2x weight)",
    },
  });
}
