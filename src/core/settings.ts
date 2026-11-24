export type AppThemeMode = 'system' | 'light' | 'dark';
export type AppLanguage = 'system' | 'simplifiedChinese' | 'traditionalChinese' | 'english';
export type AppThemeColor =
  'rose' | 'blue' | 'teal' | 'amber' | 'green' | 'orange' | 'indigo' | 'pink' | 'purple' | 'custom';
export type VideoAspectRatio = 'auto' | 'crop' | 'stretch' | 'ratio4x3';

export const defaultHomeSectionOrder = ['他們在看', '最新上市', '最新上傳'] as const;

export const defaultLibraryTabKeys = [
  'watch-later',
  'favorites',
  'playlists',
  'subscriptions',
  'history',
] as const;

export interface AppSettings {
  themeMode: AppThemeMode;
  themeColor: AppThemeColor;
  customThemeColor: string;
  amoledMode: boolean;
  language: AppLanguage;
  textScale: number;
  baseUrl: string;
  useCompactSearchCards: boolean;
  useCustomMirrorSite: boolean;
  customMirrorSite: string;
  appendCustomMirrorPath: boolean;
  preferredQuality: number;
  downloadQuality: number;
  resumePlayback: boolean;
  autoPlayOnOpen: boolean;
  defaultPlaybackSpeed: number;
  longPressPlaybackSpeed: number;
  commentsEnabled: boolean;
  keyframesEnabled: boolean;
  blockedCommentKeywords: string[];
  blockedCommentUsers: string[];
  showHomeFeatured: boolean;
  homeSectionOrder: string[];
  hiddenHomeSections: string[];
  libraryTabOrder: string[];
  blockedVideoTitleKeywords: string[];
  blockedAuthors: string[];
  minimumVideoDurationSeconds: number;
  minimumVideoViews: number;
  exemptSubscribedAuthors: boolean;
  applyRecommendationFiltersToRelated: boolean;
  applyRecommendationFiltersToSearch: boolean;
  incognitoPlayback: boolean;
  autoPlayNext: boolean;
  loopPlayback: boolean;
  autoPictureInPicture: boolean;
  videoAspectRatio: VideoAspectRatio;
  skipSeconds: number;
  webDavEnabled: boolean;
  webDavHistorySync: boolean;
  webDavFavoriteSync: boolean;
  webDavUrl: string;
  webDavUsername: string;
  webDavPassword: string;
  downloadPath: string;
  concurrentDownloads: number;
  downloadSpeedLimitMbps: number;
  minimizeToTray: boolean;
}

export function createAppSettings(values: Partial<AppSettings> = {}): AppSettings {
  return {
    themeMode: 'system',
    themeColor: 'purple',
    customThemeColor: '62539F',
    amoledMode: false,
    language: 'system',
    textScale: 1,
    baseUrl: 'https://hanime1.me',
    useCompactSearchCards: true,
    useCustomMirrorSite: false,
    customMirrorSite: '',
    appendCustomMirrorPath: true,
    preferredQuality: 720,
    downloadQuality: 1080,
    resumePlayback: true,
    autoPlayOnOpen: true,
    defaultPlaybackSpeed: 1,
    longPressPlaybackSpeed: 2,
    commentsEnabled: true,
    keyframesEnabled: true,
    blockedCommentKeywords: [],
    blockedCommentUsers: [],
    showHomeFeatured: true,
    homeSectionOrder: [],
    hiddenHomeSections: [],
    libraryTabOrder: [],
    blockedVideoTitleKeywords: [],
    blockedAuthors: [],
    minimumVideoDurationSeconds: 0,
    minimumVideoViews: 0,
    exemptSubscribedAuthors: true,
    applyRecommendationFiltersToRelated: true,
    applyRecommendationFiltersToSearch: true,
    incognitoPlayback: false,
    autoPlayNext: false,
    loopPlayback: false,
    autoPictureInPicture: false,
    videoAspectRatio: 'auto',
    skipSeconds: 5,
    webDavEnabled: false,
    webDavHistorySync: false,
    webDavFavoriteSync: false,
    webDavUrl: '',
    webDavUsername: '',
    webDavPassword: '',
    downloadPath: '',
    concurrentDownloads: 2,
    downloadSpeedLimitMbps: 0,
    minimizeToTray: false,
    ...values,
  };
}

export function mirrorActive(settings: AppSettings): boolean {
  return settings.useCustomMirrorSite && settings.customMirrorSite.length > 0;
}

export function homeBaseUrl(settings: AppSettings): string {
  return mirrorActive(settings) ? settings.customMirrorSite : settings.baseUrl;
}

export function resolvedBaseUrl(settings: AppSettings): string {
  if (!mirrorActive(settings)) {
    return settings.baseUrl;
  }
  if (settings.appendCustomMirrorPath) {
    return settings.customMirrorSite;
  }
  return new URL(settings.customMirrorSite).origin;
}

export function resolvedLibraryTabOrder(settings: AppSettings): string[] {
  const known = new Set<string>(defaultLibraryTabKeys);
  return [
    ...new Set([
      ...settings.libraryTabOrder.filter((key) => known.has(key)),
      ...defaultLibraryTabKeys,
    ]),
  ];
}

export function normalizeMirrorUrl(value: string): string {
  const normalized = value.trim().replace(/\/+$/, '');
  const uri = URL.parse(normalized);
  if (
    !/^https:\/\/[^/\\]/i.test(normalized) ||
    !uri ||
    !uri.hostname ||
    normalized.includes('?') ||
    normalized.includes('#')
  ) {
    return '';
  }
  return normalized;
}

// 配置读取时的业务范围约束；文件读写在 Phase 3 接入。
export function appSettingsFromJson(values: Partial<AppSettings>): AppSettings {
  const settings = createAppSettings(
    Object.fromEntries(Object.entries(values).filter(([, value]) => value != null)),
  );
  return {
    ...settings,
    ...Object.fromEntries(
      [
        'blockedCommentKeywords',
        'blockedCommentUsers',
        'homeSectionOrder',
        'hiddenHomeSections',
        'libraryTabOrder',
        'blockedVideoTitleKeywords',
        'blockedAuthors',
      ].map((key) => [
        key,
        (settings[key as keyof AppSettings] as unknown[]).filter(
          (item) => typeof item === 'string',
        ),
      ]),
    ),
    themeColor: [
      'rose',
      'blue',
      'teal',
      'amber',
      'green',
      'orange',
      'indigo',
      'pink',
      'purple',
      'custom',
    ].includes(settings.themeColor)
      ? settings.themeColor
      : 'purple',
    customThemeColor: /^[0-9A-F]{6}$/.test(settings.customThemeColor.replace('#', '').toUpperCase())
      ? settings.customThemeColor.replace('#', '').toUpperCase()
      : '62539F',
    themeMode: ['system', 'light', 'dark'].includes(settings.themeMode)
      ? settings.themeMode
      : 'system',
    language: ['system', 'simplifiedChinese', 'traditionalChinese', 'english'].includes(
      settings.language,
    )
      ? settings.language
      : 'system',
    videoAspectRatio: ['auto', 'crop', 'stretch', 'ratio4x3'].includes(settings.videoAspectRatio)
      ? settings.videoAspectRatio
      : 'auto',
    textScale: Math.max(0.8, Math.min(settings.textScale, 1.4)),
    defaultPlaybackSpeed: Math.max(0.25, Math.min(settings.defaultPlaybackSpeed, 3)),
    minimumVideoDurationSeconds: Math.max(0, Math.min(settings.minimumVideoDurationSeconds, 86400)),
    minimumVideoViews: Math.max(0, Math.min(settings.minimumVideoViews, 1000000000)),
    concurrentDownloads: Math.max(1, Math.min(settings.concurrentDownloads, 5)),
    skipSeconds: Math.max(1, Math.min(settings.skipSeconds, 3600)),
    customMirrorSite: normalizeMirrorUrl(settings.customMirrorSite),
  };
}
