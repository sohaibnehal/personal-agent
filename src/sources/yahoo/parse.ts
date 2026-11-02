import type { MessageAddressObject, MessageEnvelopeObject, MessageStructureObject } from 'imapflow';
import type { NewRawItem } from '../../db/schema.js';

/**
 * Yahoo sync position for one account's INBOX.
 * UIDs are only meaningful together with UIDVALIDITY: if the server changes
 * UIDVALIDITY, every stored UID is void and we start over.
 */
export type YahooCursor = {
  uidValidity?: string;
  lastUid?: number;
};

export type FetchPlan =
  | { kind: 'since'; since: Date; reason: 'first_run' | 'uidvalidity_changed' }
  | { kind: 'uids'; fromUid: number };

/** Decide what to fetch this run, given the stored cursor and the mailbox's current UIDVALIDITY. */
export function planFetch(
  prev: YahooCursor | undefined,
  uidValidity: string,
  now: Date = new Date(),
  windowHours = 24,
): FetchPlan {
  const since = new Date(now.getTime() - windowHours * 60 * 60 * 1000);
  if (!prev?.uidValidity || prev.lastUid === undefined) {
    return { kind: 'since', since, reason: 'first_run' };
  }
  if (prev.uidValidity !== uidValidity) {
    return { kind: 'since', since, reason: 'uidvalidity_changed' };
  }
  return { kind: 'uids', fromUid: prev.lastUid + 1 };
}

/**
 * Find the body part to build a preview from: the first inline text/plain part,
 * falling back to the first inline text/html part. Attachments are skipped.
 * Returns the IMAP part id (single-part messages use "1").
 */
export function pickTextPart(
  root: MessageStructureObject | undefined,
): { part: string; html: boolean } | null {
  if (!root) return null;
  let html: { part: string; html: boolean } | null = null;

  const walk = (node: MessageStructureObject): { part: string; html: boolean } | null => {
    if (node.childNodes?.length) {
      for (const child of node.childNodes) {
        const found = walk(child);
        if (found) return found;
      }
      return null;
    }
    if (node.disposition?.toLowerCase() === 'attachment') return null;
    const type = node.type.toLowerCase();
    const part = node.part ?? '1';
    if (type === 'text/plain') return { part, html: false };
    if (type === 'text/html' && !html) html = { part, html: true };
    return null;
  };

  return walk(root) ?? html;
}

const ENTITIES: Record<string, string> = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'",
};

/** Crude HTML → text, good enough for a 300-character preview. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&([a-z#0-9]+);/gi, (m, name: string) => ENTITIES[name.toLowerCase()] ?? m);
}

/** Collapse whitespace and trim to `max` characters. */
export function makeSnippet(text: string, max = 300): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

export function formatAddress(list: MessageAddressObject[] | undefined): string {
  const a = list?.[0];
  if (!a) return '';
  if (a.name && a.address) return `${a.name} <${a.address}>`;
  return a.address ?? a.name ?? '';
}

export function toRawItem(args: {
  uid: number;
  uidValidity: string;
  folder: string;
  envelope: MessageEnvelopeObject | undefined;
  internalDate: Date | string | undefined;
  snippet: string;
}): Omit<NewRawItem, 'source' | 'account'> {
  const { uid, uidValidity, folder, envelope, internalDate, snippet } = args;
  const subject = envelope?.subject ?? '';
  const from = formatAddress(envelope?.from);
  const occurredAt = internalDate ? new Date(internalDate) : envelope?.date ?? new Date();
  return {
    // UIDs are only unique within one UIDVALIDITY, so both go into the id.
    externalId: `${uidValidity}:${uid}`,
    kind: 'email',
    title: subject || '(no subject)',
    snippet,
    // Yahoo has no stable per-message web link; open the inbox.
    url: 'https://mail.yahoo.com/',
    occurredAt,
    payload: {
      from,
      subject,
      messageId: envelope?.messageId ?? null,
      folder,
      uid,
      uidValidity,
    },
  };
}
