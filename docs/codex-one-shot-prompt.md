# Codex One-Shot Prompt

Construye desde cero una demo completa llamada "Excel Analyst A2A Agent V2".

## Contexto de negocio

Queremos demostrar tres capacidades:

1. Codex crea una solucion completa desde cero.
2. La solucion es un agente analizador de ficheros tabulares o semiestructurados con un front sencillo para subir o indicar una URL de Excel, CSV, TXT o Markdown y ver KPIs, dashboard e insights.
3. Un agente externo de AWP puede conectarse a este agente mediante protocolo A2A, mandarle la URL de un fichero Excel/CSV/TXT/MD y recibir resultados estructurados.

## Objetivo tecnico

Crear una aplicacion Next.js desplegable en Vercel que exponga:

- un front web;
- un motor de analisis de ficheros Excel, CSV, TXT y Markdown;
- endpoints A2A publicos;
- una Agent Card en `/.well-known/agent-card.json`.

## Stack

- Next.js App Router.
- TypeScript.
- SheetJS/xlsx para leer Excel.
- Parser ligero propio o libreria pequena para CSV/TXT/Markdown tabular si aporta valor, evitando dependencias pesadas.
- Recharts para graficas.
- UI simple, profesional y funcional.
- Toda la experiencia de usuario debe estar en espanol: textos del front, errores, resumen ejecutivo, hallazgos, recomendaciones y respuesta textual A2A.
- Preparado para deploy en Vercel.
- Sin Docker.
- Sin base de datos obligatoria.
- Persistencia simple en memoria durante runtime y fallback serializable en URL/estado cuando sea posible.
- No anadir autenticacion. Endpoint publico para demo.
- No depender de localhost para la integracion AWP.

## Caso de ficheros de datos

El caso principal de demo sera un Excel denso, con unas 6 hojas, algunas de hasta 30.000 filas.
Debe soportar analisis desde URL publica.
Debe soportar tambien CSV, TXT y Markdown cuando contengan datos tabulares o semiestructurados.
Debe soportar tambien upload desde el front para ficheros pequenos, pero el flujo recomendado de demo sera por URL para evitar limites de payload.
Anadir en la home un campo para pegar URL publica de Excel, CSV, TXT o MD.

Formatos esperados:

- Excel: `.xlsx`, `.xls`, varias hojas.
- CSV: `.csv`, con deteccion automatica de delimitador entre coma, punto y coma, tabulador y pipe.
- TXT: `.txt`, intentar detectar si contiene tabla delimitada por coma, punto y coma, tabulador, pipe o espacios consistentes.
- Markdown: `.md`, extraer la primera o principales tablas Markdown con formato `| columna | valor |`.

Si un TXT o Markdown no contiene datos tabulares suficientes, devolver un error claro o un resultado limitado explicando que no se han detectado tablas analizables.

Usar esta URL como ejemplo demo:

```text
https://www.sspa.juntadeandalucia.es/servicioandaluzdesalud/sites/default/files/sincfiles/wsas-media-mediafile_sasdocumento/2025/Conjunto%20M%C3%ADnimo%20B%C3%A1sico%20de%20Datos.%20Grupos%20Relacionados%20por%20el%20Diagn%C3%B3stico%202024%20Indicadores..xlsx
```

## Funcionalidades del front

- Pagina `/`:
  - titulo "Excel Analyst A2A Agent V2";
  - input para URL publica de Excel, CSV, TXT o Markdown;
  - upload opcional de `.xlsx`/`.xls`/`.csv`/`.txt`/`.md` para ficheros pequenos;
  - boton "Analyze";
  - estado de carga y errores claros.
- Pagina `/analysis/[analysisId]`:
  - dashboard ejecutivo orientado a datos sanitarios publicos, no solo a estructura del Excel;
  - primera vista con KPIs funcionales priorizados cuando existan campos compatibles:
    - actividad asistencial: altas, bajas, episodios, ingresos, casos, pacientes o registros equivalentes;
    - actividad hospitalaria por centro, hospital, area, provincia, servicio, especialidad, GRD/diagnostico o categoria clinica;
    - indicadores de estancia y tiempos: estancia media, dias de estancia, demora, duracion, tiempos medios, minimo, maximo y outliers;
    - indicadores economicos si existen: coste, importe, tarifa, peso, facturacion, coste medio por alta/caso;
    - indicadores de complejidad o casuistica si existen: peso medio, severidad, mortalidad, readmision, urgencia/programado, tipo de alta;
    - variaciones y concentracion: top hospitales/categorias, peso relativo sobre el total, dispersion y diferencias entre grupos;
  - tarjeta de "lectura funcional" con 3-6 conclusiones en lenguaje de negocio sanitario:
    - que volumen se esta analizando;
    - donde se concentra la actividad;
    - que hospitales/categorias/servicios destacan;
    - que indicadores muestran valores extremos o desviaciones;
    - que datos faltan para tomar mejores decisiones;
  - seccion de "Hallazgos de negocio" separada de "Calidad del dato";
  - "Hallazgos de negocio" debe evitar frases genericas como "hay X columnas numericas"; debe hablar de actividad, tiempos, importes, centros, categorias y tendencias cuando los datos lo permitan;
  - "Calidad del dato" debe quedar como soporte: nulos, columnas vacias, duplicados aproximados, campos incompletos, hojas poco explotables;
  - listado de hojas detectadas con una interpretacion de utilidad funcional:
    - hoja principal de actividad;
    - hojas de catalogo/dimensiones;
    - hojas de validacion, estandar o metadatos si se detectan;
  - filas/columnas por hoja;
  - perfil de columnas, pero agrupado por tipo funcional detectado: fecha/periodo, hospital/centro, territorio, diagnostico/GRD, actividad, tiempo, importe/coste, categoria/estado;
  - KPIs automaticos de columnas numericas con contexto:
    - total, media, minimo, maximo, mediana aproximada si es viable;
    - porcentaje sobre total cuando haya agrupaciones;
    - top/bottom por categoria cuando haya dimensiones;
    - evitar mostrar sumas sin sentido para codigos, identificadores o anios;
  - deteccion simple de columnas sanitarias frecuentes:
    - altas, bajas, ingresos, episodios, casos, pacientes, consultas, urgencias;
    - hospital, centro, area, provincia, region, servicio, especialidad;
    - GRD, diagnostico, CIE, procedimiento, categoria, tipo hospital, tipo alta, estado;
    - fecha, anio, mes, periodo;
    - estancia, dias, demora, tiempo;
    - coste, importe, tarifa, peso, facturacion;
  - graficos automaticos orientados a decision:
    - barras de actividad por hospital/centro/territorio/categoria;
    - ranking top N de hospitales, servicios, diagnosticos, GRD o categorias por volumen;
    - linea temporal si hay periodo/fecha y una metrica de actividad, tiempo o coste;
    - dispersion o comparativa si hay estancia/coste frente a volumen;
    - composicion porcentual por tipo de alta, estado, categoria clinica o tipo de hospital si aplica;
  - resumen ejecutivo con narrativa funcional, maximo 6 frases, priorizando lo relevante para un responsable sanitario;
  - recomendaciones accionables basadas en los datos:
    - revisar centros/categorias con valores extremos;
    - investigar desviaciones de estancia, coste o actividad;
    - completar campos criticos para seguimiento;
    - crear seguimiento temporal si no hay fecha/periodo;
    - validar definiciones funcionales cuando una columna parezca ambigua;
  - JSON de resultado copiable.
- Pagina `/a2a-playground`:
  - formulario para enviar una request A2A real contra el propio endpoint;
  - modo URL de fichero;
  - mostrar request y response;
  - incluir ejemplo con la URL publica anterior.

## Motor de analisis

Crear modulo `lib/data-analysis`.

Debe exponer funciones limpias:

- `analyzeDataSourceFromUrl(url: string, options?: AnalysisOptions)`
- `analyzeDataSourceFromBuffer(buffer: Buffer, fileName: string, options?: AnalysisOptions)`
- Opcionalmente mantener aliases internos `analyzeWorkbookFromUrl` y `analyzeWorkbookFromBuffer` si simplifica compatibilidad con el codigo, pero el motor debe ser multi-formato.

Debe devolver un JSON estable:

```json
{
  "analysisId": "...",
  "fileName": "...",
  "fileType": "excel|csv|txt|markdown|unknown",
  "sourceType": "...",
  "sourceUrl": "...",
  "createdAt": "...",
  "datasetProfile": {},
  "sheets": [],
  "kpis": [],
  "charts": [],
  "findings": [],
  "executiveSummary": "...",
  "recommendations": [],
  "dashboardUrl": "..."
}
```

Para compatibilidad interna puede existir `workbookProfile`, pero la respuesta principal debe usar `datasetProfile` porque no todos los origenes seran libros Excel.

## Requisitos del analisis

- Funcionar con cualquier Excel, CSV, TXT o Markdown tabular razonable aunque no conozca el esquema.
- Leer varias hojas en Excel.
- Para CSV/TXT/Markdown, tratar cada tabla detectada como una hoja logica para reutilizar el dashboard, los KPIs y los graficos.
- Detectar el formato por extension, `Content-Type`, nombre de fichero y, si hace falta, inspeccion del contenido.
- Para CSV:
  - detectar delimitador;
  - respetar comillas;
  - inferir cabeceras;
  - soportar UTF-8 y caracteres espanoles.
- Para TXT:
  - intentar parsear tablas delimitadas;
  - si hay varias tablas separadas por bloques, crear varias hojas logicas;
  - evitar inventar columnas cuando el texto sea narrativo y no tabular.
- Para Markdown:
  - extraer tablas Markdown;
  - usar el texto cercano como nombre descriptivo de la hoja logica si es sencillo;
  - ignorar contenido narrativo salvo para nombre/contexto.
- Priorizar insights funcionales sobre metadatos tecnicos: el usuario final debe entender que esta pasando en los datos sanitarios, no solo como esta construido el libro.
- Implementar una capa heuristica de dominio sanitario que clasifique columnas por significado probable usando nombres de columna y valores de muestra.
- Mantener un analisis generico como fallback si el fichero no parece sanitario, pero si detecta terminos como altas, hospital, GRD, diagnostico, estancia, CMBD, pacientes, ingresos, coste o importe, activar el modo sanitario.
- Separar claramente:
  - metricas de negocio sanitario;
  - graficos y agregados funcionales;
  - calidad del dato;
  - perfil tecnico del fichero/dataset.
- No tratar identificadores, codigos, anios, codigos CIE/GRD o codigos de centro como metricas sumables aunque sean numericos.
- Para cada metrica numerica candidata, decidir si es:
  - metrica agregable: altas, casos, pacientes, ingresos, coste, importe, dias;
  - indicador promedio: estancia media, coste medio, peso medio, demora media;
  - codigo o identificador: no sumar, solo usar como dimension si procede.
- Detectar dimensiones utiles para agrupar:
  - hospital/centro;
  - territorio/provincia/area/region;
  - servicio/especialidad;
  - diagnostico/GRD/procedimiento/categoria clinica;
  - periodo/anio/mes/fecha;
  - tipo de alta, estado, tipo de hospital.
- Generar KPIs sanitarios cuando sea posible:
  - total de altas/casos/episodios/pacientes;
  - numero de hospitales/centros/territorios detectados;
  - categoria u hospital con mayor volumen;
  - porcentaje que representa el top 1/top 5 sobre el total;
  - estancia media o demora media si hay campos de tiempo;
  - coste/importe total y coste medio por alta/caso si hay actividad y coste;
  - top diagnosticos/GRD/categorias por volumen;
  - variacion temporal de actividad, estancia o coste si hay periodo;
  - registros invalidos o no clasificados si el fichero contiene columnas de validacion.
- Generar hallazgos deterministas de negocio con esta prioridad:
  - concentracion de actividad;
  - diferencias relevantes entre hospitales, territorios, servicios o categorias;
  - tendencias temporales;
  - valores extremos de estancia, coste, demora o volumen;
  - problemas de calidad que afecten a la interpretacion funcional.
- Limitar el coste para hojas grandes:
  - perfil completo razonable;
  - muestreo para inferencias si hace falta;
  - no bloquear la UI;
  - evitar calculos O(n^2).
- Manejar hojas vacias.
- Manejar celdas mezcladas en Excel.
- Manejar errores de descarga.
- Manejar errores de fichero invalido, formato no soportado o tabla no detectable.
- Crear resultados utiles aunque el fichero no tenga columnas obvias.
- El resumen ejecutivo debe ser determinista por defecto, sin necesidad de LLM.
- Preparar una funcion opcional `enhanceSummaryWithLLM` pero dejarla desactivada si no hay `OPENAI_API_KEY`.
- Si `OPENAI_API_KEY` existe, usarla solo para redactar conclusiones mas vistosas a partir del JSON agregado, nunca enviando todo el fichero bruto.
- Las conclusiones deterministas y la respuesta A2A no deben quedarse en metricas genericas. Incluir siempre informacion accionable: KPIs sanitarios detectados, concentracion de actividad, rankings funcionales, posibles desviaciones, calidad de datos que afecte a la lectura y recomendaciones en espanol.
- Si no hay suficientes campos funcionales, explicarlo de forma clara y proponer que columnas faltan para obtener KPIs sanitarios mejores, por ejemplo fecha/periodo, centro/hospital, metrica de actividad, estancia, coste o categoria clinica.

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
- El prompt del agente AWP debe indicar que envie literalmente la URL publica del fichero dentro del texto que manda al agente remoto. No basta con referencias como "ese fichero", "la URL anterior" o "el adjunto".

### Agent Card

`GET /.well-known/agent-card.json` debe devolver una Agent Card publica que valide contra `a2a.types.AgentCard` del SDK Python `a2a-sdk==0.3.14`.

Debe incluir:

- `name`: "Excel Analyst A2A Agent"
- `description`: agente que analiza ficheros Excel, CSV, TXT y Markdown tabular y devuelve KPIs, dashboard e informe ejecutivo en espanol.
- `version`
- `url`: URL absoluta del endpoint JSON-RPC, es decir `${baseUrl}/a2a/v1`
- `preferredTransport`: `"JSONRPC"`
- `protocolVersion`: `"0.3.0"`
- `capabilities`: `{ "streaming": false }`
- `defaultInputModes`
- `defaultOutputModes`
- `skills`, cada skill con:
  - `id`: `analyze_data_file`
  - `name`: `Analizar fichero de datos`
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
- `{ "kind": "data", "data": { "fileUrl": "..." } }`
- `{ "kind": "file", "file": { "uri": "https://..." } }`
- `{ "kind": "file", "file": { "bytes": "...", "name": "...", "mimeType": "..." } }`
- `{ "kind": "file", "file": { "bytes": "...", "name": "...", "mime_type": "..." } }`
- `{ "root": { "kind": "text", "text": "..." } }`, por compatibilidad defensiva con serializaciones RootModel.

Tambien aceptar formatos simples:

- `{ "text": "..." }`
- `{ "url": "https://..." }`
- `{ "raw": "<base64>" }`
- `{ "data": { "excelUrl": "..." } }`
- `{ "data": { "fileUrl": "..." } }`

Reglas:

- Priorizar URL publica.
- Buscar de forma recursiva una URL `http://` o `https://` en todo el payload A2A, no solo en `parts[0].text`.
- Si recibe `FilePart.file.uri`, tratarlo como URL publica del fichero.
- Si recibe `FilePart.file.bytes`, tratarlo como base64 equivalente a `raw`.
- Si recibe `raw` o `file.bytes`, soportarlo solo para ficheros pequenos y devolver error claro si es demasiado grande.
- Si recibe texto con una URL `http://` o `https://`, extraer esa URL.
- Si no recibe URL ni fichero, no devolver HTTP 400. Devolver una respuesta JSON-RPC correcta con una `Task` en estado `input-required` y un `TextPart` que pida una URL publica de Excel, CSV, TXT o Markdown. Esto evita que clientes AWP que tengan bugs de manejo de excepciones oculten el error real.
- La `Task` `input-required` tambien debe responder en espanol.

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
        { "kind": "text", "text": "Resumen, KPIs principales y URL del dashboard en espanol" }
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

En Vercel no se puede depender de memoria de runtime para que el enlace de dashboard generado por A2A funcione despues de la respuesta. Para analisis desde URL publica:

- construir `dashboardUrl` como `/analysis/[analysisId]?sourceUrl=<url-publica-codificada>`;
- en `/analysis/[analysisId]`, si `/api/analysis/[analysisId]` no encuentra el resultado en memoria y existe `sourceUrl`, volver a analizar esa URL y renderizar el dashboard;
- mantener `sessionStorage` como cache del navegador para flujos iniciados desde el front;
- no introducir base de datos obligatoria para resolver este fallback.

## Prompt recomendado para el agente AWP

Cuando se configure el agente externo de AWP, usar una instruccion de este estilo:

```text
Te comunicas con un agente externo mediante protocolo A2A.

Tu agente remoto es:
https://excel-analyst-a2a-agent.vercel.app/.well-known/agent-card.json

Cuando el usuario te pida analizar un Excel, CSV, TXT, Markdown o fichero de datos, envia al agente remoto A2A un mensaje que incluya literalmente la URL publica del fichero dentro del texto del mensaje.

Formato recomendado:
"Analiza este fichero de datos: <URL_PUBLICA_DEL_FICHERO>"

No sustituyas la URL por referencias como "la URL anterior", "este Excel", "este fichero" o "el fichero adjunto".
Devuelve al usuario final la respuesta en espanol usando el resumen, KPIs, hallazgos, recomendaciones y enlace de dashboard que devuelva el agente remoto.
```

## README

Incluir:

- como ejecutar localmente;
- como desplegar en Vercel;
- que URL configurar en AWP: la URL base, no `/a2a/v1` ni `/message:send`;
- ejemplo de Agent Card;
- ejemplo curl HTTP+JSON;
- ejemplo curl JSON-RPC `message/send`;
- ejemplo curl JSON-RPC `tasks/get`;
- ejemplo de request con URL publica de Excel, CSV, TXT o Markdown;
- limitaciones: evitar base64 para ficheros grandes, preferir URL publica o URL temporal.

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
