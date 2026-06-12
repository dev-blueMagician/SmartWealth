import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { dict, type Dict, type Lang } from './dict';

type LocaleContextValue = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Dict;
};

const STORAGE_KEY = 'smartwealth_portal_lang';
const LocaleContext = createContext<LocaleContextValue | null>(null);

function readInitialLang(): Lang {
  if (typeof window === 'undefined') return 'en';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'en' || stored === 'vi') return stored;
  const navLang = window.navigator?.language?.toLowerCase() ?? '';
  return navLang.startsWith('vi') ? 'vi' : 'en';
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => readInitialLang());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<LocaleContextValue>(() => ({ lang, setLang, t: dict[lang] }), [lang]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used inside LocaleProvider');
  return ctx;
}

export function useT(): Dict {
  return useLocale().t;
}

export type { Lang, Dict };
