/**
 * shared/project_switcher.js
 * Issue #14: 项目切换器 UI 组件
 *
 * 在导航栏中显示当前项目，提供下拉切换功能
 * 依赖：G281ProjectRegistry
 */
;(function (root) {
  'use strict';

  const CSS_CLASS = 'project-switcher';

  /**
   * 渲染项目切换器到指定容器
   * @param {HTMLElement} container  挂载点
   * @param {Object} options
   *   @param {Function} options.onSwitch  切换回调 (projectCode) => void
   *   @param {Function} options.onReInit  重新初始化回调（切换 IDB 后）
   */
  function render(container, options) {
    if (!container) return;
    const opts = options || {};
    const registry = root.G281ProjectRegistry;
    if (!registry) {
      container.innerHTML = '<span class="project-switcher__error">ProjectRegistry 未加载</span>';
      return;
    }

    const projects = registry.listProjects();
    const activeCode = registry.getActiveCode();

    // 构建 DOM
    const wrapper = document.createElement('div');
    wrapper.className = CSS_CLASS;

    const label = document.createElement('span');
    label.className = `${CSS_CLASS}__label`;
    label.textContent = '项目：';
    wrapper.appendChild(label);

    const select = document.createElement('select');
    select.className = `${CSS_CLASS}__select`;

    if (!projects.length) {
      const opt = document.createElement('option');
      opt.textContent = '无已注册项目';
      opt.disabled = true;
      select.appendChild(opt);
    } else {
      projects.forEach((proj) => {
        const opt = document.createElement('option');
        opt.value = proj.projectCode;
        opt.textContent = `${proj.projectName}${proj.locked ? ' 🔒' : ''}`;
        if (proj.projectCode === activeCode) {
          opt.selected = true;
        }
        select.appendChild(opt);
      });
    }

    select.addEventListener('change', function () {
      const code = this.value;
      if (!code) return;

      try {
        registry.switchProject(code);

        // 重新初始化 BomDb 到新项目的 IDB
        if (root.G281BomDb && root.G281BomDb.init) {
          const dbName = registry.getDbName(code);
          root.G281BomDb.init({ dbName }).then(() => {
            // 运行迁移
            if (root.G281SchemaMigrator && root.G281SchemaMigrator.runPending) {
              root.G281SchemaMigrator.runPending(root.G281BomDb);
            }
            if (typeof opts.onReInit === 'function') {
              opts.onReInit(code);
            }
          });
        }

        if (typeof opts.onSwitch === 'function') {
          opts.onSwitch(code);
        }
      } catch (error) {
        console.error('[ProjectSwitcher]', error);
        alert('项目切换失败: ' + (error.message || error));
      }
    });

    wrapper.appendChild(select);

    // 锁定状态指示
    const activeConfig = registry.getActiveConfig();
    if (activeConfig && activeConfig._locked) {
      const lockBadge = document.createElement('span');
      lockBadge.className = `${CSS_CLASS}__lock`;
      lockBadge.textContent = '🔒 已锁定';
      lockBadge.title = '配置已锁定，修改需通过项目变更流程';
      wrapper.appendChild(lockBadge);
    }

    container.innerHTML = '';
    container.appendChild(wrapper);
  }

  root.G281ProjectSwitcher = { render };
})(typeof window !== 'undefined' ? window : globalThis);
