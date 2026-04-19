// ─── Read hook JSON files ──────────────────────────────────────────────
import fs from 'fs';
import path from 'path';
import os from 'os';

const claudeDir = path.join(os.homedir(), '.claude');

export function readCompacts() {
  try {
    return JSON.parse(fs.readFileSync(path.join(claudeDir, 'cc-compacts.json'), 'utf8') || '{}').count || 0;
  } catch (e) { return 0; }
}

export function readSubagents() {
  try {
    return JSON.parse(fs.readFileSync(path.join(claudeDir, 'cc-subagents.json'), 'utf8'));
  } catch (e) { return { running: [], done: [] }; }
}

export function readMcpStatus() {
  let healthy = 0, failed = 0, auth = 0;
  try {
    const data = JSON.parse(fs.readFileSync(path.join(claudeDir, 'mcp-status-cache.json'), 'utf8'));
    if (data?.servers) {
      for (const s of data.servers) {
        if (s.status === 'ok') healthy++;
        else if (s.status === 'failed') failed++;
        else if (s.status === 'needs_auth' || s.status === 'auth') auth++;
      }
    }
  } catch (e) {}
  return { healthy, failed, auth };
}

export function readEditedFiles() {
  try {
    return JSON.parse(fs.readFileSync(path.join(claudeDir, 'cc-edited-files.json'), 'utf8')) || [];
  } catch (e) { return []; }
}
