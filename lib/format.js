// ─── Format helpers ────────────────────────────────────────────────────
import fs from 'fs';
import os from 'os';

export function shortDir(p, segments = 2) {
  if (!p) return '';
  const home = os.homedir();
  let s = p.startsWith(home) ? '~' + p.slice(home.length) : p;
  if (segments <= 0) return s;
  const parts = s.split('/').filter(Boolean);
  // For ~/-rooted paths, keep '~' marker.
  const rooted = s.startsWith('~') || s.startsWith('/');
  const tail = parts.slice(-segments);
  if (parts.length <= segments) return s;
  return (rooted && s.startsWith('~') ? '~/…/' : '/…/') + tail.join('/');
}


export function bar(pct, len = 10) {
  const filled = Math.round(pct / 100 * len);
  return '\u2588'.repeat(filled) + '\u2591'.repeat(len - filled);
}

export function fmtDur(min) {
  if (min < 60) return `${min}min`;
  if (min < 1440) {
    const h = Math.floor(min / 60), m = min % 60;
    return m > 0 ? `${h}hr ${m}min` : `${h}hr`;
  }
  const dd = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60);
  return h > 0 ? `${dd}d ${h}hr` : `${dd}d`;
}

export function fmtTok(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

export function fmtSpeed(tok, ms) {
  if (!ms || ms <= 0) return '';
  return `${fmtTok(tok)}/s`;
}

// ─── East Asian Width ──────────────────────────────────────────────────

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

export function displayWidth(s) {
  let w = 0;
  for (const ch of s.replace(/\x1b\[[0-9;]*m/g, '')) {
    w += isWide(ch.codePointAt(0)) ? 2 : 1;
  }
  return w;
}

export function pad(s, w) {
  const n = w - displayWidth(s);
  return n > 0 ? s + ' '.repeat(n) : s;
}

// ─── Atomic file write ─────────────────────────────────────────────────

export function atomicWrite(f, data) {
  const tmp = `${f}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(tmp, data);
    fs.renameSync(tmp, f);
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch (_) {}
  }
}
