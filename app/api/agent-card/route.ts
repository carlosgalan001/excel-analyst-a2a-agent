import { NextResponse } from "next/server";
import { buildAgentCard } from "@/lib/excel-analysis/agent-card";
import { getBaseUrlFromRequest } from "@/lib/excel-analysis/request-url";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return NextResponse.json(buildAgentCard(getBaseUrlFromRequest(request)));
}
