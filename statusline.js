#!/usr/bin/env node
import { loadConfig } from './lib/config.js';
import { getTheme, seg, segDim, segBold, POWERLINE, R, DIM } from './lib/colors.js';
import { bar, fmtDur, fmtTok, fmtReset, shortDir } from './lib/format.js';
import { getGitInfo } from './lib/git.js';
import { getHookData } from './lib/hooks.js';
import { getRateLimits } from './lib/rate-limits.js';
import { getPermissionMode } from './lib/permission.js';
import { updateSession } from './lib/session.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';

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
    const { r5h, r7d, r5hReset, r7dReset } = getRateLimits(i);

    // ── Build segments ───────────────────────────────────────────────────
    const dirSeg = dirStr ? seg(dirStr, C.b) : '';
    const gitSeg = git.repo
      ? segDim(git.repo + '/') + seg(git.branch, git.dirty ? C.hi : C.b) + (cfg.showDirty && git.dirty ? seg('!', C.hi) : '')
      : '';
    const modelSeg = segBold(model, C.m) + (effort ? ' ' + segDim(effort) : '');

    // Permission mode — read from session transcript (not in statusline payload).
    let permSeg = '';
    if (cfg.showPermission) {
      const mode = getPermissionMode(i.transcript_path);
      const PERM_LABEL = { acceptEdits: 'edits', auto: 'auto', plan: 'plan', dontAsk: 'noask', bypassPermissions: 'yolo', default: '' };
      const PERM_COLOR = { acceptEdits: C.ok, auto: C.i, plan: C.bar, dontAsk: C.i, bypassPermissions: C.err, default: C.d };
      const label = PERM_LABEL[mode];
      if (label) {
        const colored = seg(label, PERM_COLOR[mode] || C.d);
        // yolo gets a ⚠ prefix so it's harder to miss in a glance.
        permSeg = mode === 'bypassPermissions' ? seg('\u26A0 ', C.err) + colored : colored;
      }
    }
    const costSeg = segBold(`$${(cum.cost?.total || 0).toFixed(4)}`, C.c);
    const durSeg = dur > 0 ? segDim(fmtDur(dur)) : '';

    const quotaSegs = [];
    const buildQuota = (pct, label, reset) => {
      const col = pct >= 80 ? C.hi : pct >= 50 ? C.i : C.ok;
      let s = seg(bar(pct, cfg.quotaBarLen), col) + segDim(` ${label} ${pct}%`);
      if (cfg.showQuotaReset && reset) {
        const r = fmtReset(reset, label);
        if (r) s += segDim(` ${r}`);
      }
      return s;
    };
    if (r5h > 0) quotaSegs.push(buildQuota(r5h, '5h', r5hReset));
    if (r7d > 0) quotaSegs.push(buildQuota(r7d, '7d', r7dReset));

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
    if (cfg.showSubagent && hook.subagents && hook.subagents.length > 0) {
      const agents = hook.subagents;
      if (agents.length === 1) {
        const a = agents[0];
        const label = a.desc ? `${a.type}: ${a.desc.slice(0, 30)}` : a.type;
        sysSegs.push(seg(`\u25C6 ${label}`, C.ed));
      } else {
        const types = agents.map(a => a.type).slice(0, 3).join(',');
        const more = agents.length > 3 ? `+${agents.length - 3}` : '';
        sysSegs.push(seg(`\u25C6${agents.length} ${types}${more}`, C.ed));
      }
    }
    if (cfg.showEditedFiles && hook.edited.length > 0) sysSegs.push(seg(hook.edited[0].split('/').pop(), C.ed));

    const accountSeg = account ? segDim(account) : '';

    // ── Compose ─────────────────────────────────────────────────────────
    const join = (parts, sep) => parts.filter(Boolean).join(sep);
    const SEP = segDim(' \u00b7 ');

    if (cfg.layout === 'single') {
      const left = join([costSeg, modelSeg, permSeg, durSeg, linesStr, tokSeg], ' ');
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
    const line1 = join([dirSeg, gitSeg, modelSeg, permSeg, costSeg, durSeg], SEP);
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

    // Fire-and-forget MCP cache refresh so the next render has fresh data.
    // The refresher self-skips when the cache is still fresh.
    if (cfg.showMcp) {
      try {
        const refresher = path.join(os.homedir(), '.claude', 'hooks', 'mcp-status-refresh.js');
        if (fs.existsSync(refresher)) {
          const child = spawn('node', [refresher, cwd], { detached: true, stdio: 'ignore' });
          child.unref();
        }
      } catch (_) {}
    }
  } catch (e) {
    process.stdout.write('');
  }
});
