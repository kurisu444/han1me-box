const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { mediaReferer } = require('../../dist-electron/http');

test('Media Referer preserves the site, mirror path and root-only mirror settings', () => {
  assert.equal(
    mediaReferer({}, 'http://localhost:5173/#/video/123'),
    'https://hanime1.me/watch?v=123',
  );
  const mirror = {
    useCustomMirrorSite: true,
    customMirrorSite: 'https://example.com/mirror/',
    appendCustomMirrorPath: true,
  };
  assert.equal(
    mediaReferer(mirror, 'file:///app/index.html#/video/a%2Fb'),
    'https://example.com/mirror/watch?v=a%2Fb',
  );
  assert.equal(
    mediaReferer({ ...mirror, appendCustomMirrorPath: false }, 'file:///app/index.html#/video/123'),
    'https://example.com/watch?v=123',
  );
});

function setup() {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../dist-electron/http.js'), 'utf8'), {
    module,
    exports: module.exports,
    URL,
    require: () => ({ getSettings: () => ({ baseUrl: 'https://example.com' }) }),
  });
  let handler;
  const reads = [];
  const session = {
    cookies: {
      async get({ url, name }) {
        reads.push({ url, name });
        return url.startsWith('https://example.com/') ? [{ value: 'verified' }] : [];
      },
    },
    webRequest: {
      onBeforeSendHeaders(listener) {
        handler = listener;
      },
    },
  };
  module.exports.installRequestHeaders(
    session,
    {
      id: 1,
      getURL: () => 'http://localhost:5173/#/video/123',
    },
    () => ({ baseUrl: 'https://example.com' }),
  );
  return {
    reads,
    async headers(details) {
      let result;
      await handler(details, (response) => {
        result = response.requestHeaders;
      });
      return result;
    },
  };
}

test('Main requests include clearance missing from Chromium automatic cookies', async () => {
  const app = setup();
  const headers = await app.headers({
    url: 'https://example.com/',
    requestHeaders: { Cookie: 'session=present' },
  });
  assert.equal(headers.Cookie, 'session=present; cf_clearance=verified');
  assert.deepEqual(app.reads, [{ url: 'https://example.com/', name: 'cf_clearance' }]);
});

test('Clearance is read for each request URL and existing clearance is replaced once', async () => {
  const app = setup();
  const headers = await app.headers({
    url: 'https://example.com/watch?v=1',
    requestHeaders: { cookie: 'cf_clearance=old; session=present' },
  });
  assert.equal(headers.cookie, 'session=present; cf_clearance=verified');
  const redirected = await app.headers({ url: 'https://other.example/', requestHeaders: {} });
  assert.equal(redirected.Cookie, undefined);
  assert.equal(app.reads[1].url, 'https://other.example/');
});

test('Renderer media keeps Referer handling without reading verification cookies', async () => {
  const app = setup();
  const headers = await app.headers({
    url: 'https://cdn.example/video.mp4',
    webContents: {},
    webContentsId: 1,
    resourceType: 'media',
    requestHeaders: { referer: 'http://localhost:5173' },
  });
  assert.equal(headers.Referer, 'https://example.com/watch?v=123');
  assert.equal(headers.referer, undefined);
  assert.equal(app.reads.length, 0);
});
