import Link from "next/link";
import trustScoresData from "@/data/trust-scores.json";
import type { ContributorProfile } from "@/lib/contributor-types";
import { formatRelativeTime } from "@/lib/utils";

function normalizeData(input: unknown): ContributorProfile[] {
  if (Array.isArray(input)) return input as ContributorProfile[];
  const maybeDataFile = input as { contributors?: ContributorProfile[] };
  if (maybeDataFile && Array.isArray(maybeDataFile.contributors)) {
    return maybeDataFile.contributors;
  }
  return [];
}

export const dynamicParams = false;

export async function generateStaticParams(): Promise<Array<{ username: string }>> {
  const contributors = normalizeData(trustScoresData);
  return contributors.map((c) => ({ username: c.username }));
}

export default async function ContributorDetailPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const contributors = normalizeData(trustScoresData);
  const profile = contributors.find((c) => c.username.toLowerCase() === username.toLowerCase());

  if (!profile) {
    return (
      <div className="mx-auto max-w-3xl rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">Dashboard &gt; {username}</p>
        <h2 className="mt-2 text-2xl font-bold">Contributor not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">We couldn&apos;t find a contributor with that username.</p>
        <Link href="/" className="mt-4 inline-block text-accent hover:underline">&larr; Back to Dashboard</Link>
      </div>
    );
  }

  const totalPRs = profile.totalApprovals + profile.totalRejections + profile.totalCloses + (profile.totalSelfCloses ?? 0);
  const approvalRate = totalPRs > 0 ? (profile.totalApprovals / totalPRs) * 100 : 0;
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weeklyActivity = profile.events.filter((e) => {
    const ts = e.timestamp < 1_000_000_000_000 ? e.timestamp * 1000 : e.timestamp;
    return ts >= weekAgo;
  }).length;

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="space-y-2">
        <Link href="/" className="inline-block text-sm text-accent hover:underline">&larr; Back to Dashboard</Link>
        <div className="text-xs text-muted-foreground">Dashboard &gt; {profile.username}</div>
      </div>

      <section className="rounded-xl border border-border bg-card p-4 md:p-6">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={profile.avatarUrl} alt={profile.username} className="h-16 w-16 rounded-full border border-border bg-muted" />
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">@{profile.username}</h1>
            <p className="text-sm text-muted-foreground">
              Member since {formatRelativeTime(profile.firstSeenAt)}
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <InfoCard label="Total PRs" value={totalPRs.toString()} />
        <InfoCard label="Approved" value={profile.totalApprovals.toString()} subtitle={`${approvalRate.toFixed(0)}% rate`} />
        <InfoCard label="Rejected" value={profile.totalRejections.toString()} />
        <InfoCard label="This Week" value={weeklyActivity.toString()} subtitle="events" />
      </section>

      <section className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">Recent Events</h3>
        </div>
        <div className="divide-y divide-border">
          {profile.events
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 20)
            .map((event, idx) => (
              <div key={idx} className="px-4 py-3 flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span>{event.type === "approve" ? "✅" : event.type === "reject" ? "❌" : event.type === "close" ? "⛔" : "↩️"}</span>
                  <span>PR #{event.prNumber}</span>
                  <span className="text-muted-foreground">· {event.type}</span>
                </div>
                <span className="text-xs text-muted-foreground">{formatRelativeTime(event.timestamp)}</span>
              </div>
            ))}
          {profile.events.length === 0 && (
            <div className="px-4 py-6 text-sm text-muted-foreground text-center">No events yet.</div>
          )}
        </div>
      </section>
    </div>
  );
}

function InfoCard({ label, value, subtitle }: { label: string; value: string; subtitle?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-xl font-bold font-mono">{value}</div>
      {subtitle && <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>}
    </div>
  );
}
