import { NextResponse } from "next/server";
import { getTask } from "@/lib/excel-analysis/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { taskId: string } }) {
  const task = getTask(params.taskId);

  if (!task) {
    return NextResponse.json(
      {
        error: {
          code: "task_not_found",
          message: "Task is not available in runtime memory."
        }
      },
      { status: 404 }
    );
  }

  return NextResponse.json(task);
}
