# Steam Deck Main Menu Layout

A focused Tampermonkey userscript that centers Pokémon Showdown's classic-client main navigation on Steam Deck-sized desktop viewports.

## Behavior

- Centers the main navigation column containing the battle form, Teambuilder, Ladder, Tournaments, Watch a Battle, Find a User, Friends, and Resources.
- Keeps the native 324-pixel navigation width and Showdown's original button styling.
- Places the activity/news panel below the navigation so its original absolute positioning cannot overlap the centered column.
- Centers the separate chat-room navigation below the main column rather than leaving it at the far-right edge.
- Applies only to the home room (`#mainmenu`) at widths of 896 pixels or more. Showdown's native narrow/mobile layout remains untouched.
- Does not modify battle rooms, the teambuilder, ladder pages, popups, or room tabs.

## Install

Open [`steam-deck-main-menu-layout.user.js`](steam-deck-main-menu-layout.user.js) in Tampermonkey and reload `play.pokemonshowdown.com`.

This script targets the live classic client. The `/beta` client uses different markup and is not supported.

## Why this is separate

Main-menu positioning and battle-room positioning have unrelated DOM structures and lifecycles. Keeping this separate from Steam Deck Battle Layout lets either customization be updated, disabled, or installed independently.
