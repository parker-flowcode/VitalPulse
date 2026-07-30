/**
 * LanguageContext.js — VitalPulse v9.0
 *
 * React Context for app language (es | en).
 * Persisted to AsyncStorage under @vitalpulse_lang.
 * Default: 'es'
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LANG_STORAGE_KEY = '@vitalpulse_lang';

const LanguageContext = createContext({
  lang: 'es',
  setLang: () => {},
});

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState('es');

  // Load persisted language preference
  useEffect(() => {
    AsyncStorage.getItem(LANG_STORAGE_KEY).then((stored) => {
      if (stored === 'es' || stored === 'en') {
        setLangState(stored);
      }
    }).catch(() => {});
  }, []);

  // Persist and update
  const setLang = useCallback((newLang) => {
    setLangState(newLang);
    AsyncStorage.setItem(LANG_STORAGE_KEY, newLang).catch(() => {});
  }, []);

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export default LanguageContext;
