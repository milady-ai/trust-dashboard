import { TierConfig, TIERS } from "@/lib/trust-scoring";

interface ScoreBarProps {
  score: number;
  tier: TierConfig;
}

export function ScoreBar({ score, tier }: ScoreBarProps) {
  // Find the range within the current tier
  const tierIdx = TIERS.indexOf(tier);
  const nextTier = tierIdx > 0 ? TIERS[tierIdx - 1] : null;
  const tierMin = tier.minScore;
  const tierMax = nextTier ? nextTier.minScore : 100;
  const progress = ((score - tierMin) / (tierMax - tierMin)) * 100;

  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <span className="text-sm font-mono font-bold" style={{ color: tier.color }}>
        {score.toFixed(1)}
      </span>
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.min(100, Math.max(0, progress))}%`,
            backgroundColor: tier.color,
          }}
        />
      </div>
    </div>
  );
}
