(() => {
  const DEFAULT_COLORS = [
    '#2b6cb0',
    '#0f766e',
    '#b45309',
    '#7c3aed',
    '#a21caf',
    '#0ea5e9',
    '#9333ea',
    '#16a34a',
  ];

  const DAY = 24 * 60 * 60 * 1000;

  function toDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function formatDate(value) {
    if (!value) return '-';
    const date = toDate(value);
    if (!date) return '-';
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function normalizeEvents(input) {
    if (!Array.isArray(input)) return [];
    return input
      .map((item, index) => {
        if (!item) return null;
        const createdAt = toDate(item.createdAt || item.publishAt || item.created || item.published);
        const updatedAt = toDate(item.updatedAt || item.updateAt || item.updated || item.lastUpdate);
        const safeCreatedAt = createdAt || updatedAt;
        const safeUpdatedAt = updatedAt || createdAt;
        return {
          id: item.id || `evt-${index}`,
          name: item.name || item.label || item.title || `事件 ${index + 1}`,
          group: item.group || item.factor || item.category || '未分类',
          createdAt: safeCreatedAt,
          updatedAt: safeUpdatedAt,
          meta: item.meta || {},
        };
      })
      .filter(Boolean);
  }

  function normalizeGroups(groups, events) {
    if (Array.isArray(groups) && groups.length) {
      return groups.map((group, index) => ({
        id: group.id || `grp-${index}`,
        label: group.label || group.name || `组 ${index + 1}`,
        color: group.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length],
      }));
    }
    const map = new Map();
    events.forEach((evt) => {
      const key = evt.group || '未分类';
      if (!map.has(key)) {
        map.set(key, {
          id: `grp-${map.size}`,
          label: key,
          color: DEFAULT_COLORS[map.size % DEFAULT_COLORS.length],
        });
      }
    });
    return Array.from(map.values());
  }

  function buildScope(events) {
    const dates = events
      .flatMap((evt) => [evt.createdAt, evt.updatedAt])
      .filter(Boolean)
      .map((value) => value.getTime());
    if (!dates.length) {
      const now = Date.now();
      return { min: now - 15 * DAY, max: now + 15 * DAY };
    }
    const min = Math.min(...dates);
    const max = Math.max(...dates);
    const padding = Math.max(DAY * 3, (max - min) * 0.08);
    return { min: min - padding, max: max + padding };
  }

  function clearElement(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function createNode(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function createEmptyState(container) {
    const empty = createNode('div', 'timeline-empty');
    empty.innerHTML = `<div class="timeline-empty-title">暂无版本事件</div>
<div class="timeline-empty-note">成本要素版本更新后，会自动记录到时间线。</div>`;
    container.appendChild(empty);
  }

  function renderLegend(container, groups) {
    const legend = createNode('div', 'timeline-legend');
    groups.forEach((group) => {
      const item = createNode('div', 'timeline-legend-item');
      const swatch = createNode('span', 'timeline-legend-swatch');
      swatch.style.background = group.color;
      item.appendChild(swatch);
      item.appendChild(createNode('span', 'timeline-legend-label', group.label));
      legend.appendChild(item);
    });
    container.appendChild(legend);
  }

  function renderEvents(track, events, scope, groupColor) {
    const { min, max } = scope;
    const span = max - min || 1;
    events.forEach((evt) => {
      const createdAt = evt.createdAt ? evt.createdAt.getTime() : null;
      const updatedAt = evt.updatedAt ? evt.updatedAt.getTime() : null;
      const left = createdAt == null ? 0 : clamp(((createdAt - min) / span) * 100, 0, 100);
      const right = updatedAt == null ? left : clamp(((updatedAt - min) / span) * 100, 0, 100);
      const width = Math.max(2, Math.abs(right - left));
      const bar = createNode('div', 'timeline-bar');
      bar.style.left = `${Math.min(left, right)}%`;
      bar.style.width = `${width}%`;
      bar.style.background = groupColor;
      bar.title = `${evt.name} | 发布: ${formatDate(evt.createdAt)} | 更新: ${formatDate(evt.updatedAt)}`;

      const label = createNode('div', 'timeline-label');
      label.textContent = evt.name;
      label.style.left = `${Math.min(left, right)}%`;

      const markers = createNode('div', 'timeline-markers');
      const publishMark = createNode('span', 'timeline-marker publish');
      publishMark.style.left = `${left}%`;
      const updateMark = createNode('span', 'timeline-marker update');
      updateMark.style.left = `${right}%`;
      markers.appendChild(publishMark);
      markers.appendChild(updateMark);

      track.appendChild(bar);
      track.appendChild(label);
      track.appendChild(markers);
    });
  }

  function renderAxis(container, scope) {
    const axis = createNode('div', 'timeline-axis');
    const min = new Date(scope.min);
    const max = new Date(scope.max);
    const totalDays = Math.max(1, Math.round((max - min) / DAY));
    const ticks = totalDays > 240 ? 6 : totalDays > 120 ? 8 : 10;
    for (let i = 0; i <= ticks; i += 1) {
      const ratio = i / ticks;
      const tickDate = new Date(scope.min + ratio * (scope.max - scope.min));
      const tick = createNode('div', 'timeline-axis-tick');
      tick.style.left = `${ratio * 100}%`;
      tick.textContent = formatDate(tickDate);
      axis.appendChild(tick);
    }
    container.appendChild(axis);
  }

  function renderTimeline(mount, inputData = [], options = {}) {
    if (!mount || typeof mount !== 'object') {
      return { destroy: () => {} };
    }
    const events = normalizeEvents(inputData);
    const groups = normalizeGroups(options.groups, events);
    const scope = buildScope(events);

    clearElement(mount);
    mount.classList.add('timeline-root');

    const header = createNode('div', 'timeline-header');
    const title = createNode('div', 'timeline-title', options.title || '成本要素版本时间线');
    const subtitle = createNode(
      'div',
      'timeline-subtitle',
      options.subtitle || '显示各成本要素版本的发布时间与更新时间'
    );
    header.appendChild(title);
    header.appendChild(subtitle);

    mount.appendChild(header);

    if (!events.length) {
      createEmptyState(mount);
      return { destroy: () => clearElement(mount) };
    }

    renderLegend(mount, groups);
    renderAxis(mount, scope);

    const lanes = createNode('div', 'timeline-lanes');
    groups.forEach((group) => {
      const lane = createNode('div', 'timeline-lane');
      const label = createNode('div', 'timeline-lane-label', group.label);
      const track = createNode('div', 'timeline-track');
      const filtered = events.filter((evt) => evt.group === group.label);
      renderEvents(track, filtered, scope, group.color);
      lane.appendChild(label);
      lane.appendChild(track);
      lanes.appendChild(lane);
    });
    mount.appendChild(lanes);

    return { destroy: () => clearElement(mount) };
  }

  window.G281VersionTimeline = {
    renderTimeline,
    normalizeEvents,
  };
})();
