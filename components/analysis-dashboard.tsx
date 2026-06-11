"use client";

import {
  BarChart,
  Bar,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { Clipboard, ExternalLink } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { AnalysisResult, ChartDefinition, ColumnProfile, SheetProfile } from "@/lib/excel-analysis/types";

interface Props {
  analysisId: string;
}

export function AnalysisDashboard({ analysisId }: Props) {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [selectedSheetName, setSelectedSheetName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/analysis/${analysisId}`, { cache: "no-store" });
        const json = (await response.json()) as { analysis?: AnalysisResult; error?: string };

        if (!response.ok || !json.analysis) {
          const cached = sessionStorage.getItem(`excel-analysis:${analysisId}`);

          if (!cached) {
            throw new Error(json.error ?? "Analysis not found in runtime memory.");
          }

          const parsed = JSON.parse(cached) as AnalysisResult;
          if (active) {
            setAnalysis(parsed);
            setSelectedSheetName(parsed.sheets[0]?.name ?? null);
          }
          return;
        }

        sessionStorage.setItem(`excel-analysis:${analysisId}`, JSON.stringify(json.analysis));

        if (active) {
          setAnalysis(json.analysis);
          setSelectedSheetName(json.analysis.sheets[0]?.name ?? null);
        }
      } catch (caughtError) {
        if (active) {
          setError(caughtError instanceof Error ? caughtError.message : "Unable to load analysis.");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [analysisId]);

  const selectedSheet = useMemo(() => {
    if (!analysis) {
      return null;
    }

    return analysis.sheets.find((sheet) => sheet.name === selectedSheetName) ?? analysis.sheets[0] ?? null;
  }, [analysis, selectedSheetName]);

  if (isLoading) {
    return (
      <section className="content">
        <div className="empty-state">
          <p>Loading analysis...</p>
        </div>
      </section>
    );
  }

  if (error || !analysis) {
    return (
      <section className="content">
        <div className="empty-state">
          <div>
            <h1>Analysis unavailable</h1>
            <p>{error ?? "The analysis result is no longer available in memory."}</p>
          </div>
        </div>
      </section>
    );
  }

  async function copyJson() {
    if (!analysis) {
      return;
    }

    await navigator.clipboard.writeText(JSON.stringify(analysis, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <section className="content">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Analysis dashboard</p>
          <h1>{analysis.fileName}</h1>
          <p>{analysis.executiveSummary}</p>
        </div>
        <div className="button-row">
          <a className="btn btn-secondary" href={analysis.dashboardUrl} rel="noreferrer" target="_blank">
            <ExternalLink size={18} aria-hidden="true" />
            Open
          </a>
          <button className="btn btn-secondary" onClick={copyJson} title="Copy JSON result" type="button">
            <Clipboard size={18} aria-hidden="true" />
            {copied ? "Copied" : "Copy JSON"}
          </button>
        </div>
      </div>

      <div className="kpi-grid" aria-label="Workbook KPIs">
        {analysis.kpis.slice(0, 8).map((kpi) => (
          <div className="kpi-card" key={kpi.id}>
            <small>{kpi.label}</small>
            <strong>{kpi.formattedValue}</strong>
            <span>{kpi.sheetName ?? "Workbook"}</span>
          </div>
        ))}
      </div>

      <div className="dashboard-grid" style={{ marginTop: 18 }}>
        <aside className="sidebar" aria-label="Detected sheets">
          {analysis.sheets.map((sheet) => (
            <button
              className={`sheet-button ${sheet.name === selectedSheet?.name ? "active" : ""}`}
              key={sheet.name}
              onClick={() => setSelectedSheetName(sheet.name)}
              type="button"
            >
              <span>{sheet.name}</span>
              <small>
                {formatInteger(sheet.rowCount)} rows / {formatInteger(sheet.columnCount)} columns
              </small>
            </button>
          ))}
        </aside>

        <div className="main-stack">
          {selectedSheet ? <SheetDetails sheet={selectedSheet} /> : null}
          <Findings title="Findings" items={analysis.findings} />
          <Findings title="Recommendations" items={analysis.recommendations} />
          <Charts charts={analysis.charts} />

          <section className="section-band">
            <div className="section-heading">
              <div>
                <h2>JSON Result</h2>
                <p>Stable response returned by the analysis engine and A2A task artifact.</p>
              </div>
              <button className="btn btn-secondary" onClick={copyJson} title="Copy JSON result" type="button">
                <Clipboard size={18} aria-hidden="true" />
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <pre className="json-block">{JSON.stringify(analysis, null, 2)}</pre>
          </section>
        </div>
      </div>
    </section>
  );
}

function SheetDetails({ sheet }: { sheet: SheetProfile }) {
  const quality = sheet.dataQuality;

  return (
    <section className="section-band">
      <div className="section-heading">
        <div>
          <h2>{sheet.name}</h2>
          <p>
            {formatInteger(sheet.rowCount)} rows, {formatInteger(sheet.columnCount)} columns, header row{" "}
            {sheet.headerRowIndex === null ? "not detected" : sheet.headerRowIndex + 1}.
          </p>
        </div>
        <span className={quality.nullRatio > 0.35 ? "badge badge-warn" : "badge"}>
          {formatPercent(quality.nullRatio)} null cells
        </span>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <small>Total cells</small>
          <strong>{formatInteger(quality.totalCells)}</strong>
          <span>Profiled cells</span>
        </div>
        <div className="kpi-card">
          <small>Null cells</small>
          <strong>{formatInteger(quality.nullCells)}</strong>
          <span>{formatPercent(quality.nullRatio)}</span>
        </div>
        <div className="kpi-card">
          <small>Empty columns</small>
          <strong>{formatInteger(quality.emptyColumns)}</strong>
          <span>Detected automatically</span>
        </div>
        <div className="kpi-card">
          <small>Approx duplicates</small>
          <strong>{formatInteger(quality.approximateDuplicateRows)}</strong>
          <span>Row signature match</span>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <ColumnTable columns={sheet.columns} />
      </div>
    </section>
  );
}

function ColumnTable({ columns }: { columns: ColumnProfile[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Column</th>
            <th>Type</th>
            <th>Role</th>
            <th>Non-null</th>
            <th>Nulls</th>
            <th>Unique</th>
            <th>Numeric range</th>
            <th>Samples</th>
          </tr>
        </thead>
        <tbody>
          {columns.map((column) => (
            <tr key={`${column.index}-${column.name}`}>
              <td>{column.name}</td>
              <td>{column.inferredType}</td>
              <td>{column.detectedRole ?? "-"}</td>
              <td>{formatInteger(column.nonNullCount)}</td>
              <td>{formatInteger(column.nullCount)}</td>
              <td>{formatInteger(column.uniqueCount)}</td>
              <td>{column.numeric ? `${formatNumber(column.numeric.min)} to ${formatNumber(column.numeric.max)}` : "-"}</td>
              <td>{column.sampleValues.join(", ") || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Findings({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="section-band">
      <h2>{title}</h2>
      <ul className="list-stack">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function Charts({ charts }: { charts: ChartDefinition[] }) {
  if (!charts.length) {
    return (
      <section className="section-band">
        <h2>Charts</h2>
        <p>No chart-ready aggregates were detected for this workbook.</p>
      </section>
    );
  }

  return (
    <section className="section-band">
      <h2>Charts</h2>
      <div className="charts-grid">
        {charts.map((chart) => (
          <div className="chart-box" key={chart.id}>
            <h3>{chart.title}</h3>
            <p>{chart.description}</p>
            <ResponsiveContainer height={230} width="100%">
              {chart.type === "line" ? (
                <LineChart data={chart.data} margin={{ bottom: 8, left: 0, right: 10, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line dataKey="value" stroke="#2563eb" strokeWidth={2} type="monotone" />
                </LineChart>
              ) : (
                <BarChart data={chart.data} margin={{ bottom: 8, left: 0, right: 10, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill={chart.type === "ranking" ? "#c2410c" : "#0f766e"} radius={[4, 4, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        ))}
      </div>
    </section>
  );
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: Math.abs(value) >= 100 ? 0 : 2 }).format(value);
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1, style: "percent" }).format(value);
}
