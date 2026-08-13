// ==UserScript==
// @name         Showdown Ghost Clicker (Format Quick-Select)
// @namespace    http://tampermonkey.net/
// @version      4.2
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
            bo3: { id: 'gen9championsvgc2026regmbbo3', label: 'M-B Bo3' },
            // Bo1 ID is inferred from the Bo3 ID (unverified against Showdown).
            bo1: { id: 'gen9championsvgc2026regmb', label: 'M-B' },
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

        const container = document.createElement('span');
        container.id = CONFIG.controlsContainerId;
        container.style.marginLeft = '6px';

        for (const key of ['bo1', 'bo3']) {
            const format = CONFIG.formats[key];
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'button';
            btn.textContent = format.label;
            btn.style.marginLeft = '4px';
            btn.addEventListener('click', () => selectFormat(format.id));
            container.appendChild(btn);
        }

        formatBtn.insertAdjacentElement('afterend', container);
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
