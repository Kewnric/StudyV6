/* ============================================================
   VIZ-BRAIN.JS — The Versioned Comment Brain System
   ============================================================ */

const brain = {
  versions: [],
  folders: [],
  activeVersionId: null,
  nodes: [],
  links: [],
  pan: { x: 0, y: 0 },
  zoom: 1,
  selectedNodeId: null,
  linkingFrom: null,
  linkModeEnabled: false,
  draggingNode: null,
  dragOffset: { x: 0, y: 0 },
  isPanning: false,
  panStart: { x: 0, y: 0 },
  panStartOffset: { x: 0, y: 0 },
  contextPos: null,
  contextNodeId: null,
  contextLinkId: null,
  _ctxVersionId: null,
  _dragStartPos: null,
  _hasDragged: false,
  _undoStack: [],
  searchQuery: '',
  _highlightedIds: new Set(),
};

// (Removed BRAIN_STORAGE_KEY constant, using getBrainStorageKey() instead)

function brainSave() {
  try {
    localStorage.setItem(getBrainStorageKey(), JSON.stringify({
      versions: brain.versions,
      folders: brain.folders,
      activeVersionId: brain.activeVersionId,
    }));
  } catch (e) { console.warn('[Brain] save failed', e); }
  if (typeof scheduleCloudSave === 'function') scheduleCloudSave();
}

function brainLoad() {
  const raw = localStorage.getItem(getBrainStorageKey());
  if (!raw) return;
  try {
    const d = JSON.parse(raw);
    brain.versions = d.versions || [];
    brain.folders = d.folders || [];
    brain.activeVersionId = d.activeVersionId || null;
  } catch (e) { console.warn('[Brain] load failed', e); }
}

function brainSaveCurrentVersion() {
  if (!brain.activeVersionId) return;
  const v = brain.versions.find(v => v.id === brain.activeVersionId);
  if (!v) return;
  v.nodes = JSON.parse(JSON.stringify(brain.nodes));
  v.links = JSON.parse(JSON.stringify(brain.links));
  v.pan = { ...brain.pan };
  v.zoom = brain.zoom;
  brainSave();
}

function brainSwitchVersion(id) {
  brainSaveCurrentVersion();
  const v = brain.versions.find(v => v.id === id);
  if (!v) return;
  brain.activeVersionId = id;
  brain.nodes = JSON.parse(JSON.stringify(v.nodes || []));
  brain.links = JSON.parse(JSON.stringify(v.links || []));
  brain.pan = v.pan ? { ...v.pan } : { x: 0, y: 0 };
  brain.zoom = v.zoom || 1;
  brain.selectedNodeId = null;
  brain.linkingFrom = null;
  brain.linkModeEnabled = false;
  brainSave();
  brainRenderSidebar();
  brainRenderCanvas();
  setTimeout(() => brainUpdateMinimap(), 50);
}

function brainCreateVersion(folderId) {
  showInputDialog('New Version', null, 'Version name', 'New Version', (name) => {
    const id = 'bv_' + generateId();
    brain.versions.push({ id, name: name.trim(), folderId: folderId || null, nodes: [], links: [], pan: { x: 0, y: 0 }, zoom: 1 });
    brainSave();
    brainRenderSidebar();
    if (!brain.activeVersionId) brainSwitchVersion(id);
  });
}

function brainDeleteVersion(id) {
  if (!confirm('Delete this version? This cannot be undone.')) return;
  brain.versions = brain.versions.filter(v => v.id !== id);
  if (brain.activeVersionId === id) {
    brain.activeVersionId = null;
    brain.nodes = []; brain.links = [];
    brain.pan = { x: 0, y: 0 }; brain.zoom = 1;
  }
  brainSave(); brainRenderSidebar(); brainRenderCanvas();
}

function brainRenameVersion(id) {
  const v = brain.versions.find(v => v.id === id);
  if (!v) return;
  showInputDialog('Rename Version', null, 'Version name', v.name, (name) => {
    v.name = name.trim(); brainSave(); brainRenderSidebar(); brainUpdateCanvasToolbar();
  });
}

function brainDuplicateVersion(id) {
  const src = brain.versions.find(v => v.id === id);
  if (!src) return;
  const newId = 'bv_' + generateId();
  brain.versions.push({
    id: newId, name: src.name + ' (Copy)', folderId: src.folderId,
    nodes: JSON.parse(JSON.stringify(src.nodes || [])),
    links: JSON.parse(JSON.stringify(src.links || [])),
    pan: { ...src.pan }, zoom: src.zoom,
  });
  brainSave(); brainRenderSidebar();
}

function brainCreateFolder(parentId) {
  showInputDialog('New Folder', null, 'Folder name', 'New Folder', (name) => {
    const id = 'bf_' + generateId();
    brain.folders.push({ id, name: name.trim(), parentId: parentId || null, collapsed: false });
    brainSave(); brainRenderSidebar();
  });
}

function brainDeleteFolder(id) {
  if (!confirm('Delete folder? Versions inside will move to root.')) return;
  brain.folders = brain.folders.filter(f => f.id !== id);
  brain.versions.forEach(v => { if (v.folderId === id) v.folderId = null; });
  brainSave(); brainRenderSidebar();
}

function brainRenameFolder(id) {
  const f = brain.folders.find(f => f.id === id);
  if (!f) return;
  showInputDialog('Rename Folder', null, 'Folder name', f.name, (name) => {
    f.name = name.trim(); brainSave(); brainRenderSidebar();
  });
}

function brainToggleFolder(id) {
  const f = brain.folders.find(f => f.id === id);
  if (f) { f.collapsed = !f.collapsed; brainSave(); brainRenderSidebar(); }
}

function brainRenderSidebar() {
  const body = document.getElementById('viz-content-body');
  const titleEl = document.getElementById('viz-content-scope-label');
  const breadcrumbEl = document.getElementById('viz-content-breadcrumb');
  if (!body) return;
  if (titleEl) titleEl.textContent = 'Brain';
  if (breadcrumbEl) breadcrumbEl.innerHTML = '<span class="viz-breadcrumb-item" style="cursor:default;color:var(--text-primary)">Versions</span>';

  function renderVersionItem(v, depth) {
    const isActive = v.id === brain.activeVersionId;
    const pl = 8 + depth * 14;
    return `<div class="brain-version-item ${isActive ? 'active' : ''}" style="padding-left:${pl}px" onclick="brainSwitchVersion('${v.id}')" oncontextmenu="brainVersionCtx(event,'${v.id}')">
      <i data-lucide="file-text" style="width:13px;height:13px;flex-shrink:0;"></i>
      <span class="brain-version-name">${escapeHTML(v.name)}</span>
      ${isActive ? '<span class="brain-active-dot"></span>' : ''}
    </div>`;
  }

  function renderFolder(fid, depth) {
    const f = brain.folders.find(f => f.id === fid);
    if (!f) return '';
    const icon = f.collapsed ? 'chevron-right' : 'chevron-down';
    const pl = depth * 14;
    let html = `<div class="brain-folder-item" style="padding-left:${pl}px">
      <button type="button" class="brain-icon-btn" onclick="brainToggleFolder('${f.id}')"><i data-lucide="${icon}" style="width:11px;height:11px;"></i></button>
      <i data-lucide="folder" style="width:13px;height:13px;color:var(--color-accent);flex-shrink:0;"></i>
      <span class="brain-folder-name" ondblclick="brainRenameFolder('${f.id}')">${escapeHTML(f.name)}</span>
      <div class="brain-folder-actions">
        <button type="button" class="brain-icon-btn" onclick="brainCreateVersion('${f.id}')" title="New version"><i data-lucide="file-plus" style="width:11px;height:11px;"></i></button>
        <button type="button" class="brain-icon-btn" onclick="brainDeleteFolder('${f.id}')" title="Delete folder"><i data-lucide="trash-2" style="width:11px;height:11px;"></i></button>
      </div>
    </div>`;
    if (!f.collapsed) {
      brain.folders.filter(c => c.parentId === fid).forEach(c => { html += renderFolder(c.id, depth + 1); });
      brain.versions.filter(v => v.folderId === fid).forEach(v => { html += renderVersionItem(v, depth + 1); });
    }
    return html;
  }

  let html = `<div class="brain-sidebar-header">
    <button type="button" class="brain-new-btn" onclick="brainCreateVersion(null)"><i data-lucide="plus" style="width:12px;height:12px;"></i> New Version</button>
    <button type="button" class="brain-new-btn brain-new-btn-secondary" onclick="brainCreateFolder(null)"><i data-lucide="folder-plus" style="width:12px;height:12px;"></i> New Folder</button>
  </div>`;

  if (brain.versions.length === 0 && brain.folders.length === 0) {
    html += `<div class="viz-content-empty"><i data-lucide="brain-circuit"></i><p>No versions yet.<br>Create one to start.</p></div>`;
  } else {
    brain.folders.filter(f => !f.parentId).forEach(f => { html += renderFolder(f.id, 0); });
    brain.versions.filter(v => !v.folderId).forEach(v => { html += renderVersionItem(v, 0); });
  }
  body.innerHTML = html;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: body });
}

function brainVersionCtx(e, id) {
  e.preventDefault(); e.stopPropagation();
  brain._ctxVersionId = id;
  const menu = document.getElementById('brain-version-ctx');
  if (!menu) return;
  menu.style.left = e.clientX + 'px'; menu.style.top = e.clientY + 'px';
  menu.classList.remove('hidden');
}
function brainCtxVersionRename() { if (brain._ctxVersionId) brainRenameVersion(brain._ctxVersionId); brainHideAllMenus(); }
function brainCtxVersionDelete() { if (brain._ctxVersionId) brainDeleteVersion(brain._ctxVersionId); brainHideAllMenus(); }
function brainCtxVersionDuplicate() { if (brain._ctxVersionId) brainDuplicateVersion(brain._ctxVersionId); brainHideAllMenus(); }

function brainUpdateCanvasToolbar() {
  const el = document.getElementById('viz-canvas-toolbar-label');
  if (!el) return;
  const v = brain.versions.find(v => v.id === brain.activeVersionId);
  el.textContent = v ? 'Brain — ' + v.name : 'Brain Canvas';
}

function brainPushUndo() {
  brain._undoStack.push(JSON.stringify({ nodes: brain.nodes.map(n => ({ id: n.id, x: n.x, y: n.y })) }));
  if (brain._undoStack.length > 40) brain._undoStack.shift();
}

function brainUndo() {
  if (!brain._undoStack.length) return;
  const snap = JSON.parse(brain._undoStack.pop());
  snap.nodes.forEach(s => { const n = brain.nodes.find(n => n.id === s.id); if (n) { n.x = s.x; n.y = s.y; } });
  brainRenderCanvas(); brainSaveCurrentVersion();
}

function brainZoomIn() { brain.zoom = Math.min(3, brain.zoom + 0.15); brainRenderCanvas(); brainSaveCurrentVersion(); }
function brainZoomOut() { brain.zoom = Math.max(0.2, brain.zoom - 0.15); brainRenderCanvas(); brainSaveCurrentVersion(); }
function brainZoomReset() { brain.zoom = 1; brain.pan = { x: 0, y: 0 }; brainCenterCanvas(); }
function brainUpdateZoomDisplay() {
  const el = document.getElementById('viz-zoom-level');
  if (el) el.textContent = Math.round(brain.zoom * 100) + '%';
}

function brainCenterCanvas() {
  const container = document.getElementById('viz-canvas-container');
  if (!container || brain.nodes.length === 0) { brainRenderCanvas(); return; }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  brain.nodes.forEach(n => {
    const w = n.w || 250, h = n.h || 80;
    minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x + w);
    minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y + h);
  });
  const pad = 100, cw = container.offsetWidth, ch = container.offsetHeight;
  const scaleX = cw / (maxX - minX + pad * 2), scaleY = ch / (maxY - minY + pad * 2);
  brain.zoom = Math.min(Math.max(Math.min(scaleX, scaleY, 1.2), 0.2), 3);
  brain.pan.x = cw / 2 - ((minX + (maxX - minX) / 2) * brain.zoom);
  brain.pan.y = ch / 2 - ((minY + (maxY - minY) / 2) * brain.zoom);
  brainRenderCanvas(); brainSaveCurrentVersion();
}

function brainUpdateMinimap() {
  const canvas = document.getElementById('viz-minimap-canvas');
  const container = document.getElementById('viz-canvas-container');
  const viewportEl = document.getElementById('viz-minimap-viewport');
  if (!canvas || !container) return;
  const ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  if (brain.nodes.length === 0) return;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  brain.nodes.forEach(n => { minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x + (n.w || 250)); minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y + (n.h || 80)); });
  const pad = 40, wW = Math.max(maxX - minX + pad * 2, 1), wH = Math.max(maxY - minY + pad * 2, 1);
  const scale = Math.min(W / wW, H / wH), ox = (W - wW * scale) / 2 - (minX - pad) * scale, oy = (H - wH * scale) / 2 - (minY - pad) * scale;
  ctx.strokeStyle = 'rgba(148,163,184,0.25)'; ctx.lineWidth = 1;
  brain.links.forEach(l => {
    const fn = brain.nodes.find(n => n.id === l.from), tn = brain.nodes.find(n => n.id === l.to);
    if (!fn || !tn) return;
    ctx.beginPath(); ctx.moveTo(fn.x * scale + ox, fn.y * scale + oy); ctx.lineTo(tn.x * scale + ox, tn.y * scale + oy); ctx.stroke();
  });
  brain.nodes.forEach(n => {
    ctx.fillStyle = n.id === brain.selectedNodeId ? '#6366f1' : 'rgba(245,158,11,0.7)';
    ctx.globalAlpha = n.id === brain.selectedNodeId ? 1 : 0.7;
    ctx.beginPath(); ctx.roundRect(n.x * scale + ox, n.y * scale + oy, Math.max((n.w || 150) * scale, 4), Math.max((n.h || 48) * scale, 3), 2); ctx.fill();
    ctx.globalAlpha = 1;
  });
  const cW = container.offsetWidth, cH = container.offsetHeight;
  const vx = (-brain.pan.x / brain.zoom) * scale + ox, vy = (-brain.pan.y / brain.zoom) * scale + oy;
  const vw = (cW / brain.zoom) * scale, vh = (cH / brain.zoom) * scale;
  if (viewportEl) { viewportEl.style.left = Math.max(0, vx) + 'px'; viewportEl.style.top = Math.max(0, vy) + 'px'; viewportEl.style.width = Math.min(vw, W) + 'px'; viewportEl.style.height = Math.min(vh, H) + 'px'; }
}

function brainRenderCanvas() {
  const container = document.getElementById('viz-canvas-container');
  const svg = document.getElementById('viz-canvas-svg');
  const nodesLayer = document.getElementById('viz-nodes-layer');
  const emptyState = document.getElementById('viz-canvas-empty');
  if (!container || !nodesLayer) return;

  brainUpdateCanvasToolbar();

  if (!brain.activeVersionId) {
    if (emptyState) {
      emptyState.classList.remove('hidden');
      emptyState.querySelector('h3') && (emptyState.querySelector('h3').textContent = 'Brain Canvas');
      const p = emptyState.querySelector('p');
      if (p) p.textContent = 'Select or create a version from the left pane.';
    }
    nodesLayer.innerHTML = '';
    if (svg) svg.innerHTML = '';
    brainUpdateZoomDisplay();
    return;
  }
  if (emptyState) emptyState.classList.toggle('hidden', brain.nodes.length > 0);

  nodesLayer.style.transform = `translate(${brain.pan.x}px, ${brain.pan.y}px) scale(${brain.zoom})`;
  if (svg) svg.style.transform = `translate(${brain.pan.x}px, ${brain.pan.y}px) scale(${brain.zoom})`;
  nodesLayer.innerHTML = '';
  const renderedNodeMap = new Map();

  brain.nodes.forEach(node => {
    const el = document.createElement('div');
    el.className = `viz-node ${node.id === brain.selectedNodeId ? 'selected' : ''}`;
    el.dataset.type = 'comment';
    if (node.color) el.dataset.color = node.color;
    el.style.left = node.x + 'px';
    el.style.top = node.y + 'px';
    el.dataset.nodeId = node.id;
    const isHighlighted = brain.searchQuery && brain._highlightedIds && brain._highlightedIds.has(node.id);
    const isDimmed = brain.searchQuery && brain._highlightedIds && !brain._highlightedIds.has(node.id);
    if (isHighlighted) el.classList.add('viz-search-match');
    if (isDimmed) el.classList.add('viz-search-dim');
    const styleW = node.w ? `width:${node.w}px;` : 'width:250px;';
    el.innerHTML = `<div class="viz-node-inner" style="${styleW}">
      <div class="viz-comment-body">
        <div class="viz-comment-content">${escapeHTML(node.commentContent || 'Double-click or right-click to edit...')}</div>
      </div>
    </div>`;
    setTimeout(() => {
      const inner = el.querySelector('.viz-node-inner');
      if (!inner) return;
      const obs = new ResizeObserver(() => { if (inner.offsetWidth > 0) { node.w = inner.offsetWidth; node.h = inner.offsetHeight; } });
      obs.observe(inner); node._resizeObserver = obs;
    }, 0);
    el.addEventListener('mousedown', (e) => brainNodeMouseDown(e, node.id));
    el.addEventListener('click', (e) => brainNodeClick(e, node.id));
    el.addEventListener('contextmenu', (e) => brainNodeCtx(e, node.id));
    el.addEventListener('dblclick', (e) => { e.stopPropagation(); brainHideAllMenus(); brainOpenEditor(node); });
    nodesLayer.appendChild(el);
    renderedNodeMap.set(node.id, el);
  });

  let svgContent = '';
  brain.links.forEach(link => {
    const fn = brain.nodes.find(n => n.id === link.from), tn = brain.nodes.find(n => n.id === link.to);
    if (!fn || !tn) return;
    const fEl = renderedNodeMap.get(link.from), tEl = renderedNodeMap.get(link.to);
    const fw = fEl ? fEl.offsetWidth / 2 : 125, fh = fEl ? fEl.offsetHeight / 2 : 40;
    const tw = tEl ? tEl.offsetWidth / 2 : 125, th = tEl ? tEl.offsetHeight / 2 : 40;
    const x1 = fn.x + fw, y1 = fn.y + fh, x2 = tn.x + tw, y2 = tn.y + th;
    const dy = Math.abs(y2 - y1), bend = Math.min(Math.max(dy * 0.5, 40), 180);
    const d = `M ${x1} ${y1} C ${x1} ${y1 + bend}, ${x2} ${y2 - bend}, ${x2} ${y2}`;
    const lc = link.color ? `stroke:${vizColorMap(link.color)};` : '';
    svgContent += `<g class="viz-link-group" data-link-id="${link.id}" oncontextmenu="brainLinkCtx(event,'${link.id}')">
      <path class="viz-link-hitbox" d="${d}"/>
      <path class="viz-link custom-link" d="${d}" style="${lc}" marker-end="url(#viz-arrowhead-custom)"/>
    </g>`;
  });
  if (brain.linkingFrom) {
    const fn = brain.nodes.find(n => n.id === brain.linkingFrom);
    if (fn) {
      const fEl = renderedNodeMap.get(brain.linkingFrom);
      const fw = fEl ? fEl.offsetWidth / 2 : 125, fh = fEl ? fEl.offsetHeight / 2 : 40;
      svgContent += `<path id="viz-temp-link" class="viz-link custom-link" d="M ${fn.x + fw} ${fn.y + fh} C ${fn.x + fw} ${fn.y + fh}, ${fn.x + fw} ${fn.y + fh}, ${fn.x + fw} ${fn.y + fh}" style="pointer-events:none;"/>`;
    }
  }
  const existingDefs = svg ? svg.querySelector('defs') : null;
  if (svg) { svg.innerHTML = svgContent; if (existingDefs) svg.insertBefore(existingDefs, svg.firstChild); }
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: container });
  brainUpdateZoomDisplay();
  brainUpdateMinimap();
}

function brainNodeClick(e, nodeId) {
  e.stopPropagation();
  if (brain.linkingFrom) {
    if (brain.linkingFrom !== nodeId) brainAddLink(brain.linkingFrom, nodeId);
    brainCancelLinking(); return;
  }
  if (brain.linkModeEnabled) { brainStartLinking(nodeId); return; }
  brain.selectedNodeId = nodeId;
  brainRenderCanvas();
}

function brainNodeMouseDown(e, nodeId) {
  if (e.button !== 0) return;
  e.stopPropagation();
  const node = brain.nodes.find(n => n.id === nodeId);
  if (!node) return;
  const inner = e.target.closest('.viz-node-inner');
  if (inner) {
    const rect = inner.getBoundingClientRect();
    if ((e.clientX - rect.left) / brain.zoom > inner.offsetWidth - 25 && (e.clientY - rect.top) / brain.zoom > inner.offsetHeight - 25) return;
  }
  const container = document.getElementById('viz-canvas-container');
  const rect = container ? container.getBoundingClientRect() : { left: 0, top: 0 };
  brainPushUndo();
  brain.draggingNode = nodeId; brain._hasDragged = false; brain._dragStartPos = { x: e.clientX, y: e.clientY };
  brain.dragOffset.x = (e.clientX - rect.left - brain.pan.x) / brain.zoom - node.x;
  brain.dragOffset.y = (e.clientY - rect.top - brain.pan.y) / brain.zoom - node.y;
  document.addEventListener('mousemove', brainNodeDrag);
  document.addEventListener('mouseup', brainNodeDragEnd);
}

function brainNodeDrag(e) {
  if (!brain.draggingNode) return;
  if (!brain._hasDragged) {
    if (brain._dragStartPos && Math.abs(e.clientX - brain._dragStartPos.x) < 3 && Math.abs(e.clientY - brain._dragStartPos.y) < 3) return;
    brain._hasDragged = true;
  }
  const node = brain.nodes.find(n => n.id === brain.draggingNode);
  if (!node) return;
  const container = document.getElementById('viz-canvas-container');
  const rect = container ? container.getBoundingClientRect() : { left: 0, top: 0 };
  node.x = (e.clientX - rect.left - brain.pan.x) / brain.zoom - brain.dragOffset.x;
  node.y = (e.clientY - rect.top - brain.pan.y) / brain.zoom - brain.dragOffset.y;
  const el = document.querySelector(`.viz-node[data-node-id="${node.id}"]`);
  if (el) { el.style.left = node.x + 'px'; el.style.top = node.y + 'px'; el.classList.add('dragging'); }
  requestAnimationFrame(brainRenderCanvas);
}

function brainNodeDragEnd() {
  if (brain.draggingNode) { const el = document.querySelector(`.viz-node[data-node-id="${brain.draggingNode}"]`); if (el) el.classList.remove('dragging'); }
  brain.draggingNode = null;
  document.removeEventListener('mousemove', brainNodeDrag);
  document.removeEventListener('mouseup', brainNodeDragEnd);
  if (brain._hasDragged) { brainRenderCanvas(); brainSaveCurrentVersion(); }
  brain._hasDragged = false;
}

function brainCanvasMouseDown(e) {
  if (e.target.closest('.viz-node') || e.button !== 0) return;
  brain.isPanning = true;
  brain.panStart = { x: e.clientX, y: e.clientY };
  brain.panStartOffset = { ...brain.pan };
  const container = document.getElementById('viz-canvas-container');
  if (container) container.classList.add('panning');
}

function brainCanvasMouseMove(e) {
  if (brain.linkingFrom) {
    const tempLink = document.getElementById('viz-temp-link');
    const container = document.getElementById('viz-canvas-container');
    if (tempLink && container) {
      const rect = container.getBoundingClientRect();
      const mx = (e.clientX - rect.left - brain.pan.x) / brain.zoom;
      const my = (e.clientY - rect.top - brain.pan.y) / brain.zoom;
      const d = tempLink.getAttribute('d') || '';
      const m = d.match(/M (\S+) (\S+)/);
      if (m) {
        const fx = parseFloat(m[1]), fy = parseFloat(m[2]);
        const bend = Math.min(Math.max(Math.abs(my - fy) * 0.5, 40), 180);
        tempLink.setAttribute('d', `M ${fx} ${fy} C ${fx} ${fy + bend}, ${mx} ${my - bend}, ${mx} ${my}`);
      }
    }
  }
  if (!brain.isPanning) return;
  brain.pan.x = brain.panStartOffset.x + (e.clientX - brain.panStart.x);
  brain.pan.y = brain.panStartOffset.y + (e.clientY - brain.panStart.y);
  const nodesLayer = document.getElementById('viz-nodes-layer');
  const svg = document.getElementById('viz-canvas-svg');
  if (nodesLayer) nodesLayer.style.transform = `translate(${brain.pan.x}px, ${brain.pan.y}px) scale(${brain.zoom})`;
  if (svg) svg.style.transform = `translate(${brain.pan.x}px, ${brain.pan.y}px) scale(${brain.zoom})`;
  brainUpdateMinimap();
}

function brainCanvasMouseUp() {
  brain.isPanning = false;
  const container = document.getElementById('viz-canvas-container');
  if (container) container.classList.remove('panning');
  brainSaveCurrentVersion();
}

function brainCanvasWheel(e) {
  e.preventDefault();
  const container = document.getElementById('viz-canvas-container');
  if (!container) return;
  const rect = container.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  const tx = (mx - brain.pan.x) / brain.zoom, ty = (my - brain.pan.y) / brain.zoom;
  const newZoom = Math.min(3, Math.max(0.2, brain.zoom + (e.deltaY > 0 ? -0.08 : 0.08)));
  brain.pan.x = mx - tx * newZoom; brain.pan.y = my - ty * newZoom;
  brain.zoom = newZoom;
  brainRenderCanvas(); brainSaveCurrentVersion();
}

function brainCanvasDblClick(e) {
  if (!brain.activeVersionId) return;
  if (e.target.closest('.viz-node') || e.target.closest('.viz-minimap')) return;
  const container = document.getElementById('viz-canvas-container');
  if (!container) return;
  const rect = container.getBoundingClientRect();
  const x = (e.clientX - rect.left - brain.pan.x) / brain.zoom;
  const y = (e.clientY - rect.top - brain.pan.y) / brain.zoom;
  brainAddCommentNode(x, y);
}

function brainCanvasCtx(e) {
  if (e.target.closest('.viz-node')) return;
  e.preventDefault();
  brainHideAllMenus();
  const menu = document.getElementById('brain-canvas-ctx');
  if (!menu) return;
  const container = document.getElementById('viz-canvas-container');
  const rect = container ? container.getBoundingClientRect() : { left: 0, top: 0 };
  brain.contextPos = { x: (e.clientX - rect.left - brain.pan.x) / brain.zoom, y: (e.clientY - rect.top - brain.pan.y) / brain.zoom };
  menu.style.left = e.clientX + 'px'; menu.style.top = e.clientY + 'px';
  menu.classList.remove('hidden');
}

function brainAddCommentNode(x, y) {
  if (!brain.activeVersionId) {
    const id = 'bv_' + generateId();
    brain.versions.push({ id, name: 'Default Version', folderId: null, nodes: [], links: [], pan: { x: 0, y: 0 }, zoom: 1 });
    brain.activeVersionId = id;
    brainSave();
    brainRenderSidebar();
    brainUpdateCanvasToolbar();
  }

  const cx = x !== undefined ? x : ((-brain.pan.x / brain.zoom) + 200);
  const cy = y !== undefined ? y : ((-brain.pan.y / brain.zoom) + 200);
  const id = 'bn_' + generateId();
  const node = { id, commentContent: '', color: null, x: cx + (Math.random() - 0.5) * 40, y: cy + (Math.random() - 0.5) * 40 };
  brain.nodes.push(node);
  brain.selectedNodeId = id;
  brainRenderCanvas();
  brainOpenEditor(node);
}

function brainDeleteNode(nodeId) {
  brain.nodes = brain.nodes.filter(n => n.id !== nodeId);
  brain.links = brain.links.filter(l => l.from !== nodeId && l.to !== nodeId);
  if (brain.selectedNodeId === nodeId) brain.selectedNodeId = null;
  brainRenderCanvas(); brainSaveCurrentVersion();
}

function brainOpenEditor(node) {
  let overlay = document.getElementById('viz-comment-editor-overlay');
  if (overlay) overlay.remove();
  overlay = document.createElement('div');
  overlay.id = 'viz-comment-editor-overlay';
  overlay.className = 'viz-comment-editor-overlay';
  document.body.appendChild(overlay);
  overlay.innerHTML = `<div class="viz-comment-editor-window">
    <div class="viz-comment-editor-header">
      <i data-lucide="brain-circuit"></i>
      <span>Brain Note</span>
      <button class="viz-comment-editor-close" onclick="document.getElementById('viz-comment-editor-overlay').remove()"><i data-lucide="x"></i></button>
    </div>
    <div class="viz-comment-editor-body">
      <textarea id="viz-comment-editor-textarea" class="viz-comment-editor-textarea" spellcheck="false" placeholder="Enter your idea...">${escapeHTML(node.commentContent || '')}</textarea>
    </div>
    <div class="viz-comment-editor-footer">
      <button class="btn btn-primary" id="viz-comment-editor-save">Save &amp; Close</button>
    </div>
  </div>`;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: overlay });
  document.getElementById('viz-comment-editor-save').onclick = () => {
    node.commentContent = document.getElementById('viz-comment-editor-textarea').value;
    brainRenderCanvas(); brainSaveCurrentVersion(); overlay.remove();
  };
}

function brainAddLink(fromId, toId) {
  if (brain.links.find(l => (l.from === fromId && l.to === toId) || (l.from === toId && l.to === fromId))) return;
  brain.links.push({ id: 'bl_' + generateId(), from: fromId, to: toId, color: null });
  brainRenderCanvas(); brainSaveCurrentVersion();
}

function brainDeleteLink(linkId) {
  brain.links = brain.links.filter(l => l.id !== linkId);
  brainRenderCanvas(); brainSaveCurrentVersion();
}

function brainStartLinking(nodeId) {
  brain.linkingFrom = nodeId;
  const container = document.getElementById('viz-canvas-container');
  if (container) container.classList.add('linking-mode');
  let hint = document.getElementById('viz-linking-hint');
  if (!hint) {
    hint = document.createElement('div'); hint.id = 'viz-linking-hint'; hint.className = 'viz-linking-hint';
    hint.innerHTML = '<i data-lucide="link"></i> Click another node to connect';
    container.appendChild(hint); if (typeof lucide !== 'undefined') lucide.createIcons({ root: hint });
  }
  hint.classList.remove('hidden');
  brainRenderCanvas();
}

function brainCancelLinking() {
  brain.linkingFrom = null;
  const container = document.getElementById('viz-canvas-container');
  if (container) container.classList.remove('linking-mode');
  const hint = document.getElementById('viz-linking-hint');
  if (hint) hint.classList.add('hidden');
  brainRenderCanvas();
}

function brainToggleLinkMode() {
  brain.linkModeEnabled = !brain.linkModeEnabled;
  if (!brain.linkModeEnabled && brain.linkingFrom) brainCancelLinking();
  const btn = document.getElementById('viz-link-toggle-btn');
  if (btn) {
    btn.style.color = brain.linkModeEnabled ? 'var(--color-primary)' : '';
    btn.style.borderColor = brain.linkModeEnabled ? 'var(--color-primary)' : '';
  }
}

function brainHideAllMenus() {
  document.querySelectorAll('.viz-context-menu, .viz-link-menu, #brain-canvas-ctx, #brain-node-ctx, #brain-link-ctx, #brain-version-ctx').forEach(m => m.classList.add('hidden'));
}

function brainNodeCtx(e, nodeId) {
  e.preventDefault(); e.stopPropagation();
  brainHideAllMenus();
  brain.contextNodeId = nodeId;
  const menu = document.getElementById('brain-node-ctx');
  if (!menu) return;
  menu.style.left = e.clientX + 'px'; menu.style.top = e.clientY + 'px';
  menu.classList.remove('hidden');
  menu.querySelectorAll('.viz-color-swatch').forEach(sw => {
    const node = brain.nodes.find(n => n.id === nodeId);
    sw.classList.toggle('active', sw.dataset.color === (node?.color || ''));
  });
}

function brainLinkCtx(e, linkId) {
  e.preventDefault(); e.stopPropagation();
  brainHideAllMenus();
  brain.contextLinkId = linkId;
  const menu = document.getElementById('brain-link-ctx');
  if (!menu) return;
  menu.style.left = e.clientX + 'px'; menu.style.top = e.clientY + 'px';
  menu.classList.remove('hidden');
  const link = brain.links.find(l => l.id === linkId);
  menu.querySelectorAll('.viz-color-swatch').forEach(sw => { sw.classList.toggle('active', sw.dataset.color === (link?.color || '')); });
}

function brainCtxAddComment() {
  brainHideAllMenus();
  brainAddCommentNode(brain.contextPos?.x, brain.contextPos?.y);
}

function brainCtxEditComment() {
  if (!brain.contextNodeId) return;
  const node = brain.nodes.find(n => n.id === brain.contextNodeId);
  if (node) brainOpenEditor(node);
  brainHideAllMenus();
}

function brainCtxDeleteNode() {
  if (brain.contextNodeId) brainDeleteNode(brain.contextNodeId);
  brainHideAllMenus();
}

function brainCtxEditColor(color) {
  if (!brain.contextNodeId) return;
  const node = brain.nodes.find(n => n.id === brain.contextNodeId);
  if (node) { node.color = color; brainRenderCanvas(); brainSaveCurrentVersion(); }
  brainHideAllMenus();
}

function brainCtxDeleteLink() {
  if (brain.contextLinkId) brainDeleteLink(brain.contextLinkId);
  brainHideAllMenus();
}

function brainCtxEditLinkColor(color) {
  if (!brain.contextLinkId) return;
  const link = brain.links.find(l => l.id === brain.contextLinkId);
  if (link) { link.color = color; brainRenderCanvas(); brainSaveCurrentVersion(); }
  brainHideAllMenus();
}

function brainCtxStartLink() {
  if (brain.contextNodeId) brainStartLinking(brain.contextNodeId);
  brainHideAllMenus();
}

function brainAutoLayout() {
  if (!brain.nodes.length) return;
  brainPushUndo();
  const cols = Math.ceil(Math.sqrt(brain.nodes.length));
  const COL_W = 320, ROW_H = 200, OX = 100, OY = 100;
  brain.nodes.forEach((n, i) => { n.x = OX + (i % cols) * COL_W; n.y = OY + Math.floor(i / cols) * ROW_H; });
  brainRenderCanvas(); brainSaveCurrentVersion();
  setTimeout(() => brainCenterCanvas(), 50);
}

function brainSearchNodes(query) {
  brain.searchQuery = (query || '').toLowerCase().trim();
  brain._highlightedIds = new Set();
  if (brain.searchQuery) {
    brain.nodes.forEach(n => { if ((n.commentContent || '').toLowerCase().includes(brain.searchQuery)) brain._highlightedIds.add(n.id); });
  }
  brainRenderCanvas();
}

function brainClearSearch() {
  const inp = document.getElementById('viz-search-input');
  if (inp) inp.value = '';
  brainSearchNodes('');
}

function initBrain() {
  brainLoad();
  if (brain.activeVersionId) {
    const v = brain.versions.find(v => v.id === brain.activeVersionId);
    if (v) {
      brain.nodes = JSON.parse(JSON.stringify(v.nodes || []));
      brain.links = JSON.parse(JSON.stringify(v.links || []));
      brain.pan = v.pan ? { ...v.pan } : { x: 0, y: 0 };
      brain.zoom = v.zoom || 1;
    } else { brain.activeVersionId = null; }
  }
  brainRenderSidebar();
  brainRenderCanvas();
  setTimeout(() => { if (brain.nodes.length > 0) brainCenterCanvas(); else brainUpdateMinimap(); }, 50);
}
