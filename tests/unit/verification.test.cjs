const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup({ loadError, initialClearance } = {}) {
  const windows = [];
  const timers = new Set();
  let clearance = initialClearance;
  let probe = async () => ({ status: 403, headers: new Map(), text: async () => 'challenge-form' });
  const browserSession = {
    cookies: {
      async get(filter) {
        assert.equal(filter.url, 'https://example.com');
        assert.equal(filter.name, 'cf_clearance');
        return clearance ? [{ value: clearance }] : [];
      },
    },
    fetch: (url, options) => {
      assert.equal(url, 'https://example.com');
      assert.equal(options.credentials, 'include');
      return probe();
    },
  };
  class FakeWindow extends EventEmitter {
    webContents = Object.assign(new EventEmitter(), { getURL: () => this.url });
    destroyed = false;
    loadURL(url) {
      this.url = url;
      windows.push(this);
      return loadError ? Promise.reject(loadError) : Promise.resolve();
    }
    isDestroyed() {
      return this.destroyed;
    }
    close() {
      assert.equal(this.destroyed, false);
      this.destroyed = true;
      this.emit('closed');
    }
  }
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../electron/account.js'), 'utf8'), {
    module,
    require: () => ({ BrowserWindow: FakeWindow, session: { defaultSession: browserSession } }),
    setInterval(callback, milliseconds) {
      assert.equal(milliseconds, 700);
      timers.add(callback);
      return callback;
    },
    clearInterval: (timer) => timers.delete(timer),
  });
  return {
    ...module.exports,
    windows,
    timers,
    setClearance(value) {
      clearance = value;
    },
    setProbe(callback) {
      probe = callback;
    },
    async poll() {
      await Promise.all([...timers].map((callback) => callback()));
    },
  };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

test('Verification loads directly and manual close completes even after ERR_FAILED', async () => {
  const app = setup({ loadError: new Error('ERR_FAILED (-2)') });
  let finished = false;
  const result = app.openVerification('https://example.com').then(() => {
    finished = true;
  });
  await settle();
  assert.equal(app.windows[0].url, 'https://example.com');
  await app.poll();
  assert.equal(finished, false);
  app.windows[0].close();
  await result;
  assert.equal(finished, true);
  assert.equal(app.timers.size, 0);
});

test('New clearance closes automatically despite the initial navigation failure', async () => {
  const app = setup({ loadError: new Error('ERR_FAILED (-2)') });
  const result = app.openVerification('https://example.com');
  await settle();
  app.setClearance('verified');
  await app.poll();
  await result;
  assert.equal(app.windows[0].destroyed, true);
  assert.equal(app.timers.size, 0);
});

test('Existing clearance must pass the request probe before automatic close', async () => {
  const app = setup({ initialClearance: 'old' });
  const result = app.openVerification('https://example.com');
  await settle();
  await app.poll();
  assert.equal(app.windows[0].destroyed, false);
  app.setProbe(async () => {
    throw new Error('network failure');
  });
  await app.poll();
  assert.equal(app.windows[0].destroyed, false);
  app.setProbe(async () => ({
    status: 200,
    headers: new Map(),
    text: async () => '<main>site</main>',
  }));
  app.windows[0].webContents.emit('did-finish-load');
  await result;
  assert.equal(app.windows[0].destroyed, true);
});

test('Manual close completes immediately while a probe is pending', async () => {
  const app = setup({ initialClearance: 'old' });
  let finishProbe;
  app.setProbe(
    () =>
      new Promise((resolve) => {
        finishProbe = resolve;
      }),
  );
  const result = app.openVerification('https://example.com');
  await settle();
  const pending = app.poll();
  await settle();
  app.windows[0].close();
  await result;
  assert.equal(app.timers.size, 0);
  finishProbe({ status: 200, headers: new Map(), text: async () => '<main>site</main>' });
  await pending;
});

test('An ordinary HTTP error is not a Cloudflare challenge, matching the original probe', async () => {
  const app = setup({ initialClearance: 'old' });
  app.setProbe(async () => ({ status: 404, headers: new Map(), text: async () => 'Not found' }));
  const result = app.openVerification('https://example.com');
  await settle();
  await app.poll();
  await result;
  assert.equal(app.windows[0].destroyed, true);
});

test('A 403 challenge body keeps the verification window open without a cf-mitigated header', async () => {
  const app = setup({ initialClearance: 'old' });
  app.setProbe(async () => ({
    status: 403,
    headers: new Map(),
    text: async () => 'Just a moment',
  }));
  const result = app.openVerification('https://example.com');
  await settle();
  await app.poll();
  assert.equal(app.windows[0].destroyed, false);
  app.windows[0].close();
  await result;
});
