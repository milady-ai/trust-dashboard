import { MOCK_CONTRIBUTORS } from "@/lib/mock-data";
import { Leaderboard } from "@/components/leaderboard";
import { StatsBar } from "@/components/stats-bar";

export default function HomePage() {
  const contributors = MOCK_CONTRIBUTORS;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-1">Contributor Leaderboard</h2>
        <p className="text-sm text-muted-foreground">
          Trust scores for milady-ai/milaidy contributors. Score range 0-100, earned through consistent quality contributions.
        </p>
      </div>

      <StatsBar contributors={contributors} />
      <Leaderboard contributors={contributors} />

      <div className="text-center text-xs text-muted-foreground py-4">
        Powered by{" "}
        <a
          href="https://github.com/milady-ai/milaidy/blob/main/.github/trust-scoring.js"
          className="text-accent hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          trust-scoring.js
        </a>
        {" "}— 8 anti-gaming mechanisms, 7 trust tiers, bounded 0-100
      </div>
    </div>
  );
}
