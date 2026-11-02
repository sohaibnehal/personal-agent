import { rawClient, db } from './db';
import { cursors } from '@schema';

export type BriefingSummary = {
  source: string;
  account: string;
  summary: string;
  itemCount: string;
  generatedAt: Date;
};

export type CursorRecord = {
  source: string;
  account: string;
  updatedAt: Date;
};

export async function getLatestBriefingsBySource(): Promise<BriefingSummary[]> {
  const rows = await rawClient`
    SELECT DISTINCT ON (source, account)
      source,
      account,
      summary,
      item_count      AS "itemCount",
      generated_at    AS "generatedAt"
    FROM briefings
    ORDER BY source, account, generated_at DESC
  `;
  return rows as unknown as BriefingSummary[];
}

export async function getCursorState(): Promise<CursorRecord[]> {
  return db.select({
    source:    cursors.source,
    account:   cursors.account,
    updatedAt: cursors.updatedAt,
  }).from(cursors);
}

export type AttentionItem = {
  rawItemId: string;
  classificationId: string;
  source: string;
  account: string;
  title: string | null;
  url: string | null;
  from: string | null;
  occurredAt: Date;
  purpose: string;
  importance: string;
  action: string;
  reason: string;
  deadline: Date | null;
  deadlineExplicit: boolean;
  uncertain: boolean;
  feedback: string | null;
};

/**
 * Emails from the last 14 days whose latest label asks for action or is high importance.
 * Hidden once the latest feedback is "not_important" or "done".
 * Returns null if the label tables don't exist yet (migration not applied), so the page still renders.
 */
export async function getAttentionItems(): Promise<AttentionItem[] | null> {
  try {
    const rows = await rawClient`
      WITH latest AS (
        SELECT DISTINCT ON (raw_item_id) *
        FROM classifications
        ORDER BY raw_item_id, created_at DESC
      )
      SELECT
        r.id                AS "rawItemId",
        c.id                AS "classificationId",
        r.source,
        r.account,
        r.title,
        r.url,
        r.payload->>'from'  AS "from",
        r.occurred_at       AS "occurredAt",
        c.purpose,
        c.importance,
        c.action,
        c.reason,
        c.deadline,
        c.deadline_explicit AS "deadlineExplicit",
        c.uncertain,
        f.decision          AS "feedback"
      FROM latest c
      JOIN raw_items r ON r.id = c.raw_item_id
      LEFT JOIN LATERAL (
        SELECT decision FROM feedback_events fe
        WHERE fe.raw_item_id = r.id
        ORDER BY fe.created_at DESC
        LIMIT 1
      ) f ON true
      WHERE r.occurred_at > now() - interval '14 days'
        AND (c.action <> 'none' OR c.importance = 'high')
        AND COALESCE(f.decision, '') NOT IN ('not_important', 'done')
      ORDER BY
        (f.decision = 'important') DESC NULLS LAST,
        c.deadline ASC NULLS LAST,
        (c.importance = 'high') DESC,
        r.occurred_at DESC
      LIMIT 50
    `;
    return rows as unknown as AttentionItem[];
  } catch (e) {
    console.error('[attention] query failed:', e instanceof Error ? e.message : e);
    return null;
  }
}
