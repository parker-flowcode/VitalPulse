/**
 * ThemeContext.js — VitalPulse v5.0
 *
 * Sistema de temas con soporte para modo claro, oscuro y automático (sistema).
 * Proporciona el tema resuelto y los colores correspondientes a toda la app.
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightColors, darkColors } from './designTokens';

const THEME_STORAGE_KEY = '@vitalpulse_theme';

const ThemeContext = createContext({
  theme: 'system',
  resolvedTheme: 'light',
  colors: lightColors,
  setTheme: () => {},
});

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme() || 'light';
  const [theme, setThemeState] = useState('system');

  // Load persisted preference
  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setThemeState(stored);
      }
    }).catch(() => {});
  }, []);

  // Resolve actual theme
  const resolvedTheme = theme === 'system' ? systemScheme : theme;

  // Current color palette
  const colors = resolvedTheme === 'dark' ? darkColors : lightColors;

  // Persist and update
  const setTheme = useCallback((newTheme) => {
    setThemeState(newTheme);
    AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme).catch(() => {});
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, colors, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export default ThemeContext;
