import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const SCRIPT = fs.readFileSync(
  path.join(root, 'steam-deck-main-menu-layout/steam-deck-main-menu-layout.user.js'),
  'utf8'
);

function loadScript() {
  (0, eval)(SCRIPT);
  return window.__steamDeckMainMenuLayout;
}

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = `
    <div class="ps-room scrollable" id="mainmenu">
      <div class="mainmenuwrapper">
        <div class="leftmenu">
          <div class="activitymenu"><div class="pmbox">News</div></div>
          <div class="mainmenu"><button>Teambuilder</button></div>
        </div>
        <div class="rightmenu"><button>Join chat</button></div>
      </div>
    </div>
    <div class="ps-room" id="room-battle-test"><div class="leftmenu"></div></div>
  `;
  delete window.__steamDeckMainMenuLayout;
});

describe('Steam Deck main-menu layout', () => {
  it('injects one stable stylesheet across repeated evaluations', () => {
    const first = loadScript();
    const second = loadScript();

    expect(first.STYLE_ID).toBe('steam-deck-main-menu-layout-style');
    expect(second.STYLE_ID).toBe(first.STYLE_ID);
    expect(document.querySelectorAll(`#${first.STYLE_ID}`)).toHaveLength(1);
  });

  it('centers only the classic main-menu navigation at desktop width', () => {
    const { STYLE_ID } = loadScript();
    const styles = document.getElementById(STYLE_ID).textContent;

    expect(styles).toContain('@media (min-width: 896px)');
    expect(styles).toContain('#mainmenu > .mainmenuwrapper > .leftmenu');
    expect(styles).toContain('margin-left: auto !important');
    expect(styles).toContain('margin-right: auto !important');
    expect(styles).not.toContain('#room-battle-test');
  });

  it('moves auxiliary panels into normal flow to prevent overlap', () => {
    const { STYLE_ID } = loadScript();
    const styles = document.getElementById(STYLE_ID).textContent;

    expect(styles).toContain('.leftmenu > .activitymenu');
    expect(styles).toContain('.mainmenuwrapper > .rightmenu');
    expect(styles.match(/position: static !important/g)).toHaveLength(2);
  });
});
