/**
 * engine/error_boundary.js
 * Issue #12: 统一错误边界包装器
 *
 * 职责：
 * 1. 包装任意计算函数，捕获异常并返回安全的 fallback
 * 2. 记录错误日志（可选上报）
 * 3. 防止单个模块崩溃导致整个 Dashboard 白屏
 */
;(function (global) {
  'use strict';

  const errorLog = [];
  const MAX_LOG_SIZE = 200;

  /**
   * 包装同步函数，异常时返回 fallback
   * @param {string} label  模块/函数标识
   * @param {Function} fn   要包装的函数
   * @param {*} fallback    异常时的返回值
   * @returns {Function}
   */
  function wrapSync(label, fn, fallback) {
    return function wrappedSync() {
      try {
        return fn.apply(this, arguments);
      } catch (error) {
        recordError(label, error);
        return typeof fallback === 'function' ? fallback() : fallback;
      }
    };
  }

  /**
   * 包装异步函数，异常时返回 fallback
   * @param {string} label
   * @param {Function} fn
   * @param {*} fallback
   * @returns {Function}
   */
  function wrapAsync(label, fn, fallback) {
    return async function wrappedAsync() {
      try {
        return await fn.apply(this, arguments);
      } catch (error) {
        recordError(label, error);
        return typeof fallback === 'function' ? fallback() : fallback;
      }
    };
  }

  /**
   * 带超时的异步执行
   * @param {string} label
   * @param {Function} fn
   * @param {number} timeoutMs  超时毫秒数
   * @param {*} fallback
   * @returns {Promise}
   */
  function withTimeout(label, fn, timeoutMs, fallback) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        recordError(label, new Error(`Timeout after ${timeoutMs}ms`));
        resolve(typeof fallback === 'function' ? fallback() : fallback);
      }, timeoutMs);

      Promise.resolve()
        .then(() => fn())
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          recordError(label, error);
          resolve(typeof fallback === 'function' ? fallback() : fallback);
        });
    });
  }

  function recordError(label, error) {
    const entry = {
      label,
      message: String(error?.message || error),
      stack: error?.stack ? error.stack.split('\n').slice(0, 5).join('\n') : '',
      timestamp: new Date().toISOString(),
    };
    errorLog.push(entry);
    if (errorLog.length > MAX_LOG_SIZE) {
      errorLog.splice(0, errorLog.length - MAX_LOG_SIZE);
    }
    console.error(`[ErrorBoundary:${label}]`, error);
  }

  function getErrorLog() {
    return errorLog.slice();
  }

  function clearErrorLog() {
    errorLog.length = 0;
  }

  global.G281ErrorBoundary = {
    wrapSync,
    wrapAsync,
    withTimeout,
    getErrorLog,
    clearErrorLog,
  };

  // P2#8: Node.js module.exports
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.G281ErrorBoundary;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
