// ─── Terminal width detection ──────────────────────────────────────────
// Claude Code invokes the statusline with piped stdin/stdout, so
// process.stdout.columns is undefined. Fall back to reading the real tty
// (and let the user override via COLUMNS / CC_STATUSLINE_COLS).
import fs from 'fs';
import tty from 'tty';

export function getTerminalCols() {
  const override = parseInt(process.env.CC_STATUSLINE_COLS, 10);
  if (override > 0) return override;
  const envCols = parseInt(process.env.COLUMNS, 10);
  if (envCols > 0) return envCols;
  if (process.stdout && process.stdout.columns) return process.stdout.columns;
  let fd = -1;
  try {
    fd = fs.openSync('/dev/tty', 'r+');
    const ws = new tty.WriteStream(fd);
    const cols = ws.columns || 0;
    ws.destroy();
    return cols;
  } catch (_) {
    if (fd >= 0) { try { fs.closeSync(fd); } catch (_) {} }
    return 0;
  }
}
