/**
 * 包装方案管理页面 (F09 包装方案)
 *
 * 功能：
 * 1. 显示项目下所有线束的包装方案列表
 * 2. 可编辑表格录入包装规格信息
 * 3. 从 Excel 导入包装方案数据
 * 4. 成本计算按场景选择触发，不在本页面实时计算
 *
 * 责任角色：工艺工程师
 */
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Typography, Spin, Table, Row, Col, Toast, InputNumber,
  Button, Empty, Tag, Select, Input, Space,
} from '@douyinfe/semi-ui';
import { IconSave, IconRefresh } from '@douyinfe/semi-icons';
import { db } from '@/data/db';
import type { ProjectRecord } from '@/data/db';
import { usePackagingStore } from '@/store/packagingStore';
import {
  type PackagingScheme,
  type BoxType,
  createEmptyPackagingScheme,
} from '@/types/packaging';

const { Title, Text } = Typography;

/** 箱型选项 */
const BOX_TYPE_OPTIONS: Array<{ value: BoxType; label: string }> = [
  { value: '围板箱', label: '围板箱' },
  { value: '塑料箱', label: '塑料箱' },
  { value: '纸箱', label: '纸箱' },
  { value: '铁箱', label: '铁箱' },
];

/** 编辑行数据 */
interface EditRow extends PackagingScheme {
  /** 是否有修改 */
  _changed?: boolean;
}

export default function PackagingSchemePage() {
  const { id: projectId } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [editRows, setEditRows] = useState<EditRow[]>([]);
  const [saving, setSaving] = useState(false);

  const {
    loadPackagingSchemes,
    batchSavePackagingSchemes
  } = usePackagingStore();

  // 加载数据
  const loadData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const p = await db.projects.get(projectId);
      if (!p) return;
      setProject(p);

      // 并行加载线束数据和已有的包装方案
      const [hRecords, existingRecords] = await Promise.all([
        db.harnesses.where('projectId').equals(projectId).toArray(),
        db.packagingSchemes.where('projectId').equals(projectId).toArray(),
      ]);

      // 构建编辑行
      const existingMap = new Map(existingRecords.map(r => [r.harnessId, r.scheme]));

      const rows: EditRow[] = hRecords.map(h => {
        const existing = existingMap.get(h.harnessId);
        return existing
          ? { ...existing, _changed: false }
          : {
              ...createEmptyPackagingScheme(h.harnessId, h.harnessName),
              _changed: false
            };
      });
      setEditRows(rows);

      // 同时更新 store 状态（用于其他组件同步）
      await loadPackagingSchemes(projectId);
    } catch (err) {
      console.error('PackagingScheme load error:', err);
      Toast.error('加载失败: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  }, [projectId, loadPackagingSchemes]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 更新编辑行
  const updateRow = (harnessId: string, field: keyof PackagingScheme, value: string | number) => {
    setEditRows(prev =>
      prev.map(r => {
        if (r.harnessId === harnessId) {
          const updated = { ...r, [field]: value, _changed: true };
          // 自动计算每箱总数
          if (field === 'perLayer' || field === 'layers') {
            const perLayer = field === 'perLayer' ? (value as number) : r.perLayer;
            const layers = field === 'layers' ? (value as number) : r.layers;
            updated.totalPerBox = perLayer * layers;
          }
          return updated;
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

      const schemes: PackagingScheme[] = changedRows.map(r => {
        const { _changed, ...scheme } = r;
        return scheme as PackagingScheme;
      });

      await batchSavePackagingSchemes(projectId, schemes);
      Toast.success(`已保存 ${schemes.length} 条包装方案`);

      // 重置修改标记
      setEditRows(prev => prev.map(r => ({ ...r, _changed: false })));
    } catch (err) {
      Toast.error('保存失败: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  };

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
    {
      title: '线径',
      dataIndex: 'wireDiameter',
      width: 90,
      render: (v: string, record: EditRow) => (
        <Input
          value={v}
          placeholder="如 50mm²"
          style={{ width: '100%' }}
          onChange={(val) => updateRow(record.harnessId, 'wireDiameter', val)}
        />
      ),
    },
    {
      title: '长度(mm)',
      dataIndex: 'wireLength',
      width: 100,
      align: 'right' as const,
      render: (v: number, record: EditRow) => (
        <InputNumber
          value={v}
          min={0}
          step={10}
          style={{ width: '100%' }}
          onChange={(val) => updateRow(record.harnessId, 'wireLength', Number(val) || 0)}
        />
      ),
    },
    {
      title: '护套数',
      dataIndex: 'connectorCount',
      width: 80,
      align: 'center' as const,
      render: (v: number, record: EditRow) => (
        <InputNumber
          value={v}
          min={0}
          step={1}
          style={{ width: '100%' }}
          onChange={(val) => updateRow(record.harnessId, 'connectorCount', Number(val) || 0)}
        />
      ),
    },
    {
      title: '包装箱类型',
      dataIndex: 'boxType',
      width: 110,
      render: (v: BoxType, record: EditRow) => (
        <Select
          value={v}
          style={{ width: '100%' }}
          optionList={BOX_TYPE_OPTIONS}
          onChange={(val) => updateRow(record.harnessId, 'boxType', val as BoxType)}
        />
      ),
    },
    {
      title: '包装箱规格',
      dataIndex: 'boxSpec',
      width: 150,
      render: (v: string, record: EditRow) => (
        <Input
          value={v}
          placeholder="如 1200*1000*1100mm"
          style={{ width: '100%' }}
          onChange={(val) => updateRow(record.harnessId, 'boxSpec', val)}
        />
      ),
    },
    {
      title: '每层数量',
      dataIndex: 'perLayer',
      width: 90,
      align: 'right' as const,
      render: (v: number, record: EditRow) => (
        <InputNumber
          value={v}
          min={0}
          step={1}
          style={{ width: '100%' }}
          onChange={(val) => updateRow(record.harnessId, 'perLayer', Number(val) || 0)}
        />
      ),
    },
    {
      title: '层数',
      dataIndex: 'layers',
      width: 70,
      align: 'right' as const,
      render: (v: number, record: EditRow) => (
        <InputNumber
          value={v}
          min={0}
          step={1}
          style={{ width: '100%' }}
          onChange={(val) => updateRow(record.harnessId, 'layers', Number(val) || 0)}
        />
      ),
    },
    {
      title: '每箱总数',
      dataIndex: 'totalPerBox',
      width: 90,
      align: 'right' as const,
      render: (v: number) => (
        <span className="ledger-number" style={{ fontWeight: 700, color: v > 0 ? '#2563eb' : '#a1a1aa' }}>
          {v || '-'}
        </span>
      ),
    },
    {
      title: '隔板型号',
      dataIndex: 'dividerModel',
      width: 130,
      render: (v: string, record: EditRow) => (
        <Input
          value={v}
          placeholder="如 70002086"
          style={{ width: '100%' }}
          onChange={(val) => updateRow(record.harnessId, 'dividerModel', val)}
        />
      ),
    },
    {
      title: '隔板数',
      dataIndex: 'dividerQty',
      width: 70,
      align: 'right' as const,
      render: (v: number, record: EditRow) => (
        <InputNumber
          value={v}
          min={0}
          step={1}
          style={{ width: '100%' }}
          onChange={(val) => updateRow(record.harnessId, 'dividerQty', Number(val) || 0)}
        />
      ),
    },
    {
      title: '备注',
      dataIndex: 'remark',
      width: 120,
      render: (v: string, record: EditRow) => (
        <Input
          value={v || ''}
          placeholder="备注"
          style={{ width: '100%' }}
          onChange={(val) => updateRow(record.harnessId, 'remark', val)}
        />
      ),
    },
    {
      title: '状态',
      dataIndex: 'totalPerBox',
      width: 80,
      align: 'center' as const,
      render: (v: number) => (
        v > 0
          ? <Tag color="blue" size="small">已录入</Tag>
          : <Tag color="grey" size="small">待录入</Tag>
      ),
    },
  ];

  // 统计数据
  const recordedCount = editRows.filter(r => r.totalPerBox > 0).length;
  const totalCount = editRows.length;

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
            <Text style={{ fontWeight: 600, fontSize: 13, color: '#71717a' }}>围板箱</Text>
            <div className="ledger-number" style={{ fontSize: 28, marginTop: 8 }}>
              {editRows.filter(r => r.boxType === '围板箱' && r.totalPerBox > 0).length}
            </div>
          </div>
        </Col>
        <Col span={6}>
          <div className="glass-card" style={{ padding: 24, height: '100%' }}>
            <Text style={{ fontWeight: 600, fontSize: 13, color: '#71717a' }}>其他箱型</Text>
            <div className="ledger-number" style={{ fontSize: 28, marginTop: 8 }}>
              {editRows.filter(r => r.boxType !== '围板箱' && r.totalPerBox > 0).length}
            </div>
          </div>
        </Col>

        {/* 包装方案录入表 */}
        <Col span={24}>
          <div className="glass-card" style={{ padding: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Title heading={4} className="ink-heading" style={{ margin: 0 }}>
                包装方案录入 (F09)
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
              scroll={{ x: 1500 }}
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
