import { NextResponse } from "next/server";
import { loadProject } from "@/lib/data-loader";
import { generateOnChainExport } from "@/lib/eliza-effect";

export const dynamic = "force-static";

export async function GET() {
  const project = loadProject();
  const result = generateOnChainExport(project, "ethereum");

  return NextResponse.json({
    ...result,
    availableChains: ["ethereum", "solana", "base", "arbitrum"],
  });
}
