# cc-statusline

A lightweight Claude Code statusline dashboard — shows session info, cost tracking, quota bars, subagent status, token speed, and more in your terminal.

![Statusline preview](images/demo.png)

## Features

- **Session info** — model name + effort level, cost (delta-tracked across compactions), duration
- **Quota bars** — 5h and 7d rate limit usage with color-coded progress bars
- **Repo/branch** — git owner/repo, branch name, dirty indicator
- **Directory** — current working directory
- **Subagent tracker** — concurrent subagent runs
- **MCP health** — server status monitoring (healthy/failed/needs_auth)
- **Compact count** — context compaction tracking
- **Edited files** — recently modified files
- **Token speed** — rolling average tokens/sec
- **Account email** — shows logged-in account (from ~/.claude.json)
- **Powerline mode** — beautiful separators (requires Powerline/Nerd fonts)
- **Themes** — default, nord, catppuccin, dracula

## Themes

Change the `THEME` constant at the top of `statusline.js`:

```javascript
const THEME = 'catppuccin'; // 'default' | 'nord' | 'catppuccin' | 'dracula'
```

## Powerline Mode

Set `POWERLINE_FONTS = true` for nice separators (requires a Powerline/Nerd font):

```javascript
const POWERLINE_FONTS = true;  // Set false for simple pipe separators
```

## Installation

```bash
# Clone the repo
git clone https://github.com/SammyLin/cc-statusline ~/.cc-statusline

# Copy files
cp ~/.cc-statusline/statusline.js ~/.claude/statusline.js
cp ~/.cc-statusline/hooks/*.js ~/.claude/hooks/
cp -R ~/.cc-statusline/lib ~/.claude/lib
```

Then add to your `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node ~/.claude/statusline.js",
    "refreshInterval": 30
  },
  "hooks": {
    "SubagentStart": [{ "matcher": ".*", "hooks": [{ "type": "command", "command": "node ~/.claude/hooks/subagent-tracker.js" }] }],
    "SubagentStop": [{ "matcher": ".*", "hooks": [{ "type": "command", "command": "node ~/.claude/hooks/subagent-tracker.js" }] }],
    "PreCompact": [{ "matcher": ".*", "hooks": [{ "type": "command", "command": "node ~/.claude/hooks/compact-monitor.js" }] }],
    "PostToolUse": [{ "matcher": "Write|Edit", "hooks": [{ "type": "command", "command": "node ~/.claude/hooks/file-tracker.js" }] }],
    "UserPromptSubmit": [{ "hooks": [
      { "type": "command", "command": "node ~/.claude/hooks/message-tracker.js" }
    ]}]
  }
}
```

## Hooks

| Hook | Event | Purpose |
|------|-------|---------|
| `subagent-tracker.js` | SubagentStart/Stop | Track subagent runs |
| `compact-monitor.js` | PreCompact | Count compaction events |
| `file-tracker.js` | PostToolUse (Write/Edit) | Record recently edited files |
| `message-tracker.js` | UserPromptSubmit | Cache recent messages |

## Color Scheme

- **Green** — low usage, success states
- **Yellow** — medium usage, warnings
- **Red** — high usage, errors
- **Cyan** — repo/directory info
- **Dim** — secondary info

## License

MIT
