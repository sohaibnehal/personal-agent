# briefing-agent

Personal morning-briefing agent. Pulls from personal email (Gmail, Yahoo),
summarizes and labels it via Claude, stores in Postgres, and renders to a dashboard.
**Personal accounts only** — no Citylogix data. Everything is read-only: nothing in a mailbox is changed.
See `docs/ROADMAP.md` and `docs/PHASE-1-PLAN.md`.

## Architecture

```
GitHub Actions (hourly cron)
    │
    ├─ for each Source (gmail, yahoo)
    │     ├─ read cursor from Postgres
    │     ├─ fetch new items (read-only)
    │     ├─ insert into raw_items
    │     ├─ summarize new items via Claude → briefings
    │     └─ write new cursor
    │
    ├─ classify new emails via Claude Haiku → classifications
    │
    └─ Neon Postgres ─── Next.js dashboard (login required)
                           ├─ Attention list (classifications + feedback buttons → feedback_events)
                           └─ briefing cards
```

Two key design choices:

1. **Cursors stored in DB, not files.** GitHub Actions runners are ephemeral, so
   "last run" state has to live somewhere durable. Postgres also gives the
   dashboard one place to read from.
2. **Raw items + summary are separate tables.** Lets us re-summarize without
   re-fetching, and the dashboard can drill from a summary into the underlying
   items.

## Status

- [x] Sources: Gmail (History API), Yahoo (IMAP, read-only `EXAMINE`)
- [x] Briefings per source (Claude Sonnet), with email text wrapped as untrusted data
- [x] Per-message labels (`classifications`, Claude Haiku, prompt version `c1`)
- [x] Dashboard: login, Attention list, feedback buttons (`feedback_events`)
- [ ] Phase 2: approved cleanup — see `docs/ROADMAP.md`

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
3. APIs & Services → OAuth consent screen → External; add yourself as a test user.
   Then set **Publishing status → In production** (it stays "unverified", which is fine
   for your own account). Apps left in *Testing* get refresh tokens that expire after 7 days.
4. Credentials → Create Credentials → OAuth client ID → **Desktop app**
5. Copy client ID + secret into `.env` as `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET`
6. Set `GMAIL_ACCOUNTS=personal` (personal accounts only)
7. For each account, run:

   ```bash
   npm run auth:gmail
   ```

   Follow the prompt. It prints a refresh token. Paste it into `.env` as
   `GMAIL_REFRESH_TOKEN_PERSONAL` (or whatever the account label is, uppercased).

   Sign in with a different Google account each time you run it.

### 4b. Yahoo (IMAP app password)

1. Yahoo → Account Info → Account Security → **Generate app password** (name it "briefing-agent").
2. In `.env`: `YAHOO_ACCOUNTS=personal`, `YAHOO_EMAIL_PERSONAL=<you>@yahoo.com`,
   `YAHOO_APP_PASSWORD_PERSONAL=<the app password>`.
3. Run the read-only connection check:

   ```bash
   npm run spike:yahoo
   ```

   It prints the latest 20 inbox headers to your terminal only and writes
   non-content findings to `docs/yahoo-spike.md`.

### 5. Database migration and local run

```bash
npm run db:migrate        # adds classifications + feedback_events
npm run agent:gmail       # or: npm run agent:yahoo
npm run classify          # label new emails
npm test                  # unit tests
```

Expected on first run: pulls the last 24h of inbox, inserts raw_items, writes one
briefing per account, then labels the emails. Check `db:studio` to inspect.

### 6. Deploy to GitHub Actions

In your repo settings:

- **Variables** (Settings → Secrets and variables → Actions → Variables):
  - `GMAIL_ACCOUNTS` = `personal`
  - `YAHOO_ACCOUNTS` = `personal`
  - `CLASSIFIER_MODEL` (optional)
- **Secrets** (same page, Secrets tab):
  - `DATABASE_URL`
  - `ANTHROPIC_API_KEY`
  - `GMAIL_CLIENT_ID`
  - `GMAIL_CLIENT_SECRET`
  - `GMAIL_REFRESH_TOKEN_PERSONAL`
  - `YAHOO_EMAIL_PERSONAL`
  - `YAHOO_APP_PASSWORD_PERSONAL`

Push to main. The workflow runs hourly. Trigger manually from the Actions tab to
verify before waiting for the cron.

## Adding a new source — checklist

1. Create `src/sources/<name>/index.ts` exporting a `Source`.
2. Define a cursor type (whatever shape makes sense for that API's incremental
   model — delta link, timestamp, opaque token, etc.).
3. On first run (no cursor), pull a sensible time window — don't dump history.
4. Map external items to `Omit<NewRawItem, 'source' | 'account'>`.
5. Add a system prompt to `src/summarize/index.ts`.
6. Register in `ALL_SOURCES` in `src/index.ts`.
7. Add env vars to `.env.example` and the Actions workflow.
