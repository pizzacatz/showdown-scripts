// ==UserScript==
// @name         Showdown Steam Deck Battle Layout
// @namespace    http://tampermonkey.net/
// @version      0.4.0
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
        // The native choice controls now occupy the left gutter instead of a
        // bottom band, allowing the battlefield to use nearly all room height.
        battleRegionHeightPercent: 78,
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
        const regionRatio = clampPercent(config.battleRegionHeightPercent, 78) / 100;
        const battleRegionHeight = height * regionRatio;

        const scale = Math.min(
            width / NATIVE_BATTLE.width,
            battleRegionHeight / NATIVE_BATTLE.height
        );
        const renderedWidth = NATIVE_BATTLE.width * scale;
        const renderedHeight = NATIVE_BATTLE.height * scale;
        const battleLeft = (width - renderedWidth) / 2;
        const logLeft = battleLeft + renderedWidth;

        return {
            scale,
            battleRegionHeight,
            battleLeft,
            battleTop: (battleRegionHeight - renderedHeight) / 2,
            renderedWidth,
            renderedHeight,
            logLeft,
            logWidth: width - logLeft,
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
        setPixelVariable(room, '--sd-battle-width', layout.renderedWidth);
        setPixelVariable(room, '--sd-log-left', layout.logLeft);
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
                top: 0 !important;
                bottom: 0 !important;
                left: 0 !important;
                width: var(--sd-battle-left, 10%) !important;
                height: 100% !important;
                overflow-x: hidden;
                overflow-y: auto;
                padding: 4px;
            }

            .${LAYOUT_CLASS} .battle-controls > .controls {
                box-sizing: border-box;
                width: 100%;
                max-width: none;
                margin: 0;
            }

            .${LAYOUT_CLASS} .battle-controls .whatdo {
                box-sizing: border-box;
                margin: 0 0 4px;
                padding: 2px;
                font-size: 8pt;
                overflow-wrap: anywhere;
            }

            .${LAYOUT_CLASS} .battle-controls .timerbutton {
                float: none;
                width: 100%;
                margin: 2px 0;
                padding-left: 2px;
                padding-right: 2px;
            }

            .${LAYOUT_CLASS} .battle-controls .movecontrols,
            .${LAYOUT_CLASS} .battle-controls .shiftcontrols,
            .${LAYOUT_CLASS} .battle-controls .switchcontrols,
            .${LAYOUT_CLASS} .battle-controls .movemenu,
            .${LAYOUT_CLASS} .battle-controls .switchmenu,
            .${LAYOUT_CLASS} .battle-controls .allyparty {
                box-sizing: border-box;
                display: block !important;
                width: 100%;
                max-width: none;
                margin: 0;
                padding: 0;
            }

            .${LAYOUT_CLASS} .battle-controls .moveselect button,
            .${LAYOUT_CLASS} .battle-controls .switchselect button,
            .${LAYOUT_CLASS} .battle-controls .shiftselect button {
                box-sizing: border-box;
                width: 100%;
                padding: 5px 2px 3px;
                font-size: 9pt;
            }

            .${LAYOUT_CLASS} .battle-controls .movebutton,
            .${LAYOUT_CLASS} .battle-controls .switchmenu button,
            .${LAYOUT_CLASS} .battle-controls .allyparty button {
                box-sizing: border-box;
                float: none;
                width: 100%;
                min-height: 40px;
                height: auto;
                margin: 3px 0;
                padding: 5px 2px;
                white-space: normal;
                overflow-wrap: anywhere;
            }

            .${LAYOUT_CLASS} .battle-controls .megaevo-box {
                padding-top: 4px;
            }

            .${LAYOUT_CLASS} .battle-controls .megaevo {
                box-sizing: border-box;
                width: 100%;
                margin: 2px 0;
                padding: 3px 1px;
                font-size: 8pt;
                overflow-wrap: anywhere;
            }

            .${LAYOUT_CLASS} .battle-controls .movewarning {
                box-sizing: border-box;
                padding: 4px 1px;
                font-size: 8pt;
                overflow-wrap: anywhere;
            }

            .${LAYOUT_CLASS} .qol-battle-toolbar {
                display: none !important;
            }

            .${LAYOUT_CLASS} .battle-log,
            .${LAYOUT_CLASS} .battle-log-add,
            .${LAYOUT_CLASS} .battle-userlist {
                left: var(--sd-log-left, 75%) !important;
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
