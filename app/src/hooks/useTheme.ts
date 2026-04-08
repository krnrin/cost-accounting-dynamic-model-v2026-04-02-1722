import { useEffect } from 'react';
import { useSettingsStore } from '@/store/settingsStore';

export function useTheme() {
  const themeMode = useSettingsStore((s) => s.themeMode);

  useEffect(() => {
    // Elite Industrial UI — light mode with glass panels over subtle factory watermark
    document.body.setAttribute('theme-mode', 'light');
  }, [themeMode]);
}
