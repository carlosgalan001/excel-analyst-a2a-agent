export function buildAgentCard(baseUrl: string) {
  return {
    name: "Excel Analyst A2A Agent",
    description: "Agent that analyzes multi-sheet Excel workbooks and returns KPIs, dashboard URLs and an executive report.",
    version: "1.0.0",
    url: baseUrl,
    supportedInterfaces: [
      {
        name: "HTTP+JSON",
        endpoint: `${baseUrl}/a2a/v1/message:send`,
        transport: "http",
        contentType: "application/json"
      },
      {
        name: "JSONRPC",
        endpoint: `${baseUrl}/a2a/v1`,
        transport: "http",
        contentType: "application/json"
      }
    ],
    capabilities: {
      streaming: false,
      taskLookup: true,
      fileUpload: true
    },
    skills: [
      {
        id: "analyze_excel_workbook",
        name: "Analyze Excel Workbook",
        description: "Receives an Excel URL or small Excel file and returns KPIs, insights, artifacts and a dashboard URL.",
        inputModes: [
          "application/json",
          "text/plain",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel"
        ],
        outputModes: ["application/json", "text/plain", "text/html"]
      }
    ],
    inputModes: [
      "application/json",
      "text/plain",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel"
    ],
    outputModes: ["application/json", "text/plain", "text/html"]
  };
}
