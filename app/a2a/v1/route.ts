import { NextResponse } from "next/server";
import { getA2ATask, handleA2AMessage } from "@/lib/excel-analysis/a2a";
import { getBaseUrlFromRequest } from "@/lib/excel-analysis/request-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

export async function POST(request: Request) {
  let payload: JsonRpcRequest;

  try {
    payload = (await request.json()) as JsonRpcRequest;
  } catch {
    return jsonRpcError(null, -32700, "Error parseando JSON.", 400);
  }

  try {
    if (payload.method === "message/send" || payload.method === "SendMessage") {
      const task = await handleA2AMessage(
        {
          params: payload.params,
          message: payload.params?.message
        },
        getBaseUrlFromRequest(request)
      );

      return NextResponse.json({
        jsonrpc: "2.0",
        id: payload.id ?? null,
        result: task
      });
    }

    if (payload.method === "tasks/get") {
      const taskId = typeof payload.params?.id === "string" ? payload.params.id : null;

      if (!taskId) {
        return jsonRpcError(payload.id ?? null, -32602, "El id de la task es obligatorio.", 400);
      }

      const task = getA2ATask(taskId);

      if (!task) {
        return jsonRpcError(payload.id ?? null, -32004, "Task no encontrada.", 404);
      }

      return NextResponse.json({
        jsonrpc: "2.0",
        id: payload.id ?? null,
        result: task
      });
    }

    return jsonRpcError(payload.id ?? null, -32601, "Metodo no encontrado.", 404);
  } catch (error) {
    return jsonRpcError(payload.id ?? null, -32000, error instanceof Error ? error.message : "El mensaje A2A ha fallado.", 400);
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
