import 'dotenv/config';
import { db } from './db/client.js';
import { rawItems, briefings, type RawItem } from './db/schema.js';
import { setCursor } from './db/cursors.js';
import { summarize } from './summarize/index.js';
import type { Source } from './sources/types.js';
import { gmailSource } from './sources/gmail/index.js';
import { asanaSource } from './sources/asana/index.js';

const ALL_SOURCES: Source[] = [
  gmailSource,
  asanaSource,
  // outlookSource,  // Phase 3
  // teamsSource,    // Phase 4
];

function parseArgs(): { only?: string } {
  const i = process.argv.indexOf('--source');
  return { only: i >= 0 ? process.argv[i + 1] : undefined };
}

async function runSource(source: Source) {
  for (const account of source.accounts()) {
    const label = `${source.name}:${account}`;
    console.log(`\n→ ${label}`);
    try {
      const { items, nextCursor } = await source.fetch(account);
      console.log(`  fetched ${items.length} items`);

      // Insert raw items. ON CONFLICT DO NOTHING means re-runs are safe.
      let inserted: RawItem[] = [];
      if (items.length > 0) {
        inserted = await db
          .insert(rawItems)
          .values(items.map((it) => ({ ...it, source: source.name, account })))
          .onConflictDoNothing({ target: [rawItems.source, rawItems.account, rawItems.externalId] })
          .returning();
        console.log(`  inserted ${inserted.length} new (rest were duplicates)`);
      }

      // Summarize only the genuinely new items.
      if (inserted.length > 0) {
        const summary = await summarize(source.name, inserted);
        await db.insert(briefings).values({
          source: source.name,
          account,
          summary,
          itemCount: String(inserted.length),
          rawItemIds: inserted.map((i) => i.id),
        });
        console.log(`  ✓ briefing stored`);
      } else {
        console.log(`  (no new items, skipping summary)`);
      }

      // Save cursor LAST so a mid-run failure means we re-fetch on next run.
      await setCursor(source.name, account, nextCursor);
    } catch (e) {
      // Don't let one account/source kill the whole run.
      console.error(`  ✗ ${label} failed:`, e instanceof Error ? e.message : e);
    }
  }
}

async function main() {
  const { only } = parseArgs();
  const sources = only ? ALL_SOURCES.filter((s) => s.name === only) : ALL_SOURCES;
  if (sources.length === 0) {
    console.error(`No sources matched ${only ? `--source ${only}` : ''}`);
    process.exit(1);
  }
  for (const s of sources) await runSource(s);
  console.log('\n✓ done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
