// ==UserScript==
// @name         Showdown Steam Deck Main Menu Layout
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Centers Pokémon Showdown's classic-client main navigation for a Steam Deck-friendly home screen.
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
            /* Showdown switches to its own narrow layout below this width. */
            @media (min-width: 896px) {
                #mainmenu > .mainmenuwrapper > .leftmenu {
                    box-sizing: border-box;
                    display: flex;
                    flex-direction: column;
                    width: 324px !important;
                    margin-left: auto !important;
                    margin-right: auto !important;
                }

                #mainmenu > .mainmenuwrapper > .leftmenu > .mainmenu {
                    box-sizing: border-box;
                    order: 1;
                    width: 100%;
                }

                /* The activity/news box is absolutely positioned beside the
                   navigation by default. Put it below the centered column so
                   the two areas can never overlap. */
                #mainmenu > .mainmenuwrapper > .leftmenu > .activitymenu {
                    box-sizing: border-box;
                    position: static !important;
                    order: 2;
                    width: 100%;
                    margin: 0;
                    padding: 0 0 8px;
                }

                /* Chat-room navigation is a separate right-side container in
                   the classic client. Stack it below the centered left menu
                   instead of leaving a second control at the far edge. */
                #mainmenu > .mainmenuwrapper > .rightmenu {
                    box-sizing: border-box;
                    position: static !important;
                    width: 324px !important;
                    margin-left: auto !important;
                    margin-right: auto !important;
                    padding-bottom: 51px;
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
