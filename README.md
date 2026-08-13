# Showdown Scripts

Tampermonkey userscripts that improve quality of life on [Pokémon Showdown](https://play.pokemonshowdown.com/). Each script lives in its own directory with its own README; install only the ones you want.

## Scripts

| Script | Version | Description |
|--------|---------|-------------|
| [Ghost Clicker](ghost-clicker/) | 4.0 | Replaces Showdown's Random Battle default with **Reg M-B Bo3** (once per page load, never re-enforced) and adds quick-select buttons for Reg M-B Bo1/Bo3. |

More scripts will be added over time; each new feature gets its own script and its own PRD in [`docs/`](docs/) rather than growing an existing script.

## Installing a script

1. Install the [Tampermonkey](https://www.tampermonkey.net/) browser extension.
2. Open the script's `.user.js` file raw in the browser — Tampermonkey will offer to install it. (Alternatively: Tampermonkey dashboard → **Utilities** → **Import from file**.)
3. Reload `play.pokemonshowdown.com`.

## Repository layout

```
<script-name>/            one directory per userscript
  <script-name>.user.js     the installable script
  README.md                 what it does, config, limitations
docs/                     PRDs and design documents
```

## Design conventions

These apply to every script in the repo:

- **Default, don't enforce.** A script may set an initial state once, but must never fight the user's manual choices afterwards.
- **Event-driven over polling.** React to DOM changes with `MutationObserver`; short-lived polling is allowed only inside an explicit action, always with a hard timeout.
- **Idempotent injection.** Injected UI uses stable element IDs so rebuilds of Showdown's SPA never create duplicates.
- **Configuration up top.** Format IDs, labels, selectors, and timeouts live in a `CONFIG` block; routine updates (e.g. a new regulation) shouldn't touch logic.
- **Stable selectors.** Prefer `name`/`value` attributes over visible button text — Showdown's UI text changes more often than its attributes.
- **One script, one job.** Unrelated features (replay handling, chat automation, …) get their own script and PRD instead of expanding an existing one.
