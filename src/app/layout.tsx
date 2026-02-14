import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Milaidy Contributor Dashboard",
  description: "Trust scoring leaderboard for milady-ai/milaidy contributors",
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
              <a href="/" className="hover:text-foreground transition-colors">Leaderboard</a>
              <a href="/scoring" className="hover:text-foreground transition-colors">Scoring</a>
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
