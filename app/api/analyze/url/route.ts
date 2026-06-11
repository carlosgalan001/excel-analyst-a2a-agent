import { NextResponse } from "next/server";
import { analyzeWorkbookFromUrl } from "@/lib/excel-analysis/analyzer";
import { getBaseUrlFromRequest } from "@/lib/excel-analysis/request-url";
import { saveAnalysis } from "@/lib/excel-analysis/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { url?: string };

    if (!body.url || typeof body.url !== "string") {
      return NextResponse.json({ error: "Indica una URL publica de Excel." }, { status: 400 });
    }

    const analysis = await analyzeWorkbookFromUrl(body.url, {
      baseUrl: getBaseUrlFromRequest(request)
    });

    saveAnalysis(analysis);

    return NextResponse.json({ analysis });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se ha podido analizar la URL del Excel." },
      { status: 400 }
    );
  }
}
