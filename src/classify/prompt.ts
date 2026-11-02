import { UNTRUSTED_CONTENT_RULES, wrapUntrusted } from '../lib/untrusted.js';

/** Bump when the prompt or label set changes; older labels are kept for comparison. */
export const PROMPT_VERSION = 'c1';

export const SYSTEM_PROMPT = `You label personal emails so the reader knows what needs attention.
Call the record_labels tool exactly once with one label per <email> block, using the block's id.

How to label:
- purpose: what the email is for. Judge by content, not just the sender. A bank can send a statement (bank_statement), a transaction alert (bank_transaction) or a credit-card offer (promotion).
- A transactional email that also contains a coupon is still transactional.
- importance: high = needs attention soon or has money/security impact; low = safe to ignore.
- action: reply (someone expects an answer), decide, pay, follow_up (check on something), or none.
- retention: keep (records like statements, receipts, warranties, personal mail), archive_ok, or clutter_candidate (promotions, generic newsletters). Unwanted is not the same as spam.
- deadline: only if a date is stated or clearly implied; set deadline_explicit=true only when the email states it.
- Security alerts are high importance but may be phishing: say so in reason if anything looks off.
- If you are unsure, set uncertain=true rather than guessing confidently.

${UNTRUSTED_CONTENT_RULES}`;

export type PromptItem = {
  id: number;
  account: string;
  source: string;
  from: string;
  subject: string;
  receivedAt: Date;
  preview: string;
};

export function buildUserContent(items: PromptItem[]): string {
  const blocks = items.map((it) =>
    wrapUntrusted(it.id, {
      account: `${it.source}:${it.account}`,
      from: it.from,
      subject: it.subject,
      received: it.receivedAt.toISOString(),
      preview: it.preview,
    }),
  );
  return `Label these ${items.length} emails.\n\n${blocks.join('\n\n')}`;
}
