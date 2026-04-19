#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');

const dataPath = path.join(os.homedir(), '.claude', 'cc-compacts.json');

let data = { count: 0, sessionStart: Date.now() };
try {
  const stored = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  // Reset if last session was more than 1 hour ago (stale)
  if (Date.now() - (stored.sessionStart || 0) > 3600000) {
    data = { count: 0, sessionStart: Date.now() };
  } else {
    data = stored;
  }
} catch (e) {
  data = { count: 0, sessionStart: Date.now() };
}

data.count = (data.count || 0) + 1;
data.sessionStart = data.sessionStart || Date.now();

fs.writeFileSync(dataPath, JSON.stringify(data));
