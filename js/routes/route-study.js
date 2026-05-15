/* Route: study */
function studyTemplate() {
  return `
    <div class="messenger-layout">
      <main class="messenger-pane-1">
        <div class="pane-1-header">
          <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
            <h2 class="section-header-animated">
              <span class="section-header-icon-wrap study-icon-wrap">
                <i data-lucide="book-open"></i>
                <span class="section-header-icon-ring"></span>
              </span>
              <span class="section-header-text">
                <span class="section-header-title">Notes Library</span>
                <span class="section-header-subtitle" id="study-header-stats">Loading...</span>
              </span>
            </h2>
            <button class="tutorial-trigger-btn" onclick="GuidedTutorial.start()" title="Show Page Tour">
              <i data-lucide="graduation-cap"></i>
            </button>
          </div>
          <div class="search-container search-animated" style="width: 100%;">
            <i data-lucide="search"></i>
            <input type="text" id="snippet-search" oninput="handleTrainingGroundsSearch()" placeholder="Search..." class="search-input">
            <span class="search-shortcut-hint">Ctrl+K</span>
          </div>
          <div class="admin-toggle-group" id="study-tab-toggle" data-active="notes" role="group" aria-label="Content type" style="width: 100%;">
            <div class="admin-toggle-slider"></div>
            <button class="admin-toggle-btn notes-mode" id="training-tab-notes" onclick="switchStudyTab('notes', this)" aria-pressed="true">
              <i data-lucide="book" aria-hidden="true"></i> Notes
              <span class="toggle-count-badge" id="notes-tab-count">0</span>
            </button>
            <button class="admin-toggle-btn snippets-mode" id="training-tab-snippets" onclick="switchStudyTab('snippets', this)" aria-pressed="false">
              <i data-lucide="code" aria-hidden="true"></i> Snippets
              <span class="toggle-count-badge" id="snippets-tab-count">0</span>
            </button>
          </div>
        </div>
        <div class="pane-1-content" id="snippet-list-container" style="padding-top: 0;"></div>
        <div class="pane-1-content hidden" id="notes-sidebar-container" style="padding-top: 0;"></div>
      </main>
      <div class="resizer-divider" onmousedown="initResizerDrag(event, this)"></div>
      <section class="messenger-pane-2">
        <div id="snippet-detail-container" style="padding: 2rem; min-height: 100%;">
          <div class="empty-state" style="height: 100%; display: flex; align-items: center; justify-content: center; flex-direction: column;">
            <div class="empty-state-icon-animated">
              <i data-lucide="mouse-pointer-click" style="width: 48px; height: 48px; opacity: 0.5;"></i>
              <div class="empty-state-pulse-ring"></div>
            </div>
            <h2>Select a snippet</h2>
            <p style="font-size: 0.875rem; color: var(--text-tertiary); margin-top: 0.5rem;">Choose a code snippet from the left pane to view its details.</p>
          </div>
        </div>
        <div id="notes-detail-container" class="hidden" style="padding: 2rem; overflow-y: auto; height: 100%;">
          <div id="notes-sections-area"></div>
          <div id="notes-empty-state" class="empty-state" style="height:100%; display:flex; align-items:center; justify-content:center; flex-direction:column;">
            <div class="empty-state-icon-animated">
              <i data-lucide="book-open" style="width:48px;height:48px;opacity:0.5;"></i>
              <div class="empty-state-pulse-ring"></div>
            </div>
            <h2>Select a Notebook</h2>
            <p style="font-size:0.875rem;color:var(--text-tertiary);margin-top:0.5rem;">Choose a notebook from the left panel to begin your session.</p>
          </div>
        </div>
      </section>
    </div>

    <div id="snippet-context-menu" class="tree-context-menu hidden">
      <button class="tree-context-item" id="sctx-new-folder" onclick="snippetCtxNewFolder()"><i data-lucide="folder-plus"></i> New Subfolder</button>
      <button class="tree-context-item" id="sctx-rename" onclick="snippetCtxRename()"><i data-lucide="pencil"></i> Rename</button>
      <button class="tree-context-item" id="sctx-move" onclick="snippetCtxMove()"><i data-lucide="move"></i> Move to...</button>
      <button class="tree-context-item" id="sctx-icon" onclick="snippetCtxChangeIcon()"><i data-lucide="image"></i> Change Icon</button>
      <div class="tree-context-divider"></div>
      <button class="tree-context-item danger" id="sctx-delete" onclick="snippetCtxDelete()"><i data-lucide="trash-2"></i> Delete Folder</button>
    </div>
    <div id="notebook-context-menu" class="tree-context-menu hidden">
      <button class="tree-context-item" id="nctx-new-folder" onclick="notebookCtxNewFolder()"><i data-lucide="folder-plus"></i> New Subfolder</button>
      <button class="tree-context-item" id="nctx-rename" onclick="notebookCtxRename()"><i data-lucide="pencil"></i> Rename</button>
      <button class="tree-context-item" id="nctx-move" onclick="notebookCtxMove()"><i data-lucide="move"></i> Move to...</button>
      <button class="tree-context-item" id="nctx-icon" onclick="notebookCtxChangeIcon()"><i data-lucide="image"></i> Change Icon</button>
      <div class="tree-context-divider"></div>
      <button class="tree-context-item danger" id="nctx-delete" onclick="notebookCtxDelete()"><i data-lucide="trash-2"></i> Delete Folder</button>
    </div>

    <div id="examples-modal" class="modal-overlay hidden">
      <div class="modal-content modal-content-lg" style="max-width: 800px; text-align: left;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h2 id="examples-modal-title" class="modal-title" style="margin: 0;">Snippet Examples</h2>
          <button onclick="closeExamplesModal()" class="btn btn-ghost"><i data-lucide="x"></i></button>
        </div>
        <div class="variant-tabs" id="examples-tabs"></div>
        <div id="examples-content" style="min-height: 200px;"></div>
      </div>
    </div>

    <div id="try-coding-modal" class="modal-overlay hidden">
      <div class="modal-content modal-content-lg" style="max-width: 900px; text-align: left; max-height: 90vh; display: flex; flex-direction: column;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h2 id="try-coding-title" class="modal-title" style="margin: 0;"><i data-lucide="terminal" style="width:24px; height:24px; display:inline; vertical-align:middle; margin-right:0.5rem;"></i> Try Coding</h2>
          <button onclick="closeTryCodingModal()" class="btn btn-ghost"><i data-lucide="x"></i></button>
        </div>
        <div id="try-coding-desc" style="font-size: 0.8125rem; color: var(--text-secondary); margin-bottom: 1rem; padding: 0.75rem; background: var(--bg-surface-hover); border-radius: var(--radius-md); border-left: 3px solid var(--color-primary);"></div>
        <div class="editor-container" style="flex: 1; min-height: 280px; max-height: 400px;">
          <pre id="try-coding-pre" class="editor-pre"><code id="try-coding-code"></code></pre>
          <textarea id="try-coding-textarea" spellcheck="false" class="editor-textarea" placeholder="// Type your code here..."></textarea>
        </div>
        <div id="try-coding-result" style="margin-top: 1rem; display: none;"></div>
        <div style="display: flex; gap: 0.75rem; margin-top: 1rem;">
          <button onclick="resetTryCoding()" class="btn btn-secondary" style="flex: 1;"><i data-lucide="rotate-ccw" style="width:16px;height:16px;"></i> Reset</button>
          <button onclick="checkTryCoding()" class="btn btn-primary" style="flex: 2;"><i data-lucide="check-circle" style="width:16px;height:16px;"></i> Check Code</button>
        </div>
      </div>
    </div>

    <div id="related-challenges-modal" class="modal-overlay hidden">
      <div class="modal-content modal-content-lg" style="max-width: 650px; text-align: left; max-height: 80vh; display: flex; flex-direction: column;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h2 class="modal-title" style="margin: 0;"><i data-lucide="link" style="width:24px; height:24px; display:inline; vertical-align:middle; margin-right:0.5rem;"></i> Related Challenges</h2>
          <button onclick="closeRelatedChallengesModal()" class="btn btn-ghost"><i data-lucide="x"></i></button>
        </div>
        <div class="search-container" style="margin-bottom: 1rem;">
          <i data-lucide="search"></i>
          <input type="text" id="related-search" oninput="renderRelatedChallengesList()" placeholder="Search challenges..." class="search-input">
        </div>
        <div id="related-challenges-list" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0.5rem;"></div>
      </div>
    </div>
  `;
}

function studyInit() {
  renderStudyArea();
  updateStudyHeaderStats();
  checkSharedSnippet();
  checkSharedNotebook();
  GuidedTutorial.init('study');
}

function studyDestroy() { }

function updateStudyHeaderStats() {
  const totalSnippets = (state.snippets || []).length;
  const totalNotebooks = (state.notebooks || []).length;
  const snippetFolders = state.nodes.filter(n => n.scope === 'snippet' && n.type === 'folder').length;
  const notebookFolders = state.nodes.filter(n => n.scope === 'notebook' && n.type === 'folder').length;

  const headerSub = document.getElementById('study-header-stats');
  if (headerSub) {
    headerSub.textContent = `${totalNotebooks} notebook${totalNotebooks !== 1 ? 's' : ''}, ${totalSnippets} snippet${totalSnippets !== 1 ? 's' : ''}`;
  }

  const notesCount = document.getElementById('notes-tab-count');
  const snippetsCount = document.getElementById('snippets-tab-count');
  if (notesCount) notesCount.textContent = totalNotebooks;
  if (snippetsCount) snippetsCount.textContent = totalSnippets;
}
