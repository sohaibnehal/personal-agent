import { eq, and } from 'drizzle-orm';
import { db } from './client.js';
import { cursors } from './schema.js';

/**
 * Read the state blob for a given source+account, or undefined if first run.
 * The caller owns the shape of T.
 */
export async function getCursor<T extends Record<string, unknown>>(
  source: string,
  account: string,
): Promise<T | undefined> {
  const rows = await db
    .select()
    .from(cursors)
    .where(and(eq(cursors.source, source), eq(cursors.account, account)))
    .limit(1);
  return rows[0]?.state as T | undefined;
}

/**
 * Upsert the state blob. Called at the end of a successful source run.
 */
export async function setCursor(
  source: string,
  account: string,
  state: Record<string, unknown>,
): Promise<void> {
  await db
    .insert(cursors)
    .values({ source, account, state })
    .onConflictDoUpdate({
      target: [cursors.source, cursors.account],
      set: { state, updatedAt: new Date() },
    });
}
