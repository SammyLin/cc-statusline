import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.resolve(__dirname, '..', 'statusline.js');

// Strip ANSI escapes so assertions are about content, not color.
const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');

function run(input, env = {}) {
  const r = spawnSync('node', [SCRIPT], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  return { out: r.stdout, err: r.stderr, code: r.status, plain: strip(r.stdout) };
}

test('rounded layout — emits two lines with ╭╴ / ╰╴ borders', () => {
  const future5 = Math.floor(Date.now() / 1000) + 7980;
  const future7 = Math.floor(Date.now() / 1000) + 240000;
  const { plain, code } = run({
    model: { display_name: 'Opus 4.7' },
    effort: 'max',
    workspace: { current_dir: process.env.HOME },
    cwd: process.env.HOME,
    session_id: 'test-rounded',
    cost: { total_cost_usd: 1.23, total_duration_ms: 60000, total_lines_added: 10, total_lines_removed: 2 },
    rate_limits: {
      five_hour: { used_percentage: 41, resets_at: future5 },
      seven_day: { used_percentage: 36, resets_at: future7 },
    },
  });
  assert.equal(code, 0);
  const lines = plain.trim().split('\n');
  assert.equal(lines.length, 2, 'rounded layout should emit 2 lines');
  assert.match(lines[0], /^╭╴/);
  assert.match(lines[1], /^╰╴/);
  assert.match(plain, /Opus 4\.7/);
  assert.match(plain, /\$1\.2300/);
  assert.match(plain, /5h 41%/);
  assert.match(plain, /7d 36%/);
});

test('single layout — emits one line, no border chars', () => {
  const { plain, code } = run(
    { model: { display_name: 'Opus 4.7' }, workspace: { current_dir: '/tmp' }, cwd: '/tmp', session_id: 'test-single' },
    { CC_STATUSLINE_LAYOUT: 'single' },
  );
  assert.equal(code, 0);
  const lines = plain.trim().split('\n').filter(Boolean);
  assert.equal(lines.length, 1, 'single layout should emit 1 line');
  assert.doesNotMatch(plain, /[╭╰]/);
});

test('handles missing model/cost gracefully', () => {
  const { plain, code } = run({
    workspace: { current_dir: '/tmp' },
    cwd: '/tmp',
    session_id: 'test-empty',
  });
  assert.equal(code, 0);
  assert.match(plain, /\$0\.0000/);
});

test('emits no output on invalid JSON', () => {
  const r = spawnSync('node', [SCRIPT], { input: 'not json', encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
});
