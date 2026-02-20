# Data Pipeline

## Where the Data Lives

The dashboard reads a precomputed dataset:

- `src/data/trust-scores.json`

This file is committed and updated by automation.

## Generator

The generator script:

- `scripts/generate-scores.ts`

High-level flow:

1. Fetch closed PRs from GitHub via REST API
2. Map each PR to a trust event (`approve`, `reject`, `close`, `selfClose`)
3. Build per-contributor histories
4. Compute trust scores with `src/lib/scoring-engine.ts`
5. Write `src/data/trust-scores.json`

GitHub mapping logic:

- `src/lib/github-data.ts`

Scoring engine:

- `src/lib/scoring-engine.ts`

## Automation

Scores are updated by GitHub Actions:

- `.github/workflows/update-scores.yml`

This workflow runs on:

- schedule (every 30 minutes)
- `workflow_dispatch`
- pushes to `main`

It commits `src/data/trust-scores.json` when the output changes.

## Token Requirements

The script makes many GitHub API calls (PR detail + reviews), so you should set:

```bash
export GITHUB_TOKEN="..."
```

Without a token, you will hit rate limits quickly.

