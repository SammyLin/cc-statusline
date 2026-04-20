import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getTheme, seg, segDim, segBold, R, DIM, BOLD } from '../lib/colors.js';

test('getTheme — returns each named theme with all color slots', () => {
  for (const name of ['default', 'nord', 'catppuccin', 'dracula', 'pastel']) {
    const t = getTheme(name);
    for (const slot of ['m', 'c', 'd', 'b', 'i', 'ok', 'err', 'ed', 'bar', 'hi']) {
      assert.ok(t[slot], `theme ${name} missing slot ${slot}`);
      assert.match(t[slot], /^\x1b\[/, `theme ${name}.${slot} should be an ANSI escape`);
    }
  }
});

test('getTheme — unknown name falls back to default', () => {
  assert.deepEqual(getTheme('does-not-exist'), getTheme('default'));
});

test('seg / segDim / segBold — wrap content with reset', () => {
  assert.ok(seg('hi', '\x1b[31m').endsWith(R));
  assert.ok(segDim('hi').startsWith(DIM));
  assert.ok(segDim('hi').endsWith(R));
  assert.ok(segBold('hi', '\x1b[31m').startsWith(BOLD));
  assert.ok(segBold('hi', '\x1b[31m').includes('\x1b[31m'));
});
