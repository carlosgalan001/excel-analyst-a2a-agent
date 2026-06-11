"use client";

import { Clipboard, Loader2, Play, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";

const DEMO_EXCEL_URL =
  "https://www.sspa.juntadeandalucia.es/servicioandaluzdesalud/sites/default/files/sincfiles/wsas-media-mediafile_sasdocumento/2025/Conjunto%20M%C3%ADnimo%20B%C3%A1sico%20de%20Datos.%20Grupos%20Relacionados%20por%20el%20Diagn%C3%B3stico%202024%20Indicadores..xlsx";

export function A2APlayground() {
  const [excelUrl, setExcelUrl] = useState(DEMO_EXCEL_URL);
  const [response, setResponse] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const requestBody = useMemo(
    () => ({
      message: {
        role: "user",
        parts: [
          {
            data: {
              excelUrl
            },
            mediaType: "application/json"
          }
        ]
      }
    }),
    [excelUrl]
  );

  async function send() {
    setIsLoading(true);
    setError(null);
    setResponse(null);

    try {
      const httpResponse = await fetch("/a2a/v1/message:send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });
      const json = await httpResponse.json();

      if (!httpResponse.ok) {
        throw new Error(json?.error?.message ?? "A2A request failed.");
      }

      setResponse(json);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unexpected A2A error.");
    } finally {
      setIsLoading(false);
    }
  }

  async function copyRequest() {
    await navigator.clipboard.writeText(JSON.stringify(requestBody, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <section className="content">
      <div className="section-heading">
        <div>
          <p className="eyebrow">A2A Playground</p>
          <h1>SendMessage demo</h1>
          <p>Run a real HTTP+JSON request against this app&apos;s public A2A endpoint.</p>
        </div>
      </div>

      <div className="playground-grid">
        <section className="section-band">
          <div className="form-stack">
            <div className="field">
              <label htmlFor="playground-url">Excel URL</label>
              <input
                className="plain-input"
                id="playground-url"
                onChange={(event) => setExcelUrl(event.target.value)}
                type="url"
                value={excelUrl}
              />
            </div>

            <div>
              <span className="textarea-label">Request</span>
              <pre className="json-block">{JSON.stringify(requestBody, null, 2)}</pre>
            </div>

            {error ? <div className="status status-error">{error}</div> : null}

            <div className="button-row">
              <button className="btn btn-primary" disabled={isLoading || !excelUrl.trim()} onClick={send} type="button">
                {isLoading ? <Loader2 size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
                Send
              </button>
              <button className="btn btn-secondary" onClick={copyRequest} title="Copy request JSON" type="button">
                <Clipboard size={18} aria-hidden="true" />
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setExcelUrl(DEMO_EXCEL_URL);
                  setResponse(null);
                  setError(null);
                }}
                title="Restore demo URL"
                type="button"
              >
                <RefreshCw size={18} aria-hidden="true" />
                Reset
              </button>
            </div>
          </div>
        </section>

        <section className="section-band">
          <h2>Response</h2>
          {isLoading ? <div className="status status-loading">Waiting for completed A2A task...</div> : null}
          <pre className="json-block">{response ? JSON.stringify(response, null, 2) : "{}"}</pre>
        </section>
      </div>
    </section>
  );
}
