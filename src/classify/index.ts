import Anthropic from '@anthropic-ai/sdk';
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { classifications, rawItems, type RawItem } from '../db/schema.js';
import { PROMPT_VERSION, SYSTEM_PROMPT, buildUserContent, type PromptItem } from './prompt.js';
import { labelToolSchema, type Label } from './schema.js';
import { labelsFromToolInput, toPromptItem, toRow } from './labels.js';

export const DEFAULT_CLASSIFIER_MODEL = 'claude-haiku-4-5-20251001';
const BATCH_SIZE = 10;
const MAX_PER_RUN = 60;
const LOOKBACK_DAYS = 14;

/** Emails from the last 14 days that have no label for the current prompt version. */
async function pendingItems(limit: number): Promise<RawItem[]> {
  const rows = await db
    .select({ item: rawItems })
    .from(rawItems)
    .leftJoin(
      classifications,
      and(eq(classifications.rawItemId, rawItems.id), eq(classifications.promptVersion, PROMPT_VERSION)),
    )
    .where(
      and(
        eq(rawItems.kind, 'email'),
        isNull(classifications.id),
        gt(rawItems.occurredAt, sql`now() - make_interval(days => ${LOOKBACK_DAYS})`),
      ),
    )
    .orderBy(desc(rawItems.occurredAt))
    .limit(limit);
  return rows.map((r) => r.item);
}

async function labelBatch(anthropic: Anthropic, model: string, items: PromptItem[]): Promise<Map<number, Label>> {
  const res = await anthropic.messages.create({
    model,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: [
      {
        name: 'record_labels',
        description: 'Record one label for each email.',
        input_schema: labelToolSchema as unknown as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: 'tool', name: 'record_labels' },
    messages: [{ role: 'user', content: buildUserContent(items) }],
  });
  const block = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
  return labelsFromToolInput(block?.input, items.map((i) => i.id));
}

/**
 * Label new emails. Runs after the sources each hour; safe to re-run.
 * A failed model call skips that batch, which is retried on the next run.
 */
export async function classifyPending(opts: { limit?: number } = {}): Promise<{ labelled: number; uncertain: number; failedBatches: number }> {
  const items = await pendingItems(opts.limit ?? MAX_PER_RUN);
  const stats = { labelled: 0, uncertain: 0, failedBatches: 0 };
  if (items.length === 0) return stats;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.CLASSIFIER_MODEL || DEFAULT_CLASSIFIER_MODEL;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const promptItems = batch.map((item, j) => toPromptItem(item, j + 1));
    try {
      const labels = await labelBatch(anthropic, model, promptItems);
      const rows = batch.map((item, j) => toRow(item, labels.get(j + 1)!, model));
      await db.insert(classifications).values(rows).onConflictDoNothing();
      stats.labelled += rows.length;
      stats.uncertain += rows.filter((r) => r.uncertain).length;
    } catch (e) {
      stats.failedBatches += 1;
      console.error('  ✗ classify batch failed:', e instanceof Error ? e.message : e);
    }
  }
  return stats;
}
