// ─── Git info (repo, branch, dirty count) ──────────────────────────────
import { spawnSync } from 'child_process';

export function getGitInfo() {
  let branch = '', dirty = 0, repoName = '';
  try {
    const opts = { encoding: 'utf8', timeout: 2000 };
    branch = (spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], opts).stdout || '').trim();
    dirty = (spawnSync('git', ['status', '--porcelain'], opts).stdout || '').trim().split('\n').filter(Boolean).length;
    const remoteUrl = (spawnSync('git', ['remote', 'get-url', 'origin'], opts).stdout || '').trim();
    const m = remoteUrl.match(/[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
    if (m) repoName = `${m[1]}/${m[2]}`;
  } catch (e) {}
  return { branch, dirty, repoName };
}
