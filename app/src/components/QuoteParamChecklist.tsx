/**
 * D4: 报价生成前参数确认 Checklist
 * 
 * 在生成报价前弹出确认对话框，检查关键参数是否就绪
 */
import { Modal, List, Typography, Tag, Button, Space } from '@douyinfe/semi-ui';
import { IconTickCircle, IconAlertTriangle, IconCrossCircle } from '@douyinfe/semi-icons';
import { useState, useEffect, useCallback } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { usePricingStore } from '@/store/pricingStore';
import { useScenarioStore } from '@/store/scenarioStore';

const { Text } = Typography;

export interface CheckItem {
  key: string;
  label: string;
  status: 'pass' | 'warning' | 'fail';
  detail: string;
}

interface QuoteParamChecklistProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  scenarioId: string;
}

/** 执行参数检查 */
function runChecks(settings: ReturnType<typeof useSettingsStore.getState>, pricing: ReturnType<typeof usePricingStore.getState>, scenario: ReturnType<typeof useScenarioStore.getState>): CheckItem[] {
  const checks: CheckItem[] = [];

  // 1. 费率配置检查
  const rates = settings.defaultCostRates;
  if (rates.laborRate > 0 && rates.mfgRate > 0) {
    checks.push({ key: 'rates', label: '费率配置', status: 'pass', detail: `人工${rates.laborRate}元/h, 制造${rates.mfgRate}元/h` });
  } else {
    checks.push({ key: 'rates', label: '费率配置', status: 'fail', detail: '人工费率或制造费率未设置' });
  }

  // 2. 金属价格检查
  const metal = settings.defaultMetalPrices;
  if (metal.copper > 0 && metal.aluminum > 0) {
    checks.push({ key: 'metal', label: '金属基准价格', status: 'pass', detail: `铜${metal.copper}元/吨, 铝${metal.aluminum}元/吨` });
  } else {
    checks.push({ key: 'metal', label: '金属基准价格', status: 'fail', detail: '金属基准价格未设置' });
  }

  // 3. BOM 数据检查
  const harnesses = scenario.harnesses;
  if (harnesses.length > 0) {
    const hasBom = harnesses.some((h: any) => h.bom && h.bom.length > 0);
    if (hasBom) {
      checks.push({ key: 'bom', label: 'BOM 数据', status: 'pass', detail: `${harnesses.length}个线束已录入BOM` });
    } else {
      checks.push({ key: 'bom', label: 'BOM 数据', status: 'warning', detail: '部分线束缺少BOM数据' });
    }
  } else {
    checks.push({ key: 'bom', label: 'BOM 数据', status: 'fail', detail: '当前场景无线束数据' });
  }

  // 4. 废品率检查
  if (rates.wasteRate >= 0 && rates.wasteRate <= 0.1) {
    checks.push({ key: 'waste', label: '废品率', status: 'pass', detail: `${(rates.wasteRate * 100).toFixed(2)}%` });
  } else {
    checks.push({ key: 'waste', label: '废品率', status: 'warning', detail: `废品率 ${(rates.wasteRate * 100).toFixed(2)}% 超出正常范围(0-10%)` });
  }

  // 5. 管理费率检查
  if (rates.mgmtRate >= 0.03 && rates.mgmtRate <= 0.15) {
    checks.push({ key: 'mgmt', label: '管理费率', status: 'pass', detail: `${(rates.mgmtRate * 100).toFixed(2)}%` });
  } else {
    checks.push({ key: 'mgmt', label: '管理费率', status: 'warning', detail: `管理费率 ${(rates.mgmtRate * 100).toFixed(2)}% 偏离常规范围(3-15%)` });
  }

  // 6. 利润率检查
  if (rates.profitRate > 0) {
    checks.push({ key: 'profit', label: '利润率', status: 'pass', detail: `${(rates.profitRate * 100).toFixed(4)}%` });
  } else {
    checks.push({ key: 'profit', label: '利润率', status: 'warning', detail: '利润率为0' });
  }

  // 7. 年降率检查
  if (settings.defaultAnnualDropRate >= 0) {
    checks.push({ key: 'drop', label: '年降率', status: 'pass', detail: `${(settings.defaultAnnualDropRate * 100).toFixed(1)}%` });
  } else {
    checks.push({ key: 'drop', label: '年降率', status: 'warning', detail: '年降率为负数' });
  }

  return checks;
}

export default function QuoteParamChecklist({ visible, onConfirm, onCancel, scenarioId }: QuoteParamChecklistProps) {
  const [checks, setChecks] = useState<CheckItem[]>([]);
  const settings = useSettingsStore();
  const pricing = usePricingStore();
  const scenario = useScenarioStore();

  useEffect(() => {
    if (visible) {
      setChecks(runChecks(settings, pricing, scenario));
    }
  }, [visible, settings, pricing, scenario]);

  const hasFailure = checks.some((c) => c.status === 'fail');
  const hasWarning = checks.some((c) => c.status === 'warning');

  const getIcon = (status: CheckItem['status']) => {
    switch (status) {
      case 'pass': return <IconTickCircle style= color: '#0b7a3e'  />;
      case 'warning': return <IconAlertTriangle style= color: '#d97706'  />;
      case 'fail': return <IconCrossCircle style= color: '#dc2626'  />;
    }
  };

  return (
    <Modal
      title="报价参数确认"
      visible={visible}
      onCancel={onCancel}
      footer={
        <Space>
          <Button onClick={onCancel}>取消</Button>
          <Button
            type="primary"
            theme="solid"
            disabled={hasFailure}
            onClick={onConfirm}
          >
            {hasFailure ? '存在必须项未通过' : hasWarning ? '确认并生成(含警告)' : '确认生成报价'}
          </Button>
        </Space>
      }
      width={560}
    >
      <List
        dataSource={checks}
        renderItem={(item) => (
          <List.Item
            key={item.key}
            header={getIcon(item.status)}
            main={
              <div>
                <Text strong>{item.label}</Text>
                <Tag
                  color={item.status === 'pass' ? 'green' : item.status === 'warning' ? 'orange' : 'red'}
                  style= marginLeft: 8 
                  size="small"
                >
                  {item.status === 'pass' ? '通过' : item.status === 'warning' ? '警告' : '未通过'}
                </Tag>
                <br />
                <Text type="tertiary" size="small">{item.detail}</Text>
              </div>
            }
          />
        )}
      />
    </Modal>
  );
}
