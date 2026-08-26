import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const SCRIPT = fs.readFileSync(
  path.join(root, 'steam-deck-battle-layout/steam-deck-battle-layout.user.js'),
  'utf8'
);

function loadScript() {
  (0, eval)(SCRIPT);
  return window.__steamDeckBattleLayout;
}

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  delete window.__steamDeckBattleLayout;
});

afterEach(() => {
  window.__steamDeckBattleLayout?.shutdown();
});

describe('Steam Deck proportional battle layout', () => {
  it('uses 78% of Steam Deck height and preserves the battlefield at 16:9', () => {
    const script = loadScript();
    const layout = script.calculateLayout(1280, 800);

    expect(layout.battleRegionHeight).toBeCloseTo(624);
    expect(layout.renderedWidth).toBeCloseTo(1109.333, 2);
    expect(layout.renderedHeight).toBeCloseTo(624);
    expect(layout.renderedWidth / layout.renderedHeight).toBeCloseTo(16 / 9);
  });

  it('centers the battlefield across the room and places the log directly beside it', () => {
    const script = loadScript();
    const layout = script.calculateLayout(1180, 760);

    expect(layout.battleLeft * 2 + layout.renderedWidth)
      .toBeCloseTo(1180);
    expect(layout.battleTop * 2 + layout.renderedHeight)
      .toBeCloseTo(layout.battleRegionHeight);
    expect(layout.logLeft).toBeCloseTo(layout.battleLeft + layout.renderedWidth);
    expect(layout.logWidth).toBeCloseTo(layout.battleLeft);
    expect(layout.logWidth / 1180).toBeLessThan(0.2);
    const styles = document.getElementById('steam-deck-battle-layout-style').textContent;
    expect(styles).not.toMatch(/\.battle-log[^{}]*\{[^}]*font-size/s);
  });

  it('sizes from room dimensions rather than control contents', () => {
    document.body.innerHTML = `
      <div id="room-battle-test-1">
        <div class="battle"></div>
        <div class="battle-log"><div class="battle-history">Turn 1</div></div>
        <div class="battle-log-add"></div>
        <div class="battle-controls">
          <div class="controls">
            <div class="movecontrols">
              <div class="moveselect"><button>Attack</button></div>
              <div class="movemenu"><button class="movebutton">Move</button></div>
            </div>
            <div class="switchcontrols">
              <div class="switchselect"><button>Switch</button></div>
              <div class="switchmenu"><button>Pokémon</button></div>
            </div>
          </div>
          <div class="qol-battle-toolbar"><button>Forfeit</button></div>
        </div>
      </div>
    `;
    const room = document.getElementById('room-battle-test-1');
    room.getBoundingClientRect = () => ({ width: 1180, height: 760 });

    const script = loadScript();
    script.updateRoomLayout(room);
    const before = room.style.getPropertyValue('--sd-battle-scale');

    room.querySelector('.controls').innerHTML = '<button>One</button>'.repeat(30);
    script.updateRoomLayout(room);

    expect(room.style.getPropertyValue('--sd-battle-scale')).toBe(before);
    expect(room.style.getPropertyValue('--sd-log-left')).toBe('1116.93px');
    const styles = document.getElementById('steam-deck-battle-layout-style').textContent;
    expect(styles).toContain('width: var(--sd-battle-left, 10%)');
    expect(styles).toContain('.qol-battle-toolbar');
    expect(styles).toContain('display: none !important');
    expect(styles).toContain('.battle-controls .moveselect');
    expect(styles).toMatch(/\.battle-controls \.moveselect,[\s\S]*?display: none !important/);
    expect(styles).toContain('flex-direction: column');
    expect(styles).toContain('clear: both');
  });
});
