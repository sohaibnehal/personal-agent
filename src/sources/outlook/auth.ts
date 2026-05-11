/**
 * One-time auth script. Run with:  pnpm auth:outlook
 *
 * Uses OAuth 2.0 authorization code flow with PKCE (public client — no secret).
 * After approving, prints the refresh token to paste into .env.
 *
 * Setup before running:
 *   1. Azure Portal → App registrations → your app → Authentication
 *   2. Add a "Mobile and desktop application" redirect URI: http://localhost:53682
 *   3. Under "Advanced settings" allow public client flows
 *   4. Copy the Application (client) ID into MS_CLIENT_ID in .env
 */
import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { randomBytes, createHash } from 'node:crypto';

const SCOPES = 'Mail.Read offline_access User.Read';
const REDIRECT_URI = 'http://localhost:53682';

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function pkce(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

async function main() {
  const clientId = process.env.MS_CLIENT_ID;
  const tenantId = process.env.MS_TENANT_ID ?? 'common';
  if (!clientId) throw new Error('Set MS_CLIENT_ID in .env first');

  const { verifier, challenge } = pkce();

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    response_mode: 'query',
    scope: SCOPES,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });

  const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params}`;

  console.log('\n1. Open this URL in your browser:\n');
  console.log(authUrl);
  console.log('\n2. After approving, your browser will redirect to http://localhost:53682/?code=...');
  console.log('   The page will fail to load — that is fine. Copy the `code` value from the URL bar.\n');

  const rl = createInterface({ input: stdin, output: stdout });
  const code = (await rl.question('Paste the code value here: ')).trim();
  rl.close();

  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        code_verifier: verifier,
        scope: SCOPES,
      }).toString(),
    },
  );

  const body = await tokenRes.json() as Record<string, unknown>;

  if (!tokenRes.ok || typeof body.refresh_token !== 'string') {
    console.error('\n✗ Token exchange failed:', JSON.stringify(body, null, 2));
    process.exit(1);
  }

  const accounts = (process.env.MS_ACCOUNTS ?? '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  const suffix = accounts[0] ?? 'ACCOUNT';

  console.log('\n✓ Success. Add this to your .env (rename the suffix to your account label):\n');
  console.log(`MS_REFRESH_TOKEN_${suffix}=${body.refresh_token}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
