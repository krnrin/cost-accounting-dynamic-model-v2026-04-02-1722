import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef, ReactNode, CSSProperties } from 'react';

interface VirtualListProps<T> {
  items: T[];
  estimateSize: number;
  overscan?: number;
  containerHeight: number;
  containerStyle?: CSSProperties;
  renderItem: (item: T, index: number) => ReactNode;
}

export default function VirtualList<T>({ items, estimateSize, overscan = 5, containerHeight, containerStyle, renderItem }: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
  });

  return (
    <div ref={parentRef} style={{ height: containerHeight, overflow: 'auto', ...containerStyle }}>
      <div style={{ height: virtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {renderItem(items[virtualItem.index]!, virtualItem.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
