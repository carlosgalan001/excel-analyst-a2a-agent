import { randomUUID } from "crypto";
import { analyzeWorkbookFromBuffer, analyzeWorkbookFromUrl } from "./analyzer";
import { getTask, saveAnalysis, saveTask, type A2AMessage, type A2APart as A2ACanonicalPart, type A2ATaskRecord } from "./store";
import type { AnalysisResult, Kpi } from "./types";

const RAW_UPLOAD_LIMIT_BYTES = 4 * 1024 * 1024;

interface IncomingA2APart {
  kind?: string;
  text?: string;
  url?: string;
  filename?: string;
  mediaType?: string;
  raw?: string;
  file?: {
    uri?: string;
    bytes?: string;
    name?: string;
    mimeType?: string;
    mime_type?: string;
  };
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
    const rawPart = parts.find(
      (part) =>
        (typeof part.raw === "string" && part.raw.length > 0) ||
        (typeof part.file?.bytes === "string" && part.file.bytes.length > 0)
    );

    const raw = rawPart?.raw ?? rawPart?.file?.bytes;

    if (!raw) {
      throw new Error("A2A message must include a workbook URL, data.excelUrl, a URL in text, or a small base64 raw file.");
    }

    const buffer = bufferFromBase64(raw);

    if (buffer.byteLength > RAW_UPLOAD_LIMIT_BYTES) {
      throw new Error(
        `Raw base64 uploads are limited to ${RAW_UPLOAD_LIMIT_BYTES / 1024 / 1024} MB. Use a public or temporary Excel URL for large workbooks.`
      );
    }

    analysis = await analyzeWorkbookFromBuffer(buffer, rawPart?.filename ?? rawPart?.file?.name ?? "a2a-workbook.xlsx", { baseUrl });
  }

  saveAnalysis(analysis);

  const taskId = randomUUID();
  const contextId = getContextId(body) ?? randomUUID();
  const userMessage = buildUserMessage(body, parts, taskId, contextId);
  const contract = toA2AContract(analysis);
  const assistantText = buildAssistantText(contract);
  const agentMessage: A2AMessage = {
    kind: "message",
    role: "agent",
    messageId: randomUUID(),
    taskId,
    contextId,
    parts: [
      {
        kind: "text",
        text: assistantText
      }
    ],
    metadata: {
      sender: "excel_analyst_a2a_agent",
      output_in_chat: true
    }
  };
  const task: A2ATaskRecord = {
    kind: "task",
    id: taskId,
    contextId,
    status: {
      state: "completed",
      timestamp: new Date().toISOString(),
      message: agentMessage
    },
    history: [userMessage, agentMessage],
    artifacts: [
      {
        artifactId: "analysis_result",
        name: "analysis_result",
        description: "Complete Excel analysis JSON.",
        parts: [
          {
            kind: "data",
            data: analysis as unknown as Record<string, unknown>
          }
        ]
      },
      {
        artifactId: "executive_summary",
        name: "executive_summary",
        description: "Deterministic executive summary.",
        parts: [
          {
            kind: "text",
            text: analysis.executiveSummary
          }
        ]
      },
      {
        artifactId: "dashboard",
        name: "dashboard",
        description: "Dashboard URL for the interactive report.",
        parts: [
          {
            kind: "data",
            data: {
              dashboardUrl: analysis.dashboardUrl,
              reportUrl: analysis.dashboardUrl
            }
          },
          {
            kind: "text",
            text: `Dashboard: ${analysis.dashboardUrl}`
          }
        ]
      },
      {
        artifactId: "kpis",
        name: "kpis",
        description: "Workbook and numeric column KPIs.",
        parts: [
          {
            kind: "data",
            data: {
              kpis: analysis.kpis
            }
          }
        ]
      }
    ],
    metadata: contract as unknown as Record<string, unknown>
  };

  saveTask(task);
  return task;
}

export function getA2ATask(taskId: string): A2ATaskRecord | null {
  return getTask(taskId);
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

function extractParts(body: unknown): IncomingA2APart[] {
  if (!body || typeof body !== "object") {
    return [];
  }

  const record = body as Record<string, unknown>;
  const params = typeof record.params === "object" && record.params ? (record.params as Record<string, unknown>) : record;
  const message =
    typeof params.message === "object" && params.message
      ? (params.message as Record<string, unknown>)
      : typeof record.message === "object" && record.message
        ? (record.message as Record<string, unknown>)
        : record;
  const directParts = message.parts;

  if (Array.isArray(directParts)) {
    return directParts.filter((part): part is IncomingA2APart => typeof part === "object" && part !== null);
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

function extractUrl(parts: IncomingA2APart[]): string | null {
  for (const part of parts) {
    if (part.url) {
      return part.url;
    }

    if (part.file?.uri) {
      return part.file.uri;
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

  if (typeof record.context_id === "string") {
    return record.context_id;
  }

  const params = record.params;

  if (params && typeof params === "object") {
    const paramsRecord = params as Record<string, unknown>;
    const paramsMessage = paramsRecord.message;

    if (paramsMessage && typeof paramsMessage === "object") {
      const messageRecord = paramsMessage as Record<string, unknown>;

      if (typeof messageRecord.contextId === "string") {
        return messageRecord.contextId;
      }

      if (typeof messageRecord.context_id === "string") {
        return messageRecord.context_id;
      }
    }
  }

  const message = record.message;

  if (message && typeof message === "object" && typeof (message as Record<string, unknown>).contextId === "string") {
    return (message as Record<string, string>).contextId;
  }

  if (message && typeof message === "object" && typeof (message as Record<string, unknown>).context_id === "string") {
    return (message as Record<string, string>).context_id;
  }

  return null;
}

function buildUserMessage(body: unknown, parts: IncomingA2APart[], taskId: string, contextId: string): A2AMessage {
  const existingMessage = extractMessageRecord(body);
  const messageId =
    getString(existingMessage, "messageId") ?? getString(existingMessage, "message_id") ?? randomUUID();

  return {
    kind: "message",
    role: "user",
    messageId,
    taskId,
    contextId,
    parts: normalizeParts(parts),
    metadata: getRecord(existingMessage, "metadata") ?? undefined
  };
}

function normalizeParts(parts: IncomingA2APart[]): A2ACanonicalPart[] {
  const normalized = parts.map((part): A2ACanonicalPart | null => {
    if (typeof part.text === "string") {
      return {
        kind: "text",
        text: part.text
      };
    }

    if (part.file?.uri) {
      return {
        kind: "file",
        file: {
          uri: part.file.uri,
          name: part.file.name,
          mimeType: part.file.mimeType ?? part.file.mime_type
        }
      };
    }

    if (part.file?.bytes || part.raw) {
      return {
        kind: "file",
        file: {
          bytes: part.file?.bytes ?? part.raw,
          name: part.file?.name ?? part.filename,
          mimeType: part.file?.mimeType ?? part.file?.mime_type ?? part.mediaType
        }
      };
    }

    if (part.data && typeof part.data === "object") {
      return {
        kind: "data",
        data: part.data
      };
    }

    return null;
  });

  return normalized.filter((part): part is A2ACanonicalPart => part !== null);
}

function extractMessageRecord(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const record = body as Record<string, unknown>;
  const params = getRecord(record, "params");
  const paramsMessage = params ? getRecord(params, "message") : null;

  if (paramsMessage) {
    return paramsMessage;
  }

  return getRecord(record, "message") ?? record;
}

function getRecord(record: Record<string, unknown> | null, key: string): Record<string, unknown> | null {
  const value = record?.[key];
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function getString(record: Record<string, unknown> | null, key: string): string | null {
  const value = record?.[key];
  return typeof value === "string" ? value : null;
}

function buildAssistantText(contract: A2AContractResult): string {
  const topKpis = contract.kpis
    .slice(0, 6)
    .map((kpi) => `- ${kpi.label}: ${kpi.formattedValue}`)
    .join("\n");
  const findings = contract.findings.slice(0, 4).map((finding) => `- ${finding}`).join("\n");
  const recommendations = contract.recommendations.slice(0, 3).map((recommendation) => `- ${recommendation}`).join("\n");

  return [
    contract.summary,
    "",
    "Top KPIs:",
    topKpis || "- No KPIs generated.",
    "",
    "Findings:",
    findings || "- No findings generated.",
    "",
    "Recommendations:",
    recommendations || "- No recommendations generated.",
    "",
    `Dashboard: ${contract.dashboardUrl}`,
    `Analysis ID: ${contract.analysisId}`
  ].join("\n");
}
