import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl rounded-xl border border-border bg-card p-8 text-center">
      <h2 className="text-2xl font-bold">Page not found</h2>
      <p className="mt-2 text-sm text-muted-foreground">The page you requested does not exist.</p>
      <Link href="/" className="mt-4 inline-block text-accent hover:underline">
        ← Back to Leaderboard
      </Link>
    </div>
  );
}
