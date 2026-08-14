// ==UserScript==
// @name         Showdown QoL Battle Tools
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  Arm-then-confirm forfeit button and automatic replay archive (upload + local download) for Pokémon Showdown battles.
// @match        *://play.pokemonshowdown.com/*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/pizzacatz/showdown-scripts/main/qol-battle/qol-battle.user.js
// @downloadURL  https://raw.githubusercontent.com/pizzacatz/showdown-scripts/main/qol-battle/qol-battle.user.js
// ==/UserScript==

(function () {
    'use strict';

    // ------------------------------------------------------------------
    // Configuration
    // ------------------------------------------------------------------
    const CONFIG = {
        debug: false,
        dryRun: false, // log intended actions instead of performing them
        features: {
            forfeitButton: true,
            autoReplayUpload: true,
            autoReplayDownload: true,
        },
        replay: {
            persistProcessedState: true,
            maxRetries: 3,
            uploadConfirmTimeoutMs: 10000,
            downloadLinkTimeoutMs: 5000,
        },
        forfeit: {
            confirmWindowMs: 2500,
            skipToEndTimeoutMs: 5000,
        },
        observerDebounceMs: 100,
        storageKey: 'showdown-qol-replay-state',
    };

    // Pre-load overrides (used by the test harness): any keys set on
    // window.__showdownQoLTestConfig replace CONFIG values before startup.
    if (typeof window !== 'undefined' && window.__showdownQoLTestConfig) {
        Object.assign(CONFIG, window.__showdownQoLTestConfig);
    }

    // Selectors verified against the classic client source; see
    // docs/showdown-dom-notes.md for citations.
    const SELECTORS = {
        battleRoom: '[id^="room-battle-"]',
        battleControls: '.battle-controls',
        saveReplayButton: 'button[name="saveReplay"]',
        downloadReplayLink: 'a.replayDownloadButton',
        skipToEndButton: 'button[name="goToEnd"]',
        replayUploadedLink: 'a[href*="replay.pokemonshowdown.com/"]:not(.replayDownloadButton)',
        toolbarClass: 'qol-battle-toolbar',
    };

    // ------------------------------------------------------------------
    // Logging
    // ------------------------------------------------------------------
    function log(feature, message, data) {
        if (!CONFIG.debug) return;
        if (data !== undefined) {
            console.log(`[Showdown QoL][${feature}]`, message, data);
        } else {
            console.log(`[Showdown QoL][${feature}]`, message);
        }
    }

    function logError(feature, message, data) {
        console.error(`[Showdown QoL][${feature}]`, message, data !== undefined ? data : '');
    }

    // ------------------------------------------------------------------
    // Pure helpers (unit-tested; keep them DOM-free where possible)
    // ------------------------------------------------------------------
    function isGameRoomId(roomId) {
        return /^battle-/.test(roomId);
    }

    function isBestOfWrapperId(roomId) {
        return /^game-bestof/.test(roomId);
    }

    function roomIdFromElement(el) {
        const id = el && el.id;
        return id && id.startsWith('room-') ? id.slice('room-'.length) : null;
    }

    function createEmitter() {
        const handlers = new Map();
        return {
            on(event, fn) {
                if (!handlers.has(event)) handlers.set(event, []);
                handlers.get(event).push(fn);
            },
            emit(event, payload) {
                for (const fn of handlers.get(event) || []) {
                    try {
                        fn(payload);
                    } catch (err) {
                        logError('Core', `handler for "${event}" threw`, err);
                    }
                }
            },
        };
    }

    // Arm-then-confirm press logic: first press arms, a second press inside
    // the window confirms, otherwise the armed state expires.
    function createArmToggle({ windowMs, onExpire }) {
        let armed = false;
        let timer = null;
        function disarm() {
            armed = false;
            if (timer !== null) {
                clearTimeout(timer);
                timer = null;
            }
        }
        return {
            press() {
                if (armed) {
                    disarm();
                    return 'confirmed';
                }
                armed = true;
                timer = setTimeout(() => {
                    disarm();
                    if (onExpire) onExpire();
                }, windowMs);
                return 'armed';
            },
            isArmed: () => armed,
            disarm,
        };
    }

    // Replay job store: upload and download are independent parallel jobs
    // per battle. Persists done-flags to sessionStorage so a page refresh
    // does not reprocess finished battles.
    function createReplayJobStore({ maxRetries, storage, storageKey, persistEnabled }) {
        const jobs = new Map();

        function loadPersisted() {
            if (!persistEnabled || !storage) return;
            try {
                const raw = storage.getItem(storageKey);
                if (!raw) return;
                for (const [battleId, done] of Object.entries(JSON.parse(raw))) {
                    const job = getJob(battleId);
                    if (done.upload) job.upload.status = 'done';
                    if (done.download) job.download.status = 'done';
                }
            } catch (err) {
                logError('Replay', 'failed to load persisted state', err);
            }
        }

        function persist() {
            if (!persistEnabled || !storage) return;
            try {
                const out = {};
                for (const [battleId, job] of jobs) {
                    const upload = job.upload.status === 'done';
                    const download = job.download.status === 'done';
                    if (upload || download) out[battleId] = { upload, download };
                }
                storage.setItem(storageKey, JSON.stringify(out));
            } catch (err) {
                logError('Replay', 'failed to persist state', err);
            }
        }

        function getJob(battleId) {
            if (!jobs.has(battleId)) {
                jobs.set(battleId, {
                    battleId,
                    upload: { status: 'pending', attempts: 0, lastError: null },
                    download: { status: 'pending', attempts: 0, lastError: null },
                    replayUrl: null,
                });
            }
            return jobs.get(battleId);
        }

        return {
            getJob,
            loadPersisted,
            // Returns true if a new attempt may start; moves the sub-job to
            // 'running' and counts the attempt.
            beginAttempt(battleId, kind) {
                const sub = getJob(battleId)[kind];
                if (sub.status === 'done' || sub.status === 'running') return false;
                if (sub.attempts >= maxRetries) return false;
                sub.attempts += 1;
                sub.status = 'running';
                return true;
            },
            markDone(battleId, kind) {
                getJob(battleId)[kind].status = 'done';
                persist();
            },
            markFailed(battleId, kind, error) {
                const sub = getJob(battleId)[kind];
                sub.lastError = String(error);
                sub.status = sub.attempts >= maxRetries ? 'error' : 'pending';
            },
            resetForManualRetry(battleId, kind) {
                const sub = getJob(battleId)[kind];
                if (sub.status === 'done') return;
                sub.attempts = 0;
                sub.status = 'pending';
            },
            isFullyDone(battleId) {
                const job = getJob(battleId);
                return job.upload.status === 'done' && job.download.status === 'done';
            },
        };
    }

    // Short-lived bounded wait for an element; always clears itself.
    function waitForElement(selector, { root = document, timeoutMs = 5000, intervalMs = 100 } = {}) {
        return new Promise((resolve, reject) => {
            const existing = root.querySelector(selector);
            if (existing) return resolve(existing);
            const poll = setInterval(() => {
                const el = root.querySelector(selector);
                if (el) {
                    cleanup();
                    resolve(el);
                }
            }, intervalMs);
            const timer = setTimeout(() => {
                cleanup();
                reject(new Error(`timed out waiting for ${selector}`));
            }, timeoutMs);
            function cleanup() {
                clearInterval(poll);
                clearTimeout(timer);
            }
        });
    }

    // ------------------------------------------------------------------
    // Showdown access layer — the only place that touches `app`.
    // ------------------------------------------------------------------
    function getApp() {
        return typeof window !== 'undefined' ? window.app : undefined;
    }

    // Sends a slash command to a room via the client API (no chat DOM).
    function sendBattleCommand(command, roomId) {
        if (CONFIG.dryRun) {
            console.log(`[Showdown QoL][DRY RUN] would send "${command}" to ${roomId}`);
            return true;
        }
        const app = getApp();
        const room = app && app.rooms && app.rooms[roomId];
        if (room && typeof room.send === 'function') {
            room.send(command);
            return true;
        }
        if (app && typeof app.send === 'function') {
            app.send(command, roomId);
            return true;
        }
        logError('Core', `cannot send "${command}": client API unavailable`);
        return false;
    }

    function isBattleEnded(roomId, roomEl) {
        const app = getApp();
        const room = app && app.rooms && app.rooms[roomId];
        if (room) {
            if (room.battleEnded) return true;
            if (room.battle && room.battle.ended) return true;
        }
        // DOM fallback: end-of-battle controls contain the replay buttons.
        return !!(roomEl && roomEl.querySelector(SELECTORS.saveReplayButton));
    }

    // ------------------------------------------------------------------
    // Core: shared observer, room discovery, event emission
    // ------------------------------------------------------------------
    const emitter = createEmitter();
    const endedEmitted = new Set(); // per page load
    let debounceTimer = null;

    function findBattleRooms() {
        return Array.from(document.querySelectorAll(SELECTORS.battleRoom))
            .map((el) => ({ el, roomId: roomIdFromElement(el) }))
            .filter((r) => r.roomId && isGameRoomId(r.roomId));
    }

    function evaluate() {
        for (const { el, roomId } of findBattleRooms()) {
            const context = { roomId, roomEl: el, ended: isBattleEnded(roomId, el) };
            emitter.emit('battle:seen', context);
            if (context.ended && !endedEmitted.has(roomId)) {
                endedEmitted.add(roomId);
                log('Core', `battle ended: ${roomId}`);
                emitter.emit('battle:ended', context);
            }
        }
    }

    function scheduleEvaluate() {
        if (debounceTimer !== null) return;
        debounceTimer = setTimeout(() => {
            debounceTimer = null;
            evaluate();
        }, CONFIG.observerDebounceMs);
    }

    // ------------------------------------------------------------------
    // Feature: toolbar (shared by forfeit + replay status)
    // ------------------------------------------------------------------
    function ensureToolbar(roomEl, roomId) {
        let toolbar = roomEl.querySelector(`.${SELECTORS.toolbarClass}`);
        if (toolbar) return toolbar;

        const controls = roomEl.querySelector(SELECTORS.battleControls);
        if (!controls) return null;

        toolbar = document.createElement('div');
        toolbar.className = SELECTORS.toolbarClass;
        toolbar.dataset.roomId = roomId;
        // Bottom-left, below the native controls content, with clear spacing.
        toolbar.style.cssText =
            'display:flex;flex-wrap:wrap;gap:6px;align-items:center;justify-content:flex-start;' +
            'margin-top:64px;padding:8px 8px 4px;border-top:1px solid rgba(0,0,0,0.15);clear:both;';
        // Inside .battle-controls: everything in a battle room is absolutely
        // positioned, so a normal-flow sibling renders invisibly behind the
        // arena. The client rewrites the controls' innerHTML every turn,
        // wiping the toolbar — the observer re-injects it, and the buttons
        // re-render from stored state so nothing user-visible is lost.
        controls.appendChild(toolbar);
        return toolbar;
    }

    // ------------------------------------------------------------------
    // Feature: arm-then-confirm forfeit
    // ------------------------------------------------------------------
    const forfeitToggles = new Map(); // roomId -> arm toggle
    const forfeitSent = new Set();    // roomIds already forfeited (double-submit guard)

    function ensureForfeitButton(toolbar, context) {
        if (!CONFIG.features.forfeitButton) return;
        const { roomId } = context;
        let btn = toolbar.querySelector('button[data-qol="forfeit"]');
        if (!btn) {
            btn = document.createElement('button');
            btn.dataset.qol = 'forfeit';
            btn.className = 'button';
            btn.style.minHeight = '32px'; // touch-friendly
            if (!forfeitToggles.has(roomId)) {
                forfeitToggles.set(roomId, createArmToggle({
                    windowMs: CONFIG.forfeit.confirmWindowMs,
                    onExpire: () => {
                        const current = document.querySelector(
                            `.${SELECTORS.toolbarClass}[data-room-id="${roomId}"] button[data-qol="forfeit"]`
                        );
                        if (current) renderForfeitButton(current, false);
                    },
                }));
            }
            const toggle = forfeitToggles.get(roomId);
            btn.addEventListener('click', (e) => {
                // Keep the click from reaching the client's background
                // handler, which dismisses popups on unnamed-button clicks.
                e.preventDefault();
                e.stopPropagation();
                if (btn.disabled || forfeitSent.has(roomId)) return;
                const result = toggle.press();
                if (result === 'armed') {
                    renderForfeitButton(btn, true);
                    log('Forfeit', `armed for ${roomId}`);
                } else {
                    renderForfeitButton(btn, false);
                    forfeitSent.add(roomId);
                    btn.disabled = true;
                    log('Forfeit', `confirmed for ${roomId}`);
                    sendBattleCommand('/forfeit', roomId);
                    skipToEnd(context.roomEl, roomId);
                }
            });
            toolbar.appendChild(btn);
        }
        // The toolbar (and button) is recreated whenever the client rewrites
        // the controls, so always re-render from stored state.
        const toggle = forfeitToggles.get(roomId);
        if (context.ended || forfeitSent.has(roomId)) {
            if (toggle) toggle.disarm();
            renderForfeitButton(btn, false);
            btn.disabled = true;
        } else {
            renderForfeitButton(btn, !!(toggle && toggle.isArmed()));
        }
    }

    // After a forfeit, battle playback replays the final events at normal
    // speed, which delays the end-of-battle controls (and thus the replay
    // download). Clicking the client's "Skip to end" button snaps playback
    // to the end immediately. The button only renders while playback is
    // behind, so wait briefly; if it never appears, playback is already
    // caught up and there is nothing to skip.
    function skipToEnd(roomEl, roomId) {
        if (CONFIG.dryRun) {
            console.log(`[Showdown QoL][DRY RUN] would skip to end for ${roomId}`);
            return;
        }
        waitForElement(SELECTORS.skipToEndButton, {
            root: roomEl,
            timeoutMs: CONFIG.forfeit.skipToEndTimeoutMs,
        })
            .then((btn) => {
                log('Forfeit', `skipping playback to end for ${roomId}`);
                btn.click();
            })
            .catch(() => {
                log('Forfeit', `no skip-to-end button for ${roomId} (playback already at end)`);
            });
    }

    function renderForfeitButton(btn, armed) {
        btn.textContent = armed ? 'Confirm forfeit?' : 'Forfeit';
        btn.style.background = armed ? '#a33' : '';
        btn.style.color = armed ? '#fff' : '';
    }

    // ------------------------------------------------------------------
    // Feature: replay archive (parallel upload + download jobs)
    // ------------------------------------------------------------------
    const jobStore = createReplayJobStore({
        maxRetries: CONFIG.replay.maxRetries,
        storage: typeof sessionStorage !== 'undefined' ? sessionStorage : null,
        storageKey: CONFIG.storageKey,
        persistEnabled: CONFIG.replay.persistProcessedState,
    });

    function runUploadJob(context) {
        if (!CONFIG.features.autoReplayUpload) return;
        const { roomId, roomEl } = context;
        if (!jobStore.beginAttempt(roomId, 'upload')) return;

        if (CONFIG.dryRun) {
            console.log(`[Showdown QoL][DRY RUN] would upload replay for ${roomId}`);
            jobStore.markDone(roomId, 'upload');
            updateReplayStatus(context);
            return;
        }

        log('Replay', `uploading replay for ${roomId}`);
        if (!sendBattleCommand('/savereplay', roomId)) {
            jobStore.markFailed(roomId, 'upload', 'client API unavailable');
            updateReplayStatus(context);
            return;
        }
        // Success signal: the server popup contains the replay link.
        waitForElement(SELECTORS.replayUploadedLink, {
            timeoutMs: CONFIG.replay.uploadConfirmTimeoutMs,
        })
            .then((link) => {
                jobStore.getJob(roomId).replayUrl = link.href;
                jobStore.markDone(roomId, 'upload');
                log('Replay', `upload confirmed for ${roomId}`, link.href);
            })
            .catch((err) => {
                jobStore.markFailed(roomId, 'upload', err);
                logError('Replay', `upload not confirmed for ${roomId}`, err);
            })
            .then(() => updateReplayStatus(context));
    }

    function runDownloadJob(context) {
        if (!CONFIG.features.autoReplayDownload) return;
        const { roomId, roomEl } = context;
        if (!jobStore.beginAttempt(roomId, 'download')) return;

        if (CONFIG.dryRun) {
            console.log(`[Showdown QoL][DRY RUN] would download replay for ${roomId}`);
            jobStore.markDone(roomId, 'download');
            updateReplayStatus(context);
            return;
        }

        // The end-of-battle controls may not have rendered yet when battle
        // end is first detected — wait for the link instead of failing.
        waitForElement(SELECTORS.downloadReplayLink, {
            root: roomEl,
            timeoutMs: CONFIG.replay.downloadLinkTimeoutMs,
        })
            .then((link) => {
                log('Replay', `downloading replay for ${roomId}`);
                link.click(); // native handler builds the file locally
                jobStore.markDone(roomId, 'download');
            })
            .catch((err) => {
                jobStore.markFailed(roomId, 'download', err);
                logError('Replay', `download failed for ${roomId}`, err);
            })
            .then(() => updateReplayStatus(context));
    }

    function onBattleEnded(context) {
        if (jobStore.isFullyDone(context.roomId)) {
            log('Replay', `already processed: ${context.roomId}`);
            return;
        }
        runUploadJob(context);
        runDownloadJob(context);
    }

    function updateReplayStatus(context) {
        const toolbar = context.roomEl.querySelector(`.${SELECTORS.toolbarClass}`);
        if (!toolbar) return;
        let status = toolbar.querySelector('span[data-qol="replay-status"]');
        if (!status) {
            status = document.createElement('span');
            status.dataset.qol = 'replay-status';
            status.style.fontSize = '11px';
            toolbar.appendChild(status);
        }
        const job = jobStore.getJob(context.roomId);
        const word = (sub) =>
            ({ pending: '…', running: '…', done: '✓', error: '✗' })[sub.status] || '?';
        status.textContent = `Replay: upload ${word(job.upload)} download ${word(job.download)}`;

        const failed = job.upload.status === 'error' || job.download.status === 'error';
        let retry = toolbar.querySelector('button[data-qol="replay-retry"]');
        if (failed && !retry) {
            retry = document.createElement('button');
            retry.dataset.qol = 'replay-retry';
            retry.className = 'button';
            retry.textContent = 'Retry replay';
            retry.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                jobStore.resetForManualRetry(context.roomId, 'upload');
                jobStore.resetForManualRetry(context.roomId, 'download');
                retry.remove();
                onBattleEnded(context);
            });
            toolbar.appendChild(retry);
        } else if (!failed && retry) {
            retry.remove();
        }
    }

    // ------------------------------------------------------------------
    // Wiring
    // ------------------------------------------------------------------
    emitter.on('battle:seen', (context) => {
        const toolbar = ensureToolbar(context.roomEl, context.roomId);
        if (toolbar) {
            ensureForfeitButton(toolbar, context);
            if (context.ended) updateReplayStatus(context);
        }
        // Resume pending jobs on later DOM changes (battle:ended fires only
        // once; beginAttempt() guards against duplicate or exhausted work).
        if (context.ended && !jobStore.isFullyDone(context.roomId)) {
            runUploadJob(context);
            runDownloadJob(context);
        }
    });
    emitter.on('battle:ended', onBattleEnded);

    jobStore.loadPersisted();

    if (typeof MutationObserver !== 'undefined' && document.body) {
        new MutationObserver(scheduleEvaluate).observe(document.body, {
            childList: true,
            subtree: true,
        });
    }
    evaluate();

    // Internal handle for tests and console debugging. Not a public API.
    window.__showdownQoL = {
        CONFIG,
        SELECTORS,
        core: { evaluate, emitter, endedEmitted },
        jobStore,
        helpers: {
            createEmitter,
            createArmToggle,
            createReplayJobStore,
            waitForElement,
            isGameRoomId,
            isBestOfWrapperId,
            roomIdFromElement,
            sendBattleCommand,
            skipToEnd,
        },
    };
})();
