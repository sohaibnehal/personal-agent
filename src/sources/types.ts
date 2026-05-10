import type { NewRawItem } from '../db/schema.js';

/**
 * A Source knows how to:
 *   1. Read its cursor state (or start fresh on first run)
 *   2. Pull everything new since that cursor
 *   3. Return normalized RawItems + the new cursor state to persist
 *
 * The runner handles the DB writes and summarization. Sources stay focused
 * on talking to their external API.
 */
export interface Source {
  /** unique slug, e.g. 'gmail' */
  readonly name: string;

  /** which accounts to fetch for. Configured via env. */
  accounts(): string[];

  /**
   * Fetch new items for one account. May make many API calls internally.
   * Returns:
   *   - items: normalized rows ready to insert
   *   - nextCursor: state to persist on success (opaque to runner)
   */
  fetch(account: string): Promise<{
    items: Omit<NewRawItem, 'source' | 'account'>[];
    nextCursor: Record<string, unknown>;
  }>;
}
