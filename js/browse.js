/* ============================================================
   BROWSE.JS — Browse View Rendering (Recursive Tree + Dual-Pane)
   ============================================================ */

let browseActiveNodeId = getSessionParam('browseActiveNode') || null;
let ctxTargetNodeId = null; // For context menu
let _browseContainerCtxHandler = null; // Named reference for removing duplicate listeners

function navigateToFolderAndFocus(parentId, itemId) {
  // Clear search
  const searchInput = document.getElementById('browse-search');
  if (searchInput) searchInput.value = '';

  window.disableNextStagger = true;

  // Select folder
  selectBrowseNode(parentId === '__root__' ? null : parentId);

  // Expand parent folders to ensure it is visible in the tree
  if (parentId && parentId !== '__root__') {
    let curr = state.nodes.find(n => n.id === parentId);
    while (curr) {
      if (!state.expandedNodes) state.expandedNodes = [];
      if (!state.expandedNodes.includes(curr.id)) {
        state.expandedNodes.push(curr.id);
      }
      curr = state.nodes.find(n => n.id === curr.parentId);
    }
    saveData();
    renderBrowseTree();
  }

  // Scroll to card
  setTimeout(() => {
    const card = document.getElementById(`card-${itemId}`);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.classList.add('pulse-highlight');
      setTimeout(() => card.classList.remove('pulse-highlight'), 2000);
    }
  }, 100);
}

// ============================================================
// TREE RENDERING (LEFT PANE)
// ============================================================

let _completedCountMemo = {};
let _completedChallengesMap = null;

function getCompletedCount(folderId) {
  if (!_completedChallengesMap) {
    _completedChallengesMap = {};
    state.history.forEach(h => {
      if (!h.isArchived && h.score === 100) {
        _completedChallengesMap[h.challengeId] = true;
      }
    });
  }

  if (_completedCountMemo[folderId] !== undefined) return _completedCountMemo[folderId];

  const catChallenges = state.challenges.filter(c => c.parentId === folderId);
  let completed = 0;
  catChallenges.forEach(c => {
    if (_completedChallengesMap[c.id]) completed++;
  });
  
  // Also count recursively into child folders
  getChildFolders(folderId, 'challenge').forEach(child => {
    completed += getCompletedCount(child.id);
  });
  
  _completedCountMemo[folderId] = completed;
  return completed;
}

function selectBrowseNode(nodeId) {
  browseActiveNodeId = nodeId;
  setSessionParam('browseActiveNode', nodeId);
  setSessionParam('browseScroll', 0);
  renderBrowse();
}

function toggleBrowseExpand(nodeId, e) {
  if (e) { e.stopPropagation(); e.preventDefault(); }
  toggleNodeExpanded(nodeId);
  
  const nodeEl = document.querySelector(`.tree-node[data-node-id="${nodeId}"]`);
  if (nodeEl) {
    const childrenContainer = nodeEl.querySelector(':scope > .tree-children');
    const chevron = nodeEl.querySelector(':scope > .tree-node-row .tree-node-chevron');
    if (childrenContainer) {
      if (isNodeExpanded(nodeId)) {
        childrenContainer.classList.remove('collapsed');
        if (chevron) chevron.classList.add('expanded');
      } else {
        childrenContainer.classList.add('collapsed');
        if (chevron) chevron.classList.remove('expanded');
      }
    }
  } else {
    renderBrowseTree();
  }
}

function renderBrowse() {
  _completedCountMemo = {};
  _completedChallengesMap = null;
  renderBrowseTree();
  renderBrowseContent();
  if (typeof updateBrowseHeaderStats === 'function') updateBrowseHeaderStats();
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Invalidate caches whenever history or challenges change externally
function invalidateBrowseCache() {
  _completedCountMemo = {};
  _completedChallengesMap = null;
}

function renderBrowseTree() {
  const container = document.getElementById('browse-category-list');
  if (!container) return;

  const searchInput = document.getElementById('browse-search');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

  // Build tree HTML recursively
  let html = renderTreeRecursive(null, 'challenge', 0, query, browseActiveNodeId);

  // Also show root-level (orphaned) items count
  const rootOrphans = state.challenges.filter(c => c.parentId === null || c.parentId === undefined);
  if (rootOrphans.length > 0 || state.nodes.filter(n => n.scope === 'challenge').length === 0) {
    const isActive = browseActiveNodeId === '__root__';
    const count = rootOrphans.length;
    if (count > 0 || !html) {
      html += `
        <div class="tree-node" data-level="0">
          <div class="tree-node-row ${isActive ? 'active' : ''}" onclick="selectBrowseNode('__root__')">
            <i data-lucide="chevron-right" class="tree-node-chevron invisible"></i>
            <i data-lucide="inbox" class="tree-node-icon item-icon-color"></i>
            <span class="tree-node-label">Uncategorized</span>
            <span class="tree-node-badge">${count}</span>
          </div>
        </div>
      `;
    }
  }

  if (!html) {
    html = `<div class="empty-state" style="padding: 2rem;">
      <p style="color:var(--text-tertiary); font-size:0.875rem;">No folders. Right-click to create one.</p>
    </div>`;
  }

  container.innerHTML = html;

  // Attach right-click context to all tree rows
  container.querySelectorAll('.tree-node-row[data-node-id]').forEach(row => {
    row.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showTreeContextMenu(e, row.getAttribute('data-node-id'));
    });
  });

  // Allow right-click on empty area to create root folder
  if (_browseContainerCtxHandler) {
    container.removeEventListener('contextmenu', _browseContainerCtxHandler);
  }
  _browseContainerCtxHandler = (e) => {
    if (e.target === container || e.target.closest('.empty-state')) {
      e.preventDefault();
      showTreeContextMenu(e, null); // null = root level
    }
  };
  container.addEventListener('contextmenu', _browseContainerCtxHandler);

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderTreeRecursive(parentId, scope, depth, query, activeId) {
  const folders = getChildFolders(parentId, scope);
  let html = '';

  folders.forEach(folder => {
    const totalItems = countItemsRecursive(folder.id, scope);
    const hasChildren = getChildFolders(folder.id, scope).length > 0;
    const expanded = isNodeExpanded(folder.id);
    const isActive = activeId === folder.id;

    // If searching, skip folders with no matching items
    if (query) {
      const hasMatch = folderHasMatchingItems(folder.id, scope, query);
      if (!hasMatch) return;
    }

    // Lock status
    let lockIcon = '';
    const req = state.categoryRequirements ? state.categoryRequirements[folder.id] : null;
    if (req) {
      let folderIsLocked = false;
      if (req.requiredChallengeIds && req.requiredChallengeIds.length > 0) {
        folderIsLocked = req.requiredChallengeIds.some(cId => !state.history.some(h => h.challengeId === cId && h.score === 100 && !h.isArchived));
      } else if (req.reqNodeId) {
        const completed = getCompletedCount(req.reqNodeId);
        folderIsLocked = completed < req.count;
      }
      if (folderIsLocked) {
        lockIcon = `<i data-lucide="lock" class="tree-node-lock"></i>`;
      }
    }

    const chevronClass = hasChildren || totalItems > 0 ? (expanded ? 'expanded' : '') : 'invisible';
    const indent = depth * 0.75;

    html += `
      <div class="tree-node" data-level="${depth}" data-node-id="${folder.id}">
        <div class="tree-node-row ${isActive ? 'active' : ''}" 
             data-node-id="${folder.id}"
             style="padding-left: calc(0.75rem + ${indent}rem)"
             draggable="true"
             ondragstart="handleTreeDragStart(event, '${folder.id}')"
             ondragover="handleTreeDragOver(event)"
             ondragleave="handleTreeDragLeave(event)"
             ondrop="handleTreeDrop(event, '${folder.id}', '${parentId || ''}', '${scope}')"
             onclick="selectBrowseNode('${folder.id}')">
          <i data-lucide="chevron-right" 
             class="tree-node-chevron ${chevronClass}"
             onclick="toggleBrowseExpand('${folder.id}', event)"></i>
          <i data-lucide="${folder.icon || 'folder'}" class="tree-node-icon folder-icon-color"></i>
          <span class="tree-node-label">${escapeHTML(folder.name)}</span>
          ${lockIcon}
          ${typeof getTierBadgeHTML === 'function' ? getTierBadgeHTML(folder.tier) : ''}
          <span class="tree-node-badge">${totalItems}</span>
        </div>
        <div class="tree-children ${expanded ? '' : 'collapsed'}">
          <div class="tree-children-inner">
            ${renderTreeRecursive(folder.id, scope, depth + 1, query, activeId)}
          </div>
        </div>
      </div>
    `;
  });

  // Also render items in this folder if not searching (or if they match)
  if (!query || depth > 0) {
    const items = getItemsInFolder(parentId, scope);
    items.forEach(item => {
      if (query && !fuzzyMatch(item.title, query)) return;
      const isActive = activeId === item.id; // Usually items aren't active in tree, but for reordering they might be
      const indent = (depth + 1) * 0.75;
      html += `
        <div class="tree-node tree-item-node" data-level="${depth + 1}" data-node-id="${item.id}">
          <div class="tree-node-row ${isActive ? 'active' : ''}" 
               data-node-id="${item.id}"
               style="padding-left: calc(0.75rem + ${indent}rem)"
               draggable="true"
               ondragstart="handleTreeDragStart(event, '${item.id}')"
               ondragover="handleTreeDragOver(event)"
               ondragleave="handleTreeDragLeave(event)"
               ondrop="handleTreeDrop(event, '${item.id}', '${parentId || ''}', '${scope}')"
               onclick="selectBrowseNode('${parentId}'); navigateToFolderAndFocus('${parentId || '__root__'}', '${item.id}')">
            <i class="tree-node-chevron invisible"></i>
            <i data-lucide="file-text" class="tree-node-icon item-icon-color" style="width:14px;height:14px;"></i>
            <span class="tree-node-label" style="font-weight:400; font-size:0.875rem;">${escapeHTML(item.title)}</span>
          </div>
        </div>
      `;
    });
  }

  return html;
}

function folderHasMatchingItems(folderId, scope, query) {
  // Check direct items
  const items = getItemsInFolder(folderId, scope);
  const hasDirectMatch = items.some(item =>
    fuzzyMatch(item.title, query) || (item.tags || []).some(t => fuzzyMatch(t, query))
  );
  if (hasDirectMatch) return true;

  // Check child folders recursively
  const childFolders = getChildFolders(folderId, scope);
  return childFolders.some(cf => folderHasMatchingItems(cf.id, scope, query));
}

// ============================================================
// CONTENT RENDERING (RIGHT PANE)
// ============================================================

function renderBrowseContent() {
  const container = document.getElementById('browse-challenges-container');
  if (!container) return;

  const searchInput = document.getElementById('browse-search');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

  if (!browseActiveNodeId) {
    container.innerHTML = `
      <div class="empty-state" style="height: 100%; display: flex; align-items: center; justify-content: center; flex-direction: column;">
        <i data-lucide="folder-open" style="width: 48px; height: 48px; opacity: 0.5; margin-bottom: 1rem;"></i>
        <h2>Select a folder</h2>
        <p style="font-size: 0.875rem; color: var(--text-tertiary); margin-top: 0.5rem;">Choose a folder from the left pane to view its programs.</p>
      </div>`;
    return;
  }

  // Get folder info for breadcrumbs
  const isRoot = browseActiveNodeId === '__root__';
  const currentFolder = isRoot ? null : state.nodes.find(n => n.id === browseActiveNodeId);

  // Breadcrumbs
  let breadcrumbHtml = `<nav class="breadcrumb-nav">`;
  breadcrumbHtml += `<button class="breadcrumb-item" onclick="selectBrowseNode(null)">
    <i data-lucide="home" style="width:12px;height:12px;"></i>
  </button>`;

  if (isRoot) {
    breadcrumbHtml += `<span class="breadcrumb-separator"><i data-lucide="chevron-right"></i></span>`;
    breadcrumbHtml += `<span class="breadcrumb-current">Uncategorized</span>`;
  } else if (currentFolder) {
    const path = getBreadcrumbPath(browseActiveNodeId);
    path.forEach((node, idx) => {
      breadcrumbHtml += `<span class="breadcrumb-separator"><i data-lucide="chevron-right"></i></span>`;
      if (idx < path.length - 1) {
        breadcrumbHtml += `<button class="breadcrumb-item" onclick="selectBrowseNode('${node.id}')">${escapeHTML(node.name)}</button>`;
      } else {
        breadcrumbHtml += `<span class="breadcrumb-current">${escapeHTML(node.name)}</span>`;
      }
    });
  }
  breadcrumbHtml += `</nav>`;

  // Check lock status
  let isLocked = false;
  let lockMessage = '';
  if (!isRoot && currentFolder) {
    const req = state.categoryRequirements ? state.categoryRequirements[currentFolder.id] : null;
    if (req) {
      if (req.requiredChallengeIds && req.requiredChallengeIds.length > 0) {
        const incomplete = req.requiredChallengeIds.filter(cId => !state.history.some(h => h.challengeId === cId && h.score === 100 && !h.isArchived));
        if (incomplete.length > 0) {
          isLocked = true;
          const names = incomplete.map(cId => { const c = state.challenges.find(ch => ch.id === cId); return c ? c.title : '???'; });
          lockMessage = `Complete these programs first: ${names.map(n => '"' + escapeHTML(n) + '"').join(', ')}`;
        }
      } else if (req.reqNodeId) {
        const completed = getCompletedCount(req.reqNodeId);
        if (completed < req.count) {
          isLocked = true;
          const reqFolder = state.nodes.find(n => n.id === req.reqNodeId);
          const reqName = reqFolder ? reqFolder.name : req.reqCat || 'Unknown';
          lockMessage = `Requires ${req.count} completed program(s) in "${escapeHTML(reqName)}" (Currently: ${completed})`;
        }
      }
    }
  }

  if (isLocked) {
    container.innerHTML = breadcrumbHtml + `
      <div class="empty-state" style="height: 80%; display: flex; align-items: center; justify-content: center; flex-direction: column;">
        <i data-lucide="lock" style="width: 48px; height: 48px; color: var(--color-warning); margin-bottom: 1rem;"></i>
        <h2 style="color: var(--color-warning);">Folder Locked</h2>
        <p style="font-size: 0.875rem; margin-top: 0.5rem; color: var(--text-tertiary);">${lockMessage}</p>
      </div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  // Apply search filter globally if query exists
  let challenges = [];
  let childFolders = [];

  if (query) {
    challenges = state.challenges.filter(c =>
      fuzzyMatch(c.title, query) || (c.tags || []).some(t => fuzzyMatch(t, query))
    );
  } else {
    const folderId = isRoot ? null : browseActiveNodeId;
    challenges = state.challenges.filter(c => c.parentId === folderId);
    childFolders = isRoot ? [] : getChildFolders(browseActiveNodeId, 'challenge');
  }

  // Subfolders cards
  let subfoldersHtml = '';
  if (childFolders.length > 0) {
    subfoldersHtml = `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.75rem; margin-bottom: 1.5rem;">`;
    childFolders.forEach(sf => {
      const sfCount = countItemsRecursive(sf.id, 'challenge');
      subfoldersHtml += `
        <div class="subfolder-card" onclick="selectBrowseNode('${sf.id}'); toggleNodeExpanded('${sf.id}');">
          <i data-lucide="folder"></i>
          <span class="subfolder-card-label">${escapeHTML(sf.name)}</span>
          <span class="subfolder-card-count">${sfCount} item${sfCount !== 1 ? 's' : ''}</span>
        </div>
      `;
    });
    subfoldersHtml += `</div>`;
  }

  let folderName = isRoot ? 'Uncategorized' : (currentFolder ? currentFolder.name : 'Library');

  if (query) {
    breadcrumbHtml = `<nav class="breadcrumb-nav"><span class="breadcrumb-current">Search Results for "${escapeHTML(query)}"</span></nav>`;
    folderName = `Search Results`;
  }

  if (challenges.length === 0 && childFolders.length === 0) {
    container.innerHTML = breadcrumbHtml + `
      <div class="empty-state" style="height: 80%; display: flex; align-items: center; justify-content: center; flex-direction: column;">
        <div class="empty-state-icon-animated">
          <i data-lucide="folder-open" style="width: 48px; height: 48px; opacity: 0.5;"></i>
          <div class="empty-state-pulse-ring"></div>
        </div>
        <h2>No programs found</h2>
        <p style="font-size: 0.875rem; margin-top: 0.5rem;">
          ${query ? `No results for "${escapeHTML(query)}"` : `No programs available in ${escapeHTML(folderName)}.`}
        </p>
      </div>`;
  } else {
    const hideSubfolders = getSessionParam('hideSubfolders') !== 'false';

    // Compute folder-level stats
    const folderChallenges = challenges;
    const folderCompleted = folderChallenges.filter(c =>
      state.history.some(h => h.challengeId === c.id && h.score === 100 && !h.isArchived)
    ).length;
    const folderPct = folderChallenges.length > 0 ? Math.round((folderCompleted / folderChallenges.length) * 100) : 0;

    container.innerHTML = breadcrumbHtml + `
      <div class="animate-fade-in">
        <div class="browse-folder-header">
          <div class="browse-folder-info">
            <h2 class="browse-folder-title">${escapeHTML(folderName)}</h2>
            <p class="browse-folder-desc">${currentFolder && currentFolder.description ? escapeHTML(currentFolder.description) : 'Select a program below to start practicing.'}</p>
          </div>
          <div class="browse-folder-actions">
            <div class="browse-folder-progress" title="${folderCompleted}/${folderChallenges.length} completed">
              <div class="folder-progress-bar">
                <div class="folder-progress-fill" style="width: ${folderPct}%;"></div>
              </div>
              <span class="folder-progress-label">${folderPct}%</span>
            </div>
            <button class="btn btn-ghost" onclick="showConfirm('Toggle Visibility', 'Are you sure you want to ' + (${hideSubfolders} ? 'show' : 'hide') + ' subfolders?', () => { setSessionParam('hideSubfolders', '${!hideSubfolders}'); renderBrowseContent(); })" title="Toggle Subfolders" style="padding: 0.5rem;">
                <i data-lucide="${hideSubfolders ? 'eye-off' : 'eye'}"></i>
            </button>
          </div>
        </div>
        ${hideSubfolders ? '' : subfoldersHtml}
        ${challenges.length > 0 ? `
        <div class="card-grid ${window.disableNextStagger ? '' : 'stagger-children'}">
          ${challenges.map(c => {
      const vCount = c.variants.length;
      const logs = state.history.filter(h => h.challengeId === c.id);
      const attemptsCount = logs.length;
      const bestScore = logs.length > 0 ? Math.max(...logs.map(l => l.score)) : -1;
      const isPerfect = bestScore === 100;
      const lastAttemptDate = logs.length > 0 ? logs[logs.length - 1].date : null;
      const scoreClass = bestScore === 100 ? 'score-perfect' : bestScore >= 50 ? 'score-partial' : bestScore >= 0 ? 'score-low' : '';
      return `
              <div class="card card-enhanced" id="card-${c.id}" ${query ? `onclick="navigateToFolderAndFocus('${c.parentId || '__root__'}', '${c.id}')" style="cursor: pointer;"` : ''}>
                ${isPerfect ? '<div class="card-completed-badge"><i data-lucide="check" style="width:10px;height:10px;"></i></div>' : ''}
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem;">
                  <h3 style="font-weight:700; font-size:1.1rem; color:var(--text-primary); flex:1;">${escapeHTML(c.title)}</h3>
                  <span class="version-pill">${vCount} version${vCount !== 1 ? 's' : ''}</span>
                </div>
                <div style="display:flex; flex-wrap:wrap; gap:0.375rem; margin-bottom:0.75rem;">
                  <span class="badge badge-neutral"><i data-lucide="rotate-ccw" style="width:12px;height:12px;margin-right:2px;"></i> ${attemptsCount} Attempt${attemptsCount !== 1 ? 's' : ''}</span>
                  ${bestScore >= 0 ? `<span class="badge ${scoreClass}"><i data-lucide="${isPerfect ? 'check-circle' : 'target'}" style="width:12px;height:12px;margin-right:2px;"></i> Best: ${bestScore}%</span>` : ''}
                  ${(c.tags || []).map(t => `<span class="badge badge-primary">${escapeHTML(t)}</span>`).join('')}
                </div>
                <p class="line-clamp-2" style="font-size:0.875rem; color:var(--text-secondary); margin-bottom:0.75rem; min-height:2.5rem;">
                  ${escapeHTML(c.coverDescription || c.variants[0]?.description || 'No description.')}
                </p>
                ${bestScore >= 0 ? `
                <div class="card-score-bar">
                  <div class="card-score-fill ${scoreClass}" style="width: ${bestScore}%;"></div>
                </div>` : ''}
                ${lastAttemptDate ? `<div class="card-last-attempt"><i data-lucide="clock" style="width:11px;height:11px;"></i> Last: ${lastAttemptDate}</div>` : ''}
                <div style="margin-top:auto; display:flex; gap:0.5rem; padding-top:0.5rem;">
                  <button onclick="event.stopPropagation(); promptTimer('${c.id}')" class="btn btn-practice" id="practice-btn-${c.id}" style="flex:1;">
                    <i data-lucide="play" style="width:16px;height:16px;fill:currentColor;"></i> ${isPerfect ? 'Retry' : 'Practice'}
                  </button>
                  <button onclick="event.stopPropagation(); shareChallenge('${c.id}')" class="btn btn-ghost" title="Share Link" style="padding:0.5rem;">
                    <i data-lucide="share-2" style="width:16px;height:16px;"></i>
                  </button>
                </div>
              </div>
            `;
    }).join('')}
        </div>
      ` : ''}
      </div>
    `;
  }

  // Restore scroll
  setTimeout(() => {
    const pane2 = document.querySelector('.messenger-pane-2');
    if (pane2) pane2.scrollTop = getSessionParam('browseScroll') || 0;
  }, 50);

  if (typeof lucide !== 'undefined') lucide.createIcons();
  window.disableNextStagger = false;
}

// ============================================================
// CONTEXT MENU
// ============================================================

function showTreeContextMenu(e, nodeId) {
  ctxTargetNodeId = nodeId;
  const menu = document.getElementById('tree-context-menu');
  if (!menu) return;

  // Position menu
  menu.style.left = e.clientX + 'px';
  menu.style.top = e.clientY + 'px';
  menu.classList.remove('hidden');

  // Adjust menu label based on context
  const isRoot = nodeId === null;
  const newFolderBtn = document.getElementById('ctx-new-folder');
  const renameBtn = document.getElementById('ctx-rename');
  const moveBtn = document.getElementById('ctx-move');
  const deleteBtn = document.getElementById('ctx-delete');

  if (isRoot) {
    if (newFolderBtn) newFolderBtn.innerHTML = `<i data-lucide="folder-plus"></i> New Root Folder`;
    if (renameBtn) renameBtn.style.display = 'none';
    if (moveBtn) moveBtn.style.display = 'none';
    if (deleteBtn) deleteBtn.style.display = 'none';
  } else {
    if (newFolderBtn) newFolderBtn.innerHTML = `<i data-lucide="folder-plus"></i> New Subfolder`;
    if (renameBtn) renameBtn.style.display = '';
    if (moveBtn) moveBtn.style.display = '';
    if (deleteBtn) deleteBtn.style.display = '';
  }

  if (typeof lucide !== 'undefined') lucide.createIcons();

  // Close menu on outside click
  setTimeout(() => {
    document.addEventListener('click', closeTreeContextMenu, { once: true });
  }, 10);
}

function closeTreeContextMenu() {
  const menu = document.getElementById('tree-context-menu');
  if (menu) menu.classList.add('hidden');
}

function ctxNewFolder() {
  closeTreeContextMenu();

  // Determine scope from parent before opening dialog
  let scope = 'challenge';
  if (ctxTargetNodeId) {
    const parent = state.nodes.find(n => n.id === ctxTargetNodeId);
    if (parent) scope = parent.scope;
  }
  const parentId = ctxTargetNodeId;

  showInputDialog('New Folder', null, 'Folder name', '', (name) => {
    const node = createNode(name, 'folder', parentId, scope);
    if (parentId && !isNodeExpanded(parentId)) toggleNodeExpanded(parentId);
    renderBrowse();
  });
}

function ctxRenameFolder() {
  closeTreeContextMenu();
  if (!ctxTargetNodeId) return;
  const folder = state.nodes.find(n => n.id === ctxTargetNodeId);
  if (!folder) return;

  const nodeId = ctxTargetNodeId;
  showInputDialog('Rename Folder', null, 'New name', folder.name, (newName) => {
    if (newName === folder.name) return;
    renameNode(nodeId, newName);
    renderBrowse();
  });
}

function ctxMoveFolder() {
  closeTreeContextMenu();
  if (!ctxTargetNodeId) return;
  const folder = state.nodes.find(n => n.id === ctxTargetNodeId);
  if (!folder) return;

  const nodeId = ctxTargetNodeId;

  // Valid targets: same scope, not self, not a descendant
  const validTargets = state.nodes.filter(n =>
    n.type === 'folder' &&
    n.scope === folder.scope &&
    n.id !== nodeId &&
    !isDescendantOf(n.id, nodeId)
  );

  const options = validTargets.map(t => ({
    label: getBreadcrumbPath(t.id).map(n => escapeHTML(n.name)).join(' › '),
    value: t.id
  }));

  showListPickerDialog(
    'Move Folder',
    `Move "${escapeHTML(folder.name)}" to:`,
    options,
    (newParentId) => {
      moveNode(nodeId, newParentId);
      renderBrowse();
    }
  );
}

function ctxDeleteFolder() {
  closeTreeContextMenu();
  if (!ctxTargetNodeId) return;
  const folder = state.nodes.find(n => n.id === ctxTargetNodeId);
  if (!folder) return;

  if (typeof showConfirm === 'function') {
    showConfirm("Delete Folder", `Delete "${escapeHTML(folder.name)}" and all subfolders? Items will become uncategorized.`, () => {
      if (browseActiveNodeId === ctxTargetNodeId) browseActiveNodeId = null;
      deleteNode(ctxTargetNodeId);
      renderBrowse();
    });
  } else {
    if (!confirm(`Delete "${folder.name}" and all subfolders? Items will become uncategorized.`)) return;
    if (browseActiveNodeId === ctxTargetNodeId) browseActiveNodeId = null;
    deleteNode(ctxTargetNodeId);
    renderBrowse();
  }
}

async function ctxChangeIcon() {
  closeTreeContextMenu();
  if (!ctxTargetNodeId) return;
  const folder = state.nodes.find(n => n.id === ctxTargetNodeId);
  if (!folder) return;

  const currentIcon = folder.icon || 'folder';
  const newIcon = await openIconPicker(currentIcon);
  if (!newIcon || !newIcon.trim() || newIcon.trim() === currentIcon) return;

  folder.icon = newIcon.trim();
  saveData();
  renderBrowse();
}

// ============================================================
// TIMER MODAL LOGIC
// ============================================================
function promptTimer(challengeId) {
  const pane2 = document.querySelector('.messenger-pane-2');
  if (pane2) setSessionParam('browseScroll', pane2.scrollTop);

  pendingChallengeId = challengeId;
  const challenge = state.challenges.find(c => c.id === challengeId);

  const variantSelect = document.getElementById('timer-variant-select');
  variantSelect.innerHTML = challenge.variants.map(v =>
    `<option value="${v.id}">${escapeHTML(v.name)}</option>`
  ).join('');

  document.getElementById('timer-h').value = '0';
  document.getElementById('timer-m').value = '0';
  document.getElementById('timer-s').value = '0';
  document.getElementById('timer-modal').classList.remove('hidden');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeTimerModal() {
  document.getElementById('timer-modal').classList.add('hidden');
}

function confirmStartPractice() {
  const pane2 = document.querySelector('.messenger-pane-2');
  if (pane2) setSessionParam('browseScroll', pane2.scrollTop);

  const h = parseInt(document.getElementById('timer-h').value) || 0;
  const m = parseInt(document.getElementById('timer-m').value) || 0;
  const s = parseInt(document.getElementById('timer-s').value) || 0;
  const vId = document.getElementById('timer-variant-select').value;

  closeTimerModal();

  setSessionParam('practiceChallenge', pendingChallengeId);
  setSessionParam('practiceVariant', vId);
  setSessionParam('timeLimit', (h * 3600) + (m * 60) + s);

  spaNavigate('practice');
}

// ============================================================
// SHAREABLE CHALLENGES (Workstream 4)
// ============================================================

function shareChallenge(challengeId) {
  const challenge = state.challenges.find(c => c.id === challengeId);
  if (!challenge) return;

  // Create a minimal shareable object (strip history-only fields)
  const shareable = {
    _type: 'challenge',
    title: challenge.title,
    tags: challenge.tags || [],
    coverDescription: challenge.coverDescription || '',
    variants: (challenge.variants || []).map(v => ({
      id: v.id,
      name: v.name,
      description: v.description || '',
      code: v.code || '',
      starterCode: v.starterCode || '',
      samples: v.samples || []
    }))
  };

  const encoded = encodeShareData(shareable);
  if (!encoded) {
    if (typeof showMessage === 'function') showMessage('Error', 'Failed to encode challenge for sharing.', true);
    return;
  }

  const url = window.location.origin + window.location.pathname + '?data=' + encoded;

  navigator.clipboard.writeText(url).then(() => {
    showShareToast('Link copied to clipboard!');
  }).catch(() => {
    // Fallback: prompt
    prompt('Copy this share link:', url);
  });
}

function showShareToast(message) {
  let toast = document.getElementById('share-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'share-toast';
    toast.style.cssText = 'position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);background:var(--color-primary);color:#fff;padding:0.75rem 1.5rem;border-radius:var(--radius-md);font-weight:600;font-size:0.875rem;z-index:9999;opacity:0;transition:opacity 0.3s ease;pointer-events:none;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.opacity = '1';
  setTimeout(() => { toast.style.opacity = '0'; }, 2500);
}

function checkSharedChallenge() {
  const params = new URLSearchParams(window.location.search);
  const dataParam = params.get('data');
  if (!dataParam) return;

  const shared = decodeShareData(dataParam);
  if (!shared || shared._type !== 'challenge') return;

  // Clean URL without reloading
  window.history.replaceState({}, document.title, window.location.pathname);

  // Inject as a temporary challenge
  const tempId = 'shared_' + Date.now();
  const tempChallenge = {
    id: tempId,
    title: '[Shared] ' + (shared.title || 'Challenge'),
    tags: shared.tags || [],
    coverDescription: shared.coverDescription || '',
    parentId: null,
    variants: (shared.variants || []).map(v => ({
      ...v,
      id: v.id || generateId()
    }))
  };

  // Add to state and persist so it carries over to practice.html
  state.challenges.unshift(tempChallenge);
  saveData();

  // Select the Uncategorized folder so the user can see the shared challenge
  setTimeout(() => {
    selectBrowseNode('__root__');
    setTimeout(() => {
      const card = document.getElementById('card-' + tempId);
      if (card) {
        card.style.boxShadow = '0 0 0 2px var(--color-primary)';
        card.style.transition = 'box-shadow 0.3s ease';
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  }, 300);
}

// ============================================================
// DRAG & DROP REORDERING
// ============================================================

let draggedNodeId = null;

function handleTreeDragStart(e, nodeId) {
  draggedNodeId = nodeId;
  e.dataTransfer.setData('text/plain', nodeId);
  e.dataTransfer.effectAllowed = 'move';
  e.target.classList.add('dragging');
}

function handleTreeDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const row = e.target.closest('.tree-node-row');
  if (row) {
    const rect = row.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    if (e.clientY < midpoint) {
      row.classList.add('drag-over-top');
      row.classList.remove('drag-over-bottom');
    } else {
      row.classList.add('drag-over-bottom');
      row.classList.remove('drag-over-top');
    }
  }
}

function handleTreeDragLeave(e) {
  const row = e.target.closest('.tree-node-row');
  if (row) {
    row.classList.remove('drag-over-top', 'drag-over-bottom');
  }
}

function handleTreeDrop(e, targetId, parentId, scope) {
  e.preventDefault();
  const row = e.target.closest('.tree-node-row');
  if (row) row.classList.remove('drag-over-top', 'drag-over-bottom');

  if (!draggedNodeId || draggedNodeId === targetId) return;

  // Siblings include both folders and items
  const folders = getChildFolders(parentId || null, scope);
  const items = getItemsInFolder(parentId || null, scope);
  const siblings = [...folders, ...items];
  
  const draggedIdx = siblings.findIndex(s => s.id === draggedNodeId);
  const targetIdx = siblings.findIndex(s => s.id === targetId);

  if (targetIdx === -1 || draggedIdx === -1) return;

  const rect = row.getBoundingClientRect();
  const midpoint = rect.top + rect.height / 2;
  const isAfter = e.clientY >= midpoint;

  // Reorder siblings
  let newSiblings = siblings.filter(s => s.id !== draggedNodeId);
  const adjustedTargetIdx = newSiblings.findIndex(s => s.id === targetId);
  const insertAt = isAfter ? adjustedTargetIdx + 1 : adjustedTargetIdx;
  
  newSiblings.splice(insertAt, 0, siblings[draggedIdx]);

  updateTreeOrder(parentId || null, scope, newSiblings.map(s => s.id));
  renderBrowse();
  draggedNodeId = null;
}