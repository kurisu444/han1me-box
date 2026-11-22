import english from '../../assets/locales/en.json';
import traditional from '../../assets/locales/zh_TW.json';
import type { AppLanguage } from '../core/settings';
import { useSettings } from './settings_context';

type ResolvedLocale = Exclude<AppLanguage, 'system'>;

const dictionaries: Record<ResolvedLocale, Record<string, string>> = {
  english,
  traditionalChinese: traditional,
  simplifiedChinese: {},
};

function resolveLocale(language: AppLanguage, systemLanguage: string): ResolvedLocale {
  if (language !== 'system') {
    return language;
  }
  if (/^zh-(?:tw|hk|mo|hant)/i.test(systemLanguage)) {
    return 'traditionalChinese';
  }
  if (/^zh/i.test(systemLanguage)) {
    return 'simplifiedChinese';
  }
  return 'english';
}

export function translateLabel(
  text: string,
  language: AppLanguage,
  systemLanguage: string,
  ...values: (string | number)[]
) {
  const locale = resolveLocale(language, systemLanguage);
  const template = dictionaries[locale][text] ?? text;

  return template.replace(/\{(\d+)\}/g, (_, index) => String(values[Number(index)]));
}

export function useI18n() {
  const { language } = useSettings();

  return (text: string, ...values: (string | number)[]) =>
    translateLabel(text, language, navigator.language, ...values);
}
