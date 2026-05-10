export function relativeTime(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  const diffMs = Date.now() - d.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1)  return 'JUST NOW';
  if (diffMins < 60) return `${diffMins}m AGO`;
  if (diffHours < 24) return `${diffHours}h AGO`;
  return `${diffDays}d AGO`;
}

export function isStale(date: Date | string): boolean {
  const d = date instanceof Date ? date : new Date(date);
  return Date.now() - d.getTime() > 24 * 60 * 60 * 1000;
}

export function formatDate(date: Date): string {
  return date
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .toUpperCase();
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}
