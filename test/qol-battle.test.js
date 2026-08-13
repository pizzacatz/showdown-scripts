import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const SCRIPT = fs.readFileSync(path.join(root, 'qol-battle/qol-battle.user.js'), 'utf8');
const FIXTURE_ENDED = fs.readFileSync(path.join(root, 'test/fixtures/battle-ended.html'), 'utf8');
const FIXTURE_ACTIVE = fs.readFileSync(path.join(root, 'test/fixtures/battle-active.html'), 'utf8');

// Loads the userscript fresh into the jsdom page and returns its internals.
function loadScript() {
  (0, eval)(SCRIPT);
  return window.__showdownQoL;
}

beforeEach(() => {
  document.body.innerHTML = '';
  sessionStorage.clear();
  delete window.__showdownQoL;
  delete window.__showdownQoLTestConfig;
  delete window.app;
});

describe('pure helpers', () => {
  it('classifies room IDs', () => {
    const { helpers } = loadScript();
    expect(helpers.isGameRoomId('battle-gen9championsvgc2026regmbbo3-42')).toBe(true);
    expect(helpers.isGameRoomId('game-bestof3-gen9championsvgc2026regmbbo3-42')).toBe(false);
    expect(helpers.isBestOfWrapperId('game-bestof3-gen9championsvgc2026regmbbo3-42')).toBe(true);
    expect(helpers.roomIdFromElement({ id: 'room-battle-x-1' })).toBe('battle-x-1');
    expect(helpers.roomIdFromElement({ id: 'other' })).toBe(null);
  });

  it('emitter delivers events and survives a throwing handler', () => {
    const { helpers } = loadScript();
    const emitter = helpers.createEmitter();
    const seen = [];
    emitter.on('x', () => {
      throw new Error('boom');
    });
    emitter.on('x', (v) => seen.push(v));
    emitter.emit('x', 1);
    expect(seen).toEqual([1]);
  });
});

describe('arm-then-confirm toggle', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('arms on first press and confirms on second press within the window', () => {
    const { helpers } = loadScript();
    const toggle = helpers.createArmToggle({ windowMs: 2500 });
    expect(toggle.press()).toBe('armed');
    expect(toggle.isArmed()).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(toggle.press()).toBe('confirmed');
    expect(toggle.isArmed()).toBe(false);
  });

  it('expires the armed state after the window', () => {
    const { helpers } = loadScript();
    const expired = vi.fn();
    const toggle = helpers.createArmToggle({ windowMs: 2500, onExpire: expired });
    toggle.press();
    vi.advanceTimersByTime(2501);
    expect(toggle.isArmed()).toBe(false);
    expect(expired).toHaveBeenCalledOnce();
    // next press arms again rather than confirming
    expect(toggle.press()).toBe('armed');
  });
});

describe('replay job store', () => {
  function makeStore(qol, opts = {}) {
    return qol.helpers.createReplayJobStore({
      maxRetries: 3,
      storage: sessionStorage,
      storageKey: 'test-replays',
      persistEnabled: true,
      ...opts,
    });
  }

  it('runs upload and download as independent jobs', () => {
    const store = makeStore(loadScript());
    expect(store.beginAttempt('b1', 'upload')).toBe(true);
    store.markFailed('b1', 'upload', 'nope');
    expect(store.beginAttempt('b1', 'download')).toBe(true);
    store.markDone('b1', 'download');
    expect(store.getJob('b1').download.status).toBe('done');
    expect(store.getJob('b1').upload.status).toBe('pending'); // still retryable
    expect(store.isFullyDone('b1')).toBe(false);
  });

  it('refuses attempts while running or done, and after max retries', () => {
    const store = makeStore(loadScript());
    expect(store.beginAttempt('b1', 'upload')).toBe(true);
    expect(store.beginAttempt('b1', 'upload')).toBe(false); // running
    store.markDone('b1', 'upload');
    expect(store.beginAttempt('b1', 'upload')).toBe(false); // done

    for (let i = 0; i < 3; i++) {
      expect(store.beginAttempt('b2', 'upload')).toBe(true);
      store.markFailed('b2', 'upload', `fail ${i}`);
    }
    expect(store.getJob('b2').upload.status).toBe('error');
    expect(store.beginAttempt('b2', 'upload')).toBe(false); // retries exhausted
    store.resetForManualRetry('b2', 'upload');
    expect(store.beginAttempt('b2', 'upload')).toBe(true); // manual retry allowed
  });

  it('persists done-flags across a reload via sessionStorage', () => {
    const qol = loadScript();
    const store = makeStore(qol);
    store.beginAttempt('b1', 'upload');
    store.markDone('b1', 'upload');
    store.beginAttempt('b1', 'download');
    store.markDone('b1', 'download');

    const store2 = makeStore(qol);
    store2.loadPersisted();
    expect(store2.isFullyDone('b1')).toBe(true);
  });
});

describe('waitForElement', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('resolves when the element appears', async () => {
    const { helpers } = loadScript();
    const promise = helpers.waitForElement('.late', { timeoutMs: 1000, intervalMs: 50 });
    const el = document.createElement('div');
    el.className = 'late';
    document.body.appendChild(el);
    await vi.advanceTimersByTimeAsync(60);
    await expect(promise).resolves.toBe(el);
  });

  it('rejects on timeout and stops polling', async () => {
    const { helpers } = loadScript();
    const promise = helpers.waitForElement('.never', { timeoutMs: 500, intervalMs: 50 });
    promise.catch(() => {}); // avoid unhandled rejection warning before assertion
    await vi.advanceTimersByTimeAsync(600);
    await expect(promise).rejects.toThrow('timed out');
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('DOM integration (fixtures, dry-run)', () => {
  // The script evaluates once at load, so dryRun must be set before eval.
  function loadWithFixture(html) {
    document.body.innerHTML = html;
    window.__showdownQoLTestConfig = { dryRun: true };
    return loadScript();
  }

  it('does nothing replay-related for an active battle', () => {
    const qol = loadWithFixture(FIXTURE_ACTIVE);
    qol.core.evaluate();
    expect(qol.core.endedEmitted.size).toBe(0);
    const job = qol.jobStore.getJob('battle-gen9championsvgc2026regmbbo3-5678');
    expect(job.upload.status).toBe('pending');
    expect(job.upload.attempts).toBe(0);
  });

  it('injects the toolbar exactly once across repeated evaluations', () => {
    const qol = loadWithFixture(FIXTURE_ENDED);
    qol.core.evaluate();
    qol.core.evaluate();
    qol.core.evaluate();
    const toolbars = document.querySelectorAll(`.${qol.SELECTORS.toolbarClass}`);
    expect(toolbars.length).toBe(1);
    expect(toolbars[0].querySelectorAll('button[data-qol="forfeit"]').length).toBe(1);
  });

  it('detects battle end from fixture markup and never re-emits', () => {
    const qol = loadWithFixture(FIXTURE_ENDED);
    // The load-time evaluation already detected the ended battle.
    expect([...qol.core.endedEmitted]).toEqual(['battle-gen9championsvgc2026regmbbo3-1234']);
    const ended = vi.fn();
    qol.core.emitter.on('battle:ended', ended);
    qol.core.evaluate();
    qol.core.evaluate(); // repeated mutations must not re-emit
    expect(ended).not.toHaveBeenCalled();
    expect(qol.core.endedEmitted.size).toBe(1);
  });

  it('processes replay jobs once in dry-run and reports status in the toolbar', () => {
    const qol = loadWithFixture(FIXTURE_ENDED);
    qol.core.evaluate();
    const job = qol.jobStore.getJob('battle-gen9championsvgc2026regmbbo3-1234');
    expect(job.upload.status).toBe('done');
    expect(job.download.status).toBe('done');
    expect(job.upload.attempts).toBe(1);
    qol.core.evaluate();
    expect(job.upload.attempts).toBe(1); // no duplicate work
    const status = document.querySelector('span[data-qol="replay-status"]');
    expect(status.textContent).toContain('upload ✓');
    expect(status.textContent).toContain('download ✓');
  });

  it('disables the forfeit button once the battle has ended', () => {
    const qol = loadWithFixture(FIXTURE_ENDED);
    qol.core.evaluate();
    const btn = document.querySelector('button[data-qol="forfeit"]');
    expect(btn.disabled).toBe(true);
  });

  it('skips already-processed battles after a simulated refresh', () => {
    const qol = loadWithFixture(FIXTURE_ENDED);
    qol.core.evaluate();
    expect(qol.jobStore.isFullyDone('battle-gen9championsvgc2026regmbbo3-1234')).toBe(true);

    // Simulate refresh: fresh script instance, same sessionStorage.
    document.body.innerHTML = FIXTURE_ENDED;
    delete window.__showdownQoL;
    const qol2 = loadScript();
    qol2.core.evaluate();
    const job = qol2.jobStore.getJob('battle-gen9championsvgc2026regmbbo3-1234');
    expect(job.upload.attempts).toBe(0); // nothing re-ran
    expect(qol2.jobStore.isFullyDone('battle-gen9championsvgc2026regmbbo3-1234')).toBe(true);
  });

  it('re-injects the toolbar after the client rewrites the controls, keeping state', () => {
    const qol = loadWithFixture(FIXTURE_ACTIVE);
    qol.CONFIG.dryRun = false;
    const send = vi.fn();
    window.app = { rooms: { 'battle-gen9championsvgc2026regmbbo3-5678': { send } } };
    qol.core.evaluate();
    const btn = document.querySelector('button[data-qol="forfeit"]');
    btn.click();
    btn.click(); // confirmed → forfeit sent
    expect(send).toHaveBeenCalledTimes(1);

    // Simulate the client rewriting .battle-controls (wipes the toolbar).
    document.querySelector('.battle-controls').innerHTML = '<div class="controls"></div>';
    qol.core.evaluate();
    const toolbars = document.querySelectorAll(`.${qol.SELECTORS.toolbarClass}`);
    expect(toolbars.length).toBe(1);
    const newBtn = document.querySelector('button[data-qol="forfeit"]');
    expect(newBtn.disabled).toBe(true); // already forfeited: stays disabled
    newBtn.click();
    expect(send).toHaveBeenCalledTimes(1); // no second /forfeit
  });

  it('forfeit send targets the game room via the client API', () => {
    const qol = loadWithFixture(FIXTURE_ACTIVE);
    qol.CONFIG.dryRun = false;
    const send = vi.fn();
    window.app = { rooms: { 'battle-gen9championsvgc2026regmbbo3-5678': { send } } };
    qol.core.evaluate();
    const btn = document.querySelector('button[data-qol="forfeit"]');
    btn.click(); // arm
    expect(send).not.toHaveBeenCalled();
    expect(btn.textContent).toBe('Confirm forfeit?');
    btn.click(); // confirm
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith('/forfeit');
    btn.click(); // double-submit guard
    expect(send).toHaveBeenCalledOnce();
  });
});
