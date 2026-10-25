import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import en from './locales/en.json';
import te from './locales/te.json';
import { prefs } from './services/storage.js';

const dictionaries = { en, te };
const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => (prefs.get('lang', 'en') === 'te' ? 'te' : 'en'));

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next) => {
    prefs.set('lang', next);
    setLangState(next);
  }, []);

  /** t('key', { name: 'Asha' }) fills {name}. Falls back to English, then to the key itself. */
  const t = useCallback(
    (key, params = {}) => {
      const text = dictionaries[lang][key] ?? dictionaries.en[key] ?? key;
      return text.replace(/\{(\w+)\}/g, (_, name) => (params[name] !== undefined ? String(params[name]) : `{${name}}`));
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}
