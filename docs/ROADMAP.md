# personal-agent — Roadmap

**Date:** 2 November 2026
**Status:** Draft for review. Nothing below has been started.
**Related:** `Email-Harness-Planning-Document.md` (the email triage plan this roadmap folds in)

## Where things stand

- **No live sources right now.** Asana was removed in `c4e3ce9`; the Citylogix Outlook source was removed
  in `8e86c0d` to keep this a personal-only app (no Outlook data was stored in Neon). Gmail code exists
  but isn't configured locally or in the GitHub workflow.
- Hourly GitHub Actions job → Neon Postgres → Claude summary per run → Next.js dashboard on Vercel.
- Dashboard extras: morning digest (Claude Haiku), weather, PSX portfolio strip.
- Gaps found during review:
  - The dashboard has no login in code. Unless Vercel Deployment Protection is on, anyone with the
    URL can read the briefings and the portfolio.
  - If a source fails, the error is logged and the job still "succeeds", so failures go unnoticed.
  - 2 existing type errors (cursor typing in the Gmail and Outlook sources); no tests; no CI checks.
  - Email text goes into the summary prompt with no "treat this as data" guard.
  - Outlook refresh-token rotation needs manual secret updates.

---

## Phase 0 — Safety and hygiene (do first, small)

| # | Item | Why | Size |
|---|---|---|---|
| 0.1 | ✅ *Done: source removed (`8e86c0d`), `briefing-agent` Azure app registration deleted from the Citylogix directory, Asana token and GitHub secrets removed.* ~~Decide on the Citylogix Outlook source~~: move it to an IT-approved company setup, or remove it, revoke the token and delete its rows | Company email in personal GitHub/Neon/Vercel conflicts with the IT Software Approval policy (grace period ends **20 Nov 2026**) | S |
| 0.2 | ✅ *Done: Basic-auth middleware; set `DASHBOARD_USER` / `DASHBOARD_PASSWORD` in Vercel.* **Lock the dashboard**: confirm Vercel Deployment Protection, or add simple auth middleware | Briefings and portfolio are private | S |
| 0.3 | ✅ *Done.* Fix the 2 type errors; add `typecheck` script and a PR check workflow | Keeps main green | S |
| 0.4 | Record a run status per source (ok / failed / error text) and show failures on the dashboard; exit non-zero when every source fails | Failures are silent today | S–M |
| 0.5 | ✅ *Done in Phase 1.* Add an injection guard to the summary prompts (email content wrapped as untrusted data) | Needed before any email triage | S |
| 0.6 | Refresh model IDs and the Anthropic SDK version | SDK is `^0.30`; models pinned to older versions | S |

## Phase 1 — Personal email, read-only (Email harness Stages 0–1)

Built as a **parallel route**: new tables and modules alongside the existing briefing flow, which stays unchanged.

| # | Item | Notes | Size |
|---|---|---|---|
| 1.1 | 🔧 *Code ready; needs your OAuth setup.* **Turn on personal Gmail** (OAuth, secrets, workflow env) | Code already exists; quickest real win | S |
| 1.2 | 🔧 *Script ready (`npm run spike:yahoo`).* **Yahoo spike** → `docs/yahoo-spike.md` | App-password login, folder list, `EXAMINE` (read-only), UID behaviour, `MOVE`/`UIDPLUS` support. Headers only, nothing sent to a model | S |
| 1.3 | ✅ *Built.* **Yahoo source** (`src/sources/yahoo/`, IMAP read-only) | Same `Source` interface; cursor = per-folder UIDVALIDITY + last UID | M |
| 1.4 | ✅ *Built.* **Per-message classification** (`classifications` table: purpose, importance, suggested action, retention, reasons, rule/prompt version) | Separate from `briefings`; runs only on new items | M |
| 1.5 | ✅ *Built.* **Attention view** on the dashboard: needs reply / decision / payment / deadline, each linking to the original | Explicit deadlines shown apart from inferred urgency | M |
| 1.6 | ✅ *Built (+ Done).* **Feedback buttons** (Important / Not important / Keep) → `feedback_events` | Starts the reviewed-example set (target 100–200) | S–M |

**Gate:** review a week of classifications before anything can change a mailbox.

## Phase 2 — Cleanup with approval (Email harness Stage 2)

| # | Item | Notes |
|---|---|---|
| 2.1 | Cleanup batches with **frozen membership** (exact message list), grouped by purpose/sender/age | No live queries; 24h approval expiry |
| 2.2 | Review UI: exclude items, Keep / Archive / **Move to Trash** | "Move to Trash" wording; Yahoo empties Trash after 7 days |
| 2.3 | **Separate executor** with its own write credentials; the hourly briefing job stays read-only | Re-checks each message before acting; skips anything changed |
| 2.4 | `action_ledger` table (before/after state, result) + best-effort restore | Activity log on the dashboard |

**Decision needed:** where the executor runs: a GitHub Actions `workflow_dispatch` started from the dashboard,
or a Vercel server route. (GitHub Actions keeps write credentials out of Vercel.)

## Phase 3 — Learning (Email harness Stage 3)

- Proposed narrow rules from feedback (e.g. "bank promotions → cleanup review; statements → keep").
- Tested against a held-out reviewed set, run in shadow mode, versioned, with one-click rollback.
- Optional automatic move to a "Review — Clutter" folder only after the quality gate
  (≥98% precision over ≥200 reviewed candidates, no protected-message errors) **and** your opt-in.
  Deletion always stays approval-only.

## Later / nice-to-have

- Unit tests with fixture emails for each source and the classifier (Vitest).
- Schedule: hourly for briefings, every 4h for email triage (configurable).
- Token/cost tracking per run on the dashboard.
- Outlook personal (consumer) account, once the work account question is settled.

## Open decisions

1. ~~Citylogix Outlook source~~ — removed.
2. Is Vercel Deployment Protection already on?
3. Executor location for Phase 2 (GitHub Actions vs Vercel).
4. Model data settings for personal mail: confirm the Anthropic key/account and its retention settings.
5. Backfill window for Yahoo/Gmail (proposed 60–90 days).

## Suggested order of work

0.1 → 0.2 → 0.3 + 0.4 → 1.1 → 1.2 (gate) → 0.5 → 1.3 → 1.4 → 1.5 + 1.6 → review gate → Phase 2.
