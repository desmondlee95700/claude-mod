# claude-mod

My public Claude Code mods, in one place. Every item is a standalone plugin under `plugins/`: install only what you need.

| Plugin | Type | What it does |
|---|---|---|
| agents-pane | mod | 🏀 Team Claude: a strip above the prompt while subagents run, and a pane (`/agents-pane`) that tracks each one's status, tools, tokens and time. Every subagent suits up as a numbered pixel player. |
## Install

### From the marketplace

In Claude Code:

```
/plugin marketplace add desmondlee95700/claude-mod
/plugin install agents-pane@claude-mod
```

Restart the session afterwards.

### By hand

```bash
git clone https://github.com/desmondlee95700/claude-mod.git ~/claude-mod
```

Load a mod for one session:

```bash
claude --plugin-dir ~/claude-mod/plugins/agents-pane
```

or for every session (including the desktop app) through `env` in `~/.claude/settings.json`. Separate several folders with `:`; if the variable is already set, append to it:

```json
{
  "env": {
    "CLAUDE_CODE_PLUGIN_DIRS": "~/claude-mod/plugins/agents-pane"
  }
}
```

`git pull` in the clone updates a mod loaded this way.

Mods are built on function hooks (`hooks/register.tsx`), an early-access Claude Code API that may change between releases. If a mod installed from the marketplace does not show up, load it by hand as above.

## Layout

```
.claude-plugin/marketplace.json   the catalog `/plugin marketplace add` reads
plugins/<name>/
  .claude-plugin/plugin.json      manifest
  hooks/hooks.json                points at the hooks module
  hooks/register.tsx              the module itself
  types/index.d.ts                its $.state contract
  tests/*.test.ts                 tests
```

Check a plugin before publishing: `claude plugin validate plugins/<name>`, and the catalog with `claude plugin validate .`

## License

MIT
