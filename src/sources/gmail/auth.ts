/**
 * One-time auth script. Run with:  pnpm auth:gmail
 *
 * Walks you through OAuth for one Gmail account and prints the refresh token
 * to paste into your .env. Repeat for each GMAIL_ACCOUNTS entry.
 *
 * Setup before running:
 *   1. Google Cloud Console → create project → enable "Gmail API"
 *   2. APIs & Services → OAuth consent screen → External, add yourself as test user
 *   3. Credentials → Create OAuth client ID → "Desktop app"
 *   4. Copy client ID + secret into .env as GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET
 */
import 'dotenv/config';
import { google } from 'googleapis';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

async function main() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in .env first');
  }

  // For Desktop app credentials, urn:ietf:wg:oauth:2.0:oob is deprecated.
  // We use the loopback approach: a one-shot localhost callback.
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, 'http://localhost:53682');

  const url = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // forces refresh token even on re-auth
    scope: SCOPES,
  });

  console.log('\n1. Open this URL in your browser:\n');
  console.log(url);
  console.log('\n2. After approving, your browser will redirect to http://localhost:53682/?code=...');
  console.log('   The page will fail to load — that is fine. Copy the `code` value from the URL bar.\n');

  const rl = createInterface({ input: stdin, output: stdout });
  const code = (await rl.question('Paste the code value here: ')).trim();
  rl.close();

  const { tokens } = await oauth2.getToken(code);
  if (!tokens.refresh_token) {
    console.error('\n✗ No refresh token returned. Revoke access at https://myaccount.google.com/permissions and re-run.');
    process.exit(1);
  }

  console.log('\n✓ Success. Add this to your .env (rename the suffix to your account label):\n');
  console.log(`GMAIL_REFRESH_TOKEN_PERSONAL=${tokens.refresh_token}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
