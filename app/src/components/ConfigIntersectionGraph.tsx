import { useMemo, useState } from 'react';
import { Empty, Typography } from '@douyinfe/semi-ui';

import type { HarnessInput, VehicleConfig } from '@/types/harness';

const { Text } = Typography;

interface Props {
  vehicleConfigs: VehicleConfig[];
  harnesses: HarnessInput[];
}

export default function ConfigIntersectionGraph({ vehicleConfigs, harnesses }: Props) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const graphData = useMemo(() => {
    if (vehicleConfigs.length === 0 || harnesses.length === 0) {
      return null;
    }

    const intersections = new Map<string, { key: boolean[]; harnessIds: string[] }>();
    for (const harness of harnesses) {
      const key = vehicleConfigs.map((config) => config.harnessIds.includes(harness.harnessId));
      if (!key.some(Boolean)) {
        continue;
      }
      const serialized = key.map((value) => (value ? '1' : '0')).join(',');
      const current = intersections.get(serialized);
      if (current) {
        current.harnessIds.push(harness.harnessId);
      } else {
        intersections.set(serialized, { key, harnessIds: [harness.harnessId] });
      }
    }

    const rows = [...intersections.values()].sort((left, right) => {
      const leftCardinality = left.key.filter(Boolean).length;
      const rightCardinality = right.key.filter(Boolean).length;
      if (rightCardinality !== leftCardinality) {
        return rightCardinality - leftCardinality;
      }
      return right.harnessIds.length - left.harnessIds.length;
    });

    if (rows.length === 0) {
      return null;
    }

    return {
      intersections: rows,
      configTotals: vehicleConfigs.map((config) => config.harnessIds.length),
    };
  }, [vehicleConfigs, harnesses]);

  if (!graphData) {
    return (
      <Empty
        title="暂无交并集关系图"
        description="录入配置列并标记线束归属后，这里会自动显示各配置之间的交并集关系。"
      />
    );
  }

  const { intersections, configTotals } = graphData;
  const cellSize = 18;
  const chartTop = 12;
  const barHeight = 72;
  const matrixTop = chartTop + barHeight + 24;
  const leftLabelWidth = 160;
  const chartWidth = leftLabelWidth + intersections.length * 52 + 24;
  const chartHeight = matrixTop + vehicleConfigs.length * 28 + 40;
  const maxCount = Math.max(...intersections.map((intersection) => intersection.harnessIds.length), 1);
  const maxConfigTotal = Math.max(...configTotals, 1);

  return (
    <div className="config-intersection-graph">
      <Text type="tertiary" size="small">
        交并集关系图：用于检查哪些线束被多个配置共用，哪些仅属于单一配置。
      </Text>
      <svg
        width="100%"
        height={chartHeight}
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        style={{
          marginTop: 8,
          borderRadius: 16,
          border: '1px solid var(--border)',
          background: 'rgba(255,255,255,0.55)',
          backdropFilter: 'blur(10px)',
        }}
      >
        {intersections.map((intersection, index) => {
          const x = leftLabelWidth + index * 52 + 14;
          const activeCount = intersection.harnessIds.length;
          const height = (activeCount / maxCount) * barHeight;
          return (
            <g
              key={`intersection-${index}`}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex((current) => (current === index ? null : current))}
            >
              <rect x={x} y={chartTop + (barHeight - height)} width={28} height={height} rx={8} fill="#3b82f6" opacity={0.9} />
              <text x={x + 14} y={chartTop + (barHeight - height) - 6} textAnchor="middle" fontSize="11" fill="currentColor">
                {activeCount}
              </text>
              {intersection.key.map((active, rowIndex) => {
                const cy = matrixTop + rowIndex * 28 + 10;
                return (
                  <circle
                    key={`cell-${index}-${rowIndex}`}
                    cx={x + 14}
                    cy={cy}
                    r={cellSize / 3}
                    fill={active ? '#2563eb' : 'rgba(148, 163, 184, 0.28)'}
                  />
                );
              })}
            </g>
          );
        })}

        {vehicleConfigs.map((config, rowIndex) => {
          const y = matrixTop + rowIndex * 28 + 14;
          const total = configTotals[rowIndex] ?? 0;
          const totalWidth = (total / maxConfigTotal) * 110;
          return (
            <g key={`config-${config.configId}`}>
              <text x={10} y={y + 4} fontSize="12" fill="currentColor">
                {config.configName}
              </text>
              <rect x={leftLabelWidth - 114} y={y - 8} width={totalWidth} height={12} rx={6} fill="#10b981" opacity={0.8} />
              <text x={leftLabelWidth - 122} y={y + 3} textAnchor="end" fontSize="11" fill="currentColor">
                {total}
              </text>
            </g>
          );
        })}
      </svg>

      {hoveredIndex !== null && intersections[hoveredIndex] && (
        <div
          style={{
            marginTop: 10,
            padding: 12,
            borderRadius: 12,
            border: '1px solid rgba(59,130,246,0.18)',
            background: 'rgba(59,130,246,0.08)',
          }}
        >
          <Text strong>当前交集包含线束：</Text>
          <Text>{intersections[hoveredIndex]!.harnessIds.join('、')}</Text>
        </div>
      )}
    </div>
  );
}
