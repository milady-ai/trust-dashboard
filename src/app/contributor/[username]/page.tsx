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
  const totalPRs = c.githubEvents.filter((e) => e.type === "pr_merged").length;
  const totalReviews = c.githubEvents.filter((e) => e.type === "review_given").length;
  const totalIssues = c.githubEvents.filter((e) => e.type === "issue_closed").length;

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
                Rank #{c.elizaEffect.rank} · Top {100 - c.elizaEffect.percentile}%
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
            <ScoreRow label="PRs Merged" value={gh.prs} max={35} count={totalPRs} />
            <ScoreRow label="Code Reviews" value={gh.reviews} max={25} count={totalReviews} />
            <ScoreRow label="Issues Closed" value={gh.issues} max={20} count={totalIssues} />
            <ScoreRow label="Consistency" value={gh.consistency} max={20} />
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
                <div className="flex items-center gap-2">
                  <span>{event.type === "pr_merged" ? "✅" : event.type === "review_given" ? "👁️" : event.type === "issue_closed" ? "🔧" : "⛔"}</span>
                  <span>{event.prNumber ? `PR #${event.prNumber}` : event.issueNumber ? `Issue #${event.issueNumber}` : "—"}</span>
                  <span className="text-muted-foreground">· {event.type.replace("_", " ")}</span>
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

function ScoreRow({ label, value, max, count }: { label: string; value: number; max: number; count?: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-muted-foreground">
          {label}
          {count !== undefined && <span className="ml-1 opacity-60">({count})</span>}
        </span>
        <span className="font-mono">{value.toFixed(1)}/{max}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-accent/60" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}
