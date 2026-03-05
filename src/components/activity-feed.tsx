"use client";

import { useMemo, useState } from "react";
import type { ContributorProfile } from "@/lib/contributor-types";
import { formatRelativeTime } from "@/lib/utils";

interface ActivityFeedProps {
  contributors: ContributorProfile[];
}

const EVENT_ICONS: Record<string, string> = {
  approve: "✅",
  reject: "❌",
  close: "⛔",
  selfClose: "↩️",
};

export function ActivityFeed({ contributors }: ActivityFeedProps) {
  const [open, setOpen] = useState(true);

  const events = useMemo(() => {
    return contributors
      .flatMap((contributor) =>
        contributor.events.map((event) => ({
          ...event,
          username: contributor.username,
          avatar: `https://github.com/${contributor.username}.png`,
        })),
      )
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 15);
  }, [contributors]);

  return (
    <section className="rounded-lg border border-border bg-card overflow-hidden">
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
                  <span className="text-muted-foreground"> · PR #{event.prNumber} · {event.type}</span>
                </div>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">{formatRelativeTime(event.timestamp)}</span>
            </div>
          ))}
          {events.length === 0 && <div className="px-4 py-6 text-sm text-muted-foreground">No recent events.</div>}
        </div>
      )}
    </section>
  );
}
