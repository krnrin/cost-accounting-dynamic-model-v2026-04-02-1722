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
        title="\u5F53\u524D\u573A\u666F\u6682\u65E0\u7EBF\u675F\u6570\u636E"
        description={
          <Text type="tertiary">
            \u62A5\u4EF7\u9700\u8981\u81F3\u5C11\u4E00\u6761\u7EBF\u675F\u7684 BOM \u6570\u636E\u3002\u8BF7\u5148\u521B\u5EFA\u7EBF\u675F\u5E76\u586B\u5199 BOM\uFF0C\u518D\u8FD4\u56DE\u6B64\u9875\u9762\u751F\u6210\u62A5\u4EF7\u3002
            {projectName && (
              <>
                <br />
                \u9879\u76EE\uFF1A{projectName}
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
          \u6253\u5F00 BOM \u5DE5\u4F5C\u7C3F
        </Button>
        <Button
          theme="light"
          onClick={() => navigate(`/project/${projectId}/s/${scenarioId}`)}
        >
          \u8FD4\u56DE\u573A\u666F
        </Button>
      </div>
    </div>
  );
}

export default QuoteEmptyState;
