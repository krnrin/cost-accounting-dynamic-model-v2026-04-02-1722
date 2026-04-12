/**
 * shared/project_switcher.js
 * Project switcher with reload/reinit hooks.
 */
;(function (root) {
  'use strict';

  const CSS_CLASS = 'project-switcher';
  const NEW_PROJECT_LABEL = '+ 新建项目';

  function resolveNewProjectHref(explicitHref) {
    if (explicitHref) return explicitHref;
    return location.pathname.includes('/pages/') ? 'new_project.html' : 'pages/new_project.html';
  }

  async function reinitProjectStorage(projectCode) {
    if (!root.G281BomDb || typeof root.G281BomDb.init !== 'function') {
      return null;
    }
    const registry = root.G281ProjectRegistry;
    const dbState = await root.G281BomDb.init({
      dbName: registry.getDbName(projectCode),
    });

    if (root.G281SchemaMigrator && typeof root.G281SchemaMigrator.runPending === 'function') {
      await root.G281SchemaMigrator.runPending(root.G281BomDb);
    }

    return dbState;
  }

  function shouldReloadAfterSwitch(options) {
    if (!options) {
      return true;
    }
    if (options.reloadOnSwitch === true) {
      return true;
    }
    if (options.reloadOnSwitch === false) {
      return false;
    }
    return typeof options.onSwitch !== 'function' && typeof options.onReInit !== 'function';
  }

  function render(container, options) {
    if (!container) return;

    const opts = options || {};
    const registry = root.G281ProjectRegistry;
    if (!registry) {
      container.innerHTML = '<span class="project-switcher__error">Project registry unavailable</span>';
      return;
    }

    const projects = registry.listProjects();
    const activeCode = registry.getActiveCode();
    const wrapper = document.createElement('div');
    wrapper.className = CSS_CLASS;

    const label = document.createElement('span');
    label.className = CSS_CLASS + '__label';
    label.textContent = '项目';
    wrapper.appendChild(label);

    const select = document.createElement('select');
    select.className = CSS_CLASS + '__select';

    if (!projects.length) {
      const option = document.createElement('option');
      option.textContent = '暂无项目';
      option.disabled = true;
      option.selected = true;
      select.appendChild(option);
    } else {
      projects.forEach((project) => {
        const option = document.createElement('option');
        option.value = project.projectCode;
        option.textContent = project.projectName + (project.locked ? ' [locked]' : '');
        option.selected = project.projectCode === activeCode;
        select.appendChild(option);
      });
    }

    select.addEventListener('change', async function onChange() {
      const nextCode = this.value;
      const currentActiveCode = registry.getActiveCode();
      if (!nextCode || nextCode === currentActiveCode) {
        return;
      }

      try {
        registry.switchProject(nextCode);
        await reinitProjectStorage(nextCode);

        if (typeof opts.onSwitch === 'function') {
          await opts.onSwitch(nextCode);
        }
        if (typeof opts.onReInit === 'function') {
          await opts.onReInit(nextCode);
        }
        if (shouldReloadAfterSwitch(opts)) {
          location.reload();
        }
      } catch (error) {
        console.error('[ProjectSwitcher] switch failed:', error);
        alert('项目切换失败: ' + (error && error.message ? error.message : error));
        this.value = (registry.getActiveCode && registry.getActiveCode()) || activeCode || '';
      }
    });

    wrapper.appendChild(select);

    const actions = document.createElement('div');
    actions.className = CSS_CLASS + '__actions';

    const newButton = document.createElement('button');
    newButton.type = 'button';
    newButton.className = CSS_CLASS + '__new';
    newButton.textContent = NEW_PROJECT_LABEL;
    newButton.addEventListener('click', function () {
      const target = resolveNewProjectHref(opts.newProjectHref);
      if (root.G281PageRouter && typeof root.G281PageRouter.navigateTo === 'function') {
        root.G281PageRouter.navigateTo(target);
        return;
      }
      location.href = target;
    });
    actions.appendChild(newButton);
    wrapper.appendChild(actions);

    const activeConfig = registry.getActiveConfig();
    if (activeConfig && activeConfig._locked) {
      const lockBadge = document.createElement('span');
      lockBadge.className = CSS_CLASS + '__lock';
      lockBadge.textContent = 'Locked';
      lockBadge.title = '该项目的基线配置已锁定';
      wrapper.appendChild(lockBadge);
    }

    container.innerHTML = '';
    container.appendChild(wrapper);
  }

  root.G281ProjectSwitcher = {
    render: render,
    resolveNewProjectHref: resolveNewProjectHref,
    reinitProjectStorage: reinitProjectStorage,
  };
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
