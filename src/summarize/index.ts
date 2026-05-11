import Anthropic from '@anthropic-ai/sdk';
import type { RawItem } from '../db/schema.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPTS: Record<string, string> = {
  gmail: `You are summarizing new emails for a busy developer's morning briefing.
Be terse. Group by importance, not by sender. For each group, use a short heading
and 1-line bullets. Highlight: action requested, deadlines, replies expected.
Skip newsletters and notifications unless something inside is unusual. Use markdown.`,
  outlook: `You are summarizing new Outlook emails for a developer's morning briefing.

Each item in the input has a URL. When you reference a specific email, link it:
[Subject](url). Only link emails you are explicitly calling out.

Target length: 300–500 words.

Output structure (markdown):

One headline sentence capturing volume and dominant themes.
Example: "12 new emails — 3 direct asks, a customer escalation, and a deadline tomorrow."

## Inbox

Group by sender or thread topic (not individual emails). For each group: 2–4 sentences
of prose covering who is involved, what the thread is about, and its current state.
Bold a group name only if it needs attention today. Reference specific emails with links
inside the prose naturally — don't list every email.

**Needs attention:** A short bullet list of emails that meet one or more of:
- contains a direct ask, question, or decision request
- mentions a deadline or time-sensitive action
- awaiting a reply from you
- from a customer, external party, or leadership

Each bullet gets 2 sentences: first, the context and sender; second, what's needed.
Format each as [Subject](url) — action or ask.
If nothing qualifies, write "Nothing urgent."

No nested bullet lists inside group prose. No snippets re-stated verbatim.`,
  teams: `You are summarizing new Teams messages. Group by chat/channel. Note
@mentions of the user explicitly. Skip pure social chatter. Markdown.`,
  asana: `You are synthesizing Asana task activity into a morning briefing for a developer.
The full task list lives in a database — do NOT enumerate every task. The goal is to convey
the shape of the workload so the reader knows where to focus, not to list everything.

Each item in the input has a URL. When you reference a specific task by name, link it:
[Task Name](url). Only link tasks you are explicitly calling out — not every task mentioned
in passing while describing a theme.

Target length: 300–500 words.

Output structure (markdown):

One headline sentence capturing volume and dominant themes.
Example: "17 tasks open — heavy on RBAC backend (4) and accessibility bugs (5). Two need decisions this week."

## Assigned to me

Group tasks by theme. For each theme: 2–4 sentences of prose covering what the work is,
how many tasks, and the overall state. Bold a theme name only if it needs attention today.
Mention the more important specific tasks (with links) inside the prose naturally — don't
just list them.

**Needs attention:** A short bullet list of tasks that meet one or more of:
- needs a decision from me
- blocked on someone else
- has an external dependency or deadline in the notes
- created more than 2 weeks ago and still not started

Each bullet gets 2 sentences: first, what the task is and its context; second, what's
needed or what's blocking it. Format each as [Task Name](url) — action or blocker.
If nothing qualifies, write "No blockers or decisions needed."

## Following

Same rules. These are tasks assigned to others that I'm watching. 2–4 sentences per
theme. Focus the "Needs attention" bullets on tasks where my input may unblock something
or where progress has visibly stalled.

No nested bullet lists inside theme prose. No snippets re-stated verbatim.`,
};

/**
 * Summarize a batch of items for a given source.
 * Returns markdown ready to store in `briefings.summary`.
 */
export async function summarize(source: string, items: RawItem[]): Promise<string> {
  if (items.length === 0) {
    return '_Nothing new._';
  }

  // Compact, structured payload — keeps tokens down vs. dumping raw JSON.
  const lines = items.map((item, i) => {
    const time = item.occurredAt.toISOString();
    const from = (item.payload as Record<string, unknown>)?.from ?? '';
    return `[${i + 1}] ${time} | ${item.title ?? ''} | ${item.url ?? ''} | ${from}\n    ${item.snippet ?? ''}`;
  });

  const system = SYSTEM_PROMPTS[source] ?? 'Summarize the following items in markdown. Be terse.';

  const res = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1024,
    system,
    messages: [
      {
        role: 'user',
        content: `Summarize these ${items.length} new items:\n\n${lines.join('\n')}`,
      },
    ],
  });

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  return text || '_Summary unavailable._';
}
