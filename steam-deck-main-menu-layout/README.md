# Steam Deck Main Menu Layout

A focused Tampermonkey userscript that centers Pokémon Showdown's persistent classic-client navigation tabs on Steam Deck-sized desktop viewports.

## Behavior

- Centers the persistent header bar containing Home, Teambuilder, Ladder, Resources, and currently open room tabs.
- Uses equal 165-pixel left and right margins so the tab region is centered while remaining clear of the Pokémon Showdown logo and user controls.
- Preserves Showdown's original tab styling, actions, close buttons, notification states, and overflow menu.
- Applies at reported CSS widths of 640 pixels or more, accounting for Steam Deck browser zoom and display scaling. Showdown's phone-width tab layout remains untouched.
- Does not reposition the home-page battle form, news, chat button, battle rooms, or page content.

## Install

Open [`steam-deck-main-menu-layout.user.js`](steam-deck-main-menu-layout.user.js) in Tampermonkey and reload `play.pokemonshowdown.com`.

This script targets the live classic client. The `/beta` client uses different markup and is not supported.

## Why this is separate

Header-navigation positioning and battle-room positioning have unrelated DOM structures and lifecycles. Keeping this separate from Steam Deck Battle Layout lets either customization be updated, disabled, or installed independently.

## Version history

| Version | Notes |
|---------|-------|
| 1.2.0 | Activate from 640 CSS pixels and strengthen the centering overrides for Steam Deck browser zoom/display scaling. |
| 1.1.0 | Correct the target to the persistent client navigation tabs and center them inside equal logo/user margins. |
| 1.0.0 | Initially targeted the home-page button column. |
