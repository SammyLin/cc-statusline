#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getTheme, seg, segDim, segBold, POWERLINE, R, DIM, BOLD } from './lib/colors.js';
import { bar, fmtDur, fmtTok } from './lib/format.js';
import { getGitInfo } from './lib/git.js';
import { getHookData } from './lib/hooks.js';
import { getRateLimits } from './lib/rate-limits.js';
import { updateSession } from './lib/session.js';

// ─── Config ────────────────────────────────────────────────────────────────
const THEME = getTheme('catppuccin');
const USE_POWERLINE = true;
const PL  = USE_POWERLINE ? POWERLINE : '│';
const PLR = USE_POWERLINE ? '\uE0B2' : '│';

// ─── Read stdin ─────────────────────────────────────────────────────────────
let d = '';
process.stdin.on('data', c => d += c);
process.stdin.on('end', () => {
  try {
    const i = JSON.parse(d);
    const C = THEME;

    // ── Account ─────────────────────────────────────────────────────────
    let account = '';
    try {
      const claudeJson = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.claude.json'), 'utf8'));
      if (claudeJson?.account?.email) {
        account = claudeJson.account.email.replace(/@.*/, '');
      }
    } catch (_) {}

    // ── Session data ─────────────────────────────────────────────────────
    const model = (i.model?.display_name || '?').replace('Claude ', '');
    const effortMap = { low: 'lo', medium: 'md', high: 'hi', xhigh: 'xh', max: 'mx' };
    const effort = effortMap[i.effort] || '?';
    const cum = updateSession(i);
    const dur = Math.round((cum.dur?.total || 0) / 60000);

    // ── Git ──────────────────────────────────────────────────────────────
    const git = getGitInfo(i);

    // ── Hook data ───────────────────────────────────────────────────────
    const hook = getHookData();

    // ── Rate limits ──────────────────────────────────────────────────────
    const { r5h, r7d } = getRateLimits(i);

    // ── Build segments ────────────────────────────────────────────────────
    // Group 1: Core — cost (bold), model (bold), effort, duration
    const core = [
      segBold(`$${(cum.cost?.total || 0).toFixed(4)}`, C.c),
      segBold(model, C.m),
      segDim(`(${effort})`),
      segDim(fmtDur(dur)),
    ].join(' ');

    // Group 2: Lines changed
    const lines = [];
    if ((cum.add?.total || 0) > 0) lines.push(seg(`+${cum.add.total}`, C.ok));
    if ((cum.rm?.total || 0) > 0) lines.push(seg(`-${cum.rm.total}`, C.hi));
    const linesStr = lines.length ? lines.join(segDim(' ')) : segDim('±0');

    // Group 3: Tokens + speed
    const tokTotal = cum.tok?.total || 0;
    const tokStr = seg(fmtTok(tokTotal), C.bar);
    const speedStr = cum._speed
      ? seg(`${cum._speed}t/s`, C.bar)
      : segDim('0t/s');

    // Group 4: Quota bars (5h / 7d)
    const quota = [];
    if (r5h > 0) {
      const col = r5h >= 80 ? C.hi : r5h >= 50 ? C.i : C.ok;
      quota.push(seg(bar(r5h, 6), col) + segDim('5h'));
    }
    if (r7d > 0) {
      const col = r7d >= 80 ? C.hi : r7d >= 50 ? C.i : C.ok;
      quota.push(seg(bar(r7d, 6), col) + segDim('7d'));
    }
    const quotaStr = quota.join(segDim(' '));

    // Group 5: Git repo + branch
    const gitStr = git.repo
      ? seg(git.repo, C.b) + ' ' + seg(git.branch, git.dirty ? C.hi : C.b) + (git.dirty ? seg('!', C.hi) : '')
      : segDim('no git');

    // Group 6: System (MCP, compact, subagent, edited files)
    const sys = [];
    if (hook.mcpFailed > 0) sys.push(seg(`\u2717${hook.mcpFailed}`, C.err));
    else if (hook.mcpHealthy > 0) sys.push(seg(`\u2713${hook.mcpHealthy}`, C.ok));
    if (hook.mcpAuth > 0) sys.push(seg(`\u25C7${hook.mcpAuth}`, C.i));
    if (hook.compact > 0) sys.push(segDim(`\u2302${hook.compact}`));
    if (hook.subagent > 0) sys.push(seg(`${hook.subagent}\u25C6`, C.ed));
    if (hook.edited.length > 0) sys.push(seg(hook.edited[0].split('/').pop(), C.ed));

    // ── Compose ─────────────────────────────────────────────────────────
    const grp = (parts, sep = ' ') => parts.filter(Boolean).join(sep);
    const psep = ' ' + DIM + PL + ' ' + R;

    const left = grp([core, linesStr, tokStr + segDim('/') + speedStr]);
    const right = grp([quotaStr, gitStr, sys.join(' ')]);

    let output = left;
    if (right) output += psep + right;

    if (USE_POWERLINE) {
      output = DIM + PLR + ' ' + R + output + ' ' + DIM + PL + R;
    }

    process.stdout.write(output + '\n');
  } catch (e) {
    process.stdout.write('');
  }
});
