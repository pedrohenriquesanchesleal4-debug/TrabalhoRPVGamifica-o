import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Simple in‑memory rate limiter for /api/player/* routes.
 * Runs on the Edge (middleware), so it works on Vercel without extra infra.
 * Not persistent across instances – good enough for classroom scale (≤60 concurrent).
 */
const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 120; // 2 req/s per IP per minute

const buckets = new Map<string, { count: number; resetAt: number }>();

function getBucket(ip: string) {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || b.resetAt < now) {
    const fresh = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(ip, fresh);
    return fresh;
  }
  return b;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith('/api/player/')) {
    return NextResponse.next();
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown';
  const bucket = getBucket(ip);
  bucket.count += 1;

  const res = NextResponse.next();
  res.headers.set('X-RateLimit-Limit', String(MAX_REQUESTS));
  res.headers.set('X-RateLimit-Remaining', String(Math.max(0, MAX_REQUESTS - bucket.count)));
  res.headers.set('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

  if (bucket.count > MAX_REQUESTS) {
    return new NextResponse(JSON.stringify({ error: 'Too Many Requests' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(Math.ceil((bucket.resetAt - Date.now()) / 1000)),
        ...Object.fromEntries(res.headers),
      },
    });
  }

  return res;
}

export const config = {
  matcher: ['/api/player/:path*'],
};