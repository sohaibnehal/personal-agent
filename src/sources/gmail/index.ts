import { google, type gmail_v1 } from 'googleapis';
import type { Source } from '../types.js';
import type { NewRawItem } from '../../db/schema.js';
import { getCursor } from '../../db/cursors.js';

interface GmailCursor {
  /**
   * Gmail's History API cursor. Increments with every mailbox change.
   * On first run this is undefined and we do a time-windowed query instead.
   */
  historyId?: string;
}

function client(account: string) {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env[`GMAIL_REFRESH_TOKEN_${account.toUpperCase()}`];
  if (!clientId || !clientSecret) throw new Error('GMAIL_CLIENT_ID / SECRET missing');
  if (!refreshToken) throw new Error(`GMAIL_REFRESH_TOKEN_${account.toUpperCase()} missing`);

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refreshToken });
  return google.gmail({ version: 'v1', auth: oauth2 });
}

/** Decode a Gmail header value, returning '' if not present. */
function header(msg: gmail_v1.Schema$Message, name: string): string {
  const h = msg.payload?.headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase());
  return h?.value ?? '';
}

/** Convert a Gmail message into our normalized RawItem shape. */
function toRawItem(msg: gmail_v1.Schema$Message): Omit<NewRawItem, 'source' | 'account'> {
  const subject = header(msg, 'Subject');
  const from = header(msg, 'From');
  const dateHeader = header(msg, 'Date');
  // internalDate is ms-since-epoch as a string; more reliable than Date header.
  const occurredAt = msg.internalDate
    ? new Date(parseInt(msg.internalDate, 10))
    : dateHeader ? new Date(dateHeader) : new Date();

  return {
    externalId: msg.id!,
    kind: 'email',
    title: subject || '(no subject)',
    snippet: msg.snippet ?? '',
    url: `https://mail.google.com/mail/u/0/#inbox/${msg.id}`,
    occurredAt,
    payload: {
      from,
      subject,
      threadId: msg.threadId,
      labelIds: msg.labelIds ?? [],
      snippet: msg.snippet ?? '',
    },
  };
}

/** Fetch full message for a list of IDs, in parallel but capped. */
async function fetchMessages(
  gmail: gmail_v1.Gmail,
  ids: string[],
): Promise<gmail_v1.Schema$Message[]> {
  const out: gmail_v1.Schema$Message[] = [];
  // metadata format keeps the response small — we only need headers + snippet.
  const concurrency = 5;
  for (let i = 0; i < ids.length; i += concurrency) {
    const chunk = ids.slice(i, i + concurrency);
    const res = await Promise.all(
      chunk.map((id) =>
        gmail.users.messages
          .get({ userId: 'me', id, format: 'metadata', metadataHeaders: ['Subject', 'From', 'Date'] })
          .then((r) => r.data),
      ),
    );
    out.push(...res);
  }
  return out;
}

export const gmailSource: Source = {
  name: 'gmail',

  accounts() {
    const list = (process.env.GMAIL_ACCOUNTS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    return list;
  },

  async fetch(account) {
    const gmail = client(account);
    // Always grab the current historyId — we'll save it as the new cursor at the end.
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const currentHistoryId = profile.data.historyId!;

    const prev = await getCursor<GmailCursor>('gmail', account);

    let messageIds: string[] = [];

    if (!prev?.historyId) {
      // First run: no history baseline. Pull last 24h of inbox messages so we
      // don't blast the dashboard with months of mail. After this we'll be on
      // the History API path forever.
      const since = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);
      let pageToken: string | undefined;
      do {
        const res = await gmail.users.messages.list({
          userId: 'me',
          q: `in:inbox after:${since}`,
          maxResults: 100,
          pageToken,
        });
        messageIds.push(...(res.data.messages ?? []).map((m) => m.id!).filter(Boolean));
        pageToken = res.data.nextPageToken ?? undefined;
      } while (pageToken);
    } else {
      // Incremental: ask Gmail what changed since our last historyId.
      let pageToken: string | undefined;
      const seen = new Set<string>();
      try {
        do {
          const res = await gmail.users.history.list({
            userId: 'me',
            startHistoryId: prev.historyId,
            historyTypes: ['messageAdded'],
            maxResults: 500,
            pageToken,
          });
          for (const h of res.data.history ?? []) {
            for (const m of h.messagesAdded ?? []) {
              const id = m.message?.id;
              const labels = m.message?.labelIds ?? [];
              // Only INBOX messages — skip Sent, Drafts, etc.
              if (id && labels.includes('INBOX') && !seen.has(id)) {
                seen.add(id);
                messageIds.push(id);
              }
            }
          }
          pageToken = res.data.nextPageToken ?? undefined;
        } while (pageToken);
      } catch (e: unknown) {
        // History IDs older than ~1 week return 404. Fall back to a time window.
        const status = (e as { code?: number })?.code;
        if (status === 404) {
          console.warn('[gmail] history expired, falling back to 24h window');
          const since = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);
          const res = await gmail.users.messages.list({
            userId: 'me',
            q: `in:inbox after:${since}`,
            maxResults: 100,
          });
          messageIds = (res.data.messages ?? []).map((m) => m.id!).filter(Boolean);
        } else {
          throw e;
        }
      }
    }

    const messages = messageIds.length ? await fetchMessages(gmail, messageIds) : [];
    const items = messages.map(toRawItem);

    return {
      items,
      nextCursor: { historyId: currentHistoryId } satisfies GmailCursor,
    };
  },
};
