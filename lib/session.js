// ─── Delta tracking for cost/dur/lines/tokens ─────────────────────────
import fs from 'fs';
import path from 'path';
import os from 'os';
import { atomicWrite } from './format.js';

const TOKEN_SPEED_WINDOW = 30; // seconds for rolling average

export function updateSession(input) {
  const sid = (input.session_id || 'default').replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
  const cumPath = path.join(os.homedir(), '.claude', `cc-cum-${sid}.json`);

  const curCost = input.cost?.total_cost_usd ?? 0;
  const curDur = input.cost?.total_duration_ms ?? 0;
  const curAdd = input.cost?.total_lines_added ?? 0;
  const curRm = input.cost?.total_lines_removed ?? 0;
  const curTok = (input.context_window?.total_input_tokens ?? 0) + (input.context_window?.total_output_tokens ?? 0);
  const curInputTok = input.context_window?.total_input_tokens ?? 0;
  const curOutputTok = input.context_window?.total_output_tokens ?? 0;

  let cum = {
    cost: { total: 0, base: 0 }, dur: { total: 0, base: 0 },
    add: { total: 0, base: 0 }, rm: { total: 0, base: 0 },
    tok: { total: 0, base: 0 }, tokIn: { total: 0, base: 0 },
    tokOut: { total: 0, base: 0 }, speedToks: [], speedMs: [],
  };
  try { cum = JSON.parse(fs.readFileSync(cumPath, 'utf8')); } catch (e) {}

  // Accumulate deltas (reset-safe)
  const accum = (field, cur) => {
    if (cur >= cum[field].base) cum[field].total += cur - cum[field].base;
    else cum[field].total += cur;
    cum[field].base = cur;
  };
  accum('cost', curCost);
  accum('dur', curDur);

  cum.add.total = (cum.add.total || 0) + Math.max(0, curAdd - cum.add.base);
  cum.add.base = curAdd;
  cum.rm.total = (cum.rm.total || 0) + Math.max(0, curRm - cum.rm.base);
  cum.rm.base = curRm;
  cum.tok.total = (cum.tok.total || 0) + Math.max(0, curTok - cum.tok.base);
  cum.tok.base = curTok;
  cum.tokIn.total = (cum.tokIn.total || 0) + Math.max(0, curInputTok - (cum.tokIn.base || 0));
  cum.tokIn.base = curInputTok;
  cum.tokOut.total = (cum.tokOut.total || 0) + Math.max(0, curOutputTok - (cum.tokOut.base || 0));
  cum.tokOut.base = curOutputTok;

  // Token speed: rolling window
  if (curDur > 0 && cum.dur.total > 0) {
    cum.speedToks = cum.speedToks || [];
    cum.speedMs = cum.speedMs || [];
    cum.speedToks.push(cum.tok.total);
    cum.speedMs.push(cum.dur.total);
    const windowMs = TOKEN_SPEED_WINDOW * 1000;
    let sumT = 0, sumMs = 0;
    for (let j = cum.speedToks.length - 1; j >= 0; j--) {
      sumT = cum.speedToks[j];
      sumMs = cum.speedMs[j];
      if (cum.dur.total - cum.speedMs[j] > windowMs) break;
    }
    cum._speed = sumMs > 0 ? (sumT / (sumMs / 1000)).toFixed(1) : '0.0';
  }

  atomicWrite(cumPath, JSON.stringify(cum));
  return cum;
}
