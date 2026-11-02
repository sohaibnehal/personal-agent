/**
 * Yahoo connection check (Phase 1, step A2). Strictly read-only.
 *
 *   npm run spike:yahoo [-- <account-label>]
 *
 * - Logs in with the app password from .env
 * - Records server capabilities, folders, and INBOX UID behaviour
 * - Prints the latest 20 INBOX headers to the terminal ONLY (never written to disk)
 * - Checks that reading a preview did not change any message flags
 * - Writes non-content findings to docs/yahoo-spike.md
 *
 * Nothing is sent to a model, and nothing in the mailbox is modified (INBOX is opened with EXAMINE).
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { yahooAccounts, yahooClient, YAHOO_IMAP_HOST } from '../src/sources/yahoo/client.js';
import { formatAddress, pickTextPart } from '../src/sources/yahoo/parse.js';

const SAMPLE = 20;

function flagsKey(flags: Set<string> | undefined): string {
  return [...(flags ?? [])].sort().join(' ');
}

async function main() {
  const account = process.argv[2] ?? yahooAccounts()[0] ?? 'personal';
  const client = yahooClient(account);
  const findings: string[] = [];
  const started = new Date();

  await client.connect();
  console.log(`✓ logged in to ${YAHOO_IMAP_HOST} as account "${account}"`);

  try {
    const caps = [...client.capabilities.keys()].sort();
    const has = (c: string) => client.capabilities.has(c);

    const folders = await client.list({ statusQuery: { messages: true } });

    const first = await client.mailboxOpen('INBOX', { readOnly: true });
    const inbox = {
      uidValidity: first.uidValidity.toString(),
      uidNext: first.uidNext,
      exists: first.exists,
      readOnly: first.readOnly === true,
    };

    // Sample the newest messages by sequence number; record flags before touching anything.
    const from = Math.max(1, inbox.exists - SAMPLE + 1);
    const sample = inbox.exists > 0
      ? await client.fetchAll(`${from}:*`, { uid: true, envelope: true, internalDate: true, flags: true, bodyStructure: true })
      : [];
    const before = new Map(sample.map((m) => [m.uid, flagsKey(m.flags)]));

    console.log(`\nLatest ${sample.length} INBOX messages (terminal only, not saved):`);
    for (const m of [...sample].reverse()) {
      const when = m.internalDate ? new Date(m.internalDate).toISOString().slice(0, 16) : '?';
      console.log(`  ${when}  ${formatAddress(m.envelope?.from).slice(0, 40).padEnd(40)}  ${(m.envelope?.subject ?? '').slice(0, 70)}`);
    }

    // Read a preview of one message, exactly as the source does, then re-check flags.
    const probe = sample.at(-1);
    let previewOk = 'skipped (empty inbox)';
    if (probe) {
      const pick = pickTextPart(probe.bodyStructure);
      if (pick) {
        const { content } = await client.download(String(probe.uid), pick.part, { uid: true, maxBytes: 2048 });
        content.resume();
        await new Promise((r) => content.once('end', r).once('close', r));
        previewOk = `ok (${pick.html ? 'html' : 'plain text'} part ${pick.part})`;
      } else {
        previewOk = 'no text part on newest message';
      }
    }

    await client.mailboxClose();
    const second = await client.mailboxOpen('INBOX', { readOnly: true });
    const stable = second.uidValidity.toString() === inbox.uidValidity;
    const after = sample.length
      ? await client.fetchAll(sample.map((m) => m.uid), { uid: true, flags: true }, { uid: true })
      : [];
    const changed = after.filter((m) => before.get(m.uid) !== flagsKey(m.flags)).length;

    findings.push(
      '# Yahoo connection check',
      '',
      `**Run:** ${started.toISOString()}  `,
      `**Account label:** \`${account}\`  `,
      `**Host:** \`${YAHOO_IMAP_HOST}:993\` (TLS)`,
      '',
      '## Result',
      '',
      '| Check | Result |',
      '|---|---|',
      `| Login with app password | ✅ ok |`,
      `| INBOX opened read-only (EXAMINE) | ${inbox.readOnly ? '✅ yes' : '⚠️ server did not confirm read-only'} |`,
      `| UIDVALIDITY stable across reopen | ${stable ? '✅ yes' : '⚠️ changed'} |`,
      `| Preview download | ${previewOk} |`,
      `| Message flags changed by this run | ${changed === 0 ? '✅ none' : `⚠️ ${changed} changed`} (sample of ${sample.length}) |`,
      `| \`MOVE\` (safe single-step move, needed for Phase 2) | ${has('MOVE') ? '✅ supported' : '❌ not supported'} |`,
      `| \`UIDPLUS\` (targeted expunge, Phase 2 fallback) | ${has('UIDPLUS') ? '✅ supported' : '❌ not supported'} |`,
      `| \`IDLE\` (push, optional later) | ${has('IDLE') ? 'supported' : 'not supported'} |`,
      `| \`CONDSTORE\` (change tracking, optional) | ${has('CONDSTORE') ? 'supported' : 'not supported'} |`,
      '',
      '## INBOX',
      '',
      `- Messages: ${inbox.exists}`,
      `- UIDVALIDITY: \`${inbox.uidValidity}\``,
      `- UIDNEXT: ${inbox.uidNext}`,
      '',
      '## Folders',
      '',
      '| Folder | Special use | Messages |',
      '|---|---|---|',
      ...folders.map((f) => `| ${f.path} | ${f.specialUse ?? ''} | ${f.status?.messages ?? ''} |`),
      '',
      '## All capabilities',
      '',
      caps.map((c) => `\`${c}\``).join(', '),
      '',
      '_No message content is recorded in this file._',
      '',
    );
  } finally {
    await client.logout().catch(() => undefined);
  }

  writeFileSync('docs/yahoo-spike.md', findings.join('\n'));
  console.log('\n✓ findings written to docs/yahoo-spike.md');
}

main().catch((e) => {
  console.error('✗ Yahoo check failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});
