/**
 * 预警中心 — 金属价格预警 + 分摊回收预警 + 异常跟踪预警
 */
import { useEffect, useState, useMemo } from 'react';
import {
  Typography, Table, Tag, Empty, Tabs, TabPane, Select, Spin,
} from '@douyinfe/semi-ui';
import { IconAlertTriangle } from '@douyinfe/semi-icons';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import { computeMetalAlerts, estimateMetalImpact, type MetalAlertItem, type AlertLevel } from '@/engine/metal_alert';
import { useTrackingStore } from '@/store/trackingStore';
import { useSettingsStore } from '@/store/settingsStore';
import type { MetalPrices } from '@/types/project';

const { Title, Text } = Typography;

const LEVEL_CONFIG: Record<AlertLevel, { color: string; bg: string; border: string; label: string; dot: string }> = {
  normal: { color: '#71717a', bg: 'rgba(0,0,0,0.03)', border: 'rgba(0,0,0,0.06)', label: '正常', dot: '#a1a1aa' },
  warn: { color: '#d97706', bg: 'rgba(217,119,6,0.06)', border: 'rgba(217,119,6,0.12)', label: '预警', dot: '#d97706' },
  danger: { color: '#dc2626', bg: 'rgba(220,38,38,0.06)', border: 'rgba(220,38,38,0.12)', label: '危险', dot: '#dc2626' },
};

type AlertRow = {
  id: string;
  type: 'metal' | 'alloc' | 'anomaly';
  typeLabel: string;
  title: string;
  level: AlertLevel;
  impact: number;
  detail: string;
  project?: string;
  date: string;
};

export default function AlertsPage() {
  const [activeTab, setActiveTab] = useState('all');
  const [levelFilter, setLevelFilter] = useState<string | undefined>();

  const projects = useLiveQuery(() => db.projects.toArray(), []);
  const allHarnesses = useLiveQuery(() => db.harnesses.toArray(), []);
  const { items: trackingItems, loadItems } = useTrackingStore();
  const settings = useSettingsStore();

  useEffect(() => {
    if (projects?.length) {
      projects.forEach(p => loadItems(p.id));
    }
  }, [projects, loadItems]);

  const alertRows = useMemo<AlertRow[]>(() => {
    if (!projects?.length) return [];
    const rows: AlertRow[] = [];
    const now = new Date().toISOString().slice(0, 10);
    const currentPrices: MetalPrices = settings.defaultMetalPrices;
    const thresholds = {
      copper: { warnPct: settings.alertThresholds.copperPercent || 5, dangerPct: (settings.alertThresholds.copperPercent || 5) * 2 },
      aluminum: { warnPct: settings.alertThresholds.aluminumPercent || 5, dangerPct: (settings.alertThresholds.aluminumPercent || 5) * 2 },
    };

    for (const proj of projects) {
      const basePrices: MetalPrices = proj.config?.metalPrices || currentPrices;
      const result = computeMetalAlerts(basePrices, currentPrices, thresholds);
      for (const item of result.items) {
        if (item.level !== 'normal') {
          rows.push({
            id: `metal-${proj.id}-${item.metal}`,
            type: 'metal',
            typeLabel: '金属价格',
            title: `${item.label}${item.deltaPct > 0 ? '上涨' : '下跌'} ${Math.abs(item.deltaPct).toFixed(1)}%`,
            level: item.level,
            impact: item.deltaPrice,
            detail: item.message,
            project: proj.name,
            date: now,
          });
        }
      }
    }

    for (const item of trackingItems) {
      if (item.status === 'open' || item.status === 'investigating') {
        const proj = projects.find(p => p.id === item.projectId);
        rows.push({
          id: `anomaly-${item.id}`,
          type: 'anomaly',
          typeLabel: item.category === 'recovery' ? '费用追回' : '异常问题',
          title: item.title,
          level: item.priority === 'high' ? 'danger' : item.priority === 'medium' ? 'warn' : 'normal',
          impact: item.costImpact,
          detail: item.description || '',
          project: proj?.name,
          date: item.createdAt?.slice(0, 10) || now,
        });
      }
    }

    if (allHarnesses?.length) {
      db.onetimeCosts.toArray().then(() => {});
    }

    return rows.sort((a, b) => {
      const levelOrder: Record<AlertLevel, number> = { danger: 0, warn: 1, normal: 2 };
      return levelOrder[a.level] - levelOrder[b.level];
    });
  }, [projects, allHarnesses, trackingItems, settings]);

  const filtered = useMemo(() => {
    let list = alertRows;
    if (activeTab === 'metal') list = list.filter(r => r.type === 'metal');
    if (activeTab === 'anomaly') list = list.filter(r => r.type === 'anomaly');
    if (activeTab === 'alloc') list = list.filter(r => r.type === 'alloc');
    if (levelFilter) list = list.filter(r => r.level === levelFilter);
    return list;
  }, [alertRows, activeTab, levelFilter]);

  const kpi = useMemo(() => {
    const total = alertRows.length;
    const dangerCount = alertRows.filter(r => r.level === 'danger').length;
    const warnCount = alertRows.filter(r => r.level === 'warn').length;
    const totalImpact = alertRows.reduce((s, r) => s + Math.abs(r.impact), 0);
    return { total, dangerCount, warnCount, totalImpact };
  }, [alertRows]);

  const columns = [
    {
      title: '类别',
      dataIndex: 'typeLabel',
      width: 120,
      render: (v: string) => <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{v}</span>,
    },
    {
      title: '预警内容',
      dataIndex: 'title',
      width: 280,
      render: (v: string) => <Text strong ellipsis={{ showTooltip: true }} style={{ maxWidth: 260, fontSize: 13 }}>{v}</Text>,
    },
    {
      title: '级别',
      dataIndex: 'level',
      width: 90,
      align: 'center' as const,
      render: (v: AlertLevel) => {
        const cfg = LEVEL_CONFIG[v];
        return (
          <span style={{ fontSize: 12, fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
        );
      },
    },
    {
      title: '影响金额',
      dataIndex: 'impact',
      width: 130,
      align: 'right' as const,
      render: (v: number) => (
        <span className="consolas-font" style={{
          fontWeight: 800, fontSize: 14,
          color: v > 0 ? '#dc2626' : v < 0 ? '#059669' : '#000',
        }}>
          {v > 0 ? '+' : ''}¥{Math.abs(v).toFixed(2)}
        </span>
      ),
    },
    {
      title: '关联项目',
      dataIndex: 'project',
      width: 160,
      render: (v: string) => v ? (
        <span style={{ fontSize: 12, fontWeight: 600 }}>{v}</span>
      ) : <Text type="tertiary">-</Text>,
    },
    {
      title: '详情',
      dataIndex: 'detail',
      render: (v: string) => <Text type="tertiary" ellipsis={{ showTooltip: true }} style={{ maxWidth: 300, fontSize: 12 }}>{v || '-'}</Text>,
    },
    {
      title: '日期',
      dataIndex: 'date',
      width: 110,
      render: (v: string) => <span className="consolas-font" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{v}</span>,
    },
  ];

  if (!projects) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: 400 }}><Spin size="large" /></div>;
  }

  return (
    <div className="page-container" style={{ maxWidth: 1400, margin: '0 auto' }}>
      <Title heading={2} className="ink-heading" style={{ marginBottom: 28 }}>预警中心</Title>

      {/* KPI Cards — custom styled */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: '活跃预警', value: kpi.total, suffix: ' 条', color: '#000' },
          { label: '危险级别', value: kpi.dangerCount, suffix: ' 条', color: kpi.dangerCount > 0 ? '#dc2626' : '#000' },
          { label: '预警级别', value: kpi.warnCount, suffix: ' 条', color: kpi.warnCount > 0 ? '#d97706' : '#000' },
          { label: '总影响金额', value: `¥${kpi.totalImpact.toFixed(2)}`, color: '#000' },
        ].map(card => (
            <div key={card.label} className="glass-card animate-fade-up" style={{ padding: '24px 20px' }}>
              <Text style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {card.label}
              </Text>
              <div className="consolas-font" style={{ fontSize: 30, fontWeight: 800, color: card.color, lineHeight: 1 }}>
                {typeof card.value === 'number' ? card.value : card.value}
                {typeof card.value === 'number' && <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', marginLeft: 2 }}>{card.suffix}</span>}
              </div>
            </div>
        ))}
      </div>

      {/* Tabs + Filter + Table */}
      <div className="glass-card animate-fade-up" style={{ padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <Tabs type="button" activeKey={activeTab} onChange={setActiveTab} style={{ marginBottom: 0 }}>
            <TabPane tab="全部" itemKey="all" />
            <TabPane tab="金属价格" itemKey="metal" />
            <TabPane tab="异常跟踪" itemKey="anomaly" />
            <TabPane tab="分摊回收" itemKey="alloc" />
          </Tabs>
          <Select
            placeholder="按级别筛选"
            style={{ width: 150 }}
            value={levelFilter}
            onChange={v => setLevelFilter(v as string | undefined)}
            showClear
            optionList={[
              { value: 'danger', label: '危险' },
              { value: 'warn', label: '预警' },
              { value: 'normal', label: '正常' },
            ]}
          />
        </div>
        <Table
          columns={columns}
          dataSource={filtered}
          rowKey="id"
          pagination={{ pageSize: 20 }}
          empty={
            <Empty description="暂无预警信息" style={{ padding: '60px 0' }}>
              <div style={{ fontSize: 48, opacity: 0.15, marginBottom: 8 }}>
                <IconAlertTriangle />
              </div>
            </Empty>
          }
          size="small"
          scroll={{ x: 1100 }}
        />
      </div>
    </div>
  );
}
