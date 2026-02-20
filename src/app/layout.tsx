import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

const siteTitle = "Milaidy Contributor Dashboard";
const siteDescription = "Trust scoring, leaderboard, badges, and agent rankings for milady-ai/milaidy contributors.";
const faviconSvg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='14' fill='#09090B'/><path d='M16 44V20h7l9 14 9-14h7v24h-7V31l-9 13-9-13v13z' fill='#C084FC'/></svg>`;

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

const NAV_LINKS = [
  { href: "/", label: "Leaderboard" },
  { href: "/agents", label: "Agents" },
  { href: "/scoring", label: "Scoring" },
  { href: "/simulator", label: "Simulator" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">
        <header className="sticky top-0 z-50 border-b border-border glass">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                M
              </div>
              <h1 className="text-lg font-bold tracking-tight">
                <span className="gradient-text">milaidy</span>
                <span className="text-muted-foreground font-normal">/dashboard</span>
              </h1>
            </Link>
            <nav className="flex items-center gap-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
              <a
                href="https://github.com/milady-ai/milaidy"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                GitHub ↗
              </a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
