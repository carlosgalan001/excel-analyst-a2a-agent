# Excel Analyst A2A Agent

Next.js demo that analyzes Excel workbooks from a public URL or a small upload, renders a dashboard, and exposes public A2A endpoints for AWP agents.

## Run Locally

Requires Node.js 18.18 or newer.

```bash
npm install
npm run dev
```

Open:

- Web app: `http://localhost:3000`
- A2A playground: `http://localhost:3000/a2a-playground`
- Agent Card: `http://localhost:3000/.well-known/agent-card.json`

Build checks:

```bash
npm run lint
npm run build
```

## Deploy To Vercel

```bash
npm install
npm run build
vercel deploy --prod
```

No Docker or database is required. Runtime memory stores recent analyses and A2A tasks while the server instance lives. The frontend also caches the latest analysis JSON in `sessionStorage` after interactive runs.

Optional LLM enhancement:

```bash
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini
```

The LLM receives only aggregate analysis JSON, never raw workbook rows.

## AWP Configuration

Configure the external AWP agent with the production deployment base URL:

```text
https://your-vercel-domain.vercel.app
```

AWP uses `a2a-sdk==0.3.14`. It discovers the public Agent Card from the base URL and then sends JSON-RPC requests to the `url` declared in that card.

Agent Card:

```text
https://your-vercel-domain.vercel.app/.well-known/agent-card.json
```

Primary SDK endpoint declared by the card:

```text
https://your-vercel-domain.vercel.app/a2a/v1
```

HTTP+JSON demo endpoint:

```text
https://your-vercel-domain.vercel.app/a2a/v1/message:send
```

## Demo Excel URL

```text
https://www.sspa.juntadeandalucia.es/servicioandaluzdesalud/sites/default/files/sincfiles/wsas-media-mediafile_sasdocumento/2025/Conjunto%20M%C3%ADnimo%20B%C3%A1sico%20de%20Datos.%20Grupos%20Relacionados%20por%20el%20Diagn%C3%B3stico%202024%20Indicadores..xlsx
```

## Agent Card Shape

```json
{
  "name": "Excel Analyst A2A Agent",
  "description": "Agent that analyzes multi-sheet Excel workbooks and returns KPIs, dashboard URLs and an executive report.",
  "version": "1.0.0",
  "url": "https://your-vercel-domain.vercel.app/a2a/v1",
  "preferredTransport": "JSONRPC",
  "protocolVersion": "0.3.0",
  "defaultInputModes": ["application/json", "text/plain"],
  "defaultOutputModes": ["application/json", "text/plain", "text/html"],
  "additionalInterfaces": [
    {
      "transport": "JSONRPC",
      "url": "https://your-vercel-domain.vercel.app/a2a/v1"
    },
    {
      "transport": "HTTP+JSON",
      "url": "https://your-vercel-domain.vercel.app/a2a/v1/message:send"
    }
  ],
  "capabilities": {
    "streaming": false
  }
}
```

## HTTP+JSON Example

```bash
curl -X POST "https://your-vercel-domain.vercel.app/a2a/v1/message:send" \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "role": "user",
      "parts": [
        {
          "data": {
            "excelUrl": "https://www.sspa.juntadeandalucia.es/servicioandaluzdesalud/sites/default/files/sincfiles/wsas-media-mediafile_sasdocumento/2025/Conjunto%20M%C3%ADnimo%20B%C3%A1sico%20de%20Datos.%20Grupos%20Relacionados%20por%20el%20Diagn%C3%B3stico%202024%20Indicadores..xlsx"
          },
          "mediaType": "application/json"
        }
      ]
    }
  }'
```

The completed task includes `analysis_result`, `executive_summary`, `dashboard`, and `kpis` artifacts. The task `metadata` always includes:

```json
{
  "analysisId": "...",
  "summary": "...",
  "kpis": [],
  "findings": [],
  "recommendations": [],
  "dashboardUrl": "https://your-vercel-domain.vercel.app/analysis/...",
  "reportUrl": "https://your-vercel-domain.vercel.app/analysis/..."
}
```

## JSON-RPC Example

```bash
curl -X POST "https://your-vercel-domain.vercel.app/a2a/v1" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "demo-1",
    "method": "message/send",
    "params": {
      "message": {
        "role": "user",
        "messageId": "demo-message-1",
        "parts": [
          {
            "kind": "text",
            "text": "Analyze this Excel URL: https://www.sspa.juntadeandalucia.es/servicioandaluzdesalud/sites/default/files/sincfiles/wsas-media-mediafile_sasdocumento/2025/Conjunto%20M%C3%ADnimo%20B%C3%A1sico%20de%20Datos.%20Grupos%20Relacionados%20por%20el%20Diagn%C3%B3stico%202024%20Indicadores..xlsx"
          }
        ]
      }
    }
  }'
```

Task lookup through JSON-RPC:

```bash
curl -X POST "https://your-vercel-domain.vercel.app/a2a/v1" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "task-lookup-1",
    "method": "tasks/get",
    "params": {
      "id": "TASK_ID"
    }
  }'
```

## Task Lookup

```bash
curl "https://your-vercel-domain.vercel.app/a2a/v1/tasks/{taskId}"
```

Task lookup is memory-backed. If Vercel moves the request to another warm instance, the task may no longer be available.

## Limits

- Prefer public or temporary Excel URLs for dense workbooks.
- Frontend upload is capped at 8 MB.
- A2A base64 `raw` input is capped at 4 MB.
- URL downloads are capped at 70 MB.
- Analysis avoids O(n^2) duplicate checks by using row signatures.
- Very wide sheets are profiled up to 120 columns by default.
- No authentication is included; endpoints are public for demo use.
