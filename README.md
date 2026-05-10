# briefing-agent

Personal morning-briefing agent. Pulls from Gmail (and later Outlook, Teams, Asana),
summarizes via Claude, stores in Postgres, and renders to a dashboard.

## Architecture

```
GitHub Actions (hourly cron)
    │
    ├─ for each Source (gmail, outlook, teams, asana)
    │     ├─ read cursor from Postgres
    │     ├─ fetch new items from API
    │     ├─ insert into raw_items
    │     ├─ summarize new items via Claude → briefings
    │     └─ write new cursor
    │
    └─ Neon Postgres ─── Next.js dashboard reads `briefings`
```

Two key design choices:

1. **Cursors stored in DB, not files.** GitHub Actions runners are ephemeral, so
   "last run" state has to live somewhere durable. Postgres also gives the
   dashboard one place to read from.
2. **Raw items + summary are separate tables.** Lets us re-summarize without
   re-fetching, and the dashboard can drill from a summary into the underlying
   items.

## Phase 1 status (current)

- [x] DB schema (cursors, raw_items, briefings)
- [x] Source interface
- [x] Gmail source (incremental via History API)
- [x] Summarization wrapper (Claude Sonnet)
- [x] Runner + GitHub Actions workflow
- [ ] Dashboard (Next.js) — next up after Gmail is verified working
- [ ] Outlook source (Phase 3)
- [ ] Teams source (Phase 4)
- [ ] Asana source (Phase 5)

## Setup

### 1. Install

```bash
pnpm install
cp .env.example .env
```

### 2. Neon database

1. Create a project at <https://neon.tech>
2. Copy the **pooled** connection string into `DATABASE_URL`
3. Generate and apply migrations:

   ```bash
   pnpm db:generate
   pnpm db:migrate
   ```

### 3. Anthropic API key

From <https://console.anthropic.com/> → API Keys. Add to `.env` as `ANTHROPIC_API_KEY`.

### 4. Gmail OAuth (per account)

1. <https://console.cloud.google.com/> → New Project
2. APIs & Services → Library → enable **Gmail API**
3. APIs & Services → OAuth consent screen → External; add yourself as a test user
4. Credentials → Create Credentials → OAuth client ID → **Desktop app**
5. Copy client ID + secret into `.env` as `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET`
6. Set `GMAIL_ACCOUNTS=personal,work` (or whatever labels you want)
7. For each account, run:

   ```bash
   pnpm auth:gmail
   ```

   Follow the prompt. It prints a refresh token. Paste it into `.env` as
   `GMAIL_REFRESH_TOKEN_PERSONAL` (or whatever the account label is, uppercased).

   Sign in with a different Google account each time you run it.

### 5. Try it locally

```bash
pnpm agent:gmail
```

Expected on first run: pulls last 24h of inbox, inserts raw_items, writes one
briefing per account. Check `db:studio` to inspect.

### 6. Deploy to GitHub Actions

In your repo settings:

- **Variables** (Settings → Secrets and variables → Actions → Variables):
  - `GMAIL_ACCOUNTS` = `personal,work`
- **Secrets** (same page, Secrets tab):
  - `DATABASE_URL`
  - `ANTHROPIC_API_KEY`
  - `GMAIL_CLIENT_ID`
  - `GMAIL_CLIENT_SECRET`
  - `GMAIL_REFRESH_TOKEN_PERSONAL`
  - `GMAIL_REFRESH_TOKEN_WORK`

Push to main. The workflow runs hourly. Trigger manually from the Actions tab to
verify before waiting for the cron.

## What to do next

Once you've seen Gmail flow end-to-end (raw_items populated, briefings populated):

1. Stand up the Next.js dashboard. It needs only a read connection to the same
   Neon DB. One page, one section per (source, account), showing the latest
   briefing's markdown + a count + a link to the underlying items.
2. Then add Outlook (`src/sources/outlook/`) — same `Source` interface.
   Microsoft Graph delta queries are the analog of Gmail's history API.
3. Teams reuses Outlook's auth.
4. Asana is the simplest of the four.

## Adding a new source — checklist

1. Create `src/sources/<name>/index.ts` exporting a `Source`.
2. Define a cursor type (whatever shape makes sense for that API's incremental
   model — delta link, timestamp, opaque token, etc.).
3. On first run (no cursor), pull a sensible time window — don't dump history.
4. Map external items to `Omit<NewRawItem, 'source' | 'account'>`.
5. Add a system prompt to `src/summarize/index.ts`.
6. Register in `ALL_SOURCES` in `src/index.ts`.
7. Add env vars to `.env.example` and the Actions workflow.
