/**
 * useGlobalErrorHandler - Global error capture for unhandled errors.
 *
 * Mount once in App.tsx to catch:
 * - Unhandled promise rejections (e.g. forgotten await, API failures)
 * - Uncaught runtime errors
 *
 * Shows user-friendly Toast notifications and logs structured errors.
 *
 * Usage:
 *   function App() {
 *     useGlobalErrorHandler();
 *     return <Routes>...</Routes>;
 *   }
 */
import { useEffect } from 'react';
import { Toast } from '@douyinfe/semi-ui';

type ErrorContext = {
  source: 'unhandledrejection' | 'error';
  message: string;
  stack?: string;
  timestamp: string;
};

function buildContext(
  source: ErrorContext['source'],
  error: unknown,
): ErrorContext {
  const timestamp = new Date().toISOString();
  if (error instanceof Error) {
    return { source, message: error.message, stack: error.stack, timestamp };
  }
  return { source, message: String(error), timestamp };
}

/** Suppress noisy errors that don't affect the user */
function isNoisyError(msg: string): boolean {
  const noisy = [
    'ResizeObserver loop',
    'Loading chunk',
    'Failed to fetch dynamically imported module',
    'NetworkError',
  ];
  return noisy.some(pattern => msg.includes(pattern));
}

export function useGlobalErrorHandler() {
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const ctx = buildContext('unhandledrejection', event.reason);
      if (isNoisyError(ctx.message)) return;

      console.error('[GlobalErrorHandler] Unhandled rejection:', ctx);

      // User-facing toast for API/network errors
      if (ctx.message.includes('fetch') || ctx.message.includes('API') || ctx.message.includes('network')) {
        Toast.error({
          content: '网络请求失败，请检查网络连接',
          duration: 5,
        });
      }
    };

    const handleError = (event: ErrorEvent) => {
      const ctx = buildContext('error', event.error || event.message);
      if (isNoisyError(ctx.message)) return;

      console.error('[GlobalErrorHandler] Uncaught error:', ctx);
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);
}

export default useGlobalErrorHandler;
