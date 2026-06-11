import { BarChart3 } from "lucide-react";
import Link from "next/link";
import { AnalysisDashboard } from "@/components/analysis-dashboard";

export default function AnalysisPage({ params }: { params: { analysisId: string } }) {
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
          <nav className="nav-links" aria-label="Primary navigation">
            <Link href="/">Analyze</Link>
            <Link href="/a2a-playground">A2A Playground</Link>
            <Link href="/.well-known/agent-card.json">Agent Card</Link>
          </nav>
        </div>
      </header>
      <AnalysisDashboard analysisId={params.analysisId} />
    </main>
  );
}
