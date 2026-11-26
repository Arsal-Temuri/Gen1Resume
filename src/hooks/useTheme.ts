import { useCallback, useEffect, useState } from 'react';
import type { ApplicationSettings, ThemePreference } from '../types/history';
import {
  DEFAULT_SETTINGS,
  loadStoredSettings,
  saveStoredSettings,
} from '../services/storageService';

export function useTheme() {
  const [settings, setSettings] = useState<ApplicationSettings>(() => {
    const loaded = loadStoredSettings();
    return loaded.data;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    saveStoredSettings(settings);
  }, [settings]);

  const setTheme = useCallback((theme: ThemePreference) => {
    setSettings((prev) => ({ ...prev, theme }));
  }, []);

  const toggleTheme = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      theme: prev.theme === 'light' ? 'dark' : 'light',
    }));
  }, []);

  const dismissAiNotice = useCallback(() => {
    setSettings((prev) => ({ ...prev, aiNoticeDismissed: true }));
  }, []);

  const replaceSettings = useCallback((next: ApplicationSettings) => {
    setSettings(next ?? { ...DEFAULT_SETTINGS });
  }, []);

  return {
    theme: settings.theme,
    settings,
    setTheme,
    toggleTheme,
    dismissAiNotice,
    replaceSettings,
  };
}
