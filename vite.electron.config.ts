import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist-electron',
    emptyOutDir: true,
    minify: false,
    lib: {
      entry: {
        main: 'electron/main.ts',
        preload: 'electron/preload.ts',
        ipc: 'electron/ipc.ts',
        store: 'electron/store.ts',
        http: 'electron/http.ts',
        account: 'electron/account.ts',
        backup: 'electron/backup.ts',
        downloads: 'electron/downloads.ts',
        windows: 'electron/windows.ts',
      },
      formats: ['cjs'],
      fileName: (_format, entryName) => `${entryName}.js`,
    },
    rolldownOptions: {
      external: ['electron', 'fflate', /^node:/, /^\.\//],
    },
  },
});
