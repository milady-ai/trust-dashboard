"use client";

import { useMemo, useState } from "react";
import { TierBadge } from "@/components/tier-badge";
import { TIERS, getTierForScore } from "@/lib/trust-scoring";

type EventType = "approve" | "reject" | "close" | "selfClose";
type ReviewSeverity = "critical" | "major" | "normal" | "minor" | "trivial";
type LabelType =
  | "security"
  | "critical-fix"
  | "core"
  | "feature"
  | "bugfix"
  | "refactor"
  | "test"
  | "docs"
  | "chore"
  | "aesthetic";

interface SimEvent {
  id: string;
  type: EventType;
  linesChanged: number;
  labels: LabelType[];
  reviewSeverity: ReviewSeverity;
  daysAgo: number;
  timestamp: number;
}

interface EventComputation {
  eventId: string;
  points: number;
  baseRaw: number;
  afterDiminishing: number;
  afterRecency: number;
  afterStreak: number;
  dailyCapLoss: number;
}

interface ScoreBreakdown {
  baseRawPoints: number;
  afterDiminishing: number;
  diminishingDropPercent: number;
  recencyImpact: number;
  recencyDelta: number;
  streakNetPercent: number;
  streakDelta: number;
  velocityPenaltyPercent: number;
  velocityPRsThisWeek: number;
  velocityLoss: number;
  dailyCapLoss: number;
  inactivityDecay: number;
  totalDelta: number;
  eventResults: EventComputation[];
}

const BASE_POINTS: Record<EventType, number> = {
  approve: 12,
  reject: -6,
  close: -10,
  selfClose: -2,
};

const CATEGORY_WEIGHTS: Record<LabelType, number> = {
  security: 1.8,
  "critical-fix": 1.5,
  core: 1.3,
  feature: 1.1,
  bugfix: 1.0,
  refactor: 0.9,
  test: 0.8,
  docs: 0.6,
  chore: 0.5,
  aesthetic: 0.4,
};

const SEVERITY_WEIGHTS: Record<ReviewSeverity, number> = {
  critical: 1.8,
  major: 1.3,
  normal: 1.0,
  minor: 0.5,
  trivial: 0.3,
};

const ALL_LABELS: LabelType[] = [
  "security",
  "critical-fix",
  "core",
  "feature",
  "bugfix",
  "refactor",
  "test",
  "docs",
  "chore",
  "aesthetic",
];

function getComplexityMultiplier(linesChanged: number): number {
  if (linesChanged <= 10) return 0.4;
  if (linesChanged <= 50) return 0.7;
  if (linesChanged <= 150) return 1.0;
  if (linesChanged <= 500) return 1.3;
  if (linesChanged <= 1500) return 1.5;
  return 1.2;
}

function getCategoryMultiplier(labels: LabelType[]): number {
  if (labels.length === 0) return 1;
  return labels.reduce((maxWeight, label) => Math.max(maxWeight, CATEGORY_WEIGHTS[label]), 1);
}

function round(value: number, places = 2): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function computeTrustScore(events: SimEvent[], now = Date.now()): { score: number; breakdown: ScoreBreakdown } {
  const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);

  let approvalCount = 0;
  let approvalStreak = 0;
  let rejectionStreak = 0;

  let baseRawPoints = 0;
  let afterDiminishing = 0;
  let afterRecency = 0;
  let afterStreak = 0;
  let dailyCapLoss = 0;

  const dailyPositiveTotals = new Map<string, number>();
  const eventResults: EventComputation[] = [];

  for (const event of sortedEvents) {
    const base = BASE_POINTS[event.type];
    const complexityMultiplier = getComplexityMultiplier(event.linesChanged);
    const categoryMultiplier = getCategoryMultiplier(event.labels);

    const daysSinceEvent = Math.max(0, (now - event.timestamp) / (1000 * 60 * 60 * 24));
    const recencyWeight = 0.5 ** (daysSinceEvent / 45);

    const severityMultiplier = event.type === "reject" ? SEVERITY_WEIGHTS[event.reviewSeverity] : 1;

    const baseRaw = base * complexityMultiplier * categoryMultiplier * severityMultiplier;

    const diminishingMultiplier =
      event.type === "approve"
        ? 1 / (1 + 0.2 * Math.log(1 + approvalCount))
        : 1;

    if (event.type === "approve") {
      approvalCount += 1;
      approvalStreak += 1;
      rejectionStreak = 0;
    } else if (event.type === "reject") {
      rejectionStreak += 1;
      approvalStreak = 0;
    } else {
      approvalStreak = 0;
      rejectionStreak = 0;
    }

    const approvalBonus = Math.min(Math.max(approvalStreak - 1, 0) * 0.08, 0.5);
    const rejectionPenalty = Math.min(1 + Math.max(rejectionStreak - 1, 0) * 0.15, 2.5);
    const streakMultiplier = event.type === "approve" ? 1 + approvalBonus : event.type === "reject" ? rejectionPenalty : 1;

    const diminished = baseRaw * diminishingMultiplier;
    const recencyAdjusted = diminished * recencyWeight;
    const streakAdjusted = recencyAdjusted * streakMultiplier;

    let finalPoints = streakAdjusted;
    let capLoss = 0;

    if (finalPoints > 0) {
      const dayKey = new Date(event.timestamp).toISOString().slice(0, 10);
      const currentDay = dailyPositiveTotals.get(dayKey) ?? 0;
      const remaining = Math.max(0, 35 - currentDay);
      const capped = Math.min(finalPoints, remaining);
      capLoss = finalPoints - capped;
      finalPoints = capped;
      dailyPositiveTotals.set(dayKey, currentDay + capped);
    }

    baseRawPoints += baseRaw;
    afterDiminishing += diminished;
    afterRecency += recencyAdjusted;
    afterStreak += streakAdjusted;
    dailyCapLoss += capLoss;

    eventResults.push({
      eventId: event.id,
      points: round(finalPoints),
      baseRaw: round(baseRaw),
      afterDiminishing: round(diminished),
      afterRecency: round(recencyAdjusted),
      afterStreak: round(streakAdjusted),
      dailyCapLoss: round(capLoss),
    });
  }

  const prsThisWeek = sortedEvents.filter((event) => now - event.timestamp <= 7 * 24 * 60 * 60 * 1000).length;

  let velocityMultiplier = 1;
  if (prsThisWeek > 25) {
    velocityMultiplier = 0;
  } else if (prsThisWeek > 10) {
    velocityMultiplier = Math.max(0, 1 - (prsThisWeek - 10) * 0.15);
  }

  const afterDailyCap = afterStreak - dailyCapLoss;
  const velocityAdjusted = afterDailyCap > 0 ? afterDailyCap * velocityMultiplier : afterDailyCap;
  const velocityLoss = afterDailyCap > 0 ? afterDailyCap - velocityAdjusted : 0;

  let score = 35 + velocityAdjusted;

  const newest = sortedEvents.at(-1);
  let inactivityDecay = 0;

  if (newest) {
    const daysSinceLastEvent = Math.max(0, (now - newest.timestamp) / (1000 * 60 * 60 * 24));
    if (daysSinceLastEvent > 10 && score > 40) {
      const decayDays = daysSinceLastEvent - 10;
      const decayRate = decayDays * 0.005;
      const maxDecay = score - Math.max(40, 30);
      inactivityDecay = Math.min(maxDecay, (score - 40) * decayRate);
      score -= inactivityDecay;
    }
  }

  score = Math.max(0, Math.min(100, score));

  const diminishingDropPercent =
    baseRawPoints !== 0 ? ((baseRawPoints - afterDiminishing) / Math.abs(baseRawPoints)) * 100 : 0;
  const recencyDelta = afterRecency - afterDiminishing;
  const streakDelta = afterStreak - afterRecency;

  const breakdown: ScoreBreakdown = {
    baseRawPoints: round(baseRawPoints),
    afterDiminishing: round(afterDiminishing),
    diminishingDropPercent: round(diminishingDropPercent),
    recencyImpact: round(afterRecency),
    recencyDelta: round(recencyDelta),
    streakNetPercent: afterRecency !== 0 ? round((streakDelta / Math.abs(afterRecency)) * 100) : 0,
    streakDelta: round(streakDelta),
    velocityPenaltyPercent: round((1 - velocityMultiplier) * 100),
    velocityPRsThisWeek: prsThisWeek,
    velocityLoss: round(velocityLoss),
    dailyCapLoss: round(dailyCapLoss),
    inactivityDecay: round(inactivityDecay),
    totalDelta: round(velocityAdjusted - inactivityDecay),
    eventResults,
  };

  return {
    score: round(score),
    breakdown,
  };
}

function buildPreset(name: string): SimEvent[] {
  const now = Date.now();
  const make = (
    idx: number,
    type: EventType,
    daysAgo: number,
    linesChanged: number,
    labels: LabelType[],
    reviewSeverity: ReviewSeverity = "normal",
  ): SimEvent => ({
    id: `${name}-${idx}`,
    type,
    daysAgo,
    linesChanged,
    labels,
    reviewSeverity,
    timestamp: now - daysAgo * 24 * 60 * 60 * 1000,
  });

  switch (name) {
    case "Speed Demon":
      return Array.from({ length: 8 }, (_, i) =>
        make(i + 1, "approve", i % 3, 8, ["chore"]),
      );
    case "Security Hero":
      return [
        make(1, "approve", 58, 220, ["security", "core"]),
        make(2, "approve", 33, 180, ["security"]),
        make(3, "approve", 8, 320, ["security", "critical-fix"]),
      ];
    case "Steady Contributor":
      return [15, 10, 8, 30, 20, 50, 45, 60, 80, 90].map((days, i) =>
        make(i + 1, "approve", days, 35 + i * 55, i < 4 ? ["docs"] : ["bugfix", "core"]),
      );
    case "Rough Start":
      return [
        make(1, "reject", 40, 180, ["core"], "major"),
        make(2, "reject", 34, 140, ["feature"], "normal"),
        make(3, "reject", 28, 110, ["bugfix"], "minor"),
        make(4, "approve", 20, 90, ["bugfix"]),
        make(5, "approve", 16, 130, ["core"]),
        make(6, "approve", 12, 160, ["feature"]),
        make(7, "approve", 8, 210, ["core", "critical-fix"]),
        make(8, "approve", 2, 260, ["core"]),
      ];
    case "Typo Farmer":
      return Array.from({ length: 15 }, (_, i) =>
        make(i + 1, "approve", i * 2, 6, ["docs"]),
      );
    case "Gone Ghost":
      return [
        make(1, "approve", 185, 120, ["bugfix"]),
        make(2, "approve", 176, 140, ["feature"]),
        make(3, "approve", 170, 90, ["docs"]),
        make(4, "approve", 160, 210, ["core"]),
        make(5, "approve", 154, 320, ["core"]),
        make(6, "approve", 147, 180, ["bugfix"]),
        make(7, "approve", 138, 260, ["critical-fix"]),
        make(8, "approve", 122, 300, ["feature"]),
      ];
    default:
      return [];
  }
}

export default function SimulatorPage() {
  const [events, setEvents] = useState<SimEvent[]>([]);
  const [type, setType] = useState<EventType>("approve");
  const [linesChanged, setLinesChanged] = useState(100);
  const [labels, setLabels] = useState<LabelType[]>(["bugfix"]);
  const [reviewSeverity, setReviewSeverity] = useState<ReviewSeverity>("normal");
  const [daysAgo, setDaysAgo] = useState(0);

  const scoreResult = useMemo(() => computeTrustScore(events), [events]);
  const tier = getTierForScore(scoreResult.score);
  const pointsByEvent = useMemo(
    () => new Map(scoreResult.breakdown.eventResults.map((item) => [item.eventId, item.points])),
    [scoreResult.breakdown.eventResults],
  );

  function addEvent() {
    const event: SimEvent = {
      id: crypto.randomUUID(),
      type,
      linesChanged: Math.max(0, linesChanged),
      labels,
      reviewSeverity,
      daysAgo: Math.max(0, daysAgo),
      timestamp: Date.now() - Math.max(0, daysAgo) * 24 * 60 * 60 * 1000,
    };
    setEvents((prev) => [...prev, event].sort((a, b) => a.timestamp - b.timestamp));
  }

  function toggleLabel(label: LabelType) {
    setLabels((prev) =>
      prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label],
    );
  }

  const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-1">Trust Scoring Simulator</h2>
        <p className="text-sm text-muted-foreground">
          Build synthetic event histories and see score, tier, and anti-gaming modifiers update in real time.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="space-y-4 lg:col-span-3">
          <div className="rounded-lg border border-border bg-card p-4 space-y-4">
            <h3 className="text-lg font-semibold">Event Builder</h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Event type</span>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as EventType)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2"
                >
                  <option value="approve">approve</option>
                  <option value="reject">reject</option>
                  <option value="close">close</option>
                  <option value="selfClose">selfClose</option>
                </select>
              </label>

              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Lines changed</span>
                <input
                  type="number"
                  min={0}
                  value={linesChanged}
                  onChange={(e) => setLinesChanged(Number(e.target.value) || 0)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2"
                />
              </label>

              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Days ago</span>
                <input
                  type="number"
                  min={0}
                  value={daysAgo}
                  onChange={(e) => setDaysAgo(Number(e.target.value) || 0)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2"
                />
              </label>

              {type === "reject" && (
                <label className="space-y-1 text-sm">
                  <span className="text-muted-foreground">Review severity</span>
                  <select
                    value={reviewSeverity}
                    onChange={(e) => setReviewSeverity(e.target.value as ReviewSeverity)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2"
                  >
                    <option value="critical">critical</option>
                    <option value="major">major</option>
                    <option value="normal">normal</option>
                    <option value="minor">minor</option>
                    <option value="trivial">trivial</option>
                  </select>
                </label>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Labels</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {ALL_LABELS.map((label) => (
                  <label key={label} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={labels.includes(label)}
                      onChange={() => toggleLabel(label)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              onClick={addEvent}
              className="rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:opacity-90"
            >
              Add Event
            </button>
          </div>

          <div className="rounded-lg border border-border bg-card p-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2 justify-between">
              <h3 className="text-lg font-semibold">Presets</h3>
              <button
                onClick={() => setEvents([])}
                className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear All
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                "Speed Demon",
                "Security Hero",
                "Steady Contributor",
                "Rough Start",
                "Typo Farmer",
                "Gone Ghost",
              ].map((preset) => (
                <button
                  key={preset}
                  onClick={() => setEvents(buildPreset(preset))}
                  className="rounded-full border border-border px-3 py-1 text-xs hover:border-accent hover:text-accent"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <h3 className="text-lg font-semibold">Event History</h3>
            {sortedEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events yet.</p>
            ) : (
              <ul className="space-y-2">
                {sortedEvents.map((event) => (
                  <li
                    key={event.id}
                    className="rounded-md border border-border bg-muted/30 p-3 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="text-sm space-y-0.5">
                      <p className="font-mono">
                        {event.type} · {event.linesChanged} LOC · {event.daysAgo}d ago
                      </p>
                      <p className="text-muted-foreground text-xs">
                        labels: {event.labels.length ? event.labels.join(", ") : "none"}
                        {event.type === "reject" ? ` · severity: ${event.reviewSeverity}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm">
                        {pointsByEvent.get(event.id)?.toFixed(2) ?? "0.00"} pts
                      </span>
                      <button
                        onClick={() => setEvents((prev) => prev.filter((item) => item.id !== event.id))}
                        className="text-xs text-tier-restricted hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="space-y-4 lg:col-span-2">
          <div className="rounded-lg border border-border bg-card p-4 space-y-4">
            <h3 className="text-lg font-semibold">Live Score</h3>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-4xl font-bold font-mono">{scoreResult.score.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Range 0-100 · starts at 35</p>
              </div>
              <TierBadge tier={tier} />
            </div>

            <div className="space-y-2">
              <div className="h-3 rounded-full overflow-hidden flex">
                {TIERS.map((tierConfig, index) => {
                  const nextMin = index === 0 ? 100 : TIERS[index - 1].minScore;
                  const width = ((nextMin - tierConfig.minScore) / 100) * 100;
                  return (
                    <div
                      key={tierConfig.label}
                      style={{ width: `${width}%`, backgroundColor: tierConfig.color, opacity: 0.25 }}
                      title={`${tierConfig.label}: ${tierConfig.minScore}-${nextMin}`}
                    />
                  );
                })}
              </div>
              <div className="h-3 rounded-full bg-muted -mt-3 overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-300"
                  style={{ width: `${Math.max(0, Math.min(100, scoreResult.score))}%` }}
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4 space-y-2 text-sm">
            <h3 className="text-lg font-semibold mb-2">Breakdown</h3>
            <p>Base raw points: <span className="font-mono">{scoreResult.breakdown.baseRawPoints.toFixed(2)}</span></p>
            <p>
              After diminishing returns: <span className="font-mono">{scoreResult.breakdown.afterDiminishing.toFixed(2)}</span>
              <span className="text-muted-foreground"> ({scoreResult.breakdown.diminishingDropPercent.toFixed(2)}%)</span>
            </p>
            <p>
              Recency impact: <span className="font-mono">{scoreResult.breakdown.recencyImpact.toFixed(2)}</span>
              <span className="text-muted-foreground"> ({scoreResult.breakdown.recencyDelta >= 0 ? "+" : ""}{scoreResult.breakdown.recencyDelta.toFixed(2)})</span>
            </p>
            <p>
              Streak: <span className="font-mono">{scoreResult.breakdown.streakNetPercent >= 0 ? "+" : ""}{scoreResult.breakdown.streakNetPercent.toFixed(2)}%</span>
              <span className="text-muted-foreground"> ({scoreResult.breakdown.streakDelta >= 0 ? "+" : ""}{scoreResult.breakdown.streakDelta.toFixed(2)})</span>
            </p>
            <p>
              Velocity: <span className="font-mono">-{scoreResult.breakdown.velocityPenaltyPercent.toFixed(2)}%</span>
              <span className="text-muted-foreground"> ({scoreResult.breakdown.velocityPRsThisWeek} PRs this week)</span>
            </p>
            <p>
              Daily cap: <span className="font-mono">-{scoreResult.breakdown.dailyCapLoss.toFixed(2)}</span>
            </p>
            <p>
              Inactivity decay: <span className="font-mono">-{scoreResult.breakdown.inactivityDecay.toFixed(2)}</span>
            </p>
            <hr className="border-border my-2" />
            <p className="font-medium">
              Net score delta: <span className="font-mono">{scoreResult.breakdown.totalDelta >= 0 ? "+" : ""}{scoreResult.breakdown.totalDelta.toFixed(2)}</span>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
