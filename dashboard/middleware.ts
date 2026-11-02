import { NextRequest, NextResponse } from 'next/server';

/**
 * Locks the whole dashboard (pages and /api routes) behind HTTP Basic auth.
 *
 * Credentials come from DASHBOARD_USER / DASHBOARD_PASSWORD. It fails closed:
 * if either is missing, every request is refused rather than served publicly.
 */
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

const REALM = 'Basic realm="Briefing Agent", charset="UTF-8"';

/** Constant-time string compare, so response timing doesn't leak how much matched. */
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  }
  return diff === 0;
}

function challenge(): NextResponse {
  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': REALM },
  });
}

export function middleware(req: NextRequest): NextResponse {
  const user = process.env.DASHBOARD_USER;
  const pass = process.env.DASHBOARD_PASSWORD;
  if (!user || !pass) {
    return new NextResponse('Dashboard locked: login is not configured.', { status: 503 });
  }

  const header = req.headers.get('authorization') ?? '';
  const [scheme, encoded] = header.split(' ');
  if (scheme !== 'Basic' || !encoded) return challenge();

  let decoded: string;
  try {
    decoded = atob(encoded);
  } catch {
    return challenge();
  }

  const sep = decoded.indexOf(':');
  if (sep < 0) return challenge();

  // Evaluate both so a wrong username takes as long as a wrong password.
  const userOk = safeEqual(decoded.slice(0, sep), user);
  const passOk = safeEqual(decoded.slice(sep + 1), pass);
  if (!(userOk && passOk)) return challenge();

  return NextResponse.next();
}
