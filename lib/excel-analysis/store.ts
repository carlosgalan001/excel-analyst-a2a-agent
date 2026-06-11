import type { AnalysisResult } from "./types";

export interface A2ATaskRecord {
  kind: "task";
  id: string;
  contextId: string;
  status: {
    state: "completed" | "failed" | "input-required";
    timestamp: string;
    message?: A2AMessage;
  };
  history: A2AMessage[];
  artifacts: A2AArtifact[];
  metadata: Record<string, unknown>;
}

export interface A2AMessage {
  kind: "message";
  role: "user" | "agent";
  messageId: string;
  taskId?: string | null;
  contextId: string;
  parts: A2APart[];
  metadata?: Record<string, unknown>;
}

export type A2APart =
  | {
      kind: "text";
      text: string;
      metadata?: Record<string, unknown>;
    }
  | {
      kind: "data";
      data: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    }
  | {
      kind: "file";
      file: {
        name?: string;
        bytes?: string;
        uri?: string;
        mimeType?: string;
      };
      metadata?: Record<string, unknown>;
    };

export interface A2AArtifact {
  artifactId: string;
  name: string;
  description?: string;
  parts: A2APart[];
  metadata?: Record<string, unknown>;
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
