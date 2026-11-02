import { z } from 'zod';

export const PURPOSES = [
  'personal',          // a real person writing to you
  'order_update',      // shipping, delivery, cancellation, refund
  'receipt',           // purchase or payment confirmation
  'bank_statement',
  'bank_transaction',  // individual transaction / balance alert
  'bill_payment',      // a bill or payment due
  'security_alert',    // sign-in, password, fraud, 2FA
  'account_notice',    // terms change, account update, subscription status
  'promotion',         // offers, discounts, sales, recommendations
  'newsletter',
  'social',            // social network notifications
  'other',
] as const;

export const IMPORTANCE = ['high', 'normal', 'low'] as const;
export const ACTIONS = ['reply', 'decide', 'pay', 'follow_up', 'none'] as const;
export const RETENTION = ['keep', 'archive_ok', 'clutter_candidate'] as const;

export const labelSchema = z.object({
  id: z.number().int(),
  purpose: z.enum(PURPOSES),
  importance: z.enum(IMPORTANCE),
  action: z.enum(ACTIONS),
  retention: z.enum(RETENTION),
  deadline: z.string().nullable(),
  deadline_explicit: z.boolean(),
  reason: z.string().min(1).max(300),
  uncertain: z.boolean(),
});

export type Label = z.infer<typeof labelSchema>;

/** JSON schema for the model's tool input (kept in sync with labelSchema by tests). */
export const labelToolSchema = {
  type: 'object',
  properties: {
    labels: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'integer', description: 'The id attribute of the <email> block' },
          purpose: { type: 'string', enum: [...PURPOSES] },
          importance: { type: 'string', enum: [...IMPORTANCE] },
          action: { type: 'string', enum: [...ACTIONS], description: 'What the reader needs to do, if anything' },
          retention: { type: 'string', enum: [...RETENTION], description: 'Worth keeping, fine to archive, or likely clutter' },
          deadline: { type: ['string', 'null'], description: 'ISO 8601 date/time if a deadline exists, else null' },
          deadline_explicit: { type: 'boolean', description: 'true only if the email states the deadline; false if inferred' },
          reason: { type: 'string', description: 'One short sentence explaining the label' },
          uncertain: { type: 'boolean', description: 'true if the label is a guess' },
        },
        required: ['id', 'purpose', 'importance', 'action', 'retention', 'deadline', 'deadline_explicit', 'reason', 'uncertain'],
      },
    },
  },
  required: ['labels'],
} as const;

/** Validate a model-proposed label. Returns null if it doesn't match the schema. */
export function parseLabel(raw: unknown): Label | null {
  const r = labelSchema.safeParse(raw);
  if (!r.success) return null;
  if (r.data.deadline !== null && Number.isNaN(Date.parse(r.data.deadline))) {
    return { ...r.data, deadline: null, deadline_explicit: false };
  }
  return r.data;
}

/** The label stored when the model output for a message is missing or invalid. */
export function fallbackLabel(id: number, why: string): Label {
  return {
    id,
    purpose: 'other',
    importance: 'normal',
    action: 'none',
    retention: 'keep',
    deadline: null,
    deadline_explicit: false,
    reason: why,
    uncertain: true,
  };
}
