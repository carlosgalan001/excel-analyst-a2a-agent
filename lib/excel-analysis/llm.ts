import type { AnalysisResult } from "./types";

const DEFAULT_MODEL = "gpt-4o-mini";

export async function enhanceSummaryWithLLM(result: AnalysisResult): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return null;
  }

  const compactPayload = {
    fileName: result.fileName,
    workbookProfile: result.workbookProfile,
    kpis: result.kpis.slice(0, 24),
    findings: result.findings,
    recommendations: result.recommendations,
    charts: result.charts.map((chart) => ({
      title: chart.title,
      type: chart.type,
      sheetName: chart.sheetName,
      topPoints: chart.data.slice(0, 8)
    }))
  };

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? DEFAULT_MODEL,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "Write a concise executive summary for a spreadsheet analysis. Use only the aggregate JSON supplied by the user. Do not invent facts."
          },
          {
            role: "user",
            content: JSON.stringify(compactPayload)
          }
        ]
      })
    });

    if (!response.ok) {
      return null;
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    return json.choices?.[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}
