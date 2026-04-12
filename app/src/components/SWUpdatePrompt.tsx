import { useEffect } from 'react';
import { Toast } from '@douyinfe/semi-ui';
import { useRegisterSW } from 'virtual:pwa-register/react';

export default function SWUpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      // Check for updates every 60 minutes
      if (registration) {
        setInterval(() => { registration.update(); }, 60 * 60 * 1000);
      }
    },
  });

  useEffect(() => {
    if (needRefresh) {
      Toast.info({
        content: '发现新版本，正在更新...',
        duration: 3,
      });
      // Auto-update after 2 seconds
      setTimeout(() => updateServiceWorker(true), 2000);
    }
  }, [needRefresh, updateServiceWorker]);

  return null; // No visible UI — just handles SW lifecycle
}
