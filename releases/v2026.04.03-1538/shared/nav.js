/**
 * shared/nav.js
 * Shared top navigation for the multi-page shell.
 */
;(function (global) {
  'use strict';

  const PAGES = [
    { id: 'preview', label: '预演', icon: '预', file: 'preview.html', desc: '调参预演' },
    { id: 'accounting', label: '核算', icon: '核', file: 'accounting.html', desc: '报价核算' },
    { id: 'tracking', label: '跟踪', icon: '跟', file: 'tracking.html', desc: '执行跟踪' },
    { id: 'archive', label: '归档', icon: '档', file: 'archive.html', desc: '版本归档' },
  ];

  function detectCurrentPage() {
    const currentFile = (String(location.pathname || '').split('/').pop() || '').toLowerCase();
    const matched = PAGES.find((page) => currentFile === page.file.toLowerCase());
    return matched ? matched.id : '';
  }

  function resolveHref(page) {
    const inPagesDir = /\/pages\//.test(String(location.pathname || '').replace(/\\/g, '/'));
    return inPagesDir ? page.file : 'pages/' + page.file;
  }

  function getActiveProjectConfig() {
    if (global.G281ProjectRegistry && typeof global.G281ProjectRegistry.getActiveConfig === 'function') {
      return global.G281ProjectRegistry.getActiveConfig();
    }
    if (global.ConfigLoader && typeof global.ConfigLoader.active === 'function') {
      return global.ConfigLoader.active();
    }
    return null;
  }

  function updateNavProjectMeta(nav, explicitProjectName) {
    const config = getActiveProjectConfig();
    const projectName = explicitProjectName || (config && config.projectName) || '成本核算';
    const projectCode = (config && (config.projectCode || config.projectId)) || '';
    const projectLabel = nav.querySelector('.g281-nav-project');
    const projectTag = nav.querySelector('#navVersionTag');

    if (projectLabel) {
      projectLabel.textContent = projectName;
    }
    if (projectTag) {
      projectTag.textContent = projectCode;
    }
  }

  function renderProjectSwitcher(nav, options) {
    const mount = nav.querySelector('#projectSwitcherMount');
    if (!mount || !global.G281ProjectSwitcher || typeof global.G281ProjectSwitcher.render !== 'function') {
      return;
    }

    const switcherOptions = (options && options.projectSwitcherOptions) || {};
    global.G281ProjectSwitcher.render(mount, switcherOptions);
  }

  function normalizeMountOptions(input) {
    if (input && typeof input === 'object' && !Array.isArray(input)) {
      return input;
    }
    return {
      projectName: input,
    };
  }

  function createNavBar(projectName) {
    const currentId = detectCurrentPage();
    const nav = document.createElement('nav');
    nav.className = 'g281-nav';
    nav.innerHTML = `
      <div class="g281-nav-brand">
        <span class="g281-nav-project">${projectName || '成本核算'}</span>
      </div>
      <div class="g281-nav-links">
        ${PAGES.map((page) => `
          <a href="${resolveHref(page)}"
             class="g281-nav-link ${page.id === currentId ? 'active' : ''}"
             title="${page.desc}">
            <span class="g281-nav-icon">${page.icon}</span>
            <span class="g281-nav-label">${page.label}</span>
          </a>
        `).join('')}
      </div>
      <div class="g281-nav-meta">
        <div class="g281-nav-switcher" id="projectSwitcherMount"></div>
        <span class="g281-nav-version" id="navVersionTag"></span>
      </div>
    `;
    return nav;
  }

  function mountNavBar(input) {
    const options = normalizeMountOptions(input);
    let nav = document.querySelector('.g281-nav[data-g281-nav="1"]');
    if (!nav) {
      nav = createNavBar(options.projectName);
      nav.setAttribute('data-g281-nav', '1');
      document.body.insertBefore(nav, document.body.firstChild);
    }

    updateNavProjectMeta(nav, options.projectName);
    renderProjectSwitcher(nav, options);

    if (
      !nav.__g281ProjectChangeBound
      && global.G281ProjectRegistry
      && typeof global.G281ProjectRegistry.onProjectChange === 'function'
    ) {
      global.G281ProjectRegistry.onProjectChange(function (event) {
        updateNavProjectMeta(nav, event && event.config && event.config.projectName);
        renderProjectSwitcher(nav, options);
      });
      nav.__g281ProjectChangeBound = true;
    }

    return nav;
  }

  global.G281Nav = {
    PAGES: PAGES,
    detectCurrentPage: detectCurrentPage,
    resolveHref: resolveHref,
    createNavBar: createNavBar,
    mountNavBar: mountNavBar,
    updateNavProjectMeta: updateNavProjectMeta,
  };
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
