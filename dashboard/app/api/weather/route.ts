import { NextRequest, NextResponse } from 'next/server';
import { fetchOWMCurrent } from '../../../lib/owm';

const OWM = 'https://api.openweathermap.org';

export async function GET(req: NextRequest) {
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) {
    return NextResponse.json({ error: 'OPENWEATHER_API_KEY not set' }, { status: 500 });
  }

  const { searchParams } = req.nextUrl;
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');
  if (!lat || !lon) {
    return NextResponse.json({ error: 'lat and lon are required' }, { status: 400 });
  }

  const qs = `lat=${lat}&lon=${lon}&appid=${key}&units=metric`;

  const [geoRes, currentOut, forecastRes] = await Promise.all([
    fetch(`${OWM}/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${key}`, {
      next: { revalidate: 900 },
    }),
    fetchOWMCurrent(Number(lat), Number(lon)),
    fetch(`${OWM}/data/2.5/forecast?${qs}&cnt=40`, { next: { revalidate: 900 } }),
  ]);

  if (!currentOut) {
    return NextResponse.json({ error: 'OWM error: failed to fetch current weather' }, { status: 502 });
  }

  const [geoData, forecastData] = await Promise.all([
    geoRes.json(),
    forecastRes.json(),
  ]);

  // Reverse geo
  const geo = Array.isArray(geoData) ? geoData[0] : null;
  const city = (geo?.name ?? 'UNKNOWN').toUpperCase();
  const country = (geo?.country ?? '').toUpperCase();

  // Aggregate 3-hour slots into daily high/low.
  // Group by local date string from dt_txt ("2026-05-11 12:00:00" → "2026-05-11").
  type Slot = {
    dt: number;
    main: { temp_max: number; temp_min: number };
    weather: { id: number; description: string }[];
    dt_txt: string;
  };

  const byDay = new Map<string, { dt: number; highs: number[]; lows: number[]; noonSlot: Slot | null }>();

  for (const slot of forecastData.list as Slot[]) {
    const dateKey = slot.dt_txt.slice(0, 10);
    if (!byDay.has(dateKey)) {
      byDay.set(dateKey, { dt: slot.dt, highs: [], lows: [], noonSlot: null });
    }
    const entry = byDay.get(dateKey)!;
    entry.highs.push(slot.main.temp_max);
    entry.lows.push(slot.main.temp_min);
    // Prefer the slot closest to noon for the representative weather condition
    const hour = Number(slot.dt_txt.slice(11, 13));
    if (entry.noonSlot === null || Math.abs(hour - 12) < Math.abs(Number(entry.noonSlot.dt_txt.slice(11, 13)) - 12)) {
      entry.noonSlot = slot;
    }
  }

  const forecast = Array.from(byDay.values()).map(({ dt, highs, lows, noonSlot }) => ({
    dt,
    high: Math.round(Math.max(...highs)),
    low: Math.round(Math.min(...lows)),
    weatherId: noonSlot?.weather[0].id ?? 800,
    description: (noonSlot?.weather[0].description ?? '').toUpperCase(),
  }));

  return NextResponse.json({ city, country, current: currentOut, forecast });
}
