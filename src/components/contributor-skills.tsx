import type { ContributorRole, FocusAreaProfile, SkillProfile } from "@/lib/trust-scoring";

// ============================================================================
// Role Badge
// ============================================================================

interface RoleBadgeProps {
  role: ContributorRole;
  size?: "xs" | "sm" | "md";
}

export function RoleBadge({ role, size = "sm" }: RoleBadgeProps) {
  const sizeClasses = {
    xs: "px-1.5 py-0.5 text-[10px]",
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-1 text-sm",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 font-medium text-muted-foreground ${sizeClasses[size]}`}
      title={role.description}
    >
      <span>{role.icon}</span>
      <span>{role.label}</span>
    </span>
  );
}

// ============================================================================
// Focus Area Badge
// ============================================================================

interface FocusAreaBadgeProps {
  area: FocusAreaProfile;
  size?: "xs" | "sm";
  showLevel?: boolean;
}

const LEVEL_COLORS: Record<number, string> = {
  5: "border-amber-500/60 bg-amber-500/10 text-amber-400",
  4: "border-purple-500/60 bg-purple-500/10 text-purple-400",
  3: "border-blue-500/60 bg-blue-500/10 text-blue-400",
  2: "border-emerald-500/60 bg-emerald-500/10 text-emerald-400",
  1: "border-border bg-muted/50 text-muted-foreground",
};

export function FocusAreaBadge({ area, size = "sm", showLevel = false }: FocusAreaBadgeProps) {
  const colorClass = LEVEL_COLORS[area.level] ?? LEVEL_COLORS[1];
  const sizeClasses = {
    xs: "px-1.5 py-0.5 text-[10px]",
    sm: "px-2 py-0.5 text-xs",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-medium ${colorClass} ${sizeClasses[size]}`}
      title={`${area.label} — ${area.levelLabel} (${area.xp} XP, ${area.prs} merged PRs)`}
    >
      <span>{area.icon}</span>
      <span>{area.label}</span>
      {showLevel && area.levelLabel && (
        <span className="opacity-70">· {area.levelLabel}</span>
      )}
    </span>
  );
}

// ============================================================================
// Skill Panel (contributor detail page)
// ============================================================================

interface SkillPanelProps {
  skillProfile: SkillProfile;
}

export function SkillPanel({ skillProfile }: SkillPanelProps) {
  const { role, focusAreas, topSkills } = skillProfile;

  return (
    <section className="rounded-xl border border-border bg-card p-4 md:p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Skills &amp; Focus Areas</h3>
        <RoleBadge role={role} size="md" />
      </div>

      <p className="text-xs text-muted-foreground">{role.description}</p>

      {focusAreas.length > 0 && (
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Focus Areas
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {focusAreas.map((area) => (
              <FocusAreaBar key={area.key} area={area} />
            ))}
          </div>
        </div>
      )}

      {topSkills.length > 0 && (
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Demonstrated Skills
          </div>
          <div className="flex flex-wrap gap-1.5">
            {topSkills.map((skill) => (
              <span
                key={skill}
                className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs text-foreground"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {focusAreas.length === 0 && (
        <p className="text-sm text-muted-foreground italic">
          No focus areas yet — merge some PRs to earn XP!
        </p>
      )}
    </section>
  );
}

// ============================================================================
// Focus Area Bar (with XP progress)
// ============================================================================

interface FocusAreaBarProps {
  area: FocusAreaProfile;
}

const XP_FOR_NEXT_LEVEL: Record<number, number> = {
  0: 1,
  1: 5,
  2: 15,
  3: 30,
  4: 60,
  5: 60, // already master
};

const XP_FOR_LEVEL: Record<number, number> = {
  0: 0,
  1: 1,
  2: 5,
  3: 15,
  4: 30,
  5: 60,
};

function FocusAreaBar({ area }: FocusAreaBarProps) {
  const colorClass = LEVEL_COLORS[area.level] ?? LEVEL_COLORS[1];

  const levelStart = XP_FOR_LEVEL[area.level] ?? 0;
  const levelEnd = XP_FOR_NEXT_LEVEL[area.level] ?? 60;
  const progressPct =
    area.level >= 5
      ? 100
      : Math.min(100, ((area.xp - levelStart) / (levelEnd - levelStart)) * 100);

  // Extract just the text color class for the progress bar
  const barColorClass = colorClass.includes("amber")
    ? "bg-amber-500"
    : colorClass.includes("purple")
      ? "bg-purple-500"
      : colorClass.includes("blue")
        ? "bg-blue-500"
        : colorClass.includes("emerald")
          ? "bg-emerald-500"
          : "bg-muted-foreground";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs">
          <span>{area.icon}</span>
          <span className="font-medium">{area.label}</span>
          {area.levelLabel && (
            <span className={`rounded px-1 text-[10px] font-semibold ${colorClass} border`}>
              {area.levelLabel}
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground font-mono">{area.xp} XP</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${barColorClass}`}
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );
}
