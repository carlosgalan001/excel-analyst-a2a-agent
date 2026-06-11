export function buildAgentCard(baseUrl: string) {
  const jsonRpcUrl = `${baseUrl}/a2a/v1`;
  const httpJsonUrl = `${baseUrl}/a2a/v1/message:send`;
  const inputModes = [
    "application/json",
    "text/plain",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel"
  ];
  const outputModes = ["application/json", "text/plain", "text/html"];

  return {
    name: "Excel Analyst A2A Agent",
    description: "Agent that analyzes multi-sheet Excel workbooks and returns KPIs, dashboard URLs and an executive report.",
    version: "1.0.0",
    url: jsonRpcUrl,
    preferredTransport: "JSONRPC",
    protocolVersion: "0.3.0",
    defaultInputModes: inputModes,
    defaultOutputModes: outputModes,
    additionalInterfaces: [
      {
        transport: "JSONRPC",
        url: jsonRpcUrl
      },
      {
        transport: "HTTP+JSON",
        url: httpJsonUrl
      }
    ],
    supportedInterfaces: [
      {
        name: "HTTP+JSON",
        endpoint: httpJsonUrl,
        transport: "http",
        contentType: "application/json"
      },
      {
        name: "JSONRPC",
        endpoint: jsonRpcUrl,
        transport: "http",
        contentType: "application/json"
      }
    ],
    capabilities: {
      streaming: false
    },
    skills: [
      {
        id: "analyze_excel_workbook",
        name: "Analyze Excel Workbook",
        description: "Receives an Excel URL or small Excel file and returns KPIs, insights, artifacts and a dashboard URL.",
        tags: ["excel", "spreadsheet", "analytics", "kpi", "dashboard"],
        inputModes,
        outputModes
      }
    ],
    inputModes,
    outputModes
  };
}
