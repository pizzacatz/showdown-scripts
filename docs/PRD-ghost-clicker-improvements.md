# Product Requirements Document

**Showdown Quality of Life Improvements — Ghost Clicker**

| | |
|---|---|
| **Status** | Draft v0.1 |
| **Date** | August 13, 2026 |
| **Project** | Showdown Quality of Life Improvements |
| **Scope** | Ghost Clicker improvements only |

## 1. Executive Summary

The Ghost Clicker should make Reg M-B best-of-three the frictionless default without permanently taking control away from the user. It should select the default once, then stop. Manual quick-select controls should remain available for deliberate switching between supported Reg M-B formats.

The current implementation repeatedly checks the format selector and re-applies the configured format whenever it changes. The improved design replaces that persistent enforcement loop with one-shot initialization plus explicit user-triggered actions.

## 2. Problem Statement

- The current script treats the configured format as a permanent invariant rather than an initial default.
- Because it re-checks the page continuously, manually selecting another ruleset is immediately or repeatedly overridden.
- The script mixes two different intents: "make Bo3 the default" and "force Bo3 forever." Only the first is desired.
- The current 50 ms polling approach performs unnecessary work and makes the script harder to extend cleanly.

## 3. Goals and Non-Goals

### Goals

- Default the battle format to Reg M-B Bo3 once when the relevant Showdown UI becomes available.
- After the initial default is applied, allow the user to switch formats without the script changing it back.
- Provide quick-select controls for Reg M-B Bo1 and Reg M-B Bo3.
- Use event-driven DOM observation for initialization and reinjection rather than a perpetual high-frequency enforcement loop.
- Keep all format IDs, labels, selectors, and feature flags in a small configuration section.
- Keep selection logic reusable so both automatic defaulting and manual buttons call the same function.

### Non-Goals

- Replay upload or automatic replay download.
- Forfeit automation or chat-command automation.
- AI replay analysis.
- General-purpose Showdown toolbar features unrelated to format selection.
- Building a browser extension unless Tampermonkey proves technically insufficient.

## 4. Product Behavior

### 4.1 One-Time Default Selection

- When the relevant battle-selection UI appears, the feature checks whether its one-time initialization has already completed for the current page load.
- If initialization has not completed, it locates the main format selector.
- If the selector is already on Reg M-B Bo3, initialization is marked complete without clicking anything.
- Otherwise, it opens the format menu, waits briefly for the target option to exist, selects Reg M-B Bo3, and marks initialization complete.
- After initialization completes, changing the format manually must not trigger another automatic correction until the page is reloaded.

**Behavioral intent:** Bo3 is the default choice, not an enforced lock.

### 4.2 Manual Quick-Select Buttons

- Inject two controls near the format selector: "M-B" (Bo1) and "M-B Bo3".
- Each button calls the same reusable `selectFormat(formatId)` function with a different configured format ID.
- A manual quick-select action is one-shot. It must not enable background enforcement afterward.
- If the selected target is already active, clicking its quick-select button should be a no-op.
- Buttons should be re-injected if Showdown rebuilds the relevant UI, but duplicate buttons must never appear.

### 4.3 Event-Driven Initialization

- Use a `MutationObserver` to notice when Showdown creates or rebuilds the relevant controls.
- The observer may call lightweight "ensure initialized / ensure controls exist" checks, but it must not re-select the format after the one-time default has completed.
- Short-lived polling is acceptable only inside an explicit selection action while waiting for Showdown's format menu option to render.
- All short-lived polling must have a hard timeout and clear itself on success or failure.

## 5. Functional Requirements

| ID | Requirement | Priority | Acceptance Signal |
|----|-------------|----------|-------------------|
| FR-01 | Apply Reg M-B Bo3 automatically once per page load after the format selector is available. | Must | A fresh page defaults to Bo3; later manual changes persist. |
| FR-02 | Never continuously force the configured format after one-time initialization completes. | Must | Selecting another format remains selected until the user changes it again or reloads. |
| FR-03 | Provide a manual Reg M-B Bo3 quick-select control. | Must | One click selects the configured Bo3 format. |
| FR-04 | Provide a manual Reg M-B Bo1 quick-select control. | Must | One click selects the configured Bo1 format once its ID is configured. |
| FR-05 | Prevent concurrent format-selection macros. | Must | Repeated fast clicks cannot create overlapping menu/poll loops. |
| FR-06 | Prevent duplicate injected controls. | Must | Only one instance of each quick-select control is present. |
| FR-07 | Recover after Showdown rebuilds the battle-selection UI. | Should | Controls reappear without refreshing the whole browser page. |
| FR-08 | Timeout failed format-selection attempts cleanly. | Must | No timer or running-state flag remains stuck after a failed attempt. |
| FR-09 | Centralize format IDs and labels in configuration. | Should | Regulation updates require editing configuration, not selection logic. |

## 6. Proposed Technical Design

Recommended shape: one Tampermonkey userscript with a tiny shared core and an isolated format-selection feature module.

| Component | Responsibility |
|-----------|----------------|
| `CONFIG` | Format IDs, labels, selectors, feature flags, timeouts. |
| DOM observer | Notifies the feature when Showdown creates/rebuilds relevant UI. |
| Format feature state | Tracks `initializedOnce`, `macroRunning`, and injected-control state. |
| `selectFormat(formatId)` | Reusable one-shot action: open menu, wait for target, click target, clean up. |
| `applyDefaultOnce()` | Calls `selectFormat(Bo3)` only before initialization has completed. |
| `ensureControls()` | Injects missing M-B and M-B Bo3 quick-select controls without duplicates. |

### 6.1 Suggested State

- `initializedOnce`: `false` until the first default-selection attempt completes or the target is already active.
- `macroRunning`: prevents overlapping selection actions.
- Button IDs: stable IDs used to detect whether injected controls already exist.

### 6.2 Configuration

- `DEFAULT_FORMAT_ID` = known Reg M-B Bo3 format ID.
- `REG_MB_BO3_FORMAT_ID` = `gen9championsvgc2026regmbbo3` (known from the current script).
- `REG_MB_BO1_FORMAT_ID` = **TBD**; must be confirmed from Showdown rather than guessed.
- Selectors and button labels should be constants so Showdown DOM or naming changes are localized.

## 7. Edge Cases and Failure Handling

- **Format selector not present yet:** do nothing; wait for a later DOM mutation.
- **Target option does not appear after opening the menu:** timeout, clear `macroRunning`, and leave the current selection untouched.
- **Showdown rebuilds the home UI:** re-inject missing quick-select controls, but do not re-run the automatic default after `initializedOnce` is true.
- **User clicks multiple quick-select buttons rapidly:** ignore new requests while `macroRunning` is true.
- **User is already on the requested format:** return immediately without opening the menu.
- **Selector structure differs on mobile:** keep selector logic isolated so a mobile-specific lookup can be added without changing selection behavior.

## 8. Acceptance Criteria

1. On a fresh Showdown page load, Reg M-B Bo3 becomes the selected battle format automatically.
2. After the automatic selection has happened, manually changing to another ruleset is not undone by the userscript.
3. Reloading the page allows the one-time default to occur again.
4. The M-B Bo3 quick-select control can select Bo3 at any time without enabling persistent enforcement.
5. The M-B Bo1 quick-select control behaves the same way after its correct format ID is configured.
6. Navigating within Showdown and causing the relevant UI to rebuild does not create duplicate quick-select controls.
7. No persistent 50 ms format-enforcement timer remains in the improved implementation.
8. Any temporary wait loop created during a selection attempt stops on success or timeout.

## 9. Test Plan

1. **Fresh-load default:** Start on a non-Bo3 format, reload Showdown, verify Reg M-B Bo3 is selected exactly once.
2. **Manual override:** After initialization, select another format manually and wait; verify the script does not change it back.
3. **Quick-select Bo3:** From another format, click M-B Bo3 and verify one successful selection.
4. **Quick-select Bo1:** After configuring the verified Bo1 ID, click M-B and verify one successful selection.
5. **Rapid clicking:** Click quick-select controls repeatedly; verify no duplicate menus, overlapping actions, or stuck state.
6. **SPA navigation:** Navigate away and back to the battle-selection screen; verify controls return once and the automatic default does not repeat during the same page load.
7. **Failure timeout:** Temporarily configure an invalid target ID; verify the action exits cleanly and later actions still work.
8. **Mobile layout:** Test on mobile Showdown; verify controls are reachable and selectors resolve correctly, or document any required mobile-specific selector.

## 10. Risks and Blind Spots

- "Once per page load" is a product choice, not a technical necessity. If Showdown changes room state without a reload, the default will intentionally not reassert itself. That is desirable under the current requirement, but should remain explicit.
- A `MutationObserver` can still fire frequently. The benefit comes from making its callback cheap and idempotent, not from assuming observers are automatically free.
- DOM selectors are the most likely maintenance failure point. Prefer stable name/value attributes over visible button text wherever possible.
- The Bo1 format ID must be observed from Showdown before implementation. Guessing it creates a silent reliability problem.
- Adding more unrelated features to this script without module boundaries would recreate the maintenance problem the refactor is meant to solve.

## 11. Open Items Before Implementation

1. Confirm the exact Showdown value/format ID for Reg M-B Bo1.
2. Confirm where the two quick-select buttons should appear on desktop and mobile.
3. Decide whether "once" means once per full browser page load (current recommendation) or once per return to the matchmaking/home view.

## 12. Stop Condition for This PRD

This Ghost Clicker improvement is complete when the acceptance criteria in Section 8 pass reliably on the intended Showdown environments. Replay automation, forfeiting, and additional QoL features should be specified separately rather than expanding this implementation mid-build.
