import Link from "next/link";
import { loadProject } from "@/lib/data-loader";
import { generateOnChainExport } from "@/lib/eliza-effect";
import { getTierColor, getTierBgColor } from "@/lib/hierarchy";

const CHAINS = ["Ethereum", "Solana", "Base", "Arbitrum"] as const;

export default function ExportPage() {
  const project = loadProject();
  const onChainExport = generateOnChainExport(project, "ethereum");

  const totalSqrt = onChainExport.recipients.reduce(
    (sum, r) => sum + Math.sqrt(Math.max(0, r.elizaEffect)),
    0,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-accent mb-4"
        >
          &larr; Back to Leaderboard
        </Link>
        <h2 className="text-2xl font-bold mb-1">
          <span className="brand-gradient">eliza</span>Pay Distribution Export
        </h2>
        <p className="text-sm text-muted-foreground">
          Quadratic distribution derived from elizaEffect scores for creator
          token rewards. Each contributor&apos;s share is proportional to the
          square root of their score, reducing whale dominance and rewarding
          broader participation.
        </p>
      </div>

      {/* Chain Target Selector */}
      <section className="rounded-lg border border-border bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">
          Chain Target
        </h3>
        <div className="flex flex-wrap gap-2">
          {CHAINS.map((chain) => (
            <span
              key={chain}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                chain === "Ethereum"
                  ? "border-eliza-gold/30 bg-eliza-gold/10 text-eliza-gold"
                  : "border-border bg-muted text-muted-foreground"
              }`}
            >
              {chain}
            </span>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Currently showing distribution for{" "}
          <span className="text-eliza-gold font-mono">
            {onChainExport.chainTarget}
          </span>
          . Project:{" "}
          <span className="text-foreground">{onChainExport.projectName}</span>{" "}
          &middot; Generated:{" "}
          <span className="font-mono">
            {new Date(onChainExport.generatedAt).toLocaleDateString()}
          </span>
        </p>
      </section>

      {/* Distribution Table */}
      <section className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">
            Full Distribution Table
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {onChainExport.recipients.length} recipients &middot; sorted by
            elizaPay share descending
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Rank</th>
                <th className="px-4 py-2 font-medium">Username</th>
                <th className="px-4 py-2 font-medium">Tier</th>
                <th className="px-4 py-2 font-medium text-right">
                  elizaEffect Score
                </th>
                <th className="px-4 py-2 font-medium text-right">Share %</th>
                <th className="px-4 py-2 font-medium text-right">
                  sqrt(score)
                </th>
              </tr>
            </thead>
            <tbody>
              {onChainExport.recipients
                .sort((a, b) => b.sharePercent - a.sharePercent)
                .map((recipient, idx) => {
                  const tierColor = getTierColor(recipient.tier);
                  const tierBgColor = getTierBgColor(recipient.tier);
                  const sqrtScore =
                    Math.round(
                      Math.sqrt(Math.max(0, recipient.elizaEffect)) * 1000,
                    ) / 1000;

                  return (
                    <tr
                      key={recipient.username}
                      className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors"
                    >
                      <td className="px-4 py-2 font-mono text-muted-foreground">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-2">
                        <Link
                          href={`/contributor/${recipient.username}`}
                          className="text-accent hover:underline"
                        >
                          {recipient.username}
                        </Link>
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-block rounded border px-2 py-0.5 text-xs capitalize ${tierColor} ${tierBgColor}`}
                        >
                          {recipient.tier}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-foreground">
                        {recipient.elizaEffect.toFixed(1)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-eliza-gold">
                        {recipient.sharePercent.toFixed(2)}%
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-muted-foreground">
                        {sqrtScore.toFixed(3)}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-muted text-xs text-muted-foreground">
                <td className="px-4 py-2" colSpan={3}>
                  Totals
                </td>
                <td className="px-4 py-2 text-right font-mono">
                  {onChainExport.recipients
                    .reduce((sum, r) => sum + r.elizaEffect, 0)
                    .toFixed(1)}
                </td>
                <td className="px-4 py-2 text-right font-mono text-eliza-gold">
                  100.00%
                </td>
                <td className="px-4 py-2 text-right font-mono">
                  {totalSqrt.toFixed(3)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* API Endpoint Info */}
      <section className="rounded-lg border border-border bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">
          API Endpoint
        </h3>
        <p className="text-sm text-muted-foreground">
          The distribution data is available as JSON via{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-eliza-purple">
            /api/export
          </code>
          . Returns all recipients with elizaEffect scores, share percentages,
          tiers, and ranks.
        </p>
        <div className="rounded-md border border-border bg-background p-3">
          <code className="block font-mono text-sm text-eliza-blue break-all">
            GET /api/export
          </code>
        </div>
        <div className="text-xs text-muted-foreground">
          <p>
            Returns: <span className="font-mono text-eliza-green">chainTarget</span>,{" "}
            <span className="font-mono text-eliza-green">recipients[]</span>,{" "}
            <span className="font-mono text-eliza-green">availableChains</span>,{" "}
            <span className="font-mono text-eliza-green">generatedAt</span>
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center text-xs text-muted-foreground py-4">
        elizaPay quadratic distribution &middot; powered by elizaEffect scoring
      </footer>
    </div>
  );
}
