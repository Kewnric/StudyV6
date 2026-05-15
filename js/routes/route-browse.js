/* Route: browse */
function browseTemplate() {
  return `
    <div class="messenger-layout">
      <main class="messenger-pane-1">
        <div class="pane-1-header">
          <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
            <h2 class="section-header-animated">
              <span class="section-header-icon-wrap browse-icon-wrap">
                <i data-lucide="layout-template"></i>
                <span class="section-header-icon-ring"></span>
              </span>
              <span class="section-header-text">
                <span class="section-header-title">Coding Library</span>
                <span class="section-header-subtitle" id="browse-header-stats">0 programs</span>
              </span>
            </h2>
            <button class="tutorial-trigger-btn" onclick="GuidedTutorial.start()" title="Show Page Tour">
              <i data-lucide="graduation-cap"></i>
            </button>
          </div>
          <div class="search-container search-animated" style="width: 100%;">
            <i data-lucide="search"></i>
            <input type="text" id="browse-search" oninput="renderBrowse()" placeholder="Search programs..." class="search-input">
            <span class="search-shortcut-hint">Ctrl+K</span>
          </div>
          <div class="browse-mini-stats" id="browse-mini-stats"></div>
        </div>
        <div class="pane-1-content tree-container" id="browse-category-list"></div>
      </main>
      <div class="resizer-divider" onmousedown="initResizerDrag(event, this)"></div>
      <section class="messenger-pane-2">
        <div id="browse-challenges-container" style="padding: 2rem; min-height: 100%;">
          <div class="empty-state" style="height: 100%; display: flex; align-items: center; justify-content: center; flex-direction: column;">
            <div class="empty-state-icon-animated">
              <i data-lucide="folder-open" style="width: 48px; height: 48px; opacity: 0.5;"></i>
              <div class="empty-state-pulse-ring"></div>
            </div>
            <h2>Select a folder</h2>
            <p style="font-size: 0.875rem; color: var(--text-tertiary); margin-top: 0.5rem;">Choose a folder from the left pane to view its programs.</p>
          </div>
        </div>
      </section>
    </div>

    <div id="tree-context-menu" class="tree-context-menu hidden">
      <button class="tree-context-item" id="ctx-new-folder" onclick="ctxNewFolder()"><i data-lucide="folder-plus"></i> New Subfolder</button>
      <button class="tree-context-item" id="ctx-rename" onclick="ctxRenameFolder()"><i data-lucide="pencil"></i> Rename</button>
      <button class="tree-context-item" id="ctx-move" onclick="ctxMoveFolder()"><i data-lucide="move"></i> Move to...</button>
      <button class="tree-context-item" id="ctx-icon" onclick="ctxChangeIcon()"><i data-lucide="image"></i> Change Icon</button>
      <div class="tree-context-divider"></div>
      <button class="tree-context-item danger" id="ctx-delete" onclick="ctxDeleteFolder()"><i data-lucide="trash-2"></i> Delete Folder</button>
    </div>

    <div id="share-toast" style="position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);background:var(--color-primary);color:#fff;padding:0.75rem 1.5rem;border-radius:var(--radius-md);font-weight:600;font-size:0.875rem;z-index:9999;opacity:0;transition:opacity 0.3s ease;pointer-events:none;box-shadow:0 4px 12px rgba(0,0,0,0.3);"></div>
  `;
}

function browseInit() {
  renderBrowse();
  updateBrowseHeaderStats();
  checkSharedChallenge();
  GuidedTutorial.init('browse');
}

function browseDestroy() { }

function updateBrowseHeaderStats() {
  const totalPrograms = state.challenges.length;
  const completedPrograms = new Set(
    state.history.filter(h => h.score === 100 && !h.isArchived).map(h => h.challengeId)
  ).size;
  const folders = state.nodes.filter(n => n.scope === 'challenge' && n.type === 'folder').length;

  const headerSub = document.getElementById('browse-header-stats');
  if (headerSub) {
    headerSub.textContent = `${totalPrograms} program${totalPrograms !== 1 ? 's' : ''} across ${folders} folder${folders !== 1 ? 's' : ''}`;
  }

  const miniStats = document.getElementById('browse-mini-stats');
  if (miniStats) {
    const pct = totalPrograms > 0 ? Math.round((completedPrograms / totalPrograms) * 100) : 0;
    
    // Surgical update to prevent flickering/re-animation
    const totalVal = miniStats.querySelector('.mini-stat-chip:not(.completed) .mini-stat-value');
    const doneVal = miniStats.querySelector('.mini-stat-chip.completed .mini-stat-value');
    const progFill = miniStats.querySelector('.mini-progress-fill');
    const progText = miniStats.querySelector('.mini-progress-text');

    if (totalVal && doneVal && progFill && progText) {
      totalVal.textContent = totalPrograms;
      doneVal.textContent = completedPrograms;
      progFill.setAttribute('stroke-dasharray', `${pct}, 100`);
      progText.textContent = `${pct}%`;
    } else {
      miniStats.innerHTML = `
        <div class="mini-stat-chip" title="Total programs">
          <i data-lucide="file-code" style="width:12px;height:12px;"></i>
          <span class="mini-stat-value">${totalPrograms}</span>
          <span class="mini-stat-label">Total</span>
        </div>
        <div class="mini-stat-chip completed" title="Completed programs">
          <i data-lucide="check-circle" style="width:12px;height:12px;"></i>
          <span class="mini-stat-value">${completedPrograms}</span>
          <span class="mini-stat-label">Done</span>
        </div>
        <div class="mini-stat-chip" title="Overall progress">
          <div class="mini-progress-ring" style="--progress: ${pct};">
            <svg viewBox="0 0 36 36">
              <path class="mini-progress-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
              <path class="mini-progress-fill" stroke-dasharray="${pct}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
            </svg>
            <span class="mini-progress-text">${pct}%</span>
          </div>
        </div>
      `;
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  }
}
