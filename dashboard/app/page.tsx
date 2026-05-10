import { getLatestBriefingsBySource, getCursorState } from '../lib/queries';
import { formatDate, formatTime, relativeTime } from '../lib/utils';
import { BriefingCard } from '../components/briefing-card';
import { EmptyState } from '../components/empty-state';

// Always fetch fresh data — no Next.js static cache
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [briefings, cursors] = await Promise.all([
    getLatestBriefingsBySource(),
    getCursorState(),
  ]);

  const now = new Date();

  const lastRun = cursors.reduce<Date | null>((max, c) => {
    const t = new Date(c.updatedAt);
    return max === null || t > max ? t : max;
  }, null);

  const cursorMap = new Map(
    cursors.map((c) => [`${c.source}:${c.account}`, new Date(c.updatedAt)]),
  );

  // Sources that have a cursor but no briefing row yet
  const briefingKeys = new Set(briefings.map((b) => `${b.source}:${b.account}`));
  const pendingSources = cursors.filter((c) => !briefingKeys.has(`${c.source}:${c.account}`));

  const isEmpty = briefings.length === 0 && cursors.length === 0;
  const totalCards = briefings.length + pendingSources.length;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)' }}>
      {/* ── Dispatch header ── */}
      <header
        style={{
          backgroundColor: 'var(--text1)',
          color: 'var(--on-accent)',
          padding: '16px 32px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: '24px',
          }}
        >
          {/* Brand mark */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span
              style={{
                display: 'inline-block',
                width: '10px',
                height: '10px',
                backgroundColor: 'var(--accent)',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: '"Inter", sans-serif',
                fontWeight: 800,
                fontSize: '13px',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: 'var(--on-accent)',
              }}
            >
              Briefing Agent
            </span>
          </div>

          {/* Timetable metadata */}
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '32px',
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '11px',
              fontWeight: 500,
              letterSpacing: '0.06em',
            }}
          >
            <span style={{ color: '#ffffff' }}>
              {formatDate(now)}&nbsp;&nbsp;{formatTime(now)}
            </span>
            {lastRun && (
              <span style={{ color: 'var(--text2)' }}>
                LAST RUN&nbsp;&nbsp;
                <span style={{ color: '#ffffff' }}>{relativeTime(lastRun)}</span>
              </span>
            )}
            {!lastRun && (
              <span style={{ color: 'var(--text2)' }}>NO RUNS YET</span>
            )}
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="grid-bg" style={{ padding: '32px' }}>
        {isEmpty ? (
          <EmptyState />
        ) : (
          /* Card grid — 1px black gap between cards acts as hairline borders */
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: totalCards === 1 ? '1fr' : 'repeat(auto-fill, minmax(480px, 1fr))',
              gap: '1px',
              backgroundColor: 'var(--border)',
              border: '1px solid var(--border)',
            }}
          >
            {briefings.map((b) => (
              <BriefingCard
                key={`${b.source}:${b.account}`}
                source={b.source}
                account={b.account}
                briefing={b}
                cursorUpdatedAt={cursorMap.get(`${b.source}:${b.account}`)}
              />
            ))}
            {pendingSources.map((c) => (
              <BriefingCard
                key={`${c.source}:${c.account}`}
                source={c.source}
                account={c.account}
                briefing={null}
                cursorUpdatedAt={new Date(c.updatedAt)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
