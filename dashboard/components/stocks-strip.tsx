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
      <div style={{ borderBottom: BORDER, padding: '5px 16px', ...MONO, fontSize: '10px', letterSpacing: '0.1em', color: 'var(--text4)' }}>
        FETCHING PSX DATA...
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div style={{ borderBottom: BORDER, padding: '5px 16px', ...MONO, fontSize: '10px', letterSpacing: '0.1em', color: 'var(--text4)' }}>
        {state.message}
      </div>
    );
  }

  const { holdings, totals } = state;

  return (
    <div style={{ borderBottom: BORDER, display: 'flex', alignItems: 'center', backgroundColor: 'var(--surface1)', overflow: 'hidden' }}>

      {/* ── Portfolio summary — single inline row ── */}
      <div
        style={{
          borderRight: BORDER,
          padding: '5px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
          PSX
        </span>
        {totals ? (
          <>
            <span style={{ ...MONO, fontSize: '13px', fontWeight: 600, letterSpacing: '-0.02em' }}>
              PKR {fmt(totals.current, 0)}
            </span>
            <PnlColor value={totals.pnl}>
              <span style={{ ...MONO, fontSize: '9px', letterSpacing: '0.04em' }}>
                {sign(totals.pnl)}{fmt(Math.abs(totals.pnlPercent))}%
              </span>
            </PnlColor>
          </>
        ) : (
          <span style={{ ...MONO, fontSize: '10px', color: 'var(--text4)' }}>NO DATA</span>
        )}
        {holdings[0]?.lastTradeDate && (
          <span style={{ ...MONO, fontSize: '9px', color: 'var(--text4)', letterSpacing: '0.06em' }}>
            {holdings[0].lastTradeDate.toUpperCase()}
          </span>
        )}
      </div>

      {/* ── Individual holdings ── */}
      <div style={{ display: 'flex' }}>
        {holdings.map((h, i) => (
          <div
            key={h.symbol}
            style={{
              borderRight: i < holdings.length - 1 ? BORDER : 'none',
              padding: '5px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {h.symbol}
            </span>
            {h.currentPrice !== null ? (
              <>
                <span style={{ ...MONO, fontSize: '12px', fontWeight: 600, letterSpacing: '-0.01em' }}>
                  {fmt(h.currentPrice)}
                </span>
                <PnlColor value={h.change}>
                  <span style={{ ...MONO, fontSize: '9px', letterSpacing: '0.02em' }}>
                    {sign(h.changePercent!)}{fmt(Math.abs(h.changePercent!))}%
                  </span>
                </PnlColor>
                <PnlColor value={h.pnl}>
                  <span style={{ ...MONO, fontSize: '9px', letterSpacing: '0.02em' }}>
                    {sign(h.pnl!)}PKR {fmt(Math.abs(h.pnl!), 0)}
                  </span>
                </PnlColor>
              </>
            ) : (
              <span style={{ ...MONO, fontSize: '10px', color: 'var(--text4)' }}>—</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
