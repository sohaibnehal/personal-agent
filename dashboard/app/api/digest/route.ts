import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getLatestBriefingsBySource } from '../../../lib/queries';
import { fetchOWMCurrent, weatherIdToLabel } from '../../../lib/owm';
import portfolio from '../../../data/portfolio.json';

async function fetchWeather(lat: number, lon: number): Promise<string> {
  const w = await fetchOWMCurrent(lat, lon);
  if (!w) return 'unavailable';
  return `${w.temp}°C and ${weatherIdToLabel(w.weatherId)}`;
}

async function fetchPortfolioSummary(): Promise<string> {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 10);
  const s = start.toISOString().slice(0, 10);
  const e = end.toISOString().slice(0, 10);

  const results = await Promise.all(
    portfolio.map(async (h) => {
      try {
        const res = await fetch(`https://dps.psx.com.pk/timeseries/eod/${h.symbol}?start=${s}&end=${e}`);
        if (!res.ok) return null;
        const json = await res.json();
        const rows = json?.data as number[][];
        if (!rows || rows.length < 2) return null;
        return {
          symbol: h.symbol,
          shares: h.shares,
          buyPrice: h.buyPrice,
          close: rows[0][1],
          prevClose: rows[1][1],
        };
      } catch { return null; }
    })
  );

  const valid = results.filter(Boolean) as NonNullable<typeof results[number]>[];
  if (valid.length === 0) return 'unavailable';

  const totalCurrent = valid.reduce((sum, s) => sum + s!.close * s!.shares, 0);
  const totalInvested = valid.reduce((sum, s) => sum + s!.buyPrice * s!.shares, 0);
  const totalPnlPct = ((totalCurrent - totalInvested) / totalInvested) * 100;

  const movers = valid
    .map((s) => ({
      symbol: s!.symbol,
      changePct: ((s!.close - s!.prevClose) / s!.prevClose) * 100,
    }))
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));

  const dir = totalPnlPct >= 0 ? 'up' : 'down';
  const topMover = movers[0];
  const moverDir = topMover.changePct >= 0 ? 'up' : 'down';

  return `overall portfolio ${dir} ${Math.abs(totalPnlPct).toFixed(1)}% vs cost; biggest mover ${topMover.symbol} ${moverDir} ${Math.abs(topMover.changePct).toFixed(1)}% yesterday`;
}

export async function GET(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });

  const lat = Number(req.nextUrl.searchParams.get('lat') ?? 24.8607);
  const lon = Number(req.nextUrl.searchParams.get('lon') ?? 67.0011);

  const [weather, stockSummary, briefings] = await Promise.all([
    fetchWeather(lat, lon),
    fetchPortfolioSummary(),
    getLatestBriefingsBySource(),
  ]);

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Karachi',
  });

  const briefingBlurb = briefings.length > 0
    ? briefings.map((b) => `${b.source}: ${b.summary.slice(0, 300)}`).join('\n')
    : 'No briefings yet.';

  const prompt = `You are writing a one-sentence morning briefing for a professional in Karachi. Be extremely concise — one sentence, under 35 words. Weave together weather, markets, and work naturally. No lists, no labels.

Today: ${today}
Weather: ${weather}
Stocks (PSX, last EOD): ${stockSummary}
Work: ${briefingBlurb}`;

  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 80,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text.trim() : '';
  return NextResponse.json({ digest: text }, { headers: { 'Cache-Control': 's-maxage=7200' } });
}
