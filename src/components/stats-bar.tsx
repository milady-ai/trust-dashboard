import { ContributorData, TIERS } from "@/lib/trust-scoring";

interface StatsBarProps {
  contributors: ContributorData[];
}

export function StatsBar({ contributors }: StatsBarProps) {
  const totalContributors = contributors.length;
  const avgScore = totalContributors > 0
    ? contributors.reduce((sum, c) => sum + c.trustScore, 0) / totalContributors
    : 0;
  const autoMergeCount = contributors.filter(c => c.autoMergeEligible).length;

  // Count per tier
  const tierCounts = TIERS.map(tier => {
    const nextTierIdx = TIERS.indexOf(tier) - 1;
    const maxScore = nextTierIdx >= 0 ? TIERS[nextTierIdx].minScore : 101;
    return {
      tier,
      count: contributors.filter(c => c.trustScore >= tier.minScore && c.trustScore < maxScore).length,
    };
  }).filter(t => t.count > 0);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <StatCard label="Contributors" value={totalContributors.toString()} />
      <StatCard label="Avg Trust Score" value={avgScore.toFixed(1)} />
      <StatCard label="Auto-Merge Eligible" value={autoMergeCount.toString()} />
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="text-xs text-muted-foreground mb-2">Tier Distribution</div>
        <div className="flex gap-1 items-end h-6">
          {tierCounts.map(({ tier, count }) => (
            <div
              key={tier.label}
              className="flex-1 rounded-sm min-w-[4px]"
              style={{
                backgroundColor: tier.color,
                height: `${Math.max(20, (count / totalContributors) * 100)}%`,
              }}
              title={`${tier.label}: ${count}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold font-mono mt-1">{value}</div>
    </div>
  );
}
