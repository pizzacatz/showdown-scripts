# Showdown DOM & Behavior Notes

Findings from reading the Pokémon Showdown client and server source (smogon/pokemon-showdown-client and smogon/pokemon-showdown, cloned 2026-08-13). These answer the open technical questions in the [QoL battle features PRD](PRD-qol-battle-features.md) (§20) and verify Ghost Clicker's format IDs. Every claim below is sourced from the repos; file references are relative to each repo root.

**Which client is live:** `play.pokemonshowdown.com` runs the classic (Backbone/jQuery) client (`play.pokemonshowdown.com/src/oldclient/*.js`). The preact rewrite serves at `/beta` and uses different DOM (noted where relevant). All selectors below target the classic client.

## Format IDs (Ghost Clicker) — VERIFIED

From server `config/formats.ts` (§"Champions", ~line 249):

| Format | ID |
|--------|----|
| [Gen 9 Champions] VGC 2026 Reg M-B | `gen9championsvgc2026regmb` |
| [Gen 9 Champions] VGC 2026 Reg M-B (Bo3) | `gen9championsvgc2026regmbbo3` |

Both exist; the Ghost Clicker Bo1 guess was correct. Naming pattern: Bo3 ID = Bo1 ID + `bo3`. Note the Bo1 format has `bestOfDefault: true`, so the *challenge* UI pre-checks its "Best of 3" checkbox.

**Home-screen selector (verified):** opener `button[name="format"].formatselect`; options `button[name="selectFormat"][value="<formatid>"]` inside the popup (`oldclient/client-mainmenu.js`). The `/beta` client differs: options are plain `<button value="<display name>">` with no `name="selectFormat"` — Ghost Clicker does not work on `/beta` as-is.

## Sending commands (forfeit) — use the client API, not the chat DOM

The classic client exposes `window.app` globally. Every room object has `.send()`:

```js
app.rooms['battle-...'].send('/forfeit');   // or app.send('/forfeit', roomid)
```

This bypasses the chat textarea entirely, which matters because:

- The battle chat textarea has **no name attribute** (`.battle-log-add form.chatbox textarea.textbox`) and is **rebuilt on user-state changes** — a fragile target.
- Mobile: chat is hidden by CSS only (`.small-layout ... display:none`; toggled via the `showing-chat` room class), so it stays in the DOM — but with the API we don't care either way.

`sendBattleCommand()` should call the API first and fall back to the textarea only if `app` is unavailable. On `/beta`, the equivalent is the top-level `PS` binding (`PS.rooms[id].send(msg)`), not reachable as a `window` property.

## /forfeit semantics (server `chat-commands/core.ts`, `room-battle-bestof.ts`)

- `/forfeit` acts on **the room it's typed/sent in**.
- In a Bo3 **game room** (`battle-...`): concedes **that game only**. The `BestOfGame` wrapper counts the win; the set ends only at the win threshold.
- In the Bo3 **wrapper room** (`game-bestof3-...`): concedes the **whole set** (and the in-progress game).
- There is no separate concede-set command; room context decides. → Our forfeit button must send to the **game room**, per the decision log (game only).
- Edge case: if the loser is fully disconnected, a game forfeit escalates to a set forfeit server-side.

## Bo3 room structure (server `rooms.ts`, `room-battle-bestof.ts`)

- Wrapper room ID: `game-bestof3-<formatid>-<battlenum>` (a `GameRoom`, its game is `BestOfGame` — **not** a battle; it has no replay).
- Each game: a normal battle room `battle-<bo3formatid>-<NNNN>`, parented to the wrapper, created per game.
- Both clients route `battle-*` **and** `game-*` rooms to the battle room type — selectors that assume room IDs start with `battle-` will miss the wrapper.
- **Replays are per game.** `/savereplay` errors in the wrapper ("You can only save replays for battles"). A Bo3 set produces up to 3 replays; battle identity for the replay pipeline = the game room ID.

## Battle-end detection (`oldclient/client-battle.js` `updateControls`)

- JS signal: `app.rooms[id].battle.ended` (boolean; set on `|win|`/`|tie|`), also `room.battleEnded`.
- DOM signal (best MutationObserver target): at battle end, `.battle-controls` is rewritten to contain:
  - `a.replayDownloadButton` ("Download replay")
  - `button[name="saveReplay"]` ("Upload and share replay")
  - `button[name="instantReplay"]`
  - players only: `button[name="closeAndMainMenu"]`, `button[name="closeAndRematch"]`
- **Recommended trigger:** appearance of `button[name="saveReplay"]` (or `a.replayDownloadButton`) inside `.battle-controls` — present for players and spectators, only at end. Verify with `battle.ended` before acting.
- Secondary signal: battle log gains `div.battle-history` with "**NAME** won the battle!".
- `/beta` uses `data-cmd` attributes instead of `name` (`button[data-cmd="/savereplay"]`).

## Replay upload (`server/rooms.ts` `uploadReplay`)

- Trigger: click `button[name="saveReplay"]`, or equivalently send `/savereplay` via the room API (alias `/uploadreplay`). The button handler just sends the command, so **sending the command directly is equally native**.
- Success signal: the server responds with a **popup** — "Your replay has been uploaded!" containing an `<a>` to `https://replay.pokemonshowdown.com/<id>`. The upload button itself never changes state. Watch for the popup / replay link as confirmation.
- **No client-side uploaded flag exists.** `battle.replaySaved` lives server-side only; reopening a finished room shows identical UI whether or not the replay was uploaded. → PRD Q8 answer: **no** — our own idempotency state is the only guard. (Re-running `/savereplay` is harmless server-side: it re-uploads/updates the same replay ID.)
- Replay URL/ID is derived from the room ID (private battles get a `-<password>pw` suffix).

## Replay download (`client-battle.js` `clickReplayDownloadButton`)

- Control: `a.replayDownloadButton` (anchor, class only, no name) in the end-of-battle controls.
- **Fully local and independent of upload:** the click handler builds an HTML file from the local battle log (data/blob href) — no network. Validates the parallel-jobs decision.
- Filename: `<TierNameAlnum>-<YYYY>-<MM>-<DD>-<p1id>-<p2id>.html` (e.g. `gen9championsvgc2026regmbbo3-2026-08-13-alice-bob.html`). Native behavior preserved by simply clicking the anchor.

## Mobile

- Classic client has no separate mobile DOM — same markup, CSS-scaled (`.small-layout`). Chat input stays mounted while collapsed.
- With the `app.rooms[id].send()` API, mobile chat state is irrelevant to command sending. Toolbar layout is the only mobile concern.

## Open questions resolved (PRD §20)

| # | Question | Answer |
|---|----------|--------|
| 1 | Active→ended transition signal | `button[name="saveReplay"]` appearing in `.battle-controls`; confirm via `battle.ended` |
| 2 | Upload Replay selector | `button[name="saveReplay"]` (or send `/savereplay` directly) |
| 3 | Proof of upload success | Server popup with `replay.pokemonshowdown.com` link |
| 4 | Download trigger | Click `a.replayDownloadButton` (local file build, no network) |
| 5 | Download vs upload dependency | Fully independent; exists whenever the battle has ended |
| 6 | Mobile chat mounted while collapsed? | Yes (CSS-hidden only) — moot anyway via room API |
| 7 | Stable battle identifier | Room ID (`battle-<formatid>-<NNNN>`); per-game in Bo3 |
| 8 | Can a reopened room reveal upload state? | No — client keeps no flag; our state is the only guard |
| 9 | Does Showdown expose duplicate-upload state? | No client-side; server re-upload is idempotent/harmless |

## Remaining unknowns

- Whether the official server auto-uploads replays on room expiry (`Config.autosavereplays` — private config). Doesn't change our design; duplicate upload is harmless.
- `/beta` client support is out of scope for now; both Ghost Clicker and the battle script would need a second selector set (`data-cmd`, `PS` instead of `app`) to work there.
