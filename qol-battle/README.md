# QoL Battle Tools

Battle-room quality-of-life features for Pokémon Showdown: an **arm-then-confirm forfeit button** and an **automatic replay archive** (upload to Showdown's replay server + local download) for every completed battle.

Built per the [QoL battle features PRD](../docs/PRD-qol-battle-features.md); all selectors and behaviors are verified against Showdown's source — see the [DOM notes](../docs/showdown-dom-notes.md).

## Features

### Forfeit button

A **Forfeit** button appears in a small toolbar under the battle controls. First press arms it ("Confirm forfeit?", red); pressing again within 2.5 seconds sends `/forfeit`; otherwise it disarms. This is deliberately two taps — one stray click can't concede a game. It sends via Showdown's client API (`app.rooms[id].send`), so it works regardless of chat state, including collapsed mobile chat.

In a best-of-3, the command goes to the current **game room**, so it concedes only that game, never the set.

### Automatic replay archive

When a battle ends, two independent jobs run:

- **Upload:** sends `/savereplay` (exactly what the native "Upload and share replay" button does) and confirms success by watching for the server's replay-link popup. Replays are public, as Showdown uploads them by default.
- **Download:** clicks the native "Download replay" link, which builds the file locally (`<tier>-<date>-<p1>-<p2>.html`) — no upload required, native filename preserved.

The jobs are independent: a failed upload never costs you the local copy, and vice versa. Each battle is processed at most once — duplicate DOM events, room switching, and reopening finished rooms are all ignored, and the processed state survives page refreshes via `sessionStorage`. In a Bo3, each game gets its own replay (Showdown has no set-level replay).

Failures retry up to 3 times, then stop and show a **Retry replay** button in the toolbar. Status is always visible: `Replay: upload ✓ download ✓`.

> **Browser note:** downloading a file per battle may trigger your browser's "this site wants to download multiple files" permission the first time. Allow it once.

## Install

Open [`qol-battle.user.js`](qol-battle.user.js) raw in a browser with [Tampermonkey](https://www.tampermonkey.net/) installed and accept the prompt. Updates are automatic via the `@updateURL` header.

## Configuration

All knobs are in the `CONFIG` block at the top of the script:

| Key | Default | Meaning |
|-----|---------|---------|
| `debug` | `false` | Verbose `[Showdown QoL]` console logging. |
| `dryRun` | `false` | Log intended actions instead of performing them — safe live-site validation. |
| `features.forfeitButton` | `true` | Toggle the forfeit button. |
| `features.autoReplayUpload` | `true` | Toggle automatic upload. |
| `features.autoReplayDownload` | `true` | Toggle automatic local download. |
| `replay.maxRetries` | `3` | Automatic attempts per job before requiring manual retry. |
| `forfeit.confirmWindowMs` | `2500` | How long the armed forfeit state lasts. |

## Validation

- **Unit tests:** `npm test` from the repo root (Vitest + jsdom). Covers the job state machine, idempotency/persistence, arm-then-confirm timing, bounded waits, and duplicate-injection guards against DOM fixtures.
- **Live dry run:** set `dryRun: true`, play a battle, and read the console — the script logs what it *would* do without acting. Recommended after any Showdown client update.

## Known limitations

- Targets the live classic client only; Showdown's `/beta` (preact) client uses different DOM and is unsupported.
- Upload confirmation relies on the server's replay-link popup appearing within 10 seconds; on a very slow connection this may mark an actually-successful upload as failed (re-uploading via Retry is harmless — the server updates the same replay).
- The client keeps no "already uploaded" flag, so state from before a `sessionStorage` wipe (new tab, browser restart) is unknown; the script may re-upload, which is safe and idempotent server-side.

## Version history

| Version | Notes |
|---------|-------|
| 1.0 | Initial release: forfeit button, replay archive, dry-run mode, test suite. |
