export type SourceType = "url" | "upload";

export type InferredColumnType = "number" | "date" | "category" | "text" | "boolean" | "empty" | "mixed";

export type DetectedColumnRole = "date" | "amount" | "category" | "region" | "status";

export interface AnalysisOptions {
  baseUrl?: string;
  maxRowsForInference?: number;
  maxColumns?: number;
  enableLlmSummary?: boolean;
}

export interface NumericProfile {
  count: number;
  sum: number;
  average: number;
  min: number;
  max: number;
}

export interface DateProfile {
  count: number;
  min: string;
  max: string;
}

export interface ColumnProfile {
  name: string;
  index: number;
  inferredType: InferredColumnType;
  detectedRole?: DetectedColumnRole;
  nonNullCount: number;
  nullCount: number;
  emptyRatio: number;
  uniqueCount: number;
  sampleValues: string[];
  numeric?: NumericProfile;
  date?: DateProfile;
}

export interface DataQualityProfile {
  nullCells: number;
  totalCells: number;
  nullRatio: number;
  emptyColumns: number;
  approximateDuplicateRows: number;
}

export interface SheetProfile {
  name: string;
  rowCount: number;
  columnCount: number;
  analyzedRows: number;
  headerRowIndex: number | null;
  isEmpty: boolean;
  truncatedColumns: boolean;
  columns: ColumnProfile[];
  dataQuality: DataQualityProfile;
}

export interface WorkbookProfile {
  totalSheets: number;
  totalRows: number;
  totalColumns: number;
  emptySheets: number;
  analyzedRows: number;
  largestSheet?: {
    name: string;
    rowCount: number;
    columnCount: number;
  };
}

export interface Kpi {
  id: string;
  label: string;
  value: number | string;
  formattedValue: string;
  unit?: string;
  sheetName?: string;
  columnName?: string;
  aggregate?: "sum" | "average" | "min" | "max" | "count" | "ratio";
}

export interface ChartPoint {
  label: string;
  value: number;
}

export interface ChartDefinition {
  id: string;
  title: string;
  type: "bar" | "line" | "ranking";
  sheetName: string;
  xKey: "label";
  yKey: "value";
  data: ChartPoint[];
  description: string;
}

export interface AnalysisResult {
  analysisId: string;
  fileName: string;
  sourceType: SourceType;
  sourceUrl: string | null;
  createdAt: string;
  workbookProfile: WorkbookProfile;
  sheets: SheetProfile[];
  kpis: Kpi[];
  charts: ChartDefinition[];
  findings: string[];
  executiveSummary: string;
  recommendations: string[];
  dashboardUrl: string;
}
