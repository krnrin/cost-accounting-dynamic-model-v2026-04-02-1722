import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { Breadcrumb as SemiBreadcrumb } from '@douyinfe/semi-ui';
import { IconHome } from '@douyinfe/semi-icons';
import { useProjectStore } from '@/store/projectStore';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';

export default function Breadcrumb() {
  const location = useLocation();
  const params = useParams();
  const navigate = useNavigate();
  const { projectName: storeProjectName, currentProjectId } = useProjectStore();

  // Fetch project name if not in store or mismatch
  const projectData = useLiveQuery(async () => {
    if (params.id) {
      return await db.projects.get(params.id);
    }
    return null;
  }, [params.id]);

  const projectName = (params.id === currentProjectId ? storeProjectName : projectData?.meta.projectName) || '项目详情';

  const pathnames = location.pathname.split('/').filter((x) => x);

  if (pathnames.length === 0) return null;

  const breadcrumbItems = [];

  // Always add "Home" or "Project List" as the first item if not already at root
  if (pathnames[0] === 'manager') {
    breadcrumbItems.push({
      name: '管理仪表盘',
      onClick: () => navigate('/manager'),
    });
  } else if (pathnames[0] === 'wizard') {
    breadcrumbItems.push({
      name: '新建项目',
      onClick: () => navigate('/wizard'),
    });
  } else if (pathnames[0] === 'settings') {
    breadcrumbItems.push({
      name: '系统设置',
      onClick: () => navigate('/settings'),
    });
    if (pathnames[1] === 'alert-rules') {
      breadcrumbItems.push({
        name: '预警规则',
        onClick: () => navigate('/settings/alert-rules'),
      });
    }
  } else if (pathnames[0] === 'project') {
    breadcrumbItems.push({
      name: '项目列表',
      onClick: () => navigate('/'),
    });

    if (params.id) {
      breadcrumbItems.push({
        name: projectName,
        onClick: () => navigate(`/project/${params.id}`),
      });

      if (pathnames.includes('alerts')) {
        breadcrumbItems.push({
          name: '预警中心',
          onClick: () => navigate(`/project/${params.id}/alerts`),
        });
      } else if (pathnames.includes('harness')) {
        const harnessId = params.harnessId;
        if (pathnames.includes('edit')) {
           breadcrumbItems.push({
            name: '线束编辑',
            onClick: () => navigate(`/project/${params.id}/harness/${harnessId}/edit`),
          });
        } else {
          breadcrumbItems.push({
            name: '线束详情',
            onClick: () => navigate(`/project/${params.id}/harness/${harnessId}`),
          });
          if (harnessId && harnessId !== 'new') {
             breadcrumbItems.push({
              name: harnessId,
            });
          }
        }
      } else if (pathnames.includes('quote')) {
        breadcrumbItems.push({
          name: '报价工作台',
          onClick: () => navigate(`/project/${params.id}/quote`),
        });
      } else if (pathnames.includes('simulation')) {
        breadcrumbItems.push({
          name: '模拟分析',
          onClick: () => navigate(`/project/${params.id}/simulation`),
        });
      } else if (pathnames.includes('annual-drop')) {
        breadcrumbItems.push({
          name: '年降管理',
          onClick: () => navigate(`/project/${params.id}/annual-drop`),
        });
      }
    }
  }

  return (
    <div className="blueprint-breadcrumb-shell" style={{ marginBottom: 16 }}>
      <SemiBreadcrumb>
        {breadcrumbItems.map((item, index) => (
          <SemiBreadcrumb.Item
            key={index}
            icon={index === 0 && pathnames[0] === 'project' ? <IconHome /> : undefined}
            onClick={item.onClick}
            style={{ cursor: item.onClick ? 'pointer' : 'default' }}
          >
            {item.name}
          </SemiBreadcrumb.Item>
        ))}
      </SemiBreadcrumb>
    </div>
  );
}
