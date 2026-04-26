/**
 * 跨 Tab 数据同步工具
 * 使用 BroadcastChannel 实现多标签页状态同步
 */

const CHANNEL_NAME = 'store-invalidation';

export interface StoreInvalidationMessage {
  type: 'store-invalidate';
  storeName: string;
  projectId?: string;
  scenarioId?: string;
  timestamp: number;
}

type InvalidationHandler = (message: StoreInvalidationMessage) => void;

let channel: BroadcastChannel | null = null;
const handlers: Set<InvalidationHandler> = new Set();

/**
 * 初始化 BroadcastChannel
 */
function ensureChannel(): BroadcastChannel {
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent<StoreInvalidationMessage>) => {
      if (event.data?.type === 'store-invalidate') {
        handlers.forEach((handler) => handler(event.data));
      }
    };
  }
  return channel;
}

/**
 * 广播 store 失效消息
 */
export function broadcastStoreInvalidation(
  storeName: string,
  options?: { projectId?: string; scenarioId?: string }
): void {
  const ch = ensureChannel();
  const message: StoreInvalidationMessage = {
    type: 'store-invalidate',
    storeName,
    projectId: options?.projectId,
    scenarioId: options?.scenarioId,
    timestamp: Date.now(),
  };
  ch.postMessage(message);
}

/**
 * 订阅 store 失效消息
 */
export function subscribeToStoreInvalidation(handler: InvalidationHandler): () => void {
  ensureChannel();
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}

/**
 * 检查 BroadcastChannel 是否可用
 */
export function isBroadcastChannelSupported(): boolean {
  return typeof BroadcastChannel !== 'undefined';
}
