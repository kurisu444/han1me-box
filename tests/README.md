# 核心回归测试

```bash
npm test                  # 全部核心回归
npm run test:unit         # 无窗口的单元测试
npm run test:integration  # Electron 集成测试，窗口始终隐藏
npm run test:login        # 窗口内登录与验证回归，使用隐藏窗口
```

若终端继承了 `ELECTRON_RUN_AS_NODE`，Linux 下使用 `env -u ELECTRON_RUN_AS_NODE npm test`。

| 位置                                                     | 覆盖内容                                                                                                                                       |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `unit/models.test.mjs`、`core.test.ts`                   | 模型序列化、配置、URL、时长和播放量                                                                                                            |
| `unit/media.test.ts`                                     | 清晰度、续播、连播、过滤/排序、主题/语言、月份                                                                                                 |
| `unit/search.test.ts`、`library.test.ts`                 | 搜索参数与历史、收藏/片单/订阅，含 count 联动                                                                                                  |
| `unit/verification.test.cjs`、`request_headers.test.cjs` | 验证窗口完成条件、Cookie 与 Referer                                                                                                            |
| `unit/zip.test.cjs`                                      | 实际备份模块与 Python ZIP 互操作，包含 UTF-8、Deflate、Data Descriptor；使用 `uv` 离线运行                                                     |
| `integration/data.cjs`                                   | 真实 Session/IPC/磁盘、重定向、账号写接口、站点解析、备份                                                                                      |
| `integration/renderer/`                                  | 数据断言与实际组件测试入口，包含 WebDAV、关键帧、播放器、图库和 Query                                                                          |
| `integration/downloads.cjs`                              | 本地视频播放及前后快进；下载续传、去重、分组、导出、删除、损坏文件恢复                                                                         |
| `integration/app.cjs`                                    | 账号恢复、分支保留；窗口内全屏及播放连续性；HLS 跨域播放/切源/重试；Query 共享结果、缓存失效和收藏通知，首页断网缓存与重试；图片缩放/拖动/双击 |
| `fixtures/`                                              | 本地 HTML、2 秒 WebM，以及 `hls/` 中 8 秒纯色测试视频分片                                                                                      |

`run-logic.cjs` 统一加载包含 JSON 资源和无扩展名导入的 TypeScript 业务测试。

`integration/login.cjs` 使用本地站点和临时会话，验证登录与验证共用主窗口、Cookie 共享、取消登录恢复账号、同页处理新窗口链接、尺寸变化和资源释放。它不访问真实 Google 账号或 Cloudflare 服务。

集成测试只访问本地 HTTP 夹具，使用独立临时数据目录；应用测试构建到临时目录，结束后清理。测试不会访问真实账号、修改日常数据、输出截图或留下构建产物。
