// ─── Configuration ─────────────────────────────────────────────────────────
// All user-configurable values live here.
// Override by creating ~/.claude/statusline-config.json or by setting env vars.
import fs from 'fs';
import path from 'path';
import os from 'os';

export const DEFAULT_CONFIG = {
  theme: 'catppuccin',
  layout: 'rounded',          // 'rounded' (multi-line ╭─ ╰─) | 'single' (one-line)
  powerline: false,           // single-line only; rounded layout ignores this
  tokenSpeedWindow: 30,
  quotaBarLen: 6,
  showQuotaReset: true,
  dirSegments: 2,             // how many trailing path segments to show
  showDir: true,
  showPermission: true,       // show current --permission-mode (acceptEdits/plan/bypass)
  showAccount: true,
  showCompact: true,
  showSubagent: true,
  showMcp: true,
  showEditedFiles: true,
  showDirty: true,
};

export function loadConfig() {
  const home = os.homedir();
  const configPath = path.join(home, '.claude', 'statusline-config.json');
  let userConfig = {};
  try { userConfig = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch (_) {}
  const envConfig = {};
  if (process.env.CC_STATUSLINE_THEME) envConfig.theme = process.env.CC_STATUSLINE_THEME;
  if (process.env.CC_STATUSLINE_LAYOUT) envConfig.layout = process.env.CC_STATUSLINE_LAYOUT;
  if (process.env.CC_STATUSLINE_POWERLINE === 'false') envConfig.powerline = false;
  if (process.env.CC_STATUSLINE_POWERLINE === 'true') envConfig.powerline = true;
  return { ...DEFAULT_CONFIG, ...userConfig, ...envConfig };
}
