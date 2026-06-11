import { randomUUID } from "crypto";
import { analyzeWorkbookFromBuffer, analyzeWorkbookFromUrl } from "./analyzer";
import { saveAnalysis, saveTask, type A2ATaskRecord } from "./store";
import type { AnalysisResult, Kpi } from "./types";

const RAW_UPLOAD_LIMIT_BYTES = 4 * 1024 * 1024;

interface A2APart {
  text?: string;
  url?: string;
  filename?: string;
  mediaType?: string;
  raw?: string;
  data?: {
    excelUrl?: string;
    url?: string;
    [key: string]: unknown;
  };
}

export interface A2AContractResult {
  analysisId: string;
  summary: string;
  kpis: Kpi[];
  findings: string[];
  recommendations: string[];
  dashboardUrl: string;
  reportUrl: string;
}

export async function handleA2AMessage(body: unknown, baseUrl: string): Promise<A2ATaskRecord> {
  const parts = extractParts(body);
  const url = extractUrl(parts);
  let analysis: AnalysisResult;

  if (url) {
    analysis = await analyzeWorkbookFromUrl(url, { baseUrl });
  } else {
    const rawPart = parts.find((part) => typeof part.raw === "string" && part.raw.length > 0);

    if (!rawPart?.raw) {
      throw new Error("A2A message must include a workbook URL, data.excelUrl, a URL in text, or a small base64 raw file.");
    }

    const buffer = bufferFromBase64(rawPart.raw);

    if (buffer.byteLength > RAW_UPLOAD_LIMIT_BYTES) {
      throw new Error(
        `Raw base64 uploads are limited to ${RAW_UPLOAD_LIMIT_BYTES / 1024 / 1024} MB. Use a public or temporary Excel URL for large workbooks.`
      );
    }

    analysis = await analyzeWorkbookFromBuffer(buffer, rawPart.filename ?? "a2a-workbook.xlsx", { baseUrl });
  }

  saveAnalysis(analysis);

  const taskId = randomUUID();
  const contextId = getContextId(body) ?? randomUUID();
  const contract = toA2AContract(analysis);
  const task: A2ATaskRecord = {
    id: taskId,
    contextId,
    status: {
      state: "completed",
      timestamp: new Date().toISOString()
    },
    artifacts: [
      {
        artifactId: "analysis_result",
        name: "analysis_result",
        mediaType: "application/json",
        parts: [
          {
            mediaType: "application/json",
            data: analysis
          }
        ],
        content: analysis
      },
      {
        artifactId: "executive_summary",
        name: "executive_summary",
        mediaType: "text/plain",
        parts: [
          {
            mediaType: "text/plain",
            text: analysis.executiveSummary
          }
        ],
        content: analysis.executiveSummary
      },
      {
        artifactId: "dashboard",
        name: "dashboard",
        mediaType: "text/html",
        parts: [
          {
            mediaType: "text/html",
            url: analysis.dashboardUrl
          }
        ],
        content: {
          dashboardUrl: analysis.dashboardUrl
        }
      },
      {
        artifactId: "kpis",
        name: "kpis",
        mediaType: "application/json",
        parts: [
          {
            mediaType: "application/json",
            data: analysis.kpis
          }
        ],
        content: analysis.kpis
      }
    ],
    result: contract
  };

  saveTask(task);
  return task;
}

export function toA2AContract(analysis: AnalysisResult): A2AContractResult {
  return {
    analysisId: analysis.analysisId,
    summary: analysis.executiveSummary,
    kpis: analysis.kpis,
    findings: analysis.findings,
    recommendations: analysis.recommendations,
    dashboardUrl: analysis.dashboardUrl,
    reportUrl: analysis.dashboardUrl
  };
}

function extractParts(body: unknown): A2APart[] {
  if (!body || typeof body !== "object") {
    return [];
  }

  const record = body as Record<string, unknown>;
  const message = typeof record.message === "object" && record.message ? (record.message as Record<string, unknown>) : record;
  const directParts = message.parts;

  if (Array.isArray(directParts)) {
    return directParts.filter((part): part is A2APart => typeof part === "object" && part !== null);
  }

  if (typeof record.excelUrl === "string") {
    return [{ data: { excelUrl: record.excelUrl } }];
  }

  if (typeof record.url === "string") {
    return [{ url: record.url }];
  }

  if (typeof record.text === "string") {
    return [{ text: record.text }];
  }

  return [];
}

function extractUrl(parts: A2APart[]): string | null {
  for (const part of parts) {
    if (part.url) {
      return part.url;
    }
  }

  for (const part of parts) {
    if (part.data?.excelUrl && typeof part.data.excelUrl === "string") {
      return part.data.excelUrl;
    }

    if (part.data?.url && typeof part.data.url === "string") {
      return part.data.url;
    }
  }

  for (const part of parts) {
    if (!part.text) {
      continue;
    }

    const match = /(https?:\/\/[^\s"'<>]+)/i.exec(part.text);

    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function bufferFromBase64(raw: string): Buffer {
  const cleaned = raw.includes(",") ? raw.split(",").pop() ?? raw : raw;
  return Buffer.from(cleaned, "base64");
}

function getContextId(body: unknown): string | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const record = body as Record<string, unknown>;

  if (typeof record.contextId === "string") {
    return record.contextId;
  }

  const message = record.message;

  if (message && typeof message === "object" && typeof (message as Record<string, unknown>).contextId === "string") {
    return (message as Record<string, string>).contextId;
  }

  return null;
}
