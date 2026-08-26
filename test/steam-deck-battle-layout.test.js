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
  it('reserves 25% for native controls and preserves the battlefield at 16:9', () => {
    const script = loadScript();
    const layout = script.calculateLayout(1280, 800);

    expect(layout.battleRegionHeight).toBeCloseTo(600);
    expect(layout.controlsHeight).toBeCloseTo(200);
    expect(layout.renderedWidth).toBeCloseTo(1066.667, 2);
    expect(layout.renderedHeight).toBeCloseTo(600);
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
    expect(document.getElementById('steam-deck-battle-layout-style').textContent)
      .not.toContain('font-size');
  });

  it('sizes from room dimensions rather than control contents', () => {
    document.body.innerHTML = `
      <div id="room-battle-test-1">
        <div class="battle"></div>
        <div class="battle-log"><div class="battle-history">Turn 1</div></div>
        <div class="battle-log-add"></div>
        <div class="battle-controls"><div class="controls"></div></div>
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
    expect(room.style.getPropertyValue('--sd-controls-height')).toBe('190.00px');
    expect(room.style.getPropertyValue('--sd-log-left')).toBe('1096.67px');
  });
});
