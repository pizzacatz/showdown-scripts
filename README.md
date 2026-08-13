# Showdown Scripts

Tampermonkey userscripts that improve quality of life on [Pokémon Showdown](https://play.pokemonshowdown.com/).

## Scripts

| Script | Status | What it does |
|--------|--------|--------------|
| [Ghost Clicker](ghost-clicker/ghost-clicker.user.js) | v3.0 — refactor planned | Automatically selects the Reg M-B Bo3 battle format on the Showdown home screen. |

## Installing a script

1. Install the [Tampermonkey](https://www.tampermonkey.net/) browser extension.
2. Open the Tampermonkey dashboard → **Utilities** → **Import from file**, or simply open the raw `.user.js` file in the browser — Tampermonkey will offer to install it.
3. Reload `play.pokemonshowdown.com`.

## Ghost Clicker

**Current behavior (v3.0):** polls the page every 50 ms and re-applies the configured format (`gen9championsvgc2026regmbbo3`) whenever the format selector differs from it. This makes Bo3 a *permanent lock* — manually choosing another format gets overridden.

**Planned behavior:** apply the Bo3 default **once per page load**, then leave the selector alone. Manual quick-select buttons ("M-B" for Bo1, "M-B Bo3" for Bo3) let the user deliberately switch between Reg M-B formats. See the full [PRD](docs/PRD-ghost-clicker-improvements.md).

Key design points of the planned refactor:

- **One-shot initialization** — a `MutationObserver` waits for the format selector to exist, applies the default once, and never re-enforces it.
- **Reusable `selectFormat(formatId)`** — the same one-shot action backs both the automatic default and the manual buttons.
- **Guarded state** — `macroRunning` prevents overlapping selection attempts; stable button IDs prevent duplicate injected controls; every wait loop has a hard timeout.
- **Centralized configuration** — format IDs, labels, selectors, and timeouts live in a single `CONFIG` block.

### Repository layout

```
ghost-clicker/ghost-clicker.user.js   # the userscript (current v3.0)
docs/PRD-ghost-clicker-improvements.md # requirements for the planned refactor
```

## Development notes

- Format IDs must be confirmed from Showdown's actual DOM (`button[name="selectFormat"]` values), never guessed. The Reg M-B **Bo1** ID is still unconfirmed (see PRD §11).
- Prefer stable `name`/`value` attributes over visible button text when writing selectors — Showdown's UI text changes more often than its attributes.
- Scope per script: each userscript stays focused; new QoL features (replay handling, chat automation, etc.) get their own script and their own PRD.
