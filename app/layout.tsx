import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Excel Analyst A2A Agent",
  description: "Agente A2A para analizar Excels, generar KPIs, dashboards e insights ejecutivos."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
