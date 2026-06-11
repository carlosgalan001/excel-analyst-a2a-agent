import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Excel Analyst A2A Agent",
  description: "A2A-ready Excel analysis agent for dashboards, KPIs, and executive insights."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
