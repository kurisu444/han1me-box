const { app, net, BrowserWindow, dialog } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
let state = {
  groups: [{ id: 'default', name: 'Cached', createdAt: 0, sort: 'defaultOrder' }],
  tasks: [],
};
let settings = {};
let root;
let writes = Promise.resolve();
let lastWrite = 0;
let lastEmit = 0;
const jobs = new Map();
const running = new Set();
const exists = (file) =>
  fs.access(file).then(
    () => true,
    () => false,
  );
function emit() {
  for (const window of BrowserWindow.getAllWindows())
    window.webContents.send('downloads:changed', state);
}
function persist() {
  const data = JSON.stringify(state),
    directory = root;
  writes = writes.then(async () => {
    try {
      const file = path.join(directory, 'download_store.json');
      await fs.writeFile(`${file}.tmp`, data);
      if (await exists(file)) await fs.copyFile(file, `${file}.bak`).catch(() => {});
      await fs.rename(`${file}.tmp`, file);
    } catch (error) {
      console.error('Failed to persist download store:', error.message);
    }
  });
  return writes;
}
async function save() {
  emit();
  await persist();
}
async function change(id, values) {
  state = {
    ...state,
    tasks: state.tasks.map((task) =>
      task.id === id ? { ...task, ...values, updatedAt: Date.now() } : task,
    ),
  };
  await save();
}
async function decode(file, fromJson = (value) => value) {
  try {
    const value = JSON.parse(await fs.readFile(file, 'utf8'));
    return value && typeof value === 'object' && !Array.isArray(value)
      ? fromJson(value)
      : undefined;
  } catch {
    return undefined;
  }
}
function downloadState(value = {}) {
  const records = (items) =>
    (items ?? []).filter((item) => item && typeof item === 'object' && !Array.isArray(item));
  const groups = records(value.groups)
    .map((group) => ({
      ...group,
      id: group.id ?? '',
      name: group.name ?? '',
      createdAt: group.createdAt ?? 0,
      sort: ['defaultOrder', 'recentlyUpdated', 'name'].includes(group.sort)
        ? group.sort
        : 'defaultOrder',
    }))
    .filter((group) => group.id);
  if (!groups.some((group) => group.id === 'default'))
    groups.unshift({ id: 'default', name: 'Cached', createdAt: 0, sort: 'defaultOrder' });
  const ids = new Set(groups.map((group) => group.id));
  return {
    groups,
    tasks: records(value.tasks).map((task) => ({
      ...task,
      id: task.id ?? '',
      videoCode: task.videoCode ?? '',
      title: task.title ?? '',
      quality: task.quality ?? '',
      progress: task.progress ?? 0,
      downloadedBytes: task.downloadedBytes ?? 0,
      totalBytes: task.totalBytes ?? 0,
      createdAt: task.createdAt ?? 0,
      updatedAt: task.updatedAt ?? 0,
      status: ['queued', 'downloading', 'completed', 'failed'].includes(task.status)
        ? task.status
        : 'queued',
      groupIds: [...new Set(task.groupIds ?? (task.groupId ? [task.groupId] : []))].filter(
        (id) => id !== 'default' && ids.has(id),
      ),
      pinned: task.pinned ?? false,
      speedBytesPerSecond: task.speedBytesPerSecond ?? 0,
    })),
  };
}
async function initialize(value) {
  settings = value;
  const directory = await normalizeDownloadPath(value.downloadPath);
  if (root === directory) {
    schedule();
    return;
  }
  root = directory;
  await fs.mkdir(root, { recursive: true });
  const loaded =
    (await decode(path.join(root, 'download_store.json'), downloadState)) ??
    (await decode(path.join(root, 'download_store.json.bak'), downloadState)) ??
    downloadState();
  state = loaded;
  for (const task of state.tasks) {
    if (task.status === 'completed') continue;
    if (!task.sourceUrl) {
      task.status = 'failed';
      task.errorMessage = 'Download interrupted';
      continue;
    }
    jobs.set(task.id, {
      detail: { id: task.videoCode, title: task.title, coverUrl: task.coverUrl, tags: [] },
      source: { quality: task.quality, url: task.sourceUrl },
    });
    task.status = 'queued';
    delete task.errorMessage;
  }
  try {
    for (const entry of await fs.readdir(root, { withFileTypes: true })) {
      if (!entry.isDirectory() || state.tasks.some((task) => task.videoCode === entry.name))
        continue;
      const directory = path.join(root, entry.name),
        meta = path.join(directory, 'detail.json'),
        data = await decode(meta);
      if (!data) continue;
      const video = (await fs.readdir(directory)).find(
        (name) => name.startsWith('video_') && name.endsWith('.mp4'),
      );
      if (!video) continue;
      const videoPath = path.join(directory, video),
        stat = await fs.stat(videoPath),
        cover = path.join(directory, 'cover.jpg');
      state.tasks.push({
        id: entry.name,
        videoCode: entry.name,
        title: data.title ?? entry.name,
        coverUrl: data.coverUrl,
        duration: data.duration,
        views: data.viewsText,
        rating: data.rating,
        uploadTime: data.uploadDate,
        sourceUrl: data.sourceUrl,
        groupIds: [],
        quality: data.sourceQuality ?? path.basename(video, '.mp4').replace('video_', ''),
        status: 'completed',
        progress: 1,
        downloadedBytes: stat.size,
        totalBytes: stat.size,
        speedBytesPerSecond: 0,
        pinned: false,
        createdAt: stat.mtimeMs,
        updatedAt: stat.mtimeMs,
        localVideoPath: videoPath,
        localCoverPath: (await exists(cover)) ? cover : undefined,
        localMetaPath: meta,
      });
    }
  } catch (error) {
    console.error('Failed to scan download directory:', error.message);
  }
  await save();
  schedule();
}
async function create(detail, source, groupId = 'default') {
  const existing = state.tasks.find((task) => task.videoCode === detail.id);
  if (existing?.status === 'completed') return 'alreadyDownloaded';
  if (existing && ['queued', 'downloading'].includes(existing.status)) return 'alreadyQueued';
  const now = Date.now();
  const task = {
    id: detail.id,
    videoCode: detail.id,
    title: detail.title,
    coverUrl: detail.coverUrl,
    duration: detail.duration,
    views: detail.views,
    rating: detail.rating,
    uploadTime: detail.uploadDate,
    sourceUrl: source.url,
    groupIds: groupId === 'default' ? [] : [groupId],
    quality: source.quality,
    status: 'queued',
    progress: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    speedBytesPerSecond: 0,
    pinned: false,
    createdAt: now,
    updatedAt: now,
  };
  jobs.set(task.id, { detail, source });
  state = {
    ...state,
    tasks: [...state.tasks.filter((item) => item.videoCode !== detail.id), task],
  };
  await save();
  schedule();
  return 'queued';
}
function schedule() {
  while (running.size < (settings.concurrentDownloads ?? 2)) {
    const task = state.tasks.find(
      (task) => task.status === 'queued' && jobs.has(task.id) && !running.has(task.id),
    );
    if (!task) return;
    running.add(task.id);
    const job = jobs.get(task.id);
    run(task, job.detail, job.source).finally(() => {
      running.delete(task.id);
      schedule();
    });
  }
}
async function run(task, detail, source) {
  try {
    const directory = path.join(root, task.videoCode);
    await fs.mkdir(directory, { recursive: true });
    const meta = path.join(directory, 'detail.json');
    await fs.writeFile(
      meta,
      JSON.stringify({
        videoCode: detail.id,
        title: detail.title,
        coverUrl: detail.coverUrl,
        artistName: detail.artist,
        genre: detail.genre,
        duration: detail.duration,
        rating: detail.rating,
        viewsText: detail.views,
        uploadDate: detail.uploadDate,
        introduction: detail.description,
        tags: (detail.tags ?? []).map((tag) => tag.name),
        sourceQuality: source.quality,
        sourceUrl: source.url,
      }),
    );
    await change(task.id, { status: 'downloading' });
    if (detail.coverUrl) {
      try {
        const response = await net.fetch(detail.coverUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const cover = path.join(directory, 'cover.jpg');
        await fs.writeFile(cover, Buffer.from(await response.arrayBuffer()));
        await change(task.id, { localCoverPath: cover });
      } catch {}
    }
    const quality = source.quality.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
    const video = path.join(directory, `video_${quality}.mp4`);
    await download(source.url, video, task.id);
    await change(task.id, {
      status: 'completed',
      progress: 1,
      localVideoPath: video,
      localMetaPath: meta,
      errorMessage: undefined,
    });
  } catch (error) {
    await change(task.id, { status: 'failed', errorMessage: String(error) });
  } finally {
    jobs.delete(task.id);
  }
}
async function download(url, destination, id) {
  const partial = `${destination}.part`,
    received = (await exists(partial)) ? (await fs.stat(partial)).size : 0;
  const response = await net.fetch(url, {
    headers: received ? { Range: `bytes=${received}-` } : undefined,
  });
  if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
  const range = response.status === 206;
  if (!range && received) {
    await response.body.cancel();
    await fs.unlink(partial);
    return download(url, destination, id);
  }
  const length = Number(response.headers.get('content-length') ?? -1),
    total = length < 0 ? -1 : (range ? received : 0) + length;
  let downloaded = received,
    windowStart = Date.now(),
    windowBytes = 0,
    speedStart = Date.now(),
    speedBytes = 0,
    speed = 0;
  const file = await fs.open(partial, received && range ? 'a' : 'w');
  try {
    for await (const chunk of response.body) {
      await file.write(chunk);
      downloaded += chunk.length;
      windowBytes += chunk.length;
      speedBytes += chunk.length;
      const now = Date.now();
      if (now - speedStart >= 800) {
        speed = Math.round((speedBytes / (now - speedStart)) * 1000);
        speedStart = now;
        speedBytes = 0;
      }
      state = {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === id
            ? {
                ...task,
                progress: total <= 0 ? 0 : downloaded / total,
                downloadedBytes: downloaded,
                totalBytes: total,
                speedBytesPerSecond: speed,
                updatedAt: now,
              }
            : task,
        ),
      };
      if (now - lastEmit >= 100) {
        lastEmit = now;
        emit();
      }
      if (now - lastWrite >= 700) {
        lastWrite = now;
        await persist();
      }
      const limit = settings.downloadSpeedLimitMbps ?? 0;
      if (limit > 0) {
        const delay = (windowBytes * 1000) / (limit * 1024 * 1024) - (Date.now() - windowStart);
        if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
        if (Date.now() - windowStart >= 1000) {
          windowStart = Date.now();
          windowBytes = 0;
        }
      }
    }
  } finally {
    await file.close();
  }
  await fs.rm(destination, { force: true });
  await fs.rename(partial, destination);
}
async function updateGroup(id, name, sort) {
  const value = name.trim();
  if (!value || state.groups.some((group) => group.id !== id && group.name === value)) return;
  if (id)
    state = {
      ...state,
      groups: state.groups.map((group) =>
        group.id === id ? { ...group, name: value, sort } : group,
      ),
    };
  else {
    id = String(Date.now() * 1000);
    state = {
      ...state,
      groups: [...state.groups, { id, name: value, sort, createdAt: Date.now() }],
    };
  }
  await save();
  return id;
}
async function deleteGroup(id) {
  if (id === 'default') return;
  state = {
    groups: state.groups.filter((group) => group.id !== id),
    tasks: state.tasks.map((task) =>
      task.groupIds.includes(id)
        ? {
            ...task,
            groupIds: task.groupIds.filter((group) => group !== id),
            updatedAt: Date.now(),
          }
        : task,
    ),
  };
  await save();
}
async function deleteTasks(ids) {
  for (const task of state.tasks.filter((task) => ids.includes(task.id))) {
    await fs.rm(path.join(root, task.videoCode), { recursive: true, force: true });
    jobs.delete(task.id);
  }
  state = { ...state, tasks: state.tasks.filter((task) => !ids.includes(task.id)) };
  await save();
}
async function togglePinned(ids) {
  const selected = state.tasks.filter((task) => ids.includes(task.id));
  if (!selected.length) return;
  const pinned = !selected.every((task) => task.pinned);
  state = {
    ...state,
    tasks: state.tasks.map((task) =>
      ids.includes(task.id) ? { ...task, pinned, updatedAt: Date.now() } : task,
    ),
  };
  await save();
}
async function setTaskGroups(ids, groupIds) {
  const valid = [...new Set(groupIds)].filter(
    (id) => id !== 'default' && state.groups.some((group) => group.id === id),
  );
  state = {
    ...state,
    tasks: state.tasks.map((task) =>
      ids.includes(task.id) ? { ...task, groupIds: valid, updatedAt: Date.now() } : task,
    ),
  };
  await save();
}
async function retry(id, detail, source) {
  if (!state.tasks.some((task) => task.id === id && task.status === 'failed')) return;
  jobs.set(id, { detail, source });
  await change(id, {
    status: 'queued',
    progress: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    sourceUrl: source.url,
    errorMessage: undefined,
  });
  schedule();
}
async function exportCompleted(destination) {
  if (!destination) {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled) return;
    destination = result.filePaths[0];
  }
  await fs.mkdir(destination, { recursive: true });
  for (const task of state.tasks.filter((task) => task.status === 'completed')) {
    const source = path.join(root, task.videoCode);
    if (await exists(source))
      await fs.cp(source, path.join(destination, task.videoCode), { recursive: true });
  }
}
async function normalizeDownloadPath(value) {
  if (!value?.trim() || value.startsWith('/storage/emulated/0/')) {
    const directory = path.join(app.getPath('userData'), 'Download');
    await fs.mkdir(directory, { recursive: true });
    return directory;
  }
  let resolved = value.trim();
  if (process.platform === 'win32') {
    const environment = Object.fromEntries(
      Object.entries(process.env).map(([key, value]) => [key.toLowerCase(), value]),
    );
    resolved = resolved.replace(
      /%([^%]+)%/g,
      (match, key) => environment[key.toLowerCase()] ?? match,
    );
  } else if (resolved === '~' || resolved.startsWith('~/')) {
    resolved = path.join(app.getPath('home'), resolved.slice(2));
  }
  return path.resolve(resolved);
}

async function chooseDirectory(initialPath) {
  const result = await dialog.showOpenDialog({
    defaultPath: initialPath || undefined,
    properties: ['openDirectory'],
  });
  return result.canceled ? undefined : result.filePaths[0];
}

module.exports = {
  normalizeDownloadPath,
  chooseDirectory,
  downloadState,
  initialize,
  create,
  updateGroup,
  deleteGroup,
  deleteTasks,
  togglePinned,
  setTaskGroups,
  retry,
  exportCompleted,
  getState: () => state,
  replace: async (value) => {
    state = downloadState(value);
    await save();
  },
};
