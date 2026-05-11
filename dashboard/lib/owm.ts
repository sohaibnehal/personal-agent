const OWM = 'https://api.openweathermap.org';

export type OWMCurrent = {
  temp: number;
  feelsLike: number;
  humidity: number;
  windKph: number;
  weatherId: number;
  description: string;
};

export async function fetchOWMCurrent(lat: number, lon: number): Promise<OWMCurrent | null> {
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `${OWM}/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${key}&units=metric`,
      { next: { revalidate: 900 } }
    );
    if (!res.ok) return null;
    const d = await res.json();
    return {
      temp: Math.round(d.main.temp as number),
      feelsLike: Math.round(d.main.feels_like as number),
      humidity: d.main.humidity as number,
      windKph: Math.round((d.wind.speed as number) * 3.6),
      weatherId: d.weather[0].id as number,
      description: (d.weather[0].description as string).toUpperCase(),
    };
  } catch {
    return null;
  }
}

export function weatherIdToLabel(id: number): string {
  if (id === 800) return 'clear';
  if (id === 801) return 'mostly clear';
  if (id === 802 || id === 803) return 'partly cloudy';
  if (id >= 804) return 'overcast';
  if (id >= 700) return 'foggy';
  if (id >= 600) return 'snowing';
  if (id >= 500) return 'rainy';
  if (id >= 300) return 'drizzling';
  if (id >= 200) return 'stormy';
  return 'cloudy';
}
