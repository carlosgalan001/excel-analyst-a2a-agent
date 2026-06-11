import { NextResponse } from "next/server";
import { handleA2AMessage } from "@/lib/excel-analysis/a2a";
import { getBaseUrlFromRequest } from "@/lib/excel-analysis/request-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: { method: string } }) {
  if (params.method !== "message:send") {
    return NextResponse.json({ error: { code: "not_found", message: "Endpoint A2A no soportado." } }, { status: 404 });
  }

  try {
    const body = await request.json();
    const task = await handleA2AMessage(body, getBaseUrlFromRequest(request));

    return NextResponse.json(task);
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "a2a_message_failed",
          message: error instanceof Error ? error.message : "No se ha podido procesar el mensaje A2A."
        }
      },
      { status: 400 }
    );
  }
}
