import { pgTable, text, timestamp, jsonb, uuid, index, uniqueIndex, boolean } from 'drizzle-orm/pg-core';

/**
 * cursors — one row per (source, account). Tracks "since last run" state.
 *
 * Examples:
 *   ('gmail', 'personal')   → { historyId: '12345' }
 *   ('gmail', 'work')       → { historyId: '67890' }
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
 * `external_id` is the source's own ID (Gmail message ID, etc.)
 * and (source, account, external_id) is unique — lets us safely re-run.
 */
export const rawItems = pgTable(
  'raw_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    source: text('source').notNull(),         // 'gmail' | 'yahoo'
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

/**
 * classifications — one label per (email, prompt version). Written by src/classify.
 * Separate from `briefings`: a briefing summarises a run, a classification describes one message.
 * A new prompt version adds new rows instead of overwriting old ones.
 */
export const classifications = pgTable(
  'classifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    rawItemId: uuid('raw_item_id').notNull().references(() => rawItems.id, { onDelete: 'cascade' }),
    promptVersion: text('prompt_version').notNull(),
    model: text('model').notNull(),
    purpose: text('purpose').notNull(),       // see src/classify/schema.ts
    importance: text('importance').notNull(), // 'high' | 'normal' | 'low'
    action: text('action').notNull(),         // 'reply' | 'decide' | 'pay' | 'follow_up' | 'none'
    retention: text('retention').notNull(),   // 'keep' | 'archive_ok' | 'clutter_candidate'
    deadline: timestamp('deadline', { withTimezone: true }),
    deadlineExplicit: boolean('deadline_explicit').notNull().default(false),
    reason: text('reason').notNull(),
    uncertain: boolean('uncertain').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    itemVersion: uniqueIndex('classifications_item_version').on(t.rawItemId, t.promptVersion),
    actionIdx: index('classifications_action_idx').on(t.action, t.importance),
  }),
);

/**
 * feedback_events — append-only record of what the user said about a message
 * (Important / Not important / Keep / Done). Never updated in place; the latest event wins.
 * Feedback never grants permission to change a mailbox.
 */
export const feedbackEvents = pgTable(
  'feedback_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    rawItemId: uuid('raw_item_id').notNull().references(() => rawItems.id, { onDelete: 'cascade' }),
    classificationId: uuid('classification_id').references(() => classifications.id, { onDelete: 'set null' }),
    decision: text('decision').notNull(),     // 'important' | 'not_important' | 'keep' | 'done'
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    itemIdx: index('feedback_events_item_idx').on(t.rawItemId, t.createdAt),
  }),
);

export type Cursor = typeof cursors.$inferSelect;
export type RawItem = typeof rawItems.$inferSelect;
export type NewRawItem = typeof rawItems.$inferInsert;
export type Briefing = typeof briefings.$inferSelect;
export type Classification = typeof classifications.$inferSelect;
export type NewClassification = typeof classifications.$inferInsert;
export type FeedbackEvent = typeof feedbackEvents.$inferSelect;
