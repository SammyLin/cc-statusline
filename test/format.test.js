import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'os';
import { bar, fmtDur, fmtTok, fmtReset, shortDir } from '../lib/format.js';

test('bar — fills proportionally to percentage', () => {
  assert.equal(bar(0, 6),   '░░░░░░');
  assert.equal(bar(50, 6),  '███░░░');
  assert.equal(bar(100, 6), '██████');
});

test('bar — rounds half up', () => {
  // 41% of 6 = 2.46 → round(2.46) = 2
  assert.equal(bar(41, 6), '██░░░░');
  // 50% of 6 = 3.0 → 3
  assert.equal(bar(50, 6), '███░░░');
});

test('fmtDur — minutes, hours, days', () => {
  assert.equal(fmtDur(0),    '0min');
  assert.equal(fmtDur(45),   '45min');
  assert.equal(fmtDur(60),   '1hr');
  assert.equal(fmtDur(125),  '2hr 5min');
  assert.equal(fmtDur(1440), '1d');
  assert.equal(fmtDur(1500), '1d 1hr');
});

test('fmtTok — K/M/B suffixes', () => {
  assert.equal(fmtTok(0),       '0');
  assert.equal(fmtTok(999),     '999');
  assert.equal(fmtTok(1000),    '1.0K');
  assert.equal(fmtTok(32600),   '32.6K');
  assert.equal(fmtTok(1500000), '1.5M');
  assert.equal(fmtTok(2.5e9),   '2.5B');
});

test('fmtReset — short form for under-a-day', () => {
  const future = Math.floor(Date.now() / 1000) + 7980; // 2h13m
  const out = fmtReset(future, '5h');
  assert.match(out, /^\d+h\d+m$|^\d+m$/);
});

test('fmtReset — day-of-week form for 7d window', () => {
  const future = Math.floor(Date.now() / 1000) + 240000; // ~2.7d
  const out = fmtReset(future, '7d');
  assert.match(out, /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) \d+(a|p)$/);
});

test('fmtReset — empty when expired or missing', () => {
  assert.equal(fmtReset(0, '5h'), '');
  assert.equal(fmtReset(undefined, '5h'), '');
  const past = Math.floor(Date.now() / 1000) - 100;
  assert.equal(fmtReset(past, '5h'), '');
});

test('shortDir — substitutes ~ for $HOME', () => {
  const home = os.homedir();
  assert.equal(shortDir(home, 5), '~');
  assert.equal(shortDir(home + '/foo', 5), '~/foo');
});

test('shortDir — collapses long paths to trailing segments', () => {
  const home = os.homedir();
  const deep = home + '/a/b/c/d/e';
  assert.equal(shortDir(deep, 2), '~/…/d/e');
});

test('shortDir — leaves short paths alone', () => {
  const home = os.homedir();
  assert.equal(shortDir(home + '/x/y', 2), '~/x/y');
});

test('shortDir — handles empty input', () => {
  assert.equal(shortDir('', 2), '');
});
