# Steam Deck Battle Layout

A Tampermonkey layout userscript for Pokémon Showdown's classic client. It enlarges and centers the animated battlefield for a Steam Deck-sized viewport, keeps the live battle log beside it, and permanently reserves the bottom portion of the room for battle controls.

## Current behavior

- The left 75% of the battle room is allocated to the battlefield and controls.
- The top 68% of that column is allocated to the animated battlefield.
- The battlefield is scaled uniformly from Showdown's native 640×360 canvas and centered inside that region.
- The bottom 32% is always reserved for controls. Move, switch, target, and team-preview changes do not resize the battlefield.
- If controls ever exceed their reserved region, only the control region scrolls; the battlefield remains fixed.
- The live log uses the remaining 25% of the room width.
- Battle-history text in the live log is reduced to 82% while regular chat retains its normal text size.

All layout allocations are percentages of the actual visible battle room. A browser toolbar, Showdown sidebar, or a non-fullscreen window can change the room dimensions, and the layout will scale proportionally when that viewport changes.

## Install

Open [`steam-deck-battle-layout.user.js`](steam-deck-battle-layout.user.js) in Tampermonkey and reload `play.pokemonshowdown.com`.

This initial version targets the live classic client. The `/beta` client has different markup and is not supported yet.

## Configuration

The editable `CONFIG` object is near the top of the userscript:

| Key | Default | Meaning |
|-----|---------|---------|
| `battleColumnPercent` | `75` | Percentage of room width assigned to the battlefield and controls. The log receives the remainder. |
| `battleRegionHeightPercent` | `68` | Percentage of room height reserved above the controls. |
| `battleDetailsFontPercent` | `82` | Live-log battle-history text size relative to Showdown's normal size. |
| `debug` | `false` | Log calculated layouts to the browser console. |

The native `640×360` values in the script describe Showdown's source canvas. They do not hardcode the displayed size; the displayed battlefield is calculated from the percentages above.

The 75% × 68% defaults are calibrated to the Steam Deck's 16:10 viewport: at 1280×800, the battlefield allocation is approximately 960×544, which closely fits a proportionally scaled 960×540 battlefield while leaving 320 pixels for the log and 256 pixels of height for controls.

## Stability rule

The script recalculates the battlefield only when the battle room itself changes size. DOM rewrites inside `.battle-controls` do not participate in sizing, so changing button options cannot shrink or move the animated battlefield.

## Compatibility note

This script only changes layout and log typography. It does not replace controls or submit battle choices, and it can run alongside QoL Battle Tools. Its reserved control area includes any toolbar that QoL Battle Tools injects.
