'use client';

import { useEffect, useState } from 'react';

type DayForecast = {
  dt: number;
  high: number;
  low: number;
  weatherId: number;
  description: string;
};

type WeatherState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ok';
      city: string;
      country: string;
      current: {
        temp: number;
        feelsLike: number;
        humidity: number;
        windKph: number;
        weatherId: number;
        description: string;
      };
      forecast: DayForecast[];
    };

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

// OWM condition ID → short label
function owmLabel(id: number): string {
  if (id === 800) return 'CLEAR';
  if (id === 801) return 'FEW CLD';
  if (id === 802) return 'P.CLOUDY';
  if (id >= 803) return 'OVERCAST';
  if (id >= 700) return 'FOG';
  if (id >= 600) return 'SNOW';
  if (id >= 500) return 'RAIN';
  if (id >= 300) return 'DRIZZLE';
  if (id >= 200) return 'TSTORM';
  return 'UNKNOWN';
}

function WeatherIcon({ id, size = 18 }: { id: number; size?: number }) {
  const sw = 1.5;
  const c = 'currentColor';

  // Clear sky
  if (id === 800) {
    return (
      <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="square">
        <circle cx="9" cy="9" r="3.5" />
        <line x1="9" y1="1" x2="9" y2="3" />
        <line x1="9" y1="15" x2="9" y2="17" />
        <line x1="1" y1="9" x2="3" y2="9" />
        <line x1="15" y1="9" x2="17" y2="9" />
        <line x1="3.4" y1="3.4" x2="4.7" y2="4.7" />
        <line x1="13.3" y1="13.3" x2="14.6" y2="14.6" />
        <line x1="14.6" y1="3.4" x2="13.3" y2="4.7" />
        <line x1="4.7" y1="13.3" x2="3.4" y2="14.6" />
      </svg>
    );
  }

  // Few clouds (801)
  if (id === 801) {
    return (
      <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="square" strokeLinejoin="miter">
        <circle cx="6.5" cy="5.5" r="2.5" />
        <line x1="6.5" y1="1.5" x2="6.5" y2="3" />
        <line x1="1.5" y1="5.5" x2="3" y2="5.5" />
        <line x1="3.1" y1="2.9" x2="4.2" y2="4" />
        <line x1="9.9" y1="2.9" x2="8.8" y2="4" />
        <path d="M4 11.5 C2.5 11.5 1.5 10.5 1.5 9.5 C1.5 8.5 2.5 7.5 4 8 C4.5 6.5 6 5.5 8 5.5 C10 5.5 11.5 7 12 8.5 C13 8 14 8.5 14.5 9.5 C15 9.5 16.5 10 16.5 11 C16.5 12 15.5 13 14 13 L4 11.5Z" />
      </svg>
    );
  }

  // Scattered / broken clouds (802-803)
  if (id === 802 || id === 803) {
    return (
      <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="square" strokeLinejoin="miter">
        <path d="M2 10 C0.5 10 0 9 0 8 C0 7 1 6 2.5 6.5 C3 4.5 4.5 3 7 3 C9 3 10.5 4.5 11 6 C12 5.5 13.5 6 14 7 C14.5 7 16 7.5 16 8.5 C16 9.5 15 10.5 13.5 10.5 L2 10Z" />
        <path d="M5 13 C4 13 3.5 12.5 3.5 12 C3.5 11.5 4 11 5 11.3 C5.2 10.5 6 10 7 10 C8 10 8.7 10.5 9 11 C9.5 10.8 10 11 10.3 11.5 C10.5 11.5 11 11.7 11 12.2 C11 12.7 10.5 13.2 9.8 13.2 L5 13Z" />
      </svg>
    );
  }

  // Overcast (804+)
  if (id >= 803) {
    return (
      <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="square" strokeLinejoin="miter">
        <path d="M2 13 C0.5 13 0 12 0 11 C0 10 1 9 2.5 9.5 C3 7.5 4.5 6 7 6 C9 6 10.5 7.5 11 9 C12 8.5 13.5 9 14 10 C14.5 10 16 10.5 16 11.5 C16 12.5 15 13.5 13.5 13.5 L2 13Z" />
      </svg>
    );
  }

  // Fog / atmosphere (700-799)
  if (id >= 700) {
    return (
      <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="square">
        <line x1="1" y1="5" x2="17" y2="5" />
        <line x1="3" y1="9" x2="15" y2="9" />
        <line x1="1" y1="13" x2="17" y2="13" />
      </svg>
    );
  }

  // Snow (600-699)
  if (id >= 600) {
    return (
      <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="square" strokeLinejoin="miter">
        <path d="M2 9.5 C0.5 9.5 0 8.5 0 7.5 C0 6.5 1 5.5 2.5 6 C3 4 4.5 2.5 7 2.5 C9 2.5 10.5 4 11 5.5 C12 5 13.5 5.5 14 6.5 C14.5 6.5 16 7 16 8 C16 9 15 10 13.5 10 L2 9.5Z" />
        <circle cx="4" cy="13.5" r="1" fill={c} stroke="none" />
        <circle cx="9" cy="13.5" r="1" fill={c} stroke="none" />
        <circle cx="14" cy="13.5" r="1" fill={c} stroke="none" />
        <circle cx="6.5" cy="16.5" r="1" fill={c} stroke="none" />
        <circle cx="11.5" cy="16.5" r="1" fill={c} stroke="none" />
      </svg>
    );
  }

  // Rain (500-599)
  if (id >= 500) {
    return (
      <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="square" strokeLinejoin="miter">
        <path d="M2 9.5 C0.5 9.5 0 8.5 0 7.5 C0 6.5 1 5.5 2.5 6 C3 4 4.5 2.5 7 2.5 C9 2.5 10.5 4 11 5.5 C12 5 13.5 5.5 14 6.5 C14.5 6.5 16 7 16 8 C16 9 15 10 13.5 10 L2 9.5Z" />
        <line x1="4" y1="13" x2="4" y2="16" />
        <line x1="9" y1="12.5" x2="9" y2="15.5" />
        <line x1="14" y1="13" x2="14" y2="16" />
      </svg>
    );
  }

  // Drizzle (300-499)
  if (id >= 300) {
    return (
      <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="square" strokeLinejoin="miter">
        <path d="M2 9.5 C0.5 9.5 0 8.5 0 7.5 C0 6.5 1 5.5 2.5 6 C3 4 4.5 2.5 7 2.5 C9 2.5 10.5 4 11 5.5 C12 5 13.5 5.5 14 6.5 C14.5 6.5 16 7 16 8 C16 9 15 10 13.5 10 L2 9.5Z" />
        <line x1="5" y1="12.5" x2="5" y2="14.5" />
        <line x1="9" y1="12.5" x2="9" y2="14.5" />
        <line x1="13" y1="12.5" x2="13" y2="14.5" />
      </svg>
    );
  }

  // Thunderstorm (200-299)
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="square" strokeLinejoin="miter">
      <path d="M2 8.5 C0.5 8.5 0 7.5 0 6.5 C0 5.5 1 4.5 2.5 5 C3 3 4.5 1.5 7 1.5 C9 1.5 10.5 3 11 4.5 C12 4 13.5 4.5 14 5.5 C14.5 5.5 16 6 16 7 C16 8 15 9 13.5 9 L2 8.5Z" />
      <polyline points="10,10 7,14 10.5,14 7,18" />
    </svg>
  );
}

const BORDER = '1px solid var(--border)';
const MONO: React.CSSProperties = { fontFamily: '"JetBrains Mono", monospace' };

export function WeatherStrip() {
  const [state, setState] = useState<WeatherState>({ status: 'loading' });

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setState({ status: 'error', message: 'GEOLOCATION NOT SUPPORTED' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude: lat, longitude: lon } }) => {
        try {
          const res = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
          if (!res.ok) {
            const { error } = await res.json();
            setState({ status: 'error', message: error ?? 'WEATHER UNAVAILABLE' });
            return;
          }
          const data = await res.json();
          setState({ status: 'ok', ...data });
        } catch {
          setState({ status: 'error', message: 'WEATHER UNAVAILABLE' });
        }
      },
      () => setState({ status: 'error', message: 'LOCATION DENIED — ALLOW ACCESS TO SEE WEATHER' }),
      { timeout: 12000 }
    );
  }, []);

  if (state.status === 'loading') {
    return (
      <div
        style={{
          borderBottom: BORDER,
          padding: '5px 16px',
          ...MONO,
          fontSize: '10px',
          letterSpacing: '0.1em',
          color: 'var(--text4)',
        }}
      >
        FETCHING WEATHER...
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div
        style={{
          borderBottom: BORDER,
          padding: '5px 16px',
          ...MONO,
          fontSize: '10px',
          letterSpacing: '0.1em',
          color: 'var(--text4)',
        }}
      >
        {state.message}
      </div>
    );
  }

  const { city, country, current, forecast } = state;

  return (
    <div
      style={{
        borderBottom: BORDER,
        display: 'flex',
        alignItems: 'center',
        backgroundColor: 'var(--surface1)',
        overflow: 'hidden',
        padding: '0',
      }}
    >
      {/* ── Current conditions — single inline row ── */}
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
        <WeatherIcon id={current.weatherId} size={14} />
        <span style={{ ...MONO, fontSize: '15px', fontWeight: 600, letterSpacing: '-0.02em' }}>
          {current.temp}°C
        </span>
        <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          {city}{country ? `, ${country}` : ''}
        </span>
        <span style={{ ...MONO, fontSize: '9px', color: 'var(--text3)', letterSpacing: '0.05em' }}>
          {owmLabel(current.weatherId)}
        </span>
        <span style={{ ...MONO, fontSize: '9px', color: 'var(--text3)', letterSpacing: '0.05em' }}>
          FL {current.feelsLike}°
        </span>
        <span style={{ ...MONO, fontSize: '9px', color: 'var(--text3)', letterSpacing: '0.05em' }}>
          W {current.windKph}km/h
        </span>
      </div>

      {/* ── Forecast cells ── */}
      <div style={{ display: 'flex' }}>
        {forecast.map((day, i) => {
          const isToday = i === 0;
          const date = new Date(day.dt * 1000);
          const dayName = isToday ? 'TDY' : DAYS[date.getDay()];

          return (
            <div
              key={day.dt}
              style={{
                borderRight: i < forecast.length - 1 ? BORDER : 'none',
                padding: '5px 10px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                backgroundColor: isToday ? 'var(--background)' : undefined,
              }}
            >
              <span style={{ ...MONO, fontSize: '8px', letterSpacing: '0.08em', color: isToday ? 'var(--accent)' : 'var(--text4)', width: '18px' }}>
                {dayName}
              </span>
              <WeatherIcon id={day.weatherId} size={12} />
              <span style={{ ...MONO, fontSize: '10px', fontWeight: 600, letterSpacing: '-0.01em' }}>
                {day.high}°
              </span>
              <span style={{ ...MONO, fontSize: '9px', color: 'var(--text4)', letterSpacing: '-0.01em' }}>
                {day.low}°
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
