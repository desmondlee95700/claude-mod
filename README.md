# claude-mod

My public Claude Code mods, in one place. Every item is a standalone plugin under `plugins/`: install only what you need.

| Plugin | Type | What it does |
|---|---|---|
| agents-pane | mod | ✦ Astral Express: every subagent boards as a Honkai: Star Rail pixel hero. A strip above the prompt shows the Astral Express riding the star rail with the working heroes in its windows, and a pane (`/agents-pane`) plays each hero's kit while it tracks status, tools, tokens and time. |

## agents-pane: the Astral Express

Each subagent takes the next hero in the roster, or the hero its description names ("Firefly …"). While it works, its card loops the hero's kit, each move named as it plays:

| Hero | Path | Basic ATK | Skill | Ultimate |
|---|---|---|---|---|
| Dan Heng • Imbibitor Lunae | Destruction | Beneficent Lotus: water slashes | Transcendence: dragon scales and a spear thrust | Azure's Aqua Ablutes All: full moon and the azure dragon |
| Dan Heng • Permansor Terrae | Preservation | Aegis Vitae: a gauntlet strike | Terra Omnibus: a golden shield, Bondmate and Souldragon | A Dragon's Zenith Knows No Rue: the golden dragon dives into a shockwave |
| Castorice | Remembrance | Lament, Nethersea's Ripple | Silence, Wraithfly's Caress: wraithflies | Doomshriek, Dawn's Chime: Netherwing over the Lost Netherland |
| Firefly | Destruction | Order: Flare Propulsion | Order: Aerial Bombardment | Complete Combustion: SAM's green flame wings |

Firefly fights as SAM, her armor, and is herself again once her work is done.

Above the prompt the Astral Express rides the star rail with one carriage window per working subagent, up to four; with none at work it waits on the rail. The pane opens on a board styled after Star Rail's battle screen: the action order with the working heroes' faces, trailblaze time, victories and defeats, a skill point for each hero at work, and tokens. In a terminal the heroes are drawn in half-block characters.

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

MIT for the code.

The pixel heroes are unofficial fan art of Honkai: Star Rail characters. This project is not affiliated with or endorsed by HoYoverse; Honkai: Star Rail and its characters belong to COGNOSPHERE / HoYoverse.
