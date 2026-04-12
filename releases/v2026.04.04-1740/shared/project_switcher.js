/**
 * shared/project_switcher.js
 * 项目切换器 UI 组件
 */
;(function (root) {
  'use strict';

  const CSS_CLASS = 'project-switcher';

  function render(container, options) {
    if (!container) return;
    const opts = options || {};
    const registry = root.G281ProjectRegistry;
    if (!registry) {
      container.innerHTML = '<span class="project-switcher__error">项目注册表未加载</span>';
      return;
    }

    const projects = registry.listProjects();
    const activeCode = registry.getActiveCode();
    const wrapper = document.createElement('div');
    wrapper.className = CSS_CLASS;

    const label = document.createElement('span');
    label.className = `${CSS_CLASS}__label`;
    label.textContent = '项目:';
    wrapper.appendChild(label);

    const select = document.createElement('select');
    select.className = `${CSS_CLASS}__select`;

    if (!projects.length) {
      const opt = document.createElement('option');
      opt.textContent = '暂无已注册项目';
      opt.disabled = true;
      select.appendChild(opt);
    } else {
      projects.forEach((project) => {
        const opt = document.createElement('option');
        opt.value = project.projectCode;
        opt.textContent = `${project.projectName}${project.locked ? ' [已锁定]' : ''}`;
        if (project.projectCode === activeCode) {
          opt.selected = true;
        }
        select.appendChild(opt);
      });
    }

    select.addEventListener('change', function onChange() {
      const code = this.value;
      if (!code) return;

      try {
        registry.switchProject(code);

        if (root.G281BomDb && root.G281BomDb.init) {
          const dbName = registry.getDbName(code);
          root.G281BomDb.init({ dbName }).then(() => {
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

    const activeConfig = registry.getActiveConfig();
    if (activeConfig && activeConfig._locked) {
      const lockBadge = document.createElement('span');
      lockBadge.className = `${CSS_CLASS}__lock`;
      lockBadge.textContent = '已锁定';
      lockBadge.title = '配置已锁定，修改需要通过项目变更流程';
      wrapper.appendChild(lockBadge);
    }

    container.innerHTML = '';
    container.appendChild(wrapper);
  }

  root.G281ProjectSwitcher = { render };
})(typeof window !== 'undefined' ? window : globalThis);
