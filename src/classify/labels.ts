import type { NewClassification, RawItem } from '../db/schema.js';
import { PROMPT_VERSION, type PromptItem } from './prompt.js';
import { fallbackLabel, parseLabel, type Label } from './schema.js';

// Pure helpers (no DB or network) so they can be unit-tested.

export function toPromptItem(item: RawItem, id: number): PromptItem {
  const payload = (item.payload ?? {}) as Record<string, unknown>;
  return {
    id,
    source: item.source,
    account: item.account,
    from: typeof payload.from === 'string' ? payload.from : '',
    subject: item.title ?? '',
    receivedAt: item.occurredAt,
    preview: item.snippet ?? '',
  };
}

/**
 * Turn the model's tool input into one label per expected id.
 * Missing or invalid entries get a fallback label marked uncertain — never a guess.
 */
export function labelsFromToolInput(input: unknown, ids: number[]): Map<number, Label> {
  const proposed = new Map<number, Label>();
  const list = (input as { labels?: unknown })?.labels;
  if (Array.isArray(list)) {
    for (const raw of list) {
      const label = parseLabel(raw);
      if (label && ids.includes(label.id) && !proposed.has(label.id)) proposed.set(label.id, label);
    }
  }
  const out = new Map<number, Label>();
  for (const id of ids) out.set(id, proposed.get(id) ?? fallbackLabel(id, 'Model output missing or invalid for this email.'));
  return out;
}

export function toRow(item: RawItem, label: Label, model: string): NewClassification {
  return {
    rawItemId: item.id,
    promptVersion: PROMPT_VERSION,
    model,
    purpose: label.purpose,
    importance: label.importance,
    action: label.action,
    retention: label.retention,
    deadline: label.deadline ? new Date(label.deadline) : null,
    deadlineExplicit: label.deadline ? label.deadline_explicit : false,
    reason: label.reason,
    uncertain: label.uncertain,
  };
}
