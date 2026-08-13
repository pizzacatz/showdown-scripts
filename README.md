# Showdown Scripts

Tampermonkey userscripts that improve quality of life on [Pokémon Showdown](https://play.pokemonshowdown.com/). Each script lives in its own directory with its own README; install only the ones you want.

## Scripts

| Script | Version | Description |
|--------|---------|-------------|
| [Ghost Clicker](ghost-clicker/) | 4.1 | Replaces Showdown's Random Battle default with **Reg M-B Bo3** (once per page load, never re-enforced) and adds quick-select buttons for Reg M-B Bo1/Bo3. |
| [QoL Battle Tools](qol-battle/) | 1.0 | Arm-then-confirm **Forfeit** button and automatic **replay archive** — every completed battle is uploaded to Showdown's replay server and downloaded locally, exactly once. |

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
docs/                     PRDs, design documents, DOM recon notes
test/                     Vitest suite + DOM fixtures (run: npm test)
```

## Testing

`npm install` once, then `npm test` runs the Vitest suite (jsdom): state-machine and idempotency logic, timing behavior via fake timers, and selector/injection checks against DOM fixtures in `test/fixtures/`. For live-site validation, scripts provide a `dryRun` config flag that logs intended actions without performing them.

## Design conventions

These apply to every script in the repo:

- **Default, don't enforce.** A script may set an initial state once, but must never fight the user's manual choices afterwards.
- **Event-driven over polling.** React to DOM changes with `MutationObserver`; short-lived polling is allowed only inside an explicit action, always with a hard timeout.
- **Idempotent injection.** Injected UI uses stable element IDs so rebuilds of Showdown's SPA never create duplicates.
- **Configuration up top.** Format IDs, labels, selectors, and timeouts live in a `CONFIG` block; routine updates (e.g. a new regulation) shouldn't touch logic.
- **Stable selectors.** Prefer `name`/`value` attributes over visible button text — Showdown's UI text changes more often than its attributes.
- **One script, one job.** Unrelated features (replay handling, chat automation, …) get their own script and PRD instead of expanding an existing one.
