# Steam Deck Battle Layout

A Tampermonkey layout userscript for Pokémon Showdown's classic client. It enlarges and centers the animated battlefield for a Steam Deck-sized viewport, keeps the live battle log beside it, and permanently reserves the bottom portion of the room for battle controls.

## Current behavior

- The top 60% of the room is allocated to the animated battlefield.
- The battlefield is scaled uniformly from Showdown's native 640×360 canvas and centered across the entire room.
- The bottom 40% is always reserved for controls. Move, switch, target, and team-preview changes do not resize the battlefield.
- If controls ever exceed their reserved region, only the control region scrolls; the battlefield remains fixed.
- The controls are aligned to the centered battlefield's left and right edges.
- The live log begins exactly at the battlefield's right edge, eliminating the empty gap.
- The log width is derived from the centered battlefield rather than assigned a fixed percentage; on a 1280×800 room it is approximately 17% wide.
- The live log retains Showdown's original font sizes and wraps text more aggressively inside the narrower column.

All layout allocations are percentages of the actual visible battle room. A browser toolbar, Showdown sidebar, or a non-fullscreen window can change the room dimensions, and the layout will scale proportionally when that viewport changes.

## Install

Open [`steam-deck-battle-layout.user.js`](steam-deck-battle-layout.user.js) in Tampermonkey and reload `play.pokemonshowdown.com`.

This initial version targets the live classic client. The `/beta` client has different markup and is not supported yet.

## Configuration

The editable `CONFIG` object is near the top of the userscript:

| Key | Default | Meaning |
|-----|---------|---------|
| `battleRegionHeightPercent` | `60` | Percentage of room height occupied by the battlefield region. Controls receive the remainder. |
| `debug` | `false` | Log calculated layouts to the browser console. |

The native `640×360` values in the script describe Showdown's source canvas. They do not hardcode the displayed size; the displayed battlefield is calculated from the percentages above.

The 60% default is calibrated to the Steam Deck's 16:10 viewport. At 1280×800, the battlefield renders at approximately 853×480 and is centered at `x = 213`. The live log starts at its right edge and uses the final 213 pixels, while the bottom 320 pixels remain available for controls.

## Version history

| Version | Notes |
|---------|-------|
| 0.2.0 | Center the battlefield across the full room, reduce its height, expand the stable control region, narrow the original-size log for more wrapping, and remove the battlefield-to-log gap. |
| 0.1.0 | Initial proportional Steam Deck layout. |

## Stability rule

The script recalculates the battlefield only when the battle room itself changes size. DOM rewrites inside `.battle-controls` do not participate in sizing, so changing button options cannot shrink or move the animated battlefield.

## Compatibility note

This script only changes layout and log typography. It does not replace controls or submit battle choices, and it can run alongside QoL Battle Tools. Its reserved control area includes any toolbar that QoL Battle Tools injects.
