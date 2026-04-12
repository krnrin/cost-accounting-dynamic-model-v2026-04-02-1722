import { Button, Empty } from '@douyinfe/semi-ui';
import { useNavigate } from 'react-router-dom';

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <Empty
        title="404 — 页面未找到"
        description="您访问的页面不存在或已被移除"
      >
        <Button theme="solid" type="primary" onClick={() => navigate('/')}>
          返回首页
        </Button>
      </Empty>
    </div>
  );
}
