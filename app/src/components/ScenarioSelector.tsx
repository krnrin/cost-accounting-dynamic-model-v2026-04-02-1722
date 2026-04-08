/**
 * 场景快速切换下拉 — 用于场景级页面顶部
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Select, Tag, Space, Typography } from '@douyinfe/semi-ui';
import { db } from '@/data/db';
import type { ScenarioRecord } from '@/data/db';

const { Text } = Typography;

export default function ScenarioSelector() {
  const { id, sid } = useParams<{ id: string; sid: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [scenarios, setScenarios] = useState<ScenarioRecord[]>([]);

  useEffect(() => {
    if (!id) return;
    db.scenarios.where('projectId').equals(id).toArray().then(list => {
      setScenarios(list.sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    });
  }, [id]);

  if (scenarios.length <= 1) return null;

  const handleChange = (newSid: string) => {
    if (newSid === sid) return;
    // Replace sid in current path, keep the rest of the route
    const suffix = location.pathname.replace(`/project/${id}/s/${sid}`, '');
    navigate(`/project/${id}/s/${newSid}${suffix}`);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
      <Text type="tertiary" size="small">场景:</Text>
      <Select
        value={sid}
        onChange={handleChange as any}
        style={{ width: 220 }}
        size="small"
        renderSelectedItem={(opt: any) => {
          const s = scenarios.find(sc => sc.id === opt.value);
          return (
            <Space spacing={4}>
              <span>{s?.scenarioName ?? opt.label}</span>
              {s?.isBaseline && <Tag color="blue" size="small">基准</Tag>}
            </Space>
          );
        }}
      >
        {scenarios.map(s => (
          <Select.Option key={s.id} value={s.id}>
            <Space spacing={4}>
              <span>{s.scenarioName}</span>
              {s.isBaseline && <Tag color="blue" size="small">基准</Tag>}
            </Space>
          </Select.Option>
        ))}
      </Select>
    </div>
  );
}
