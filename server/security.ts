import type { NextFunction, Request, Response } from 'express';

/**
 * Verifies that a base64 payload begins with the standard PDF magic header (`%PDF-`, bytes 0x25 0x50 0x44 0x46 0x2D).
 * Prevents non-PDF or renamed binary files from being forwarded to the Gemini API.
 */
export function isValidPdfBase64MagicBytes(base64Payload: string): boolean {
  const cleaned = base64Payload.replace(/\s+/g, '');
  if (cleaned.length < 8) return false;
  try {
    // Decode only the first 16 base64 chars (12 bytes) to inspect magic header
    const sample = Buffer.from(cleaned.slice(0, 16), 'base64');
    if (sample.length < 5) return false;
    return (
      sample[0] === 0x25 && // %
      sample[1] === 0x50 && // P
      sample[2] === 0x44 && // D
      sample[3] === 0x46 && // F
      sample[4] === 0x2d    // -
    );
  } catch {
    return false;
  }
}

export interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  now?: () => number;
}

export interface RateLimitCheckResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export class SlidingWindowRateLimiter {
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly now: () => number;
  private readonly hits = new Map<string, number[]>();

  constructor(options: RateLimiterOptions) {
    this.windowMs = options.windowMs;
    this.maxRequests = options.maxRequests;
    this.now = options.now ?? (() => Date.now());
  }

  check(key: string): RateLimitCheckResult {
    const current = this.now();
    const cutoff = current - this.windowMs;
    const timestamps = (this.hits.get(key) ?? []).filter((ts) => ts > cutoff);

    if (timestamps.length >= this.maxRequests) {
      const oldest = timestamps[0] ?? current;
      const retryAfterMs = Math.max(1000, oldest + this.windowMs - current);
      this.hits.set(key, timestamps);
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
      };
    }

    timestamps.push(current);
    this.hits.set(key, timestamps);

    // Opportunistic cleanup so stale IP keys never grow unbounded
    if (this.hits.size > 2000) {
      for (const [entryKey, list] of this.hits.entries()) {
        if (list.length === 0 || list[list.length - 1] <= cutoff) {
          this.hits.delete(entryKey);
        }
      }
    }

    return {
      allowed: true,
      remaining: Math.max(0, this.maxRequests - timestamps.length),
      retryAfterSeconds: 0,
    };
  }
}

export function extractClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

export function createApiRateLimitMiddleware(options: { windowMs: number; maxRequests: number }) {
  const limiter = new SlidingWindowRateLimiter(options);
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = extractClientIp(req);
    const result = limiter.check(key);
    res.setHeader('X-RateLimit-Limit', String(options.maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(result.remaining));

    if (!result.allowed) {
      res.setHeader('Retry-After', String(result.retryAfterSeconds));
      res.status(429).json({
        error: `Too many AI requests from your session. Please wait ${result.retryAfterSeconds} seconds and try again.`,
      });
      return;
    }

    next();
  };
}

/**
 * Applies baseline iframe-safe security headers to Express responses.
 * Intentionally omits X-Frame-Options: DENY so preview/embed iframes continue to work.
 */
export function applySecurityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
}

/**
 * Attaches an AbortController to an Express response so upstream AI work is cancelled
 * ONLY when the client disconnects before a response finishes.
 *
 * IMPORTANT: Listens to `res.on('close')` (NOT `req.on('close')`). In Node.js 16+,
 * `req` emits `'close'` as soon as body middleware (`express.json()`) finishes reading
 * the POST body, which would prematurely abort every POST request.
 */
export function attachResponseAbortController(res: Response): AbortController {
  const controller = new AbortController();
  if (res.destroyed && !res.writableEnded) {
    controller.abort();
    return controller;
  }
  const handleClose = () => {
    if (!res.writableEnded) {
      controller.abort();
    }
  };
  res.on('close', handleClose);
  res.on('finish', () => {
    res.off('close', handleClose);
  });
  return controller;
}
