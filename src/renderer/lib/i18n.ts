// Interface translations. Strings are looked up by their English text, so untranslated ones simply stay English.
import { createSignal } from 'solid-js';
import { TABLES } from './i18n-tables';

export const LANGUAGES: { code: string; name: string }[] = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'हिन्दी' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'pt', name: 'Português' },
  { code: 'ja', name: '日本語' },
  { code: 'zh', name: '简体中文' },
];

const [lang, setLangSig] = createSignal('en');
export { lang };

/** 'auto' follows the system language when Lithograph has it, English otherwise. */
export function setLanguage(pref: string | undefined) {
  const want = !pref || pref === 'auto' ? (navigator.language || 'en').slice(0, 2).toLowerCase() : pref;
  setLangSig(TABLES[want] || want === 'en' ? want : 'en');
  document.documentElement.lang = lang();
}

/** The interface text for `en` in the current language; {name} parts are filled from vars. */
export function t(en: string, vars?: Record<string, string | number>): string {
  const s = TABLES[lang()]?.[en] ?? en;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s;
}
