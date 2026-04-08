/**
 * 车型配置页 — 配置关系图(交互式) + 线束矩阵(只读)
 * 两阶段发布: 线束开发录入线束+配置→发布→销售录入比例→发布→自动算装车比
 */
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Typography, Spin, Card, Tag, Toast, Banner, Button } from '@douyinfe/semi-ui';
import { IconSend } from '@douyinfe/semi-icons';
import { db } from '@/data/db';
import type { ScenarioRecord, HarnessRecord } from '@/data/db';
import type { VehicleConfig, VehicleConfigMeta, ConfigPublishState } from '@/types/harness';
import { detectConfigRisks, detectVehicleConfigRisks } from '@/engine/config_risk';
import ScenarioSelector from '@/components/ScenarioSelector';
import ConfigSetDiagram from '@/components/ConfigSetDiagram';
import { UniverSheet } from '@/components/UniverSheet';

const { Title } = Typography;

const STATE_LABELS: Record<ConfigPublishState, { text: string; color: string }> = {
  draft: { text: '草稿 — 线束开发编辑中', color: 'grey' },
  engineer_published: { text: '已发布 — 待销售录入比例', color: 'blue' },
  sales_published: { text: '已发布 — 装车比已生效', color: 'green' },
};

export default function ConfigMatrixPage() {
  const { id, sid } = useParams<{ id: string; sid: string }>();
  const [loading, setLoading] = useState(true);
  const [scenario, setScenario] = useState<ScenarioRecord | null>(null);
  const [harnesses, setHarnesses] = useState<HarnessRecord[]>([]);
  const [vehicleConfigs, setVehicleConfigs] = useState<VehicleConfig[]>([]);
  const [publishState, setPublishState] = useState<ConfigPublishState>('draft');

  const reload = useCallback(async () => {
    if (!sid) return;
    const sc = await db.scenarios.get(sid);
    setScenario(sc ?? null);
    setVehicleConfigs(sc?.vehicleConfigs ?? []);
    setPublishState(sc?.vehicleConfigMeta?.publishState ?? 'draft');
    const h = await db.harnesses.where('scenarioId').equals(sid).toArray();
    setHarnesses(h);
    setLoading(false);
  }, [sid]);

  useEffect(() => { reload(); }, [reload]);

  const saveConfigs = useCallback(async (configs: VehicleConfig[], meta?: Partial<VehicleConfigMeta>) => {
    if (!sid) return;
    setVehicleConfigs(configs);
    const patch: any = { vehicleConfigs: configs, updatedAt: new Date().toISOString() };
    if (meta) {
      const prev = scenario?.vehicleConfigMeta ?? { publishState: 'draft' as const };
      patch.vehicleConfigMeta = { ...prev, ...meta };
      setPublishState(patch.vehicleConfigMeta.publishState);
    }
    await db.scenarios.update(sid, patch);
  }, [sid, scenario]);

  // --- Config callbacks for diagram ---
  const addConfig = () => {
    saveConfigs([...vehicleConfigs, {
      configId: `cfg-${Date.now()}`, configName: `配置${vehicleConfigs.length + 1}`,
      salesRatio: 0, harnessIds: [],
    }]);
  };
  const removeConfig = (configId: string) => saveConfigs(vehicleConfigs.filter(c => c.configId !== configId));
  const renameConfig = (configId: string, name: string) =>
    saveConfigs(vehicleConfigs.map(c => c.configId === configId ? { ...c, configName: name } : c));
  const toggleHarness = (configId: string, harnessId: string) => {
    const cfg = vehicleConfigs.find(c => c.configId === configId);
    if (!cfg) return;
    const ids = cfg.harnessIds.includes(harnessId)
      ? cfg.harnessIds.filter(i => i !== harnessId)
      : [...cfg.harnessIds, harnessId];
    saveConfigs(vehicleConfigs.map(c => c.configId === configId ? { ...c, harnessIds: ids } : c));
  };
  const updateSalesRatio = (configId: string, ratio: number) =>
    saveConfigs(vehicleConfigs.map(c => c.configId === configId ? { ...c, salesRatio: ratio } : c));

  // --- Sheet data change handlers ---
  const handleHarnessSheetChange = useCallback((data: (string | number | null)[][]) => {
    // Skip header row, process data rows
    const updatedHarnesses = [...harnesses];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || !row[0]) continue;
      const harnessId = String(row[0]);
      const h = updatedHarnesses.find(x => x.input.harnessId === harnessId);
      if (!h) continue;
      // Update harness properties from sheet columns: [零件号, 线束名称, 功能位置, 标配/选配, ...]
      const harnessName = row[1] ? String(row[1]) : h.input.harnessName;
      const functionalSlot = row[2] ? String(row[2]) : h.input.functionalSlot;
      const configTypeText = row[3] ? String(row[3]) : '';
      let configType: 'S' | 'O' | undefined = h.input.configType;
      if (configTypeText.includes('S')) configType = 'S';
      else if (configTypeText.includes('O')) configType = 'O';
      else configType = undefined;

      h.input = { ...h.input, harnessName, functionalSlot, configType };
    }
    // Batch update to DB
    Promise.all(updatedHarnesses.map(h => db.harnesses.update(h.id, {
      input: h.input,
      harnessName: h.input.harnessName,
      updatedAt: new Date().toISOString(),
    }))).then(() => reload());
  }, [harnesses, reload]);

  const handleConfigSheetChange = useCallback((data: (string | number | null)[][]) => {
    // Config sheet columns: [配置名称, 销售比例]
    const updatedConfigs = [...vehicleConfigs];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || !row[0]) continue;
      const configName = String(row[0]);
      const ratio = row[1] !== null ? Number(row[1]) : 0;
      const cfg = updatedConfigs.find(c => c.configName === configName);
      if (cfg && !isNaN(ratio)) {
        cfg.salesRatio = ratio;
      }
    }
    saveConfigs(updatedConfigs);
  }, [vehicleConfigs, saveConfigs]);

  // --- Harness callbacks for diagram ---
  const addHarness = async (harnessId: string, harnessName: string, functionalSlot: string) => {
    if (!sid || !id) return;
    const exists = harnesses.some(h => h.input.harnessId === harnessId);
    if (exists) { Toast.warning(`线束 ${harnessId} 已存在`); return; }
    const now = new Date().toISOString();
    await db.harnesses.add({
      id: crypto.randomUUID(), projectId: id, scenarioId: sid,
      harnessId, harnessName, eopYear: null, updatedAt: now,
      input: {
        harnessId, harnessName, vehicleRatio: 0, bom: [],
        frontHours: 0, backHours: 0, functionalSlot,
        packaging: { innerBoxCost: 0, outerBoxCost: 0, palletCost: 0, trayDividerCost: 0, bubbleWrapCost: 0, labelCost: 0, subtotal: 0 },
        freight: { freight: 0, excessFreight: 0, shortHaul: 0, thirdPartyWarehouse: 0, storage: 0, subtotal: 0 },
      },
    });
    await reload();
  };
  const removeHarness = async (harnessId: string) => {
    const h = harnesses.find(x => x.input.harnessId === harnessId);
    if (!h) return;
    await db.harnesses.delete(h.id);
    // Also remove from all vehicleConfigs
    const updated = vehicleConfigs.map(c => ({
      ...c, harnessIds: c.harnessIds.filter(i => i !== harnessId),
    }));
    await saveConfigs(updated);
    await reload();
  };
  const updateConfigType = async (harnessId: string, configType: 'S' | 'O' | undefined) => {
    const h = harnesses.find(x => x.input.harnessId === harnessId);
    if (!h) return;
    await db.harnesses.update(h.id, {
      input: { ...h.input, configType: configType || undefined },
      updatedAt: new Date().toISOString(),
    });
    await reload();
  };

  // --- Publish: engineer ---
  const publishEngineer = async () => {
    if (!sid || !scenario || !id) return;
    if (vehicleConfigs.length === 0) { Toast.warning('请先定义至少一个车型配置'); return; }
    const empty = vehicleConfigs.filter(c => c.harnessIds.length === 0);
    if (empty.length > 0) { Toast.warning(`配置「${empty[0]!.configName}」未选择任何线束`); return; }
    const now = new Date().toISOString();
    // Ensure all referenced harness IDs have HarnessRecords
    const existingIds = new Set(harnesses.map(h => h.input.harnessId));
    const allRefIds = [...new Set(vehicleConfigs.flatMap(c => c.harnessIds))];
    for (const hid of allRefIds) {
      if (!existingIds.has(hid)) {
        await db.harnesses.add({
          id: crypto.randomUUID(), projectId: id, scenarioId: sid,
          harnessId: hid, harnessName: hid, eopYear: null, updatedAt: now,
          input: {
            harnessId: hid, harnessName: hid, vehicleRatio: 0, bom: [],
            frontHours: 0, backHours: 0,
            packaging: { innerBoxCost: 0, outerBoxCost: 0, palletCost: 0, trayDividerCost: 0, bubbleWrapCost: 0, labelCost: 0, subtotal: 0 },
            freight: { freight: 0, excessFreight: 0, shortHaul: 0, thirdPartyWarehouse: 0, storage: 0, subtotal: 0 },
          },
        });
      }
    }
    await saveConfigs(vehicleConfigs, { publishState: 'engineer_published', engineerPublishedAt: now });
    // Tracking: sales input
    await db.trackingItems.add({
      id: `track-sales-${sid}-${Date.now()}`, projectId: scenario.projectId,
      category: 'sales_input',
      title: '请录入各车型配置的预计销售比例',
      description: `线束开发已发布 ${vehicleConfigs.length} 个车型配置（${vehicleConfigs.map(c => c.configName).join('、')}），请销售录入各配置的预计销售比例后点击发布。`,
      costImpact: 0, status: 'open', priority: 'high', createdAt: now, updatedAt: now,
    });
    // Tracking: BOM entry
    await db.trackingItems.add({
      id: `track-bom-${sid}-${Date.now()}`, projectId: scenario.projectId,
      category: 'config_change',
      title: '请录入各线束BOM明细',
      description: `已创建 ${allRefIds.length} 条线束（${allRefIds.join('、')}），请前往各线束编辑页录入BOM明细。`,
      costImpact: 0, status: 'open', priority: 'high', createdAt: now, updatedAt: now,
    });
    Toast.success('已发布，线束已创建，跟踪项已生成');
    await reload();
  };

  // --- Publish: sales ---
  const publishSales = async () => {
    if (!sid || !scenario) return;
    const ratioSum = vehicleConfigs.reduce((s, c) => s + c.salesRatio, 0);
    if (Math.abs(ratioSum - 1.0) > 0.005) { Toast.warning(`销售比例合计 ${ratioSum.toFixed(3)}，应为 1.000`); return; }
    const now = new Date().toISOString();
    const ratioMap = new Map<string, number>();
    for (const cfg of vehicleConfigs) {
      for (const hid of cfg.harnessIds) {
        ratioMap.set(hid, (ratioMap.get(hid) || 0) + cfg.salesRatio);
      }
    }
    for (const h of harnesses) {
      const inferred = ratioMap.get(h.input.harnessId) ?? 0;
      if (Math.abs(inferred - h.input.vehicleRatio) > 0.001) {
        await db.harnesses.update(h.id, { input: { ...h.input, vehicleRatio: inferred }, updatedAt: now });
      }
    }
    await saveConfigs(vehicleConfigs, { publishState: 'sales_published', salesPublishedAt: now });
    const items = await db.trackingItems.where('projectId').equals(scenario.projectId).toArray();
    for (const item of items) {
      if (item.category === 'sales_input' && item.status === 'open') {
        await db.trackingItems.update(item.id, { status: 'resolved', resolvedAt: now, updatedAt: now });
      }
    }
    Toast.success('销售比例已发布，装车比已自动更新');
    await reload();
  };

  const revertToDraft = async () => {
    if (!sid) return;
    await saveConfigs(vehicleConfigs, { publishState: 'draft' });
    Toast.info('已退回草稿状态');
  };

  // Risks
  const slotRisks = useMemo(() => {
    if (!harnesses.length) return [];
    return detectConfigRisks(harnesses.map(h => h.input));
  }, [harnesses]);
  const vcRisks = useMemo(() => {
    if (!vehicleConfigs.length) return [];
    return detectVehicleConfigRisks(vehicleConfigs, harnesses.map(h => h.input));
  }, [vehicleConfigs, harnesses]);
  const allRisks = useMemo(() => [...slotRisks, ...vcRisks], [slotRisks, vcRisks]);

  // Inferred ratio map
  const inferredRatioMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const cfg of vehicleConfigs) {
      for (const hid of cfg.harnessIds) { m.set(hid, (m.get(hid) || 0) + cfg.salesRatio); }
    }
    return m;
  }, [vehicleConfigs]);

  // Draft: harness list sheet (editable)
  const harnessSheetData = useMemo(() => {
    const header: (string | number | null)[] = ['零件号', '线束名称', '功能位置', '标配/选配'];
    const rows = harnesses.map(h => {
      const configText = h.input.configType === 'S' ? 'S 标配' : h.input.configType === 'O' ? 'O 选配' : '—';
      return [h.input.harnessId, h.input.harnessName, h.input.functionalSlot || h.input.harnessName, configText] as (string | number | null)[];
    });
    return [header, ...rows];
  }, [harnesses]);

  // Engineer published: config list sheet (editable sales ratio)
  const configSheetData = useMemo(() => {
    const header: (string | number | null)[] = ['配置名称', '销售比例'];
    const rows = vehicleConfigs.map(cfg => [cfg.configName, cfg.salesRatio] as (string | number | null)[]);
    return [header, ...rows];
  }, [vehicleConfigs]);

  // Sales published: result matrix (read-only, for reference if needed)
  const matrixData = useMemo(() => {
    const header: (string | number | null)[] = ['零件号', '线束名称', '功能位置', '标配/选配', '装车比'];
    const rows = harnesses.map(h => {
      const configText = h.input.configType === 'S' ? 'S 标配' : h.input.configType === 'O' ? 'O 选配' : '—';
      const inferred = inferredRatioMap.get(h.input.harnessId);
      const ratio = inferred !== undefined ? Number(inferred.toFixed(3)) : Number(h.input.vehicleRatio.toFixed(3));
      return [h.input.harnessId, h.input.harnessName, h.input.functionalSlot || h.input.harnessName, configText, ratio] as (string | number | null)[];
    });
    return [header, ...rows];
  }, [harnesses, inferredRatioMap]);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!scenario) return <div>场景不存在</div>;

  const severityColor = (s: string) => s === 'error' ? 'red' : s === 'warning' ? 'orange' : 'blue';
  const stateInfo = STATE_LABELS[publishState];
  const isDraft = publishState === 'draft';
  const isEngineerPub = publishState === 'engineer_published';
  const isSalesPub = publishState === 'sales_published';

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 64 }}>
      <ScenarioSelector />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title heading={4} style={{ margin: 0 }}>车型配置管理</Title>
        <Tag color={stateInfo.color as any} size="large">{stateInfo.text}</Tag>
      </div>

      {allRisks.length > 0 && (
        <Card className="glass-card" style={{ marginBottom: 24 }}>
          <Title heading={6} style={{ margin: '0 0 12px' }}>配置风险检测</Title>
          {allRisks.map((r, i) => (
            <Banner key={i}
              type={r.severity === 'error' ? 'danger' : r.severity === 'warning' ? 'warning' : 'info'}
              description={<span><Tag color={severityColor(r.severity)} size="small" style={{ marginRight: 8 }}>{r.code}</Tag>{r.message}</span>}
              style={{ marginBottom: 8 }} />
          ))}
        </Card>
      )}

      {/* 操作按钮栏 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 16 }}>
        {(isEngineerPub || isSalesPub) && (
          <Button size="small" onClick={revertToDraft}>退回草稿</Button>
        )}
        {isDraft && harnesses.length > 0 && vehicleConfigs.length > 0 && (
          <Button size="small" type="primary" icon={<IconSend />} onClick={publishEngineer}>
            发布（线束开发）
          </Button>
        )}
        {isEngineerPub && (
          <Button size="small" type="primary" icon={<IconSend />} onClick={publishSales}>
            发布（销售比例）
          </Button>
        )}
      </div>

      {/* Draft: 线束属性编辑表格 + 配置关系图（可交互） */}
      {isDraft && (
        <>
          <Card className="glass-card" style={{ marginBottom: 24 }}>
            <Title heading={6} style={{ margin: '0 0 12px' }}>线束属性编辑</Title>
            <UniverSheet
              data={harnessSheetData}
              columnWidths={[130, 160, 120, 110]}
              readOnly={false}
              hideToolbar
              hideFormulaBar
              hideHeaders
              hideGridlines
              height={Math.min(400, 28 + harnesses.length * 28 + 20)}
              onChange={handleHarnessSheetChange}
            />
          </Card>
          <Card className="glass-card" style={{ marginBottom: 24 }}>
            <Title heading={6} style={{ margin: '0 0 12px' }}>配置关系图</Title>
            <ConfigSetDiagram
              vehicleConfigs={vehicleConfigs}
              harnesses={harnesses.map(h => h.input)}
              publishState={publishState}
              onAddConfig={addConfig}
              onRemoveConfig={removeConfig}
              onRenameConfig={renameConfig}
              onToggleHarness={toggleHarness}
              onUpdateSalesRatio={updateSalesRatio}
              onAddHarness={addHarness}
              onRemoveHarness={removeHarness}
              onUpdateConfigType={updateConfigType}
            />
          </Card>
        </>
      )}

      {/* Engineer Published: 销售比例录入表格 + 配置关系图（只读预览） */}
      {isEngineerPub && (
        <>
          <Card className="glass-card" style={{ marginBottom: 24 }}>
            <Title heading={6} style={{ margin: '0 0 12px' }}>销售比例录入</Title>
            <UniverSheet
              data={configSheetData}
              columnWidths={[200, 120]}
              readOnly={false}
              hideToolbar
              hideFormulaBar
              hideHeaders
              hideGridlines
              height={Math.min(300, 28 + vehicleConfigs.length * 28 + 20)}
              onChange={handleConfigSheetChange}
            />
          </Card>
          <Card className="glass-card" style={{ marginBottom: 24 }}>
            <Title heading={6} style={{ margin: '0 0 12px' }}>配置关系预览</Title>
            <ConfigSetDiagram
              vehicleConfigs={vehicleConfigs}
              harnesses={harnesses.map(h => h.input)}
              publishState={publishState}
              onAddConfig={addConfig}
              onRemoveConfig={removeConfig}
              onRenameConfig={renameConfig}
              onToggleHarness={toggleHarness}
              onUpdateSalesRatio={updateSalesRatio}
              onAddHarness={addHarness}
              onRemoveHarness={removeHarness}
              onUpdateConfigType={updateConfigType}
            />
          </Card>
        </>
      )}

      {/* Sales Published: ConfigSetDiagram 结果展示 */}
      {isSalesPub && (
        <Card className="glass-card" style={{ marginBottom: 24 }}>
          <Title heading={6} style={{ margin: '0 0 12px' }}>配置关系图（已发布）</Title>
          <ConfigSetDiagram
            vehicleConfigs={vehicleConfigs}
            harnesses={harnesses.map(h => h.input)}
            publishState={publishState}
            onAddConfig={addConfig}
            onRemoveConfig={removeConfig}
            onRenameConfig={renameConfig}
            onToggleHarness={toggleHarness}
            onUpdateSalesRatio={updateSalesRatio}
            onAddHarness={addHarness}
            onRemoveHarness={removeHarness}
            onUpdateConfigType={updateConfigType}
          />
        </Card>
      )}

      {/* 最终线束矩阵 — 所有状态都显示（只读参考） */}
      <Card className="glass-card">
        <Title heading={6} style={{ margin: '0 0 12px' }}>线束配置矩阵{isSalesPub ? '（装车比已生效）' : '（预览）'}</Title>
        <UniverSheet
          data={matrixData}
          columnWidths={[130, 160, 120, 110, 90]}
          readOnly
          hideToolbar
          hideFormulaBar
          hideHeaders
          hideGridlines
          height={Math.min(400, 28 + harnesses.length * 24 + 20)}
        />
      </Card>
    </div>
  );
}
