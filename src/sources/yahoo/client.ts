import { ImapFlow } from 'imapflow';

export const YAHOO_IMAP_HOST = 'imap.mail.yahoo.com';

/**
 * IMAP client for one Yahoo account label. Credentials come from env:
 *   YAHOO_EMAIL_<LABEL> and YAHOO_APP_PASSWORD_<LABEL> (an app password, not the account password).
 */
export function yahooClient(account: string): ImapFlow {
  const key = account.toUpperCase();
  const user = process.env[`YAHOO_EMAIL_${key}`];
  const pass = process.env[`YAHOO_APP_PASSWORD_${key}`];
  if (!user) throw new Error(`YAHOO_EMAIL_${key} missing`);
  if (!pass) throw new Error(`YAHOO_APP_PASSWORD_${key} missing`);
  return new ImapFlow({
    host: YAHOO_IMAP_HOST,
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
  });
}

export function yahooAccounts(): string[] {
  return (process.env.YAHOO_ACCOUNTS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
}
