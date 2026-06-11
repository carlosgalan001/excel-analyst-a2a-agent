import { NextResponse } from "next/server";
import { getAnalysis } from "@/lib/excel-analysis/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { analysisId: string } }) {
  const analysis = getAnalysis(params.analysisId);

  if (!analysis) {
    return NextResponse.json({ error: "Analysis not found in runtime memory." }, { status: 404 });
  }

  return NextResponse.json({ analysis });
}
