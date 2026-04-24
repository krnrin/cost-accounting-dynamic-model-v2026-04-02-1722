import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Button,
  Card,
  Col,
  Empty,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { IconPlus, IconRefresh } from '@douyinfe/semi-icons';
import type { ChangeEventBomRowRecord, ChangeEventRecord, TrackingItemRecord } from '@/data/db';
import { db } from '@/data/db';
import { diffBom } from '@/engine/bom_diff';
import {
  buildStagnantSummary,
  identifyStagnantCandidates,
  type StagnantCandidate,
} from '@/engine/progress_price_tracker';
import ScenarioSelector from '@/components/ScenarioSelector';
import StagnantReportPanel from '@/components/StagnantReportPanel';
import { useVersionStore } from '@/store/versionStore';
import type { VersionRecord } from '@/types/version';

const { Title, Text } = Typography;

type ChangeType = ChangeEventRecord['changeType'];

interface BomDiffDisplayRow extends ChangeEventBomRowRecord {
  id: string;
  displayType: 'added' | 'removed' | 'modified';
}

function resolveModifiedRowType(row: ReturnType<typeof diffBom>['rows'][number]): ChangeEventBomRowRecord['changeType'] {
  const changedFields = new Set(row.fieldChanges.map((item) => item.field));
  if (changedFields.has('qty')) return 'qty_changed';
  if (changedFields.has('unitPrice')) return 'price_changed';
  return 'assembly_replace';
}

function buildBomDiffRows(baseVersion: VersionRecord, compareVersion: VersionRecord): BomDiffDisplayRow[] {
  const baseHarnessMap = new Map(baseVersion.snapshot.harnesses.map((item) => [item.harnessId, item]));
  const compareHarnessMap = new Map(compareVersion.snapshot.harnesses.map((item) => [item.harnessId, item]));
  const harnessIds = Array.from(new Set([...baseHarnessMap.keys(), ...compareHarnessMap.keys()]));
  const rows: BomDiffDisplayRow[] = [];

  for (const harnessId of harnessIds) {
    const beforeHarness = baseHarnessMap.get(harnessId);
    const afterHarness = compareHarnessMap.get(harnessId);
    const harnessName = afterHarness?.harnessName || beforeHarness?.harnessName || harnessId;
    const diffResult = diffBom(beforeHarness?.input.bom || [], afterHarness?.input.bom || []);

    diffResult.rows
      .filter((row) => row.changeType !== 'unchanged')
      .forEach((row, index) => {
        rows.push({
          id: `${harnessId}-${row.partNo}-${index}`,
          harnessId,
          harnessName,
          partNo: row.partNo,
          partName: row.partName,
          displayType: row.changeType === 'added' ? 'added' : row.changeType === 'removed' ? 'removed' : 'modified',
          changeType: row.changeType === 'added' ? 'added' : row.changeType === 'removed' ? 'removed' : resolveModifiedRowType(row),
          beforeQty: Number(row.oldItem?.qty || 0),
          afterQty: Number(row.newItem?.qty || 0),
          beforePrice: Number(row.oldItem?.unitPrice || 0),
          afterPrice: Number(row.newItem?.unitPrice || 0),
          deltaAmount: Number(row.costImpact.toFixed(4)),
          remainingQuantity: row.changeType === 'removed' ? Number(row.oldItem?.qty || 0) : Math.max(Number(row.oldItem?.qty || 0) - Number(row.newItem?.qty || 0), 0),
          fieldChanges: row.fieldChanges.map((item) => ({
            field: item.field,
            label: item.label,
            before: item.oldValue,
            after: item.newValue,
          })),
        });
      });
  }

  return rows;
}

function resolveChangeType(rows: BomDiffDisplayRow[]): ChangeType {
  const displayTypes = new Set(rows.map((row) => row.displayType));
  if (displayTypes.size === 1 && displayTypes.has('added')) return 'add';
  if (displayTypes.size === 1 && displayTypes.has('removed')) return 'cancel';
  if (displayTypes.has('added') && displayTypes.has('removed')) return 'replace';
  return 'adjust';
}

function buildChangeReason(baseVersion: VersionRecord, compareVersion: VersionRecord, rows: BomDiffDisplayRow[]): string {
  const added = rows.filter((row) => row.displayType === 'added').length;
  const removed = rows.filter((row) => row.displayType === 'removed').length;
  const modified = rows.filter((row) => row.displayType === 'modified').length;
  return `${baseVersion.label} -> ${compareVersion.label}; added ${added}, removed ${removed}, modified ${modified}`;
}

export default function ChangeEnginePage() {
  const { id: projectId, sid } = useParams<{ id: string; sid: string }>();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [creatingSnapshot, setCreatingSnapshot] = useState(false);
  const [selectedChangeId, setSelectedChangeId] = useState<string | null>(null);
  const [stagnantCandidates, setStagnantCandidates] = useState<StagnantCandidate[]>([]);

  const {
    versions,
    loading,
    baseVersionId,
    compareVersionId,
    changePricingResult,
    versionDiffResult,
    comparisonTable,
    loadVersions,
    createSnapshot,
    setCompareVersions,
    runComparison,
  } = useVersionStore();

  const changeEvents = useLiveQuery(async () => {
    if (!sid) return [] as ChangeEventRecord[];
    const rows = await db.changeEvents.where('scenarioId').equals(sid).toArray();
    return rows.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }, [sid]) ?? [];

  const trackingItems = useLiveQuery(async () => {
    if (!sid) return [] as TrackingItemRecord[];
    const rows = await db.trackingItems.where('scenarioId').equals(sid).toArray();
    return rows.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }, [sid]) ?? [];

  useEffect(() => {
    if (!projectId || !sid) return;
    void loadVersions(projectId, sid);
  }, [projectId, sid, loadVersions]);

  useEffect(() => {
    if (!selectedChangeId && changeEvents.length > 0) {
      setSelectedChangeId(changeEvents[0]!.id);
    }
  }, [changeEvents, selectedChangeId]);

  const baseVersion = useMemo(
    () => versions.find((item) => item.id === baseVersionId) ?? null,
    [versions, baseVersionId],
  );
  const compareVersion = useMemo(
    () => versions.find((item) => item.id === compareVersionId) ?? null,
    [versions, compareVersionId],
  );
  const selectedChangeEvent = useMemo(
    () => changeEvents.find((item) => item.id === selectedChangeId) ?? null,
    [changeEvents, selectedChangeId],
  );

  const bomDiffRows = useMemo(() => {
    if (!baseVersion || !compareVersion) return [] as BomDiffDisplayRow[];
    return buildBomDiffRows(baseVersion, compareVersion);
  }, [baseVersion, compareVersion]);

  useEffect(() => {
    const removedRows = bomDiffRows
      .filter((row) => row.displayType === 'removed')
      .map((row) => ({
        partNo: row.partNo,
        partName: row.partName,
        harnessId: row.harnessId,
        quantity: row.remainingQuantity,
        changeRef: selectedChangeEvent?.id || `${baseVersionId || 'base'}:${compareVersionId || 'compare'}`,
      }));
    setStagnantCandidates(identifyStagnantCandidates(removedRows));
  }, [baseVersionId, bomDiffRows, compareVersionId, selectedChangeEvent?.id]);

  const stagnantSummary = useMemo(
    () => buildStagnantSummary(stagnantCandidates),
    [stagnantCandidates],
  );

  const handleCreateSnapshot = async () => {
    if (!projectId || !sid) return;
    setCreatingSnapshot(true);
    try {
      const record = await createSnapshot({
        projectId,
        scenarioId: sid,
        label: newLabel.trim() || undefined,
        notes: newNotes.trim() || undefined,
      });
      setNewLabel('');
      setNewNotes('');
      setShowCreateModal(false);
      Toast.success(`Snapshot created: ${record.label}`);
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : 'Failed to create snapshot');
    } finally {
      setCreatingSnapshot(false);
    }
  };

  const handleRunComparison = async () => {
    try {
      await runComparison();
      Toast.success('Version comparison completed');
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : 'Comparison failed');
    }
  };

  const handleCreateChangeEvent = async () => {
    if (!projectId || !sid || !baseVersion || !compareVersion || !changePricingResult) {
      Toast.warning('Run a version comparison first');
      return;
    }
    if (bomDiffRows.length === 0) {
      Toast.warning('No BOM delta rows to persist');
      return;
    }

    const now = new Date().toISOString();
    const record: ChangeEventRecord = {
      id: crypto.randomUUID(),
      projectId,
      scenarioId: sid,
      changeType: resolveChangeType(bomDiffRows),
      reason: buildChangeReason(baseVersion, compareVersion, bomDiffRows),
      affectedHarnessIds: Array.from(new Set(bomDiffRows.map((row) => row.harnessId))),
      affectedBomRows: bomDiffRows.map(({ id, displayType, ...row }) => row),
      costImpact: Number(changePricingResult.summary.totalDelta.toFixed(4)),
      quoteImpact: Number(changePricingResult.summary.totalDelta.toFixed(4)),
      residualImpact: Number(
        bomDiffRows
          .filter((row) => row.displayType === 'removed')
          .reduce((sum, row) => sum + Math.abs(row.deltaAmount), 0)
          .toFixed(4),
      ),
      baselineVersionId: baseVersion.id,
      compareVersionId: compareVersion.id,
      status: 'calculated',
      createdBy: 'local-user',
      createdAt: now,
      updatedAt: now,
    };

    await db.changeEvents.put(record);
    setSelectedChangeId(record.id);
    Toast.success('Change event saved to local ledger');
  };

  const handleUpdateStagnant = (itemId: string, updates: Partial<StagnantCandidate>) => {
    setStagnantCandidates((current) =>
      current.map((item) => (item.itemId === itemId ? { ...item, ...updates } : item)),
    );
  };

  const handleBatchReport = async (itemIds: string[]) => {
    if (!projectId || !sid) return;
    const now = new Date().toISOString();
    const candidates = stagnantCandidates.filter((item) => itemIds.includes(item.itemId));

    await Promise.all(
      candidates.map((candidate) =>
        db.trackingItems.put({
          id: crypto.randomUUID(),
          projectId,
          scenarioId: sid,
          changeEventId: selectedChangeEvent?.id,
          baselineVersionId: selectedChangeEvent?.baselineVersionId,
          compareVersionId: selectedChangeEvent?.compareVersionId,
          source: 'stagnant_material',
          severity: candidate.estimatedValue && candidate.estimatedValue > 10000 ? 'warning' : 'info',
          category: 'recovery',
          title: `Stagnant material: ${candidate.partNo}`,
          description: `${candidate.partName || candidate.partNo} entered local tracking after version change.`,
          harnessId: candidate.harnessId,
          partNo: candidate.partNo,
          partName: candidate.partName,
          costImpact: candidate.estimatedValue || 0,
          remainingAmount: candidate.estimatedValue || 0,
          recoveredAmount: 0,
          needsPriceAdjustment: Boolean(selectedChangeEvent?.costImpact),
          status: 'open',
          priority: candidate.estimatedValue && candidate.estimatedValue > 10000 ? 'high' : 'medium',
          createdAt: now,
          updatedAt: now,
          note: candidate.changeRef || undefined,
        }),
      ),
    );

    if (selectedChangeEvent) {
      await db.changeEvents.update(selectedChangeEvent.id, {
        status: 'tracked',
        updatedAt: now,
      });
    }

    setStagnantCandidates((current) =>
      current.map((item) => (
        itemIds.includes(item.itemId)
          ? { ...item, status: 'reported', reportedAt: now }
          : item
      )),
    );

    Toast.success(`${itemIds.length} stagnant items were written into tracking`);
  };

  if (!projectId || !sid) {
    return <Empty description="Missing project or scenario id" />;
  }

  return (
    <div style={{ maxWidth: 1360, margin: '0 auto', paddingBottom: 48 }}>
      <ScenarioSelector />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <div>
          <Title heading={3}>Change Engine</Title>
          <Text type="tertiary">Local version compare, BOM impact, stagnant material reporting, and tracking closure.</Text>
        </div>
        <Space>
          <Button icon={<IconRefresh />} onClick={() => void loadVersions(projectId, sid)}>
            Refresh
          </Button>
          <Button icon={<IconPlus />} type="primary" onClick={() => setShowCreateModal(true)}>
            Create Snapshot
          </Button>
        </Space>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={8}>
            <Text type="tertiary">Base Version</Text>
            <Select
              value={baseVersionId ?? undefined}
              style={{ width: '100%', marginTop: 8 }}
              optionList={versions.map((item) => ({
                value: item.id,
                label: `${item.label} / ${item.status}`,
              }))}
              onChange={(value) => setCompareVersions((value as string) || null, compareVersionId)}
            />
          </Col>
          <Col span={8}>
            <Text type="tertiary">Compare Version</Text>
            <Select
              value={compareVersionId ?? undefined}
              style={{ width: '100%', marginTop: 8 }}
              optionList={versions.map((item) => ({
                value: item.id,
                label: `${item.label} / ${item.status}`,
              }))}
              onChange={(value) => setCompareVersions(baseVersionId, (value as string) || null)}
            />
          </Col>
          <Col span={8}>
            <Text type="tertiary">Action</Text>
            <div style={{ marginTop: 8 }}>
              <Button
                type="primary"
                loading={loading}
                disabled={!baseVersionId || !compareVersionId || baseVersionId === compareVersionId}
                onClick={handleRunComparison}
              >
                Run Compare
              </Button>
            </div>
          </Col>
        </Row>
      </Card>

      {versions.length < 2 ? (
        <Empty description="Create at least two snapshots to compare this scenario." />
      ) : (
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Card title="Comparison Summary" headerLine={false}>
              {!changePricingResult ? (
                <Text type="tertiary">Pick two versions and run compare to populate local impact results.</Text>
              ) : (
                <Row gutter={16}>
                  <Col span={6}>
                    <Card bodyStyle={{ padding: 16 }}>
                      <Text type="tertiary">Vehicle Delta</Text>
                      <Title heading={4}>{changePricingResult.summary.totalDelta.toFixed(2)}</Title>
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card bodyStyle={{ padding: 16 }}>
                      <Text type="tertiary">Delta %</Text>
                      <Title heading={4}>{changePricingResult.summary.deltaPercent.toFixed(2)}%</Title>
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card bodyStyle={{ padding: 16 }}>
                      <Text type="tertiary">Affected Harnesses</Text>
                      <Title heading={4}>{changePricingResult.summary.affectedCount}</Title>
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card bodyStyle={{ padding: 16 }}>
                      <Text type="tertiary">BOM Delta Rows</Text>
                      <Title heading={4}>{bomDiffRows.length}</Title>
                    </Card>
                  </Col>
                </Row>
              )}
            </Card>
          </Col>

          <Col span={24}>
            <Card
              title="Local Change Ledger"
              headerLine={false}
              headerExtraContent={(
                <Space>
                  <Button
                    type="primary"
                    disabled={!changePricingResult || bomDiffRows.length === 0}
                    onClick={() => void handleCreateChangeEvent()}
                  >
                    Persist Change Event
                  </Button>
                </Space>
              )}
            >
              {changeEvents.length === 0 ? (
                <Empty description="No local change events yet." />
              ) : (
                <Table
                  rowKey="id"
                  dataSource={changeEvents}
                  pagination={false}
                  columns={[
                    {
                      title: 'Reason',
                      dataIndex: 'reason',
                      render: (value: string, record: ChangeEventRecord) => (
                        <Button theme="borderless" onClick={() => setSelectedChangeId(record.id)}>
                          {value}
                        </Button>
                      ),
                    },
                    { title: 'Type', dataIndex: 'changeType', render: (value: string) => <Tag>{value}</Tag> },
                    { title: 'Impact', dataIndex: 'costImpact', align: 'right', render: (value: number) => value.toFixed(2) },
                    { title: 'Status', dataIndex: 'status', render: (value: string) => <Tag>{value}</Tag> },
                    { title: 'Created', dataIndex: 'createdAt', render: (value: string) => new Date(value).toLocaleString('zh-CN') },
                  ]}
                />
              )}
            </Card>
          </Col>

          {comparisonTable ? (
            <Col span={24}>
              <Card title="Contribution Comparison" headerLine={false}>
                <Table
                  rowKey="harnessId"
                  dataSource={comparisonTable.rows}
                  pagination={false}
                  columns={[
                    { title: 'Harness', dataIndex: 'harnessId', key: 'harnessId' },
                    { title: 'Name', dataIndex: 'harnessName', key: 'harnessName' },
                    { title: 'Change Type', dataIndex: 'changeCategory', key: 'changeCategory' },
                    { title: 'Baseline', dataIndex: 'beforePrice', key: 'beforePrice', align: 'right', render: (value: number) => value.toFixed(2) },
                    { title: 'Compare', dataIndex: 'afterPrice', key: 'afterPrice', align: 'right', render: (value: number) => value.toFixed(2) },
                    { title: 'Delta', dataIndex: 'deltaPrice', key: 'deltaPrice', align: 'right', render: (value: number) => value.toFixed(2) },
                    { title: 'Delta %', dataIndex: 'deltaPercent', key: 'deltaPercent', align: 'right', render: (value: number) => value.toFixed(2) },
                  ]}
                />
              </Card>
            </Col>
          ) : null}

          {versionDiffResult ? (
            <Col span={24}>
              <Card title="Project Level Diff" headerLine={false}>
                <Table
                  rowKey="field"
                  dataSource={versionDiffResult.projectLevel}
                  pagination={false}
                  columns={[
                    { title: 'Field', dataIndex: 'label', key: 'label' },
                    { title: 'Before', dataIndex: 'before', key: 'before', align: 'right', render: (value: number) => value.toFixed(2) },
                    { title: 'After', dataIndex: 'after', key: 'after', align: 'right', render: (value: number) => value.toFixed(2) },
                    { title: 'Delta', dataIndex: 'delta', key: 'delta', align: 'right', render: (value: number) => value.toFixed(2) },
                    { title: 'Delta %', dataIndex: 'deltaPercent', key: 'deltaPercent', align: 'right', render: (value: number) => value.toFixed(2) },
                  ]}
                />
              </Card>
            </Col>
          ) : null}

          <Col span={24}>
            <Card title="BOM Diff Preview" headerLine={false}>
              {bomDiffRows.length === 0 ? (
                <Empty description="No BOM delta rows under the selected version pair." />
              ) : (
                <Table
                  rowKey="id"
                  dataSource={bomDiffRows}
                  pagination={{ pageSize: 10 }}
                  columns={[
                    { title: 'Harness', dataIndex: 'harnessId', key: 'harnessId' },
                    { title: 'Part No', dataIndex: 'partNo', key: 'partNo' },
                    { title: 'Part Name', dataIndex: 'partName', key: 'partName' },
                    { title: 'Change', dataIndex: 'displayType', key: 'displayType', render: (value: string) => <Tag>{value}</Tag> },
                    { title: 'Qty Before', dataIndex: 'beforeQty', key: 'beforeQty', align: 'right' },
                    { title: 'Qty After', dataIndex: 'afterQty', key: 'afterQty', align: 'right' },
                    { title: 'Cost Delta', dataIndex: 'deltaAmount', key: 'deltaAmount', align: 'right', render: (value: number) => value.toFixed(2) },
                  ]}
                />
              )}
            </Card>
          </Col>

          <Col span={24}>
            <Card title="Stagnant Material Candidates" headerLine={false}>
              <StagnantReportPanel
                candidates={stagnantCandidates}
                summary={stagnantSummary}
                onUpdate={handleUpdateStagnant}
                onBatchReport={(itemIds) => void handleBatchReport(itemIds)}
              />
            </Card>
          </Col>

          <Col span={24}>
            <Card title="Tracking Items" headerLine={false}>
              {trackingItems.length === 0 ? (
                <Empty description="No tracking items yet." />
              ) : (
                <Table
                  rowKey="id"
                  dataSource={trackingItems}
                  pagination={false}
                  columns={[
                    { title: 'Title', dataIndex: 'title' },
                    { title: 'Source', dataIndex: 'source', render: (value: string) => <Tag>{value || 'manual'}</Tag> },
                    { title: 'Status', dataIndex: 'status', render: (value: string) => <Tag>{value}</Tag> },
                    { title: 'Priority', dataIndex: 'priority', render: (value: string) => <Tag>{value || 'medium'}</Tag> },
                    { title: 'Remaining', dataIndex: 'remainingAmount', align: 'right', render: (value: number) => Number(value || 0).toFixed(2) },
                    { title: 'Created', dataIndex: 'createdAt', render: (value: string) => new Date(value).toLocaleString('zh-CN') },
                  ]}
                />
              )}
            </Card>
          </Col>
        </Row>
      )}

      <Modal
        title="Create Snapshot"
        visible={showCreateModal}
        onOk={handleCreateSnapshot}
        onCancel={() => setShowCreateModal(false)}
        confirmLoading={creatingSnapshot}
        okText="Create"
        cancelText="Cancel"
      >
        <Space vertical style={{ width: '100%' }}>
          <Input
            placeholder={`v${versions.length + 1}`}
            value={newLabel}
            onChange={setNewLabel}
          />
          <Input
            placeholder="Notes"
            value={newNotes}
            onChange={setNewNotes}
          />
        </Space>
      </Modal>
    </div>
  );
}
