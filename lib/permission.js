// ─── Read the current permission mode from the session transcript ──────
// Claude Code records `permissionMode` on each turn in the JSONL transcript
// at i.transcript_path. We tail the file and return the most recent value.
import fs from 'fs';

const RX = /"permissionMode":"([^"]+)"/g;

export function getPermissionMode(transcriptPath) {
  if (!transcriptPath) return '';
  let buf;
  try {
    const stat = fs.statSync(transcriptPath);
    const fd = fs.openSync(transcriptPath, 'r');
    // Read up to the last 64 KB — plenty to capture the most recent turn.
    const want = Math.min(stat.size, 64 * 1024);
    buf = Buffer.alloc(want);
    fs.readSync(fd, buf, 0, want, stat.size - want);
    fs.closeSync(fd);
  } catch (_) { return ''; }
  const tail = buf.toString('utf8');
  let last = '';
  let m;
  while ((m = RX.exec(tail)) !== null) last = m[1];
  RX.lastIndex = 0;
  return last;
}
