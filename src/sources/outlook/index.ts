import type { Source } from '../types.js';
import type { NewRawItem } from '../../db/schema.js';
import { getCursor } from '../../db/cursors.js';

interface OutlookCursor {
  deltaLink?: string;
}

// Fields we actually use — keeps Graph payloads small.
const SELECT =
  'id,subject,bodyPreview,webLink,receivedDateTime,from,isRead,hasAttachments,conversationId';

interface GraphMessage {
  id: string;
  subject?: string;
  bodyPreview?: string;
  webLink?: string;
  receivedDateTime?: string;
  isRead?: boolean;
  hasAttachments?: boolean;
  conversationId?: string;
  from?: { emailAddress?: { address?: string; name?: string } };
}

interface GraphDeltaPage {
  value: GraphMessage[];
  '@odata.nextLink'?: string;
  '@odata.deltaLink'?: string;
}

async function getAccessToken(account: string): Promise<string> {
  const clientId = process.env.MS_CLIENT_ID;
  const tenantId = process.env.MS_TENANT_ID ?? 'common';
  const refreshToken = process.env[`MS_REFRESH_TOKEN_${account.toUpperCase()}`];
  if (!clientId) throw new Error('MS_CLIENT_ID missing');
  if (!refreshToken) throw new Error(`MS_REFRESH_TOKEN_${account.toUpperCase()} missing`);

  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        scope: 'Mail.Read offline_access User.Read',
      }).toString(),
    },
  );

  const body = await res.json() as Record<string, unknown>;
  if (!res.ok || typeof body.access_token !== 'string') {
    throw new Error(`MS token refresh failed: ${JSON.stringify(body)}`);
  }

  // Microsoft sometimes rotates refresh tokens. Surface it loudly — we can't
  // write back to .env from GH Actions, so the user must update it manually.
  if (typeof body.refresh_token === 'string' && body.refresh_token !== refreshToken) {
    console.warn(
      `[outlook] WARNING: Microsoft returned a new refresh token for account "${account}". ` +
      `Update MS_REFRESH_TOKEN_${account.toUpperCase()} in your .env and GitHub secrets ` +
      `with this new value: ${body.refresh_token}`,
    );
  }

  return body.access_token as string;
}

async function graphGet(url: string, token: string): Promise<unknown> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Graph request failed ${res.status}: ${text}`);
  }
  return res.json();
}

function toRawItem(msg: GraphMessage): Omit<NewRawItem, 'source' | 'account'> {
  return {
    externalId: msg.id,
    kind: 'email',
    title: msg.subject || '(no subject)',
    snippet: msg.bodyPreview ?? '',
    url: msg.webLink ?? '',
    occurredAt: msg.receivedDateTime ? new Date(msg.receivedDateTime) : new Date(),
    payload: {
      from: msg.from?.emailAddress?.address,
      fromName: msg.from?.emailAddress?.name,
      isRead: msg.isRead,
      hasAttachments: msg.hasAttachments,
      conversationId: msg.conversationId,
    },
  };
}

export const outlookSource: Source = {
  name: 'outlook',

  accounts() {
    return (process.env.MS_ACCOUNTS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  },

  async fetch(account) {
    const token = await getAccessToken(account);
    const prev = await getCursor<OutlookCursor>('outlook', account);

    const messages: GraphMessage[] = [];
    let nextDeltaLink: string | undefined;

    if (prev?.deltaLink) {
      // Incremental: resume from the saved delta link — Graph returns only changes.
      let url: string | undefined = prev.deltaLink;
      while (url) {
        const page = await graphGet(url, token) as GraphDeltaPage;
        messages.push(...page.value);
        nextDeltaLink = page['@odata.deltaLink'];
        url = page['@odata.nextLink'];
      }
    } else {
      // First run: pull last 24h, then page through to the delta link.
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const base =
        'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta' +
        `?$select=${SELECT}&$top=50&$filter=receivedDateTime ge ${since}`;

      let url: string | undefined = base;
      while (url) {
        const page = await graphGet(url, token) as GraphDeltaPage;
        messages.push(...page.value);
        nextDeltaLink = page['@odata.deltaLink'];
        url = page['@odata.nextLink'];
      }
    }

    return {
      items: messages.map(toRawItem),
      nextCursor: { deltaLink: nextDeltaLink } satisfies OutlookCursor,
    };
  },
};
