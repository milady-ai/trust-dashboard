interface StreakIndicatorProps {
  type: "approve" | "negative" | null;
  length: number;
}

export function StreakIndicator({ type, length }: StreakIndicatorProps) {
  if (!type || length === 0) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }

  if (type === "approve") {
    return (
      <span className="text-sm" title={`${length} consecutive approvals`}>
        {"🔥".repeat(Math.min(length, 5))}
        {length > 5 && <span className="text-tier-legendary font-mono ml-0.5">×{length}</span>}
      </span>
    );
  }

  return (
    <span className="text-sm" title={`${length} consecutive rejections`}>
      {"⚠️".repeat(Math.min(length, 3))}
      {length > 3 && <span className="text-tier-restricted font-mono ml-0.5">×{length}</span>}
    </span>
  );
}
