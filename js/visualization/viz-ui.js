/* ============================================================
   VIZ-UI.JS — Context Menus, Popups, Panels & UI Interactions
   ============================================================ */

function vizSwitchModule(mod) {
  if (viz.activeModule === 'brain' && mod !== 'brain') {
    brainSaveCurrentVersion();
    brain.linkingFrom = null; brain.linkModeEnabled = false;
  }
  viz.folderStatePerModule[viz.activeModule] = viz.selectedFolderId;
  viz.activeModule = mod;
  viz.selectedFolderId = viz.folderStatePerModule[mod] || null;
  viz.selectedNodeId = null;

  if (viz.linkModeEnabled) vizToggleLinkMode();

  document.querySelectorAll('.viz-module-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.module === mod);
  });

  const linkBtn = document.getElementById('viz-link-toggle-btn');
  if (linkBtn) { linkBtn.style.color = ''; linkBtn.style.borderColor = ''; }

  if (mod === 'brain') {
    initBrain();
  } else {
    vizRenderContentPane();
    vizRenderCanvas();
    setTimeout(() => vizCenterCanvas(), 50);
  }
}

function vizRenderContentPane() {
  if (viz.activeModule === 'brain') { brainRenderSidebar(); return; }
  const body = document.getElementById('viz-content-body');
  const titleEl = document.getElementById('viz-content-scope-label');
  const breadcrumbEl = document.getElementById('viz-content-breadcrumb');
  if (!body) return;

  const scopeMap = { challenge: 'Programs', snippet: 'Snippets', notebook: 'Notebooks', general: 'General (All)' };
  if (titleEl) titleEl.textContent = scopeMap[viz.activeModule] || 'Contents';
  if (breadcrumbEl) breadcrumbEl.innerHTML = `<span class="viz-breadcrumb-item" style="cursor:default;color:var(--text-primary)">Root</span>`;

  if (viz.activeModule === 'general') {
    let html = '';
    const allScopes = ['challenge', 'snippet', 'notebook'];
    const scopeIcons = { challenge: 'code', snippet: 'file-text', notebook: 'book' };
    const scopeLabels = { challenge: 'Programs', snippet: 'Snippets', notebook: 'Notebooks' };
    allScopes.forEach(scope => {
      const items = typeof getItemsForScope === 'function' ? getItemsForScope(scope) : [];
      if (items.length === 0) return;
      html += `<div style="font-size:0.7rem;font-weight:700;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.06em;padding:0.5rem 0.75rem 0.25rem;">${scopeLabels[scope]}</div>`;
      items.forEach(it => {
        const title = it.title || it.name || 'Untitled';
        const icon = it.icon || scopeIcons[scope] || 'file';
        const isActive = viz.selectedNodeId && viz.nodes.find(n => n.id === viz.selectedNodeId)?.dataId === it.id;
        html += `<div class="viz-list-item ${isActive ? 'active' : ''}" draggable="true" ondragstart="vizSidebarDragStart(event,'${it.id}','item')" onclick="vizContentClickItem('${it.id}','${scope}')">
          <i data-lucide="${icon}" class="viz-item-icon-item"></i>
          <span class="viz-item-label">${escapeHTML(title)}</span>
          <span class="viz-item-badge" style="font-size:0.6rem;">${scope.charAt(0).toUpperCase()}</span>
        </div>`;
      });
    });
    if (!html) html = `<div class="viz-content-empty"><i data-lucide="inbox"></i><p>No items yet</p></div>`;
    body.innerHTML = html;
    lucide.createIcons({ root: body });
    return;
  }

  const scope = viz.activeModule;
  const iconMap = { challenge: 'code', snippet: 'file-text', notebook: 'book' };

  function renderTree(parentId, depth) {
    let html = '';
    const indent = depth * 14;
    const folders = state.nodes.filter(n => n.type === 'folder' && n.scope === scope && (n.parentId || null) === parentId);
    const items = (typeof getItemsForScope === 'function' ? getItemsForScope(scope) : []).filter(it => (it.parentId || null) === parentId);

    folders.forEach(f => {
      const isExpanded = viz.expandedFolderIds.has(f.id);
      const count = typeof countItemsRecursive === 'function' ? countItemsRecursive(f.id, scope) : 0;
      const isActive = viz.selectedFolderId === f.id;
      html += `<div class="viz-list-item viz-folder-row ${isActive ? 'active' : ''}" style="padding-left:${8 + indent}px" draggable="true" ondragstart="vizSidebarDragStart(event,'${f.id}','folder')" onclick="vizContentClickFolder('${f.id}')" oncontextmenu="vizContentCtx(event,'${f.id}','folder')">
        <i data-lucide="${isExpanded ? 'chevron-down' : 'chevron-right'}" class="viz-folder-chevron"></i>
        <i data-lucide="${f.icon || 'folder'}" class="viz-item-icon-folder"></i>
        <span class="viz-item-label">${escapeHTML(f.name)}</span>
        <span class="viz-item-badge">${count}</span>
      </div>`;
      if (isExpanded) {
        html += renderTree(f.id, depth + 1);
      }
    });

    items.forEach(it => {
      const title = it.title || it.name || 'Untitled';
      const icon = it.icon || iconMap[scope] || 'file';
      const isActive = viz.selectedNodeId && viz.nodes.find(n => n.id === viz.selectedNodeId)?.dataId === it.id;
      html += `<div class="viz-list-item ${isActive ? 'active' : ''}" style="padding-left:${8 + indent}px" draggable="true" ondragstart="vizSidebarDragStart(event,'${it.id}','item')" onclick="vizContentClickItem('${it.id}','${scope}')" oncontextmenu="vizContentCtx(event,'${it.id}','item')">
        <i data-lucide="${icon}" class="viz-item-icon-item"></i>
        <span class="viz-item-label">${escapeHTML(title)}</span>
      </div>`;
    });

    return html;
  }

  const html = renderTree(null, 0);
  body.innerHTML = html || `<div class="viz-content-empty"><i data-lucide="inbox"></i><p>No items yet</p></div>`;
  lucide.createIcons({ root: body });
}

function vizContentClickFolder(folderId) {
  if (viz.expandedFolderIds.has(folderId)) {
    viz.expandedFolderIds.delete(folderId);
  } else {
    viz.expandedFolderIds.add(folderId);
  }
  viz.selectedFolderId = folderId;
  const canvasNode = viz.nodes.find(n => n.dataId === folderId);
  viz.selectedNodeId = canvasNode ? canvasNode.id : null;
  vizRenderContentPane();
  vizRenderCanvas();
}

function vizContentClickItem(itemId, scope) {
  const canvasNode = viz.nodes.find(n => n.dataId === itemId);
  viz.selectedNodeId = canvasNode ? canvasNode.id : null;
  vizRenderContentPane();
  vizRenderCanvas();
}

function vizContentCtx(e, id, type) {
  e.preventDefault();
  if (viz.activeModule === 'general') return;
  const scope = viz.activeModule;
  if (viz.nodes.find(n => n.dataId === id)) return;

  if (type === 'folder') {
    const folder = state.nodes.find(n => n.id === id);
    if (folder) {
      const newNode = vizAddCanvasNode(folder.name, 'folder', id, scope);
      const parentId = folder.parentId || 'root';
      const parentViz = viz.nodes.find(n => n.dataId === parentId && n.scope === scope);
      if (parentViz) vizAddLink(parentViz.id, newNode.id);
    }
  } else {
    const items = getItemsForScope(scope);
    const item = items.find(it => it.id === id);
    if (item) {
      const newNode = vizAddCanvasNode(item.title || item.name || 'Untitled', scope, id, scope);
      const parentId = item.parentId || 'root';
      const parentViz = viz.nodes.find(n => n.dataId === parentId && n.scope === scope);
      if (parentViz) vizAddLink(parentViz.id, newNode.id);
    }
  }
  vizRenderContentPane();
}

function vizNodeClick(e, nodeId) {
  e.stopPropagation();

  const nodeEl = e.target.closest('.viz-node');
  const isFogged = nodeEl && nodeEl.classList.contains('viz-fog-of-war');

  if (viz.colorModeEnabled && !isFogged) {
    vizEditNodeColor(nodeId, viz.colorPaintColor || null);
    return;
  }

  if (viz.linkingFrom) {
    // Port drag completes via its own mouseup listener — ignore clicks from it
    if (viz.portDrag) return;
    if (viz.linkingFrom !== nodeId) {
      vizAddLink(viz.linkingFrom, nodeId);
    }
    vizCancelLinking();
    // Turn off link mode after completing one link so it doesn't re-activate
    if (viz.linkModeEnabled) vizToggleLinkMode();
    return;
  }

  if (viz.linkModeEnabled) {
    vizStartLinking(nodeId);
    return;
  }
  viz.selectedNodeId = nodeId;

  const node = viz.nodes.find(n => n.id === nodeId);
  if (node && node.type === 'folder' && node.dataId) {
    viz.selectedFolderId = node.dataId === 'root' ? null : node.dataId;
    if (node.dataId && node.dataId !== 'root') viz.expandedFolderIds.add(node.dataId);
    vizRenderContentPane();
    vizHideNodePopup();
  } else if (node && ['challenge', 'snippet', 'notebook'].includes(node.type)) {
    if (isFogged) {
      vizHideNodePopup();
    } else {
      vizShowNodePopup(node, e.clientX, e.clientY);
    }
  } else {
    vizHideNodePopup();
  }

  vizRenderCanvas();
}

function vizHideAllMenus() {
  document.querySelectorAll('.viz-context-menu, .viz-link-menu, #brain-canvas-ctx, #brain-node-ctx, #brain-link-ctx, #brain-version-ctx').forEach(m => m.classList.add('hidden'));
  document.getElementById('viz-link-type-popup')?.classList.add('hidden');
}

function vizCanvasCtx(e) {
  if (viz.activeModule === 'brain') { brainCanvasCtx(e); return; }
  if (e.target.closest('.viz-node')) return;
  e.preventDefault();
  vizHideAllMenus();

  const menu = document.getElementById('viz-canvas-ctx');
  if (!menu) return;

  const scopeLabels = { challenge: 'Program', snippet: 'Snippet', notebook: 'Notebook', general: 'Node' };
  const currentScope = scopeLabels[viz.activeModule] || 'Node';

  const addNodeBtn = menu.querySelector('[onclick="vizCtxAddNode()"]');
  if (addNodeBtn) addNodeBtn.innerHTML = `<i data-lucide="plus-circle"></i> <span>Add ${escapeHTML(currentScope)}</span>`;

  const addFolderBtn = menu.querySelector('[onclick="vizCtxAddFolder()"]');
  if (addFolderBtn) addFolderBtn.innerHTML = `<i data-lucide="folder-plus"></i> <span>Add Category</span>`;

  lucide.createIcons({ root: menu });

  const container = document.getElementById('viz-canvas-container');
  const rect = container ? container.getBoundingClientRect() : { left: 0, top: 0 };

  viz.contextPos = {
    x: (e.clientX - rect.left - viz.pan.x) / viz.zoom,
    y: (e.clientY - rect.top - viz.pan.y) / viz.zoom
  };

  menu.style.left = e.clientX + 'px';
  menu.style.top = e.clientY + 'px';
  menu.classList.remove('hidden');
}

function vizCtxAddNode() {
  showInputDialog('Add Node', null, 'Node name', '', (label) => {
    const scope = viz.activeModule === 'general' ? 'challenge' : viz.activeModule;
    const newNode = vizAddCanvasNode(label.trim(), scope, null, scope, viz.contextPos?.x, viz.contextPos?.y);
    newNode.isDraft = true;
    vizCommitDraftNode(newNode, null);
    vizRenderContentPane();
    vizRenderCanvas();
    vizSave();
    vizHideAllMenus();
  });
}

function vizCtxAddFolder() {
  showInputDialog('Add Folder', null, 'Folder name', '', (label) => {
    const scope = viz.activeModule === 'general' ? 'challenge' : viz.activeModule;
    const node = vizAddCanvasNode(label.trim(), 'folder', null, scope, viz.contextPos?.x, viz.contextPos?.y);
    node.isDraft = true;
    vizCommitDraftNode(node, null);
    vizRenderContentPane();
    vizRenderCanvas();
    vizSave();
    vizHideAllMenus();
  });
}

function vizCtxAddComment() {
  const scope = viz.activeModule === 'general' ? 'challenge' : viz.activeModule;
  const cx = viz.contextPos?.x ?? ((-viz.pan.x / viz.zoom) + 200);
  const cy = viz.contextPos?.y ?? ((-viz.pan.y / viz.zoom) + 200);
  const newNode = vizAddCanvasNode('Comment', 'comment', null, scope, cx, cy);
  newNode.commentTitle = '';
  newNode.commentContent = '';
  vizHideAllMenus();
  vizOpenCommentEditor(newNode);
}

function vizNodeCtx(e, nodeId) {
  e.preventDefault();
  e.stopPropagation();
  vizHideAllMenus();

  const el = document.querySelector(`.viz-node[data-node-id="${nodeId}"]`);
  if (el && el.classList.contains('viz-fog-of-war')) return;

  viz.contextNodeId = nodeId;

  const menu = document.getElementById('viz-node-ctx');
  if (!menu) return;

  const node = viz.nodes.find(n => n.id === nodeId);

  const deleteBtn = menu.querySelector('.viz-ctx-item.danger');
  if (deleteBtn) {
    deleteBtn.style.display = node.dataId === 'root' ? 'none' : 'flex';
  }

  const editCommentBtn = document.getElementById('viz-ctx-edit-comment-btn');
  if (editCommentBtn) {
    editCommentBtn.style.display = node.type === 'comment' ? 'flex' : 'none';
  }

  const resizeBtn = document.getElementById('viz-ctx-resize-btn');
  if (resizeBtn) {
    resizeBtn.style.display = node.type === 'root' ? 'none' : 'flex';
  }

  menu.style.left = e.clientX + 'px';
  menu.style.top = e.clientY + 'px';
  menu.classList.remove('hidden');

  menu.querySelectorAll('.viz-color-swatch').forEach(sw => {
    sw.classList.toggle('active', sw.dataset.color === (node?.color || ''));
  });
}

function vizCtxEditColor(color) {
  if (viz.contextNodeId) vizEditNodeColor(viz.contextNodeId, color);
  vizHideAllMenus();
}

function vizCtxDeleteNode() {
  if (viz.contextNodeId) vizDeleteNode(viz.contextNodeId);
  vizHideAllMenus();
}

function vizCtxEditComment() {
  if (viz.contextNodeId) {
    const node = viz.nodes.find(n => n.id === viz.contextNodeId);
    if (node && node.type === 'comment') {
      vizOpenCommentEditor(node);
    }
  }
  vizHideAllMenus();
}

function vizOpenCommentEditor(node) {
  let overlay = document.getElementById('viz-comment-editor-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'viz-comment-editor-overlay';
    overlay.className = 'viz-comment-editor-overlay';
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="viz-comment-editor-window">
      <div class="viz-comment-editor-header">
        <i data-lucide="terminal"></i>
        <span>Edit Comment</span>
        <button class="viz-comment-editor-close" onclick="document.getElementById('viz-comment-editor-overlay').remove()"><i data-lucide="x"></i></button>
      </div>
      <div class="viz-comment-editor-body">
        <textarea id="viz-comment-editor-textarea" class="viz-comment-editor-textarea" spellcheck="false" placeholder="Enter context here...">${escapeHTML(node.commentContent || '')}</textarea>
      </div>
      <div class="viz-comment-editor-footer">
        <button class="btn btn-primary" id="viz-comment-editor-save">Save & Close</button>
      </div>
    </div>
  `;

  lucide.createIcons({ root: overlay });

  const saveBtn = document.getElementById('viz-comment-editor-save');
  saveBtn.onclick = () => {
    node.commentContent = document.getElementById('viz-comment-editor-textarea').value;
    vizRenderCanvas();
    vizSave();
    overlay.remove();
  };
}

function vizCtxAddChild() {
  if (viz.contextNodeId) vizAddChildNode(viz.contextNodeId);
  vizHideAllMenus();
}

function vizCtxAddChildFolder() {
  if (viz.contextNodeId) vizAddChildFolder(viz.contextNodeId);
  vizHideAllMenus();
}

function vizCtxAddLink() {
  if (viz.contextNodeId) vizStartLinking(viz.contextNodeId);
  vizHideAllMenus();
}

function vizLinkCtx(e, linkId) {
  e.preventDefault();
  e.stopPropagation();
  vizHideAllMenus();
  viz.contextLinkId = linkId;
  const menu = document.getElementById('viz-link-ctx');
  if (!menu) return;
  menu.style.left = e.clientX + 'px';
  menu.style.top = e.clientY + 'px';
  const link = viz.links.find(l => l.id === linkId);
  const lockBtn = menu.querySelector('[data-action="toggle-lock"]');
  if (lockBtn && link) lockBtn.innerHTML = `<i data-lucide="${link.locked ? 'unlock' : 'lock'}"></i> ${link.locked ? 'Unlock' : 'Lock'}`;
  menu.querySelectorAll('.viz-color-swatch').forEach(sw => {
    sw.classList.toggle('active', sw.dataset.color === (link?.color || ''));
  });
  menu.classList.remove('hidden');
  lucide.createIcons({ root: menu });
}

function vizCtxToggleLock() {
  if (viz.contextLinkId) vizToggleLinkLock(viz.contextLinkId);
  vizHideAllMenus();
}

function vizCtxDeleteLink() {
  if (viz.contextLinkId) vizDeleteLink(viz.contextLinkId);
  vizHideAllMenus();
}

function vizCtxRenameNode() {
  vizHideAllMenus();
  if (!viz.contextNodeId) return;
  const node = viz.nodes.find(n => n.id === viz.contextNodeId);
  if (!node) return;
  showInputDialog('Rename Node', null, 'Name', node.label, (newLabel) => {
    node.label = newLabel.trim();
    if (node.dataId && node.type === 'folder') {
      const folder = state.nodes.find(n => n.id === node.dataId);
      if (folder) { folder.name = node.label; saveData(); }
    }
    vizRenderCanvas();
    vizRenderContentPane();
    vizSave();
  });
}

function vizCtxEditLinkColor(color) {
  if (!viz.contextLinkId) return;
  const link = viz.links.find(l => l.id === viz.contextLinkId);
  if (link) {
    link.color = color;
    vizRenderCanvas();
    vizSave();
  }
  vizHideAllMenus();
}

function vizCtxSetLinkArrow(type) {
  if (!viz.contextLinkId) return;
  const link = viz.links.find(l => l.id === viz.contextLinkId);
  if (link) {
    link.arrowType = type;
    vizRenderCanvas();
    vizSave();
  }
  vizHideAllMenus();
}

function vizSearchNodes(query) {
  if (viz.activeModule === 'brain') { brainSearchNodes(query); const cb = document.getElementById('viz-search-clear'); if (cb) cb.classList.toggle('hidden', !query); return; }
  viz.searchQuery = (query || '').toLowerCase().trim();
  const clearBtn = document.getElementById('viz-search-clear');
  if (clearBtn) clearBtn.classList.toggle('hidden', !viz.searchQuery);

  const scopes = vizGetVisibleScopes();
  viz.highlightedNodeIds = new Set();
  if (viz.searchQuery) {
    viz.nodes.filter(n => scopes.includes(n.scope)).forEach(n => {
      if ((n.label || '').toLowerCase().includes(viz.searchQuery)) viz.highlightedNodeIds.add(n.id);
    });
  }
  vizRenderContentPane();
  vizRenderCanvas();
}

function vizClearSearch() {
  const inp = document.getElementById('viz-search-input');
  if (inp) inp.value = '';
  if (viz.activeModule === 'brain') { brainSearchNodes(''); return; }
  vizSearchNodes('');
}

function vizShowNodePopup(node, x, y) {
  const popup = document.getElementById('viz-node-details-popup');
  if (!popup) return;
  vizHideAllMenus();

  viz.popupTargetNode = node;
  document.getElementById('viz-popup-title').textContent = node.label;

  const typeBadge = document.getElementById('viz-popup-type-badge');
  if (typeBadge) {
    const typeLabels = { challenge: 'Program', snippet: 'Snippet', notebook: 'Notebook' };
    typeBadge.textContent = typeLabels[node.type] || node.type || '';
  }

  const actionsEl = document.getElementById('viz-popup-actions');
  if (actionsEl) {
    let btns = '';
    if (node.type === 'challenge') {
      btns = `<button class="btn btn-ghost btn-sm" onclick="vizPopupPlay()" title="Practice" style="padding:0.25rem;"><i data-lucide="play" style="width:16px;height:16px;color:var(--color-success);"></i></button>
        <button class="btn btn-ghost btn-sm" onclick="vizPopupEdit()" title="Edit" style="padding:0.25rem;"><i data-lucide="edit-2" style="width:16px;height:16px;color:var(--color-primary);"></i></button>`;
    } else if (node.type === 'snippet') {
      btns = `<button class="btn btn-ghost btn-sm" onclick="vizPopupPlay()" title="View in Library" style="padding:0.25rem;"><i data-lucide="eye" style="width:16px;height:16px;color:var(--color-success);"></i></button>`;
    } else if (node.type === 'notebook') {
      btns = `<button class="btn btn-ghost btn-sm" onclick="vizPopupPlay()" title="Open Notebook" style="padding:0.25rem;"><i data-lucide="play" style="width:16px;height:16px;color:var(--color-success);"></i></button>
        <button class="btn btn-ghost btn-sm" onclick="vizPopupEdit()" title="Edit Notebook" style="padding:0.25rem;"><i data-lucide="edit-2" style="width:16px;height:16px;color:var(--color-primary);"></i></button>`;
    }
    actionsEl.innerHTML = btns;
  }

  const statsEl = document.getElementById('viz-popup-stats');
  if (statsEl) {
    if (node.type === 'challenge' && node.dataId) {
      const attempts = (state.history || []).filter(h => h.challengeId === node.dataId && !h.isArchived);
      const perfect = attempts.filter(h => h.score === 100);
      const bestScore = attempts.length ? Math.max(...attempts.map(h => h.score || 0)) : null;
      statsEl.innerHTML = `
        <div class="viz-popup-stat"><span class="viz-popup-stat-val">${attempts.length}</span><span class="viz-popup-stat-label">Attempts</span></div>
        <div class="viz-popup-stat"><span class="viz-popup-stat-val" style="color:var(--color-success)">${perfect.length}</span><span class="viz-popup-stat-label">Perfect</span></div>
        <div class="viz-popup-stat"><span class="viz-popup-stat-val" style="color:var(--color-warning)">${bestScore !== null ? bestScore + '%' : '—'}</span><span class="viz-popup-stat-label">Best</span></div>
      `;
      statsEl.style.display = 'flex';
    } else {
      statsEl.style.display = 'none';
    }
  }

  const locksList = document.getElementById('viz-popup-locks-list');
  if (locksList) {
    const allPrograms = viz.nodes.filter(n => ['challenge', 'snippet', 'notebook'].includes(n.type) && n.id !== node.id);
    locksList.innerHTML = allPrograms.map(p => {
      const isLocked = viz.links.some(l => l.locked && ((l.from === p.id && l.to === node.id) || (l.to === p.id && l.from === node.id)));
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:0.375rem 0.5rem;background:var(--bg-surface);border-radius:var(--radius-sm);border:1px solid ${isLocked ? 'var(--color-warning)' : 'var(--border-color)'};opacity:${isLocked ? '1' : '0.6'};cursor:pointer;transition:all 0.2s ease;" onclick="vizPopupToggleLock('${p.id}')">
        <span style="font-size:0.75rem;">${escapeHTML(p.label)}</span>
        <i data-lucide="${isLocked ? 'lock' : 'unlock'}" style="width:12px;height:12px;color:${isLocked ? 'var(--color-warning)' : 'var(--text-tertiary)'}"></i>
      </div>`;
    }).join('');
    if (allPrograms.length === 0) locksList.innerHTML = '<div style="font-size:0.7rem;color:var(--text-tertiary);padding:0.5rem;">No other nodes available</div>';
  }

  lucide.createIcons({ root: popup });

  let popupLeft = x + 20;
  let popupTop = y;
  if (popupLeft + 300 > window.innerWidth) popupLeft = x - 300;
  if (popupTop + 300 > window.innerHeight) popupTop = window.innerHeight - 320;

  popup.style.left = popupLeft + 'px';
  popup.style.top = popupTop + 'px';
  popup.classList.remove('hidden');
}

function vizHideNodePopup() {
  const popup = document.getElementById('viz-node-details-popup');
  if (popup) popup.classList.add('hidden');
  viz.popupTargetNode = null;
}

function vizPopupPlay() {
  if (!viz.popupTargetNode || !viz.popupTargetNode.dataId) return;
  const node = viz.popupTargetNode;

  vizHideNodePopup();

  if (node.type === 'challenge') {
    if (typeof promptTimer === 'function') {
      promptTimer(node.dataId);
    } else {
      setSessionParam('practiceChallenge', node.dataId);
      const c = state.challenges.find(ch => ch.id === node.dataId);
      if (c && c.variants && c.variants.length > 0) {
        setSessionParam('practiceVariant', c.variants[0].id);
      }
      setSessionParam('timeLimit', 0);
      spaNavigate('practice');
    }
  } else if (node.type === 'snippet') {
    spaNavigate('study');
  } else if (node.type === 'notebook') {
    setSessionParam('activeNotebook', node.dataId);
    setSessionParam('notebookTimeLimit', 0);
    spaNavigate('notes-practice');
  }
}

function vizPopupEdit() {
  if (!viz.popupTargetNode || !viz.popupTargetNode.dataId) return;
  const node = viz.popupTargetNode;
  const modal = document.getElementById('viz-admin-modal');
  if (!modal) return;

  const titleEl = document.getElementById('viz-modal-form-title');
  const bodyEl = document.getElementById('viz-admin-modal-body');
  if (!bodyEl) return;

  vizHideNodePopup();

  if (node.type === 'challenge') {
    if (titleEl) titleEl.innerHTML = '<i data-lucide="edit-3" style="color:var(--color-primary);"></i> Edit Program';
    bodyEl.innerHTML = getAdminFormHTML();
    modal.classList.remove('hidden');
    lucide.createIcons({ root: modal });
    setTimeout(() => {
      const formEl = bodyEl.querySelector('#admin-form-container');
      if (formEl) formEl.classList.remove('hidden');
      if (typeof window.currentAdminMode === 'undefined') window.currentAdminMode = 'practice';
      window.currentAdminMode = 'practice';
      if (typeof openAdminForm === 'function') openAdminForm(node.dataId);
    }, 50);
  } else if (node.type === 'notebook') {
    if (titleEl) titleEl.innerHTML = '<i data-lucide="book" style="color:var(--color-primary);"></i> Edit Notebook';
    if (typeof getNotebookFormHTML === 'function') {
      bodyEl.innerHTML = getNotebookFormHTML();
      modal.classList.remove('hidden');
      lucide.createIcons({ root: modal });
      setTimeout(() => {
        if (typeof openNotebookForm === 'function') openNotebookForm(node.dataId);
        const saveBtn = document.getElementById('save-notebook-btn');
        if (saveBtn) {
          saveBtn.onclick = function () {
            if (typeof saveNotebookForm === 'function') {
              const ok = saveNotebookForm();
              if (ok !== false) {
                vizCloseAdminModal();
                vizRenderContentPane();
              }
            }
          };
        }
      }, 60);
    } else {
      if (typeof setSessionParam === 'function') setSessionParam('adminActiveTab', 'notebooks');
      spaNavigate('admin');
    }
  } else {
    spaNavigate('admin');
  }
}

function vizCloseAdminModal() {
  const modal = document.getElementById('viz-admin-modal');
  if (modal) modal.classList.add('hidden');
  if (typeof closeAdminForm === 'function') closeAdminForm();
  if (typeof closeNotebookForm === 'function') closeNotebookForm();
  vizRenderCanvas();
}

function vizPopupToggleLock(otherNodeId) {
  if (!viz.popupTargetNode) return;
  const currentId = viz.popupTargetNode.id;

  const existingLinkIdx = viz.links.findIndex(l => l.locked && ((l.from === otherNodeId && l.to === currentId) || (l.to === otherNodeId && l.from === currentId)));

  if (existingLinkIdx >= 0) {
    viz.links.splice(existingLinkIdx, 1);
  } else {
    viz.links.push({
      id: generateId(),
      from: otherNodeId,
      to: currentId,
      locked: true
    });
  }
  vizRenderCanvas();
  vizSave();

  const popup = document.getElementById('viz-node-details-popup');
  if (popup && !popup.classList.contains('hidden')) {
    vizShowNodePopup(viz.popupTargetNode, parseFloat(popup.style.left) - 20, parseFloat(popup.style.top));
  }
}

function vizToggleFlowyDrag() {
  viz.flowyDragEnabled = !viz.flowyDragEnabled;
  const btn = document.getElementById('viz-flow-toggle-btn');
  if (btn) {
    btn.classList.toggle('is-active', viz.flowyDragEnabled);
    btn.classList.add('viz-state-flow');
    btn.style.color = '';
    btn.style.borderColor = '';
  }
}

function vizToggleColorMode() {
  viz.colorModeEnabled = !viz.colorModeEnabled;
  if (viz.colorModeEnabled && viz.linkModeEnabled) vizToggleLinkMode();
  const btn = document.getElementById('viz-color-toggle-btn');
  if (btn) {
    btn.classList.toggle('is-active', viz.colorModeEnabled);
    btn.classList.add('viz-state-color');
    btn.style.color = '';
    btn.style.borderColor = '';
  }
  const popup = document.getElementById('viz-color-mode-popup');
  if (popup) popup.classList.toggle('hidden', !viz.colorModeEnabled);
}

function vizSetPaintColor(color) {
  viz.colorPaintColor = color;
  document.querySelectorAll('#viz-color-mode-popup .viz-color-swatch').forEach(sw => {
    sw.classList.toggle('active', sw.dataset.color === (color || ''));
  });
  // Visual cue on the toolbar button: tint border with the selected paint color
  const btn = document.getElementById('viz-color-toggle-btn');
  if (btn && viz.colorModeEnabled) {
    const colorMap = { red: '#ef4444', orange: '#f97316', yellow: '#eab308', green: '#22c55e', blue: '#3b82f6', purple: '#a855f7', pink: '#ec4899', cyan: '#06b6d4' };
    const hex = colorMap[color] || '';
    btn.style.setProperty('--viz-active-color', hex);
  }
}

function vizToggleLinkTypeDropdown() {
  const popup = document.getElementById('viz-link-type-popup');
  if (!popup) return;
  const isHidden = popup.classList.contains('hidden');
  vizHideAllMenus();
  document.getElementById('viz-color-mode-popup')?.classList.add('hidden');
  if (isHidden) {
    popup.classList.remove('hidden');
    lucide.createIcons({ root: popup });
  }
}

function vizSetLinkArrowType(type) {
  viz.defaultLinkArrowType = type;
  document.querySelectorAll('#viz-link-type-popup .viz-link-type-option').forEach(opt => {
    opt.classList.toggle('active', opt.dataset.type === type);
  });
  const popup = document.getElementById('viz-link-type-popup');
  if (popup) popup.classList.add('hidden');
  // Update label on the Link button to show current type
  const linkBtn = document.getElementById('viz-link-toggle-btn');
  if (linkBtn) {
    const iconMap = { 'arrow': 'arrow-right', 'double-arrow': 'arrow-left-right', 'none': 'minus' };
    const iconName = iconMap[type] || 'link';
    const chevron = linkBtn.querySelector('.viz-pill-chevron');
    linkBtn.innerHTML = `<i data-lucide="${iconName}" style="width:12px;height:12px;"></i> Link `;
    if (chevron) linkBtn.appendChild(chevron);
    else {
      const newChevron = document.createElement('span');
      newChevron.className = 'viz-pill-chevron';
      newChevron.setAttribute('onclick', 'event.stopPropagation();vizToggleLinkTypeDropdown()');
      newChevron.innerHTML = '<i data-lucide="chevron-down" style="width:10px;height:10px;"></i>';
      linkBtn.appendChild(newChevron);
    }
    if (typeof lucide !== 'undefined') lucide.createIcons({ el: linkBtn });
  }
}

function vizCtxChangeIcon() {
  if (!viz.contextNodeId) return;
  const node = viz.nodes.find(n => n.id === viz.contextNodeId);
  if (!node) return;
  vizHideAllMenus();

  if (typeof openIconPicker === 'function') {
    openIconPicker(node.icon || 'file').then(newIcon => {
      if (newIcon) {
        node.icon = newIcon;
        if (node.dataId && node.type === 'folder') {
          const folder = state.nodes.find(n => n.id === node.dataId);
          if (folder) { folder.icon = newIcon; saveData(); }
        }
        vizRenderCanvas();
        vizSave();
      }
    });
  }
}

function vizToggleGlobeMode() {
  viz.globeModeEnabled = !viz.globeModeEnabled;
  const btn = document.getElementById('viz-globe-toggle-btn');
  if (btn) {
    btn.classList.toggle('is-active', viz.globeModeEnabled);
    btn.classList.add('viz-state-globe');
  }
  const container = document.getElementById('viz-canvas-container');
  if (container) container.classList.toggle('globe-mode', viz.globeModeEnabled);
  vizRenderCanvas();
}

function vizAutoPopulateForce() {
  vizAutoPopulate();
  vizRenderContentPane();
  vizRenderCanvas();
  setTimeout(() => vizCenterCanvas(), 50);
}
