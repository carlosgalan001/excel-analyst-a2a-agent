# Codex One-Shot Prompt

Construye desde cero una demo completa llamada "Excel Analyst A2A Agent".

## Contexto de negocio

Queremos demostrar tres capacidades:

1. Codex crea una solucion completa desde cero.
2. La solucion es un agente analizador de Excels con un front sencillo para subir o indicar un Excel y ver KPIs, dashboard e insights.
3. Un agente externo de AWP puede conectarse a este agente mediante protocolo A2A, mandarle la URL de un Excel y recibir resultados estructurados.

## Objetivo tecnico

Crear una aplicacion Next.js desplegable en Vercel que exponga:

- un front web;
- un motor de analisis de Excel;
- endpoints A2A publicos;
- una Agent Card en `/.well-known/agent-card.json`.

## Stack

- Next.js App Router.
- TypeScript.
- SheetJS/xlsx para leer Excel.
- Recharts para graficas.
- UI simple, profesional y funcional.
- Preparado para deploy en Vercel.
- Sin Docker.
- Sin base de datos obligatoria.
- Persistencia simple en memoria durante runtime y fallback serializable en URL/estado cuando sea posible.
- No anadir autenticacion. Endpoint publico para demo.
- No depender de localhost para la integracion AWP.

## Caso de Excel

El Excel puede ser denso, con unas 6 hojas, algunas de hasta 30.000 filas.
Debe soportar analisis desde URL publica.
Debe soportar tambien upload desde el front para ficheros pequenos, pero el flujo recomendado de demo sera por URL para evitar limites de payload.
Anadir en la home un campo para pegar URL publica de Excel.

Usar esta URL como ejemplo demo:

```text
https://www.sspa.juntadeandalucia.es/servicioandaluzdesalud/sites/default/files/sincfiles/wsas-media-mediafile_sasdocumento/2025/Conjunto%20M%C3%ADnimo%20B%C3%A1sico%20de%20Datos.%20Grupos%20Relacionados%20por%20el%20Diagn%C3%B3stico%202024%20Indicadores..xlsx
```

## Funcionalidades del front

- Pagina `/`:
  - titulo "Excel Analyst A2A Agent";
  - input para URL publica de Excel;
  - upload opcional de `.xlsx`/`.xls` para ficheros pequenos;
  - boton "Analyze";
  - estado de carga y errores claros.
- Pagina `/analysis/[analysisId]`:
  - dashboard con KPIs;
  - listado de hojas detectadas;
  - filas/columnas por hoja;
  - perfil de columnas;
  - calidad de datos: nulos, columnas vacias, duplicados aproximados;
  - KPIs automaticos de columnas numericas: suma, media, minimo, maximo;
  - deteccion simple de columnas de fecha, importe, categoria, region, estado si existen;
  - graficos automaticos:
    - barras por categoria si hay columna categorica y numerica;
    - linea temporal si hay fecha y numerica;
    - ranking top N si aplica;
  - resumen ejecutivo;
  - recomendaciones;
  - JSON de resultado copiable.
- Pagina `/a2a-playground`:
  - formulario para enviar una request A2A real contra el propio endpoint;
  - modo URL de Excel;
  - mostrar request y response;
  - incluir ejemplo con la URL publica anterior.

## Motor de analisis

Crear modulo `lib/excel-analysis`.

Debe exponer funciones limpias:

- `analyzeWorkbookFromUrl(url: string, options?: AnalysisOptions)`
- `analyzeWorkbookFromBuffer(buffer: Buffer, fileName: string, options?: AnalysisOptions)`

Debe devolver un JSON estable:

```json
{
  "analysisId": "...",
  "fileName": "...",
  "sourceType": "...",
  "sourceUrl": "...",
  "createdAt": "...",
  "workbookProfile": {},
  "sheets": [],
  "kpis": [],
  "charts": [],
  "findings": [],
  "executiveSummary": "...",
  "recommendations": [],
  "dashboardUrl": "..."
}
```

## Requisitos del analisis

- Funcionar con cualquier Excel razonable aunque no conozca el esquema.
- Leer varias hojas.
- Limitar el coste para hojas grandes:
  - perfil completo razonable;
  - muestreo para inferencias si hace falta;
  - no bloquear la UI;
  - evitar calculos O(n^2).
- Manejar hojas vacias.
- Manejar celdas mezcladas.
- Manejar errores de descarga.
- Manejar errores de Excel invalido.
- Crear resultados utiles aunque el Excel no tenga columnas obvias.
- El resumen ejecutivo debe ser determinista por defecto, sin necesidad de LLM.
- Preparar una funcion opcional `enhanceSummaryWithLLM` pero dejarla desactivada si no hay `OPENAI_API_KEY`.
- Si `OPENAI_API_KEY` existe, usarla solo para redactar conclusiones mas vistosas a partir del JSON agregado, nunca enviando todo el Excel bruto.

## A2A compatible con AWP

Implementar un servidor A2A minimo y practico, compatible con el cliente AWP que usa `a2a-sdk==0.3.14`.

Importante:

- AWP debe configurarse con la URL base del agente, por ejemplo `https://dominio.vercel.app`.
- AWP usa `A2ACardResolver(httpx_client, baseUrl)` para leer `/.well-known/agent-card.json`.
- AWP usa `A2AClient(httpx_client, agent_card=card)`.
- El SDK envia JSON-RPC al campo `url` de la Agent Card.
- El metodo JSON-RPC real del SDK es `message/send`, no `SendMessage`.
- Para recuperar tareas el metodo JSON-RPC real del SDK es `tasks/get`.
- El cliente AWP extrae texto principalmente de `Task.history` y de `Artifact.parts`, asi que incluir siempre `TextPart` legible.

### Agent Card

`GET /.well-known/agent-card.json` debe devolver una Agent Card publica que valide contra `a2a.types.AgentCard` del SDK Python `a2a-sdk==0.3.14`.

Debe incluir:

- `name`: "Excel Analyst A2A Agent"
- `description`: agente que analiza Excels multihoja y devuelve KPIs, dashboard e informe ejecutivo.
- `version`
- `url`: URL absoluta del endpoint JSON-RPC, es decir `${baseUrl}/a2a/v1`
- `preferredTransport`: `"JSONRPC"`
- `protocolVersion`: `"0.3.0"`
- `capabilities`: `{ "streaming": false }`
- `defaultInputModes`
- `defaultOutputModes`
- `skills`, cada skill con:
  - `id`: `analyze_excel_workbook`
  - `name`: `Analyze Excel Workbook`
  - `description`
  - `tags`
  - `inputModes`
  - `outputModes`
- `additionalInterfaces` con:
  - `{ "transport": "JSONRPC", "url": "${baseUrl}/a2a/v1" }`
  - `{ "transport": "HTTP+JSON", "url": "${baseUrl}/a2a/v1/message:send" }`

No usar solo `inputModes`/`outputModes`; deben existir tambien `defaultInputModes`/`defaultOutputModes`.

### Endpoints A2A

1. `POST /a2a/v1`

Debe aceptar JSON-RPC real del SDK AWP:

- method `message/send`
- method `tasks/get`

Puede aceptar `SendMessage` como compatibilidad extra, pero AWP usara `message/send`.

2. `POST /a2a/v1/message:send`

Mantener endpoint HTTP+JSON practico para demos y curl.

3. `GET /a2a/v1/tasks/[taskId]`

Mantener lookup HTTP de task si esta en memoria.

### Formato de request A2A

Debe aceptar mensajes con `params.message.parts` en formato SDK:

- `{ "kind": "text", "text": "..." }`
- `{ "kind": "data", "data": { "excelUrl": "..." } }`
- `{ "kind": "file", "file": { "uri": "https://..." } }`
- `{ "kind": "file", "file": { "bytes": "...", "name": "...", "mimeType": "..." } }`
- `{ "kind": "file", "file": { "bytes": "...", "name": "...", "mime_type": "..." } }`

Tambien aceptar formatos simples:

- `{ "text": "..." }`
- `{ "url": "https://..." }`
- `{ "raw": "<base64>" }`
- `{ "data": { "excelUrl": "..." } }`

Reglas:

- Priorizar URL publica.
- Si recibe `FilePart.file.uri`, tratarlo como URL publica del Excel.
- Si recibe `FilePart.file.bytes`, tratarlo como base64 equivalente a `raw`.
- Si recibe `raw` o `file.bytes`, soportarlo solo para ficheros pequenos y devolver error claro si es demasiado grande.
- Si recibe texto con una URL `http://` o `https://`, extraer esa URL.

### Formato de respuesta A2A

Debe devolver un `Task` valido del SDK:

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
      "parts": [
        { "kind": "text", "text": "..." }
      ]
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
      "parts": [
        { "kind": "text", "text": "Resumen, KPIs principales y dashboard URL" }
      ],
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
      "parts": [
        { "kind": "data", "data": {} }
      ]
    },
    {
      "artifactId": "executive_summary",
      "name": "executive_summary",
      "parts": [
        { "kind": "text", "text": "..." }
      ]
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
      "parts": [
        { "kind": "data", "data": { "kpis": [] } }
      ]
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

### JSON-RPC

Para `message/send`, devolver:

```json
{ "jsonrpc": "2.0", "id": "request.id", "result": {} }
```

Para `tasks/get`, devolver la task desde memoria:

```json
{ "jsonrpc": "2.0", "id": "request.id", "result": {} }
```

Si el metodo no esta soportado, devolver error JSON-RPC correcto.

### URL absoluta

Construir `dashboardUrl`, Agent Card URLs y endpoints con la URL publica del deployment si esta disponible.
Usar headers `host` y `x-forwarded-proto` para generar URLs absolutas en Vercel.

## README

Incluir:

- como ejecutar localmente;
- como desplegar en Vercel;
- que URL configurar en AWP: la URL base, no `/a2a/v1` ni `/message:send`;
- ejemplo de Agent Card;
- ejemplo curl HTTP+JSON;
- ejemplo curl JSON-RPC `message/send`;
- ejemplo curl JSON-RPC `tasks/get`;
- ejemplo de request con URL publica de Excel;
- limitaciones: evitar base64 para Excels grandes, preferir URL publica o URL temporal.

## Calidad y validacion

- Codigo tipado.
- Validaciones.
- Manejo de errores.
- Componentes UI limpios.
- Build debe pasar.
- Ejecutar `npm run build`.
- Si hay lint, ejecutar lint.
- Validar Agent Card contra `a2a.types.AgentCard` si Python/a2a-sdk esta disponible.
- Probar con un script equivalente a AWP:
  - `A2ACardResolver(httpx_client, baseUrl).get_agent_card()`
  - `A2AClient(httpx_client, agent_card=card).send_message(...)`
- Al final iniciar servidor local si Node esta disponible y reportar URLs de prueba.
