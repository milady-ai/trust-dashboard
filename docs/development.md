# Development

## Prereqs

- Bun (recommended)

## Install

```bash
bun install --frozen-lockfile
```

## Run Locally

```bash
bun run dev
```

This project uses `basePath = /trust-dashboard` (see `next.config.ts`), so the local URL is:

- `http://localhost:3000/trust-dashboard`

## Checks

```bash
bun run check
```

`check` runs:

- `tsc --noEmit`
- `next lint`
- scoring parity check (`bun run verify:scoring`)

