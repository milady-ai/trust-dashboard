import { TierConfig, TrustTier, getTierConfig } from "@/lib/trust-scoring";

interface TierBadgeProps {
  tier: TierConfig | TrustTier;
  size?: "sm" | "md" | "lg";
}

export function TierBadge({ tier, size = "md" }: TierBadgeProps) {
  const tierConfig = typeof tier === "string" ? getTierConfig(tier) : tier;

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5 gap-1",
    md: "text-sm px-2 py-1 gap-1.5",
    lg: "text-base px-3 py-1.5 gap-2",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${sizeClasses[size]}`}
      style={{
        backgroundColor: tierConfig.bg,
        color: tierConfig.color,
        border: `1px solid ${tierConfig.color}33`,
      }}
    >
      <span>{tierConfig.icon}</span>
      <span className="capitalize">{tierConfig.label}</span>
    </span>
  );
}
