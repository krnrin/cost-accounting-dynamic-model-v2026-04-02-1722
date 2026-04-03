/**
 * ui/version_timeline.js
 * \u6210\u672C\u8981\u7D20\u7248\u672C\u65F6\u95F4\u7EBF
 * P2#8: BOM \u79FB\u9664, window \u2192 globalThis, G281UI.VersionTimeline \u522B\u540D
 */
(function (global) {
  'use strict';

  var DEFAULT_COLORS = [
    '#2b6cb0',
    '#0f766e',
    '#b45309',
    '#7c3aed',
    '#a21caf',
    '#0ea5e9',
    '#9333ea',
    '#16a34a',
  ];

  var DAY = 24 * 60 * 60 * 1000;

  function toDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    var parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function formatDate(value) {
    if (!value) return '-';
    var date = toDate(value);
    if (!date) return '-';
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function normalizeEvents(input) {
    if (!Array.isArray(input)) return [];
    return input
      .map(function (item, index) {
        if (!item) return null;
        var createdAt = toDate(item.createdAt || item.publishAt || item.created || item.published);
        var updatedAt = toDate(item.updatedAt || item.updateAt || item.updated || item.lastUpdate);
        var safeCreatedAt = createdAt || updatedAt;
        var safeUpdatedAt = updatedAt || createdAt;
        return {
          id: item.id || 'evt-' + index,
          name: item.name || item.label || item.title || '\u4E8B\u4EF6 ' + (index + 1),
          group: item.group || item.factor || item.category || '\u672A\u5206\u7C7B',
          createdAt: safeCreatedAt,
          updatedAt: safeUpdatedAt,
          meta: item.meta || {},
        };
      })
      .filter(Boolean);
  }

  function normalizeGroups(groups, events) {
    if (Array.isArray(groups) && groups.length) {
      return groups.map(function (group, index) {
        return {
          id: group.id || 'grp-' + index,
          label: group.label || group.name || '\u7EC4 ' + (index + 1),
          color: group.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length],
        };
      });
    }
    var map = new Map();
    events.forEach(function (evt) {
      var key = evt.group || '\u672A\u5206\u7C7B';
      if (!map.has(key)) {
        map.set(key, {
          id: 'grp-' + map.size,
          label: key,
          color: DEFAULT_COLORS[map.size % DEFAULT_COLORS.length],
        });
      }
    });
    return Array.from(map.values());
  }

  function buildScope(events) {
    var dates = events
      .reduce(function (acc, evt) {
        if (evt.createdAt) acc.push(evt.createdAt.getTime());
        if (evt.updatedAt) acc.push(evt.updatedAt.getTime());
        return acc;
      }, []);
    if (!dates.length) {
      var now = Date.now();
      return { min: now - 15 * DAY, max: now + 15 * DAY };
    }
    var min = Math.min.apply(null, dates);
    var max = Math.max.apply(null, dates);
    var padding = Math.max(DAY * 3, (max - min) * 0.08);
    return { min: min - padding, max: max + padding };
  }

  function clearElement(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function createNode(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function createEmptyState(container) {
    var empty = createNode('div', 'timeline-empty');
    var title = createNode('div', 'timeline-empty-title', '\u6682\u65E0\u7248\u672C\u4E8B\u4EF6');
    var note = createNode('div', 'timeline-empty-note', '\u6210\u672C\u8981\u7D20\u7248\u672C\u66F4\u65B0\u540E\uFF0C\u4F1A\u81EA\u52A8\u8BB0\u5F55\u5230\u65F6\u95F4\u7EBF\u3002');
    empty.appendChild(title);
    empty.appendChild(note);
    container.appendChild(empty);
  }

  function renderLegend(container, groups) {
    var legend = createNode('div', 'timeline-legend');
    groups.forEach(function (group) {
      var item = createNode('div', 'timeline-legend-item');
      var swatch = createNode('span', 'timeline-legend-swatch');
      swatch.style.background = group.color;
      item.appendChild(swatch);
      item.appendChild(createNode('span', 'timeline-legend-label', group.label));
      legend.appendChild(item);
    });
    container.appendChild(legend);
  }

  function renderEvents(track, events, scope, groupColor) {
    var min = scope.min, max = scope.max;
    var span = max - min || 1;
    events.forEach(function (evt) {
      var createdAt = evt.createdAt ? evt.createdAt.getTime() : null;
      var updatedAt = evt.updatedAt ? evt.updatedAt.getTime() : null;
      var left = createdAt == null ? 0 : clamp(((createdAt - min) / span) * 100, 0, 100);
      var right = updatedAt == null ? left : clamp(((updatedAt - min) / span) * 100, 0, 100);
      var width = Math.max(2, Math.abs(right - left));
      var bar = createNode('div', 'timeline-bar');
      bar.style.left = Math.min(left, right) + '%';
      bar.style.width = width + '%';
      bar.style.background = groupColor;
      bar.title = evt.name + ' | \u53D1\u5E03: ' + formatDate(evt.createdAt) + ' | \u66F4\u65B0: ' + formatDate(evt.updatedAt);

      var label = createNode('div', 'timeline-label');
      label.textContent = evt.name;
      label.style.left = Math.min(left, right) + '%';

      var markers = createNode('div', 'timeline-markers');
      var publishMark = createNode('span', 'timeline-marker publish');
      publishMark.style.left = left + '%';
      var updateMark = createNode('span', 'timeline-marker update');
      updateMark.style.left = right + '%';
      markers.appendChild(publishMark);
      markers.appendChild(updateMark);

      track.appendChild(bar);
      track.appendChild(label);
      track.appendChild(markers);
    });
  }

  function renderAxis(container, scope) {
    var axis = createNode('div', 'timeline-axis');
    var min = new Date(scope.min);
    var max = new Date(scope.max);
    var totalDays = Math.max(1, Math.round((max - min) / DAY));
    var ticks = totalDays > 240 ? 6 : totalDays > 120 ? 8 : 10;
    for (var i = 0; i <= ticks; i += 1) {
      var ratio = i / ticks;
      var tickDate = new Date(scope.min + ratio * (scope.max - scope.min));
      var tick = createNode('div', 'timeline-axis-tick');
      tick.style.left = (ratio * 100) + '%';
      tick.textContent = formatDate(tickDate);
      axis.appendChild(tick);
    }
    container.appendChild(axis);
  }

  function renderTimeline(mount, inputData, options) {
    if (!inputData) inputData = [];
    if (!options) options = {};
    if (!mount || typeof mount !== 'object') {
      return { destroy: function () {} };
    }
    var events = normalizeEvents(inputData);
    var groups = normalizeGroups(options.groups, events);
    var scope = buildScope(events);

    clearElement(mount);
    mount.classList.add('timeline-root');

    var header = createNode('div', 'timeline-header');
    var title = createNode('div', 'timeline-title', options.title || '\u6210\u672C\u8981\u7D20\u7248\u672C\u65F6\u95F4\u7EBF');
    var subtitle = createNode(
      'div',
      'timeline-subtitle',
      options.subtitle || '\u663E\u793A\u5404\u6210\u672C\u8981\u7D20\u7248\u672C\u7684\u53D1\u5E03\u65F6\u95F4\u4E0E\u66F4\u65B0\u65F6\u95F4'
    );
    header.appendChild(title);
    header.appendChild(subtitle);

    mount.appendChild(header);

    if (!events.length) {
      createEmptyState(mount);
      return { destroy: function () { clearElement(mount); } };
    }

    renderLegend(mount, groups);
    renderAxis(mount, scope);

    var lanes = createNode('div', 'timeline-lanes');
    groups.forEach(function (group) {
      var lane = createNode('div', 'timeline-lane');
      var label = createNode('div', 'timeline-lane-label', group.label);
      var track = createNode('div', 'timeline-track');
      var filtered = events.filter(function (evt) { return evt.group === group.label; });
      renderEvents(track, filtered, scope, group.color);
      lane.appendChild(label);
      lane.appendChild(track);
      lanes.appendChild(lane);
    });
    mount.appendChild(lanes);

    return { destroy: function () { clearElement(mount); } };
  }

  // \u5411\u540E\u517C\u5BB9\u522B\u540D
  global.G281VersionTimeline = {
    renderTimeline: renderTimeline,
    normalizeEvents: normalizeEvents,
  };

  // P2#8: \u7EDF\u4E00\u547D\u540D\u7A7A\u95F4
  global.G281UI = global.G281UI || {};
  global.G281UI.VersionTimeline = global.G281VersionTimeline;
})(globalThis);
