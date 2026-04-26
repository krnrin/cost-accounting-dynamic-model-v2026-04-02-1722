/**
 * C4: Trace ID
 * 计算链路追踪，包装任意引擎函数添加性能监控
 */

let _traceCounter = 0;

export function generateTraceId(): string {
  _traceCounter++;
  return `trace-${Date.now()}-${_traceCounter}-${Math.random().toString(36).substring(2, 6)}`;
}

export interface TraceLog {
  traceId: string;
  step: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  duration: number;
  timestamp: string;
}

const _traceLogs: TraceLog[] = [];
const MAX_LOGS = 1000;

export function withTrace<T extends (...args: any[]) => any>(
  fn: T,
  stepName: string
): T {
  return ((...args: any[]) => {
    const traceId = generateTraceId();
    const start = performance.now();
    const result = fn(...args);

    // 检测是否为 Promise
    if (result && typeof result.then === 'function') {
      return result
        .then((resolved: unknown) => {
          const duration = performance.now() - start;
          const log: TraceLog = {
            traceId,
            step: stepName,
            input: args.length === 1 ? args[0] : { args },
            output: resolved as Record<string, unknown>,
            duration,
            timestamp: new Date().toISOString(),
          };
          _traceLogs.push(log);
          if (_traceLogs.length > MAX_LOGS) _traceLogs.splice(0, _traceLogs.length - MAX_LOGS);
          if (duration > 100) {
            console.warn(`[TRACE] ${stepName} (async) took ${duration.toFixed(1)}ms`, { traceId });
          }
          return resolved;
        })
        .catch((err: Error) => {
          const duration = performance.now() - start;
          const log: TraceLog = {
            traceId,
            step: `${stepName} (error)`,
            input: args.length === 1 ? args[0] : { args },
            output: { error: err.message },
            duration,
            timestamp: new Date().toISOString(),
          };
          _traceLogs.push(log);
          throw err;
        });
    }

    // 同步函数
    const duration = performance.now() - start;
    const log: TraceLog = {
      traceId,
      step: stepName,
      input: args.length === 1 ? args[0] : { args },
      output: result,
      duration,
      timestamp: new Date().toISOString(),
    };

    _traceLogs.push(log);
    if (_traceLogs.length > MAX_LOGS) _traceLogs.splice(0, _traceLogs.length - MAX_LOGS);

    if (duration > 100) {
      console.warn(`[TRACE] ${stepName} took ${duration.toFixed(1)}ms`, { traceId });
    }

    return result;
  }) as unknown as T;
}

export function getRecentTraces(limit = 50): TraceLog[] {
  return _traceLogs.slice(-limit).reverse();
}

export function getTracesByStep(stepName: string, limit = 20): TraceLog[] {
  return _traceLogs.filter(l => l.step === stepName).slice(-limit).reverse();
}
