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
  const url = extractUrl(parts) ?? findUrlDeep(body);
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
      const task = buildInputRequiredTask(body, parts);
      saveTask(task);
      return task;
    }

    const buffer = bufferFromBase64(raw);

    if (buffer.byteLength > RAW_UPLOAD_LIMIT_BYTES) {
      throw new Error(
        `Los envios base64 estan limitados a ${RAW_UPLOAD_LIMIT_BYTES / 1024 / 1024} MB. Usa una URL publica o temporal para Excels grandes.`
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
        description: "JSON completo del analisis de Excel.",
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
        description: "Resumen ejecutivo determinista.",
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
        description: "URL del dashboard para el informe interactivo.",
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
        description: "KPIs del libro y de columnas numericas.",
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

function buildInputRequiredTask(body: unknown, parts: IncomingA2APart[]): A2ATaskRecord {
  const taskId = randomUUID();
  const contextId = getContextId(body) ?? randomUUID();
  const userMessage = buildUserMessage(body, parts, taskId, contextId);
  const agentMessage: A2AMessage = {
    kind: "message",
    role: "agent",
    messageId: randomUUID(),
    taskId,
    contextId,
    parts: [
      {
        kind: "text",
        text: "Necesito una URL publica del Excel en el texto del mensaje o en data.excelUrl."
      }
    ],
    metadata: {
      sender: "excel_analyst_a2a_agent",
      output_in_chat: true
    }
  };

  return {
    kind: "task",
    id: taskId,
    contextId,
    status: {
      state: "input-required",
      timestamp: new Date().toISOString(),
      message: agentMessage
    },
    history: [userMessage, agentMessage],
    artifacts: [],
    metadata: {
      summary: "Se necesita una URL publica de Excel.",
      dashboardUrl: null,
      reportUrl: null
    }
  };
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
    return directParts
      .map(normalizeIncomingPart)
      .filter((part): part is IncomingA2APart => part !== null);
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

function normalizeIncomingPart(part: unknown): IncomingA2APart | null {
  if (!part || typeof part !== "object") {
    return null;
  }

  const record = part as Record<string, unknown>;
  const root = record.root;

  if (root && typeof root === "object" && !Array.isArray(root)) {
    return normalizeIncomingPart(root);
  }

  return record as IncomingA2APart;
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

function findUrlDeep(value: unknown): string | null {
  const seen = new Set<unknown>();

  function visit(current: unknown): string | null {
    if (typeof current === "string") {
      const match = /(https?:\/\/[^\s"'<>]+)/i.exec(current);
      return match?.[1] ?? null;
    }

    if (!current || typeof current !== "object" || seen.has(current)) {
      return null;
    }

    seen.add(current);

    if (Array.isArray(current)) {
      for (const item of current) {
        const found = visit(item);

        if (found) {
          return found;
        }
      }

      return null;
    }

    for (const item of Object.values(current as Record<string, unknown>)) {
      const found = visit(item);

      if (found) {
        return found;
      }
    }

    return null;
  }

  return visit(value);
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
  const structuralKpis = contract.kpis
    .filter((kpi) => !kpi.sheetName)
    .slice(0, 4)
    .map((kpi) => `- ${kpi.label}: ${kpi.formattedValue}`)
    .join("\n");
  const numericKpis = contract.kpis
    .filter((kpi) => kpi.sheetName)
    .slice(0, 8)
    .map((kpi) => `- ${kpi.label}: ${kpi.formattedValue}`)
    .join("\n");
  const findings = contract.findings.slice(0, 8).map((finding) => `- ${finding}`).join("\n");
  const recommendations = contract.recommendations.slice(0, 5).map((recommendation) => `- ${recommendation}`).join("\n");

  return [
    "Analisis completado.",
    "",
    "Resumen ejecutivo:",
    contract.summary,
    "",
    "KPIs estructurales:",
    structuralKpis || "- No se han generado KPIs estructurales.",
    "",
    "KPIs numericos destacados:",
    numericKpis || "- No se han detectado columnas numericas claras para KPIs de negocio.",
    "",
    "Hallazgos:",
    findings || "- No se han generado hallazgos.",
    "",
    "Recomendaciones:",
    recommendations || "- No se han generado recomendaciones.",
    "",
    `Dashboard: ${contract.dashboardUrl}`,
    `ID de analisis: ${contract.analysisId}`
  ].join("\n");
}
