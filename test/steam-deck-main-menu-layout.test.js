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
    <div id="header" class="header">
      <div class="tabbar maintabbar">
        <div class="inner">
          <ul><li><a class="roomtab button">Home</a></li></ul>
          <ul><li><a class="roomtab button">Battle</a></li></ul>
        </div>
      </div>
    </div>
    <div class="ps-room scrollable" id="mainmenu"></div>
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

  it('centers the persistent classic-client tab bar at desktop width', () => {
    const { STYLE_ID } = loadScript();
    const styles = document.getElementById(STYLE_ID).textContent;

    expect(styles).toContain('@media (min-width: 640px)');
    expect(styles).toContain('#header .tabbar.maintabbar');
    expect(styles).toContain('margin-left: 165px !important');
    expect(styles).toContain('margin-right: 165px !important');
    expect(styles).not.toContain('#mainmenu >');
  });

  it('centers all tab lists as a flex group without changing page content', () => {
    const { STYLE_ID } = loadScript();
    const styles = document.getElementById(STYLE_ID).textContent;

    expect(styles).toContain('.tabbar.maintabbar > .inner');
    expect(styles).toContain('justify-content: center');
    expect(styles).toContain('display: flex !important');
    expect(styles).toContain('width: 100% !important');
    expect(styles).toContain('.inner > ul');
    expect(styles).toContain('float: none');
    expect(styles).not.toContain('.leftmenu');
  });
});
