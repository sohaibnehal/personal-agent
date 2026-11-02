'use server';

import { revalidatePath } from 'next/cache';
import { db } from '../lib/db';
import { feedbackEvents } from '@schema';

const FEEDBACK_DECISIONS = ['important', 'not_important', 'keep', 'done'] as const;
type Decision = (typeof FEEDBACK_DECISIONS)[number];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Record one feedback click. Append-only: the latest event per message wins.
 * Feedback only changes what the dashboard shows and what the classifier learns from;
 * it never changes anything in a mailbox.
 */
export async function recordFeedback(formData: FormData): Promise<void> {
  const rawItemId = String(formData.get('rawItemId') ?? '');
  const classificationId = String(formData.get('classificationId') ?? '');
  const decision = String(formData.get('decision') ?? '') as Decision;

  if (!UUID.test(rawItemId)) throw new Error('Invalid message id');
  if (!FEEDBACK_DECISIONS.includes(decision)) throw new Error('Invalid decision');

  await db.insert(feedbackEvents).values({
    rawItemId,
    classificationId: UUID.test(classificationId) ? classificationId : null,
    decision,
  });
  revalidatePath('/');
}
