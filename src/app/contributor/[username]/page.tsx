import Link from "next/link";
import { loadContributor, loadContributors } from "@/lib/data-loader";
import { formatRelativeTime } from "@/lib/utils";

export const dynamicParams = false;

export async function generateStaticParams(): Promise<Array<{ username: string }>> {
  return loadContributors().map((c) => ({ username: c.username }));
}

export default async function ContributorDetailPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const contributor = loadContributor(username);

  if (!contributor) {
    return (
      <div className="mx-auto max-w-3xl rounded-xl border border-border bg-card p-8 text-center">
        <h2 className="mt-2 text-2xl font-bold">Contributor not found</h2>
        <Link href="/" className="mt-4 inline-block text-accent hover:underline">&larr; Back to Leaderboard</Link>
      </div>
    );
  }

  const c = contributor;
  const totalMerged = c.githubEvents.filter((e) => e.type === "pr_merged").length;
  const totalRejected = c.githubEvents.filter((e) => e.type === "pr_rejected").length;
  const totalClosed = c.githubEvents.filter((e) => e.type === "pr_closed").length;
  const totalParticipation = totalRejected + totalClosed +
    c.githubEvents.filter((e) => e.type === "review_given" || e.type === "issue_closed").length;
  const totalSubmitted = totalMerged + totalRejected + totalClosed;
  const mergeRate = totalSubmitted > 0 ? Math.round((totalMerged / totalSubmitted) * 100) : 0;
  const totalLines = c.githubEvents
    .filter((e) => e.type === "pr_merged")
    .reduce((sum, e) => sum + (e.linesChanged ?? 0), 0);

  const gh = c.elizaEffect.github;
  const social = c.elizaEffect.social;

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="space-y-2">
        <Link href="/" className="inline-block text-sm text-accent hover:underline">&larr; Back to Leaderboard</Link>
      </div>

      {/* Header */}
      <section className="rounded-xl border border-border bg-card p-4 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.avatarUrl} alt={c.username} className="h-16 w-16 rounded-full border border-border bg-muted" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">@{c.username}</h1>
              <p className="text-sm text-muted-foreground">
                Rank #{c.elizaEffect.rank} · Top {Math.max(1, 100 - c.elizaEffect.percentile)}%
              </p>
            </div>
          </div>

          <div className="text-left md:text-right">
            <div className="text-4xl font-bold font-mono text-accent">
              {c.elizaEffect.total.toFixed(1)}
            </div>
            <div className="text-xs text-muted-foreground">elizaEffect score</div>
            {c.elizaPay && c.elizaPay.sharePercent > 0 && (
              <div className="mt-1 inline-flex items-center rounded-full bg-eliza-gold/10 border border-eliza-gold/30 px-3 py-1 text-sm font-mono text-eliza-gold">
                {c.elizaPay.sharePercent.toFixed(2)}% elizaPay
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Quick Stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground">Merged PRs</div>
          <div className="text-xl font-bold font-mono mt-0.5">{totalMerged}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground">Merge Rate</div>
          <div className="text-xl font-bold font-mono mt-0.5">{mergeRate}%</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground">Lines Contributed</div>
          <div className="text-xl font-bold font-mono mt-0.5">{totalLines >= 1000 ? `${(totalLines / 1000).toFixed(1)}k` : totalLines}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground">Total Events</div>
          <div className="text-xl font-bold font-mono mt-0.5">{c.githubEvents.length}</div>
        </div>
      </section>

      {/* Score Breakdown */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* GitHub Score */}
        <div className="rounded-xl border border-border bg-card p-4 md:p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-block h-3 w-3 rounded-full bg-github" />
            <h3 className="text-lg font-semibold">GitHub Score</h3>
            <span className="ml-auto text-2xl font-bold font-mono text-github">{gh.total.toFixed(1)}</span>
          </div>
          <div className="space-y-3">
            <ScoreRow label="Merged PRs" value={gh.prs} max={40} count={totalMerged} />
            <ScoreRow label="Participation" value={gh.participation} max={20} count={totalParticipation} subtitle="reviews, closes, iterations" />
            <ScoreRow label="Consistency" value={gh.consistency} max={25} subtitle="active days & weeks" />
            <ScoreRow label="Impact" value={gh.impact} max={15} subtitle="depth of top PRs" />
          </div>
        </div>

        {/* Social Score */}
        <div className="rounded-xl border border-border bg-card p-4 md:p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-block h-3 w-3 rounded-full bg-social" />
            <h3 className="text-lg font-semibold">Social Score</h3>
            <span className="ml-auto text-2xl font-bold font-mono text-social">{social.total.toFixed(1)}</span>
          </div>
          <div className="space-y-3">
            <ScoreRow label="Posts" value={social.posts} max={30} count={c.socialPosts.length} />
            <ScoreRow label="Content" value={social.content} max={35} />
            <ScoreRow label="Engagement" value={social.engagement} max={25} />
            <ScoreRow label="Referrals" value={social.referrals} max={10} count={c.referralCount} />
          </div>
          {c.socialPosts.length === 0 && (
            <div className="mt-4 text-xs text-muted-foreground border border-dashed border-border rounded-lg p-3 text-center">
              No social posts linked yet. Social scoring will activate once posts are submitted.
            </div>
          )}
        </div>
      </section>

      {/* elizaPay Details */}
      {c.elizaPay && c.elizaPay.sharePercent > 0 && (
        <section className="rounded-xl border border-eliza-gold/20 bg-card p-4 md:p-5">
          <h3 className="text-lg font-semibold mb-3 text-eliza-gold">elizaPay Distribution</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Pool Share</div>
              <div className="text-lg font-bold font-mono text-eliza-gold">{c.elizaPay.sharePercent.toFixed(2)}%</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">sqrt(score)</div>
              <div className="text-lg font-bold font-mono">{c.elizaPay.sqrtScore.toFixed(3)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Method</div>
              <div className="text-sm text-muted-foreground mt-1">Quadratic</div>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            elizaPay uses quadratic distribution (square root of elizaEffect score) to ensure
            a more equitable payout from creator token rewards.
          </p>
        </section>
      )}

      {/* Recent GitHub Events */}
      <section className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">Recent GitHub Events</h3>
        </div>
        <div className="divide-y divide-border">
          {c.githubEvents
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 20)
            .map((event, idx) => (
              <div key={idx} className="px-4 py-3 flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="shrink-0">{event.type === "pr_merged" ? "✅" : event.type === "pr_rejected" ? "❌" : event.type === "review_given" ? "👁️" : event.type === "issue_closed" ? "🔧" : "⛔"}</span>
                  <span className="shrink-0">{event.prNumber ? `PR #${event.prNumber}` : event.issueNumber ? `Issue #${event.issueNumber}` : "—"}</span>
                  <span className="text-muted-foreground truncate">· {event.type.replace(/_/g, " ")}</span>
                  {event.linesChanged != null && event.linesChanged > 0 && (
                    <span className="text-xs text-muted-foreground/60 shrink-0">{event.linesChanged >= 1000 ? `${(event.linesChanged / 1000).toFixed(1)}k` : event.linesChanged} lines</span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">{formatRelativeTime(event.timestamp)}</span>
              </div>
            ))}
          {c.githubEvents.length === 0 && (
            <div className="px-4 py-6 text-sm text-muted-foreground text-center">No events yet.</div>
          )}
        </div>
      </section>

      {/* Social Posts */}
      {c.socialPosts.length > 0 && (
        <section className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold">Social Posts</h3>
          </div>
          <div className="divide-y divide-border">
            {c.socialPosts
              .sort((a, b) => b.timestamp - a.timestamp)
              .slice(0, 10)
              .map((post, idx) => (
                <div key={idx} className="px-4 py-3 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="capitalize">{post.platform}</span>
                    {post.isTutorial && <span className="text-xs bg-eliza-green/10 text-eliza-green px-1.5 rounded">tutorial</span>}
                    {post.isThread && <span className="text-xs bg-eliza-blue/10 text-eliza-blue px-1.5 rounded">thread</span>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{post.likes} likes</span>
                    <span>{post.replies} replies</span>
                    <span>{post.reposts} reposts</span>
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ScoreRow({ label, value, max, count, subtitle }: { label: string; value: number; max: number; count?: number; subtitle?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-muted-foreground">
          {label}
          {count !== undefined && <span className="ml-1 opacity-60">({count})</span>}
          {subtitle && <span className="ml-1 opacity-40 hidden sm:inline">— {subtitle}</span>}
        </span>
        <span className="font-mono">{value.toFixed(1)}/{max}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-accent/60" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}
