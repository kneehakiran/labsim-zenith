import { useI18n } from '../i18n.jsx';

export default function LanguageSwitcher() {
  const { lang, setLang } = useI18n();
  return (
    <div className="lang-switch" role="group" aria-label="Language">
      <button type="button" className={lang === 'en' ? 'active' : ''} aria-pressed={lang === 'en'} onClick={() => setLang('en')}>
        English
      </button>
      <button type="button" className={lang === 'te' ? 'active' : ''} aria-pressed={lang === 'te'} onClick={() => setLang('te')}>
        తెలుగు
      </button>
    </div>
  );
}
