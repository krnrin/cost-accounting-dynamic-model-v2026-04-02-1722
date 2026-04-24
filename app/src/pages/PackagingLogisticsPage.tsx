/**
 * 包装物流费用管理页面 (F10 包装物流费用)
 *
 * 功能：
 * 1. 显示项目下所有线束的包装物流费用
 * 2. 可编辑表格录入各项费用
 * 3. 成本计算按场景选择触发，不在本页面实时计算
 *
 * 责任角色：包装物流工程师
 *
 * 全成本口径说明：
 * - 内包装费 + 外包装费 = 包装费小计
 * - 运费 + 超额运费 + 短驳费 + 三方仓费 + 仓储费 = 物流费小计
 * - 包装费小计 + 物流费小计 = 合计（全成本口径，约12.64元/PCS）
 */
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Typography, Spin, Table, Row, Col, Toast, InputNumber,
  Button, Empty, Tag, Space,
} from '@douyinfe/semi-ui';
import { IconSave, IconRefresh } from '@douyinfe/semi-icons';
import { db } from '@/data/db';
import type { ProjectRecord } from '@/data/db';
import { usePackagingStore } from '@/store/packagingStore';
import {
  type PackagingLogisticsCost,
  createEmptyPackagingLogisticsCost,
  calculatePackagingLogisticsTotals,
} from '@/types/packaging';

const { Title, Text } = Typography;

/** 编辑行数据 */
interface EditRow extends PackagingLogisticsCost {
  /** 是否有修改 */
  _changed?: boolean;
}

export default function PackagingLogisticsPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [editRows, setEditRows] = useState<EditRow[]>([]);
  const [saving, setSaving] = useState(false);

  const {
    loadPackagingLogistics,
    batchSavePackagingLogistics
  } = usePackagingStore();

  // 加载数据
  const loadData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const p = await db.projects.get(projectId);
      if (!p) return;
      setProject(p);

      // 并行加载线束数据和已有的包装物流费用
      const [hRecords, existingRecords] = await Promise.all([
        db.harnesses.where('projectId').equals(projectId).toArray(),
        db.packagingLogistics.where('projectId').equals(projectId).toArray(),
      ]);

      // 构建编辑行
      const existingMap = new Map(existingRecords.map(r => [r.harnessId, r.cost]));

      const rows: EditRow[] = hRecords.map(h => {
        const existing = existingMap.get(h.harnessId);
        return existing
          ? { ...existing, _changed: false }
          : {
              ...createEmptyPackagingLogisticsCost(h.harnessId, h.harnessName),
              _changed: false
            };
      });
      setEditRows(rows);

      // 同时更新 store 状态（用于其他组件同步）
      await loadPackagingLogistics(projectId);
    } catch (err) {
      console.error('PackagingLogistics load error:', err);
      Toast.error('加载失败: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  }, [projectId, loadPackagingLogistics]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 更新编辑行（仅更新输入值，不实时计算小计）
  const updateRow = (harnessId: string, field: keyof PackagingLogisticsCost, value: number) => {
    setEditRows(prev =>
      prev.map(r => {
        if (r.harnessId === harnessId) {
          const updated = { ...r, [field]: value, _changed: true };
          // 计算小计（仅用于显示，不触发成本计算）
          const totals = calculatePackagingLogisticsTotals(updated);
          return { ...updated, ...totals };
        }
        return r;
      })
    );
  };

  // 保存全部
  const handleSave = async () => {
    if (!projectId) return;
    setSaving(true);
    try {
      const changedRows = editRows.filter(r => r._changed);
      if (changedRows.length === 0) {
        Toast.info('没有需要保存的更改');
        return;
      }

      const costs: PackagingLogisticsCost[] = changedRows.map(r => {
        const { _changed, ...cost } = r;
        return cost as PackagingLogisticsCost;
      });

      await batchSavePackagingLogistics(projectId, costs);
      Toast.success(`已保存 ${costs.length} 条包装物流费用`);

      // 重置修改标记
      setEditRows(prev => prev.map(r => ({ ...r, _changed: false })));
    } catch (err) {
      Toast.error('保存失败: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  };

  // 统计数据
  const recordedCount = editRows.filter(r => r.grandTotal > 0).length;
  const totalCount = editRows.length;

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!project) {
    return <Empty description="未找到项目" />;
  }

  // 列定义
  const columns = [
    {
      title: '零件号',
      dataIndex: 'harnessId',
      width: 120,
      fixed: 'left' as const,
      render: (v: string) => (
        <Text strong style={{ fontFamily: 'JetBrains Mono, Consolas, monospace' }}>
          {v}
        </Text>
      ),
    },
    {
      title: '名称',
      dataIndex: 'harnessName',
      width: 140,
    },
    // ── 包装费用 ──
    {
      title: '内包装费',
      dataIndex: 'innerPackaging',
      width: 100,
      align: 'right' as const,
      render: (v: number, record: EditRow) => (
        <InputNumber
          value={v}
          min={0}
          step={0.1}
          precision={4}
          style={{ width: '100%' }}
          onChange={(val) => updateRow(record.harnessId, 'innerPackaging', Number(val) || 0)}
        />
      ),
    },
    {
      title: '外包装费',
      dataIndex: 'outerPackaging',
      width: 100,
      align: 'right' as const,
      render: (v: number, record: EditRow) => (
        <InputNumber
          value={v}
          min={0}
          step={0.1}
          precision={4}
          style={{ width: '100%' }}
          onChange={(val) => updateRow(record.harnessId, 'outerPackaging', Number(val) || 0)}
        />
      ),
    },
    {
      title: '包装小计',
      dataIndex: 'totalPackaging',
      width: 100,
      align: 'right' as const,
      render: (v: number) => (
        <span className="ledger-number" style={{ fontWeight: 600, color: '#0369a1' }}>
          ¥{v.toFixed(4)}
        </span>
      ),
    },
    // ── 物流费用 ──
    {
      title: '运费',
      dataIndex: 'freight',
      width: 90,
      align: 'right' as const,
      render: (v: number, record: EditRow) => (
        <InputNumber
          value={v}
          min={0}
          step={0.1}
          precision={4}
          style={{ width: '100%' }}
          onChange={(val) => updateRow(record.harnessId, 'freight', Number(val) || 0)}
        />
      ),
    },
    {
      title: '超额运费',
      dataIndex: 'excessFreight',
      width: 100,
      align: 'right' as const,
      render: (v: number, record: EditRow) => (
        <InputNumber
          value={v}
          min={0}
          step={0.1}
          precision={4}
          style={{ width: '100%' }}
          onChange={(val) => updateRow(record.harnessId, 'excessFreight', Number(val) || 0)}
        />
      ),
    },
    {
      title: '短驳费',
      dataIndex: 'shortHaul',
      width: 90,
      align: 'right' as const,
      render: (v: number, record: EditRow) => (
        <InputNumber
          value={v}
          min={0}
          step={0.1}
          precision={4}
          style={{ width: '100%' }}
          onChange={(val) => updateRow(record.harnessId, 'shortHaul', Number(val) || 0)}
        />
      ),
    },
    {
      title: '三方仓费',
      dataIndex: 'thirdPartyWarehouse',
      width: 100,
      align: 'right' as const,
      render: (v: number, record: EditRow) => (
        <InputNumber
          value={v}
          min={0}
          step={0.1}
          precision={4}
          style={{ width: '100%' }}
          onChange={(val) => updateRow(record.harnessId, 'thirdPartyWarehouse', Number(val) || 0)}
        />
      ),
    },
    {
      title: '仓储费',
      dataIndex: 'storage',
      width: 90,
      align: 'right' as const,
      render: (v: number, record: EditRow) => (
        <InputNumber
          value={v}
          min={0}
          step={0.1}
          precision={4}
          style={{ width: '100%' }}
          onChange={(val) => updateRow(record.harnessId, 'storage', Number(val) || 0)}
        />
      ),
    },
    {
      title: '物流小计',
      dataIndex: 'totalLogistics',
      width: 100,
      align: 'right' as const,
      render: (v: number) => (
        <span className="ledger-number" style={{ fontWeight: 600, color: '#047857' }}>
          ¥{v.toFixed(4)}
        </span>
      ),
    },
    // ── 合计 ──
    {
      title: '合计',
      dataIndex: 'grandTotal',
      width: 100,
      align: 'right' as const,
      fixed: 'right' as const,
      render: (v: number) => (
        <span className="ledger-number" style={{ fontWeight: 700, color: '#dc2626', fontSize: 14 }}>
          ¥{v.toFixed(4)}
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'grandTotal',
      width: 80,
      align: 'center' as const,
      fixed: 'right' as const,
      render: (v: number) => (
        v > 0
          ? <Tag color="blue" size="small">已录入</Tag>
          : <Tag color="grey" size="small">待录入</Tag>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1600, margin: '0 auto', paddingBottom: 64 }}>
      <Row gutter={[24, 24]}>
        {/* 汇总 KPI 卡片 */}
        <Col span={6}>
          <div className="glass-card" style={{ padding: 24, height: '100%' }}>
            <Text style={{ fontWeight: 600, fontSize: 13, color: '#71717a' }}>线束总数</Text>
            <div className="ledger-number" style={{ fontSize: 28, marginTop: 8 }}>
              {totalCount}
            </div>
          </div>
        </Col>
        <Col span={6}>
          <div className="glass-card" style={{ padding: 24, height: '100%' }}>
            <Text style={{ fontWeight: 600, fontSize: 13, color: '#71717a' }}>已录入</Text>
            <div className="ledger-number" style={{ fontSize: 28, marginTop: 8, color: '#2563eb' }}>
              {recordedCount}
            </div>
            <Text style={{ fontSize: 12, color: '#71717a', marginTop: 4, display: 'block' }}>
              录入率: {totalCount > 0 ? ((recordedCount / totalCount) * 100).toFixed(1) : 0}%
            </Text>
          </div>
        </Col>
        <Col span={6}>
          <div className="glass-card" style={{ padding: 24, height: '100%' }}>
            <Text style={{ fontWeight: 600, fontSize: 13, color: '#71717a' }}>
              参考值（财务口径）
            </Text>
            <div className="ledger-number" style={{ fontSize: 28, marginTop: 8, color: '#dc2626' }}>
              ¥12.64
            </div>
            <Text style={{ fontSize: 12, color: '#71717a', marginTop: 4, display: 'block' }}>
              全成本合计/PCS
            </Text>
          </div>
        </Col>
        <Col span={6}>
          <div className="glass-card" style={{ padding: 24, height: '100%' }}>
            <Text style={{ fontWeight: 600, fontSize: 13, color: '#71717a' }}>
              成本计算
            </Text>
            <div style={{ marginTop: 8 }}>
              <Text style={{ fontSize: 13, color: '#71717a' }}>
                请在 Simulation 页面选择场景进行成本计算
              </Text>
            </div>
          </div>
        </Col>

        {/* 包装物流费用录入表 */}
        <Col span={24}>
          <div className="glass-card" style={{ padding: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Title heading={4} className="ink-heading" style={{ margin: 0 }}>
                包装物流费用录入 (F10)
              </Title>
              <Space>
                <Button icon={<IconRefresh />} onClick={loadData}>刷新</Button>
                <Button
                  type="primary"
                  icon={<IconSave />}
                  loading={saving}
                  onClick={handleSave}
                >
                  保存全部
                </Button>
              </Space>
            </div>
            <Table
              pagination={false}
              size="small"
              scroll={{ x: 1400 }}
              columns={columns}
              dataSource={editRows}
              rowKey="harnessId"
            />
          </div>
        </Col>
      </Row>
    </div>
  );
}
