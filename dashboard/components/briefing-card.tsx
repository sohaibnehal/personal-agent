import type { BriefingSummary } from '../lib/queries';
import { relativeTime, isStale } from '../lib/utils';
import { StaleIndicator } from './stale-indicator';
import { MarkdownRenderer } from './markdown-renderer';

type Props = {
  source: string;
  account: string;
  briefing: BriefingSummary | null;
  cursorUpdatedAt: Date | undefined;
};

export function BriefingCard({ source, account, briefing, cursorUpdatedAt }: Props) {
  const stale = briefing ? isStale(briefing.generatedAt) : false;

  return (
    <article style={{ backgroundColor: 'var(--background)' }}>
      {/* Card header — departure board row */}
      <div
        style={{
          backgroundColor: 'var(--surface1)',
          borderBottom: '1px solid var(--border)',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        {/* Left: source · account + stale badge */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span
            style={{
              fontFamily: '"Inter", sans-serif',
              fontWeight: 800,
              fontSize: '11px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--text1)',
            }}
          >
            {source}
          </span>
          <span style={{ color: 'var(--text4)', fontSize: '11px' }}>·</span>
          <span
            style={{
              fontFamily: '"Inter", sans-serif',
              fontWeight: 500,
              fontSize: '11px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text2)',
            }}
          >
            {account}
          </span>
          {stale && (
            <span style={{ marginLeft: '4px' }}>
              <StaleIndicator />
            </span>
          )}
        </div>

        {/* Right: item count + timestamp */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: '16px',
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '11px',
            fontWeight: 500,
            color: 'var(--text3)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {briefing ? (
            <>
              <span>{briefing.itemCount}&nbsp;ITEMS</span>
              <span>{relativeTime(briefing.generatedAt)}</span>
            </>
          ) : cursorUpdatedAt ? (
            <span>CHECKED&nbsp;{relativeTime(cursorUpdatedAt)}</span>
          ) : null}
        </div>
      </div>

      {/* Card body */}
      <div style={{ padding: '20px 20px 24px' }}>
        {briefing ? (
          <MarkdownRenderer content={briefing.summary} />
        ) : (
          <p
            style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '11px',
              fontWeight: 500,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--text4)',
            }}
          >
            NO NEW ITEMS
          </p>
        )}
      </div>
    </article>
  );
}
