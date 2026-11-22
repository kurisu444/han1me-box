const { net, protocol } = require('electron');

function registerLocalMediaProtocol() {
  // protocol.handle + net.fetch(file:) 丢失可寻址信息，导致本地视频无法快进。
  // 暂用原生文件处理器；Electron #38749 修复后再迁移已弃用的 API。
  protocol.registerFileProtocol('han1me-local', (request, callback) => {
    callback({ path: new URL(request.url).searchParams.get('path') });
  });
}

// net.fetch 在当前 Electron 返回空 response.url；业务需要重定向后的域名和登录路径。
function request(url, method = 'GET', headers = {}, body, charset = 'utf-8') {
  return new Promise((resolve, reject) => {
    const request = net.request({ url, method, credentials: 'include' });
    let finalUrl = url;
    for (const [name, value] of Object.entries(headers)) request.setHeader(name, value);
    request.on('redirect', (_status, _method, target) => {
      finalUrl = target;
      request.followRedirect();
    });
    request.on('error', reject);
    request.on('response', async (response) => {
      try {
        const chunks = [];
        for await (const chunk of response) chunks.push(chunk);
        resolve({
          statusCode: response.statusCode,
          body: new TextDecoder(charset).decode(Buffer.concat(chunks)),
          headers: Object.fromEntries(
            Object.entries(response.headers).map(([name, value]) => [
              name,
              Array.isArray(value) ? value.join(', ') : value,
            ]),
          ),
          url: finalUrl,
        });
      } catch (error) {
        reject(error);
      }
    });
    request.end(body);
  });
}
function mediaReferer(settings, pageUrl) {
  if (/^#\/(?:getchu(?:\/|$)|video\/getchu-)/.test(new URL(pageUrl).hash))
    return 'https://www.getchu.com/';
  const mirror = settings.useCustomMirrorSite && settings.customMirrorSite;
  const home = mirror || settings.baseUrl || 'https://hanime1.me';
  const base = mirror && settings.appendCustomMirrorPath === false ? new URL(home).origin : home;
  const id = /^#\/video\/([^/?]+)/.exec(new URL(pageUrl).hash)?.[1];
  return id ? `${base.replace(/\/+$/, '')}/watch?v=${id}` : home;
}

function installRequestHeaders(browserSession, contents) {
  const { getSettings } = require('./ipc');
  browserSession.webRequest.onBeforeSendHeaders(async (details, callback) => {
    const headers = details.requestHeaders;
    // 主进程网络请求不会自动携带验证窗口取得的分区 Cookie，按 URL 补上。
    if (!details.webContents && /^https?:/.test(details.url)) {
      const [clearance] = await browserSession.cookies.get({
        url: details.url,
        name: 'cf_clearance',
      });
      if (clearance) {
        const name = Object.keys(headers).find((key) => key.toLowerCase() === 'cookie') || 'Cookie';
        const cookies = (headers[name] || '')
          .split(/;\s*/)
          .filter((cookie) => cookie && !cookie.startsWith('cf_clearance='));
        headers[name] = [...cookies, `cf_clearance=${clearance.value}`].join('; ');
      }
    }
    if (
      contents &&
      details.webContentsId === contents.id &&
      (['media', 'image'].includes(details.resourceType) ||
        (details.resourceType === 'xhr' && /^#\/video\//.test(new URL(contents.getURL()).hash)))
    ) {
      for (const name of Object.keys(headers)) {
        if (name.toLowerCase() === 'referer') delete headers[name];
      }
      headers.Referer = mediaReferer(getSettings(), contents.getURL());
      if (headers.Referer === 'https://www.getchu.com/')
        headers.Cookie = 'getchu_adalt_flag=getchu.com; gc=gc';
    }
    callback({ requestHeaders: headers });
  });
}

module.exports = { request, mediaReferer, installRequestHeaders, registerLocalMediaProtocol };
