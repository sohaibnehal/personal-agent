import { NextResponse } from 'next/server';
import portfolio from '../../../data/portfolio.json';

// PSX trades Mon–Fri 09:30–15:30 PKT (UTC+5 = UTC+300min)
function isPSXOpen(): boolean {
  const now = new Date();
  const pkt = new Date(now.getTime() + 5 * 60 * 60 * 1000);
  const day = pkt.getUTCDay(); // 0=Sun,6=Sat
  if (day === 0 || day === 6) return false;
  const mins = pkt.getUTCHours() * 60 + pkt.getUTCMinutes();
  return mins >= 9 * 60 + 30 && mins < 15 * 60 + 30;
}

function dateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

async function fetchEOD(symbol: string): Promise<number[][] | null> {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 10); // enough to cover weekends + holidays

  const url =
    `https://dps.psx.com.pk/timeseries/eod/${symbol}` +
    `?start=${dateStr(start)}&end=${dateStr(end)}`;

  try {
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const json = await res.json();
    // each row: [unix_timestamp, close, volume, open]
    return (json?.data as number[][]) ?? null;
  } catch {
    return null;
  }
}

export async function GET() {
  if (portfolio.length === 0) {
    return NextResponse.json({ holdings: [], totals: null });
  }

  const results = await Promise.all(portfolio.map((h) => fetchEOD(h.symbol)));
  const marketOpen = isPSXOpen();

  let totalInvested = 0;
  let totalCurrent = 0;

  const holdings = portfolio.map((h, i) => {
    const rows = results[i];
    totalInvested += h.buyPrice * h.shares;

    if (!rows || rows.length < 1) {
      return {
        symbol: h.symbol,
        shares: h.shares,
        buyPrice: h.buyPrice,
        currentPrice: null as number | null,
        prevClose: null as number | null,
        change: null as number | null,
        changePercent: null as number | null,
        pnl: null as number | null,
        pnlPercent: null as number | null,
        lastTradeDate: null as string | null,
        marketOpen,
        error: true,
      };
    }

    // rows are newest-first
    const [latestTs, latestClose] = rows[0];
    const prevClose = rows.length > 1 ? rows[1][1] : latestClose;
    const change = latestClose - prevClose;
    const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0;
    const pnl = (latestClose - h.buyPrice) * h.shares;
    const pnlPercent = ((latestClose - h.buyPrice) / h.buyPrice) * 100;

    totalCurrent += latestClose * h.shares;

    const lastTradeDate = new Date(latestTs * 1000).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      timeZone: 'Asia/Karachi',
    });

    return {
      symbol: h.symbol,
      shares: h.shares,
      buyPrice: h.buyPrice,
      currentPrice: latestClose,
      prevClose,
      change,
      changePercent,
      pnl,
      pnlPercent,
      lastTradeDate,
      marketOpen,
      error: false,
    };
  });

  const totalPnl = totalCurrent - totalInvested;
  const totalPnlPercent = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

  return NextResponse.json({
    holdings,
    totals: {
      invested: totalInvested,
      current: totalCurrent,
      pnl: totalPnl,
      pnlPercent: totalPnlPercent,
    },
  });
}
