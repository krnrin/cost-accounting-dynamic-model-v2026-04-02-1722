/**
 * shared/nav.js
 * 生命周期四页共享导航
 */
(function (global) {
  'use strict';

  const PAGES = [
    { id: 'preview', label: '预演', icon: '01', file: 'preview.html', desc: '情景预演与利润校核' },
    { id: 'accounting', label: '核算', icon: '02', file: 'accounting.html', desc: '生命周期核算工作台' },
    { id: 'tracking', label: '追踪', icon: '03', file: 'tracking.html', desc: '成本异常治理台' },
    { id: 'archive', label: '归档', icon: '04', file: 'archive.html', desc: '版本、发布与审计中心' },
  ];

  function looksBroken(text) {
    const value = String(text || '');
    return /[Ã�]|[\uFFFD]|(?:楂|绾|鍛|鏍哥畻|棰勬紨)/.test(value);
  }

  function displayProjectName(primaryName, fallbackName) {
    const primary = String(primaryName || '').trim();
    if (primary && !looksBroken(primary)) {
      return primary;
    }
    const fallback = String(fallbackName || '').trim();
    return fallback || '生命周期成本平台';
  }

  function detectCurrentPage() {
    const path = location.pathname.split('/').pop() || '';
    const found = PAGES.find((page) => path.includes(page.file) || path.includes(page.id));
    return found ? found.id : 'preview';
  }

  function resolveHref(page) {
    const file = page.file.replace(/^pages\//, '');
    const prefix = location.pathname.includes('/pages/') ? '' : 'pages/';
    return prefix + file;
  }

  function createNavBar(projectName) {
    const currentId = detectCurrentPage();
    const nav = document.createElement('nav');
    nav.className = 'g281-nav';
    nav.innerHTML = `
      <div class="g281-nav-brand">
        <span class="g281-nav-project">${displayProjectName(projectName, '')}</span>
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
        <span class="g281-nav-version" id="navVersionTag"></span>
      </div>
    `;
    return nav;
  }

  function mountNavBar(projectName) {
    const nav = createNavBar(projectName);
    document.body.insertBefore(nav, document.body.firstChild);
    if (global.ConfigLoader && typeof global.ConfigLoader.loadProjectConfig === 'function') {
      global.ConfigLoader.loadProjectConfig().then((config) => {
        const currentName = nav.querySelector('.g281-nav-project').textContent;
        if (config && config.projectName) {
          nav.querySelector('.g281-nav-project').textContent = displayProjectName(config.projectName, currentName);
        }
        const tag = nav.querySelector('#navVersionTag');
        if (tag && config && config.projectId) {
          tag.textContent = config.projectId;
        }
      }).catch(() => {});
    }
    return nav;
  }

  global.G281Nav = { PAGES, detectCurrentPage, resolveHref, createNavBar, mountNavBar };
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
