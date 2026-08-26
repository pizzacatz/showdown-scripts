// ==UserScript==
// @name         Showdown Steam Deck Main Menu Layout
// @namespace    http://tampermonkey.net/
// @version      1.1.0
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
            @media (min-width: 896px) {
                #header .tabbar.maintabbar {
                    box-sizing: border-box;
                    margin-left: 165px !important;
                    margin-right: 165px !important;
                }

                #header .tabbar.maintabbar > .inner {
                    display: flex;
                    align-items: flex-end;
                    justify-content: center;
                    width: 100%;
                }

                #header .tabbar.maintabbar > .inner > ul {
                    float: none;
                    flex: 0 0 auto;
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
