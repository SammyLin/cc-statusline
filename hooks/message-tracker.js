#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');

const dataPath = path.join(os.homedir(), '.claude', 'cc-messages.json');

let data = [];
try { data = JSON.parse(fs.readFileSync(dataPath, 'utf8')); } catch (e) {}

const role = process.argv[2] || process.env.CLAUDE_EVENT?.includes('User') ? 'user' : 'assistant';
const content = process.argv.slice(3).join(' ') || '';

if (content) {
  data.push({ role, content: content.slice(0, 200), ts: Date.now() });
  if (data.length > 20) data = data.slice(-20);
  fs.writeFileSync(dataPath, JSON.stringify(data));
}
