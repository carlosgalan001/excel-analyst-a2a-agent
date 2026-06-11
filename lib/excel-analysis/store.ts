import type { AnalysisResult } from "./types";

export interface A2ATaskRecord {
  id: string;
  contextId: string;
  status: {
    state: "completed" | "failed";
    timestamp: string;
    message?: string;
  };
  artifacts: Array<{
    artifactId: string;
    name: string;
    mediaType: string;
    parts: Array<{
      mediaType: string;
      data?: unknown;
      text?: string;
      url?: string;
    }>;
    content: unknown;
  }>;
  result?: unknown;
}

type StoreGlobal = typeof globalThis & {
  __excelAnalystStore?: Map<string, AnalysisResult>;
  __excelAnalystTasks?: Map<string, A2ATaskRecord>;
};

function getAnalysisStore(): Map<string, AnalysisResult> {
  const globalStore = globalThis as StoreGlobal;
  globalStore.__excelAnalystStore ??= new Map<string, AnalysisResult>();
  return globalStore.__excelAnalystStore;
}

function getTaskStore(): Map<string, A2ATaskRecord> {
  const globalStore = globalThis as StoreGlobal;
  globalStore.__excelAnalystTasks ??= new Map<string, A2ATaskRecord>();
  return globalStore.__excelAnalystTasks;
}

export function saveAnalysis(result: AnalysisResult): AnalysisResult {
  getAnalysisStore().set(result.analysisId, result);
  return result;
}

export function getAnalysis(analysisId: string): AnalysisResult | null {
  return getAnalysisStore().get(analysisId) ?? null;
}

export function saveTask(task: A2ATaskRecord): A2ATaskRecord {
  getTaskStore().set(task.id, task);
  return task;
}

export function getTask(taskId: string): A2ATaskRecord | null {
  return getTaskStore().get(taskId) ?? null;
}
