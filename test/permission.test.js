import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getPermissionMode } from '../lib/permission.js';

function tmpFile(contents) {
  const p = path.join(os.tmpdir(), `cc-statusline-perm-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`);
  fs.writeFileSync(p, contents);
  return p;
}

test('returns empty string when transcript path is missing or invalid', () => {
  assert.equal(getPermissionMode(''), '');
  assert.equal(getPermissionMode(undefined), '');
  assert.equal(getPermissionMode('/nonexistent/file.jsonl'), '');
});

test('returns the most recent permissionMode value', () => {
  const lines = [
    JSON.stringify({ type: 'user', permissionMode: 'default' }),
    JSON.stringify({ type: 'assistant', text: 'hi' }),
    JSON.stringify({ type: 'user', permissionMode: 'acceptEdits' }),
    JSON.stringify({ type: 'user', permissionMode: 'plan' }),
  ].join('\n');
  const p = tmpFile(lines);
  assert.equal(getPermissionMode(p), 'plan');
  fs.unlinkSync(p);
});

test('handles transcripts with no permissionMode field', () => {
  const p = tmpFile(JSON.stringify({ type: 'user', text: 'hello' }));
  assert.equal(getPermissionMode(p), '');
  fs.unlinkSync(p);
});

test('reads only the tail for large files (cheap on long sessions)', () => {
  const filler = 'x'.repeat(1024);
  const head = Array.from({ length: 200 }, () => `{"junk":"${filler}"}`).join('\n');
  const tail = JSON.stringify({ type: 'user', permissionMode: 'bypassPermissions' });
  const p = tmpFile(head + '\n' + tail);
  assert.equal(getPermissionMode(p), 'bypassPermissions');
  fs.unlinkSync(p);
});
