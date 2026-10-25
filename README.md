# claude-mod

A collection of public [Claude Code](https://claude.com/claude-code) mods. Each one is a standalone plugin under `plugins/`, so you install only the ones you want.

<p>
  <img src="https://img.shields.io/badge/Claude%20Code-plugin%20marketplace-D97757" alt="Claude Code plugin marketplace">
  <img src="https://img.shields.io/badge/agents--pane-v0.3.0-555555" alt="agents-pane v0.3.0">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License: MIT"></a>
</p>

## Contents

- [Mods](#mods)
- [agents-pane: the Astral Express](#agents-pane-the-astral-express)
- [Installation](#installation)
- [Repository layout](#repository-layout)
- [License](#license)

## Mods

| Mod | Version | What it does |
| :--- | :---: | :--- |
| [agents-pane](plugins/agents-pane) | 0.3.0 | Every subagent boards the Astral Express as a Honkai: Star Rail pixel hero. A strip above the prompt shows the train with the working heroes in its windows, and the `/agents-pane` pane tracks each subagent's status, tools, tokens and time while its hero plays through their kit. |

> [!IMPORTANT]
> Mods are built on function hooks (`hooks/register.tsx`), an early-access Claude Code API that may change between releases.

## agents-pane: the Astral Express

Each subagent takes the next hero in the roster, or the hero its description names (for example "Firefly …"). While it works, its card loops through the hero's kit and names each move as it plays.

| Hero | Path | Basic ATK | Skill | Ultimate |
| :--- | :--- | :--- | :--- | :--- |
| Dan Heng • Imbibitor Lunae | Destruction | Beneficent Lotus: water slashes | Transcendence: dragon scales and a spear thrust | Azure's Aqua Ablutes All: full moon and the azure dragon |
| Dan Heng • Permansor Terrae | Preservation | Aegis Vitae: a gauntlet strike | Terra Omnibus: a golden shield, Bondmate and Souldragon | A Dragon's Zenith Knows No Rue: the golden dragon dives into a shockwave |
| Castorice | Remembrance | Lament, Nethersea's Ripple | Silence, Wraithfly's Caress: wraithflies | Doomshriek, Dawn's Chime: Netherwing over the Lost Netherland |
| Firefly | Destruction | Order: Flare Propulsion | Order: Aerial Bombardment | Complete Combustion: SAM's green flame wings |

Firefly fights as SAM, her armor, and returns to herself once her work is done.

- **Above the prompt**, the Astral Express rides the star rail with one carriage window per working subagent, up to four. With none at work, it waits on the rail.
- **The pane** (`/agents-pane`) opens on a board styled after Star Rail's battle screen: the action order with the working heroes' faces, trailblaze time, victories and defeats, a skill point for each hero at work, and token totals.
- **In a terminal**, the heroes are drawn in half-block characters.

## Installation

### From the marketplace

In Claude Code, run:

```
/plugin marketplace add desmondlee95700/claude-mod
/plugin install agents-pane@claude-mod
```

Then restart the session.

> [!TIP]
> If a mod installed from the marketplace doesn't show up, load it by hand as described below.

### By hand

Clone the repository:

```bash
git clone https://github.com/desmondlee95700/claude-mod.git ~/claude-mod
```

Load a mod for a single session:

```bash
claude --plugin-dir ~/claude-mod/plugins/agents-pane
```

Or load it for every session, including the desktop app, through `env` in `~/.claude/settings.json`. Separate several folders with `:`, and append to the variable if it's already set:

```json
{
  "env": {
    "CLAUDE_CODE_PLUGIN_DIRS": "~/claude-mod/plugins/agents-pane"
  }
}
```

Run `git pull` in the clone to update mods loaded this way.

## Repository layout

```
.claude-plugin/marketplace.json   catalog read by /plugin marketplace add
plugins/<name>/
  .claude-plugin/plugin.json      manifest
  hooks/hooks.json                points at the hooks module
  hooks/register.tsx              the hooks module
  types/index.d.ts                its $.state contract
  tests/*.test.ts                 tests
```

Validate a plugin and the catalog before publishing:

```bash
claude plugin validate plugins/<name>
claude plugin validate .
```

## License

The code is released under the [MIT License](LICENSE).

> [!NOTE]
> The pixel heroes are unofficial fan art of Honkai: Star Rail characters. This project is not affiliated with or endorsed by HoYoverse. Honkai: Star Rail and its characters belong to COGNOSPHERE / HoYoverse.
