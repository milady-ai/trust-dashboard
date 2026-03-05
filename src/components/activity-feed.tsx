"use client";

import { useMemo, useState } from "react";
import type { Contributor } from "@/lib/types";
import { formatRelativeTime } from "@/lib/utils";

interface ActivityFeedProps {
  contributors: Contributor[];
}

const EVENT_ICONS: Record<string, string> = {
  pr_merged: "✅",
  pr_rejected: "❌",
  pr_closed: "⛔",
  review_given: "👁️",
  issue_closed: "🔧",
};

export function ActivityFeed({ contributors }: ActivityFeedProps) {
  const [open, setOpen] = useState(true);

  const events = useMemo(() => {
    return contributors
      .flatMap((c) =>
        c.githubEvents.map((event) => ({
          ...event,
          username: c.username,
          avatar: c.avatarUrl,
        })),
      )
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 15);
  }, [contributors]);

  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        <span className="font-semibold text-sm">Recent Activity ({events.length})</span>
        <span className="text-xs text-muted-foreground">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <div className="divide-y divide-border">
          {events.map((event, idx) => (
            <div key={`${event.username}-${idx}`} className="px-4 py-3 flex items-center gap-3 text-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={event.avatar} alt={event.username} className="h-8 w-8 rounded-full bg-muted" loading="lazy" />
              <span className="text-base">{EVENT_ICONS[event.type] ?? "·"}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate">
                  <span className="font-medium">{event.username}</span>
                  <span className="text-muted-foreground">
                    {" "}· {event.prNumber ? `PR #${event.prNumber}` : event.issueNumber ? `Issue #${event.issueNumber}` : ""} · {event.type.replace("_", " ")}
                  </span>
                </div>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">{formatRelativeTime(event.timestamp)}</span>
            </div>
          ))}
          {events.length === 0 && <div className="px-4 py-6 text-sm text-muted-foreground text-center">No recent events.</div>}
        </div>
      )}
    </section>
  );
}
