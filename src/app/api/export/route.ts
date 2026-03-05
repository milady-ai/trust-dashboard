import { NextResponse } from "next/server";
import { loadProject } from "@/lib/data-loader";
import { generateOnChainExport } from "@/lib/eliza-effect";

export const dynamic = "force-static";

// Static export: generates default ethereum export.
// For dynamic chain selection, deploy with server mode.
export async function GET() {
  const project = loadProject();
  const result = generateOnChainExport(project, "ethereum");

  return NextResponse.json({
    ...result,
    availableChains: ["ethereum", "solana", "base", "arbitrum"],
    note: "Default chain: ethereum. For other chains, deploy with server mode and pass ?chain=solana",
  });
}
