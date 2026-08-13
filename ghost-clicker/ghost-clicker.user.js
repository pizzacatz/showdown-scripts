// ==UserScript==
// @name         Showdown VGC Ghost Clicker (Hyper-Optimized)
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  Aggressively automates UI clicks with zero hardcoded delay.
// @match        *://play.pokemonshowdown.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const VGC_FORMAT = 'gen9championsvgc2026regmbbo3';
    let macroRunning = false;

    function runClickMacro() {
        const formatBtn = document.querySelector('button[name="format"]');

        if (!formatBtn || formatBtn.value === VGC_FORMAT || macroRunning) {
            return;
        }

        macroRunning = true;

        // Step 1: Open the menu
        formatBtn.click();

        // Step 2: HYPER-POLLING. Check the DOM every 10 milliseconds instead of waiting.
        const fastPoll = setInterval(() => {
            const targetFormatBtn = document.querySelector(`button[name="selectFormat"][value="${VGC_FORMAT}"]`);

            if (targetFormatBtn) {
                // The instant the button is found, stop polling and click it
                clearInterval(fastPoll);
                targetFormatBtn.click();

                // A brief 500ms cooldown to prevent the script from infinitely looping if Showdown lags
                setTimeout(() => { macroRunning = false; }, 500);
            }
        }, 10);

        // Step 3: Safety Switch. If the menu fails to open for some reason, kill the poll after 1 second.
        setTimeout(() => {
            clearInterval(fastPoll);
            macroRunning = false;
        }, 1000);
    }

    // Check the page every 50 milliseconds instead of every 1000 milliseconds.
    // This guarantees the macro fires the instant you navigate back to the home menu.
    setInterval(runClickMacro, 50);

})();
