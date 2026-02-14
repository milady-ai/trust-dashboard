import { TIERS } from "@/lib/trust-scoring";
import { TierBadge } from "@/components/tier-badge";

export default function ScoringPage() {
  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold mb-1">Trust Scoring Algorithm</h2>
        <p className="text-sm text-muted-foreground">
          How contributor trust scores are computed for milady-ai/milaidy. Score range: 0-100. Starting score: 35 (probationary).
        </p>
      </div>

      {/* Tiers */}
      <section>
        <h3 className="text-lg font-semibold mb-3">Trust Tiers</h3>
        <div className="space-y-2">
          {TIERS.map((tier) => (
            <div key={tier.label} className="flex items-center gap-4 rounded-lg border border-border bg-card p-3">
              <TierBadge tier={tier} size="md" />
              <span className="font-mono text-sm text-muted-foreground">{tier.minScore}+</span>
              <span className="text-sm text-muted-foreground flex-1">{tier.description}</span>
              {tier.autoMerge && (
                <span className="text-xs text-tier-legendary border border-tier-legendary/30 rounded-full px-2 py-0.5">
                  auto-merge
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Scoring Components */}
      <section>
        <h3 className="text-lg font-semibold mb-3">8 Scoring Components</h3>
        <div className="grid gap-3">
          <ScoringCard
            title="1. Diminishing Returns"
            formula="multiplier = 1 / (1 + 0.2 × ln(1 + priorApprovals))"
            description="Each subsequent approval is worth less. Your 50th approval earns ~49% of your 1st. Prevents grinding."
          />
          <ScoringCard
            title="2. Recency Weighting"
            formula="weight = 0.5 ^ (daysSinceEvent / 45)"
            description="Events lose relevance over time with a 45-day half-life. After 90 days, an event has 25% weight."
          />
          <ScoringCard
            title="3. Complexity Buckets"
            formula="trivial(≤10 LOC): 0.4x → medium(≤150): 1.0x → xlarge(≤1500): 1.5x → massive(>1500): 1.2x"
            description="Bigger PRs earn more, but suspiciously large PRs get capped. Sweet spot: 150-500 LOC."
          />
          <ScoringCard
            title="4. Category Weights"
            formula="security: 1.8x → core: 1.3x → feature: 1.1x → docs: 0.6x → chore: 0.5x"
            description="High-impact categories earn more trust. Security fixes are worth 3.6x a chore PR."
          />
          <ScoringCard
            title="5. Streak Mechanics"
            formula="approvals: +8%/streak (max +50%) | rejections: +15%/streak penalty (max 2.5x)"
            description="Consecutive approvals compound a bonus. Consecutive rejections compound a penalty."
          />
          <ScoringCard
            title="6. Inactivity Decay"
            formula="After 10 days: -0.5%/day toward floor of 30"
            description="Trust decays if you stop contributing. 10-day grace period. Score trends toward 40, floor at 30."
          />
          <ScoringCard
            title="7. Velocity Gates"
            formula="Soft cap: 10 PRs/week (-15%/excess) | Hard cap: 25 PRs/week (zeroed)"
            description="Too many PRs too fast is suspicious. Points are reduced or zeroed above thresholds."
          />
          <ScoringCard
            title="8. Daily Point Cap"
            formula="Max 35 raw positive points per calendar day"
            description="Prevents trust explosions from a single day of activity. Encourages sustained contributions."
          />
        </div>
      </section>

      {/* Event Types */}
      <section>
        <h3 className="text-lg font-semibold mb-3">Event Types</h3>
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground text-left">
                <th className="px-4 py-2">Event</th>
                <th className="px-4 py-2">Base Points</th>
                <th className="px-4 py-2">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="px-4 py-2 font-mono text-tier-trusted">approve</td>
                <td className="px-4 py-2 font-mono">+12</td>
                <td className="px-4 py-2 text-muted-foreground">PR approved and merged</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-mono text-tier-probationary">reject</td>
                <td className="px-4 py-2 font-mono">-6</td>
                <td className="px-4 py-2 text-muted-foreground">PR received CHANGES_REQUESTED</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-mono text-tier-restricted">close</td>
                <td className="px-4 py-2 font-mono">-10</td>
                <td className="px-4 py-2 text-muted-foreground">PR closed without merge</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-mono text-muted-foreground">selfClose</td>
                <td className="px-4 py-2 font-mono">-2</td>
                <td className="px-4 py-2 text-muted-foreground">Contributor closed own PR</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ScoringCard({ title, formula, description }: { title: string; formula: string; description: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h4 className="font-medium text-sm mb-1">{title}</h4>
      <code className="text-xs text-accent bg-muted px-2 py-1 rounded block mb-2 font-mono">
        {formula}
      </code>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
