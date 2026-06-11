import { BarChart3 } from "lucide-react";
import Link from "next/link";
import { A2APlayground } from "@/components/a2a-playground";

export default function A2APlaygroundPage() {
  return (
    <main className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand-lockup" href="/">
            <span className="brand-mark" aria-hidden="true">
              <BarChart3 size={19} />
            </span>
            <span>Excel Analyst A2A Agent</span>
          </Link>
          <nav className="nav-links" aria-label="Navegacion principal">
            <Link href="/">Analizar</Link>
            <Link href="/.well-known/agent-card.json">Agent Card</Link>
          </nav>
        </div>
      </header>
      <A2APlayground />
    </main>
  );
}
