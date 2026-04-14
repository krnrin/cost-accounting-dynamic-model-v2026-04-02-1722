/**
 * QuoteEmptyState - Displayed when QuotePage has no harnesses.
 *
 * Common causes:
 * 1. No harnesses created yet for this project
 * 2. Harnesses exist but scenarioId doesn't match (e.g. created with empty scenarioId)
 * 3. Scenario doesn't exist
 */
import { Typography, Button, Empty } from '@douyinfe/semi-ui';
import { IconPlus } from '@douyinfe/semi-icons';
import { useNavigate } from 'react-router-dom';
import type { CSSProperties } from 'react';

const { Text } = Typography;

interface QuoteEmptyStateProps {
  projectId: string;
  scenarioId: string;
  projectName?: string;
}

const S: Record<string, CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 400,
    gap: 16,
  },
  actions: { display: 'flex', gap: 8, marginTop: 8 },
};

export function QuoteEmptyState({ projectId, scenarioId, projectName }: QuoteEmptyStateProps) {
  const navigate = useNavigate();

  return (
    <div style={S.wrapper}>
      <Empty
        title="当前场景暂无线束数据"
        description={
          <Text type="tertiary">
            报价需要至少一条线束的 BOM 数据。请先创建线束并填写 BOM，再返回此页面生成报价。
            {projectName && (
              <>
                <br />
                项目：{projectName}
              </>
            )}
          </Text>
        }
      />
      <div style={S.actions}>
        <Button
          icon={<IconPlus />}
          theme="solid"
          type="primary"
          onClick={() => navigate(`/project/${projectId}/s/${scenarioId}/bom-workbook`)}
        >
          打开 BOM 工作簿
        </Button>
        <Button
          theme="light"
          onClick={() => navigate(`/project/${projectId}/s/${scenarioId}`)}
        >
          返回场景
        </Button>
      </div>
    </div>
  );
}

export default QuoteEmptyState;
