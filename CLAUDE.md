# CLAUDE.md

Context for Claude Code working in this repo. Human-facing setup lives in `README.md`.

## What this is

A personal briefing agent. Runs on a GitHub Actions cron, pulls from external
sources (Gmail today; Outlook, Teams, Asana later), summarizes via the Anthropic
API, stores results in Neon Postgres. A separate Next.js dashboard (not yet
built) reads from the same DB.

## Stack

- TypeScript, Node 20+, ESM (`"type": "module"` is implicit via `tsx`)
- pnpm for package management
- Drizzle ORM + Neon serverless Postgres driver
- `@anthropic-ai/sdk` for summarization
- `googleapis` for Gmail
- GitHub Actions for scheduling

## Repo layout

```
src/
  db/              Drizzle schema, client, cursor helpers, migration runner
  sources/         One folder per external source. Each implements `Source`.
    types.ts       The Source interface — read this before adding a connector
    gmail/         Reference implementation
  summarize/       Claude API wrapper. Per-source system prompts live here.
  index.ts         Runner. Iterates sources, fetches, stores, summarizes.
.github/workflows/ Cron schedule
drizzle/           Generated migrations (committed)
```

## Architectural rules

These are load-bearing. Don't violate them without flagging it.

1. **The `Source` interface is the contract.** A source returns normalized items
   plus a new cursor. The runner handles all DB writes and summarization. Sources
   don't touch the DB directly and don't call Claude.

2. **Cursor saved last.** In the runner, the cursor for a source is persisted
   _after_ raw_items are inserted and the briefing is written. If a step fails
   mid-run, we re-fetch on next run rather than skipping data. Keep this order.

3. **`raw_items` is dedupe-keyed on `(source, account, external_id)`.** Inserts
   use `ON CONFLICT DO NOTHING`. This means re-runs are always safe — never add
   logic that assumes "if I'm fetching this, it must be new."

4. **First run vs. incremental run is per-source.** Every source must handle
   the no-cursor case by pulling a sensible recent window (e.g. last 24h), not
   by dumping full history. Otherwise the first run summarizes thousands of
   items and burns tokens.

5. **Briefings are write-once.** The runner only writes a briefing when there
   are genuinely new items (post-dedupe). Empty briefings are not stored —
   the dashboard handles "no new items" by falling back to the last briefing
   plus a stale indicator.

## Adding a new source

1. Create `src/sources/<name>/index.ts` exporting a `Source`.
2. Define a cursor type. Pick whatever the source's API gives you for
   incremental sync — delta link, opaque token, timestamp, history id. Don't
   invent your own; use the API's native primitive.
3. Handle the no-cursor case: pull a 24h window, not everything.
4. Normalize each item to `Omit<NewRawItem, 'source' | 'account'>`. Required:
   `externalId`, `kind`, `occurredAt`, `payload`. Strongly preferred: `title`,
   `snippet`, `url`.
5. Add a system prompt to `src/summarize/index.ts`. Keep prompts terse and
   action-oriented; this is for a morning briefing, not an essay.
6. Register the source in `ALL_SOURCES` in `src/index.ts`.
7. Add env vars to `.env.example` and `.github/workflows/briefing.yml`.
8. If the source needs OAuth, add a `src/sources/<name>/auth.ts` script
   modeled on `gmail/auth.ts` and a `pnpm auth:<name>` script in `package.json`.

## Conventions

- **Imports use `.js` extensions** even when importing `.ts` files. Required
  for ESM + `tsx`. Don't strip them.
- **Path aliases:** `@/*` maps to `src/*` per `tsconfig.json`. Use sparingly —
  most cross-module imports are one level deep and relative reads fine.
- **Error handling in the runner:** one source/account failure must not kill
  the whole run. Wrap in try/catch, log, continue. See `runSource`.
- **No console.log in source modules.** The runner does the logging. Sources
  return data; if they need to warn (e.g. Gmail history expired), use
  `console.warn` and document why.
- **Don't add a logger framework.** `console.log` is fine for a cron job
  that runs hourly. Pino/winston is overkill.

## Gotchas

- **Gmail History API expires after ~7 days.** If a `historyId` is too old,
  the API returns 404. The Gmail source catches this and falls back to a 24h
  window. Don't remove that fallback.
- **Refresh tokens for Google require `prompt: 'consent'`** on first auth,
  otherwise Google won't return one if the user has previously authorized the
  app. The auth script handles this.
- **Neon's HTTP driver is used, not the WebSocket one.** GitHub Actions runs
  short-lived; HTTP avoids connection-pool weirdness. If you switch to
  long-running compute (a VPS), reconsider.
- **`drizzle-kit` reads `.env` via `dotenv/config` import.** That's why
  `drizzle.config.ts` imports it explicitly. Don't remove that import.
- **Anthropic model string** — current is `claude-sonnet-4-5-20250929` in
  `summarize/index.ts`. If a newer model exists, update it there only; nothing
  else hardcodes a model.

## What's intentionally NOT here

- **No tests.** Single-developer hobby project, sources are mostly thin API
  adapters, and the surface area changes weekly. Add tests if a specific bug
  warrants regression coverage; don't add them prophylactically.
- **No retries on API failures.** GitHub Actions runs hourly — if Gmail is
  down for one run, we just pick up next hour. Don't add exponential backoff
  unless a real failure mode demands it.
- **No rate-limiting logic.** Personal use, well under any provider's limits.
- **No dashboard yet.** The plan is a separate Next.js app in `dashboard/`
  that reads from the same Neon DB. Don't build it speculatively — wait for
  real briefings to land first.

## Common tasks

- Run agent locally: `npm run agent` (all sources) or `npm run agent:gmail` (one)
- Inspect DB: `npm run db:studio`
- After schema change: `npm run db:generate && npm run db:migrate`
- Mint Gmail token: `npm run auth:gmail` (one Google account at a time)

## When in doubt

- Read `src/sources/types.ts` and `src/sources/gmail/index.ts`. They're the
  reference for how a source should be shaped.
- Read `src/index.ts` to see how the pieces fit together end-to-end.
- The README is for the human; if you need setup steps (Neon, Google Cloud),
  read that.
