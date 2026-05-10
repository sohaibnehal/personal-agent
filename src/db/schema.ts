import { pgTable, text, timestamp, jsonb, uuid, index, uniqueIndex } from 'drizzle-orm/pg-core';

/**
 * cursors — one row per (source, account). Tracks "since last run" state.
 *
 * Examples:
 *   ('gmail', 'personal')   → { historyId: '12345' }
 *   ('gmail', 'work')       → { historyId: '67890' }
 *   ('outlook', 'main')     → { deltaLink: 'https://graph.microsoft.com/...' }
 *   ('asana', 'default')    → { lastRunAt: '2026-05-09T08:00:00Z' }
 *
 * The shape of `state` is source-specific. Each source module owns its schema.
 */
export const cursors = pgTable(
  'cursors',
  {
    source: text('source').notNull(),
    account: text('account').notNull(),
    state: jsonb('state').notNull().$type<Record<string, unknown>>(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: uniqueIndex('cursors_pk').on(t.source, t.account),
  }),
);

/**
 * raw_items — everything we pull from any source, normalized to a common shape.
 * We store raw payloads so we can re-summarize without re-fetching, and so the
 * dashboard can drill into individual items if needed.
 *
 * `external_id` is the source's own ID (Gmail message ID, Asana task gid, etc.)
 * and (source, account, external_id) is unique — lets us safely re-run.
 */
export const rawItems = pgTable(
  'raw_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    source: text('source').notNull(),         // 'gmail' | 'outlook' | 'teams' | 'asana'
    account: text('account').notNull(),       // 'personal' | 'work' | etc.
    externalId: text('external_id').notNull(),
    kind: text('kind').notNull(),             // 'email' | 'message' | 'mention' | 'task'
    title: text('title'),                     // subject / first line / task name
    snippet: text('snippet'),                 // short preview
    url: text('url'),                         // deep link back to the source
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
    payload: jsonb('payload').notNull().$type<Record<string, unknown>>(),
  },
  (t) => ({
    uniq: uniqueIndex('raw_items_uniq').on(t.source, t.account, t.externalId),
    occurredIdx: index('raw_items_occurred_idx').on(t.occurredAt),
    sourceIdx: index('raw_items_source_idx').on(t.source, t.occurredAt),
  }),
);

/**
 * briefings — one row per (source, run). The dashboard reads the latest one
 * per source and renders it. Includes both the LLM summary and a count so the
 * UI can show "12 new emails" without re-querying raw_items.
 */
export const briefings = pgTable(
  'briefings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    source: text('source').notNull(),
    account: text('account').notNull(),
    summary: text('summary').notNull(),       // markdown
    itemCount: text('item_count').notNull(),  // text so we can store '12+' if we cap
    rawItemIds: jsonb('raw_item_ids').notNull().$type<string[]>(),
    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sourceIdx: index('briefings_source_idx').on(t.source, t.generatedAt),
  }),
);

export type Cursor = typeof cursors.$inferSelect;
export type RawItem = typeof rawItems.$inferSelect;
export type NewRawItem = typeof rawItems.$inferInsert;
export type Briefing = typeof briefings.$inferSelect;
