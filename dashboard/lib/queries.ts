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
