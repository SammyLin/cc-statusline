import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG } from '../lib/config.js';

test('DEFAULT_CONFIG — sensible defaults', () => {
  assert.equal(DEFAULT_CONFIG.theme, 'catppuccin');
  assert.equal(DEFAULT_CONFIG.layout, 'rounded');
  assert.equal(DEFAULT_CONFIG.powerline, false);
  assert.equal(DEFAULT_CONFIG.showDir, true);
  assert.equal(DEFAULT_CONFIG.showQuotaReset, true);
  assert.equal(typeof DEFAULT_CONFIG.dirSegments, 'number');
  assert.ok(DEFAULT_CONFIG.dirSegments > 0);
});

test('DEFAULT_CONFIG — every show* flag is a boolean', () => {
  for (const key of Object.keys(DEFAULT_CONFIG)) {
    if (key.startsWith('show')) {
      assert.equal(typeof DEFAULT_CONFIG[key], 'boolean', `${key} should be boolean`);
    }
  }
});
