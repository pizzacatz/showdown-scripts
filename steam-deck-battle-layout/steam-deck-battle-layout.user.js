// ==UserScript==
// @name         Showdown Steam Deck Battle Layout
// @namespace    http://tampermonkey.net/
// @version      0.1.0
// @description  Proportionally enlarges and centers Pokémon Showdown's battlefield while preserving stable controls and a compact live log.
// @match        *://play.pokemonshowdown.com/*
// @grant        none
// @run-at       document-end
// @updateURL    https://raw.githubusercontent.com/pizzacatz/showdown-scripts/main/steam-deck-battle-layout/steam-deck-battle-layout.user.js
// @downloadURL  https://raw.githubusercontent.com/pizzacatz/showdown-scripts/main/steam-deck-battle-layout/steam-deck-battle-layout.user.js
// ==/UserScript==

(function () {
    'use strict';

    // Percentages are relative to the visible battle room, so the layout
    // follows the Steam Deck viewport without being tied to 1280x800 pixels.
    const CONFIG = {
        // On a 16:10 Steam Deck viewport, 75% of the width is 960px and
        // a proportional 16:9 battlefield is 540px tall (67.5% of 800px).
        // Rounding the height region to 68% leaves 32% for stable controls.
        battleColumnPercent: 75,
        battleRegionHeightPercent: 68,
        battleDetailsFontPercent: 82,
        debug: false,
    };

    // The classic Showdown renderer always draws into this native canvas.
    // These are source dimensions, not target screen dimensions.
    const NATIVE_BATTLE = {
        width: 640,
        height: 360,
    };

    const ROOM_SELECTOR = '[id^="room-battle-"]';
    const LAYOUT_CLASS = 'steam-deck-battle-layout';
    const STYLE_ID = 'steam-deck-battle-layout-style';
    const roomObservers = new Map();

    function log(message, data) {
        if (!CONFIG.debug) return;
        if (data === undefined) {
            console.log('[Steam Deck Battle Layout]', message);
        } else {
            console.log('[Steam Deck Battle Layout]', message, data);
        }
    }

    function clampPercent(value, fallback) {
        const number = Number(value);
        if (!Number.isFinite(number)) return fallback;
        return Math.min(100, Math.max(0, number));
    }

    function calculateLayout(width, height, config = CONFIG) {
        const columnRatio = clampPercent(config.battleColumnPercent, 75) / 100;
        const regionRatio = clampPercent(config.battleRegionHeightPercent, 68) / 100;
        const battleColumnWidth = width * columnRatio;
        const battleRegionHeight = height * regionRatio;
        const controlsHeight = height - battleRegionHeight;

        const scale = Math.min(
            battleColumnWidth / NATIVE_BATTLE.width,
            battleRegionHeight / NATIVE_BATTLE.height
        );
        const renderedWidth = NATIVE_BATTLE.width * scale;
        const renderedHeight = NATIVE_BATTLE.height * scale;

        return {
            scale,
            battleColumnWidth,
            battleRegionHeight,
            controlsHeight,
            battleLeft: (battleColumnWidth - renderedWidth) / 2,
            battleTop: (battleRegionHeight - renderedHeight) / 2,
            renderedWidth,
            renderedHeight,
        };
    }

    function setPixelVariable(room, name, value) {
        room.style.setProperty(name, `${Math.max(0, value).toFixed(2)}px`);
    }

    function updateRoomLayout(room) {
        const bounds = room.getBoundingClientRect();
        if (!bounds.width || !bounds.height) return;

        const layout = calculateLayout(bounds.width, bounds.height);
        room.style.setProperty('--sd-battle-scale', layout.scale.toFixed(5));
        setPixelVariable(room, '--sd-battle-left', layout.battleLeft);
        setPixelVariable(room, '--sd-battle-top', layout.battleTop);
        setPixelVariable(room, '--sd-battle-column-width', layout.battleColumnWidth);
        setPixelVariable(room, '--sd-controls-top', layout.battleRegionHeight);
        setPixelVariable(room, '--sd-controls-height', layout.controlsHeight);
        room.style.setProperty(
            '--sd-log-details-font-size',
            `${clampPercent(CONFIG.battleDetailsFontPercent, 82)}%`
        );

        log('layout updated', layout);
    }

    function observeRoom(room) {
        if (!(room instanceof HTMLElement) || roomObservers.has(room)) return;

        room.classList.add(LAYOUT_CLASS);
        updateRoomLayout(room);

        if (typeof ResizeObserver === 'function') {
            const observer = new ResizeObserver(() => updateRoomLayout(room));
            observer.observe(room);
            roomObservers.set(room, observer);
        } else {
            roomObservers.set(room, null);
        }
    }

    function findRooms(node) {
        if (!(node instanceof Element)) return;
        if (node.matches(ROOM_SELECTOR)) observeRoom(node);
        for (const room of node.querySelectorAll(ROOM_SELECTOR)) observeRoom(room);
    }

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            .${LAYOUT_CLASS} .battle {
                left: var(--sd-battle-left, 0px) !important;
                top: var(--sd-battle-top, 0px) !important;
                transform: scale(var(--sd-battle-scale, 1)) !important;
                transform-origin: top left !important;
            }

            .${LAYOUT_CLASS} .foehint {
                transform: scale(var(--sd-battle-scale, 1)) !important;
                transform-origin: top left !important;
            }

            .${LAYOUT_CLASS} .battle-controls {
                box-sizing: border-box;
                top: var(--sd-controls-top, 68%) !important;
                bottom: 0 !important;
                left: 0 !important;
                width: var(--sd-battle-column-width, 75%) !important;
                height: var(--sd-controls-height, 32%) !important;
                overflow-x: hidden;
                overflow-y: auto;
                padding-top: 6px;
            }

            .${LAYOUT_CLASS} .battle-controls > .controls {
                box-sizing: border-box;
                width: 640px;
                max-width: 100%;
                margin-left: auto;
                margin-right: auto;
            }

            .${LAYOUT_CLASS} .battle-log,
            .${LAYOUT_CLASS} .battle-log-add,
            .${LAYOUT_CLASS} .battle-userlist {
                left: var(--sd-battle-column-width, 75%) !important;
            }

            .${LAYOUT_CLASS} .battle-log .battle-history {
                font-size: var(--sd-log-details-font-size, 82%) !important;
                line-height: 1.2;
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    function pruneRemovedRooms() {
        for (const [room, observer] of roomObservers) {
            if (room.isConnected) continue;
            if (observer) observer.disconnect();
            roomObservers.delete(room);
        }
    }

    function start() {
        injectStyles();
        findRooms(document.documentElement);

        const domObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) findRooms(node);
            }
            pruneRemovedRooms();
        });
        domObserver.observe(document.documentElement, { childList: true, subtree: true });

        // ResizeObserver is the primary path. This fallback also covers older
        // userscript/browser combinations and Showdown room-tab transitions.
        const onWindowResize = () => {
            for (const room of roomObservers.keys()) updateRoomLayout(room);
        };
        window.addEventListener('resize', onWindowResize);

        return {
            domObserver,
            onWindowResize,
        };
    }

    const core = start();

    // Expose small, side-effect-free seams for repository tests and live
    // console diagnostics. Normal users do not need to call these.
    window.__steamDeckBattleLayout = {
        CONFIG,
        calculateLayout,
        updateRoomLayout,
        shutdown() {
            core.domObserver.disconnect();
            window.removeEventListener('resize', core.onWindowResize);
            for (const observer of roomObservers.values()) {
                if (observer) observer.disconnect();
            }
            roomObservers.clear();
        },
    };
})();
