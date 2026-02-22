import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

const siteTitle = "Milaidy Contributor Dashboard";
const siteDescription = "Trust scoring, leaderboard, badges, and agent rankings for milady-ai/milaidy contributors.";
const faviconSvg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='14' fill='#fafafa'/><path d='M16 44V20h7l9 14 9-14h7v24h-7V31l-9 13-9-13v13z' fill='#7C3AED'/></svg>`;

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
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header className="border-b border-border/80 glass">
          <div className="mx-auto max-w-6xl px-4 py-4 flex flex-wrap items-center justify-between gap-2">
            <Link href="/" className="inline-flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-violet-100 text-violet-700 text-xs font-semibold">
                M
              </span>
              <span className="text-sm font-semibold tracking-tight text-foreground">
                milaidy/dashboard
              </span>
            </Link>
            <nav className="flex items-center gap-1.5">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-3 py-1.5 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  {link.label}
                </Link>
              ))}
              <a
                href="https://github.com/milady-ai/milaidy"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 px-3 py-1.5 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                GitHub
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
