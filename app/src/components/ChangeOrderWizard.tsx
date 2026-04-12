/**
 * D5: 一键设变向导
 * 创建设变单，选择受影响零件，指定预期变更
 */
import { useState } from 'react';
import { Modal, Steps, Form, Select, Input, Button, Tag, Typography, Toast } from '@douyinfe/semi-ui';
import type { ChangeOrder } from '@/engine/change_verification';

const { Text } = Typography;

const FIELD_LABELS: Record<string, string> = {
  qty: '用量', unitPrice: '单价', supplier: '供应商', spec: '规格', partName: '物料名称',
};

interface ChangeOrderWizardProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (order: ChangeOrder) => void;
  availableParts: Array<{ partNo: string; partName: string }>;
}

export default function ChangeOrderWizard({ visible, onClose, onSubmit, availableParts }: ChangeOrderWizardProps) {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<Partial<ChangeOrder>>({
    changeNo: `ECN-${Date.now().toString(36).toUpperCase()}`,
    type: 'modify_part',
    reason: '',
    affectedParts: [],
    expectedChanges: [],
  });

  const handleSubmit = () => {
    const order: ChangeOrder = {
      id: `co-${Date.now()}`,
      changeNo: formData.changeNo || '',
      reason: formData.reason || '',
      type: formData.type || 'other',
      affectedParts: formData.affectedParts || [],
      expectedChanges: formData.expectedChanges || [],
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    onSubmit(order);
    Toast.success('设变单创建成功');
    onClose();
  };

  return (
    <Modal
      title="🔧 创建设变单"
      visible={visible}
      onCancel={onClose}
      width={700}
      footer={
        <div style= display: 'flex', justifyContent: 'space-between' >
          <Button disabled={step === 0} onClick={() => setStep(step - 1)}>上一步</Button>
          {step < 2 ? (
            <Button type="primary" onClick={() => setStep(step + 1)}>下一步</Button>
          ) : (
            <Button type="primary" theme="solid" onClick={handleSubmit}>提交设变单</Button>
          )}
        </div>
      }
    >
      <Steps current={step} size="small" style= marginBottom: 16 >
        <Steps.Step title="基本信息" />
        <Steps.Step title="选择零件" />
        <Steps.Step title="预期变更" />
      </Steps>

      {step === 0 && (
        <Form onValueChange={(v) => setFormData({ ...formData, ...v })} initValues={formData}>
          <Form.Input field="changeNo" label="设变编号" />
          <Form.Select field="type" label="设变类型">
            <Select.Option value="add_part">新增零件</Select.Option>
            <Select.Option value="remove_part">删除零件</Select.Option>
            <Select.Option value="modify_part">修改零件</Select.Option>
            <Select.Option value="replace_part">替换零件</Select.Option>
            <Select.Option value="qty_change">用量变更</Select.Option>
          </Form.Select>
          <Form.TextArea field="reason" label="设变原因" />
        </Form>
      )}

      {step === 1 && (
        <Select
          multiple
          placeholder="选择受影响的零件"
          style= width: '100%' 
          value={formData.affectedParts}
          onChange={(v) => setFormData({ ...formData, affectedParts: v as string[] })}
        >
          {availableParts.map(p => (
            <Select.Option key={p.partNo} value={p.partNo}>{p.partNo} - {p.partName}</Select.Option>
          ))}
        </Select>
      )}

      {step === 2 && (
        <div>
          <Text type="tertiary">为每个受影响零件指定预期变更</Text>
          {(formData.affectedParts || []).map(partNo => (
            <div key={partNo} style= marginTop: 8, padding: 8, background: '#f5f5f5', borderRadius: 8 >
              <Tag>{partNo}</Tag>
              <Select
                placeholder="变更字段"
                style= width: 150, marginLeft: 8 
                onChange={(field) => {
                  const changes = [...(formData.expectedChanges || [])];
                  const existing = changes.find(c => c.partNo === partNo);
                  if (existing) existing.field = field as string;
                  else changes.push({ partNo, field: field as string, oldValue: '', newValue: '' });
                  setFormData({ ...formData, expectedChanges: changes });
                }}
              >
                {Object.entries(FIELD_LABELS).map(([f, label]) => (
                  <Select.Option key={f} value={f}>{label}</Select.Option>
                ))}
              </Select>
              <Input
                placeholder="新值"
                style= width: 150, marginLeft: 8 
                onChange={(newValue) => {
                  const changes = [...(formData.expectedChanges || [])];
                  const existing = changes.find(c => c.partNo === partNo);
                  if (existing) existing.newValue = newValue;
                  setFormData({ ...formData, expectedChanges: changes });
                }}
              />
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
