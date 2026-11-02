import type { Readable } from 'node:stream';
import type { Source } from '../types.js';
import type { NewRawItem } from '../../db/schema.js';
import { getCursor } from '../../db/cursors.js';
import { yahooAccounts, yahooClient } from './client.js';
import { htmlToText, makeSnippet, pickTextPart, planFetch, toRawItem, type YahooCursor } from './parse.js';

const FOLDER = 'INBOX';
const MAX_PER_RUN = 200;
const PREVIEW_BYTES = 8 * 1024;

async function readCapped(stream: Readable, maxBytes: number): Promise<string> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of stream) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
    chunks.push(buf);
    total += buf.length;
    if (total >= maxBytes) break;
  }
  stream.destroy();
  return Buffer.concat(chunks).subarray(0, maxBytes).toString('utf8');
}

/**
 * Yahoo Mail over IMAP, strictly read-only:
 *   - the folder is opened with EXAMINE (readOnly), so the server cannot change flags or read state;
 *   - only envelope, date, structure and a small text preview are fetched.
 */
export const yahooSource: Source = {
  name: 'yahoo',

  accounts: yahooAccounts,

  async fetch(account) {
    const client = yahooClient(account);
    await client.connect();
    try {
      const box = await client.mailboxOpen(FOLDER, { readOnly: true });
      const uidValidity = box.uidValidity.toString();
      const prev = await getCursor<YahooCursor>('yahoo', account);
      const plan = planFetch(prev, uidValidity);
      if (plan.kind === 'since' && plan.reason === 'uidvalidity_changed') {
        console.warn(`  [yahoo:${account}] UIDVALIDITY changed — restarting from a 24h window`);
      }

      let uids: number[] = [];
      if (plan.kind === 'since') {
        uids = (await client.search({ since: plan.since }, { uid: true })) || [];
      } else if (plan.fromUid < box.uidNext) {
        const found = (await client.search({ uid: `${plan.fromUid}:*` }, { uid: true })) || [];
        // "N:*" always matches the newest message, even when N is past the end.
        uids = found.filter((u) => u >= plan.fromUid);
      }
      uids.sort((a, b) => a - b);
      if (uids.length > MAX_PER_RUN) {
        console.warn(`  [yahoo:${account}] ${uids.length} new messages — keeping the newest ${MAX_PER_RUN}`);
        uids = uids.slice(-MAX_PER_RUN);
      }

      const items: Omit<NewRawItem, 'source' | 'account'>[] = [];
      let lastUid = plan.kind === 'uids' ? plan.fromUid - 1 : box.uidNext - 1;

      if (uids.length > 0) {
        // Collect first: imapflow can't run other commands while a fetch is streaming.
        const messages = await client.fetchAll(
          uids,
          { uid: true, envelope: true, internalDate: true, bodyStructure: true },
          { uid: true },
        );
        for (const m of messages) {
          let snippet = '';
          const pick = pickTextPart(m.bodyStructure);
          if (pick) {
            try {
              const { content } = await client.download(String(m.uid), pick.part, {
                uid: true,
                maxBytes: PREVIEW_BYTES,
              });
              const raw = await readCapped(content, PREVIEW_BYTES);
              snippet = makeSnippet(pick.html ? htmlToText(raw) : raw);
            } catch (e) {
              console.warn(`  [yahoo:${account}] preview failed for uid ${m.uid}:`, e instanceof Error ? e.message : e);
            }
          }
          items.push(
            toRawItem({
              uid: m.uid,
              uidValidity,
              folder: FOLDER,
              envelope: m.envelope,
              internalDate: m.internalDate,
              snippet,
            }),
          );
          lastUid = Math.max(lastUid, m.uid);
        }
      }

      return { items, nextCursor: { uidValidity, lastUid } satisfies YahooCursor };
    } finally {
      await client.logout().catch(() => undefined);
    }
  },
};
