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
            <p className="eyebrow">Inteligencia Excel preparada para A2A</p>
            <h1>Excel Analyst A2A Agent</h1>
            <p>
              Sube un Excel pequeno o analiza una URL publica. El mismo motor expone resultados estructurados por A2A
              para agentes externos de AWP.
            </p>
            <div className="metrics-strip" aria-label="Demo capabilities">
              <div className="metric">
                <span>Entrada</span>
                <strong>URL</strong>
              </div>
              <div className="metric">
                <span>Hojas</span>
                <strong>Multi</strong>
              </div>
              <div className="metric">
                <span>Salida</span>
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
        <nav className="nav-links" aria-label="Navegacion principal">
          <Link href="/a2a-playground">Playground A2A</Link>
          <Link href="/.well-known/agent-card.json">Agent Card</Link>
        </nav>
      </div>
    </header>
  );
}
