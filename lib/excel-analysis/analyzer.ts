import { randomUUID } from "crypto";
import path from "path";
import * as XLSX from "xlsx";
import { enhanceSummaryWithLLM } from "./llm";
import type {
  AnalysisOptions,
  AnalysisResult,
  ChartDefinition,
  ColumnProfile,
  DataQualityProfile,
  DateProfile,
  DetectedColumnRole,
  Kpi,
  NumericProfile,
  SheetProfile,
  SourceType,
  WorkbookProfile
} from "./types";

type CellValue = string | number | boolean | Date | null | undefined;

interface MutableColumnProfile {
  name: string;
  index: number;
  detectedRole?: DetectedColumnRole;
  nonNullCount: number;
  nullCount: number;
  numericCount: number;
  dateCount: number;
  booleanCount: number;
  textCount: number;
  numericSum: number;
  numericMin: number;
  numericMax: number;
  dateMin?: number;
  dateMax?: number;
  uniqueValues: Set<string>;
  sampleValues: string[];
}

interface MergeRange {
  s: {
    r: number;
    c: number;
  };
  e: {
    r: number;
    c: number;
  };
}

const DEMO_BASE_URL = "http://localhost:3000";
const URL_DOWNLOAD_LIMIT_BYTES = 70 * 1024 * 1024;
const DEFAULT_MAX_COLUMNS = 120;
const DEFAULT_INFERENCE_ROWS = 5000;
const MAX_CHARTS = 8;
const MAX_NUMERIC_KPI_COLUMNS = 12;

export async function analyzeWorkbookFromUrl(
  url: string,
  options: AnalysisOptions = {}
): Promise<AnalysisResult> {
  const validatedUrl = validateWorkbookUrl(url);
  const response = await fetchWithTimeout(validatedUrl);
  const contentLength = Number(response.headers.get("content-length") ?? 0);

  if (contentLength > URL_DOWNLOAD_LIMIT_BYTES) {
    throw new Error(
      `El Excel pesa ${(contentLength / 1024 / 1024).toFixed(1)} MB. Usa un libro mas pequeno o una URL temporal por debajo de ${URL_DOWNLOAD_LIMIT_BYTES / 1024 / 1024} MB.`
    );
  }

  const arrayBuffer = await response.arrayBuffer();

  if (arrayBuffer.byteLength > URL_DOWNLOAD_LIMIT_BYTES) {
    throw new Error(
      `El Excel pesa ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(1)} MB. Usa un libro mas pequeno o divide el analisis.`
    );
  }

  const fileName =
    getFileNameFromContentDisposition(response.headers.get("content-disposition")) ??
    getFileNameFromUrl(validatedUrl) ??
    "workbook.xlsx";

  return analyzeWorkbook(Buffer.from(arrayBuffer), fileName, "url", validatedUrl, options);
}

export async function analyzeWorkbookFromBuffer(
  buffer: Buffer,
  fileName: string,
  options: AnalysisOptions = {}
): Promise<AnalysisResult> {
  return analyzeWorkbook(buffer, fileName || "uploaded-workbook.xlsx", "upload", null, options);
}

async function analyzeWorkbook(
  buffer: Buffer,
  fileName: string,
  sourceType: SourceType,
  sourceUrl: string | null,
  options: AnalysisOptions
): Promise<AnalysisResult> {
  let workbook: XLSX.WorkBook;

  try {
    workbook = XLSX.read(buffer, {
      type: "buffer",
      cellDates: true,
      cellNF: false,
      cellStyles: false,
      sheetStubs: false,
      sheetRows: Math.max(1000, options.maxRowsForInference ?? DEFAULT_INFERENCE_ROWS)
    });
  } catch (error) {
    throw new Error(`Excel no valido: ${error instanceof Error ? error.message : "error desconocido del parser"}`);
  }

  if (!workbook.SheetNames.length) {
    throw new Error("El libro no contiene hojas.");
  }

  const createdAt = new Date().toISOString();
  const analysisId = randomUUID();
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const sheets: SheetProfile[] = [];
  const charts: ChartDefinition[] = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const sheetProfile = analyzeSheet(sheetName, worksheet, options);
    sheets.push(sheetProfile.profile);
    charts.push(...sheetProfile.charts);
  }

  const workbookProfile = buildWorkbookProfile(sheets);
  const kpis = buildKpis(workbookProfile, sheets);
  const trimmedCharts = charts.slice(0, MAX_CHARTS);
  const findings = buildFindings(workbookProfile, sheets, trimmedCharts);
  const recommendations = buildRecommendations(workbookProfile, sheets, trimmedCharts);
  const dashboardUrl = buildDashboardUrl(baseUrl, analysisId, sourceUrl);

  const deterministicSummary = buildExecutiveSummary(workbookProfile, sheets, findings);

  const result: AnalysisResult = {
    analysisId,
    fileName: sanitizeFileName(fileName),
    sourceType,
    sourceUrl,
    createdAt,
    workbookProfile,
    sheets,
    kpis,
    charts: trimmedCharts,
    findings,
    executiveSummary: deterministicSummary,
    recommendations,
    dashboardUrl
  };

  if (options.enableLlmSummary !== false && process.env.OPENAI_API_KEY) {
    const enhancedSummary = await enhanceSummaryWithLLM(result);

    if (enhancedSummary) {
      result.executiveSummary = enhancedSummary;
    }
  }

  return result;
}

function analyzeSheet(
  sheetName: string,
  worksheet: XLSX.WorkSheet | undefined,
  options: AnalysisOptions
): { profile: SheetProfile; charts: ChartDefinition[] } {
  if (!worksheet || !worksheet["!ref"]) {
    return {
      profile: emptySheetProfile(sheetName),
      charts: []
    };
  }

  const worksheetWithFullRef = worksheet as XLSX.WorkSheet & { "!fullref"?: string };
  const fullRef = typeof worksheetWithFullRef["!fullref"] === "string" ? worksheetWithFullRef["!fullref"] : worksheet["!ref"];
  const range = XLSX.utils.decode_range(fullRef);
  const rawRows = XLSX.utils.sheet_to_json<CellValue[]>(worksheet, {
    header: 1,
    defval: null,
    raw: true,
    blankrows: false
  });

  applyMergedCells(rawRows, worksheet["!merges"]);

  if (!rawRows.length || rawRows.every((row) => !rowHasValues(row))) {
    return {
      profile: emptySheetProfile(sheetName),
      charts: []
    };
  }

  const headerRowIndex = detectHeaderRow(rawRows);
  const maxColumnsInRows = rawRows.reduce((max, row) => Math.max(max, row.length), 0);
  const availableColumns = Math.max(range.e.c + 1, maxColumnsInRows);
  const maxColumns = Math.max(1, options.maxColumns ?? DEFAULT_MAX_COLUMNS);
  const columnCount = Math.min(availableColumns, maxColumns);
  const headers = buildHeaders(rawRows[headerRowIndex] ?? [], columnCount);
  const dataRows = rawRows.slice(headerRowIndex + 1).filter((row) => rowHasValues(row.slice(0, columnCount)));
  const estimatedRowCount = Math.max(dataRows.length, range.e.r - headerRowIndex);
  const analyzedRows = dataRows.length;

  const columns = buildColumnProfiles(headers, dataRows, options);
  const dataQuality = buildDataQuality(columns, dataRows, columnCount);
  const charts = buildSheetCharts(sheetName, columns, dataRows);

  return {
    profile: {
      name: sheetName,
      rowCount: estimatedRowCount,
      columnCount,
      analyzedRows,
      headerRowIndex,
      isEmpty: dataRows.length === 0,
      truncatedColumns: availableColumns > columnCount,
      columns,
      dataQuality
    },
    charts
  };
}

function emptySheetProfile(name: string): SheetProfile {
  return {
    name,
    rowCount: 0,
    columnCount: 0,
    analyzedRows: 0,
    headerRowIndex: null,
    isEmpty: true,
    truncatedColumns: false,
    columns: [],
    dataQuality: {
      nullCells: 0,
      totalCells: 0,
      nullRatio: 0,
      emptyColumns: 0,
      approximateDuplicateRows: 0
    }
  };
}

function applyMergedCells(rows: CellValue[][], merges: MergeRange[] | undefined): void {
  if (!merges?.length) {
    return;
  }

  for (const merge of merges) {
    const sourceValue = rows[merge.s.r]?.[merge.s.c];

    if (isBlank(sourceValue)) {
      continue;
    }

    const rowSpan = merge.e.r - merge.s.r + 1;
    const colSpan = merge.e.c - merge.s.c + 1;

    if (rowSpan * colSpan > 10000) {
      continue;
    }

    for (let rowIndex = merge.s.r; rowIndex <= merge.e.r; rowIndex += 1) {
      rows[rowIndex] ??= [];

      for (let columnIndex = merge.s.c; columnIndex <= merge.e.c; columnIndex += 1) {
        if (isBlank(rows[rowIndex][columnIndex])) {
          rows[rowIndex][columnIndex] = sourceValue;
        }
      }
    }
  }
}

function buildColumnProfiles(
  headers: string[],
  dataRows: CellValue[][],
  options: AnalysisOptions
): ColumnProfile[] {
  const inferenceRows = Math.max(250, options.maxRowsForInference ?? DEFAULT_INFERENCE_ROWS);
  const profiles = headers.map<MutableColumnProfile>((name, index) => ({
    name,
    index,
    detectedRole: detectColumnRole(name),
    nonNullCount: 0,
    nullCount: 0,
    numericCount: 0,
    dateCount: 0,
    booleanCount: 0,
    textCount: 0,
    numericSum: 0,
    numericMin: Number.POSITIVE_INFINITY,
    numericMax: Number.NEGATIVE_INFINITY,
    uniqueValues: new Set<string>(),
    sampleValues: []
  }));

  for (const row of dataRows) {
    for (const profile of profiles) {
      const value = row[profile.index];

      if (isBlank(value)) {
        profile.nullCount += 1;
        continue;
      }

      profile.nonNullCount += 1;

      const valueString = stringifyCell(value);

      if (profile.uniqueValues.size < 5000) {
        profile.uniqueValues.add(valueString);
      }

      if (profile.sampleValues.length < 5 && !profile.sampleValues.includes(valueString)) {
        profile.sampleValues.push(valueString);
      }

      const numericValue = parseNumberValue(value);

      if (numericValue !== null) {
        profile.numericCount += 1;
        profile.numericSum += numericValue;
        profile.numericMin = Math.min(profile.numericMin, numericValue);
        profile.numericMax = Math.max(profile.numericMax, numericValue);
      }

      const dateValue = parseDateValue(value, profile.detectedRole === "date");

      if (dateValue) {
        profile.dateCount += 1;
        const timestamp = dateValue.getTime();
        profile.dateMin = profile.dateMin === undefined ? timestamp : Math.min(profile.dateMin, timestamp);
        profile.dateMax = profile.dateMax === undefined ? timestamp : Math.max(profile.dateMax, timestamp);
      }

      if (typeof value === "boolean" || /^(true|false|yes|no|si)$/i.test(valueString)) {
        profile.booleanCount += 1;
      }

      if (profile.nonNullCount <= inferenceRows && typeof valueString === "string") {
        profile.textCount += 1;
      }
    }
  }

  return profiles.map((profile) => {
    const nonNull = profile.nonNullCount;
    const numberRatio = nonNull ? profile.numericCount / nonNull : 0;
    const dateRatio = nonNull ? profile.dateCount / nonNull : 0;
    const booleanRatio = nonNull ? profile.booleanCount / nonNull : 0;
    const uniqueCount = profile.uniqueValues.size;
    const emptyRatio = dataRows.length ? profile.nullCount / dataRows.length : 0;
    const inferredType =
      nonNull === 0
        ? "empty"
        : dateRatio >= 0.65 || (profile.detectedRole === "date" && profile.dateCount > 0)
          ? "date"
          : numberRatio >= 0.65
            ? "number"
            : booleanRatio >= 0.8
              ? "boolean"
              : isCategorical(uniqueCount, nonNull)
                ? "category"
                : numberRatio > 0.2 || dateRatio > 0.2
                  ? "mixed"
                  : "text";

    const numeric = profile.numericCount
      ? buildNumericProfile(profile.numericCount, profile.numericSum, profile.numericMin, profile.numericMax)
      : undefined;
    const date = profile.dateCount && profile.dateMin !== undefined && profile.dateMax !== undefined
      ? buildDateProfile(profile.dateCount, profile.dateMin, profile.dateMax)
      : undefined;

    return {
      name: profile.name,
      index: profile.index,
      inferredType,
      detectedRole: profile.detectedRole,
      nonNullCount: profile.nonNullCount,
      nullCount: profile.nullCount,
      emptyRatio,
      uniqueCount,
      sampleValues: profile.sampleValues,
      numeric,
      date
    };
  });
}

function buildNumericProfile(count: number, sum: number, min: number, max: number): NumericProfile {
  return {
    count,
    sum,
    average: count ? sum / count : 0,
    min,
    max
  };
}

function buildDateProfile(count: number, min: number, max: number): DateProfile {
  return {
    count,
    min: new Date(min).toISOString(),
    max: new Date(max).toISOString()
  };
}

function buildDataQuality(columns: ColumnProfile[], dataRows: CellValue[][], columnCount: number): DataQualityProfile {
  const totalCells = dataRows.length * columnCount;
  const nullCells = columns.reduce((sum, column) => sum + column.nullCount, 0);
  const emptyColumns = columns.filter((column) => column.inferredType === "empty").length;
  const rowSignatures = new Set<string>();

  for (const row of dataRows) {
    const signature = row
      .slice(0, Math.min(columnCount, 40))
      .map((cell) => stringifyCell(cell).toLocaleLowerCase())
      .join("|");
    rowSignatures.add(signature);
  }

  return {
    nullCells,
    totalCells,
    nullRatio: totalCells ? nullCells / totalCells : 0,
    emptyColumns,
    approximateDuplicateRows: Math.max(0, dataRows.length - rowSignatures.size)
  };
}

function buildSheetCharts(
  sheetName: string,
  columns: ColumnProfile[],
  dataRows: CellValue[][]
): ChartDefinition[] {
  if (!dataRows.length || !columns.length) {
    return [];
  }

  const numericColumn =
    columns.find((column) => column.detectedRole === "amount" && column.numeric) ??
    columns
      .filter((column) => column.numeric && column.inferredType === "number")
      .sort((a, b) => (b.numeric?.count ?? 0) - (a.numeric?.count ?? 0))[0];

  const categoryColumn =
    columns.find((column) => ["category", "region", "status"].includes(column.detectedRole ?? "")) ??
    columns
      .filter((column) => column.inferredType === "category" && column.uniqueCount > 1)
      .sort((a, b) => a.uniqueCount - b.uniqueCount)[0];

  const dateColumn =
    columns.find((column) => column.detectedRole === "date" && column.date) ??
    columns.find((column) => column.inferredType === "date" && column.date);

  const charts: ChartDefinition[] = [];

  if (categoryColumn) {
    const aggregate = aggregateByCategory(dataRows, categoryColumn.index, numericColumn?.index);

    if (aggregate.length > 1) {
      charts.push({
        id: `bar-${slugify(sheetName)}-${categoryColumn.index}`,
        title: `${categoryColumn.name} por ${numericColumn?.name ?? "numero de filas"}`,
        type: "bar",
        sheetName,
        xKey: "label",
        yKey: "value",
        data: aggregate.slice(0, 10),
        description: `Principales categorias detectadas en ${sheetName}.`
      });
    }

    if (numericColumn && aggregate.length > 1) {
      charts.push({
        id: `ranking-${slugify(sheetName)}-${categoryColumn.index}-${numericColumn.index}`,
        title: `Ranking de ${categoryColumn.name}`,
        type: "ranking",
        sheetName,
        xKey: "label",
        yKey: "value",
        data: aggregate.slice(0, 10),
        description: `Ranking por ${numericColumn.name}.`
      });
    }
  }

  if (dateColumn) {
    const temporal = aggregateByDate(dataRows, dateColumn.index, numericColumn?.index);

    if (temporal.length > 1) {
      charts.push({
        id: `line-${slugify(sheetName)}-${dateColumn.index}`,
        title: `${numericColumn?.name ?? "Filas"} por periodo`,
        type: "line",
        sheetName,
        xKey: "label",
        yKey: "value",
        data: temporal.slice(-24),
        description: `Tendencia temporal detectada a partir de ${dateColumn.name}.`
      });
    }
  }

  return charts;
}

function aggregateByCategory(
  rows: CellValue[][],
  categoryIndex: number,
  numericIndex?: number
): Array<{ label: string; value: number }> {
  const aggregate = new Map<string, number>();

  for (const row of rows) {
    const label = normalizeLabel(row[categoryIndex]);

    if (!label) {
      continue;
    }

    const value = numericIndex === undefined ? 1 : parseNumberValue(row[numericIndex]) ?? 0;
    aggregate.set(label, (aggregate.get(label) ?? 0) + value);
  }

  return [...aggregate.entries()]
    .map(([label, value]) => ({ label, value: roundNumber(value) }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
}

function aggregateByDate(
  rows: CellValue[][],
  dateIndex: number,
  numericIndex?: number
): Array<{ label: string; value: number }> {
  const aggregate = new Map<string, number>();

  for (const row of rows) {
    const date = parseDateValue(row[dateIndex], true);

    if (!date) {
      continue;
    }

    const label = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    const value = numericIndex === undefined ? 1 : parseNumberValue(row[numericIndex]) ?? 0;
    aggregate.set(label, (aggregate.get(label) ?? 0) + value);
  }

  return [...aggregate.entries()]
    .map(([label, value]) => ({ label, value: roundNumber(value) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function buildWorkbookProfile(sheets: SheetProfile[]): WorkbookProfile {
  const largestSheet = sheets
    .filter((sheet) => !sheet.isEmpty)
    .sort((a, b) => b.rowCount * Math.max(1, b.columnCount) - a.rowCount * Math.max(1, a.columnCount))[0];

  return {
    totalSheets: sheets.length,
    totalRows: sheets.reduce((sum, sheet) => sum + sheet.rowCount, 0),
    totalColumns: sheets.reduce((sum, sheet) => sum + sheet.columnCount, 0),
    emptySheets: sheets.filter((sheet) => sheet.isEmpty).length,
    analyzedRows: sheets.reduce((sum, sheet) => sum + sheet.analyzedRows, 0),
    largestSheet: largestSheet
      ? {
          name: largestSheet.name,
          rowCount: largestSheet.rowCount,
          columnCount: largestSheet.columnCount
        }
      : undefined
  };
}

function buildKpis(workbookProfile: WorkbookProfile, sheets: SheetProfile[]): Kpi[] {
  const kpis: Kpi[] = [
    {
      id: "total_sheets",
      label: "Hojas",
      value: workbookProfile.totalSheets,
      formattedValue: formatInteger(workbookProfile.totalSheets),
      aggregate: "count"
    },
    {
      id: "total_rows",
      label: "Filas",
      value: workbookProfile.totalRows,
      formattedValue: formatInteger(workbookProfile.totalRows),
      aggregate: "count"
    },
    {
      id: "total_columns",
      label: "Columnas",
      value: workbookProfile.totalColumns,
      formattedValue: formatInteger(workbookProfile.totalColumns),
      aggregate: "count"
    },
    {
      id: "empty_sheets",
      label: "Hojas vacias",
      value: workbookProfile.emptySheets,
      formattedValue: formatInteger(workbookProfile.emptySheets),
      aggregate: "count"
    }
  ];

  for (const sheet of sheets) {
    const numericColumns = sheet.columns
      .filter((column) => column.numeric && column.inferredType === "number")
      .slice(0, MAX_NUMERIC_KPI_COLUMNS);

    for (const column of numericColumns) {
      const numeric = column.numeric;

      if (!numeric) {
        continue;
      }

      kpis.push(
        numericKpi(sheet.name, column.name, "sum", numeric.sum),
        numericKpi(sheet.name, column.name, "average", numeric.average),
        numericKpi(sheet.name, column.name, "min", numeric.min),
        numericKpi(sheet.name, column.name, "max", numeric.max)
      );
    }
  }

  return kpis;
}

function numericKpi(
  sheetName: string,
  columnName: string,
  aggregate: "sum" | "average" | "min" | "max",
  value: number
): Kpi {
  return {
    id: `${slugify(sheetName)}-${slugify(columnName)}-${aggregate}`,
    label: `${columnName} ${translateAggregate(aggregate)}`,
    value: roundNumber(value),
    formattedValue: formatNumber(value),
    sheetName,
    columnName,
    aggregate
  };
}

function buildFindings(
  workbookProfile: WorkbookProfile,
  sheets: SheetProfile[],
  charts: ChartDefinition[]
): string[] {
  const findings: string[] = [];
  const nonEmptySheets = sheets.filter((sheet) => !sheet.isEmpty);
  const numericColumns = sheets.flatMap((sheet) => sheet.columns.filter((column) => column.inferredType === "number"));
  const dateColumns = sheets.flatMap((sheet) => sheet.columns.filter((column) => column.inferredType === "date"));
  const highNullSheets = sheets.filter((sheet) => sheet.dataQuality.nullRatio > 0.35 && !sheet.isEmpty);
  const duplicateSheets = sheets.filter((sheet) => sheet.dataQuality.approximateDuplicateRows > 0);

  findings.push(
    `El libro contiene ${formatInteger(workbookProfile.totalSheets)} hojas, ${formatInteger(workbookProfile.totalRows)} filas de datos y ${formatInteger(workbookProfile.totalColumns)} columnas detectadas.`
  );

  if (workbookProfile.largestSheet) {
    findings.push(
      `La hoja con mayor volumen es "${workbookProfile.largestSheet.name}", con ${formatInteger(workbookProfile.largestSheet.rowCount)} filas y ${formatInteger(workbookProfile.largestSheet.columnCount)} columnas.`
    );
  }

  if (workbookProfile.emptySheets) {
    findings.push(`${formatInteger(workbookProfile.emptySheets)} hojas parecen estar vacias.`);
  }

  if (numericColumns.length) {
    findings.push(`${formatInteger(numericColumns.length)} columnas numericas se han perfilado con sumas, medias y rangos.`);
  }

  if (dateColumns.length) {
    findings.push(`${formatInteger(dateColumns.length)} columnas con aspecto de fecha permiten analisis temporal.`);
  }

  if (highNullSheets.length) {
    findings.push(
      `${formatInteger(highNullSheets.length)} hojas tienen mas del 35% de celdas vacias y conviene revisarlas antes de usar los datos operativamente.`
    );
  }

  if (duplicateSheets.length) {
    findings.push(
      `${formatInteger(duplicateSheets.length)} hojas contienen posibles duplicados aproximados segun la firma de fila.`
    );
  }

  if (charts.length) {
    findings.push(`${formatInteger(charts.length)} agregados listos para graficar se han generado automaticamente.`);
  }

  if (!nonEmptySheets.length) {
    findings.push("No se han encontrado hojas con datos.");
  }

  const sheetSummary = nonEmptySheets
    .slice()
    .sort((a, b) => b.rowCount - a.rowCount)
    .slice(0, 3)
    .map((sheet) => `${sheet.name}: ${formatInteger(sheet.rowCount)} filas, ${formatInteger(sheet.columnCount)} columnas`)
    .join("; ");

  if (sheetSummary) {
    findings.push(`Hojas principales por volumen: ${sheetSummary}.`);
  }

  const usefulColumns = sheets
    .flatMap((sheet) =>
      sheet.columns
        .filter((column) => column.detectedRole || ["number", "date", "category"].includes(column.inferredType))
        .slice(0, 4)
        .map((column) => `${sheet.name}.${column.name} (${column.detectedRole ?? column.inferredType})`)
    )
    .slice(0, 8);

  if (usefulColumns.length) {
    findings.push(`Campos utiles detectados para explotacion: ${usefulColumns.join(", ")}.`);
  }

  return findings;
}

function buildExecutiveSummary(
  workbookProfile: WorkbookProfile,
  sheets: SheetProfile[],
  findings: string[]
): string {
  const quality = sheets.length
    ? sheets.reduce((sum, sheet) => sum + sheet.dataQuality.nullRatio, 0) / sheets.length
    : 0;
  const largest = workbookProfile.largestSheet
    ? ` La hoja principal por volumen es "${workbookProfile.largestSheet.name}".`
    : "";
  const qualitySentence =
    quality > 0.35
      ? " La completitud es irregular: antes de tomar decisiones conviene revisar columnas vacias y nulos."
      : " La completitud es suficiente para una primera exploracion y para construir un dashboard inicial.";

  return `${findings[0] ?? "Analisis del libro completado."}${largest}${qualitySentence}`;
}

function buildRecommendations(
  workbookProfile: WorkbookProfile,
  sheets: SheetProfile[],
  charts: ChartDefinition[]
): string[] {
  const recommendations: string[] = [];
  const emptyColumns = sheets.reduce((sum, sheet) => sum + sheet.dataQuality.emptyColumns, 0);
  const duplicateRows = sheets.reduce((sum, sheet) => sum + sheet.dataQuality.approximateDuplicateRows, 0);
  const hasDate = sheets.some((sheet) => sheet.columns.some((column) => column.inferredType === "date"));
  const hasCategory = sheets.some((sheet) => sheet.columns.some((column) => column.inferredType === "category"));
  const hasNumber = sheets.some((sheet) => sheet.columns.some((column) => column.inferredType === "number"));

  if (workbookProfile.emptySheets) {
    recommendations.push("Eliminar o documentar las hojas vacias para que los agentes posteriores se centren en tablas relevantes.");
  }

  if (emptyColumns) {
    recommendations.push(`Revisar ${formatInteger(emptyColumns)} columnas vacias antes de publicar este libro como fuente de integracion.`);
  }

  if (duplicateRows) {
    recommendations.push(`Validar ${formatInteger(duplicateRows)} posibles filas duplicadas antes de usar el fichero para reporting de KPIs.`);
  }

  if (!hasDate) {
    recommendations.push("Incorporar una columna de fecha explicita si se espera reporting de tendencias.");
  }

  if (!hasCategory) {
    recommendations.push("Normalizar campos de categoria, region o estado para mejorar la segmentacion automatica.");
  }

  if (!hasNumber) {
    recommendations.push("Anadir medidas numericas de negocio si el libro debe producir KPIs financieros u operativos.");
  }

  if (charts.length) {
    recommendations.push("Usar los agregados graficos como primer borrador de dashboard y validar las etiquetas con un responsable funcional.");
  }

  if (!recommendations.length) {
    recommendations.push("La estructura del libro es adecuada para un primer dashboard analitico.");
  }

  return recommendations;
}

function validateWorkbookUrl(rawUrl: string): string {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Indica una URL publica HTTP o HTTPS valida para el Excel.");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Solo se admiten URLs HTTP y HTTPS.");
  }

  return url.toString();
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        Accept:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, application/octet-stream, */*"
      }
    });

    if (!response.ok) {
      throw new Error(`La descarga ha fallado con HTTP ${response.status}.`);
    }

    return response;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("La descarga ha superado el limite de 45 segundos.");
    }

    throw error instanceof Error ? error : new Error("No se ha podido descargar el Excel.");
  } finally {
    clearTimeout(timeout);
  }
}

function getFileNameFromUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    const baseName = path.basename(decodeURIComponent(url.pathname));
    return baseName && baseName !== "/" ? sanitizeFileName(baseName) : null;
  } catch {
    return null;
  }
}

function getFileNameFromContentDisposition(header: string | null): string | null {
  if (!header) {
    return null;
  }

  const utfMatch = /filename\*=UTF-8''([^;]+)/i.exec(header);

  if (utfMatch?.[1]) {
    return sanitizeFileName(decodeURIComponent(utfMatch[1]));
  }

  const asciiMatch = /filename="?([^";]+)"?/i.exec(header);
  return asciiMatch?.[1] ? sanitizeFileName(asciiMatch[1]) : null;
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_").slice(0, 180) || "workbook.xlsx";
}

function detectHeaderRow(rows: CellValue[][]): number {
  let bestIndex = 0;
  let bestScore = Number.NEGATIVE_INFINITY;
  const limit = Math.min(rows.length, 20);

  for (let index = 0; index < limit; index += 1) {
    const row = rows[index] ?? [];
    const nonEmpty = row.filter((cell) => !isBlank(cell)).length;
    const textCount = row.filter((cell) => typeof cell === "string" && String(cell).trim().length > 0).length;
    const uniqueCount = new Set(row.filter((cell) => !isBlank(cell)).map((cell) => stringifyCell(cell))).size;
    const score = nonEmpty * 2 + textCount + uniqueCount * 0.5 - index * 0.12;

    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }

  return bestIndex;
}

function buildHeaders(headerRow: CellValue[], columnCount: number): string[] {
  const seen = new Map<string, number>();
  const headers: string[] = [];

  for (let index = 0; index < columnCount; index += 1) {
    const rawHeader = stringifyCell(headerRow[index]).trim();
    const baseHeader = rawHeader || `Columna ${XLSX.utils.encode_col(index)}`;
    const normalized = baseHeader.replace(/\s+/g, " ").slice(0, 120);
    const seenCount = seen.get(normalized.toLocaleLowerCase()) ?? 0;
    seen.set(normalized.toLocaleLowerCase(), seenCount + 1);
    headers.push(seenCount ? `${normalized} ${seenCount + 1}` : normalized);
  }

  return headers;
}

function detectColumnRole(header: string): DetectedColumnRole | undefined {
  const normalized = header
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();

  if (/\b(fecha|date|day|month|year|periodo|period)\b/.test(normalized)) {
    return "date";
  }

  if (/\b(importe|amount|coste|cost|price|precio|total|valor|value|venta|ventas|sales|revenue|ingreso|gasto)\b/.test(normalized)) {
    return "amount";
  }

  if (/\b(categoria|category|tipo|type|producto|product|segmento|segment|grupo|group|clase|class)\b/.test(normalized)) {
    return "category";
  }

  if (/\b(region|provincia|province|pais|country|territorio|territory|area|zona|zone|comunidad)\b/.test(normalized)) {
    return "region";
  }

  if (/\b(estado|status|state|situacion|fase|phase)\b/.test(normalized)) {
    return "status";
  }

  return undefined;
}

function isCategorical(uniqueCount: number, nonNullCount: number): boolean {
  if (!nonNullCount) {
    return false;
  }

  return uniqueCount <= 40 && uniqueCount <= Math.max(8, nonNullCount * 0.25);
}

function rowHasValues(row: CellValue[]): boolean {
  return row.some((cell) => !isBlank(cell));
}

function isBlank(value: CellValue): boolean {
  return value === null || value === undefined || (typeof value === "string" && value.trim() === "");
}

function stringifyCell(value: CellValue): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value).trim();
}

function normalizeLabel(value: CellValue): string | null {
  const label = stringifyCell(value).replace(/\s+/g, " ").trim();
  return label ? label.slice(0, 90) : null;
}

function parseNumberValue(value: CellValue): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed || /[a-zA-Z]{2,}/.test(trimmed.replace(/[eE][+-]?\d+/, ""))) {
    return null;
  }

  let normalized = trimmed.replace(/[^\d,.\-+eE]/g, "");
  const comma = normalized.lastIndexOf(",");
  const dot = normalized.lastIndexOf(".");

  if (comma > -1 && dot > -1) {
    normalized =
      comma > dot ? normalized.replace(/\./g, "").replace(",", ".") : normalized.replace(/,/g, "");
  } else if (comma > -1) {
    normalized = normalized.replace(",", ".");
  }

  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function parseDateValue(value: CellValue, allowExcelSerial: boolean): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "number" && allowExcelSerial && value > 20000 && value < 70000) {
    const parsed = XLSX.SSF.parse_date_code(value);

    if (parsed) {
      return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
    }
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed || !/[/-]/.test(trimmed)) {
    return null;
  }

  const dayMonthYear = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(trimmed);

  if (dayMonthYear) {
    const first = Number(dayMonthYear[1]);
    const second = Number(dayMonthYear[2]);
    const fullYear = Number(dayMonthYear[3].length === 2 ? `20${dayMonthYear[3]}` : dayMonthYear[3]);
    const day = first > 12 ? first : second > 12 ? second : first;
    const month = first > 12 ? second : second > 12 ? first : second;
    const parsedDate = new Date(Date.UTC(fullYear, month - 1, day));

    if (
      parsedDate.getUTCFullYear() === fullYear &&
      parsedDate.getUTCMonth() === month - 1 &&
      parsedDate.getUTCDate() === day
    ) {
      return parsedDate;
    }
  }

  const timestamp = Date.parse(trimmed);

  if (Number.isNaN(timestamp)) {
    return null;
  }

  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  return year >= 1900 && year <= 2200 ? date : null;
}

function normalizeBaseUrl(baseUrl?: string): string {
  if (!baseUrl) {
    return DEMO_BASE_URL;
  }

  return baseUrl.replace(/\/+$/, "");
}

function buildDashboardUrl(baseUrl: string, analysisId: string, sourceUrl: string | null): string {
  const url = new URL(`/analysis/${analysisId}`, baseUrl);

  if (sourceUrl) {
    url.searchParams.set("sourceUrl", sourceUrl);
  }

  return url.toString();
}

function translateAggregate(aggregate: "sum" | "average" | "min" | "max"): string {
  const labels = {
    sum: "suma",
    average: "media",
    min: "minimo",
    max: "maximo"
  };

  return labels[aggregate];
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-ES", {
    maximumFractionDigits: Math.abs(value) >= 100 ? 0 : 2
  }).format(value);
}

function roundNumber(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(value * 100) / 100;
}

function slugify(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
}
