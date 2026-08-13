# Ghost Clicker (Format Quick-Select)

Makes **Reg M-B Bo3** the default battle format on Pokémon Showdown — once per page load — and adds quick-select buttons for switching between Reg M-B Bo1 and Bo3.

## What it does

- **One-time default:** when the home screen's format selector appears, the script selects Reg M-B Bo3 once. After that it never touches the selector again for the rest of the page load — manually choosing another format sticks. Reloading the page re-applies the default.
- **Quick-select buttons:** two buttons, **M-B** (Bo1) and **M-B Bo3**, are injected directly after the format selector. Each performs a single one-shot selection; clicking one while its format is already active does nothing.
- **Event-driven:** a `MutationObserver` reacts when Showdown builds or rebuilds the UI (re-injecting buttons without duplicates). There is no persistent polling loop; short-lived polling only happens inside a selection attempt, capped at 1.5 seconds.

## Install

Open [`ghost-clicker.user.js`](ghost-clicker.user.js) raw in a browser with [Tampermonkey](https://www.tampermonkey.net/) installed, and accept the install prompt. Then reload `play.pokemonshowdown.com`.

## Configuration

Everything tweakable lives in the `CONFIG` block at the top of the script:

| Key | Meaning |
|-----|---------|
| `formats.bo3.id` | Showdown format ID for Reg M-B Bo3 (`gen9championsvgc2026regmbbo3`). |
| `formats.bo1.id` | Showdown format ID for Reg M-B Bo1 (`gen9championsvgc2026regmb`, **unverified** — inferred by dropping the `bo3` suffix). |
| `defaultFormat` | Which format the one-time default applies (`'bo3'`). |
| `optionTimeoutMs` | Hard cap on a selection attempt before it aborts cleanly. |

When a new regulation rolls around, update the format IDs and labels here — the selection logic doesn't change.

## Known limitations

- The Bo1 format ID has not been confirmed against Showdown's actual format list. If the M-B button does nothing, inspect a Bo1 entry in the format menu (`button[name="selectFormat"]`'s `value` attribute) and correct `CONFIG.formats.bo1.id`.
- Selecting a format works by clicking through Showdown's real format menu, so the menu popup flashes briefly during a selection.
- Mobile layout has not been tested.

## Version history

| Version | Notes |
|---------|-------|
| 4.3 | Fix: stop quick-select clicks from bubbling — the client dismisses popups on any background click, which closed the format menu the instant it opened. |
| 4.2 | Fix: wait for the real format selector — the client's disabled "Loading..." placeholder was consuming the one-shot default before the format list arrived. |
| 4.1 | Auto-update headers (`@updateURL`/`@downloadURL`) pointing at this repo. |
| 4.0 | One-shot default + quick-select buttons; removed the permanent 50 ms enforcement loop ([PRD](../docs/PRD-ghost-clicker-improvements.md)). |
| 3.0 | "Hyper-optimized" enforcement loop: polled every 50 ms and re-forced Bo3 whenever the selector changed. |
