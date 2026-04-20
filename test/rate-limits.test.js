import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getRateLimits } from '../lib/rate-limits.js';

const future = () => Math.floor(Date.now() / 1000) + 3600;
const past   = () => Math.floor(Date.now() / 1000) - 3600;

test('returns 0 when no rate limit data and no snapshots', () => {
  const r = getRateLimits({});
  assert.equal(r.r5h, 0);
  assert.equal(r.r7d, 0);
  assert.equal(r.r5hReset, 0);
  assert.equal(r.r7dReset, 0);
});

test('reads input rate_limits when present and live', () => {
  const resetsAt = future();
  const r = getRateLimits({
    rate_limits: {
      five_hour:  { used_percentage: 41, resets_at: resetsAt },
      seven_day:  { used_percentage: 36, resets_at: resetsAt },
    },
  });
  assert.equal(r.r5h, 41);
  assert.equal(r.r7d, 36);
  assert.equal(r.r5hReset, resetsAt);
  assert.equal(r.r7dReset, resetsAt);
});

test('ignores expired rate_limits', () => {
  const r = getRateLimits({
    rate_limits: {
      five_hour: { used_percentage: 99, resets_at: past() },
    },
  });
  assert.equal(r.r5h, 0);
});

test('rounds percentage to integer', () => {
  const r = getRateLimits({
    rate_limits: {
      five_hour: { used_percentage: 41.7, resets_at: future() },
    },
  });
  assert.equal(r.r5h, 42);
});
