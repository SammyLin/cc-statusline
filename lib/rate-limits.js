// ─── Rate limit aggregation ────────────────────────────────────────────
import fs from 'fs';
import path from 'path';
import os from 'os';

const rlPath = path.join(os.homedir(), '.claude', 'cc-rl-snaps.json');

export function getRateLimits(input) {
  const nowSec = Date.now() / 1000;
  let rlSnaps = {};
  try { rlSnaps = JSON.parse(fs.readFileSync(rlPath, 'utf8')); } catch (e) {}

  const aggMax = (field) => {
    const myRL = input.rate_limits?.[field];
    const liveSnaps = [];
    for (const snap of Object.values(rlSnaps)) {
      const s = snap?.[field];
      if (s && typeof s.used_percentage === 'number' && s.resets_at > nowSec) {
        liveSnaps.push(s);
      }
    }
    if (liveSnaps.length === 0) {
      return (myRL?.resets_at > nowSec) ? myRL.used_percentage : 0;
    }
    let latestR = 0;
    for (const s of liveSnaps) if (s.resets_at > latestR) latestR = s.resets_at;
    let max = 0;
    for (const s of liveSnaps) {
      if (s.resets_at === latestR && s.used_percentage > max) max = s.used_percentage;
    }
    return max;
  };

  return {
    r5h: Math.round(aggMax('five_hour')),
    r7d: Math.round(aggMax('seven_day')),
  };
}
