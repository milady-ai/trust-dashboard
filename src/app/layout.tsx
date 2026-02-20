import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

const siteTitle = "Milaidy Contributor Dashboard";
const siteDescription = "Interactive trust scoring, leaderboard insights, and simulator for milady-ai/milaidy contributors.";
const faviconSvg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='14' fill='#0A0A0F'/><path d='M16 44V20h7l9 14 9-14h7v24h-7V31l-9 13-9-13v13z' fill='#C084FC'/></svg>`;

export const metadata: Metadata = {
  title: siteTitle,
  description: siteDescription,
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: "https://trust-dashboard.milady.ai",
    siteName: siteTitle,
    type: "website",
  },
  icons: {
    icon: `data:image/svg+xml,${encodeURIComponent(faviconSvg)}`,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">
        <header className="border-b border-border">
          <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight">
                <span className="text-accent">milaidy</span>
                <span className="text-muted-foreground">/</span>
                <span>dashboard</span>
              </h1>
            </div>
            <nav className="flex items-center gap-4 text-sm text-muted-foreground">
              <Link href="/" className="hover:text-foreground transition-colors">Leaderboard</Link>
              <Link href="/scoring" className="hover:text-foreground transition-colors">Scoring</Link>
              <Link href="/simulator" className="hover:text-foreground transition-colors">Simulator</Link>
              <a
                href="https://github.com/milady-ai/milaidy"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                GitHub ↗
              </a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
