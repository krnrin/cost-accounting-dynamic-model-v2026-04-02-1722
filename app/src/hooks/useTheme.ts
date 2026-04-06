import { useEffect } from 'react';
import { useSettingsStore } from '@/store/settingsStore';

export function useTheme() {
  const themeMode = useSettingsStore((s) => s.themeMode);

  useEffect(() => {
    // 强制锁死在 dark 模式以实现毛玻璃发光特效
    document.body.setAttribute('theme-mode', 'dark');
  }, [themeMode]);
}
