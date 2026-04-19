#!/usr/bin/env node
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// ─── Config ────────────────────────────────────────────────────────────────
const POWERLINE_FONTS = true; // Set false if no Powerline/Nerd fonts
const THEME = 'catppuccin';   // 'default' | 'dracula' | 'nord' | 'catppuccin'
const TOKEN_SPEED_WINDOW = 30; // seconds for rolling average

let d = '';
process.stdin.on('data', c => d += c);
process.stdin.on('end', () => {
  try {
    const i = JSON.parse(d);

    // ── ANSI Helpers ────────────────────────────────────────────────────
    const R = '\x1b[0m', DIM = '\x1b[2m', BOLD = '\x1b[1m';
    const UND = '\x1b[4m';

    const t = (colors) => {
      const map = {
        // [theme] → { model, cost, dur, branch, dir, mcp, subagent, edited, bar }
        default: { m: '\x1b[36m', c: '\x1b[32m', d: '\x1b[2m', b: '\x1b[34m', i: '\x1b[33m', ok: '\x1b[32m', err: '\x1b[31m', ed: '\x1b[35m', bar: '\x1b[36m', hi: '\x1b[31m' },
        nord:    { m: '\x1b[38;5;75m',  c: '\x1b[38;5;181m', d: '\x1b[38;5;244m', b: '\x1b[38;5;109m', i: '\x1b[38;5;223m', ok: '\x1b[38;5;142m', err: '\x1b[38;5;203m', ed: '\x1b[38;5;139m', bar: '\x1b[38;5;68m', hi: '\x1b[38;5;203m' },
        catppuccin: { m: '\x1b[38;5;162m', c: '\x1b[38;5;114m', d: '\x1b[38;5;245m', b: '\x1b[38;5;147m', i: '\x1b[38;5;223m', ok: '\x1b[38;5;114m', err: '\x1b[38;5;203m', ed: '\x1b[38;5;212m', bar: '\x1b[38;5;117m', hi: '\x1b[38;5;203m' },
        dracula: { m: '\x1b[38;5;171m', c: '\x1b[38;5;84m', d: '\x1b[38;5;244m', b: '\x1b[38;5;229m', i: '\x1b[38;5;180m', ok: '\x1b[38;5;84m', err: '\x1b[38;5;203m', ed: '\x1b[38;5;212m', bar: '\x1b[38;5;117m', hi: '\x1b[38;5;203m' },
      };
      return map[THEME] || map.default;
    };
    const C = t();

    const pl = POWERLINE_FONTS ? '\uE0B0' : '|';  // Powerline separator
    const plr = POWERLINE_FONTS ? '\uE0B2' : '|'; // Reverse separator

    // ── File Helpers ─────────────────────────────────────────────────────
    const atomicWrite = (f, data) => {
      const tmp = `${f}.${process.pid}.${Date.now()}.tmp`;
      try { fs.writeFileSync(tmp, data); fs.renameSync(tmp, f); }
      catch (e) { try { fs.unlinkSync(tmp); } catch (_) {} }
    };

    const isWide = cp =>
      (cp >= 0x1100 && cp <= 0x115f) ||
      (cp >= 0x231a && cp <= 0x231b) ||
      (cp >= 0x23e9 && cp <= 0x23fa) ||
      (cp >= 0x25fd && cp <= 0x25fe) ||
      (cp >= 0x2614 && cp <= 0x2615) ||
      (cp >= 0x2648 && cp <= 0x2653) ||
      cp === 0x267f || cp === 0x26a1 ||
      (cp >= 0x26aa && cp <= 0x26ab) ||
      (cp >= 0x26bd && cp <= 0x26be) ||
      (cp >= 0x26c4 && cp <= 0x26c5) ||
      cp === 0x26ce || cp === 0x26d4 || cp === 0x26ea ||
      (cp >= 0x26f2 && cp <= 0x26f3) ||
      cp === 0x26f5 || cp === 0x26fa || cp === 0x26fd ||
      cp === 0x2705 || cp === 0x2728 || cp === 0x274c || cp === 0x274e ||
      (cp >= 0x2753 && cp <= 0x2757) ||
      (cp >= 0x2795 && cp <= 0x2797) ||
      cp === 0x27b0 || cp === 0x27bf ||
      (cp >= 0x2e80 && cp <= 0x303e) ||
      (cp >= 0x3041 && cp <= 0x33bf) ||
      (cp >= 0x3400 && cp <= 0x4dbf) ||
      (cp >= 0x4e00 && cp <= 0xa4cf) ||
      (cp >= 0xa960 && cp <= 0xa97c) ||
      (cp >= 0xac00 && cp <= 0xd7a3) ||
      (cp >= 0xf900 && cp <= 0xfaff) ||
      (cp >= 0xfe10 && cp <= 0xfe6b) ||
      (cp >= 0xff01 && cp <= 0xff60) ||
      (cp >= 0xffe0 && cp <= 0xffe6) ||
      (cp >= 0x1f004 && cp <= 0x1f9ff) ||
      (cp >= 0x1fa00 && cp <= 0x1faff) ||
      (cp >= 0x20000 && cp <= 0x2fffd) ||
      (cp >= 0x30000 && cp <= 0x3fffd);

    const dw = s => {
      let w = 0;
      for (const ch of s.replace(/\x1b\[[0-9;]*m/g, '')) {
        w += isWide(ch.codePointAt(0)) ? 2 : 1;
      }
      return w;
    };
    const pad = (s, w) => { const n = w - dw(s); return n > 0 ? s + ' '.repeat(n) : s; };

    // ── Format Helpers ────────────────────────────────────────────────────
    const bar = (pct, len = 10) => {
      const filled = Math.round(pct / 100 * len);
      return '\u2588'.repeat(filled) + '\u2591'.repeat(len - filled);
    };

    const cc = pct => pct >= 80 ? C.hi : pct >= 50 ? C.i : C.ok;
    const pctColor = pct => pct >= 80 ? '!' : '';

    const fmtDur = min => {
      if (min < 60) return `${min}min`;
      if (min < 1440) { const h = Math.floor(min/60), m = min%60; return m > 0 ? `${h}hr ${m}min` : `${h}hr`; }
      const dd = Math.floor(min/1440), h = Math.floor((min%1440)/60);
      return h > 0 ? `${dd}d ${h}hr` : `${dd}d`;
    };

    const fmtTok = n => n >= 1e9 ? (n/1e9).toFixed(1)+'B' : n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e3 ? (n/1e3).toFixed(1)+'K' : String(n);

    const fmtSpeed = (tok, ms) => {
      if (!ms || ms <= 0) return '';
      const tps = (tok / ms * 1000).toFixed(1);
      return `${fmtTok(tok)}/s`;
    };

    // ── Account Email ─────────────────────────────────────────────────────
    let accountEmail = '';
    try {
      const claudeJsonPath = path.join(os.homedir(), '.claude.json');
      const claudeJson = JSON.parse(fs.readFileSync(claudeJsonPath, 'utf8'));
      if (claudeJson?.account?.email) {
        accountEmail = claudeJson.account.email.replace(/@.*/, ''); // strip domain
      }
    } catch (e) {}

    // ── Delta Tracking ────────────────────────────────────────────────────
    const model = (i.model?.display_name || '?').replace('Claude ', '');
    const sid = (i.session_id || 'default').replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
    const cumPath = path.join(os.homedir(), '.claude', `cc-cum-${sid}.json`);

    const curCost = i.cost?.total_cost_usd ?? 0;
    const curDur = i.cost?.total_duration_ms ?? 0;
    const curAdd = i.cost?.total_lines_added ?? 0;
    const curRm = i.cost?.total_lines_removed ?? 0;
    const curTok = (i.context_window?.total_input_tokens ?? 0) + (i.context_window?.total_output_tokens ?? 0);
    const curInputTok = i.context_window?.total_input_tokens ?? 0;
    const curOutputTok = i.context_window?.total_output_tokens ?? 0;

    let cum = { cost:{total:0,base:0}, dur:{total:0,base:0}, add:{total:0,base:0}, rm:{total:0,base:0}, tok:{total:0,base:0}, tokIn:{total:0,base:0}, tokOut:{total:0,base:0}, speedToks:[], speedMs:[] };
    try { cum = JSON.parse(fs.readFileSync(cumPath, 'utf8')); } catch (e) {}

    if (curCost >= cum.cost.base) cum.cost.total += curCost - cum.cost.base;
    else cum.cost.total += curCost;
    cum.cost.base = curCost;
    if (curDur >= cum.dur.base) cum.dur.total += curDur - cum.dur.base;
    else cum.dur.total += curDur;
    cum.dur.base = curDur;
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

    // Token speed: rolling window of token/sec
    if (curDur > 0 && cum.dur.total > 0) {
      const tps = cum.tok.total / (cum.dur.total / 1000);
      cum.speedToks = cum.speedToks || [];
      cum.speedMs = cum.speedMs || [];
      cum.speedToks.push(cum.tok.total);
      cum.speedMs.push(cum.dur.total);
      const windowSec = TOKEN_SPEED_WINDOW * 1000;
      let sumT = 0, sumMs = 0;
      for (let i = cum.speedToks.length - 1; i >= 0; i--) {
        sumT = cum.speedToks[i];
        sumMs = cum.speedMs[i];
        if (cum.dur.total - cum.speedMs[i] > windowSec) break;
      }
      cum._speed = sumMs > 0 ? (sumT / (sumMs / 1000)).toFixed(1) : '0.0';
    }

    atomicWrite(cumPath, JSON.stringify(cum));

    // ── Rate Limits ─────────────────────────────────────────────────────
    const _nowSec = Date.now() / 1000;
    const rlPath = path.join(os.homedir(), '.claude', 'cc-rl-snaps.json');
    let rlSnaps = {};
    try { rlSnaps = JSON.parse(fs.readFileSync(rlPath, 'utf8')); } catch (e) {}
    const aggMax = (field) => {
      const myRL = i.rate_limits?.[field];
      const liveSnaps = [];
      for (const snap of Object.values(rlSnaps)) {
        const s = snap?.[field];
        if (s && typeof s.used_percentage === 'number' && s.resets_at > _nowSec) {
          liveSnaps.push(s);
        }
      }
      if (liveSnaps.length === 0) {
        return (myRL?.resets_at > _nowSec) ? myRL.used_percentage : 0;
      }
      let latestR = 0;
      for (const s of liveSnaps) if (s.resets_at > latestR) latestR = s.resets_at;
      let max = 0;
      for (const s of liveSnaps) {
        if (s.resets_at === latestR && s.used_percentage > max) max = s.used_percentage;
      }
      return max;
    };
    const r5h = Math.round(aggMax('five_hour'));
    const r7d = Math.round(aggMax('seven_day'));

    // ── Git Info ────────────────────────────────────────────────────────
    let branch = '', dirty = 0, repoName = '';
    try {
      branch = (spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8', timeout: 2000 }).stdout || '').trim();
      dirty = (spawnSync('git', ['status', '--porcelain'], { encoding: 'utf8', timeout: 2000 }).stdout || '').trim().split('\n').filter(Boolean).length;
      const remoteUrl = (spawnSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8', timeout: 2000 }).stdout || '').trim();
      const m = remoteUrl.match(/[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
      if (m) repoName = `${m[1]}/${m[2]}`;
    } catch (e) {}

    const shortDir = (i.cwd || i.workspace?.current_dir || '').split(/[/\\]/).slice(-2).join('/');

    // ── Hook Data ────────────────────────────────────────────────────────
    const compactCount = (() => {
      try { return JSON.parse(fs.readFileSync(path.join(os.homedir(), '.claude', 'cc-compacts.json'), 'utf8') || '{}').count || 0; } catch (e) { return 0; }
    })();

    const subagentPath = path.join(os.homedir(), '.claude', 'cc-subagents.json');
    let subagents = { running: [], done: [] };
    try { subagents = JSON.parse(fs.readFileSync(subagentPath, 'utf8')); } catch (e) {}

    const mcpPath = path.join(os.homedir(), '.claude', 'mcp-status-cache.json');
    let mcpHealthy = 0, mcpFailed = 0, mcpAuth = 0;
    try {
      const mcpData = JSON.parse(fs.readFileSync(mcpPath, 'utf8'));
      if (mcpData && mcpData.servers) {
        for (const s of mcpData.servers) {
          if (s.status === 'ok') mcpHealthy++;
          else if (s.status === 'failed') mcpFailed++;
          else if (s.status === 'needs_auth' || s.status === 'auth') mcpAuth++;
        }
      }
    } catch (e) {}

    const filesPath = path.join(os.homedir(), '.claude', 'cc-edited-files.json');
    let editedFiles = [];
    try { editedFiles = JSON.parse(fs.readFileSync(filesPath, 'utf8')) || []; } catch (e) {}

    // ── Build Output ─────────────────────────────────────────────────────
    const effortColors = { low: DIM, medium: C.ok, high: C.i, xhigh: C.ed, max: C.hi };
    const effortColor = effortColors[i.effort] || DIM;
    const effortLabel = { low: 'lo', medium: 'md', high: 'hi', xhigh: 'xh', max: 'mx' };
    const effort = effortLabel[i.effort] || '?';

    const seg = (content, fg) => fg + content + R;
    const segDim = (content) => DIM + content + R;
    const segBold = (content, fg) => BOLD + fg + content + R;

    const parts = [];

    // [Email]  if available
    if (accountEmail) parts.push(segDim(`(${accountEmail})`));

    // Repo/branch
    if (repoName) parts.push(seg(`${repoName}`, C.b));
    if (branch) parts.push(seg(branch, dirty ? C.hi : C.b) + (dirty ? seg('!', C.hi) : ''));

    // Working dir
    if (shortDir) parts.push(segDim(shortDir));

    // Model + effort
    parts.push(segBold(`${model}`, C.m) + segDim(`(${effort})`));

    // Cost + duration
    parts.push(seg(`$${cum.cost.total.toFixed(4)}`, C.c) + segDim(fmtDur(Math.round(cum.dur.total/60000))));

    // Lines changed
    if (cum.add.total > 0) parts.push(seg(`+${cum.add.total}`, C.ok));
    if (cum.rm.total > 0) parts.push(seg(`-${cum.rm.total}`, C.hi));

    // Token speed
    if (cum._speed && parseFloat(cum._speed) > 0) {
      parts.push(seg(`${cum._speed}t/s`, C.bar));
    }

    // Tokens total
    parts.push(seg(fmtTok(cum.tok.total), C.bar));

    // Quota bars
    if (r5h > 0) parts.push(seg(bar(r5h, 8), cc(r5h)) + segDim('5h'));
    if (r7d > 0) parts.push(seg(bar(r7d, 8), cc(r7d)) + segDim('7d'));

    // Subagents
    if (subagents.running.length > 0) {
      parts.push(seg(`${subagents.running.length}◆`, C.ed));
    }

    // MCP status
    if (mcpFailed > 0) parts.push(seg(`✘${mcpFailed}`, C.err));
    else if (mcpHealthy > 0) parts.push(seg(`✔${mcpHealthy}`, C.ok));
    if (mcpAuth > 0) parts.push(seg(`△${mcpAuth}`, C.i));

    // Compact count
    if (compactCount > 0) parts.push(segDim(`c${compactCount}`));

    // Edited files
    if (editedFiles.length > 0) {
      const f = editedFiles[0].split('/').pop();
      parts.push(seg(f, C.ed));
    }

    // Join with powerline separators
    let output = parts.join(' ' + DIM + pl + ' ' + R);
    if (POWERLINE_FONTS) {
      output = DIM + pl + ' ' + R + output + ' ' + DIM + pl + R;
    }

    process.stdout.write(output + '\n');
  } catch (e) {
    process.stdout.write('');
  }
});
