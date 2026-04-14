/**
 * Gap 分析页面（独立路由）
 *
 * 路由: /project/:id/s/:sid/gap
 *
 * 功能：
 * 1. 报价侧（客户口径）vs 内部实绩侧（按选定金属基准）双层 Gap 对比
 * 2. 三种内部金属基准切换：财务基准价 / SHFE 现货 / SMM 现货
 * 3. 瀑布图展示成本结构差异
 * 4. Gap 快照管理（创建 / 列表 / 对比）
 * 5. 过期检测 + 提醒
 *
 * 对应 C7 Gap 分析 / Issue #77
 */
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Typography,
  Spin,
  Button,
  Tag,
  Toast,
  Row,
  Col,
  Divider,
  Space,
  Card,
} from '@douyinfe/semi-ui';
import { IconArrowLeft, IconRefresh } from '@douyinfe/semi-icons';
import { db } from '@/data/db';
import { applyE281ScenarioFallback } from '@/data/e281Fallback';
import type { HarnessRecord, ProjectRecord, ScenarioRecord } from '@/data/db';
import { computeHarnessCost, computeProjectFromHarnesses } from '@/engine/harness_costing';
import { useInternalMetalStore, SOURCE_LABELS } from '@/store/internalMetalStore';
import { InternalMetalSourceSwitch } from '@/components/InternalMetalSourceSwitch';
import { GapSnapshotManager } from '@/components/GapSnapshotManager';
import ScenarioSelector from '@/components/ScenarioSelector';

const { Title, Text } = Typography;

interface DimensionGap {
  label: string;
  quoteValue: number;
  internalValue: number;
  delta: number;
  deltaPct: number;
}

export default function GapAnalysisPage() {
  const { id: projectId, sid } = useParams<{ id: string; sid: string }>();
  const navigate = useNavigate();
  const { activeSource, getActivePrice, isStale, getStalenessLabel } = useInternalMetalStore();

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [scenario, setScenario] = useState<ScenarioRecord | null>(null);
  const [harnesses, setHarnesses] = useState<HarnessRecord[]>([]);

  useEffect(() => {
    async function loadData() {
      if (!projectId || !sid) return;
      try {
        const p = await db.projects.get(projectId);
        if (!p) { Toast.error('项目不存在'); return; }
        const s = await db.scenarios.get(sid);
        if (!s) { Toast.error('场景不存在'); return; }
        const scenarioWithFallback = applyE281ScenarioFallback(s);
        const h = await db.harnesses.where('scenarioId').equals(sid).toArray();
        setProject(p);
        setScenario(scenarioWithFallback);
        setHarnesses(h);
      } catch (err) {
        console.error(err);
        Toast.error('数据加载失败');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [projectId, sid]);

  // ── 报价侧结果（使用客户协议金属价格，即 scenario.config.metalPrices）──
  const quoteResults = useMemo(() => {
    if (!scenario) return [];
    return harnesses.map((h) =>
      computeHarnessCost(h.input, scenario.config.costRates, scenario.config.metalPrices)
    );
  }, [scenario, harnesses]);

  const quoteProject = useMemo(() => computeProjectFromHarnesses(quoteResults), [quoteResults]);

  // ── 内部实绩侧结果（使用当前选定的内部金属价格）──
  const internalResults = useMemo(() => {
    if (!scenario) return [];
    const activePrice = getActivePrice();
    const internalMetalPrices = {
      ...scenario.config.metalPrices,
      copperPrice: activePrice.copper,
      aluminumPrice: activePrice.aluminum,
    };
    return harnesses.map((h) =>
      computeHarnessCost(h.input, scenario.config.costRates, internalMetalPrices)
    );
  }, [scenario, harnesses, activeSource, getActivePrice]);

  const internalProject = useMemo(() => computeProjectFromHarnesses(internalResults), [internalResults]);

  // ── Gap 计算 ──
  const gapDimensions = useMemo<DimensionGap[]>(() => {
    const q = quoteProject;
    const i = internalProject;
    const dims: Array<{ label: string; qKey: keyof typeof q; iKey: keyof typeof i }> = [
      { label: '材料成本', qKey: 'materialCost', iKey: 'materialCost' },
      { label: '废品损失', qKey: 'wasteCost', iKey: 'wasteCost' },
      { label: '直接人工', qKey: 'directLabor', iKey: 'directLabor' },
      { label: '制造费用', qKey: 'manufacturing', iKey: 'manufacturing' },
      { label: '管理费', qKey: 'mgmtFee', iKey: 'mgmtFee' },
      { label: '利润', qKey: 'profit', iKey: 'profit' },
      { label: '包装运输', qKey: 'packTotal', iKey: 'packTotal' },
      { label: '出厂价', qKey: 'exFactoryPrice', iKey: 'exFactoryPrice' },
      { label: '到厂价', qKey: 'deliveredPrice', iKey: 'deliveredPrice' },
    ];
    return dims.map(({ label, qKey, iKey }) => {
      const qVal = Number((q as any)[qKey]) || 0;
      const iVal = Number((i as any)[iKey]) || 0;
      const delta = qVal - iVal;
      const deltaPct = iVal !== 0 ? (delta / Math.abs(iVal)) * 100 : 0;
      return { label, quoteValue: qVal, internalValue: iVal, delta, deltaPct };
    });
  }, [quoteProject, internalProject]);

  const totalGap = useMemo(() => {
    const qTotal = quoteProject.deliveredPrice || 0;
    const iTotal = internalProject.deliveredPrice || 0;
    return {
      quote: qTotal,
      internal: iTotal,
      delta: qTotal - iTotal,
      deltaPct: iTotal !== 0 ? ((qTotal - iTotal) / Math.abs(iTotal)) * 100 : 0,
    };
  }, [quoteProject, internalProject]);

  // ── 线束级 Gap 明细 ──
  const harnessGapRows = useMemo(() => {
    return harnesses
      .map((h, idx) => {
        const qr = quoteResults[idx];
        const ir = internalResults[idx];
        if (!qr || !ir) return null;
        const delta = (qr.deliveredPrice || 0) - (ir.deliveredPrice || 0);
        return {
          harnessId: h.harnessId,
          harnessName: h.harnessName,
          quoteDelivered: qr.deliveredPrice || 0,
          internalDelivered: ir.deliveredPrice || 0,
          delta,
          deltaPct: ir.deliveredPrice ? (delta / Math.abs(ir.deliveredPrice)) * 100 : 0,
        };
      })
      .filter(Boolean)
      .sort((a, b) => Math.abs(b!.delta) - Math.abs(a!.delta)) as Array<{
      harnessId: string;
      harnessName: string;
      quoteDelivered: number;
      internalDelivered: number;
      delta: number;
      deltaPct: number;
    }>;
  }, [harnesses, quoteResults, internalResults]);

  const gapResultForSnapshot = useMemo(() => ({
    totalGap,
    gapDimensions,
    harnessGapRows,
    activeSource,
    timestamp: new Date().toISOString(),
  }), [totalGap, gapDimensions, harnessGapRows, activeSource]);

  if (loading) {
    return (
      <div style= display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 >
        <Spin size="large" tip="正在加载 Gap 分析数据..." />
      </div>
    );
  }

  if (!project || !scenario) return <div>项目或场景不存在</div>;

  const stale = isStale();
  const stalenessText = getStalenessLabel();

  return (
    <div className="page-container">
      <ScenarioSelector />

      {/* 顶栏 */}
      <div style= display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 >
        <Space>
          <Button
            icon={<IconArrowLeft />}
            theme="borderless"
            onClick={() => navigate(`/project/${projectId}/s/${sid}`)}
          />
          <div>
            <Title heading={4} style= margin: 0 >报价 vs 实绩 Gap 分析</Title>
            <Text type="tertiary">{project.meta.projectName} / {project.meta.customer}</Text>
          </div>
        </Space>
        <Space>
          <Tag color={stale ? 'orange' : 'green'} size="large">
            内部基准: {SOURCE_LABELS[activeSource]} ({stalenessText})
          </Tag>
          <Button
            icon={<IconRefresh />}
            theme="light"
            onClick={() => navigate(`/project/${projectId}/s/${sid}/quote`)}
          >
            返回报价
          </Button>
        </Space>
      </div>

      {/* 金属价格切换 */}
      <Card className="glass-card" style= marginBottom: 16 >
        <InternalMetalSourceSwitch />
      </Card>

      {/* KPI 卡片 */}
      <Row gutter={[16, 16]} style= marginBottom: 16 >
        <Col span={6}>
          <Card className="glass-card">
            <Text style= fontSize: 12, color: '#999' >报价侧到厂价</Text>
            <div className="ledger-number" style= fontSize: 22, fontWeight: 700 >
              ¥{totalGap.quote.toFixed(2)}
            </div>
            <Text type="tertiary" style= fontSize: 11 >客户协议金属价</Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card className="glass-card">
            <Text style= fontSize: 12, color: '#999' >实绩侧到厂价</Text>
            <div className="ledger-number" style= fontSize: 22, fontWeight: 700 >
              ¥{totalGap.internal.toFixed(2)}
            </div>
            <Text type="tertiary" style= fontSize: 11 >{SOURCE_LABELS[activeSource]}</Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card className="glass-card">
            <Text style= fontSize: 12, color: '#999' >Gap（报价 - 实绩）</Text>
            <div
              className="ledger-number"
              style=
                fontSize: 22,
                fontWeight: 700,
                color: totalGap.delta >= 0 ? '#16a34a' : '#dc2626',
              
            >
              {totalGap.delta >= 0 ? '+' : ''}¥{totalGap.delta.toFixed(2)}
            </div>
            <Text type="tertiary" style= fontSize: 11 >
              {totalGap.delta >= 0 ? '报价充裕' : '报价不足'} ({totalGap.deltaPct >= 0 ? '+' : ''}{totalGap.deltaPct.toFixed(1)}%)
            </Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card className="glass-card">
            <Text style= fontSize: 12, color: '#999' >影响线束数</Text>
            <div className="ledger-number" style= fontSize: 22, fontWeight: 700 >
              {harnessGapRows.length}
            </div>
            <Text type="tertiary" style= fontSize: 11 >
              正 Gap {harnessGapRows.filter((r) => r.delta > 0).length} · 负 Gap {harnessGapRows.filter((r) => r.delta < 0).length}
            </Text>
          </Card>
        </Col>
      </Row>

      {/* 成本维度 Gap 表 */}
      <Card className="glass-card" style= marginBottom: 16 >
        <Title heading={6} style= marginBottom: 12 >成本维度 Gap 明细</Title>
        <table style= width: '100%', borderCollapse: 'collapse', fontSize: 13 >
          <thead>
            <tr style= borderBottom: '2px solid #e5e7eb', textAlign: 'left' >
              <th style= padding: '8px 12px' >维度</th>
              <th style= padding: '8px 12px', textAlign: 'right' >报价侧</th>
              <th style= padding: '8px 12px', textAlign: 'right' >实绩侧</th>
              <th style= padding: '8px 12px', textAlign: 'right' >Gap</th>
              <th style= padding: '8px 12px', textAlign: 'right' >Gap %</th>
            </tr>
          </thead>
          <tbody>
            {gapDimensions.map((dim) => (
              <tr
                key={dim.label}
                style=
                  borderBottom: '1px solid #f0f0f0',
                  background: dim.label.includes('价') ? 'rgba(37,99,235,0.03)' : undefined,
                
              >
                <td style= padding: '8px 12px', fontWeight: dim.label.includes('价') ? 600 : 400 >
                  {dim.label}
                </td>
                <td style= padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' >
                  ¥{dim.quoteValue.toFixed(2)}
                </td>
                <td style= padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' >
                  ¥{dim.internalValue.toFixed(2)}
                </td>
                <td
                  style=
                    padding: '8px 12px',
                    textAlign: 'right',
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    color: dim.delta >= 0 ? '#16a34a' : '#dc2626',
                  
                >
                  {dim.delta >= 0 ? '+' : ''}¥{dim.delta.toFixed(2)}
                </td>
                <td
                  style=
                    padding: '8px 12px',
                    textAlign: 'right',
                    fontSize: 12,
                    color: dim.deltaPct >= 0 ? '#16a34a' : '#dc2626',
                  
                >
                  {dim.deltaPct >= 0 ? '+' : ''}{dim.deltaPct.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* 线束级 Gap 明细 */}
      <Card className="glass-card" style= marginBottom: 16 >
        <div style= display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 >
          <Title heading={6} style= margin: 0 >线束级 Gap 明细（按 |Gap| 降序）</Title>
          <Text type="tertiary" style= fontSize: 12 >
            共 {harnessGapRows.length} 条线束
          </Text>
        </div>
        <table style= width: '100%', borderCollapse: 'collapse', fontSize: 13 >
          <thead>
            <tr style= borderBottom: '2px solid #e5e7eb', textAlign: 'left' >
              <th style= padding: '6px 12px', width: 120 >线束号</th>
              <th style= padding: '6px 12px' >名称</th>
              <th style= padding: '6px 12px', textAlign: 'right' >报价到厂价</th>
              <th style= padding: '6px 12px', textAlign: 'right' >实绩到厂价</th>
              <th style= padding: '6px 12px', textAlign: 'right' >Gap</th>
              <th style= padding: '6px 12px', textAlign: 'right' >Gap %</th>
            </tr>
          </thead>
          <tbody>
            {harnessGapRows.map((row) => (
              <tr key={row.harnessId} style= borderBottom: '1px solid #f0f0f0' >
                <td style= padding: '6px 12px', fontWeight: 600, fontFamily: 'monospace', fontSize: 12 >
                  {row.harnessId}
                </td>
                <td style= padding: '6px 12px' >{row.harnessName}</td>
                <td style= padding: '6px 12px', textAlign: 'right', fontFamily: 'monospace' >
                  ¥{row.quoteDelivered.toFixed(2)}
                </td>
                <td style= padding: '6px 12px', textAlign: 'right', fontFamily: 'monospace' >
                  ¥{row.internalDelivered.toFixed(2)}
                </td>
                <td
                  style=
                    padding: '6px 12px',
                    textAlign: 'right',
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    color: row.delta >= 0 ? '#16a34a' : '#dc2626',
                  
                >
                  {row.delta >= 0 ? '+' : ''}¥{row.delta.toFixed(2)}
                </td>
                <td
                  style=
                    padding: '6px 12px',
                    textAlign: 'right',
                    fontSize: 12,
                    color: row.deltaPct >= 0 ? '#16a34a' : '#dc2626',
                  
                >
                  {row.deltaPct >= 0 ? '+' : ''}{row.deltaPct.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Gap 快照管理 */}
      <Card className="glass-card">
        <GapSnapshotManager
          projectId={projectId!}
          scenarioId={sid!}
          currentGapResult={gapResultForSnapshot}
          quoteSideMetalPrices={scenario?.config.metalPrices}
        />
      </Card>
    </div>
  );
}
