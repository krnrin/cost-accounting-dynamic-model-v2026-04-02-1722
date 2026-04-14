/**
 * apiErrorHandler - Enhanced error handling for apiClient responses.
 *
 * Provides:
 * - Structured error messages with HTTP status codes
 * - Network error detection
 * - Retry hints for transient failures (5xx)
 * - User-friendly error messages in Chinese
 *
 * Usage:
 *   import { handleApiError, isRetryableError } from '@/utils/apiErrorHandler';
 *   try {
 *     await apiClient('/endpoint');
 *   } catch (error) {
 *     const handled = handleApiError(error);
 *     if (isRetryableError(handled)) { /* retry logic * / }
 *   }
 */

export interface ApiError {
  status: number | null;
  message: string;
  userMessage: string;
  retryable: boolean;
  originalError: unknown;
}

const STATUS_MESSAGES: Record<number, string> = {
  400: '请求参数有误，请检查输入',
  401: '登录已过期，请重新登录',
  403: '无权限执行此操作',
  404: '请求的资源不存在',
  409: '数据冲突，请刷新后重试',
  422: '数据验证失败，请检查填写内容',
  429: '请求过于频繁，请稍后重试',
  500: '服务器内部错误，请稍后重试',
  502: '服务暂时不可用，请稍后重试',
  503: '服务维护中，请稍后重试',
};

export function handleApiError(error: unknown): ApiError {
  // Network error (no response)
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return {
      status: null,
      message: error.message,
      userMessage: '网络连接失败，请检查网络',
      retryable: true,
      originalError: error,
    };
  }

  // Response with status code
  if (error instanceof Error) {
    const statusMatch = error.message.match(/(\d{3})/);
    const status = statusMatch ? parseInt(statusMatch[1]!, 10) : null;
    const userMessage = status && STATUS_MESSAGES[status]
      ? STATUS_MESSAGES[status]
      : error.message || '操作失败，请重试';

    return {
      status,
      message: error.message,
      userMessage,
      retryable: status !== null && status >= 500,
      originalError: error,
    };
  }

  return {
    status: null,
    message: String(error),
    userMessage: '未知错误，请重试',
    retryable: false,
    originalError: error,
  };
}

export function isRetryableError(error: ApiError): boolean {
  return error.retryable;
}

/**
 * Retry a function up to maxRetries times with exponential backoff.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 2,
  baseDelayMs = 1000,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const handled = handleApiError(error);
      if (!handled.retryable || attempt === maxRetries) {
        throw error;
      }
      const delay = baseDelayMs * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}
