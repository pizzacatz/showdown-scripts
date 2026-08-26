# Steam Deck Battle Layout

A Tampermonkey layout userscript for Pokémon Showdown's classic client. It enlarges and centers the animated battlefield for a Steam Deck-sized viewport, keeps the live battle log beside it, and permanently reserves the bottom portion of the room for battle controls.

## Current behavior

- The animated battlefield uses up to 78% of the room height.
- The battlefield is scaled uniformly from Showdown's native 640×360 canvas and centered across the entire room.
- Showdown's native move, switch, target, and team-preview choices occupy a full-height vertical rail in the empty gutter to the battlefield's left.
- Choice buttons stack vertically and narrow their labels to fit the rail. The rail scrolls independently when a choice state is taller than the screen.
- Redundant Attack, Switch, and Shift selector labels are hidden. Their choice menus remain open, preventing those label buttons from colliding with gamepad hints.
- Native HP fills are converted from Showdown's fixed 0–92 pixel calculation to percentages whenever switch controls are rebuilt, keeping bars accurate inside narrow rail buttons.
- Changes between choice states do not resize or move the battlefield.
- The QoL Battle Tools toolbar is hidden so its forfeit and replay controls cannot consume the choice rail. Its non-UI automation is unaffected.
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
| `battleRegionHeightPercent` | `78` | Maximum percentage of room height occupied by the battlefield. Width can still be the limiting dimension. |
| `debug` | `false` | Log calculated layouts to the browser console. |

The native `640×360` values in the script describe Showdown's source canvas. They do not hardcode the displayed size; the displayed battlefield is calculated from the percentages above.

The 78% default prioritizes vertical battlefield space on the Steam Deck. At 1280×800, the battlefield renders at approximately 1109×624 and is centered at `x = 85`. The left 85 pixels become the choice rail, and the live log begins at the battlefield's right edge in the matching right gutter.

## Version history

| Version | Notes |
|---------|-------|
| 0.7.0 | Preserve accurate switch-menu HP bars by converting Showdown's native 92-pixel fill widths to responsive percentages. |
| 0.6.0 | Hide redundant Attack/Switch/Shift selector labels to prevent conflicts with gamepad button hints; all actual choices remain visible. |
| 0.5.0 | Fix overlapping rail labels by converting native choice sections to explicit vertical stacks and resetting inherited label positioning and floats. |
| 0.4.0 | Move native choices into a full-height vertical rail in the left gutter, hide the separate QoL toolbar, and raise the battlefield to 78% of room height. |
| 0.3.0 | Prioritize the animated battlefield: use 75% of room height and reserve only the bottom 25% for native move/switch choices; extra userscript controls may scroll. |
| 0.2.0 | Center the battlefield across the full room, reduce its height, expand the stable control region, narrow the original-size log for more wrapping, and remove the battlefield-to-log gap. |
| 0.1.0 | Initial proportional Steam Deck layout. |

## Stability rule

The script recalculates the battlefield only when the battle room itself changes size. DOM rewrites inside `.battle-controls` do not participate in sizing, so changing button options cannot shrink or move the animated battlefield.

## Compatibility note

This script only changes layout and log typography. It does not replace controls or submit battle choices, and it can run alongside QoL Battle Tools. Its reserved control area includes any toolbar that QoL Battle Tools injects.
