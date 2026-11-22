// TypeScript 业务模块含 JSON 资源和无扩展名导入，统一由 Vite 加载。
(async () => {
  const { createServer } = await import('vite');
  const vite = await createServer({
    configFile: false,
    logLevel: 'error',
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  });
  try {
    for (const name of ['core', 'media', 'search', 'library']) {
      await vite.ssrLoadModule(`/tests/unit/${name}.test.ts`);
    }
  } finally {
    await vite.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
