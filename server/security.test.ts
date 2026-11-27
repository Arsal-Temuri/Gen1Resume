import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type { Response } from 'express';
import {
  attachResponseAbortController,
  isValidPdfBase64MagicBytes,
  SlidingWindowRateLimiter,
} from './security';

test('isValidPdfBase64MagicBytes accepts valid %PDF- payloads and rejects non-PDF files', () => {
  const validPdfBase64 = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj', 'latin1').toString('base64');
  const fakeHtmlBase64 = Buffer.from('<html><body>not a pdf</body></html>', 'utf8').toString('base64');
  const fakePngBase64 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString('base64');

  assert.equal(isValidPdfBase64MagicBytes(validPdfBase64), true);
  assert.equal(isValidPdfBase64MagicBytes(fakeHtmlBase64), false);
  assert.equal(isValidPdfBase64MagicBytes(fakePngBase64), false);
  assert.equal(isValidPdfBase64MagicBytes(''), false);
});

test('SlidingWindowRateLimiter enforces per-key quota and recovers after window elapses', () => {
  let clock = 1_000_000;
  const limiter = new SlidingWindowRateLimiter({
    windowMs: 60_000,
    maxRequests: 3,
    now: () => clock,
  });

  assert.equal(limiter.check('10.0.0.1').allowed, true);
  assert.equal(limiter.check('10.0.0.1').allowed, true);
  assert.equal(limiter.check('10.0.0.1').allowed, true);

  const blocked = limiter.check('10.0.0.1');
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.ok(blocked.retryAfterSeconds >= 1);

  // Separate client IP is unaffected
  assert.equal(limiter.check('10.0.0.2').allowed, true);

  // Advance clock past sliding window
  clock += 61_000;
  assert.equal(limiter.check('10.0.0.1').allowed, true);
});

test('attachResponseAbortController aborts only on premature disconnect and not on normal completion', () => {
  // Case 1: Normal response lifecycle (finish -> writableEnded=true -> close)
  const normalRes = Object.assign(new EventEmitter(), {
    writableEnded: false,
    destroyed: false,
  }) as unknown as Response;
  const normalCtrl = attachResponseAbortController(normalRes);
  assert.equal(normalCtrl.signal.aborted, false);
  (normalRes as unknown as { writableEnded: boolean }).writableEnded = true;
  normalRes.emit('finish');
  normalRes.emit('close');
  assert.equal(normalCtrl.signal.aborted, false);

  // Case 2: Premature client disconnect (close before writableEnded)
  const droppedRes = Object.assign(new EventEmitter(), {
    writableEnded: false,
    destroyed: false,
  }) as unknown as Response;
  const droppedCtrl = attachResponseAbortController(droppedRes);
  assert.equal(droppedCtrl.signal.aborted, false);
  droppedRes.emit('close');
  assert.equal(droppedCtrl.signal.aborted, true);
});
