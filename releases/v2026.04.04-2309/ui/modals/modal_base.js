/**
 * ui/modals/modal_base.js
 * Issue #6: 弹窗基类
 * P1: 焦点陷阱 (WCAG 2.1)；打开时锁定焦点在弹窗内，关闭时恢复
 */
(function (global) {
  'use strict';

  var FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

  class ModalBase {
    constructor(options) {
      if (!options) options = {};
      this.id = options.id || 'modal-' + Date.now();
      this.title = options.title || '';
      this.width = options.width || '600px';
      this.onClose = options.onClose || null;
      this._overlay = null;
      this._container = null;
      this._contentEl = null;
      this._built = false;
      this._previousFocus = null;
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
      this._container.setAttribute('role', 'dialog');
      this._container.setAttribute('aria-modal', 'true');

      // 构建 header — 用 textContent 避免 XSS
      var header = document.createElement('div');
      header.className = 'modal-header';
      var titleEl = document.createElement('h3');
      titleEl.className = 'modal-title';
      titleEl.textContent = this.title;
      var closeBtn = document.createElement('button');
      closeBtn.className = 'modal-close';
      closeBtn.title = '关闭';
      closeBtn.textContent = '\u00D7';
      closeBtn.addEventListener('click', () => this.close());
      header.appendChild(titleEl);
      header.appendChild(closeBtn);

      this._contentEl = document.createElement('div');
      this._contentEl.className = 'modal-content';

      this._container.appendChild(header);
      this._container.appendChild(this._contentEl);
      this._overlay.appendChild(this._container);

      // ESC 关闭 + 焦点陷阱
      this._keyHandler = (e) => {
        if (e.key === 'Escape') {
          this.close();
          return;
        }
        if (e.key === 'Tab') {
          this._trapFocus(e);
        }
      };
      this._built = true;
    }

    /**
     * 焦点陷阱：Tab/Shift+Tab 循环在弹窗内
     */
    _trapFocus(e) {
      var focusable = this._container.querySelectorAll(FOCUSABLE_SELECTOR);
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    get contentElement() {
      this._build();
      return this._contentEl;
    }

    open() {
      this._build();
      this._previousFocus = document.activeElement;
      document.body.appendChild(this._overlay);
      document.addEventListener('keydown', this._keyHandler);
      requestAnimationFrame(() => {
        this._overlay.classList.add('active');
        // 聚焦到弹窗内第一个可聚焦元素
        var first = this._container.querySelector(FOCUSABLE_SELECTOR);
        if (first) first.focus();
      });
    }

    close() {
      if (!this._overlay) return;
      this._overlay.classList.remove('active');
      document.removeEventListener('keydown', this._keyHandler);
      setTimeout(() => {
        if (this._overlay.parentNode) this._overlay.parentNode.removeChild(this._overlay);
        if (typeof this.onClose === 'function') this.onClose();
        // 恢复之前的焦点
        if (this._previousFocus && typeof this._previousFocus.focus === 'function') {
          this._previousFocus.focus();
        }
        this._previousFocus = null;
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
})(globalThis);

;(function (global) {
  'use strict';

  class ModalController {
    constructor(options) {
      if (!options || !options.modal) {
        throw new Error('[ModalController] modal element is required');
      }
      this.modal = options.modal;
      this.backdropSelector = options.backdropSelector || '.modal-backdrop';
      this.bodyClass = options.bodyClass || 'modal-open';
      this.openClass = options.openClass || 'modal-active';
      this.onRequestClose = typeof options.onRequestClose === 'function' ? options.onRequestClose : null;
      this._boundKeydown = this._handleKeydown.bind(this);
      this._boundClick = this._handleBackdropClick.bind(this);
      this._initialized = false;
      this._isOpen = false;
    }

    init() {
      if (this._initialized) return;
      this.modal.addEventListener('click', this._boundClick);
      this._initialized = true;
    }

    open() {
      if (this._isOpen) return;
      this.modal.hidden = false;
      this.modal.setAttribute('aria-hidden', 'false');
      this.modal.classList.add(this.openClass);
      document.body.classList.add(this.bodyClass);
      document.addEventListener('keydown', this._boundKeydown);
      this._isOpen = true;
    }

    close() {
      if (!this._isOpen) return;
      this.modal.classList.remove(this.openClass);
      this.modal.hidden = true;
      this.modal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove(this.bodyClass);
      document.removeEventListener('keydown', this._boundKeydown);
      this._isOpen = false;
    }

    _handleKeydown(event) {
      if (event.key === 'Escape') {
        if (this.onRequestClose) this.onRequestClose();
      }
    }

    _handleBackdropClick(event) {
      if (!event.target || !event.target.matches(this.backdropSelector)) return;
      if (this.onRequestClose) this.onRequestClose();
    }
  }

  global.G281UI = global.G281UI || {};
  global.G281UI.ModalController = ModalController;
})(globalThis);
