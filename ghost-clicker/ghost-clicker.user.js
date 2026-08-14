// ==UserScript==
// @name         Showdown Ghost Clicker (Format Quick-Select)
// @namespace    http://tampermonkey.net/
// @version      4.6
// @description  Defaults the battle format to Reg M-B Bo3 once per page load, with quick-select buttons for Reg M-B Bo1/Bo3.
// @match        *://play.pokemonshowdown.com/*
// @updateURL    https://raw.githubusercontent.com/pizzacatz/showdown-scripts/main/ghost-clicker/ghost-clicker.user.js
// @downloadURL  https://raw.githubusercontent.com/pizzacatz/showdown-scripts/main/ghost-clicker/ghost-clicker.user.js
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // ------------------------------------------------------------------
    // Configuration — format IDs, labels, selectors, and timeouts.
    // Regulation updates should only ever require edits in this block.
    // ------------------------------------------------------------------
    const CONFIG = {
        formats: {
            bo3: { id: 'gen9championsvgc2026regmbbo3', label: 'Reg M-B (Bo3)' },
            bo1: { id: 'gen9championsvgc2026regmb', label: 'Reg M-B' },
        },
        defaultFormat: 'bo3',
        selectors: {
            formatButton: 'button[name="format"]',
            formatOption: (id) => `button[name="selectFormat"][value="${id}"]`,
        },
        controlsContainerId: 'ghost-clicker-quickselect',
        optionPollMs: 25,      // poll rate while waiting for the menu option to render
        optionTimeoutMs: 1500, // hard cap on any single selection attempt
    };

    const state = {
        initializedOnce: false, // one-time default applied (or attempted) this page load
        macroRunning: false,    // a selection attempt is in flight
    };

    // The client first renders a disabled "Loading..." placeholder with the
    // same name="format" until the server sends the format list; clicking it
    // does nothing (and the client's handler bails without BattleFormats).
    // Only treat the selector as usable once both are ready.
    function getReadyFormatButton() {
        const btn = document.querySelector(CONFIG.selectors.formatButton);
        if (!btn || btn.disabled || !window.BattleFormats) return null;
        return btn;
    }

    // ------------------------------------------------------------------
    // selectFormat — the single reusable one-shot action. Backs both the
    // automatic default and the manual quick-select buttons.
    // ------------------------------------------------------------------
    function selectFormat(formatId) {
        if (state.macroRunning) return;

        const formatBtn = getReadyFormatButton();
        if (!formatBtn) return;
        if (formatBtn.value === formatId) return; // already active: no-op

        state.macroRunning = true;
        formatBtn.click(); // open the format menu

        const poll = setInterval(() => {
            const option = document.querySelector(CONFIG.selectors.formatOption(formatId));
            if (option) {
                finish();
                option.click();
            }
        }, CONFIG.optionPollMs);

        const timeout = setTimeout(finish, CONFIG.optionTimeoutMs);

        function finish() {
            clearInterval(poll);
            clearTimeout(timeout);
            state.macroRunning = false;
        }
    }

    // ------------------------------------------------------------------
    // applyDefaultOnce — sets the default format a single time per page
    // load. Never re-enforces: manual changes afterwards stick.
    // ------------------------------------------------------------------
    function applyDefaultOnce() {
        if (state.initializedOnce) return;
        // Don't spend the one-shot until the selector is actually usable;
        // a later DOM mutation will bring us back here once it is.
        if (!getReadyFormatButton()) return;

        state.initializedOnce = true;
        selectFormat(CONFIG.formats[CONFIG.defaultFormat].id);
    }

    // ------------------------------------------------------------------
    // ensureControls — injects the quick-select buttons next to the
    // format selector. Idempotent: the stable container ID prevents
    // duplicates when Showdown rebuilds the UI.
    // ------------------------------------------------------------------
    function ensureControls() {
        const formatBtn = document.querySelector(CONFIG.selectors.formatButton);
        if (!formatBtn) return;
        if (document.getElementById(CONFIG.controlsContainerId)) return;

        // Fully native rows: one <p><button class="button"> per format, no
        // styling of our own. The client's own `.menugroup p` (10px row
        // margin) and `.menugroup .button` (200px width, native padding and
        // gradient) rules do all the work, dark mode included.
        const container = document.createElement('div');
        container.id = CONFIG.controlsContainerId;

        for (const key of ['bo1', 'bo3']) {
            const format = CONFIG.formats[key];
            const row = document.createElement('p');
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'button';
            btn.textContent = format.label;
            btn.addEventListener('click', (e) => {
                // The client dismisses all popups on any click that bubbles
                // to the room ("dispatchClickBackground"); without stopping
                // propagation, the format menu we just opened is closed in
                // the same tick and the selection silently fails.
                e.preventDefault();
                e.stopPropagation();
                selectFormat(format.id);
            });
            row.appendChild(btn);
            container.appendChild(row);
        }

        const formatRow = formatBtn.closest('p');
        if (formatRow) {
            formatRow.insertAdjacentElement('afterend', container);
        } else {
            formatBtn.insertAdjacentElement('afterend', container);
        }
    }

    // ------------------------------------------------------------------
    // Event-driven initialization: react to Showdown building/rebuilding
    // the UI instead of enforcing on a permanent timer.
    // ------------------------------------------------------------------
    function onDomChange() {
        applyDefaultOnce();
        ensureControls();
    }

    new MutationObserver(onDomChange).observe(document.body, {
        childList: true,
        subtree: true,
    });

    onDomChange(); // handle the case where the UI already exists at script start
})();
