'use client';

import { useEffect, useState } from 'react';

type Holding = {
  symbol: string;
  shares: number;
  buyPrice: number;
  currentPrice: number | null;
  change: number | null;
  changePercent: number | null;
  pnl: number | null;
  pnlPercent: number | null;
  lastTradeDate: string | null;
  error: boolean;
};

type Totals = {
  invested: number;
  current: number;
  pnl: number;
  pnlPercent: number;
};

type StocksState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ok'; holdings: Holding[]; totals: Totals | null };

const BORDER = '1px solid var(--border)';
const MONO: React.CSSProperties = { fontFamily: '"JetBrains Mono", monospace' };

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function sign(n: number): string {
  return n >= 0 ? '+' : '−';
}

function PnlColor({ value, children }: { value: number | null; children: React.ReactNode }) {
  const color =
    value === null
      ? 'var(--text4)'
      : value > 0
      ? 'var(--success)'
      : value < 0
      ? 'var(--error)'
      : 'var(--text2)';
  return <span style={{ color }}>{children}</span>;
}

export function StocksStrip() {
  const [state, setState] = useState<StocksState>({ status: 'loading' });

  useEffect(() => {
    fetch('/api/stocks')
      .then(async (res) => {
        if (!res.ok) {
          const { error } = await res.json();
          setState({ status: 'error', message: error ?? 'STOCKS UNAVAILABLE' });
          return;
        }
        const data = await res.json();
        setState({ status: 'ok', holdings: data.holdings, totals: data.totals });
      })
      .catch(() => setState({ status: 'error', message: 'STOCKS UNAVAILABLE' }));
  }, []);

  if (state.status === 'loading') {
    return (
      <div style={{ borderBottom: BORDER, padding: '14px 32px', ...MONO, fontSize: '10px', letterSpacing: '0.1em', color: 'var(--text4)' }}>
        FETCHING PSX DATA...
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div style={{ borderBottom: BORDER, padding: '14px 32px', ...MONO, fontSize: '10px', letterSpacing: '0.1em', color: 'var(--text4)' }}>
        {state.message}
      </div>
    );
  }

  const { holdings, totals } = state;

  return (
    <div style={{ borderBottom: BORDER, display: 'flex', alignItems: 'stretch', backgroundColor: 'var(--surface1)', overflow: 'hidden' }}>

      {/* ── Portfolio summary ── */}
      <div
        style={{
          borderRight: BORDER,
          padding: '16px 24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '10px',
          minWidth: '220px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
          <span
            style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 800,
              fontSize: '11px',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: 'var(--text1)',
            }}
          >
            PSX Portfolio
          </span>
          {holdings[0]?.lastTradeDate && (
            <span style={{ ...MONO, fontSize: '9px', letterSpacing: '0.08em', color: 'var(--text4)' }}>
              AS OF {holdings[0].lastTradeDate.toUpperCase()}
            </span>
          )}
        </div>

        {totals ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ ...MONO, fontSize: '22px', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1 }}>
                PKR {fmt(totals.current, 0)}
              </span>
            </div>
            <div style={{ ...MONO, fontSize: '9.5px', letterSpacing: '0.06em', display: 'flex', gap: '10px' }}>
              <PnlColor value={totals.pnl}>
                {sign(totals.pnl)} PKR {fmt(Math.abs(totals.pnl), 0)}&nbsp;({sign(totals.pnlPercent)}{fmt(Math.abs(totals.pnlPercent))}%)
              </PnlColor>
            </div>
            <div style={{ ...MONO, fontSize: '9px', letterSpacing: '0.06em', color: 'var(--text3)' }}>
              COST&nbsp;PKR {fmt(totals.invested, 0)}
            </div>
          </div>
        ) : (
          <span style={{ ...MONO, fontSize: '10px', color: 'var(--text4)', letterSpacing: '0.06em' }}>NO DATA</span>
        )}
      </div>

      {/* ── Individual holdings ── */}
      <div style={{ display: 'flex', flex: 1, overflowX: 'auto' }}>
        {holdings.map((h, i) => (
          <div
            key={h.symbol}
            style={{
              borderRight: i < holdings.length - 1 ? BORDER : 'none',
              padding: '14px 20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '6px',
              minWidth: '160px',
              flexShrink: 0,
            }}
          >
            {/* Symbol + market state */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <span
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 800,
                  fontSize: '12px',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--text1)',
                }}
              >
                {h.symbol}
              </span>
            </div>

            {/* Price + day change */}
            {h.currentPrice !== null ? (
              <div>
                <div style={{ ...MONO, fontSize: '16px', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1 }}>
                  {fmt(h.currentPrice)}
                </div>
                <PnlColor value={h.change}>
                  <span style={{ ...MONO, fontSize: '10px', letterSpacing: '0.02em' }}>
                    {sign(h.change!)} {fmt(Math.abs(h.change!))} ({sign(h.changePercent!)}{fmt(Math.abs(h.changePercent!))}%)
                  </span>
                </PnlColor>
              </div>
            ) : (
              <span style={{ ...MONO, fontSize: '11px', color: 'var(--text4)' }}>—</span>
            )}

            {/* Your P&L */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <PnlColor value={h.pnl}>
                <span style={{ ...MONO, fontSize: '10px', fontWeight: 500, letterSpacing: '0.02em' }}>
                  {h.pnl !== null ? `${sign(h.pnl)} PKR ${fmt(Math.abs(h.pnl), 0)}` : '—'}
                </span>
              </PnlColor>
              <span style={{ ...MONO, fontSize: '9px', color: 'var(--text3)', letterSpacing: '0.04em' }}>
                {h.shares} shares · cost {fmt(h.buyPrice)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
