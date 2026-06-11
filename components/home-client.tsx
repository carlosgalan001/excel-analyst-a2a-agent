"use client";

import { FileSpreadsheet, Link2, Loader2, Play, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AnalysisResult } from "@/lib/excel-analysis/types";

const DEMO_EXCEL_URL =
  "https://www.sspa.juntadeandalucia.es/servicioandaluzdesalud/sites/default/files/sincfiles/wsas-media-mediafile_sasdocumento/2025/Conjunto%20M%C3%ADnimo%20B%C3%A1sico%20de%20Datos.%20Grupos%20Relacionados%20por%20el%20Diagn%C3%B3stico%202024%20Indicadores..xlsx";

export function HomeClient() {
  const router = useRouter();
  const [url, setUrl] = useState(DEMO_EXCEL_URL);
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    setIsLoading(true);
    setError(null);

    try {
      const response = file ? await analyzeFile(file) : await analyzeUrl(url);
      const analysis = (await response.json()) as { analysis?: AnalysisResult; error?: string };

      if (!response.ok || !analysis.analysis) {
        throw new Error(analysis.error ?? "Unable to analyze workbook.");
      }

      sessionStorage.setItem(`excel-analysis:${analysis.analysis.analysisId}`, JSON.stringify(analysis.analysis));
      router.push(`/analysis/${analysis.analysis.analysisId}`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unexpected analysis error.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="panel analyzer-panel" aria-label="Workbook analyzer">
      <div className="form-stack">
        <div className="field">
          <label htmlFor="excel-url">Public Excel URL</label>
          <div className="input-row">
            <div className="input-shell">
              <Link2 size={18} aria-hidden="true" />
              <input
                id="excel-url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://example.com/workbook.xlsx"
                type="url"
              />
            </div>
          </div>
        </div>

        <div>
          <span className="file-label">Upload .xlsx/.xls</span>
          <label className="file-drop">
            <span className="brand-mark" aria-hidden="true">
              <FileSpreadsheet size={18} />
            </span>
            <input
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              type="file"
            />
          </label>
        </div>

        {file ? (
          <div className="status status-loading">
            Upload selected: {file.name}. URL analysis resumes when the file is cleared.
          </div>
        ) : null}

        {error ? <div className="status status-error">{error}</div> : null}

        {isLoading ? <div className="status status-loading">Analyzing workbook and generating dashboard...</div> : null}

        <div className="button-row">
          <button className="btn btn-primary" disabled={isLoading || (!file && !url.trim())} onClick={analyze} type="button">
            {isLoading ? <Loader2 size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
            Analyze
          </button>
          <button
            className="btn btn-secondary"
            disabled={isLoading || !file}
            onClick={() => setFile(null)}
            title="Clear uploaded file"
            type="button"
          >
            <Upload size={18} aria-hidden="true" />
            Use URL
          </button>
        </div>
      </div>
    </section>
  );
}

async function analyzeUrl(url: string): Promise<Response> {
  return fetch("/api/analyze/url", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ url })
  });
}

async function analyzeFile(file: File): Promise<Response> {
  const formData = new FormData();
  formData.append("file", file);

  return fetch("/api/analyze/upload", {
    method: "POST",
    body: formData
  });
}
