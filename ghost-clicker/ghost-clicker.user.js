// ==UserScript==
// @name         Showdown Ghost Clicker (Format Quick-Select)
// @namespace    http://tampermonkey.net/
// @version      4.9
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
        hideStyleId: 'ghost-clicker-hide-format-popup',
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

    // The selection clicks through Showdown's real format menu so all of
    // the client's format-change side effects run (team selector re-render,
    // best-of / Tera-preview toggles) — but the popup itself is hidden via
    // CSS for the duration, so there is no visible flash. :has() scopes the
    // rule to the format menu; unrelated popups stay visible. Cleanup is
    // guaranteed by finish(), which runs on success and on timeout alike.
    function setFormatPopupHidden(hidden) {
        const existing = document.getElementById(CONFIG.hideStyleId);
        if (hidden && !existing) {
            const style = document.createElement('style');
            style.id = CONFIG.hideStyleId;
            style.textContent =
                '.ps-popup:has(button[name="selectFormat"]) { visibility: hidden !important; }';
            document.head.appendChild(style);
        } else if (!hidden && existing) {
            existing.remove();
        }
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
        setFormatPopupHidden(true);
        formatBtn.click(); // open the (hidden) format menu

        const poll = setInterval(() => {
            const option = document.querySelector(CONFIG.selectors.formatOption(formatId));
            if (option) {
                clearInterval(poll);
                clearTimeout(timeout);
                option.click(); // closes the popup before it is unhidden below
                finish();
            }
        }, CONFIG.optionPollMs);

        const timeout = setTimeout(finish, CONFIG.optionTimeoutMs);

        function finish() {
            clearInterval(poll);
            clearTimeout(timeout);
            setFormatPopupHidden(false);
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

        // Native rows matching the Battle! button: same color classes
        // ("button mainmenu1") and <strong> label markup, so every theme —
        // including custom color schemes that restyle .mainmenuN — colors
        // these identically to Battle!. The `.big` class itself must NOT be
        // used: the client rewrites the label of every `button.big` in the
        // main menu ("Battle! / Find a random opponent") whenever search
        // state changes. Its size rules are inlined instead.
        const container = document.createElement('div');
        container.id = CONFIG.controlsContainerId;

        for (const key of ['bo1', 'bo3']) {
            const format = CONFIG.formats[key];
            const row = document.createElement('p');
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'button mainmenu1';
            // .menugroup .button.big, minus the class the client targets.
            btn.style.cssText = 'width:230px;height:50px;padding:0;font-size:14pt;';
            const strong = document.createElement('strong');
            strong.textContent = format.label;
            btn.appendChild(strong);
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
