import { NextResponse } from "next/server";
import { getAnalysis } from "@/lib/excel-analysis/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { analysisId: string } }) {
  const analysis = getAnalysis(params.analysisId);

  if (!analysis) {
    return NextResponse.json({ error: "Analisis no encontrado en la memoria temporal de runtime." }, { status: 404 });
  }

  return NextResponse.json({ analysis });
}
