import { NextResponse } from "next/server";
import { loadProject } from "@/lib/data-loader";

export const dynamic = "force-static";

// Returns current project stats. In server deployment mode, POST would trigger a rescore.
export async function GET() {
  const project = loadProject();
  return NextResponse.json({
    stats: project.stats,
    generatedAt: project.generatedAt,
    projectId: project.id,
    projectName: project.name,
    note: "For live rescoring, deploy with server mode (remove output: 'export' from next.config).",
  });
}
