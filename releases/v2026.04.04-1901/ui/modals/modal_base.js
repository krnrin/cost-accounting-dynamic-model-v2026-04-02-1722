/**
 * ui/modals/modal_base.js
 * Issue #6: 弹窗基类
 * 提供统一的打开/关闭/ESC/遮罩层逻辑
 */
(function (global) {
  'use strict';

  class ModalBase {
    constructor(options = {}) {
      this.id = options.id || `modal-${Date.now()}`;
      this.title = options.title || '';
      this.width = options.width || '600px';
      this.onClose = options.onClose || null;
      this._overlay = null;
      this._container = null;
      this._contentEl = null;
      this._built = false;
    }

    _build() {
      if (this._built) return;
      // 遮罩层
      this._overlay = document.createElement('div');
      this._overlay.className = 'modal-overlay';
      this._overlay.addEventListener('click', (e) => {
        if (e.target === this._overlay) this.close();
      });
      // 容器
      this._container = document.createElement('div');
      this._container.className = 'modal-container';
      this._container.style.maxWidth = this.width;
      this._container.innerHTML = `
        <div class="modal-header">
          <h3 class="modal-title">${this.title}</h3>
          <button class="modal-close" title="关闭">&times;</button>
        </div>
        <div class="modal-content"></div>
      `;
      this._container.querySelector('.modal-close').addEventListener('click', () => this.close());
      this._contentEl = this._container.querySelector('.modal-content');
      this._overlay.appendChild(this._container);
      // ESC 关闭
      this._escHandler = (e) => {
        if (e.key === 'Escape') this.close();
      };
      this._built = true;
    }

    get contentElement() {
      this._build();
      return this._contentEl;
    }

    open() {
      this._build();
      document.body.appendChild(this._overlay);
      document.addEventListener('keydown', this._escHandler);
      requestAnimationFrame(() => {
        this._overlay.classList.add('active');
      });
    }

    close() {
      if (!this._overlay) return;
      this._overlay.classList.remove('active');
      document.removeEventListener('keydown', this._escHandler);
      setTimeout(() => {
        if (this._overlay.parentNode) this._overlay.parentNode.removeChild(this._overlay);
        if (typeof this.onClose === 'function') this.onClose();
      }, 200);
    }

    setContent(html) {
      this._build();
      this._contentEl.innerHTML = html;
    }

    appendContent(element) {
      this._build();
      this._contentEl.appendChild(element);
    }
  }

  global.G281UI = global.G281UI || {};
  global.G281UI.ModalBase = ModalBase;
})(typeof window !== 'undefined' ? window : globalThis);
