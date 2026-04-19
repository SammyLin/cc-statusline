#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import os from 'os';

import { getTheme, POWERLINE, R, DIM, BOLD, seg, segDim, segBold } from './lib/colors.js';
import { bar, fmtDur, fmtTok } from './lib/format.js';
import { getGitInfo } from './lib/git.js';
import { readCompacts, readSubagents, readMcpStatus, readEditedFiles } from './lib/hooks.js';
import { getRateLimits } from './lib/rate-limits.js';
import { updateSession } from './lib/session.js';

// ─── Config ────────────────────────────────────────────────────────────
const POWERLINE_FONTS = true;
const THEME = 'catppuccin';

let d = '';
process.stdin.on('data', c => d += c);
process.stdin.on('end', () => {
  try {
    const i = JSON.parse(d);
    const C = getTheme(THEME);
    const pl = POWERLINE_FONTS ? POWERLINE : '|';

    // ── Account email ──────────────────────────────────────────────────
    let accountEmail = '';
    try {
      const cj = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.claude.json'), 'utf8'));
      if (cj?.account?.email) accountEmail = cj.account.email.replace(/@.*/, '');
    } catch (e) {}

    // ── Gather data ────────────────────────────────────────────────────
    const model = (i.model?.display_name || '?').replace('Claude ', '');
    const cum = updateSession(i);
    const { r5h, r7d } = getRateLimits(i);
    const { branch, dirty, repoName } = getGitInfo();
    const shortDir = (i.cwd || i.workspace?.current_dir || '').split(/[/\\]/).slice(-2).join('/');

    const compactCount = readCompacts();
    const subagents = readSubagents();
    const { healthy: mcpHealthy, failed: mcpFailed, auth: mcpAuth } = readMcpStatus();
    const editedFiles = readEditedFiles();

    // ── Effort ─────────────────────────────────────────────────────────
    const effortLabel = { low: 'lo', medium: 'md', high: 'hi', xhigh: 'xh', max: 'mx' };
    const effort = effortLabel[i.effort] || '?';

    // ── Color helpers ──────────────────────────────────────────────────
    const cc = pct => pct >= 80 ? C.hi : pct >= 50 ? C.i : C.ok;

    // ── Build output ───────────────────────────────────────────────────
    const parts = [];

    if (accountEmail) parts.push(segDim(`(${accountEmail})`));
    if (repoName) parts.push(seg(repoName, C.b));
    if (branch) parts.push(seg(branch, dirty ? C.hi : C.b) + (dirty ? seg('!', C.hi) : ''));
    if (shortDir) parts.push(segDim(shortDir));

    parts.push(segBold(model, C.m) + segDim(`(${effort})`));
    parts.push(seg(`$${cum.cost.total.toFixed(4)}`, C.c) + segDim(fmtDur(Math.round(cum.dur.total / 60000))));

    if (cum.add.total > 0) parts.push(seg(`+${cum.add.total}`, C.ok));
    if (cum.rm.total > 0) parts.push(seg(`-${cum.rm.total}`, C.hi));
    if (cum._speed && parseFloat(cum._speed) > 0) parts.push(seg(`${cum._speed}t/s`, C.bar));
    parts.push(seg(fmtTok(cum.tok.total), C.bar));

    if (r5h > 0) parts.push(seg(bar(r5h, 8), cc(r5h)) + segDim('5h'));
    if (r7d > 0) parts.push(seg(bar(r7d, 8), cc(r7d)) + segDim('7d'));

    if (subagents.running.length > 0) parts.push(seg(`${subagents.running.length}\u25C6`, C.ed));
    if (mcpFailed > 0) parts.push(seg(`\u2718${mcpFailed}`, C.err));
    else if (mcpHealthy > 0) parts.push(seg(`\u2714${mcpHealthy}`, C.ok));
    if (mcpAuth > 0) parts.push(seg(`\u25B3${mcpAuth}`, C.i));
    if (compactCount > 0) parts.push(segDim(`c${compactCount}`));
    if (editedFiles.length > 0) parts.push(seg(editedFiles[0].split('/').pop(), C.ed));

    // ── Join with powerline separators ─────────────────────────────────
    let output = parts.join(' ' + DIM + pl + ' ' + R);
    if (POWERLINE_FONTS) output = DIM + pl + ' ' + R + output + ' ' + DIM + pl + R;

    process.stdout.write(output + '\n');
  } catch (e) {
    process.stdout.write('');
  }
});
