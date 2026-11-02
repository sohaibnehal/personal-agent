# Phase 1 — Personal email, read-only

**Repo:** `sohaibnehal/personal-agent`
**Date:** 2 November 2026
**Status:** Draft for review. Nothing has been built yet.
**Goal:** Get personal mail (Gmail and Yahoo) flowing into the briefing agent, then add per-message labels, an "Attention" view, and feedback buttons. Nothing in this phase changes a mailbox.

---

## Ground rules for this phase

- **Read-only everywhere.** Gmail uses `gmail.readonly`. Yahoo opens folders in read-only mode (`EXAMINE`) and fetches with `PEEK`, so messages are never marked as read.
- **Parallel route.** New tables and modules sit next to the existing briefing flow, which keeps working unchanged.
- **Personal accounts only.** No Citylogix mail, ever.
- **You handle secrets.** You create app passwords and OAuth tokens and paste them into `.env` and GitHub yourself. I never see or type them.
- **A review gate after each step.** I stop and show you results before moving on.

---

## Round A: connect the sources (build first)

### A1. Turn on personal Gmail (roadmap 1.1)

The code already exists. It just needs credentials and the workflow settings.

| Step | Who | What |
|---|---|---|
| 1 | You | Open the Google Cloud project, or create one. Enable the **Gmail API**. |
| 2 | You | On the OAuth consent screen, choose External and add yourself as a test user. |
| 3 | You | Create an **OAuth client of type Desktop app**. Put the client ID and secret in `.env`. |
| 4 | You | Run `npm run auth:gmail`, sign in, and put the refresh token in `.env` and in GitHub secrets. |
| 5 | Me | Add the `GMAIL_*` settings back into `.github/workflows/briefing.yaml` and `.env.example`. |
| 6 | Both | Run the job once from the Actions tab and check that a Gmail card appears on the dashboard. |

> ⚠️ **Token expiry:** when a Google OAuth app is left in **Testing** mode, its refresh tokens expire after 7 days. For personal use, switch the app to **In production**. It will stay "unverified", and Google shows a warning when you sign in, which is fine for your own account. I'll confirm the exact Google steps when we do this.

**Gate A1:** Gmail summaries show up on the dashboard for 2 runs in a row.

### A2. Yahoo connection check (roadmap 1.2)

This is a small read-only script, `scripts/yahoo-spike.ts`, using the `imapflow` library. It **only reads headers** and sends nothing to a model.

It checks:

- that login works with a Yahoo **app password** (which you create in Yahoo Account Security)
- which features the server supports, especially `MOVE` and `UIDPLUS`, which matter for safe cleanup later
- the folder list and message counts
- the inbox's message-ID setup (`UIDVALIDITY` and `UIDNEXT`), and whether it stays the same between runs
- sender, subject and date for the latest 20 inbox messages, printed to your terminal only and **not committed**

**Output:** `docs/yahoo-spike.md`, containing the capabilities, folders and ID behaviour, but no email content.

**Gate A2:** you review the findings. If login fails or the server lacks basic features, we stop and rethink, for example by doing Gmail cleanup first.

### A3. Yahoo source (roadmap 1.3)

The Yahoo source lives in `src/sources/yahoo/index.ts` and uses the same `Source` interface as Gmail.

- **Sync position:** stored per folder as `{ uidValidity, lastUid }`. If `uidValidity` changes, it starts over with a fresh 24-hour window instead of guessing.
- **First run:** the last 24 hours of the inbox, the same as Gmail.
- **What's stored:** sender, subject, date, the Yahoo message ID, and a short preview (the first ~300 characters of the plain-text part). No attachments and no full bodies.
- **Settings:** `YAHOO_ACCOUNTS`, `YAHOO_EMAIL_<LABEL>` and `YAHOO_APP_PASSWORD_<LABEL>`, kept in `.env` and GitHub secrets.
- **Tests:** a unit test that uses a sample message, so no real mailbox is needed in CI.

**Gate A3:** run it locally for a day, then confirm in Yahoo that no message changed state (read/unread, flags, folder).

---

## Round B: understand the mail (build after Round A is stable)

### B1. Per-message labels (roadmap 1.4, plus Phase 0.5)

- A new `classifications` table, one row per message. It holds the purpose, importance, suggested action, retention class, reasons, the model and prompt version, and when it was created.
- Only **new** messages are labelled. Existing summaries stay as they are.
- **Injection guard (0.5):** each email goes into the prompt inside a clearly marked data block. The instructions tell the model that email text is never a command.
- The model returns a strict JSON format, which is checked with `zod`. Anything that fails the check gets labelled "uncertain" instead of being guessed.

### B2. Attention view (roadmap 1.5)

- A new dashboard section for messages that need a reply, a decision, a payment or a follow-up.
- Each item shows the sender, account, subject, received time, a one-line reason, and a link to the original message.
- Real deadlines found in the email are shown separately from urgency the model guessed.

### B3. Feedback buttons (roadmap 1.6)

- Each item gets **Important**, **Not important** and **Keep** buttons. Each click is saved to a `feedback_events` table, which is append-only.
- This starts the set of 100–200 messages you've reviewed yourself, which Phase 3 learns from.
- It's safe to expose, because the dashboard is now behind a login.

**Gate B:** review about a week of labels and your corrections. Nothing can touch a mailbox until Phase 2 is approved.

---

## Decisions needed before starting

1. **Scope of this round:** Round A only (recommended), or A and B together?
2. **Gmail accounts:** personal only, or two personal inboxes? Any "work" Gmail must not be a Citylogix account.
3. **Google OAuth client:** reuse the existing Desktop client, or create a new one?
4. **Yahoo app password:** ready to create one now?
5. **Model for labelling:** Claude Haiku (cheaper and fast) or Sonnet (better on mixed promotional and transactional mail)? I suggest Haiku first, then comparing the two on your reviewed examples.

## Rough size

| Item | Size |
|---|---|
| A1 Gmail on | S, mostly your setup steps |
| A2 Yahoo check | S |
| A3 Yahoo source | M |
| B1 Labels and injection guard | M |
| B2 Attention view | M |
| B3 Feedback buttons | S–M |
