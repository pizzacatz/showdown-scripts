// ==UserScript==
// @name         Showdown Ghost Clicker (Format Quick-Select)
// @namespace    http://tampermonkey.net/
// @version      4.11
// @description  Defaults the battle format to Reg M-B Bo3 once per page load, with quick-select buttons that pick Reg M-B Bo1/Bo3 and start searching.
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
            searchButton: 'button[name="search"]',
            searchPending: 'p.cancel', // row the client adds while connecting/searching
        },
        controlsContainerId: 'ghost-clicker-quickselect',
        hideStyleId: 'ghost-clicker-hide-format-popup',
        optionPollMs: 25,      // poll rate while waiting for the menu option to render
        optionTimeoutMs: 1500, // hard cap on any single selection attempt
    };

    const state = {
        initializedOnce: false, // one-time default applied (or attempted) this page load
        macroRunning: false,    // a selection attempt is in flight
        lastTeamIndex: -1,      // last non-blank team selection seen (for blank-team repair)
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
    // automatic default and the manual quick-select buttons. Resolves to
    // true when the requested format is active afterwards (whether it was
    // already active or was just selected), false when the selector was
    // unavailable, another attempt was in flight, or the attempt timed out.
    // ------------------------------------------------------------------
    function selectFormat(formatId) {
        return new Promise((resolve) => {
            if (state.macroRunning) return resolve(false);

            const formatBtn = getReadyFormatButton();
            if (!formatBtn) return resolve(false);
            if (formatBtn.value === formatId) return resolve(true); // already active

            state.macroRunning = true;
            setFormatPopupHidden(true);
            formatBtn.click(); // open the (hidden) format menu

            const poll = setInterval(() => {
                const option = document.querySelector(CONFIG.selectors.formatOption(formatId));
                if (option) {
                    option.click(); // closes the popup before it is unhidden below
                    finish(true);
                }
            }, CONFIG.optionPollMs);

            const timeout = setTimeout(() => finish(false), CONFIG.optionTimeoutMs);

            function finish(selected) {
                clearInterval(poll);
                clearTimeout(timeout);
                setFormatPopupHidden(false);
                state.macroRunning = false;
                resolve(selected);
            }
        });
    }

    // ------------------------------------------------------------------
    // startSearch — presses the client's own Battle! button, so the whole
    // native flow runs (login prompt, "Please select a team", team upload,
    // the 3 s search delay, Cancel row). Does nothing while a search is
    // already connecting/searching: the client would ignore the click too.
    // ------------------------------------------------------------------
    function startSearch() {
        const searchBtn = document.querySelector(CONFIG.selectors.searchButton);
        const form = searchBtn && searchBtn.closest('form');
        if (!form || form.querySelector(CONFIG.selectors.searchPending)) return;
        searchBtn.click();
    }

    // Quick-select action: pick the format, then search it. Ordering note
    // for the blank-team repair: the client's re-render inside selectFormat
    // queues our MutationObserver callback before the promise settles, so
    // trackAndRepairTeam has already restored the team by the time
    // startSearch runs — Battle! sees a selected team, not the blank.
    function selectFormatAndSearch(formatId) {
        selectFormat(formatId).then((active) => {
            if (active) startSearch();
        });
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
    // duplicates when Showdown rebuilds the UI. Each button selects its
    // format and starts searching in one click.
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
            const small = document.createElement('small');
            small.textContent = 'Search';
            btn.append(strong, document.createElement('br'), small);
            btn.addEventListener('click', (e) => {
                // The client dismisses all popups on any click that bubbles
                // to the room ("dispatchClickBackground"); without stopping
                // propagation, the format menu we just opened is closed in
                // the same tick and the selection silently fails.
                e.preventDefault();
                e.stopPropagation();
                selectFormatAndSearch(format.id);
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

    // Mirror the format selector's usability onto the quick-select buttons:
    // greyed out (the client's own `.disabled` look) while formats are still
    // loading or a search is in progress — the states in which a click
    // would do nothing.
    function syncControlsState() {
        const container = document.getElementById(CONFIG.controlsContainerId);
        if (!container) return;
        const usable = !!getReadyFormatButton();
        for (const btn of container.querySelectorAll('button')) {
            btn.classList.toggle('disabled', !usable);
        }
    }

    // ------------------------------------------------------------------
    // Blank-team repair — works around a classic-client bug: switching
    // between two formats that share a teambuilder format (Reg M-B Bo1 ↔
    // Bo3) blanks the team selector. The client resets curTeamIndex to -1
    // before re-rendering, and its "keep the current team" path can never
    // see the pre-switch value; its auto-pick is skipped because the
    // teambuilder format didn't change. We remember the last non-blank
    // selection and, when the blank appears, restore it through the
    // client's own renderTeams — so the repaired button is fully native.
    // Self-deactivating: if Showdown fixes the bug, the blank never
    // renders and this code never fires.
    // ------------------------------------------------------------------
    function getTeamButton() {
        const formatBtn = document.querySelector(CONFIG.selectors.formatButton);
        const form = formatBtn && formatBtn.closest('form');
        return form ? form.querySelector('button[name="team"]') : null;
    }

    // Mirrors renderTeams' own resolution of a format's teambuilder format.
    function teambuilderFormatOf(formatId) {
        const format = window.BattleFormats && window.BattleFormats[formatId];
        if (!format) return '';
        return format.teambuilderFormat || (format.isTeambuilderFormat ? formatId : '');
    }

    function trackAndRepairTeam() {
        const teamBtn = getTeamButton();
        // Disabled variants ("Loading...", "You have no teams", random
        // formats) are legitimate — never touch them.
        if (!teamBtn || teamBtn.disabled) return;

        if (teamBtn.value !== '') {
            const index = Number(teamBtn.value);
            if (!Number.isNaN(index)) state.lastTeamIndex = index;
            return;
        }

        // Blank enabled team button: only the client bug renders this state
        // while a compatible team exists. Restore the remembered team, but
        // only if it actually fits the current format's teambuilder format —
        // a blank after switching to a format you have no teams for is
        // legitimate and must stay blank.
        if (state.lastTeamIndex < 0) return;
        const room = window.app && window.app.rooms && window.app.rooms[''];
        const formatBtn = getReadyFormatButton();
        const teams = window.Storage && window.Storage.teams;
        if (!room || typeof room.renderTeams !== 'function' || !formatBtn || !teams) return;

        const teamFormat = teambuilderFormatOf(formatBtn.value);
        const team = teams[state.lastTeamIndex];
        if (!teamFormat || !team || team.format !== teamFormat) return;

        // What the client's own team picker does on selection.
        room.curTeamIndex = state.lastTeamIndex;
        room.curTeamFormat = teamFormat;
        teamBtn.outerHTML = room.renderTeams(formatBtn.value, state.lastTeamIndex);
    }

    // ------------------------------------------------------------------
    // Event-driven initialization: react to Showdown building/rebuilding
    // the UI instead of enforcing on a permanent timer.
    // ------------------------------------------------------------------
    function onDomChange() {
        applyDefaultOnce();
        ensureControls();
        syncControlsState();
        trackAndRepairTeam();
    }

    new MutationObserver(onDomChange).observe(document.body, {
        childList: true,
        subtree: true,
    });

    onDomChange(); // handle the case where the UI already exists at script start
})();
