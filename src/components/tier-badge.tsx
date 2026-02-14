import { TierConfig } from "@/lib/trust-scoring";

interface TierBadgeProps {
  tier: TierConfig;
  size?: "sm" | "md" | "lg";
}

export function TierBadge({ tier, size = "md" }: TierBadgeProps) {
  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5 gap-1",
    md: "text-sm px-2 py-1 gap-1.5",
    lg: "text-base px-3 py-1.5 gap-2",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${sizeClasses[size]}`}
      style={{
        backgroundColor: tier.bg,
        color: tier.color,
        border: `1px solid ${tier.color}33`,
      }}
    >
      <span>{tier.icon}</span>
      <span className="capitalize">{tier.label}</span>
    </span>
  );
}
