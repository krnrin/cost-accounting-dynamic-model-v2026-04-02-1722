/**
 * shared/nav.js
 * Issue #13: 四页架构共享顶部导航栏
 * 在每个页面 <body> 顶部插入统一导航条
 */
(function (global) {
  'use strict';

  const PAGES = [
    { id: 'preview',    label: '预演',   icon: '🎯', file: 'preview.html',    desc: '调参看利润' },
    { id: 'accounting', label: '核算',   icon: '📊', file: 'accounting.html', desc: '报价+变更报价' },
    { id: 'tracking',   label: '跟踪',   icon: '📌', file: 'tracking.html',   desc: '协议价落实·费用分摊' },
    { id: 'archive',    label: '归档',   icon: '🗄️', file: 'archive.html',    desc: '数据存档管理' },
  ];

  function detectCurrentPage() {
    const path = location.pathname.split('/').pop() || '';
    const found = PAGES.find(p => path.includes(p.file) || path.includes(p.id));
    return found ? found.id : 'preview';
  }

  function resolveHref(page) {
    // 归一化：去掉可能已存在的 pages/ 前缀，防止 double prefix
    const file = page.file.replace(/^pages\//, '');
    // 支持 pages/ 子目录和根目录两种部署模式
    const prefix = location.pathname.includes('/pages/') ? '' : 'pages/';
    return prefix + file;
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
        ${PAGES.map(p => `
          <a href="${resolveHref(p)}" 
             class="g281-nav-link ${p.id === currentId ? 'active' : ''}"
             title="${p.desc}">
            <span class="g281-nav-icon">${p.icon}</span>
            <span class="g281-nav-label">${p.label}</span>
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
    // 加载项目名称
    if (global.ConfigLoader && typeof global.ConfigLoader.loadProjectConfig === 'function') {
      global.ConfigLoader.loadProjectConfig().then(cfg => {
        if (cfg && cfg.projectName) {
          nav.querySelector('.g281-nav-project').textContent = cfg.projectName;
        }
        const tag = nav.querySelector('#navVersionTag');
        if (tag && cfg && cfg.projectId) tag.textContent = cfg.projectId;
      }).catch(() => {});
    }
    return nav;
  }

  global.G281Nav = { PAGES, detectCurrentPage, resolveHref, createNavBar, mountNavBar };
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
