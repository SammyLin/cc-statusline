#!/usr/bin/env node
import { loadConfig } from './lib/config.js';
import { getTheme, seg, segDim, segBold, POWERLINE, R, DIM } from './lib/colors.js';
import { bar, fmtDur, fmtTok, fmtReset, shortDir, displayWidth } from './lib/format.js';
import { getGitInfo } from './lib/git.js';
import { getHookData } from './lib/hooks.js';
import { getRateLimits } from './lib/rate-limits.js';
import { getPermissionMode } from './lib/permission.js';
import { updateSession } from './lib/session.js';
import { getTerminalCols } from './lib/width.js';
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
    const git = getGitInfo(i);
    const hook = getHookData();
    const { r5h, r7d, r5hReset, r7dReset } = getRateLimits(i);

    // ── Build segments ───────────────────────────────────────────────────
    const buildDirSeg = (segs) => {
      if (!cfg.showDir || !cwd) return '';
      return seg(shortDir(cwd, segs), C.b);
    };
    const dirSeg = buildDirSeg(cfg.dirSegments);
    const gitSeg = git.repo
      ? segDim(git.repo + '/') + seg(git.branch, git.dirty ? C.hi : C.b) + (cfg.showDirty && git.dirty ? seg('!', C.hi) : '')
      : '';
    const gitSegBare = git.repo
      ? seg(git.branch, git.dirty ? C.hi : C.b) + (cfg.showDirty && git.dirty ? seg('!', C.hi) : '')
      : '';
    const buildModelSeg = (shortCtx) => {
      const txt = shortCtx ? model.replace(/\s*\([^)]*\)\s*$/, '') : model;
      return segBold(txt, C.m) + (effort ? ' ' + segDim(effort) : '');
    };
    const modelSeg = buildModelSeg(false);

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
        permSeg = mode === 'bypassPermissions' ? seg('⚠ ', C.err) + colored : colored;
      }
    }
    const buildCostSeg = (decimals) => segBold(`$${(cum.cost?.total || 0).toFixed(decimals)}`, C.c);
    const costSeg = buildCostSeg(4);
    const durSeg = dur > 0 ? segDim(fmtDur(dur)) : '';

    const buildQuotaSegs = (withReset) => {
      const out = [];
      const mk = (pct, label, reset) => {
        const col = pct >= 80 ? C.hi : pct >= 50 ? C.i : C.ok;
        let s = seg(bar(pct, cfg.quotaBarLen), col) + segDim(` ${label} ${pct}%`);
        if (withReset && cfg.showQuotaReset && reset) {
          const r = fmtReset(reset, label);
          if (r) s += segDim(` ${r}`);
        }
        return s;
      };
      if (r5h > 0) out.push(mk(r5h, '5h', r5hReset));
      if (r7d > 0) out.push(mk(r7d, '7d', r7dReset));
      return out;
    };
    const quotaSegs = buildQuotaSegs(true);

    const tokTotal = cum.tok?.total || 0;
    const tokSeg = tokTotal > 0
      ? seg('↑' + fmtTok(tokTotal), C.bar) + (cum._speed ? segDim(' ') + seg(`${cum._speed}t/s`, C.bar) : '')
      : '';

    const lineSegs = [];
    if ((cum.add?.total || 0) > 0) lineSegs.push(seg(`+${cum.add.total}`, C.ok));
    if ((cum.rm?.total || 0) > 0) lineSegs.push(seg(`-${cum.rm.total}`, C.hi));
    const linesStr = lineSegs.join(' ');

    const sysSegs = [];
    if (cfg.showMcp) {
      if (hook.mcpFailed > 0) sysSegs.push(seg(`✗${hook.mcpFailed}`, C.err));
      else if (hook.mcpHealthy > 0) sysSegs.push(seg(`✓${hook.mcpHealthy}`, C.ok));
      if (hook.mcpAuth > 0) sysSegs.push(seg(`◇${hook.mcpAuth}`, C.i));
    }
    if (cfg.showCompact && hook.compact > 0) sysSegs.push(segDim(`⌂${hook.compact}`));
    if (cfg.showSubagent && hook.subagents && hook.subagents.length > 0) {
      const agents = hook.subagents;
      if (agents.length === 1) {
        const a = agents[0];
        const label = a.desc ? `${a.type}: ${a.desc.slice(0, 30)}` : a.type;
        sysSegs.push(seg(`◆ ${label}`, C.ed));
      } else {
        const types = agents.map(a => a.type).slice(0, 3).join(',');
        const more = agents.length > 3 ? `+${agents.length - 3}` : '';
        sysSegs.push(seg(`◆${agents.length} ${types}${more}`, C.ed));
      }
    }
    if (cfg.showEditedFiles && hook.edited.length > 0) sysSegs.push(seg(hook.edited[0].split('/').pop(), C.ed));

    const accountSeg = account ? segDim(account) : '';

    // ── Compose ─────────────────────────────────────────────────────────
    const join = (parts, sep) => parts.filter(Boolean).join(sep);
    const SEP = segDim(' · ');

    // Terminal width (0 = unknown; skip responsive trimming).
    const cols = getTerminalCols();

    // Progressive trim levels. Stop at the first level whose widest rendered
    // line fits the budget; if nothing fits, render the most compact level.
    // Order is "least painful first": cosmetic suffixes / redundant fields
    // before core info (model, cost, quota bars).
    const TRIM_STEPS = [
      {},
      { shortModel: true },
      { shortModel: true, dropAccount: true },
      { shortModel: true, dropAccount: true, shortQuota: true },
      { shortModel: true, dropAccount: true, shortQuota: true, shortCost: true, dropLines: true },
      { shortModel: true, dropAccount: true, shortQuota: true, shortCost: true, dropLines: true, dropDur: true, shortGit: true },
      { shortModel: true, dropAccount: true, shortQuota: true, shortCost: true, dropLines: true, dropDur: true, shortGit: true, dropPerm: true, dropSys: true },
      { shortModel: true, dropAccount: true, dropQuota: true, shortCost: true, dropLines: true, dropDur: true, shortGit: true, dropPerm: true, dropSys: true, dropTok: true, shortDir: true },
    ];

    if (cfg.layout === 'single') {
      const composeSingle = (t) => {
        const mS = buildModelSeg(t.shortModel);
        const cS = buildCostSeg(t.shortCost ? 2 : 4);
        const qS = t.dropQuota ? [] : (t.shortQuota ? buildQuotaSegs(false) : quotaSegs);
        const left = join([
          cS,
          mS,
          t.dropPerm ? '' : permSeg,
          t.dropDur ? '' : durSeg,
          t.dropLines ? '' : linesStr,
          t.dropTok ? '' : tokSeg,
        ], ' ');
        const right = join([
          qS.join(' '),
          t.shortGit ? gitSegBare : gitSeg,
          t.dropSys ? '' : sysSegs.join(' '),
          t.dropAccount ? '' : accountSeg,
        ], ' ');
        const PL = cfg.powerline ? POWERLINE : '|';
        const PLR = cfg.powerline ? '' : '|';
        const sep = ' ' + segDim(PL) + ' ';
        let line = left;
        if (right) line += sep + right;
        if (cfg.powerline) line = segDim(PLR) + ' ' + line + ' ' + segDim(PL);
        return line;
      };
      const budget = cols > 0 ? cols - 2 : Infinity;
      let out = composeSingle({});
      for (const step of TRIM_STEPS) {
        out = composeSingle(step);
        if (displayWidth(out) <= budget) break;
      }
      process.stdout.write(out + '\n');
      return;
    }

    // rounded multi-line
    const composeRounded = (t) => {
      const mS = buildModelSeg(t.shortModel);
      const cS = buildCostSeg(t.shortCost ? 2 : 4);
      const dS = t.shortDir ? buildDirSeg(1) : dirSeg;
      const gS = t.shortGit ? gitSegBare : gitSeg;
      const qS = t.dropQuota ? [] : (t.shortQuota ? buildQuotaSegs(false) : quotaSegs);
      const l1 = join([
        dS,
        gS,
        mS,
        t.dropPerm ? '' : permSeg,
        cS,
        t.dropDur ? '' : durSeg,
      ], SEP);
      const l2Parts = [];
      if (qS.length) l2Parts.push(qS.join('  '));
      if (!t.dropTok && tokSeg) l2Parts.push(tokSeg);
      if (!t.dropLines && linesStr) l2Parts.push(linesStr);
      if (!t.dropSys && sysSegs.length) l2Parts.push(sysSegs.join(' '));
      if (!t.dropAccount && accountSeg) l2Parts.push(accountSeg);
      return { l1, l2: l2Parts.join(SEP) };
    };

    // Prefix "╭╴ " / "╰╴ " is 3 cols; Claude Code adds ~2 cols of TUI indent.
    const budget = cols > 0 ? cols - 5 : Infinity;
    let picked = composeRounded({});
    for (const step of TRIM_STEPS) {
      picked = composeRounded(step);
      const widest = Math.max(displayWidth(picked.l1), displayWidth(picked.l2));
      if (widest <= budget) break;
    }

    const open  = segDim('╭╴ ');  // ╭╴
    const close = segDim('╰╴ ');  // ╰╴

    let out = open + picked.l1;
    if (picked.l2) out += '\n' + close + picked.l2;
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
