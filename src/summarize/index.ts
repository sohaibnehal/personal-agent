import Anthropic from '@anthropic-ai/sdk';
import type { RawItem } from '../db/schema.js';
import { UNTRUSTED_CONTENT_RULES, wrapUntrusted } from '../lib/untrusted.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPTS: Record<string, string> = {
  gmail: `You are summarizing new emails for a busy developer's morning briefing.
Be terse. Group by importance, not by sender. For each group, use a short heading
and 1-line bullets. Highlight: action requested, deadlines, replies expected.
Skip newsletters and notifications unless something inside is unusual. Use markdown.`,
};
// Yahoo mail gets the same briefing style as Gmail.
SYSTEM_PROMPTS.yahoo = SYSTEM_PROMPTS.gmail!;

/**
 * Summarize a batch of items for a given source.
 * Returns markdown ready to store in `briefings.summary`.
 */
export async function summarize(source: string, items: RawItem[]): Promise<string> {
  if (items.length === 0) {
    return '_Nothing new._';
  }

  // Compact, structured payload — keeps tokens down vs. dumping raw JSON.
  // Each item is wrapped as untrusted data so email text can't steer the summary.
  const lines = items.map((item, i) => {
    const from = (item.payload as Record<string, unknown>)?.from;
    return wrapUntrusted(i + 1, {
      received: item.occurredAt.toISOString(),
      subject: item.title,
      url: item.url,
      from: typeof from === 'string' ? from : '',
      preview: item.snippet,
    });
  });

  const base = SYSTEM_PROMPTS[source] ?? 'Summarize the following items in markdown. Be terse.';
  const system = `${base}\n\n${UNTRUSTED_CONTENT_RULES}`;

  const res = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1024,
    system,
    messages: [
      {
        role: 'user',
        content: `Summarize these ${items.length} new items:\n\n${lines.join('\n\n')}`,
      },
    ],
  });

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  return text || '_Summary unavailable._';
}
