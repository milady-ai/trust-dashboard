import { NextResponse } from "next/server";
import { loadProject } from "@/lib/data-loader";

export const dynamic = "force-static";

export async function GET() {
  const project = loadProject();
  return NextResponse.json({
    stats: project.stats,
    generatedAt: project.generatedAt,
    projectId: project.id,
    projectName: project.name,
  });
}
