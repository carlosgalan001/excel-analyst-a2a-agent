import { BarChart3 } from "lucide-react";
import Link from "next/link";
import { HomeClient } from "@/components/home-client";

export default function HomePage() {
  return (
    <main className="shell">
      <Header />
      <section className="content">
        <div className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">A2A-ready workbook intelligence</p>
            <h1>Excel Analyst A2A Agent</h1>
            <p>
              Upload a small workbook or analyze a public Excel URL, then share the same analysis through public A2A
              endpoints for external AWP agents.
            </p>
            <div className="metrics-strip" aria-label="Demo capabilities">
              <div className="metric">
                <span>Input</span>
                <strong>URL</strong>
              </div>
              <div className="metric">
                <span>Sheets</span>
                <strong>Multi</strong>
              </div>
              <div className="metric">
                <span>Output</span>
                <strong>JSON</strong>
              </div>
              <div className="metric">
                <span>A2A</span>
                <strong>HTTP</strong>
              </div>
            </div>
          </div>
          <HomeClient />
        </div>
      </section>
    </main>
  );
}

function Header() {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link className="brand-lockup" href="/">
          <span className="brand-mark" aria-hidden="true">
            <BarChart3 size={19} />
          </span>
          <span>Excel Analyst A2A Agent</span>
        </Link>
        <nav className="nav-links" aria-label="Primary navigation">
          <Link href="/a2a-playground">A2A Playground</Link>
          <Link href="/.well-known/agent-card.json">Agent Card</Link>
        </nav>
      </div>
    </header>
  );
}
