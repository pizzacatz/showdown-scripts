// ==UserScript==
// @name         Showdown Steam Deck Main Menu Layout
// @namespace    http://tampermonkey.net/
// @version      1.2.0
// @description  Centers Pokémon Showdown's classic-client navigation tabs for a Steam Deck-friendly layout.
// @match        *://play.pokemonshowdown.com/*
// @grant        none
// @run-at       document-end
// @updateURL    https://raw.githubusercontent.com/pizzacatz/showdown-scripts/main/steam-deck-main-menu-layout/steam-deck-main-menu-layout.user.js
// @downloadURL  https://raw.githubusercontent.com/pizzacatz/showdown-scripts/main/steam-deck-main-menu-layout/steam-deck-main-menu-layout.user.js
// ==/UserScript==

(function () {
    'use strict';

    const STYLE_ID = 'steam-deck-main-menu-layout-style';

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            /* Center the persistent Home / Teambuilder / Ladder / room tabs.
               Equal margins protect the logo and user controls while making
               the usable tab region geometrically centered in the viewport. */
            @media (min-width: 640px) {
                #header .tabbar.maintabbar {
                    box-sizing: border-box;
                    margin-left: 165px !important;
                    margin-right: 165px !important;
                }

                #header .tabbar.maintabbar > .inner {
                    display: flex !important;
                    align-items: flex-end !important;
                    justify-content: center !important;
                    width: 100% !important;
                }

                #header .tabbar.maintabbar > .inner > ul {
                    float: none !important;
                    flex: 0 0 auto !important;
                }
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    injectStyles();

    // Exposed for repository tests and live console diagnostics.
    window.__steamDeckMainMenuLayout = {
        STYLE_ID,
        injectStyles,
    };
})();
