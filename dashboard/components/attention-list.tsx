import type { AttentionItem } from '../lib/queries';
import { relativeTime } from '../lib/utils';
import { recordFeedback } from '../app/actions';

const ACTION_LABEL: Record<string, string> = {
  reply: 'REPLY',
  decide: 'DECIDE',
  pay: 'PAY',
  follow_up: 'FOLLOW UP',
  none: 'FYI',
};

const mono = { fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', letterSpacing: '0.04em' } as const;
const label = { fontFamily: '"Inter", sans-serif', fontWeight: 800, fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase' } as const;

function formatDeadline(d: Date | string): string {
  return new Date(d)
    .toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Karachi' })
    .toUpperCase();
}

function FeedbackButton({ item, decision, text }: { item: AttentionItem; decision: string; text: string }) {
  const active = item.feedback === decision;
  return (
    <form action={recordFeedback}>
      <input type="hidden" name="rawItemId" value={item.rawItemId} />
      <input type="hidden" name="classificationId" value={item.classificationId} />
      <input type="hidden" name="decision" value={decision} />
      <button
        type="submit"
        aria-pressed={active}
        style={{
          ...mono,
          padding: '4px 8px',
          border: '1px solid var(--border)',
          backgroundColor: active ? 'var(--text1)' : 'var(--background)',
          color: active ? 'var(--background)' : 'var(--text1)',
          cursor: 'pointer',
        }}
      >
        {text}
      </button>
    </form>
  );
}

export function AttentionList({ items }: { items: AttentionItem[] | null }) {
  // Tables not migrated yet, or the query failed: render nothing rather than break the page.
  if (items === null) return null;

  return (
    <section style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--background)' }}>
      <div
        style={{
          padding: '10px 32px',
          backgroundColor: 'var(--surface1)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
        }}
      >
        <span style={{ ...label, color: 'var(--text1)' }}>Attention</span>
        <span style={{ ...mono, color: 'var(--text3)' }}>{items.length}&nbsp;OPEN</span>
      </div>

      {items.length === 0 ? (
        <p style={{ ...mono, padding: '16px 32px', color: 'var(--text3)', margin: 0 }}>NOTHING NEEDS YOU RIGHT NOW.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {items.map((item) => (
            <li
              key={item.rawItemId}
              style={{
                padding: '12px 32px',
                borderBottom: '1px solid var(--grid)',
                display: 'grid',
                gridTemplateColumns: '96px 1fr auto',
                gap: '16px',
                alignItems: 'start',
              }}
            >
              {/* What to do */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span
                  style={{
                    ...label,
                    fontSize: '10px',
                    padding: '2px 6px',
                    alignSelf: 'flex-start',
                    backgroundColor: item.importance === 'high' ? 'var(--accent)' : 'var(--text1)',
                    color: 'var(--on-accent)',
                  }}
                >
                  {ACTION_LABEL[item.action] ?? item.action}
                </span>
                {item.uncertain && <span style={{ ...mono, color: 'var(--warning)' }}>UNSURE</span>}
              </div>

              {/* The message */}
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline', flexWrap: 'wrap' }}>
                  {item.url ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontFamily: '"Inter", sans-serif', fontWeight: 600, fontSize: '14px', color: 'var(--text1)' }}
                    >
                      {item.title ?? '(no subject)'}
                    </a>
                  ) : (
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{item.title ?? '(no subject)'}</span>
                  )}
                  {item.feedback === 'important' && <span style={{ ...mono, color: 'var(--accent)' }}>★ IMPORTANT</span>}
                </div>
                <div style={{ ...mono, color: 'var(--text2)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.source.toUpperCase()}·{item.account.toUpperCase()} — {item.from ?? ''} — {relativeTime(item.occurredAt)}
                </div>
                <div style={{ fontFamily: '"Inter", sans-serif', fontSize: '13px', color: 'var(--text1)', marginTop: '6px' }}>
                  {item.reason}
                </div>
                {item.deadline && (
                  <div style={{ ...mono, marginTop: '4px', color: item.deadlineExplicit ? 'var(--accent)' : 'var(--text3)' }}>
                    {item.deadlineExplicit ? 'DUE' : 'MAYBE BY'}&nbsp;{formatDeadline(item.deadline)}
                    {!item.deadlineExplicit && ' (INFERRED)'}
                  </div>
                )}
              </div>

              {/* Feedback */}
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <FeedbackButton item={item} decision="important" text="IMPORTANT" />
                <FeedbackButton item={item} decision="not_important" text="NOT IMPORTANT" />
                <FeedbackButton item={item} decision="keep" text="KEEP" />
                <FeedbackButton item={item} decision="done" text="DONE" />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
