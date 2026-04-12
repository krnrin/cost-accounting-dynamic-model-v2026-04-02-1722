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
  400: '\u8BF7\u6C42\u53C2\u6570\u6709\u8BEF\uFF0C\u8BF7\u68C0\u67E5\u8F93\u5165',
  401: '\u767B\u5F55\u5DF2\u8FC7\u671F\uFF0C\u8BF7\u91CD\u65B0\u767B\u5F55',
  403: '\u65E0\u6743\u9650\u6267\u884C\u6B64\u64CD\u4F5C',
  404: '\u8BF7\u6C42\u7684\u8D44\u6E90\u4E0D\u5B58\u5728',
  409: '\u6570\u636E\u51B2\u7A81\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5',
  422: '\u6570\u636E\u9A8C\u8BC1\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u586B\u5199\u5185\u5BB9',
  429: '\u8BF7\u6C42\u8FC7\u4E8E\u9891\u7E41\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5',
  500: '\u670D\u52A1\u5668\u5185\u90E8\u9519\u8BEF\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5',
  502: '\u670D\u52A1\u6682\u65F6\u4E0D\u53EF\u7528\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5',
  503: '\u670D\u52A1\u7EF4\u62A4\u4E2D\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5',
};

export function handleApiError(error: unknown): ApiError {
  // Network error (no response)
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return {
      status: null,
      message: error.message,
      userMessage: '\u7F51\u7EDC\u8FDE\u63A5\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC',
      retryable: true,
      originalError: error,
    };
  }

  // Response with status code
  if (error instanceof Error) {
    const statusMatch = error.message.match(/(\d{3})/);
    const status = statusMatch ? parseInt(statusMatch[1], 10) : null;
    const userMessage = status && STATUS_MESSAGES[status]
      ? STATUS_MESSAGES[status]
      : error.message || '\u64CD\u4F5C\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5';

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
    userMessage: '\u672A\u77E5\u9519\u8BEF\uFF0C\u8BF7\u91CD\u8BD5',
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
