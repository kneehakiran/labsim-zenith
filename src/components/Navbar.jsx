import { useEffect, useState } from 'react';
import { useI18n } from '../i18n.jsx';
import LanguageSwitcher from './LanguageSwitcher.jsx';

export default function Navbar({ profile, onHome, onSwitchRole }) {
  const { t } = useI18n();
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  return (
    <header className="navbar">
      <button type="button" className="brand" onClick={onHome} aria-label={t('nav.home')}>
        <img src="/icons/icon.svg" alt="" width="28" height="28" />
        <span>{t('app.name')}</span>
      </button>
      <div className="nav-right">
        <span className={`chip ${online ? 'ok' : 'warn'}`}>{online ? t('status.online') : t('status.offline')}</span>
        {profile && (
          <button type="button" className="btn ghost small" onClick={onSwitchRole}>
            {profile.name}: {t('nav.switchRole')}
          </button>
        )}
        <LanguageSwitcher />
      </div>
    </header>
  );
}
