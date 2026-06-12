# Codex One-Shot Prompt

Construye desde cero una demo completa llamada `Excel Analyst A2A Agent V2`.

Este prompt esta pensado para ejecutarse una sola vez. Optimiza para que la aplicacion compile, funcione en demo y sea compatible con A2A. Si tienes que recortar alcance para terminar, prioriza en este orden:

1. Crear proyecto Next.js funcional.
2. Analisis desde URL publica de Excel.
3. Dashboard visual util.
4. Agent Card y endpoints A2A compatibles con AWP.
5. Fallback Vercel sin base de datos.
6. Opcion LLM/Agents SDK si existe `OPENAI_API_KEY`.
7. Upload local y CSV/TXT/Markdown como extras.

No dejes el proyecto a medias por intentar implementar todos los extras.

## Contexto de negocio

Queremos una demo para demostrar que:

- Codex puede crear una aplicacion completa desde cero.
- La aplicacion analiza datos sanitarios publicos contenidos principalmente en Excel.
- Un agente externo de AWP puede llamar a este agente por protocolo A2A, enviar una URL publica de un fichero y recibir KPIs, hallazgos, recomendaciones y un enlace a dashboard.

El caso principal son ficheros de informacion sanitaria publica, especialmente actividad hospitalaria, altas, GRD/diagnosticos, estancias, costes/importes, hospitales, territorios y categorias clinicas.

## Resultado esperado

Crea una carpeta de proyecto llamada `excel-analyst-a2a-agent` en el directorio actual.

Si la carpeta ya existe:

- inspeccionala;
- si esta vacia o no tiene proyecto Next.js, inicializa ahi el proyecto;
- si ya tiene proyecto Next.js, adapta lo existente sin borrar trabajo no relacionado.

La aplicacion debe estar lista para:

- ejecutar localmente con `npm run dev`;
- compilar con `npm run build`;
- subirse a GitHub;
- conectarse despues a Vercel manualmente.

## Stack obligatorio

- Next.js App Router.
- TypeScript.
- Tailwind CSS.
- SheetJS/xlsx para Excel.
- Recharts para graficos.
- lucide-react para iconos.
- OpenAI Agents SDK opcional para enriquecer insights cuando exista `OPENAI_API_KEY`.
- Sin Docker.
- Sin base de datos obligatoria.
- Sin autenticacion.
- Endpoint publico para demo.
- Todo el front, errores, resumenes, hallazgos, recomendaciones y respuestas A2A en espanol.

Usa una version de Node compatible con Next.js y Vercel. Si alguna dependencia exige una version minima, reflejala en `package.json`, pero no bloquees la demo si el modo determinista compila. El codigo de `@openai/agents` debe ejecutarse solo en servidor y mediante import dinamico cuando exista `OPENAI_API_KEY`.

## Comandos de arranque

Ejecuta una secuencia equivalente a esta:

```bash
npx create-next-app@latest excel-analyst-a2a-agent --typescript --eslint --app --src-dir --tailwind --import-alias "@/*" --use-npm
cd excel-analyst-a2a-agent
npm install xlsx papaparse recharts lucide-react openai @openai/agents zod
npm install -D @types/papaparse
```

Si `create-next-app` pregunta opciones interactivas, elige:

- TypeScript: yes.
- ESLint: yes.
- Tailwind: yes.
- `src/` directory: yes.
- App Router: yes.
- Turbopack: no si da problemas; si viene por defecto y compila, aceptalo.
- Import alias: `@/*`.

## URL principal de demo

Usa esta URL como ejemplo prellenado en la home y en el README:

```text
https://www.sspa.juntadeandalucia.es/servicioandaluzdesalud/sites/default/files/sincfiles/wsas-media-mediafile_sasdocumento/2025/Conjunto%20M%C3%ADnimo%20B%C3%A1sico%20de%20Datos.%20Grupos%20Relacionados%20por%20el%20Diagn%C3%B3stico%202024%20Indicadores..xlsx
```

## Alcance de formatos

Formato obligatorio:

- Excel `.xlsx` y `.xls` desde URL publica.

Formatos opcionales si no ponen en riesgo la demo:

- CSV `.csv`.
- TXT `.txt` si contiene tabla delimitada.
- Markdown `.md` si contiene tablas Markdown.

Para CSV/TXT/MD, basta con convertir cada tabla detectada en una "hoja logica" y reutilizar el mismo motor de analisis. Si TXT o MD no contienen tablas claras, devuelve un error claro en espanol: `No se han detectado tablas analizables en el fichero`.

## Estructura de archivos requerida

Crea o adapta esta estructura:

```text
excel-analyst-a2a-agent/
  README.md
  .env.example
  next.config.ts
  package.json
  src/
    app/
      globals.css
      layout.tsx
      page.tsx
      analysis/
        [analysisId]/
          page.tsx
          AnalysisDashboard.tsx
      api/
        analyze/
          route.ts
        analysis/
          [analysisId]/
            route.ts
      .well-known/
        agent-card.json/
          route.ts
      a2a/
        v1/
          route.ts
          message-send/
            route.ts
          tasks/
            [taskId]/
              route.ts
    lib/
      analysis-store.ts
      urls.ts
      data-analysis/
        index.ts
        types.ts
        parse.ts
        semantic.ts
        aggregates.ts
        charts.ts
        summary.ts
        llm-agent.ts
      a2a/
        types.ts
        task-store.ts
        request-extractor.ts
        response-builder.ts
        handler.ts
    components/
      CopyButton.tsx
      EmptyState.tsx
      MetricCard.tsx
      Section.tsx
  scripts/
    smoke-test-a2a.mjs
```

Importante para Windows: no crees una carpeta llamada `message:send`, porque `:` no es valido en Windows. Crea `src/app/a2a/v1/message-send/route.ts` y anade un rewrite en `next.config.ts`:

```ts
const nextConfig = {
  async rewrites() {
    return [
      { source: "/a2a/v1/message:send", destination: "/a2a/v1/message-send" },
    ];
  },
};

export default nextConfig;
```

## Variables de entorno

Crea `.env.example`:

```text
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.4-mini
NEXT_PUBLIC_BASE_URL=
```

Reglas:

- Si `OPENAI_API_KEY` no existe, todo debe funcionar en modo determinista.
- Si `OPENAI_API_KEY` existe, usa un agente LLM para mejorar resumen, hallazgos y recomendaciones.
- Nunca envies el fichero bruto completo al LLM.
- Envia solo JSON agregado compacto: KPIs, columnas detectadas, perfiles, agregados y hallazgos deterministas.

## Tipos principales

Define tipos estables en `src/lib/data-analysis/types.ts`.

Incluye al menos:

```ts
export type FileType = "excel" | "csv" | "txt" | "markdown" | "unknown";
export type SourceType = "url" | "upload" | "sample";
export type SemanticRole =
  | "activity"
  | "time"
  | "money"
  | "hospital"
  | "territory"
  | "clinical"
  | "period"
  | "status"
  | "identifier"
  | "category"
  | "unknown";

export interface AnalysisOptions {
  baseUrl?: string;
  maxRowsPerSheet?: number;
  enableLlm?: boolean;
}

export interface AnalysisResult {
  analysisId: string;
  fileName: string;
  fileType: FileType;
  sourceType: SourceType;
  sourceUrl?: string;
  createdAt: string;
  datasetProfile: DatasetProfile;
  sheets: SheetAnalysis[];
  kpis: Kpi[];
  charts: ChartSpec[];
  findings: string[];
  executiveSummary: string;
  recommendations: string[];
  dashboardUrl?: string;
  llmEnhanced?: boolean;
}
```

El JSON puede tener mas campos, pero no elimines estos.

## Motor de analisis

Implementa `src/lib/data-analysis/index.ts` con estas funciones:

```ts
export async function analyzeDataSourceFromUrl(url: string, options?: AnalysisOptions): Promise<AnalysisResult>
export async function analyzeDataSourceFromBuffer(buffer: Buffer, fileName: string, options?: AnalysisOptions): Promise<AnalysisResult>
```

Tambien puedes exponer aliases:

```ts
export const analyzeWorkbookFromUrl = analyzeDataSourceFromUrl;
export const analyzeWorkbookFromBuffer = analyzeDataSourceFromBuffer;
```

### Descarga desde URL

Para `analyzeDataSourceFromUrl`:

- valida que la URL sea `http://` o `https://`;
- descarga con `fetch`;
- si falla, devuelve error claro;
- limita tamano razonable, por ejemplo 25 MB;
- detecta nombre de fichero desde URL o `content-disposition`;
- detecta extension y `content-type`;
- usa `Buffer.from(await response.arrayBuffer())`;
- no dependas de filesystem persistente.

### Parseo Excel

Con `xlsx`:

- usa `XLSX.read(buffer, { type: "buffer", cellDates: true })`;
- recorre todas las hojas;
- convierte cada hoja a matriz con `sheet_to_json(sheet, { header: 1, defval: null, raw: false })`;
- detecta fila de cabecera buscando la primera fila con al menos 2 celdas no vacias;
- normaliza cabeceras vacias como `Columna 1`, `Columna 2`;
- si hay cabeceras duplicadas, sufija ` (2)`, ` (3)`;
- limita agregacion por hoja a `maxRowsPerSheet` por defecto 30000;
- maneja hojas vacias sin romper.

### Parseo CSV/TXT/Markdown opcional

CSV:

- usa `papaparse`;
- detecta delimitador entre coma, punto y coma, tabulador y pipe;
- soporta UTF-8;
- inferir cabecera si la primera fila parece textual.

TXT:

- intenta detectar delimitadores;
- si no hay tabla clara, devuelve error controlado.

Markdown:

- extrae tablas con filas que empiecen y terminen por `|`;
- ignora la fila separadora `| --- | --- |`;
- crea una hoja logica por tabla.

## Analisis semantico sanitario

Implementa heuristicas simples, deterministas y robustas. Normaliza nombres de columna:

- minusculas;
- sin tildes;
- sin signos raros;
- espacios compactados.

Clasifica columnas por nombre y muestra de valores:

- `activity`: altas, alta, bajas, ingresos, episodios, casos, pacientes, consultas, urgencias, actividad, total.
- `time`: estancia, dias, demora, duracion, tiempo, plazo.
- `money`: coste, costo, importe, tarifa, precio, facturacion, gasto.
- `hospital`: hospital, centro, centro sanitario, complejo hospitalario.
- `territory`: provincia, area, region, comunidad, municipio, distrito.
- `clinical`: grd, diagnostico, cie, procedimiento, servicio, especialidad, categoria clinica.
- `period`: fecha, anio, ano, mes, periodo, ejercicio.
- `status`: estado, tipo alta, tipo de alta, tipo hospital, urgencia, programado.
- `identifier`: id, identificador, codigo, cod, clave.
- `category`: texto categorico de baja cardinalidad.

Regla importante: no sumes identificadores, codigos, anios, codigos CIE, codigos GRD ni codigos de centro aunque sean numericos.

Para cada columna numerica decide:

- agregable: altas, casos, pacientes, ingresos, coste, importe, dias;
- promedio: estancia media, coste medio, peso medio, demora media;
- identificador/codigo: no sumar.

## KPIs requeridos

Genera KPIs tecnicos minimos:

- numero de hojas/tablas;
- filas analizadas;
- columnas detectadas.

Genera KPIs sanitarios cuando existan campos compatibles:

- total de altas/casos/episodios/pacientes;
- numero de hospitales/centros detectados;
- hospital, territorio, servicio, diagnostico, GRD o categoria con mayor volumen;
- porcentaje del top 1 y top 5 sobre el total;
- estancia media o demora media si hay campos de tiempo;
- coste/importe total si hay campos economicos;
- coste medio por alta/caso si existen actividad y coste;
- registros validos/invalidos si hay columnas de validacion;
- top diagnosticos/GRD/categorias por volumen.

Los KPIs deben tener este estilo:

```ts
interface Kpi {
  id: string;
  label: string;
  value: string | number;
  unit?: string;
  description?: string;
  tone?: "neutral" | "good" | "warning" | "critical";
  sourceSheet?: string;
}
```

## Graficos requeridos

Genera `charts` con datos ya agregados. No renderices miles de filas.

Prioridad:

1. Barras: actividad por hospital/centro/territorio/categoria.
2. Ranking top N: hospitales, servicios, diagnosticos, GRD o categorias por volumen.
3. Linea temporal: periodo/anio/mes/fecha + metrica de actividad, tiempo o coste.
4. Composicion: tipo de alta, estado, tipo hospital o categoria clinica.
5. Dispersion: coste/estancia frente a volumen si es facil.

Si no hay grafico posible, muestra una seccion explicando que faltan dimensiones o metricas.

## Hallazgos y recomendaciones

Separa claramente:

- `Hallazgos de negocio`.
- `Calidad del dato`.
- `Perfil tecnico`.

No generes hallazgos como `hay 70 columnas numericas`. Eso puede aparecer en perfil tecnico, pero no como insight principal.

Los hallazgos de negocio deben hablar de:

- volumen asistencial;
- concentracion de actividad;
- hospitales/territorios/categorias destacadas;
- estancia, demora, coste o importe;
- tendencias temporales;
- valores extremos;
- campos funcionales ausentes que limitan el analisis.

Las recomendaciones deben ser accionables:

- revisar centros/categorias con valores extremos;
- investigar desviaciones de estancia, coste o actividad;
- completar fecha/periodo, hospital/centro o categoria clinica si faltan;
- validar definiciones funcionales ambiguas;
- crear seguimiento temporal si no existe periodo.

## Resumen determinista

Implementa `buildDeterministicSummary(result)`:

- maximo 6 frases;
- espanol claro;
- orientado a responsable sanitario;
- debe mencionar volumen, principal foco de actividad, KPIs mas relevantes y principal cautela de calidad.

Ejemplo de estilo:

```text
El fichero contiene 6 hojas y concentra la mayor parte de la actividad en la hoja GRD-Hospital. Se han detectado metricas compatibles con actividad hospitalaria, incluyendo altas y categorias GRD. La actividad se concentra especialmente en los principales hospitales/categorias identificados, por lo que conviene revisar el ranking y el peso relativo del top 5. No se ha detectado una columna temporal suficientemente clara, por lo que el analisis de tendencia queda limitado. El dashboard incluye KPIs, rankings y alertas de calidad para orientar una primera revision funcional.
```

## Mejora con LLM y OpenAI Agents SDK

Implementa `src/lib/data-analysis/llm-agent.ts`.

Funcion:

```ts
export async function enhanceAnalysisWithAgent(result: AnalysisResult): Promise<Partial<AnalysisResult> | null>
```

Reglas:

- Si no existe `process.env.OPENAI_API_KEY`, devuelve `null`.
- Usa import dinamico para no bloquear el modo determinista:

```ts
const { Agent, run } = await import("@openai/agents");
```

- Crea un agente llamado `Agente de insights sanitarios`.
- Usa modelo `process.env.OPENAI_MODEL || "gpt-5.4-mini"`.
- Instrucciones del agente:
  - eres un analista sanitario;
  - redactas en espanol;
  - no inventas datos;
  - solo usas el JSON agregado;
  - devuelves JSON valido con `executiveSummary`, `findings`, `recommendations`;
  - si faltan datos, lo dices como limitacion.
- Envia al agente solo un payload compacto:
  - `datasetProfile`;
  - `kpis`;
  - `charts` sin datos masivos, maximo top 10 puntos por grafico;
  - `findings` deterministas;
  - `recommendations` deterministas;
  - nombres de hojas y columnas;
  - nunca filas brutas completas.
- Parsea la salida con `JSON.parse` y validacion defensiva.
- Si el agente falla, loguea el error y conserva el resultado determinista.
- Marca `llmEnhanced: true` solo si se aplica correctamente.

## Front web

### Home `/`

Debe ser la pantalla de trabajo, no una landing comercial.

Contiene:

- titulo: `Excel Analyst A2A Agent V2`;
- subtitulo breve: `Analisis sanitario de ficheros tabulares con dashboard y salida A2A`;
- input de URL publica;
- boton `Usar Excel demo`;
- boton principal `Analizar`;
- upload opcional para ficheros pequenos `.xlsx`, `.xls`, `.csv`, `.txt`, `.md`;
- estado de carga;
- errores claros;
- texto pequeno indicando que para demo se recomienda URL publica.

Al analizar:

- si hay URL, llama `POST /api/analyze` con JSON `{ "url": "..." }`;
- si hay fichero, llama `POST /api/analyze` con `FormData`;
- guarda resultado en `sessionStorage` con clave `analysis:<analysisId>`;
- navega a `dashboardUrl`.

### Dashboard `/analysis/[analysisId]`

Crea un componente cliente `AnalysisDashboard.tsx`.

Carga:

- primero desde `sessionStorage`;
- si no existe, llama `GET /api/analysis/[analysisId]?sourceUrl=...`;
- muestra loading y errores.

Layout recomendado:

- cabecera compacta con nombre de fichero, fecha y tipo;
- grid de KPIs principales;
- seccion `Resumen ejecutivo`;
- seccion `Graficos`;
- seccion `Hallazgos de negocio`;
- seccion `Calidad del dato`;
- seccion `Hojas o tablas detectadas`;
- seccion `Perfil de columnas`;
- seccion `Recomendaciones`;
- bloque JSON copiable.

Usa Recharts:

- `BarChart`;
- `LineChart`;
- `PieChart` si aplica;
- `ResponsiveContainer`.

Usa lucide-react para iconos. Mantener UI profesional, clara, con buen espaciado y responsive. No uses una pagina de marketing. No uses textos enormes dentro de botones. El dashboard debe ser util en desktop y aceptable en movil.

## APIs internas

### `POST /api/analyze`

Acepta:

- JSON `{ "url": "https://..." }`;
- `multipart/form-data` con campo `file`.

Devuelve:

```json
{
  "analysisId": "...",
  "dashboardUrl": "...",
  "result": {}
}
```

Reglas:

- usa runtime Node: `export const runtime = "nodejs"`;
- si aplica, `export const maxDuration = 60`;
- guarda resultado en memoria con `analysis-store`;
- construye `dashboardUrl` absoluto o relativo robusto;
- si el origen es URL, incluye `sourceUrl` codificado en query para fallback Vercel.

### `GET /api/analysis/[analysisId]`

Reglas:

- busca en memoria;
- si no existe y hay `sourceUrl`, vuelve a analizar la URL;
- si lo recalcula, vuelve a guardarlo en memoria;
- si no puede recuperarlo, devuelve 404 con error espanol;
- no necesita base de datos.

### Store en memoria

Implementa con `globalThis` para sobrevivir hot reload local:

```ts
const globalForAnalysis = globalThis as unknown as {
  __analysisStore?: Map<string, AnalysisResult>;
};
```

Haz lo mismo para tasks A2A.

## URLs absolutas

Implementa `src/lib/urls.ts`:

```ts
export function getBaseUrl(request?: Request): string
```

Prioridad:

1. `process.env.NEXT_PUBLIC_BASE_URL` si existe.
2. Headers `x-forwarded-proto` y `host`.
3. `http://localhost:3000`.

Usa esto para:

- Agent Card;
- `dashboardUrl`;
- `reportUrl`;
- respuestas A2A.

## A2A compatible con AWP

Implementa A2A manualmente. No hace falta instalar SDK A2A en la app.

Debe ser compatible con cliente AWP que usa `a2a-sdk==0.3.14`.

AWP hara:

- `A2ACardResolver(httpx_client, baseUrl)` para leer `/.well-known/agent-card.json`;
- `A2AClient(httpx_client, agent_card=card)`;
- envio JSON-RPC al campo `url` de la Agent Card;
- metodo real `message/send`;
- para recuperar tareas, metodo real `tasks/get`.

### Agent Card

`GET /.well-known/agent-card.json` debe devolver JSON valido:

```json
{
  "name": "Excel Analyst A2A Agent",
  "description": "Agente que analiza ficheros sanitarios tabulares, especialmente Excel multihoja, y devuelve KPIs, dashboard e informe ejecutivo en espanol.",
  "version": "1.0.0",
  "url": "https://dominio/a2a/v1",
  "preferredTransport": "JSONRPC",
  "protocolVersion": "0.3.0",
  "capabilities": { "streaming": false },
  "defaultInputModes": ["text/plain", "application/json"],
  "defaultOutputModes": ["text/plain", "application/json"],
  "skills": [
    {
      "id": "analyze_health_data_file",
      "name": "Analizar fichero sanitario",
      "description": "Analiza una URL publica de Excel, CSV, TXT o Markdown tabular y devuelve KPIs sanitarios, hallazgos, recomendaciones y URL de dashboard.",
      "tags": ["excel", "healthcare", "dashboard", "kpi", "a2a"],
      "inputModes": ["text/plain", "application/json"],
      "outputModes": ["text/plain", "application/json"]
    }
  ],
  "additionalInterfaces": [
    { "transport": "JSONRPC", "url": "https://dominio/a2a/v1" },
    { "transport": "HTTP+JSON", "url": "https://dominio/a2a/v1/message:send" }
  ]
}
```

Sustituye `https://dominio` por `getBaseUrl(request)`.

### Endpoints A2A

Implementa:

- `POST /a2a/v1`: JSON-RPC.
- `POST /a2a/v1/message:send`: HTTP+JSON via rewrite a `message-send`.
- `GET /a2a/v1/tasks/[taskId]`: lookup HTTP de task en memoria.

### JSON-RPC

`POST /a2a/v1` acepta:

- method `message/send`;
- method `tasks/get`;
- method `SendMessage` como compatibilidad extra.

Para `message/send`:

```json
{ "jsonrpc": "2.0", "id": "request.id", "result": { "kind": "task" } }
```

Para `tasks/get`:

```json
{ "jsonrpc": "2.0", "id": "request.id", "result": { "kind": "task" } }
```

Si el metodo no esta soportado:

```json
{
  "jsonrpc": "2.0",
  "id": "request.id",
  "error": { "code": -32601, "message": "Metodo no soportado" }
}
```

No devuelvas HTTP 400 para errores funcionales recuperables. Devuelve Task `input-required` o `failed` en JSON-RPC correcto.

### Extraccion de URL o fichero

Implementa `request-extractor.ts`.

Debe aceptar estos formatos:

```json
{ "kind": "text", "text": "Analiza este Excel: https://..." }
{ "kind": "data", "data": { "excelUrl": "https://..." } }
{ "kind": "data", "data": { "fileUrl": "https://..." } }
{ "kind": "file", "file": { "uri": "https://..." } }
{ "kind": "file", "file": { "bytes": "...", "name": "demo.xlsx", "mimeType": "..." } }
{ "kind": "file", "file": { "bytes": "...", "name": "demo.xlsx", "mime_type": "..." } }
{ "root": { "kind": "text", "text": "..." } }
{ "text": "https://..." }
{ "url": "https://..." }
{ "raw": "<base64>" }
{ "data": { "excelUrl": "https://..." } }
{ "data": { "fileUrl": "https://..." } }
```

Reglas:

- busca recursivamente cualquier URL `http://` o `https://` en todo el payload;
- prioriza URL publica sobre base64;
- si hay `FilePart.file.uri`, tratala como URL;
- si hay `FilePart.file.bytes`, tratala como base64;
- soporta base64 solo para ficheros pequenos;
- si no hay URL ni fichero, devuelve Task `input-required` pidiendo una URL publica de Excel/CSV/TXT/MD en espanol.

### Task A2A

Construye Task con esta forma minima:

```json
{
  "kind": "task",
  "id": "...",
  "contextId": "...",
  "status": {
    "state": "completed",
    "timestamp": "...",
    "message": {
      "kind": "message",
      "role": "agent",
      "messageId": "...",
      "contextId": "...",
      "taskId": "...",
      "parts": [{ "kind": "text", "text": "..." }]
    }
  },
  "history": [
    {
      "kind": "message",
      "role": "user",
      "messageId": "...",
      "contextId": "...",
      "taskId": "...",
      "parts": []
    },
    {
      "kind": "message",
      "role": "agent",
      "messageId": "...",
      "contextId": "...",
      "taskId": "...",
      "parts": [{ "kind": "text", "text": "Resumen, KPIs y dashboard en espanol" }],
      "metadata": {
        "sender": "excel_analyst_a2a_agent",
        "output_in_chat": true
      }
    }
  ],
  "artifacts": [
    {
      "artifactId": "analysis_result",
      "name": "analysis_result",
      "parts": [{ "kind": "data", "data": {} }]
    },
    {
      "artifactId": "executive_summary",
      "name": "executive_summary",
      "parts": [{ "kind": "text", "text": "..." }]
    },
    {
      "artifactId": "dashboard",
      "name": "dashboard",
      "parts": [
        { "kind": "data", "data": { "dashboardUrl": "...", "reportUrl": "..." } },
        { "kind": "text", "text": "Dashboard: https://..." }
      ]
    },
    {
      "artifactId": "kpis",
      "name": "kpis",
      "parts": [{ "kind": "data", "data": { "kpis": [] } }]
    }
  ],
  "metadata": {
    "analysisId": "...",
    "summary": "...",
    "kpis": [],
    "findings": [],
    "recommendations": [],
    "dashboardUrl": "...",
    "reportUrl": "..."
  }
}
```

Estados:

- `completed`: analisis correcto.
- `input-required`: falta URL o fichero.
- `failed`: error de descarga, parseo o analisis.

El texto A2A debe ser util para AWP y usuario final:

```text
Analisis completado.

Resumen ejecutivo:
...

KPIs principales:
- ...
- ...

Hallazgos:
- ...

Recomendaciones:
- ...

Dashboard: https://...
```

AWP extrae texto principalmente de `Task.history` y `Artifact.parts`, asi que duplica el texto importante en ambos sitios.

## Fallback Vercel sin base de datos

No dependas de memoria para que el dashboard funcione despues de una respuesta A2A.

Para analisis desde URL publica:

- construye `dashboardUrl` como `/analysis/[analysisId]?sourceUrl=<url-publica-codificada>`;
- si `/api/analysis/[analysisId]` no encuentra memoria y existe `sourceUrl`, vuelve a analizar;
- para upload/base64, informa de que el dashboard puede depender de memoria de runtime;
- usa `sessionStorage` para flujos iniciados desde front.

## README

Incluye:

- descripcion corta;
- stack;
- como ejecutar localmente;
- como configurar `.env.local`;
- como desplegar conectando GitHub a Vercel;
- que variable poner en Vercel para LLM: `OPENAI_API_KEY`;
- variable opcional `OPENAI_MODEL`;
- que URL configurar en AWP: la URL base, no `/a2a/v1`;
- ejemplo de Agent Card;
- ejemplo curl JSON-RPC `message/send`;
- ejemplo curl JSON-RPC `tasks/get`;
- ejemplo curl HTTP+JSON `/a2a/v1/message:send`;
- URL publica de demo;
- limitaciones: preferir URL publica, evitar base64 para ficheros grandes, CSV/TXT/MD son soporte secundario.

## GitHub

Inicializa git:

```bash
git init
git add .
git commit -m "Initial Excel Analyst A2A Agent demo"
```

Si `gh` CLI existe y `gh auth status` funciona, crea repo GitHub privado y haz push:

```bash
gh repo create excel-analyst-a2a-agent --private --source=. --remote=origin --push
```

Si `gh` no esta autenticado, no bloquees la tarea. Deja el commit local y documenta en README:

```bash
gh auth login
gh repo create excel-analyst-a2a-agent --private --source=. --remote=origin --push
```

No inventes tokens ni credenciales.

## Validacion final

Ejecuta:

```bash
npm run build
npm run lint
```

Si `npm run lint` no existe o falla por configuracion no esencial, explica la razon y deja build pasando.

Crea `scripts/smoke-test-a2a.mjs` que pueda ejecutarse con servidor local levantado:

```bash
node scripts/smoke-test-a2a.mjs http://localhost:3000
```

El script debe:

- leer `/.well-known/agent-card.json`;
- comprobar que `url` termina en `/a2a/v1`;
- enviar JSON-RPC `message/send` con un texto que incluya la URL demo;
- imprimir estado de la task, resumen y dashboardUrl.

Si la URL demo tarda demasiado, el script puede aceptar `--input-required-only` o usar una llamada sin URL para verificar que devuelve `input-required`.

Al terminar:

- si build pasa, dilo claramente;
- si hay algo no implementado, dilo claramente;
- reporta rutas locales importantes:
  - `/`;
  - `/.well-known/agent-card.json`;
  - `/a2a/v1`.

## Criterios de aceptacion

La demo se considera correcta si:

- `npm run build` pasa;
- la home permite analizar la URL demo;
- el dashboard muestra KPIs, graficos, resumen, hallazgos y recomendaciones;
- `/.well-known/agent-card.json` devuelve Agent Card valida y con URL absoluta;
- `POST /a2a/v1` con `message/send` devuelve Task `completed` con texto en `history` y artifacts;
- si falta URL, A2A devuelve Task `input-required` y no HTTP 400;
- en Vercel, un `dashboardUrl` generado desde A2A con `sourceUrl` puede reanalizar la URL si no hay memoria;
- si no hay `OPENAI_API_KEY`, todo funciona determinista;
- si hay `OPENAI_API_KEY`, el agente LLM mejora resumen/hallazgos sin enviar filas brutas.

## Recordatorio de foco

No construyas un sistema perfecto. Construye una demo solida, comprensible y compatible con A2A.

Si dudas entre hacer una feature extra o estabilizar A2A/build, estabiliza A2A/build.
