#!/usr/bin/env node
import { loadConfig } from './lib/config.js';
import { getTheme, seg, segDim, segBold, POWERLINE, R, DIM } from './lib/colors.js';
import { bar, fmtDur, fmtTok, shortDir } from './lib/format.js';
import { getGitInfo } from './lib/git.js';
import { getHookData } from './lib/hooks.js';
import { getRateLimits } from './lib/rate-limits.js';
import { updateSession } from './lib/session.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

const cfg = loadConfig();
const C = getTheme(cfg.theme);

let d = '';
process.stdin.on('data', c => d += c);
process.stdin.on('end', () => {
  try {
    const i = JSON.parse(d);

    // ── Account ─────────────────────────────────────────────────────────
    let account = '';
    if (cfg.showAccount) {
      try {
        const claudeJson = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.claude.json'), 'utf8'));
        const email = claudeJson?.oauthAccount?.emailAddress || claudeJson?.account?.email;
        if (email) account = email.replace(/@.*/, '');
      } catch (_) {}
    }

    // ── Session data ─────────────────────────────────────────────────────
    const model = (i.model?.display_name || '?').replace('Claude ', '');
    const effortMap = { low: 'lo', medium: 'md', high: 'hi', xhigh: 'xh', max: 'mx' };
    const effort = effortMap[i.effort] || '';
    const cum = updateSession(i);
    const dur = Math.round((cum.dur?.total || 0) / 60000);

    // ── Cwd / Git / Hooks / Rate limits ─────────────────────────────────
    const cwd = i.cwd || i.workspace?.current_dir || '';
    const dirStr = cfg.showDir ? shortDir(cwd, cfg.dirSegments) : '';
    const git = getGitInfo(i);
    const hook = getHookData();
    const { r5h, r7d } = getRateLimits(i);

    // ── Build segments ───────────────────────────────────────────────────
    const dirSeg = dirStr ? seg(dirStr, C.b) : '';
    const gitSeg = git.repo
      ? segDim(git.repo + '/') + seg(git.branch, git.dirty ? C.hi : C.b) + (cfg.showDirty && git.dirty ? seg('!', C.hi) : '')
      : '';
    const modelSeg = segBold(model, C.m) + (effort ? ' ' + segDim(effort) : '');
    const costSeg = segBold(`$${(cum.cost?.total || 0).toFixed(4)}`, C.c);
    const durSeg = dur > 0 ? segDim(fmtDur(dur)) : '';

    const quotaSegs = [];
    if (r5h > 0) {
      const col = r5h >= 80 ? C.hi : r5h >= 50 ? C.i : C.ok;
      quotaSegs.push(seg(bar(r5h, cfg.quotaBarLen), col) + segDim(' 5h'));
    }
    if (r7d > 0) {
      const col = r7d >= 80 ? C.hi : r7d >= 50 ? C.i : C.ok;
      quotaSegs.push(seg(bar(r7d, cfg.quotaBarLen), col) + segDim(' 7d'));
    }

    const tokTotal = cum.tok?.total || 0;
    const tokSeg = tokTotal > 0
      ? seg('\u2191' + fmtTok(tokTotal), C.bar) + (cum._speed ? segDim(' ') + seg(`${cum._speed}t/s`, C.bar) : '')
      : '';

    const lineSegs = [];
    if ((cum.add?.total || 0) > 0) lineSegs.push(seg(`+${cum.add.total}`, C.ok));
    if ((cum.rm?.total || 0) > 0) lineSegs.push(seg(`-${cum.rm.total}`, C.hi));
    const linesStr = lineSegs.join(' ');

    const sysSegs = [];
    if (cfg.showMcp) {
      if (hook.mcpFailed > 0) sysSegs.push(seg(`\u2717${hook.mcpFailed}`, C.err));
      else if (hook.mcpHealthy > 0) sysSegs.push(seg(`\u2713${hook.mcpHealthy}`, C.ok));
      if (hook.mcpAuth > 0) sysSegs.push(seg(`\u25C7${hook.mcpAuth}`, C.i));
    }
    if (cfg.showCompact && hook.compact > 0) sysSegs.push(segDim(`\u2302${hook.compact}`));
    if (cfg.showSubagent && hook.subagent > 0) sysSegs.push(seg(`${hook.subagent}\u25C6`, C.ed));
    if (cfg.showEditedFiles && hook.edited.length > 0) sysSegs.push(seg(hook.edited[0].split('/').pop(), C.ed));

    const accountSeg = account ? segDim(account) : '';

    // ── Compose ─────────────────────────────────────────────────────────
    const join = (parts, sep) => parts.filter(Boolean).join(sep);
    const SEP = segDim(' \u00b7 ');

    if (cfg.layout === 'single') {
      const left = join([costSeg, modelSeg, durSeg, linesStr, tokSeg], ' ');
      const right = join([quotaSegs.join(' '), gitSeg, sysSegs.join(' '), accountSeg], ' ');
      const PL = cfg.powerline ? POWERLINE : '|';
      const PLR = cfg.powerline ? '\uE0B2' : '|';
      const sep = ' ' + segDim(PL) + ' ';
      let out = left;
      if (right) out += sep + right;
      if (cfg.powerline) out = segDim(PLR) + ' ' + out + ' ' + segDim(PL);
      process.stdout.write(out + '\n');
      return;
    }

    // rounded multi-line
    const line1 = join([dirSeg, gitSeg, modelSeg, costSeg, durSeg], SEP);
    const line2Parts = [];
    if (quotaSegs.length) line2Parts.push(quotaSegs.join('  '));
    if (tokSeg) line2Parts.push(tokSeg);
    if (linesStr) line2Parts.push(linesStr);
    if (sysSegs.length) line2Parts.push(sysSegs.join(' '));
    if (accountSeg) line2Parts.push(accountSeg);
    const line2 = line2Parts.join(SEP);

    const open  = segDim('\u256d\u2574 ');  // ╭╴
    const close = segDim('\u2570\u2574 ');  // ╰╴

    let out = open + line1;
    if (line2) out += '\n' + close + line2;
    process.stdout.write(out + '\n');
  } catch (e) {
    process.stdout.write('');
  }
});
