import { NextResponse } from "next/server";
import { handleA2AMessage } from "@/lib/excel-analysis/a2a";
import { getBaseUrlFromRequest } from "@/lib/excel-analysis/request-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: {
    message?: unknown;
  };
}

export async function POST(request: Request) {
  let payload: JsonRpcRequest;

  try {
    payload = (await request.json()) as JsonRpcRequest;
  } catch {
    return jsonRpcError(null, -32700, "Parse error", 400);
  }

  if (payload.method !== "SendMessage") {
    return jsonRpcError(payload.id ?? null, -32601, "Method not found", 404);
  }

  try {
    const task = await handleA2AMessage(
      {
        message: payload.params?.message
      },
      getBaseUrlFromRequest(request)
    );

    return NextResponse.json({
      jsonrpc: "2.0",
      id: payload.id ?? null,
      result: task
    });
  } catch (error) {
    return jsonRpcError(payload.id ?? null, -32000, error instanceof Error ? error.message : "A2A message failed", 400);
  }
}

function jsonRpcError(id: string | number | null, code: number, message: string, status: number) {
  return NextResponse.json(
    {
      jsonrpc: "2.0",
      id,
      error: {
        code,
        message
      }
    },
    { status }
  );
}
