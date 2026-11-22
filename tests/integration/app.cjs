const { app, BrowserWindow } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const assert = require('node:assert/strict');
app.on('window-all-closed', () => {});
const repo = path.resolve(__dirname, '../..');
(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'han1me-app-test-'));
  app.setPath('userData', root);
  let win, server, mediaServer;
  try {
    await app.whenReady();
    const output = path.join(root, 'renderer');
    const { build } = await import('vite');
    await build({ logLevel: 'error', build: { outDir: output } });
    const result = await build({
      configFile: false,
      logLevel: 'error',
      build: {
        write: false,
        lib: {
          entry: repo + '/tests/integration/renderer/components.tsx',
          name: 'Components',
          formats: ['iife'],
        },
      },
      esbuild: { jsx: 'automatic' },
      define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    });
    const componentBundle = (Array.isArray(result) ? result[0] : result).output.find(
      (item) => item.type === 'chunk',
    ).code;
    const mediaRequests = [];
    let failManifest = true;
    mediaServer = http.createServer(async (req, res) => {
      mediaRequests.push({ url: req.url, referer: req.headers.referer });
      res.setHeader('Access-Control-Allow-Origin', '*');
      const file = req.url.split('/').pop();
      if (file === 'broken.m3u8' && failManifest) {
        res.writeHead(503);
        return res.end('retry fixture');
      }
      res.setHeader(
        'Content-Type',
        file.endsWith('.mpegts') ? 'video/mp2t' : 'application/vnd.apple.mpegurl',
      );
      res.end(
        await fs.readFile(
          path.join(repo, 'tests/fixtures/hls', file === 'broken.m3u8' ? 'playlist.m3u8' : file),
        ),
      );
    });
    await new Promise((resolve) => mediaServer.listen(0, '127.0.0.1', resolve));
    const mediaBase = 'http://127.0.0.1:' + mediaServer.address().port;
    let commentRequests = 0;
    let remoteRequests = 0;
    let videoRequests = 0;
    let videoGate = Promise.resolve();
    let failHome = false;
    const html = await fs.readFile(path.join(output, 'index.html'), 'utf8');
    const home = await fs.readFile(repo + '/tests/fixtures/home.html', 'utf8');
    const video = await fs.readFile(repo + '/tests/fixtures/video.html', 'utf8');
    const homeCookies = [];
    server = http.createServer(async (req, res) => {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/components') {
        res.setHeader('Content-Type', 'text/html');
        return res.end('<div id="root"></div>');
      }
      if (url.pathname === '/picture.svg') {
        res.setHeader('Content-Type', 'image/svg+xml');
        return res.end(
          '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#6d3f90"/><circle cx="300" cy="300" r="100" fill="white"/></svg>',
        );
      }
      if (url.pathname === '/app') {
        res.setHeader('Content-Type', 'text/html');
        return res.end(html);
      }
      if (url.pathname.startsWith('/assets/')) {
        const p = path.join(output, url.pathname);
        res.setHeader(
          'Content-Type',
          p.endsWith('.js')
            ? 'application/javascript'
            : p.endsWith('.css')
              ? 'text/css'
              : 'image/png',
        );
        return res.end(await fs.readFile(p));
      }
      if (url.pathname === '/') {
        homeCookies.push(req.headers.cookie || '');
        if (failHome) {
          res.writeHead(503);
          return res.end('Offline fixture');
        }
        return res.end(
          home +
            '<a id="user-modal-trigger" href="/user/7"></a><meta name="csrf-token" content="token">',
        );
      }
      if (url.pathname === '/user/7/edit')
        return res.end(
          '<input name="name" value="Fixture User"><input name="email" value="fixture@example.test"><meta name="csrf-token" content="token">',
        );
      if (url.pathname === '/watch') {
        videoRequests++;
        await videoGate;
        return res.end(
          video
            .replace('https://vdownload.hembed.com/media.mp4', '/sample.webm')
            .replace('video/mp4', 'video/webm'),
        );
      }
      if (url.pathname === '/sample.webm') {
        const bytes = await fs.readFile(repo + '/tests/fixtures/playback.webm');
        res.setHeader('Content-Type', 'video/webm');
        res.setHeader('Accept-Ranges', 'bytes');
        const range = /bytes=(\d+)-(\d*)/.exec(req.headers.range ?? '');
        const start = range ? Number(range[1]) : 0;
        const end = range?.[2] ? Number(range[2]) : bytes.length - 1;
        res.setHeader('Content-Length', end - start + 1);
        if (range) {
          res.statusCode = 206;
          res.setHeader('Content-Range', `bytes ${start}-${end}/${bytes.length}`);
        }
        return res.end(bytes.subarray(start, end + 1));
      }
      if (url.pathname === '/loadComment') {
        commentRequests++;
        return res.end(JSON.stringify({ comments: '' }));
      }
      if (url.pathname === '/loadReplies') return res.end(JSON.stringify({ replies: '' }));
      if (url.pathname === '/user/7/histories')
        return res.end(
          '<div class="user-tab-item-wrapper"><a href="/watch?v=123">' +
            '<img src="/history-cover.jpg"><span class="title">History fixture</span>' +
            '</a><span class="duration">01:30</span></div>',
        );
      if (url.pathname === '/search')
        return res.end(
          '<div id="home-rows-wrapper">' +
            [1, 2, 3]
              .map(
                (id) =>
                  `<a href="/watch?v=${id}"><div class="video-card-inner">` +
                  `<img src="/preview-${id}.jpg"><span class="title">Preview ${id}</span>` +
                  '</div></a>',
              )
              .join('') +
            '</div>',
        );
      if (url.pathname.startsWith('/user/') || url.pathname === '/subscriptions') {
        if (url.pathname.endsWith('/saves')) remoteRequests++;
        return res.end('<html></html>');
      }
      if (/\.(jpg|png)$/.test(url.pathname)) {
        res.setHeader('Content-Type', 'image/png');
        return res.end(
          Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5V8AAAAASUVORK5CYII=',
            'base64',
          ),
        );
      }
      res.writeHead(404);
      res.end('missing');
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const base = 'http://127.0.0.1:' + server.address().port;
    await fs.writeFile(
      root + '/setting.json',
      JSON.stringify({
        baseUrl: base,
        language: 'english',
        autoPlayOnOpen: false,
        webDavEnabled: false,
      }),
    );
    await fs.writeFile(
      root + '/accounts.json',
      JSON.stringify({
        '127.0.0.1': {
          activeId: '7',
          accounts: [{ id: '7', name: 'Fixture User', cookie: 'auth=fixture' }],
        },
      }),
    );
    const ipc = require(repo + '/electron/ipc');
    ipc.configureSession();
    await ipc.registerIpc();
    win = new BrowserWindow({
      show: false,
      width: 1280,
      height: 900,
      webPreferences: { preload: repo + '/electron/preload.js' },
    });
    require(repo + '/electron/http').installRequestHeaders(
      win.webContents.session,
      win.webContents,
    );
    const errors = [];
    win.webContents.on('console-message', (details) => {
      if (details.level === 'error') errors.push(details.message);
    });
    await win.loadURL(base + '/app');
    const evaluate = (s) =>
      win.webContents.executeJavaScript(s).catch((error) => {
        console.error('Renderer script failed:', s, errors);
        throw error;
      });
    const waitFor = async (s) => {
      for (let i = 0; i < 100; i++) {
        if (await evaluate(`(async () => Boolean(${s}))()`)) return;
        await new Promise((r) => setTimeout(r, 100));
      }
      console.error(await evaluate('document.body.innerText'));
      console.error(
        await evaluate(
          `JSON.stringify((()=>{const v=document.querySelector('video');return v && {time:v.currentTime, duration:v.duration, src:v.currentSrc, paused:v.paused, error:v.error?.message}})())`,
        ),
      );
      throw Error('Timed out ' + s);
    };
    await waitFor('document.body.innerText.includes("Sample title")');
    assert(homeCookies.length > 0);
    assert(homeCookies.every((c) => c.includes('auth=fixture')));
    console.log('PASS native renderer restores settings and account cookies before home requests');
    await evaluate('location.hash="/library"');
    await waitFor(
      "Array.from(document.querySelectorAll('[role=\"tab\"]')).some(e=>e.textContent==='Favorite')",
    );
    await evaluate(
      "Array.from(document.querySelectorAll('[role=\"tab\"]')).find(e=>e.textContent==='Favorite').click()",
    );
    await waitFor(
      'Array.from(document.querySelectorAll(\'[role="tab"][aria-selected="true"]\')).some(e=>e.checkVisibility() && e.textContent===\'Favorite\')',
    );
    await evaluate('location.hash="/settings"');
    await waitFor('document.body.innerText.includes("Theme")');
    await evaluate(`Array.from(document.querySelectorAll('.MuiInputLabel-root'))
      .find(e => e.textContent === 'Theme').parentElement.querySelector('[role="combobox"]')
      .dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))`);
    await waitFor('document.querySelector(\'[role="option"][data-value="dark"]\')');
    await evaluate('document.querySelector(\'[role="option"][data-value="dark"]\').click()');
    await waitFor('getComputedStyle(document.body).colorScheme === "dark"');
    await evaluate('location.hash="/library"');
    await waitFor(
      'Array.from(document.querySelectorAll(\'[role="tab"][aria-selected="true"]\')).some(e=>e.checkVisibility() && e.textContent===\'Favorite\')',
    );
    assert.equal(JSON.parse(await fs.readFile(root + '/setting.json', 'utf8')).themeMode, 'dark');
    console.log('PASS library branch retains its selected tab across navigation');
    await evaluate('document.querySelector(\'button[aria-label="Back"]\').click()');
    await waitFor('location.hash === "#/settings" && document.body.innerText.includes("Theme")');
    await evaluate('location.hash="/settings/logs"');
    await waitFor('document.body.innerText.includes("Diagnostic Log")');
    await evaluate('document.querySelector(\'button[aria-label="Back"]\').click()');
    await waitFor('location.hash === "#/" && document.body.innerText.includes("Sample title")');
    console.log('PASS unified settings persist and branch/deep-link back navigation stays intact');
    await evaluate('location.hash="/library/history"');
    await waitFor('document.querySelector(\'img[alt="History fixture"]\')?.checkVisibility()');
    assert.equal(
      await evaluate('document.querySelector(\'img[alt="History fixture"]\').closest("a").hash'),
      '#/video/123',
    );
    await evaluate(
      'document.querySelector(\'input[aria-label="Select History fixture"]\').click()',
    );
    assert.equal(
      await evaluate(
        'document.querySelector(\'input[aria-label="Select History fixture"]\').checked',
      ),
      true,
    );
    console.log('PASS account history renders linked covers and retains selection');
    await evaluate('location.hash="/previews"');
    await waitFor('document.querySelector(\'img[alt="Preview 3"]\')?.complete');
    const previewImages = await evaluate(`Array.from(document.querySelectorAll('img'))
      .filter(img => img.checkVisibility() && img.src.includes('/preview-'))
      .map(img => {
        const rect = img.getBoundingClientRect();
        return { width: rect.width, height: rect.height, top: rect.top,
          link: img.closest('a')?.hash };
      })`);
    assert.equal(previewImages.length, 3, 'First cover is not duplicated as a banner');
    assert(previewImages.every((image) => image.width >= 150 && image.width <= 180));
    assert(previewImages.every((image) => Math.abs(image.height / image.width - 1.5) < 0.01));
    assert(previewImages.every((image) => image.top === previewImages[0].top));
    assert.equal(previewImages[0].link, '#/video/1');
    console.log('PASS previews use compact portrait cards without an oversized header image');
    await evaluate('location.hash="/video/123"');
    await waitFor('document.querySelector("video")?.readyState>=2');
    const layoutColumns =
      'getComputedStyle(document.querySelector("main aside").parentElement)' +
      '.gridTemplateColumns.split(" ").length';
    const sidebarColumns =
      'getComputedStyle(document.querySelector("main aside"))' +
      '.gridTemplateColumns.split(" ").length';
    assert.equal(await evaluate(layoutColumns), 2);
    for (const [width, sidebarCount] of [
      [1000, 2],
      [620, 1],
    ]) {
      win.webContents.enableDeviceEmulation({
        screenPosition: 'desktop',
        screenSize: { width, height: 900 },
        viewPosition: { x: 0, y: 0 },
        deviceScaleFactor: 0,
        viewSize: { width, height: 900 },
        scale: 1,
      });
      await waitFor('innerWidth === ' + width);
      await waitFor(layoutColumns + ' === 1 && ' + sidebarColumns + ' === ' + sidebarCount);
    }
    assert.equal(
      await evaluate('getComputedStyle(document.querySelector("video")).objectFit'),
      'contain',
    );
    assert.equal(
      await evaluate('getComputedStyle(document.querySelector("video")).aspectRatio'),
      '16 / 9',
    );
    win.webContents.disableDeviceEmulation();
    await waitFor(layoutColumns + ' === 2');
    console.log('PASS migrated styles preserve video sizing and 1000px/620px responsive layouts');
    assert.equal(await evaluate('document.querySelector("video").paused'), true);
    await evaluate('document.querySelector("video").play()');
    await waitFor('document.querySelector("video").currentTime>0.1');
    await evaluate('document.querySelector("video").pause()');
    console.log('PASS native video respects autoplay setting and advances after play');
    await evaluate(`
      window.windowModeVideo = document.querySelector('video');
      window.windowModeLoads = 0;
      window.windowModeVideo.addEventListener('loadstart', () => window.windowModeLoads++);
      window.windowModeVideo.loop = true;
      window.windowModeVideo.play();
      [...document.querySelectorAll('button')].find(b => b.textContent === 'Fill window').click();
    `);
    await waitFor('document.body.innerText.includes("Exit window mode")');
    const windowModeBounds = await evaluate(`(() => {
      const rect = window.windowModeVideo.parentElement.getBoundingClientRect();
      return [rect.x, rect.y, rect.width, rect.height, innerWidth, innerHeight];
    })()`);
    assert.deepEqual(windowModeBounds.slice(0, 2), [0, 0]);
    assert.deepEqual(windowModeBounds.slice(2, 4), windowModeBounds.slice(4));
    assert.equal(await evaluate('document.fullscreenElement === null'), true);
    assert.equal(await evaluate('window.windowModeVideo.paused'), false);
    assert.equal(await evaluate('document.documentElement.style.overflow'), 'hidden');
    await evaluate('document.activeElement.blur()');
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
    win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
    await waitFor('!document.body.innerText.includes("Exit window mode")');
    assert.equal(
      await evaluate('document.querySelector("video") === window.windowModeVideo'),
      true,
    );
    assert.equal(await evaluate('window.windowModeVideo.paused'), false);
    assert.equal(await evaluate('window.windowModeLoads'), 0);
    assert.notEqual(await evaluate('document.documentElement.style.overflow'), 'hidden');
    await evaluate('window.windowModeVideo.pause()');
    console.log('PASS window mode fills app content, preserves playback and exits with Escape');
    await win.loadURL(base + '/components#/video/test-player');
    await evaluate(componentBundle + '\nvoid 0;');
    const homeCache = JSON.parse(await fs.readFile(root + '/home_cache.json', 'utf8'));
    homeCache[`home_feed_v2:${base}:anonymous`] = homeCache[`home_feed_v2:${base}:7`];
    await fs.writeFile(root + '/home_cache.json', JSON.stringify(homeCache));
    failHome = true;
    await evaluate('Components.home()');
    await waitFor('document.body.innerText.includes("Showing the last cached content.")');
    assert(await evaluate('document.body.innerText.includes("Sample title")'));
    const beforeRetry = homeCookies.length;
    failHome = false;
    await evaluate(
      'Array.from(document.querySelectorAll("button")).find(e=>e.textContent==="Retry").click()',
    );
    await waitFor('Components.isFetching()===0');
    assert.equal(homeCookies.length, beforeRetry + 1);
    assert.equal(
      await evaluate('document.body.innerText.includes("Showing the last cached content.")'),
      false,
    );
    console.log('PASS persisted home cache survives network failure and native query retry');
    let releaseVideo;
    videoGate = new Promise((resolve) => {
      releaseVideo = resolve;
    });
    const beforeVideo = videoRequests;
    await evaluate('Components.videoDetail()');
    await waitFor('Components.isFetching()>0');
    await evaluate('window.sharedVideo=Components.fetchVideo(); void 0;');
    releaseVideo();
    await evaluate('window.sharedVideo');
    await waitFor('document.body.innerText.includes("Sample title")');
    assert.equal(videoRequests, beforeVideo + 1);
    await evaluate('Components.renameVideo()');
    await waitFor('document.body.innerText.includes("Shared query updated")');
    console.log('PASS component and imperative queries share one request and observable result');
    await evaluate('Components.player(' + JSON.stringify(mediaBase) + ')');
    await waitFor('document.querySelector("video")?.readyState>=2');
    assert.equal(await evaluate('document.querySelector("video").paused'), true);
    await evaluate('document.querySelector("video").play()');
    await waitFor('document.querySelector("video").currentTime>0.4');
    await evaluate('document.querySelector("video").pause()');
    assert(mediaRequests.some((request) => request.url.endsWith('.mpegts')));
    assert(mediaRequests.every((request) => request.referer === base + '/watch?v=test-player'));
    const position = await evaluate('document.querySelector("video").currentTime');
    await evaluate(
      `document.querySelector('[role="combobox"]').dispatchEvent(new MouseEvent("mousedown",{bubbles:true}))`,
    );
    await waitFor(`document.querySelector('[role="option"]')`);
    await evaluate(
      `Array.from(document.querySelectorAll('[role="option"]')).find(e=>e.textContent==="480").click()`,
    );
    await waitFor(
      'document.querySelector("video")?.currentSrc.includes("sample.webm") && document.querySelector("video").readyState>=2',
    );
    await waitFor('document.querySelector("video").currentTime>0.3');
    assert(
      Math.abs((await evaluate('document.querySelector("video").currentTime')) - position) < 0.2,
    );
    await evaluate('Components.empty()');
    await waitFor('!document.querySelector("video")');
    await evaluate('Components.player(' + JSON.stringify(mediaBase) + ', true)');
    await waitFor(
      'Array.from(document.querySelectorAll("button")).some(e=>e.textContent==="重试播放" || e.textContent==="Retry playback")',
    );
    failManifest = false;
    await evaluate(
      'Array.from(document.querySelectorAll("button")).find(e=>e.textContent==="重试播放" || e.textContent==="Retry playback").click()',
    );
    await waitFor('document.querySelector("video")?.readyState>=2');
    await evaluate('document.querySelector("video").play()');
    await waitFor('document.querySelector("video").currentTime>0.1');
    await evaluate('Components.empty()');
    await waitFor('!document.querySelector("video")');
    console.log(
      'PASS HLS cross-origin playback, Referer, source continuity, failure retry and unmount',
    );

    await evaluate('Components.favorites()');
    await waitFor('document.querySelectorAll("[data-favorites]").length===2');
    await evaluate('Components.addFavorite()');
    await waitFor(
      'Array.from(document.querySelectorAll("[data-favorites]")).every(e=>e.textContent==="1")',
    );
    await evaluate('Components.comments("1")');
    await waitFor('document.body.innerText.includes("No comments")');
    const firstCount = commentRequests;
    await evaluate('Components.empty()');
    await waitFor('document.body.innerText==="Empty"');
    await evaluate('Components.comments("1")');
    await waitFor('document.body.innerText.includes("No comments")');
    assert.equal(commentRequests, firstCount);
    await evaluate('Components.comments("1", "8")');
    await waitFor('document.body.innerText.includes("No comments")');
    assert.equal(commentRequests, firstCount + 1);
    await evaluate('Components.empty()');
    await waitFor('document.body.innerText==="Empty"');
    await evaluate('Components.expireComments(); Components.comments("1", "8")');
    await waitFor('Components.isFetching()===0');
    await waitFor('document.body.innerText.includes("No comments")');
    assert.equal(commentRequests, firstCount + 2);
    console.log(
      'PASS Query library subscribers, comment cache reuse, account isolation and expiration',
    );

    await evaluate('Components.empty()');
    await waitFor('document.body.innerText==="Empty"');
    await evaluate('Components.clearRequests(); Components.comments("1", "8")');
    await waitFor('document.body.innerText.includes("No comments")');
    assert.equal(commentRequests, firstCount + 3);
    await evaluate('Components.comments("remote", "7", true)');
    await waitFor('document.body.innerText.includes("Remote ready")');
    const remoteCount = remoteRequests;
    await evaluate('Components.empty()');
    await waitFor('document.body.innerText==="Empty"');
    await evaluate('Components.comments("remote", "7", true)');
    await waitFor('document.body.innerText.includes("Remote ready")');
    assert.equal(remoteRequests, remoteCount);
    await evaluate('Components.invalidateRemoteLibrary()');
    await waitFor('document.body.innerText.includes("Remote ready")');
    assert.equal(remoteRequests, remoteCount + 1);
    console.log('PASS session reset and remote-library cache invalidation');

    await evaluate('Components.gallery()');
    await evaluate('document.querySelector("button").click()');
    await waitFor(
      'document.querySelector(".react-transform-wrapper")?.getBoundingClientRect().width>100',
    );
    const transformSelector = '.react-transform-component';
    const scale =
      'new DOMMatrix(getComputedStyle(document.querySelector(' +
      JSON.stringify(transformSelector) +
      ')).transform).a';
    const wrapper = await evaluate(
      'JSON.stringify((()=>{const r=document.querySelector(".react-transform-wrapper").getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})())',
    );
    const center = JSON.parse(wrapper);
    win.webContents.sendInputEvent({ type: 'mouseWheel', ...center, deltaY: 120, canScroll: true });
    await waitFor(scale + '>1.1');
    const before = await evaluate(
      'getComputedStyle(document.querySelector(".react-transform-component")).transform',
    );
    win.webContents.sendInputEvent({ type: 'mouseDown', ...center, button: 'left', clickCount: 1 });
    win.webContents.sendInputEvent({
      type: 'mouseMove',
      x: center.x + 80,
      y: center.y,
      modifiers: ['leftButtonDown'],
      movementX: 80,
      movementY: 0,
    });
    win.webContents.sendInputEvent({
      type: 'mouseUp',
      x: center.x + 80,
      y: center.y,
      button: 'left',
      clickCount: 1,
    });
    await waitFor(
      'getComputedStyle(document.querySelector(".react-transform-component")).transform!==' +
        JSON.stringify(before),
    );
    await evaluate(
      'Array.from(document.querySelectorAll("button")).find(e=>e.textContent==="Next image").click()',
    );
    await waitFor(scale + '===1');
    win.webContents.sendInputEvent({ type: 'mouseDown', ...center, button: 'left', clickCount: 2 });
    win.webContents.sendInputEvent({ type: 'mouseUp', ...center, button: 'left', clickCount: 2 });
    await waitFor(scale + '>1.1');
    await evaluate('Components.reader()');
    await waitFor('document.body.innerText.includes("1/2")');
    await evaluate(
      'Array.from(document.querySelectorAll("button")).find(e=>e.textContent==="放大" || e.textContent==="Zoom in").click()',
    );
    await waitFor(scale + '>1.1');
    await evaluate(
      'Array.from(document.querySelectorAll("button")).find(e=>e.textContent==="Next page").click()',
    );
    await waitFor('document.body.innerText.includes("2/2")');
    await waitFor(scale + '===1');
    await waitFor('(await window.electron.store.read("comic_reader.json")).progress?.reader === 1');
    const reader = JSON.parse(await fs.readFile(root + '/comic_reader.json', 'utf8'));
    assert.equal(reader.progress.reader, 1);
    await evaluate(
      'document.querySelector("[role=combobox]").dispatchEvent(new MouseEvent("mousedown",{bubbles:true}))',
    );
    await waitFor('document.querySelector("[role=option]")');
    await evaluate(
      'Array.from(document.querySelectorAll("[role=option]")).find(e=>e.textContent==="Long strip").click()',
    );
    await waitFor('document.querySelectorAll(".react-transform-component").length===2');
    await evaluate(
      'Array.from(document.querySelectorAll("button")).find(e=>e.textContent==="Zoom in").click()',
    );
    await waitFor(scale + '>1.1');
    assert.equal(
      await evaluate(
        'new DOMMatrix(getComputedStyle(document.querySelectorAll(".react-transform-component")[1]).transform).a',
      ),
      1,
    );
    console.log('PASS image wheel zoom, drag pan, image/page reset and comic progress');
    assert.equal(
      errors.filter((e) => !e.includes('Failed to load resource')).length,
      0,
      errors.join('\n'),
    );
  } finally {
    win?.destroy();
    server?.close();
    mediaServer?.close();
    await fs.rm(root, { recursive: true, force: true });
  }
})()
  .then(() => app.exit(0))
  .catch((e) => {
    console.error(e);
    app.exit(1);
  });
