// ─── Theme system & ANSI color helpers ─────────────────────────────────

export const R = '\x1b[0m';
export const DIM = '\x1b[2m';
export const BOLD = '\x1b[1m';
export const UND = '\x1b[4m';

const THEMES = {
  default:    { m: '\x1b[36m', c: '\x1b[32m', d: '\x1b[2m', b: '\x1b[34m', i: '\x1b[33m', ok: '\x1b[32m', err: '\x1b[31m', ed: '\x1b[35m', bar: '\x1b[36m', hi: '\x1b[31m' },
  nord:       { m: '\x1b[38;5;75m',  c: '\x1b[38;5;181m', d: '\x1b[38;5;244m', b: '\x1b[38;5;109m', i: '\x1b[38;5;223m', ok: '\x1b[38;5;142m', err: '\x1b[38;5;203m', ed: '\x1b[38;5;139m', bar: '\x1b[38;5;68m', hi: '\x1b[38;5;203m' },
  catppuccin: { m: '\x1b[38;5;162m', c: '\x1b[38;5;114m', d: '\x1b[38;5;245m', b: '\x1b[38;5;147m', i: '\x1b[38;5;223m', ok: '\x1b[38;5;114m', err: '\x1b[38;5;203m', ed: '\x1b[38;5;212m', bar: '\x1b[38;5;117m', hi: '\x1b[38;5;203m' },
  dracula:    { m: '\x1b[38;5;171m', c: '\x1b[38;5;84m', d: '\x1b[38;5;244m', b: '\x1b[38;5;229m', i: '\x1b[38;5;180m', ok: '\x1b[38;5;84m', err: '\x1b[38;5;203m', ed: '\x1b[38;5;212m', bar: '\x1b[38;5;117m', hi: '\x1b[38;5;203m' },
};

export function getTheme(name) {
  return THEMES[name] || THEMES.default;
}

export const POWERLINE = '\uE0B0';
export const POWERLINE_REV = '\uE0B2';

export const seg = (content, fg) => fg + content + R;
export const segDim = (content) => DIM + content + R;
export const segBold = (content, fg) => BOLD + fg + content + R;
