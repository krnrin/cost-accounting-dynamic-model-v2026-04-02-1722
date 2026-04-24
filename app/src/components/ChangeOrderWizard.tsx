import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Input,
  Modal,
  Select,
  Space,
  Steps,
  Tag,
  TextArea,
  Typography,
} from '@douyinfe/semi-ui';
import type { ChangeOrder } from '@/engine/change_verification';

const { Text } = Typography;

type ChangeOrderType = ChangeOrder['type'];

interface AvailablePart {
  partNo: string;
  partName: string;
}

export interface ChangeOrderWizardProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (order: ChangeOrder) => void | Promise<void>;
  availableParts?: AvailablePart[];
}

interface ExpectedChangeDraft {
  partNo: string;
  field: string;
  oldValue: string;
  newValue: string;
}

interface DraftState {
  changeNo: string;
  reason: string;
  type: ChangeOrderType;
  affectedParts: string[];
  expectedChanges: ExpectedChangeDraft[];
}

const CHANGE_TYPE_OPTIONS: Array<{ value: ChangeOrderType; label: string }> = [
  { value: 'modify_part', label: '修改零件' },
  { value: 'replace_part', label: '替换零件' },
  { value: 'qty_change', label: '用量变更' },
  { value: 'add_part', label: '新增零件' },
  { value: 'remove_part', label: '删除零件' },
  { value: 'other', label: '其他' },
];

const FIELD_OPTIONS = [
  { value: 'partName', label: '零件名称' },
  { value: 'qty', label: '用量' },
  { value: 'unitPrice', label: '单价' },
  { value: 'supplier', label: '供应商' },
  { value: 'spec', label: '规格' },
];

function createDraft(): DraftState {
  return {
    changeNo: `ECN-${Date.now().toString(36).toUpperCase()}`,
    reason: '',
    type: 'modify_part',
    affectedParts: [],
    expectedChanges: [],
  };
}

function ensureExpectedChanges(affectedParts: string[], current: ExpectedChangeDraft[]) {
  const byPart = new Map(current.map((item) => [item.partNo, item]));
  return affectedParts.map((partNo) => (
    byPart.get(partNo) ?? {
      partNo,
      field: 'qty',
      oldValue: '',
      newValue: '',
    }
  ));
}

export default function ChangeOrderWizard({
  visible,
  onClose,
  onSubmit,
  availableParts = [],
}: ChangeOrderWizardProps) {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [draft, setDraft] = useState<DraftState>(createDraft);

  useEffect(() => {
    if (!visible) return;
    setStep(0);
    setSubmitting(false);
    setDraft(createDraft());
  }, [visible]);

  const partOptions = useMemo(
    () => availableParts.map((part) => ({
      value: part.partNo,
      label: `${part.partNo} - ${part.partName}`,
    })),
    [availableParts],
  );

  const canProceed = useMemo(() => {
    if (step === 0) {
      return draft.changeNo.trim().length > 0 && draft.reason.trim().length > 0;
    }
    if (step === 1) {
      return draft.affectedParts.length > 0;
    }
    return draft.expectedChanges.every((item) => item.field.trim() && item.newValue.trim());
  }, [draft, step]);

  const handleAffectedPartsChange = (nextParts: string[]) => {
    setDraft((current) => ({
      ...current,
      affectedParts: nextParts,
      expectedChanges: ensureExpectedChanges(nextParts, current.expectedChanges),
    }));
  };

  const handleExpectedChange = (
    partNo: string,
    patch: Partial<ExpectedChangeDraft>,
  ) => {
    setDraft((current) => ({
      ...current,
      expectedChanges: current.expectedChanges.map((item) => (
        item.partNo === partNo ? { ...item, ...patch } : item
      )),
    }));
  };

  const handleSubmit = async () => {
    if (!canProceed) return;
    const order: ChangeOrder = {
      id: `co-${crypto.randomUUID()}`,
      changeNo: draft.changeNo.trim(),
      reason: draft.reason.trim(),
      type: draft.type,
      affectedParts: draft.affectedParts,
      expectedChanges: draft.expectedChanges.map((item) => ({
        partNo: item.partNo,
        field: item.field,
        oldValue: item.oldValue,
        newValue: item.newValue,
      })),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    setSubmitting(true);
    try {
      await onSubmit(order);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="创建设变单"
      visible={visible}
      onCancel={onClose}
      width={760}
      footer={null}
      closeOnEsc
    >
      <Steps current={step} size="small" style={{ marginBottom: 20 }}>
        <Steps.Step title="基本信息" />
        <Steps.Step title="选择零件" />
        <Steps.Step title="预期变更" />
      </Steps>

      {step === 0 && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div>
            <Text strong>设变编号</Text>
            <Input
              value={draft.changeNo}
              onChange={(value) => setDraft((current) => ({ ...current, changeNo: value }))}
            />
          </div>
          <div>
            <Text strong>设变类型</Text>
            <Select
              style={{ width: '100%', marginTop: 8 }}
              value={draft.type}
              onChange={(value) => setDraft((current) => ({ ...current, type: value as ChangeOrderType }))}
            >
              {CHANGE_TYPE_OPTIONS.map((option) => (
                <Select.Option key={option.value} value={option.value}>
                  {option.label}
                </Select.Option>
              ))}
            </Select>
          </div>
          <div>
            <Text strong>设变原因</Text>
            <TextArea
              value={draft.reason}
              rows={4}
              maxCount={400}
              style={{ marginTop: 8 }}
              placeholder="说明本次变更的业务背景、涉及零件和预期影响"
              onChange={(value) => setDraft((current) => ({ ...current, reason: value }))}
            />
          </div>
        </div>
      )}

      {step === 1 && (
        <div>
          <Text type="tertiary">选择本次设变影响的零件，后续会逐个填写预期字段变化。</Text>
          <Select
            multiple
            filter
            style={{ width: '100%', marginTop: 16 }}
            placeholder="选择受影响零件"
            value={draft.affectedParts}
            onChange={(value) => handleAffectedPartsChange(value as string[])}
            optionList={partOptions}
          />
          {draft.affectedParts.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <Space wrap>
                {draft.affectedParts.map((partNo) => (
                  <Tag key={partNo} color="blue">{partNo}</Tag>
                ))}
              </Space>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div>
          <Text type="tertiary">为每个受影响零件填写至少一个预期变更字段和值。</Text>
          <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
            {draft.expectedChanges.map((item) => (
              <div
                key={item.partNo}
                style={{
                  border: '1px solid var(--semi-color-border)',
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                <div style={{ marginBottom: 12 }}>
                  <Tag color="orange">{item.partNo}</Tag>
                </div>
                <Space wrap align="start">
                  <Select
                    style={{ width: 160 }}
                    value={item.field}
                    onChange={(value) => handleExpectedChange(item.partNo, { field: value as string })}
                  >
                    {FIELD_OPTIONS.map((option) => (
                      <Select.Option key={option.value} value={option.value}>
                        {option.label}
                      </Select.Option>
                    ))}
                  </Select>
                  <Input
                    style={{ width: 180 }}
                    placeholder="旧值（可选）"
                    value={item.oldValue}
                    onChange={(value) => handleExpectedChange(item.partNo, { oldValue: value })}
                  />
                  <Input
                    style={{ width: 180 }}
                    placeholder="新值"
                    value={item.newValue}
                    onChange={(value) => handleExpectedChange(item.partNo, { newValue: value })}
                  />
                </Space>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
        <Button disabled={step === 0 || submitting} onClick={() => setStep((current) => current - 1)}>
          上一步
        </Button>
        {step < 2 ? (
          <Button type="primary" disabled={!canProceed} onClick={() => setStep((current) => current + 1)}>
            下一步
          </Button>
        ) : (
          <Button type="primary" loading={submitting} disabled={!canProceed} onClick={handleSubmit}>
            提交设变单
          </Button>
        )}
      </div>
    </Modal>
  );
}
