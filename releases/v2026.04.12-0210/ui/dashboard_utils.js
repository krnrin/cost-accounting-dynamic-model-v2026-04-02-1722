;(function (global) {
  'use strict';

  if (!global.G281DashboardUtils) {
    global.G281DashboardUtils = {
      noop: function noop() {},
    };
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
