/* ============================================================
   VIZ-STATE.JS — Core State, Persistence, and Utilities
   ============================================================ */

const viz = {
  activeModule: 'challenge',
  selectedNodeId: null,
  selectedFolderId: null,
  folderStatePerModule: {},
  nodes: [],
  links: [],
  pan: { x: 0, y: 0 },
  zoom: 1,
  isPanning: false,
  panStart: { x: 0, y: 0 },
  panStartOffset: { x: 0, y: 0 },
  draggingNode: null,
  dragOffset: { x: 0, y: 0 },
  linkingFrom: null,
  portDrag: null,
  contextPos: null,
  contextNodeId: null,
  contextLinkId: null,
  popupTargetNode: null,
  fogEnabled: false,
  linkModeEnabled: false,
  snapEnabled: false,
  snapGrid: 20,
  searchQuery: '',
  highlightedNodeIds: new Set(),
  _undoStack: [],
  _dragStartPos: null,
  colorModeEnabled: false,
  colorPaintColor: 'blue',
  defaultLinkArrowType: 'arrow',
  flowyDragEnabled: false,
  globeModeEnabled: false,
  expandedFolderIds: new Set(),
};

// (Removed VIZ_STORAGE_KEY constant, using getVizStorageKey() instead)

function vizPushUndo() {
  viz._undoStack.push(JSON.stringify({ nodes: viz.nodes.map(n => ({ id: n.id, x: n.x, y: n.y })) }));
  if (viz._undoStack.length > 40) viz._undoStack.shift();
  const btn = document.getElementById('viz-undo-btn');
  if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
}

function vizUndo() {
  if (!viz._undoStack.length) return;
  const snap = JSON.parse(viz._undoStack.pop());
  snap.nodes.forEach(s => { const n = viz.nodes.find(n => n.id === s.id); if (n) { n.x = s.x; n.y = s.y; } });
  vizRenderCanvas();
  vizSave();
  const btn = document.getElementById('viz-undo-btn');
  if (btn && !viz._undoStack.length) { btn.disabled = true; btn.style.opacity = '0.4'; }
}

function vizToggleSnap() {
  viz.snapEnabled = !viz.snapEnabled;
  const btn = document.getElementById('viz-snap-btn');
  if (btn) {
    btn.classList.toggle('is-active', viz.snapEnabled);
    btn.style.color = '';
    btn.title = viz.snapEnabled ? 'Grid snap ON' : 'Grid snap OFF';
  }
}

function vizSnapCoord(v) {
  if (!viz.snapEnabled) return v;
  return Math.round(v / viz.snapGrid) * viz.snapGrid;
}

function vizSave() {
  const d = { nodes: viz.nodes, links: viz.links, pan: viz.pan, zoom: viz.zoom, fogEnabled: viz.fogEnabled };
  try { localStorage.setItem(getVizStorageKey(), JSON.stringify(d)); } catch (e) { console.warn('[Viz] save failed', e); }
  if (typeof scheduleCloudSave === 'function') scheduleCloudSave();
}

function vizLoad() {
  const raw = localStorage.getItem(getVizStorageKey());
  if (raw) {
    try {
      const d = JSON.parse(raw);
      viz.nodes = d.nodes || [];
      viz.links = d.links || [];
      viz.pan = d.pan || { x: 0, y: 0 };
      viz.zoom = d.zoom || 1;
      viz.fogEnabled = !!d.fogEnabled;
    } catch (e) { console.warn('[Viz] load failed', e); }
  }
}

function vizToggleFog() {
  viz.fogEnabled = !viz.fogEnabled;
  const btn = document.getElementById('viz-fog-toggle-btn');
  if (btn) {
    btn.classList.toggle('is-active', viz.fogEnabled);
    btn.classList.add('viz-state-fog');
    btn.innerHTML = viz.fogEnabled
      ? `<i data-lucide="eye" style="width:12px;height:12px;"></i> Fog`
      : `<i data-lucide="eye-off" style="width:12px;height:12px;"></i> Fog`;
    btn.style.color = '';
    btn.style.borderColor = '';
    if (typeof lucide !== 'undefined') lucide.createIcons({ el: btn });
  }
  vizSave();
  vizRenderCanvas();
}

function vizToggleLinkMode() {
  viz.linkModeEnabled = !viz.linkModeEnabled;

  // Turn off color mode if enabling link mode
  if (viz.linkModeEnabled && viz.colorModeEnabled) {
    viz.colorModeEnabled = false;
    const colorBtn = document.getElementById('viz-color-toggle-btn');
    if (colorBtn) { colorBtn.classList.remove('is-active'); colorBtn.style.color = ''; colorBtn.style.borderColor = ''; }
    const colorPopup = document.getElementById('viz-color-mode-popup');
    if (colorPopup) colorPopup.classList.add('hidden');
  }

  if (!viz.linkModeEnabled && viz.linkingFrom) {
    vizCancelLinking();
  }

  const btn = document.getElementById('viz-link-toggle-btn');
  if (btn) {
    btn.classList.toggle('is-active', viz.linkModeEnabled);
    btn.style.color = '';
    btn.style.borderColor = '';
  }
  // Apply cursor hint on canvas
  const container = document.getElementById('viz-canvas-container');
  if (container) container.classList.toggle('linking-mode', viz.linkModeEnabled);
}

function vizColorMap(color) {
  const map = { red: '#ef4444', orange: '#f97316', yellow: '#eab308', green: '#22c55e', blue: '#3b82f6', purple: '#a855f7', pink: '#ec4899', cyan: '#06b6d4' };
  return map[color] || 'var(--text-tertiary)';
}
