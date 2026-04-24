import { useMemo, useState } from 'react';
import { Button, Input, Select, Tooltip, Typography } from '@douyinfe/semi-ui';
import { IconClose, IconPlus } from '@douyinfe/semi-icons';

import type { ConfigPublishState, HarnessInput, VehicleConfig } from '@/types/harness';
import '@/styles/common.css';

const { Text } = Typography;

interface Props {
  vehicleConfigs: VehicleConfig[];
  harnesses: HarnessInput[];
  publishState: ConfigPublishState;
  onAddConfig: () => void;
  onRemoveConfig: (configId: string) => void;
  onRenameConfig: (configId: string, name: string) => void;
  onToggleHarness: (configId: string, harnessId: string) => void;
  onUpdateSalesRatio: (configId: string, ratio: number) => void;
  onAddHarness: (harnessId: string, harnessName: string, functionalSlot: string) => void;
  onRemoveHarness: (harnessId: string) => void;
  onUpdateConfigType: (harnessId: string, configType: 'S' | 'O' | undefined) => void;
}

const COLUMN_BG = ['#dbeafe', '#d1fae5', '#fef3c7', '#ede9fe', '#fce7f3', '#cffafe', '#fee2e2', '#ecfccb'];
const COLUMN_TEXT = ['#1e40af', '#065f46', '#92400e', '#5b21b6', '#9d174d', '#155e75', '#991b1b', '#3f6212'];

export default function ConfigSetDiagram({
  vehicleConfigs,
  harnesses,
  publishState,
  onAddConfig,
  onRemoveConfig,
  onRenameConfig,
  onToggleHarness,
  onUpdateSalesRatio,
  onAddHarness,
  onRemoveHarness,
  onUpdateConfigType,
}: Props) {
  const isDraft = publishState === 'draft';
  const isEngineerPublished = publishState === 'engineer_published';
  const isSalesPublished = publishState === 'sales_published';

  const [newHarnessId, setNewHarnessId] = useState('');
  const [newHarnessName, setNewHarnessName] = useState('');
  const [newFunctionalSlot, setNewFunctionalSlot] = useState('');

  const ratioSum = vehicleConfigs.reduce((sum, config) => sum + config.salesRatio, 0);

  const upsetData = useMemo(() => {
    if (vehicleConfigs.length === 0 || harnesses.length === 0) {
      return null;
    }

    const intersections = new Map<string, { key: boolean[]; harnessIds: string[]; harnessNames: string[] }>();

    for (const harness of harnesses) {
      const membership = vehicleConfigs.map((config) => config.harnessIds.includes(harness.harnessId));
      const serialized = membership.map((included) => (included ? '1' : '0')).join(',');
      const current = intersections.get(serialized);

      if (current) {
        current.harnessIds.push(harness.harnessId);
        current.harnessNames.push(harness.harnessName);
      } else {
        intersections.set(serialized, {
          key: membership,
          harnessIds: [harness.harnessId],
          harnessNames: [harness.harnessName],
        });
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

    return {
      intersections: rows,
      configTotals: vehicleConfigs.map((config) => config.harnessIds.length),
    };
  }, [vehicleConfigs, harnesses]);

  const handleAddHarness = () => {
    const harnessId = newHarnessId.trim();
    if (!harnessId) {
      return;
    }
    if (harnesses.some((harness) => harness.harnessId === harnessId)) {
      return;
    }

    onAddHarness(
      harnessId,
      newHarnessName.trim() || harnessId,
      newFunctionalSlot.trim() || newHarnessName.trim() || harnessId,
    );

    setNewHarnessId('');
    setNewHarnessName('');
    setNewFunctionalSlot('');
  };

  return (
    <div>
      {isDraft && (
        <div
          style={{
            display: 'flex',
            gap: 12,
            marginBottom: 12,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <Button size="small" icon={<IconPlus />} onClick={onAddConfig}>
            新增配置
          </Button>
          {vehicleConfigs.length > 0 && (
            <Tooltip content="删除最后一个配置列">
              <Button
                size="small"
                theme="borderless"
                icon={<IconClose style={{ fontSize: 12 }} />}
                onClick={() => onRemoveConfig(vehicleConfigs[vehicleConfigs.length - 1]!.configId)}
              />
            </Tooltip>
          )}
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>|</span>
          <Input
            size="small"
            placeholder="功能位置"
            value={newFunctionalSlot}
            onChange={setNewFunctionalSlot}
            style={{ width: 180 }}
          />
          <Input
            size="small"
            placeholder="线束号"
            value={newHarnessId}
            onChange={setNewHarnessId}
            style={{ width: 180, fontFamily: "'JetBrains Mono', monospace" }}
          />
          <Input
            size="small"
            placeholder="线束名称"
            value={newHarnessName}
            onChange={setNewHarnessName}
            style={{ width: 240 }}
          />
          <Button size="small" icon={<IconPlus />} disabled={!newHarnessId.trim()} onClick={handleAddHarness}>
            添加线束
          </Button>
          {harnesses.length > 0 && (
            <Tooltip content="删除最后一条线束">
              <Button
                size="small"
                theme="borderless"
                icon={<IconClose style={{ fontSize: 12 }} />}
                onClick={() => onRemoveHarness(harnesses[harnesses.length - 1]!.harnessId)}
              />
            </Tooltip>
          )}
        </div>
      )}

      {isEngineerPublished && (
        <div style={{ marginBottom: 12 }}>
          <Text
            type={Math.abs(ratioSum - 1) > 0.005 ? 'danger' : 'tertiary'}
            strong={Math.abs(ratioSum - 1) > 0.005}
          >
            销售比例合计：{ratioSum.toFixed(3)}
            {Math.abs(ratioSum - 1) > 0.005 ? '（应为 1.000）' : ''}
          </Text>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table className="config-matrix">
          <thead>
            <tr>
              <th style={{ textAlign: 'left', minWidth: 160 }}>功能位置</th>
              <th style={{ textAlign: 'left', minWidth: 180 }}>线束号</th>
              <th style={{ textAlign: 'left', minWidth: 220 }}>线束名称</th>
              <th style={{ minWidth: 120 }}>标配/选配</th>
              {vehicleConfigs.map((config, index) => (
                <th
                  key={config.configId}
                  style={{
                    minWidth: 150,
                    background: COLUMN_BG[index % COLUMN_BG.length],
                    color: COLUMN_TEXT[index % COLUMN_TEXT.length],
                  }}
                >
                  {isDraft ? (
                    <Input
                      size="small"
                      value={config.configName}
                      onChange={(value) => onRenameConfig(config.configId, value)}
                      style={{ minWidth: 136, background: 'rgba(255,255,255,0.88)' }}
                    />
                  ) : (
                    config.configName
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isEngineerPublished && (
              <tr style={{ background: '#f9fafb' }}>
                <td className="fixed-col" style={{ fontWeight: 600, color: '#6b7280' }}>
                  销售比例
                </td>
                <td className="fixed-col" />
                <td className="fixed-col" />
                <td className="fixed-col" />
                {vehicleConfigs.map((config) => (
                  <td key={config.configId}>
                    <input
                      className="ratio-input"
                      type="number"
                      step="0.001"
                      defaultValue={config.salesRatio}
                      onBlur={(event) => {
                        const ratio = Number(event.target.value);
                        if (!Number.isNaN(ratio)) {
                          onUpdateSalesRatio(config.configId, ratio);
                        }
                      }}
                    />
                  </td>
                ))}
              </tr>
            )}
            {harnesses.map((harness) => {
              const configTypeText = harness.configType === 'S'
                ? 'S 标配'
                : harness.configType === 'O'
                  ? 'O 选配'
                  : '未设置';

              return (
                <tr key={harness.harnessId}>
                  <td className="fixed-col">{harness.functionalSlot || harness.harnessName}</td>
                  <td className="fixed-col" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                    {harness.harnessId}
                  </td>
                  <td className="fixed-col">{harness.harnessName}</td>
                  <td style={{ color: '#6b7280' }}>
                    {isDraft ? (
                      <Select
                        size="small"
                        insetLabel={null}
                        value={harness.configType ?? ''}
                        style={{ width: 120 }}
                        optionList={[
                          { value: '', label: '未设置' },
                          { value: 'S', label: 'S 标配' },
                          { value: 'O', label: 'O 选配' },
                        ]}
                        onChange={(value) => onUpdateConfigType(
                          harness.harnessId,
                          value === 'S' || value === 'O' ? value : undefined,
                        )}
                      />
                    ) : (
                      configTypeText
                    )}
                  </td>
                  {vehicleConfigs.map((config) => {
                    const included = config.harnessIds.includes(harness.harnessId);
                    return (
                      <td
                        key={config.configId}
                        className={`dot-cell${isSalesPublished ? ' readonly' : ''}`}
                        data-v={included ? '1' : '0'}
                        onClick={() => {
                          if (!isSalesPublished) {
                            onToggleHarness(config.configId, harness.harnessId);
                          }
                        }}
                      />
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {upsetData && upsetData.intersections.length > 0 && (
        <UpSetPlot
          intersections={upsetData.intersections}
          configNames={vehicleConfigs.map((config) => config.configName)}
          configTotals={upsetData.configTotals}
        />
      )}
    </div>
  );
}

interface UpSetPlotProps {
  intersections: { key: boolean[]; harnessIds: string[]; harnessNames: string[] }[];
  configNames: string[];
  configTotals: number[];
}

function UpSetPlot({ intersections, configNames, configTotals }: UpSetPlotProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const cellSize = 18;
  const chartTop = 12;
  const barHeight = 64;
  const matrixTop = chartTop + barHeight + 20;
  const leftLabelWidth = 140;
  const chartWidth = leftLabelWidth + intersections.length * 44 + 16;
  const chartHeight = matrixTop + configNames.length * 26 + 32;
  const maxCount = Math.max(...intersections.map((intersection) => intersection.harnessIds.length), 1);
  const maxConfigTotal = Math.max(...configTotals, 1);

  return (
    <div style={{ marginTop: 20 }}>
      <Text type="tertiary" size="small">
        交集预览：用于检查多配置共用线束是否录对。
      </Text>
      <svg
        width="100%"
        height={chartHeight}
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        style={{ marginTop: 8, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--panel-bg)' }}
      >
        {intersections.map((intersection, index) => {
          const x = leftLabelWidth + index * 44 + 12;
          const activeCount = intersection.harnessIds.length;
          const height = (activeCount / maxCount) * barHeight;
          return (
            <g
              key={`bar-${index}`}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex((current) => (current === index ? null : current))}
            >
              <rect x={x} y={chartTop + (barHeight - height)} width={24} height={height} rx={6} fill="#3b82f6" opacity={0.9} />
              <text x={x + 12} y={chartTop + (barHeight - height) - 6} textAnchor="middle" fontSize="11" fill="currentColor">
                {activeCount}
              </text>
              {intersection.key.map((active, rowIndex) => {
                const cy = matrixTop + rowIndex * 26 + 8;
                return (
                  <circle
                    key={`dot-${index}-${rowIndex}`}
                    cx={x + 12}
                    cy={cy}
                    r={cellSize / 3}
                    fill={active ? '#2563eb' : 'rgba(148, 163, 184, 0.35)'}
                  />
                );
              })}
            </g>
          );
        })}

        {configNames.map((configName, rowIndex) => {
          const y = matrixTop + rowIndex * 26 + 12;
          const total = configTotals[rowIndex] ?? 0;
          const totalWidth = (total / maxConfigTotal) * 96;
          return (
            <g key={`label-${configName}-${rowIndex}`}>
              <text x={10} y={y + 4} fontSize="12" fill="currentColor">
                {configName}
              </text>
              <rect x={leftLabelWidth - 104} y={y - 8} width={totalWidth} height={10} rx={5} fill="#10b981" opacity={0.85} />
              <text x={leftLabelWidth - 112} y={y + 2} textAnchor="end" fontSize="11" fill="currentColor">
                {total}
              </text>
            </g>
          );
        })}
      </svg>

      {hoveredIndex !== null && intersections[hoveredIndex] && (
        <div
          style={{
            marginTop: 8,
            padding: 10,
            borderRadius: 10,
            border: '1px solid var(--border)',
            background: 'rgba(59, 130, 246, 0.08)',
          }}
        >
          <Text strong>交集包含线束：</Text>
          <Text>{intersections[hoveredIndex]!.harnessIds.join('、')}</Text>
        </div>
      )}
    </div>
  );
}
