"use client";

import Link from "next/link";

export default function ErrorPage() {
  return (
    <div className="mx-auto max-w-3xl rounded-xl border border-border bg-card p-8 text-center">
      <h2 className="text-2xl font-bold">Something went wrong</h2>
      <p className="mt-2 text-sm text-muted-foreground">Please refresh or return to the leaderboard.</p>
      <Link href="/" className="mt-4 inline-block text-accent hover:underline">
        ← Back to Leaderboard
      </Link>
    </div>
  );
}
