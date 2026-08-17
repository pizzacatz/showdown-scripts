# Ghost Clicker (Format Quick-Select)

Makes **Reg M-B Bo3** the default battle format on Pokémon Showdown — once per page load — and adds one-click buttons that select Reg M-B Bo1 or Bo3 **and start searching**.

## What it does

- **One-time default:** when the home screen's format selector appears, the script selects Reg M-B Bo3 once. After that it never touches the selector again for the rest of the page load — manually choosing another format sticks. Reloading the page re-applies the default.
- **Quick-select buttons:** two buttons, **Reg M-B** (Bo1) and **Reg M-B (Bo3)**, are injected as native menu rows directly below the format selector. They match the Battle! button's look exactly: the `mainmenu1` color class and `<strong>` label markup are shared, and the `big` size rules (230×50px, 14pt) are inlined — the `big` class itself can't be used because the client relabels every `button.big` in the main menu whenever search state changes. Any theme or custom color scheme applies to them the same way it does to Battle!. Each click selects its format and then presses the client's own **Battle!** button, so the whole native search flow runs (login prompt, "Please select a team", team upload, the 3 s search delay, the Cancel row). If the format is already active it just searches. While formats are still loading or a search is already connecting/searching, the buttons show the client's greyed `disabled` look and do nothing — the same states in which the format selector itself is locked. The one-time default on page load only selects; it never searches.
- **Invisible selection:** a selection clicks through Showdown's real format menu — so all of the client's format-change side effects run (team selector re-render, best-of toggle) — but the menu popup is CSS-hidden for the duration, so nothing flashes. The Format button's label updating is the visible confirmation.
- **Blank-team repair:** works around a classic-client bug where switching between two formats that share a teambuilder format (Reg M-B ↔ Reg M-B (Bo3)) blanks the team selector after you've manually picked a team. The script remembers the last non-blank selection and restores it through the client's own `renderTeams`, so the repaired button is fully native. A blank that's legitimate (no team fits the new format) is left alone, and if Showdown fixes the bug upstream this code simply never fires.
- **Event-driven:** a `MutationObserver` reacts when Showdown builds or rebuilds the UI (re-injecting buttons without duplicates). There is no persistent polling loop; short-lived polling only happens inside a selection attempt, capped at 1.5 seconds.

## Install

Open [`ghost-clicker.user.js`](ghost-clicker.user.js) raw in a browser with [Tampermonkey](https://www.tampermonkey.net/) installed, and accept the install prompt. Then reload `play.pokemonshowdown.com`.

## Configuration

Everything tweakable lives in the `CONFIG` block at the top of the script:

| Key | Meaning |
|-----|---------|
| `formats.bo3.id` | Showdown format ID for Reg M-B Bo3 (`gen9championsvgc2026regmbbo3`). |
| `formats.bo1.id` | Showdown format ID for Reg M-B Bo1 (`gen9championsvgc2026regmb`, verified against the server's format list). |
| `defaultFormat` | Which format the one-time default applies (`'bo3'`). |
| `optionTimeoutMs` | Hard cap on a selection attempt before it aborts cleanly. |

When a new regulation rolls around, update the format IDs and labels here — the selection logic doesn't change.

## Known limitations

- Mobile layout has not been tested.

## Version history

| Version | Notes |
|---------|-------|
| 4.11 | Quick-select buttons now select **and search**: `selectFormat` returns a promise (true when the format is active), chained into a click on the native Battle! button. Buttons mirror the format selector's disabled state and carry a "Search" sub-label. |
| 4.10 | Blank-team repair: restores the team selection the client drops when switching between Bo1 and Bo3 (client bug — shared teambuilder format skips the auto-pick after `curTeamIndex` is reset). |
| 4.9 | UI: format menu is CSS-hidden during a selection — no more popup flash; the client's format-change side effects still run in full. |
| 4.8 | Fix: labels were overwritten with "Battle!" — the client relabels every `button.big` in the main menu, so the `big` class is replaced with inline equivalents of its size rules. |
| 4.7 | UI: buttons clone the Battle! button exactly (`mainmenu1 big` classes + `<strong>` label) — same color, font, and width under any theme. |
| 4.6 | UI: fully native buttons — one per menu row, zero custom CSS, relabeled "Reg M-B" / "Reg M-B (Bo3)". |
| 4.5 | UI: quick-select row centered in the menu column. |
| 4.4 | UI: quick-select buttons moved to their own labeled form row below Format. |
| 4.3 | Fix: stop quick-select clicks from bubbling — the client dismisses popups on any background click, which closed the format menu the instant it opened. |
| 4.2 | Fix: wait for the real format selector — the client's disabled "Loading..." placeholder was consuming the one-shot default before the format list arrived. |
| 4.1 | Auto-update headers (`@updateURL`/`@downloadURL`) pointing at this repo. |
| 4.0 | One-shot default + quick-select buttons; removed the permanent 50 ms enforcement loop ([PRD](../docs/PRD-ghost-clicker-improvements.md)). |
| 3.0 | "Hyper-optimized" enforcement loop: polled every 50 ms and re-forced Bo3 whenever the selector changed. |
