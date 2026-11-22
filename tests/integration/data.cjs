const { app, BrowserWindow, session, dialog } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const assert = require('node:assert/strict');
const { registerIpc, getSettings } = require('../../dist-electron/ipc');
const {
  configureUserAgent,
  installRequestHeaders,
  request: fetchHttp,
} = require('../../dist-electron/http');
app.on('window-all-closed', () => {});
(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'han1me-integration-'));
  app.setPath('userData', root);
  let server, window;
  try {
    await app.whenReady();
    const userAgent = configureUserAgent();
    assert.equal(app.userAgentFallback, userAgent);
    assert.doesNotMatch(userAgent, /Electron\/|han1me-box\//);
    assert.match(userAgent, new RegExp(`Chrome/${process.versions.chrome.replaceAll('.', '\\.')}`));
    await fs.writeFile(
      path.join(root, 'setting.json'),
      JSON.stringify({ baseUrl: 'https://example.com' }),
    );
    await registerIpc();
    assert.equal(getSettings().baseUrl, 'https://example.com');
    console.log('PASS Session UA and settings initialized from disk');
    const fixtures = Object.fromEntries(
      await Promise.all(
        ['home', 'video', 'comments', 'replies'].map(async (name) => [
          name,
          await fs.readFile(path.join(__dirname, '../fixtures', name + '.html'), 'utf8'),
        ]),
      ),
    );
    const { build } = await import('vite');
    const built = await build({
      configFile: false,
      logLevel: 'error',
      define: { 'process.env.NODE_ENV': JSON.stringify('production') },
      build: {
        write: false,
        minify: false,
        lib: {
          entry: path.join(__dirname, 'renderer/features.ts'),
          formats: ['iife'],
          name: 'Checks',
        },
      },
    });
    const script = built[0].output.find((item) => item.type === 'chunk' && item.isEntry).code;
    const captured = [];
    const getCounts = {};
    let likeAttempts = 0;
    const card = (id) =>
      `<div class="user-tab-item-wrapper"><a href="/watch?v=${id}"></a><img src="/cover.jpg"><div class="title">Video ${id}</div></div>`;
    const comicCard =
      '<a href="/comic/88"><img src="/cover.jpg"><span class="comic-rows-videos-title">Comic</span></a>';
    server = http.createServer(async (request, response) => {
      const url = new URL(request.url, 'http://localhost');
      let pathname = url.pathname;
      if (pathname.startsWith('/external/')) pathname = pathname.replace(/^\/external\/[^/]+/, '');
      if (request.method !== 'GET') {
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        const text = Buffer.concat(chunks).toString();
        const body = request.headers['content-type']?.includes('application/json')
          ? JSON.parse(text)
          : Object.fromEntries(new URLSearchParams(text));
        captured.push({
          path: pathname,
          method: request.method,
          body,
          authorization: request.headers.authorization,
        });
        if (pathname === '/like' && likeAttempts++ === 0) {
          response.writeHead(419);
          return response.end('expired');
        }
        if (pathname.includes('GetchuSearchAjax'))
          return response.end(
            '<div class="item-series-content"><a href="/item/556/"><img alt="Series" src="/cover.jpg"></a></div>',
          );
        return response.end(JSON.stringify({ success: true }));
      }
      getCounts[url.pathname] = (getCounts[url.pathname] ?? 0) + 1;
      if (pathname === '/request-counts') return response.end(JSON.stringify(getCounts));
      if (pathname === '/checks.js') {
        response.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        return response.end(script);
      }
      if (pathname === '/test')
        return response.end(
          '<html><meta charset="utf-8"><body>Integration checks<script src="/checks.js"></script></body></html>',
        );
      if (pathname === '/captured') return response.end(JSON.stringify(captured));
      if (pathname === '/echo')
        return response.end(
          JSON.stringify({
            ua: request.headers['user-agent'],
            cookie: request.headers.cookie ?? '',
          }),
        );
      if (pathname === '/cookie') {
        response.setHeader('Set-Cookie', 'fixture=present; Path=/; HttpOnly');
        return response.end('ok');
      }
      if (pathname === '/redirect') {
        response.writeHead(302, { Location: '/home/' });
        return response.end();
      }
      if (pathname === '/redirect-host') {
        response.writeHead(302, { Location: `http://localhost:${server.address().port}/echo` });
        return response.end();
      }
      if (pathname === '/home/') return response.end('redirect destination');
      if (pathname.startsWith('/challenge')) {
        response.writeHead(403, { 'cf-mitigated': 'challenge' });
        return response.end('Just a moment');
      }
      if (pathname.startsWith('/error')) {
        response.writeHead(500);
        return response.end('error');
      }
      if (pathname === '/home') return response.end(fixtures.home);
      if (pathname === '/watch') return response.end(fixtures.video);
      if (pathname === '/loadComment')
        return response.end(
          url.searchParams.get('id') === 'html'
            ? fixtures.comments
            : JSON.stringify({ comments: fixtures.comments }),
        );
      if (pathname === '/loadReplies')
        return response.end(JSON.stringify({ replies: fixtures.replies }));
      if (pathname === '/')
        return response.end(
          `<meta name="csrf-token" content="${url.searchParams.has('_') ? 'fresh-token' : 'fixture-token'}"><a id="user-modal-trigger" href="/user/7"></a><span id="user-modal-name">User</span>`,
        );
      if (pathname === '/user/7/edit')
        return response.end(
          '<meta name="csrf-token" content="fixture-token"><input name="name" value="Fixture User"><input name="email" value="fixture@example.test">',
        );
      if (pathname === '/user/7/playlists')
        return response.end(
          '<div class="user-tab-item-wrapper"><a class="video-link" href="/playlist?list=9"></a><div class="title">List</div><span class="stat-item">2</span></div>',
        );
      if (/^\/user\/7\//.test(pathname))
        return response.end(
          card(url.searchParams.get('page') === '2' ? '456' : '123') +
            '<ul class="pagination"><li><a class="page-link" href="?page=2">2</a></li></ul>',
        );
      if (pathname === '/subscriptions')
        return response.end(
          '<div class="subscriptions-nav"><div class="subscriptions-artist-card"><span class="card-mobile-title">Studio</span></div></div><div class="content-padding-new"><div class="video-item-container" title="Subscribed"><a class="video-link" href="/watch?v=123"></a><img class="main-thumb" src="/cover.jpg"><span class="meta-author"><a>Studio</a></span></div></div>',
        );
      if (pathname === '/playlist')
        return response.end(
          '<h1 class="playlist-title">Fixture list</h1><span id="sidebar-video-count">1</span><div class="playlist-video-list"><div class="user-tab-item-wrapper" id="playlist-item-8"><a href="/watch?v=123"></a><div class="video-title">Video</div></div></div>',
        );
      if (pathname.startsWith('/previews/'))
        return response.end(
          '<div class="content-padding"><div class="row" id="123"><h3>Preview</h3><div class="preview-info-cover"><img src="/cover.jpg"></div><div class="preview-info-content-padding"><h4>Title</h4><h5><a>Studio</a></h5><h5>2020-01-01</h5><img class="preview-image-modal-trigger" src="/sample.jpg"></div></div></div>',
        );
      if (pathname === '/comics')
        return response.end(
          `<div class="comic-rows-wrapper"><h3>發燒</h3>${comicCard}</div><div class="comic-rows-wrapper"><h3>最新</h3>${comicCard}</div><ul class="pagination"><li><a class="page-link">3</a></li></ul>`,
        );
      if (pathname === '/comic/88')
        return response.end(
          '<h3 class="title">Comic</h3><div class="comics-metadata-margin-top"><h5><a href="https://hanimeone.me/artists/artist">Artist</a></h5></div>',
        );
      if (pathname === '/comic/88/1')
        return response.end(
          '<div class="comic-show-content-nav" data-pages="2"></div><img id="current-page-image" data-prefix="http://images.test/" data-extension="jpg"><script>window.extensions = {}; extensions.innerHTML = \'[&quot;w&quot;,&quot;j&quot;]\';</script>',
        );
      if (pathname === '/all/month_title.html')
        return response.end(
          '<div><div class="category_anime_t2">2026-10</div></div><div class="category_anime_b"><div class="div_product"><table><tr><td class="dd"><a href="/item/555/">Fixture (Studio)</a></td></tr></table><img src="/package_s.jpg"></div></div>',
        );
      if (pathname === '/item/555/')
        return response.end(
          '<script type="application/ld+json">{"@type":"Product","name":"Fixture Product","brand":{"name":"Studio"},"image":["/package.jpg","/sample.jpg"],"offers":{"price":1200}}</script><video src="https://media.test/demo.mp4"></video><script>const config = {"parent_id_array":"1"};</script>',
        );
      if (pathname === '/translate_a/single')
        return response.end(JSON.stringify([[[`Translated ${url.searchParams.get('q')}`]]]));
      if (pathname.endsWith('han1me-box-watch-history.json'))
        return response.end(
          JSON.stringify({
            continueItems: [
              { videoCode: '1', title: 'Remote', positionMs: 2, durationMs: 10000, updatedAt: 2 },
            ],
            histories: [],
          }),
        );
      if (pathname.endsWith('han1me-box-favorites.json'))
        return response.end(JSON.stringify([{ videoCode: '1', title: 'Remote', addedAt: 1 }]));
      if (pathname === '/image') return response.end(Buffer.from('image-fixture'));
      response.writeHead(404);
      response.end('missing ' + pathname);
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    session.defaultSession.webRequest.onBeforeRequest(
      {
        urls: [
          'https://www.getchu.com/*',
          'https://hanimeone.me/*',
          'https://translate.googleapis.com/*',
        ],
      },
      (details, callback) => {
        const url = new URL(details.url);
        callback({ redirectURL: base + '/external/' + url.host + url.pathname + url.search });
      },
    );
    installRequestHeaders(session.defaultSession);
    window = new BrowserWindow({
      show: false,
      webPreferences: { preload: path.join(__dirname, '../../dist-electron/preload.js') },
    });
    await window.loadURL(base + '/test');
    const passed = await window.webContents.executeJavaScript(
      `Checks.run(${JSON.stringify(base)})`,
    );
    passed.forEach((name) => console.log('PASS ' + name));
    await session.defaultSession.cookies.set({
      url: base,
      name: 'cf_clearance',
      value: 'fixture-clearance',
    });
    const sameHost = JSON.parse((await fetchHttp(`${base}/echo`)).body);
    assert.equal(sameHost.cookie.split('cf_clearance=').length - 1, 1);
    const otherHost = JSON.parse((await fetchHttp(`${base}/redirect-host`)).body);
    assert.equal(otherHost.cookie.includes('cf_clearance='), false);
    const settings = JSON.parse(await fs.readFile(path.join(root, 'setting.json'), 'utf8'));
    const watch = JSON.parse(await fs.readFile(path.join(root, 'watch_store.json'), 'utf8'));
    assert.equal(settings.preferredQuality, 1080);
    assert.equal(watch.continueItems.length, 6);
    assert.equal(getSettings().preferredQuality, 1080);
    console.log('PASS cookie redirect isolation, disk persistence and live settings update');
    const comicCache = require('../../dist-electron/comic_cache');
    await comicCache.addCategory('Fixture');
    await comicCache.cache(
      {
        id: 'fixture',
        title: 'Comic',
        coverUrl: '',
        pageCount: 2,
        imageUrls: [base + '/image', base + '/image'],
      },
      'Fixture',
    );
    const entry = (await comicCache.entries())[0];
    const files = await comicCache.extract(entry);
    assert.equal((await fs.readFile(files[0])).toString(), 'image-fixture');
    await comicCache.deleteCategory('Fixture');
    assert.equal((await comicCache.entries())[0].category, '默认');
    await comicCache.remove(entry);
    assert.deepEqual(await comicCache.entries(), []);
    await fs.rm(path.dirname(files[0]), { recursive: true, force: true });
    console.log('PASS comic download/archive/extract/categories/removal');
    const backup = require('../../dist-electron/backup');
    const backupPath = path.join(root, 'fixture.zip');
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: backupPath });
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [backupPath] });
    await backup.exportBackup({
      settings: { themeMode: 'dark' },
      watch: { histories: [] },
      library: { favorites: [] },
      downloads: {
        groups: [],
        tasks: [
          {
            id: '1',
            sourceUrl: 'https://temp.test',
            localVideoPath: '/tmp/local',
            status: 'completed',
          },
        ],
      },
      keyframes: {},
      check_ins: {},
    });
    const imported = await backup.importBackup();
    assert.equal(imported.settings.themeMode, 'dark');
    assert.equal(imported.downloads.tasks[0].sourceUrl, undefined);
    assert.equal(imported.downloads.tasks[0].status, 'failed');
    console.log('PASS ZIP backup roundtrip and portable download metadata');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    window?.destroy();
    server?.close();
    await fs.rm(root, { recursive: true, force: true });
    app.exit(process.exitCode ?? 0);
  }
})();
