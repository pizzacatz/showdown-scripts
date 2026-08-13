# PRD: Pokémon Showdown Quality-of-Life Features

## 1. Overview
This document covers the non-Ghost-Clicker features for the **Showdown Quality of Life Improvements** Tampermonkey project.

Included:
- One-click forfeit
- Automatic replay upload
- Automatic local replay download
- Replay idempotency
- Mobile compatibility
- Shared core/event architecture
- Logging and failure handling

Excluded:
- Automatic format selection
- Regulation M-B / M-B Bo3 selector buttons
- Team Builder shortcuts
- Challenge automation
- AI replay analysis
- Automatic move selection or automatic forfeiting

## 2. Product Goal
Reduce repetitive Pokémon Showdown interactions without creating background behavior that fights the user.

### Success Criteria
- A visible Forfeit button submits `/forfeit` only when explicitly pressed.
- Battle completion is detected automatically.
- Completed battles are uploaded to Pokémon Showdown replay servers.
- A local replay copy is downloaded after upload.
- Each battle is processed no more than once.
- Features work on desktop and mobile.
- No permanent high-frequency polling loops are used.
- Shared page observation and battle-state logic is implemented once.

## 3. Architecture

### 3.1 Shared Core
Use one lightweight shared core plus separate feature modules.

The core owns:
- initialization
- SPA navigation awareness
- one shared `MutationObserver`
- room discovery
- battle-state detection
- selector registry
- shared state
- logging
- feature registration

Feature modules own only their specific behavior.

Example event flow:

```js
core.emit('battle:opened', context);
core.emit('battle:ended', context);
core.emit('room:changed', context);
```

### 3.2 Why One Core
Separate Tampermonkey scripts would likely duplicate observers, selectors, room detection, retry logic, and battle-state checks. A shared core centralizes brittle Showdown-specific plumbing while keeping features independently understandable.

## 4. Feature: One-Click Forfeit

### User Story
As a player, I want a visible Forfeit button so I can concede without opening chat, typing `/forfeit`, and pressing Enter.

### Required Behavior
When pressed:
1. Confirm the current room is an active battle.
2. Locate the battle chat input or equivalent command mechanism.
3. Submit `/forfeit`.
4. Trigger the equivalent of Enter.
5. Stop.

The script must never issue `/forfeit` automatically.

### Mobile Behavior
Do not assume chat is expanded. Prefer targeting the underlying chat input directly. If the mobile DOM removes the input while chat is collapsed, expose it with the minimum necessary UI interaction, submit the command, and avoid leaving the interface unnecessarily changed.

### Safety Requirements
- Direct user click required.
- No automatic lifecycle event may call forfeit.
- Guard against double-click submission.
- Disable or hide the button where forfeiting is not meaningful.

### Acceptance Criteria
- One click forfeits an active desktop battle.
- Works with expanded desktop chat.
- Works or gracefully exposes chat on mobile.
- Never fires without a direct user action.
- Rapid repeated clicks do not submit multiple commands.

## 5. Feature: Automatic Replay Archive

### User Story
As a player, I want every completed battle replay stored in two places:
1. Pokémon Showdown's replay servers.
2. My local filesystem.

### Trigger
Use event-driven state detection rather than permanent polling.

Preferred flow:
1. A shared `MutationObserver` watches relevant Showdown UI changes.
2. The core re-evaluates the current battle only when the DOM changes.
3. If the battle transitions from active to ended, emit `battle:ended`.
4. The Replay feature receives that event.

The observer is a notification mechanism; the Replay feature must still verify state before acting.

## 6. Replay Processing Pipeline

```text
Battle ends
    ↓
Resolve battle identity
    ↓
Check processed state
    ↓
Upload replay
    ↓
Confirm upload success
    ↓
Download replay locally
    ↓
Mark complete
```

### 6.1 Battle Identity
Use a stable identifier whenever possible.

Preferred sources:
1. Showdown battle/room ID
2. Replay ID returned after upload
3. Stable room identifier
4. Fallback composite battle metadata

### 6.2 Idempotency
Repeated DOM mutations, room switching, reopening a finished room, or download-button appearance must not create duplicate work.

Minimum in-memory structures:

```js
const processedBattles = new Set();
const replayJobs = new Map();
```

Recommended job state:

```js
{
  battleId,
  status: 'detected' | 'uploading' | 'uploaded' | 'downloading' | 'complete' | 'error',
  replayId,
  attempts,
  lastError
}
```

Optional persistence should use `sessionStorage` first so duplicate prevention survives page refreshes without permanently accumulating battle IDs.

### 6.3 Upload Replay
After battle completion:
1. Find the native Upload Replay action.
2. Verify that this battle was not already uploaded.
3. Trigger Showdown's native upload behavior.
4. Wait for an observable success state.

Do not treat a button click itself as proof of success.

### 6.4 Confirm Upload
Possible success signals:
- replay URL appears
- replay ID appears
- Upload Replay disappears or changes state
- Showdown exposes a confirmation state
- Download Replay becomes available

The final implementation should use the most stable signal visible in the live site.

### 6.5 Local Download
After upload success:
1. Locate Showdown's existing replay download control.
2. Trigger the normal browser download.
3. Preserve existing filename behavior.

### 6.6 Completion
Mark a battle complete only after the intended replay workflow succeeds.

Upload and download should have separate states so a failed local download can be retried without uploading again.

## 7. Failure Handling

### Upload Button Missing
- Wait for later DOM changes.
- Retry only within a bounded policy.
- Log the failure.
- Keep the replay eligible for manual retry.

### Upload Failure
- Mark job `error`.
- Do not mark complete.
- Do not repeatedly hammer the upload action.
- Optional later enhancement: Retry Replay Save button.

### Download Failure
- Preserve uploaded state.
- Mark local download incomplete.
- Allow download retry without re-upload.

## 8. Retry Policy
Avoid permanent loops such as:

```js
setInterval(checkReplay, 50);
```

Preferred:
- DOM changes trigger reevaluation.
- Short bounded waits are allowed after a known event.
- Any `waitForElement()` helper must have a timeout.

## 9. Mobile Compatibility

### Requirements
- Avoid exact pixel-position assumptions.
- Prefer stable DOM insertion points.
- Use touch-sized controls.
- Allow compact toolbar wrapping.
- Handle collapsed mobile chat.
- Survive Showdown SPA rerenders.

Abstract chat submission behind:

```js
sendBattleCommand('/forfeit');
```

Desktop/mobile differences should stay inside that helper.

## 10. Shared Utility Toolbar
Preferred user-facing controls:

```text
[ Forfeit ] [ Replay Status / Retry ]
```

Requirements:
- Do not obstruct native battle controls.
- Prevent duplicate injection.
- Restore after SPA rerenders.
- Remain usable on narrow screens.

Ghost Clicker format buttons may later share the same toolbar, but their behavior is outside this PRD.

## 11. Selector Strategy
Centralize selectors:

```js
const SELECTORS = {
  battleRoom: '...',
  chatInput: '...',
  uploadReplay: '...',
  downloadReplay: '...'
};
```

Preferred selector priority:
1. stable `name`
2. stable `value`
3. stable structural attributes
4. Showdown-specific IDs/classes

Avoid visible button text when a more stable selector exists.

## 12. Shared Helpers
Recommended helpers:

```js
getCurrentBattle();
getBattleId();
isBattleActive();
isBattleEnded();
sendBattleCommand(command);
waitForElement(selector, options);
clickElement(selector);
log(feature, message, data);
```

Feature modules should operate at this higher level rather than embedding DOM-specific details everywhere.

## 13. Logging
Provide configurable logging.

```js
const CONFIG = {
  debug: false
};
```

Example output:

```text
[Showdown QoL][Core] Battle detected
[Showdown QoL][Replay] Battle ended
[Showdown QoL][Replay] Uploading replay
[Showdown QoL][Replay] Upload confirmed
[Showdown QoL][Replay] Download triggered
[Showdown QoL][Replay] Complete
```

## 14. Configuration

```js
const CONFIG = {
  debug: false,

  features: {
    forfeitButton: true,
    autoReplayUpload: true,
    autoReplayDownload: true
  },

  replay: {
    persistProcessedState: true,
    maxRetries: 3
  }
};
```

## 15. Feature Registration

```js
const FEATURES = [
  ForfeitFeature,
  ReplayFeature
];

for (const feature of FEATURES) {
  feature.init(core);
}
```

## 16. Shared State

```js
const state = {
  currentRoomId: null,
  currentBattleId: null,
  battleStatus: null,
  replayJobs: new Map()
};
```

The core owns the canonical definition of whether a battle is active or ended.

## 17. Performance Requirements
- No permanent 10 ms, 50 ms, or similar polling.
- Prefer one shared observer.
- Debounce expensive evaluation if Showdown produces many mutations.
- Avoid scanning the entire document on every change.
- Scope checks to the active battle room where practical.
- Do no replay work when no battle is active or completed.

## 18. Privacy
The script must not transmit battle data anywhere except through Pokémon Showdown's existing replay-upload mechanism.

Local state should contain only what is necessary for:
- battle identity
- replay-processing status
- duplicate prevention
- debugging

No external analytics are required.

## 19. Acceptance Test Matrix

### Forfeit
- [ ] Button appears in active desktop battle.
- [ ] One click submits `/forfeit`.
- [ ] Mobile button is usable.
- [ ] Collapsed mobile chat does not block command submission.
- [ ] Non-battle contexts do not accidentally submit `/forfeit`.
- [ ] Rapid repeated clicks do not send multiple commands.

### Replay Detection
- [ ] No replay action before battle completion.
- [ ] Battle completion is detected.
- [ ] Repeated DOM mutations do not duplicate the replay job.
- [ ] Switching rooms does not duplicate the job.
- [ ] Returning to a finished room does not re-upload.

### Replay Upload
- [ ] Upload starts after battle completion.
- [ ] Success is confirmed from actual UI/state.
- [ ] Already-uploaded replay is not uploaded again.
- [ ] Failure stops after bounded retries.

### Replay Download
- [ ] Download starts only after required replay state exists.
- [ ] Exactly one local copy is triggered.
- [ ] Download-button appearance does not create duplicate downloads.
- [ ] Download failure does not cause a second upload.

### Mobile
- [ ] Toolbar fits narrow viewport.
- [ ] Buttons remain touch-accessible.
- [ ] SPA navigation does not permanently remove controls.
- [ ] Collapsed chat is handled correctly.

### Performance
- [ ] No permanent high-frequency polling loop exists.
- [ ] One shared observer is used unless a specific technical limitation requires otherwise.
- [ ] No runaway retries or duplicate observers occur after many battles.

## 20. Open Technical Questions
Resolve these against the live Pokémon Showdown DOM before final implementation:

1. What stable state best identifies the active-to-ended battle transition?
2. What is the most stable selector for Upload Replay?
3. What state reliably proves replay upload success?
4. What selector/action triggers local replay download?
5. Does Download Replay exist before upload, after upload, or in multiple states?
6. Does mobile Showdown keep the chat input mounted while collapsed?
7. What stable battle/room identifier survives SPA rerenders?
8. Can a reopened completed room reveal that its replay was already uploaded?
9. Does Showdown itself expose duplicate-upload state?

## 21. Implementation Order

### Phase 1 — Core
1. Initialization
2. SPA/room detection
3. Shared `MutationObserver`
4. Battle-state detection
5. Selector registry
6. Logging

### Phase 2 — Forfeit
1. Toolbar/button injection
2. `sendBattleCommand()`
3. Desktop validation
4. Mobile validation
5. Double-submit protection

### Phase 3 — Replay Upload
1. `battle:ended` event
2. Battle identity
3. Replay job state
4. Upload Replay interaction
5. Upload-success detection

### Phase 4 — Replay Download
1. Detect downloadable state
2. Trigger local download
3. Mark replay complete
4. Verify idempotency

### Phase 5 — Resilience
1. Bounded retries
2. Failure states
3. Optional manual retry
4. Session persistence
5. Mobile regression testing

## 22. Definition of Done
The PRD is satisfied when one Tampermonkey userscript can:

- expose an explicit one-click Forfeit action
- detect battle completion without permanent polling
- upload the replay through Pokémon Showdown
- download a local replay copy
- prevent duplicate replay processing
- survive Showdown SPA rerenders
- operate on desktop and mobile
- keep feature-specific logic modular behind a shared core
- surface failures without infinite retries or silent repeated actions

## 23. Decision Log (2026-08-13)

Decisions made during PRD review, superseding the corresponding sections above:

1. **Single script with shared core confirmed.** One script examines the page once and distributes information via events, rather than multiple scripts each re-examining the same data. Ghost Clicker remains standalone for now; merging it in as a feature module is a later decision.
2. **Upload and download are parallel, independent jobs** (amends §6). Both trigger off `battle:ended` with separate state; a failed upload does not cost the local copy, and neither retries the other.
3. **Forfeit uses arm-then-confirm** (amends §4). First press arms the button ("Confirm?"), a second press within a short window sends `/forfeit`; the armed state expires otherwise. This replaces plain one-click to remove misclick risk, especially on mobile.
4. **Concurrency: exactly one battle at a time.** The user plays one game at a time; the job pipeline does not need multi-battle parallelism, only idempotency.
5. **Replays stay public** (amends §18 nuance). Uploads intentionally use the default public visibility so replays can be shared with peers for feedback. No private/password option is needed.
6. **Local downloads keep Showdown's native filename** (confirms §6.5). No filename verification or renaming logic.
7. **Forfeit concedes the current game only**, never the Bo3 set.
8. **Ghost Clicker stays a standalone script.** It acts once on the home screen at first load, while this script's features run during every battle; merging would couple unrelated lifecycles for no benefit. The shared core in §3 serves only the battle features.
9. **Scripts auto-update** via `@updateURL`/`@downloadURL` headers pointing at the raw GitHub `main` files.
10. **This script lives in `qol-battle/`** as `qol-battle.user.js`; shared test tooling (`package.json`, `test/`) sits at the repo root.
11. **Testing approach:** unit tests (Vitest) on the DOM-free logic plus HTML fixture tests for selectors, and a `CONFIG.dryRun` mode for live-site validation. No local Showdown server / Playwright E2E for now.
