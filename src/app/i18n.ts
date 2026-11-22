import english from '../../assets/locales/en.json';
import traditional from '../../assets/locales/zh_TW.json';
import { useSettings } from './settings_context';
import type { AppLanguage } from '../core/settings';
export function translateLabel(
  text: string,
  language: AppLanguage,
  systemLanguage: string,
  ...values: (string | number)[]
) {
  const locale =
    language === 'system'
      ? /^zh-(?:tw|hk|mo|hant)/i.test(systemLanguage)
        ? 'traditionalChinese'
        : /^zh/i.test(systemLanguage)
          ? 'simplifiedChinese'
          : 'english'
      : language;
  const labels: Record<string, string> =
    locale === 'english' ? english : locale === 'traditionalChinese' ? traditional : {};
  return (labels[text] ?? text).replace(/\{(\d+)\}/g, (_, index) => String(values[Number(index)]));
}
export function useI18n() {
  const { language } = useSettings();
  return (text: string, ...values: (string | number)[]) =>
    translateLabel(text, language, navigator.language, ...values);
}
