import { NextResponse } from "next/server";
import { analyzeWorkbookFromBuffer } from "@/lib/excel-analysis/analyzer";
import { getBaseUrlFromRequest } from "@/lib/excel-analysis/request-url";
import { saveAnalysis } from "@/lib/excel-analysis/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UPLOAD_LIMIT_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Upload a .xlsx or .xls file." }, { status: 400 });
    }

    if (file.size > UPLOAD_LIMIT_BYTES) {
      return NextResponse.json(
        { error: `Uploads are limited to ${UPLOAD_LIMIT_BYTES / 1024 / 1024} MB. Use URL analysis for larger workbooks.` },
        { status: 413 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const analysis = await analyzeWorkbookFromBuffer(buffer, file.name, {
      baseUrl: getBaseUrlFromRequest(request)
    });

    saveAnalysis(analysis);

    return NextResponse.json({ analysis });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to analyze uploaded workbook." },
      { status: 400 }
    );
  }
}
