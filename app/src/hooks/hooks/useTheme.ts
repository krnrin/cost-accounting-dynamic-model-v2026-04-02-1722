import { useEffect } from 'react';
import { useSettingsStore } from '@/store/settingsStore';

export function useTheme() {
  const themeMode = useSettingsStore((s) => s.themeMode);

  useEffect(() => {
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;
    const resolvedTheme = themeMode === 'system' ? (prefersDark ? 'dark' : 'light') : themeMode;
    document.body.setAttribute('theme-mode', resolvedTheme);
  }, [themeMode]);
}
