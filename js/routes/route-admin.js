/* Route: admin */
function getAdminFormHTML() {
  return `
    <div id="admin-form-container" class="admin-form-panel hidden">
      <!-- Header -->
      <div class="admin-form-header">
        <div class="af-header-left">
          <div class="af-header-badge" style="background:var(--color-primary-subtle);">
            <i data-lucide="code-2" style="width:18px;height:18px;color:var(--color-primary);" aria-hidden="true"></i>
          </div>
          <div class="af-header-text">
            <h2 id="admin-form-title">Edit Program</h2>
            <p>Coding challenge configuration</p>
          </div>
          <span class="af-save-status" id="admin-save-status" aria-live="polite"></span>
        </div>
        <button onclick="closeAdminForm()" class="btn btn-ghost af-close-btn" id="close-form-btn" aria-label="Close form" title="Close (Esc)">
          <i data-lucide="x" style="width:20px;height:20px;" aria-hidden="true"></i>
        </button>
      </div>

      <!-- Section: Identity -->
      <div class="af-section">
        <div class="af-section-header">
          <i data-lucide="info" class="af-section-icon" style="color:var(--color-primary);"></i>
          <span>Basic Info</span>
        </div>
        <div class="af-section-body">
          <div class="af-row-2">
            <div class="af-field af-field-wide">
              <label class="form-label" for="admin-title"><i data-lucide="type" class="af-label-icon"></i>Program Title</label>
              <input id="admin-title" oninput="adminState.title = this.value" placeholder="e.g. Basic Math Operations" class="form-input af-input-bold" />
            </div>
            <div class="af-field">
              <label class="form-label"><i data-lucide="folder" class="af-label-icon"></i>Category</label>
              <div id="admin-category-cs"></div>
              <select id="admin-category" onchange="adminState.parentId = this.value || null" class="hidden" aria-hidden="true" tabindex="-1"></select>
            </div>
          </div>

          <div class="af-field">
            <label class="form-label" for="admin-cover-desc"><i data-lucide="align-left" class="af-label-icon"></i>Cover Description <span class="af-label-hint">(shown in Browse)</span></label>
            <textarea id="admin-cover-desc" oninput="adminState.coverDescription = this.value" rows="2" class="form-textarea" placeholder="Brief overview of the program..."></textarea>
          </div>

          <div class="af-field">
            <label class="form-label"><i data-lucide="tag" class="af-label-icon"></i>Tags</label>
            <div class="af-tag-input-row">
              <input id="admin-tag-input" onkeydown="handleAdminTagKeydown(event)" placeholder="Type a tag and press Enter (commas for multi)..." class="form-input" />
              <button onclick="addAdminTag()" class="btn btn-secondary btn-sm af-add-btn"><i data-lucide="plus" style="width:13px;height:13px;"></i> Add</button>
            </div>
            <div id="admin-tag-suggestions" class="af-tag-suggestions"></div>
            <div id="admin-tags-list" class="af-tags-list"></div>
          </div>
        </div>
      </div>

      <!-- Section: Variants -->
      <div class="af-section">
        <div class="af-section-header" style="color:var(--color-accent);">
          <i data-lucide="layers" class="af-section-icon" style="color:var(--color-accent);"></i>
          <span>Versions / Variants</span>
          <button onclick="addAdminVariant()" class="btn btn-ghost btn-sm af-section-action" id="add-variant-btn" style="color:var(--color-accent);">
            <i data-lucide="plus-circle" style="width:13px;height:13px;"></i> Add Version
          </button>
        </div>
        <div class="af-section-body" style="padding-top:0.5rem;">
          <div id="admin-variant-tabs" class="variant-tabs"></div>
          <div id="admin-variant-content" style="flex:1;display:flex;flex-direction:column;gap:1rem;margin-top:0.75rem;"></div>
        </div>
      </div>

      <div class="admin-form-footer">
        <div class="af-footer-hint"><kbd>Ctrl</kbd>+<kbd>S</kbd> save · <kbd>Esc</kbd> close</div>
        <div class="af-footer-actions">
          <button onclick="closeAdminForm()" class="btn btn-secondary">
            <i data-lucide="x" style="width:15px;height:15px;"></i> Discard
          </button>
          <button onclick="saveAdminForm()" class="btn btn-primary" id="save-all-btn">
            <i data-lucide="save" style="width:15px;height:15px;"></i> Save Program
          </button>
        </div>
      </div>
    </div>
  `;
}

function adminTemplate() {
  return `
    <div class="messenger-layout">
      <main class="messenger-pane-1">
        <div class="pane-1-header">
          <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
            <h2 style="font-size: 1.25rem; font-weight: 800; display: flex; align-items: center; gap: 0.5rem;">
              <i data-lucide="settings" style="color: var(--color-primary);" aria-hidden="true"></i> Admin Panel
            </h2>
            <button class="tutorial-trigger-btn" onclick="GuidedTutorial.start()" title="Show Page Tour" aria-label="Show Page Tour">
              <i data-lucide="graduation-cap" aria-hidden="true"></i>
            </button>
          </div>
          <div class="admin-toggle-group" id="admin-toggles" data-active="practice" style="width: 100%;" role="group" aria-label="Content mode">
            <div class="admin-toggle-slider" id="admin-toggle-slider" aria-hidden="true"></div>
            <button class="admin-toggle-btn training-mode" id="toggle-study" onclick="toggleAdminMode('study')" aria-pressed="false"><i data-lucide="swords" aria-hidden="true"></i> Notes Mode</button>
            <button class="admin-toggle-btn practice-mode" id="toggle-practice" onclick="toggleAdminMode('practice')" aria-pressed="true"><i data-lucide="pen-tool" aria-hidden="true"></i> Coding Mode</button>
          </div>
          <div class="search-container" style="width: 100%;">
            <i data-lucide="search"></i>
            <input type="text" id="admin-search-input" class="search-input" placeholder="Search..." oninput="(window._adminSearchDebounced || (window._adminSearchDebounced = debounce(renderAdmin, 220)))()" aria-label="Search programs">
          </div>
          <div id="admin-filter-container"></div>
        </div>
        <div class="pane-1-content">
          <div id="admin-practice-wrapper">
            <!-- Programs -->
            <div class="card-flat" style="margin-bottom: 1.5rem; padding: 1.25rem;">
              <h2 style="font-weight:700; font-size:1.1rem; margin-bottom:1rem; display:flex; align-items:center; gap:0.5rem;">
                <i data-lucide="code" style="color:var(--color-primary);"></i> Programs
              </h2>
              
              <!-- First 2 items -->
              <div style="display:flex; flex-direction:column; gap:0.25rem; margin-bottom: 0.5rem;" id="admin-table-body-preview"></div>
              
              <!-- Rest in Dropdown -->
              <div class="tree-node" id="admin-programs-dropdown-wrapper" style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md);">
                <div class="tree-node-row" onclick="toggleAdminSection('admin-programs-content', event)" style="cursor: pointer; padding: 0.75rem 1rem; border-radius: var(--radius-md);">
                  <i data-lucide="chevron-right" class="tree-node-chevron"></i>
                  <span class="tree-node-label" style="font-weight:600; font-size:0.95rem; color: var(--text-secondary);">Show <span id="admin-programs-rest-count">0</span> more programs...</span>
                </div>
                <div class="tree-children collapsed" id="admin-programs-content">
                  <div class="tree-children-inner" style="padding: 0 1rem 1rem 1rem;">
                    <div style="display:flex; flex-direction:column; gap:0.25rem;" id="admin-table-body-rest"></div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Categories -->
            <div class="card-flat" style="margin-bottom: 1.5rem; padding: 1.25rem;">
              <h2 style="font-weight:700; font-size:1.1rem; margin-bottom:1rem; display:flex; align-items:center; gap:0.5rem;">
                <i data-lucide="folder" style="color:var(--color-warning);"></i> Categories
              </h2>
              
              <ul id="admin-category-list-preview" style="display:flex; flex-direction:column; gap:0.5rem; margin-bottom:0.5rem; list-style:none; padding:0;"></ul>
              
              <div class="tree-node" id="admin-categories-dropdown-wrapper" style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md);">
                <div class="tree-node-row" onclick="toggleAdminSection('admin-categories-content', event)" style="cursor: pointer; padding: 0.75rem 1rem; border-radius: var(--radius-md);">
                  <i data-lucide="chevron-right" class="tree-node-chevron"></i>
                  <span class="tree-node-label" style="font-weight:600; font-size:0.95rem; color: var(--text-secondary);">Show <span id="admin-categories-rest-count">0</span> more categories...</span>
                </div>
                <div class="tree-children collapsed" id="admin-categories-content">
                  <div class="tree-children-inner" style="padding: 0 1rem 1rem 1rem;">
                    <ul id="admin-category-list-rest" style="display:flex; flex-direction:column; gap:0.5rem; margin-bottom:1rem; list-style:none; padding:0;"></ul>
                    <div style="display:flex; gap:0.5rem;">
                      <input id="new-category-input" placeholder="New Category" onkeydown="if(event.key==='Enter') addCategory()" class="form-input" style="flex:1;" />
                      <button onclick="addCategory()" class="btn btn-secondary btn-icon" id="add-category-btn" title="Add Category"><i data-lucide="plus" style="width:18px;height:18px;"></i></button>
                    </div>
                  </div>
                </div>
              </div>
              
              <div id="admin-categories-fallback-add" style="display:none; gap:0.5rem; margin-top: 0.5rem;">
                <input id="new-category-input-fallback" placeholder="New Category" onkeydown="if(event.key==='Enter') { document.getElementById('new-category-input').value = this.value; addCategory(); this.value=''; }" class="form-input" style="flex:1;" />
                <button onclick="document.getElementById('new-category-input').value = document.getElementById('new-category-input-fallback').value; addCategory(); document.getElementById('new-category-input-fallback').value='';" class="btn btn-secondary btn-icon" title="Add Category"><i data-lucide="plus" style="width:18px;height:18px;"></i></button>
              </div>
            </div>

            <!-- Skill Tree Locks -->
            <div class="card-flat" style="margin-bottom: 1.5rem; padding: 1.25rem;">
              <h2 style="font-weight:700; font-size:1.1rem; margin-bottom:1rem; display:flex; align-items:center; gap:0.5rem;">
                <i data-lucide="lock" style="color:var(--text-tertiary);"></i> Skill Tree Locks
              </h2>
              
              <div style="display:flex; flex-direction:column; gap:0.75rem; margin-bottom: 0.5rem;" id="admin-lock-rules-preview"></div>
              
              <div class="tree-node" id="admin-locks-dropdown-wrapper" style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md);">
                <div class="tree-node-row" onclick="toggleAdminSection('admin-locks-content', event)" style="cursor: pointer; padding: 0.75rem 1rem; border-radius: var(--radius-md);">
                  <i data-lucide="chevron-right" class="tree-node-chevron"></i>
                  <span class="tree-node-label" style="font-weight:600; font-size:0.95rem; color: var(--text-secondary);">Show <span id="admin-locks-rest-count">0</span> more locks...</span>
                </div>
                <div class="tree-children collapsed" id="admin-locks-content">
                  <div class="tree-children-inner" style="padding: 0 1rem 1rem 1rem;">
                    <div style="display:flex; flex-direction:column; gap:0.75rem;" id="admin-lock-rules-rest"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div id="admin-study-wrapper" class="hidden">
            <div class="study-tabs" style="margin-bottom: 1rem;">
              <button class="study-tab active" id="admin-subtab-notes" onclick="switchAdminStudyTab('notes', this)" style="flex:1; justify-content:center;"><i data-lucide="book"></i> Notes</button>
              <button class="study-tab" id="admin-subtab-snippets" onclick="switchAdminStudyTab('snippets', this)" style="flex:1; justify-content:center;"><i data-lucide="code"></i> Snippets</button>
            </div>
            <div style="display:flex; flex-direction:column; gap:0.25rem;" id="study-table-body" class="hidden"></div>
            <div style="display:flex; flex-direction:column; gap:0.25rem;" id="notebook-table-body"></div>
            <div class="card-flat hidden" style="margin-top: 2rem; padding: 1.25rem;" id="study-category-container">
              <h2 style="font-weight:700; font-size:1.1rem; margin-bottom:1rem;">Snippet Categories</h2>
              <ul id="study-category-list" style="display:flex; flex-direction:column; gap:0.5rem; margin-bottom:1rem; list-style:none;"></ul>
              <div style="display:flex; gap:0.5rem;">
                <input id="new-study-category-input" placeholder="New Category" onkeydown="if(event.key==='Enter') addStudyCategory()" class="form-input" style="flex:1;" />
                <button onclick="addStudyCategory()" class="btn btn-secondary btn-icon" title="Add Category"><i data-lucide="plus" style="width:18px;height:18px;"></i></button>
              </div>
            </div>
            <div class="card-flat" style="margin-top: 2rem; padding: 1.25rem;" id="notebook-category-container">
              <h2 style="font-weight:700; font-size:1.1rem; margin-bottom:1rem;">Notebook Categories</h2>
              <ul id="notebook-category-list" style="display:flex; flex-direction:column; gap:0.5rem; margin-bottom:1rem; list-style:none;"></ul>
              <div style="display:flex; gap:0.5rem;">
                <input id="new-notebook-category-input" placeholder="New Category" onkeydown="if(event.key==='Enter') addNotebookCategory()" class="form-input" style="flex:1;" />
                <button onclick="addNotebookCategory()" class="btn btn-secondary btn-icon" title="Add Category"><i data-lucide="plus" style="width:18px;height:18px;"></i></button>
              </div>
            </div>
          </div>
        </div>
      </main>
      <div class="resizer-divider" onmousedown="initResizerDrag(event, this)"></div>
      <section class="messenger-pane-2">
        <div id="admin-empty-state" class="admin-empty-state">
          <div class="admin-empty-content">
            <div class="admin-empty-icon">
              <i data-lucide="edit-3" aria-hidden="true"></i>
            </div>
            <h2 class="admin-empty-title">Select an item to edit</h2>
            <p class="admin-empty-subtitle">Choose a program from the left panel, or create a new one.</p>
            <div class="admin-empty-shortcuts">
              <span class="admin-empty-shortcut"><kbd>Ctrl</kbd>+<kbd>N</kbd> new</span>
              <span class="admin-empty-shortcut"><kbd>Ctrl</kbd>+<kbd>S</kbd> save</span>
              <span class="admin-empty-shortcut"><kbd>Esc</kbd> close</span>
            </div>
          </div>
          <button onclick="openNewAdminItem()" class="btn btn-primary bottom-center-action" id="new-program-btn">
            <i data-lucide="plus" style="width:18px;height:18px;"></i> <span id="new-btn-text">Create New Program</span>
          </button>
        </div>
        ${getAdminFormHTML()}
        <div id="study-form-container" class="admin-form-panel hidden">
          <!-- Header -->
          <div class="admin-form-header">
            <div class="af-header-left">
              <div class="af-header-badge" style="background:rgba(6,182,212,0.12);">
                <i data-lucide="code" style="width:18px;height:18px;color:var(--color-accent);" aria-hidden="true"></i>
              </div>
              <div class="af-header-text">
                <h2 id="study-form-title">Edit Snippet</h2>
                <p>Code snippet / study material</p>
              </div>
              <span class="af-save-status" id="study-save-status" aria-live="polite"></span>
            </div>
            <button onclick="closeStudyForm()" class="btn btn-ghost af-close-btn" aria-label="Close form" title="Close (Esc)">
              <i data-lucide="x" style="width:20px;height:20px;" aria-hidden="true"></i>
            </button>
          </div>

          <!-- Section: Identity -->
          <div class="af-section">
            <div class="af-section-header" style="color:var(--color-accent);">
              <i data-lucide="info" class="af-section-icon" style="color:var(--color-accent);"></i>
              <span>Basic Info</span>
            </div>
            <div class="af-section-body">
              <div class="af-row-2">
                <div class="af-field af-field-wide">
                  <label class="form-label" for="study-title"><i data-lucide="type" class="af-label-icon"></i>Snippet Title</label>
                  <input id="study-title" oninput="studyModeState.title = this.value" class="form-input af-input-bold" placeholder="e.g. Pointer Arithmetic" />
                </div>
                <div class="af-field">
                  <label class="form-label"><i data-lucide="folder" class="af-label-icon"></i>Category</label>
                  <div id="study-category-cs"></div>
                  <select id="study-category" onchange="studyModeState.parentId = this.value || null" class="hidden" aria-hidden="true" tabindex="-1"></select>
                </div>
              </div>
              <div class="af-field">
                <label class="form-label"><i data-lucide="tag" class="af-label-icon"></i>Tags</label>
                <div class="af-tag-input-row">
                  <input id="study-tag-input" onkeydown="handleStudyTagKeydown(event)" placeholder="Type a tag and press Enter (commas for multi)..." class="form-input" />
                  <button onclick="addStudyTag()" class="btn btn-secondary btn-sm af-add-btn"><i data-lucide="plus" style="width:13px;height:13px;"></i> Add</button>
                </div>
                <div id="study-tag-suggestions" class="af-tag-suggestions"></div>
                <div id="study-tags-list" class="af-tags-list"></div>
              </div>
            </div>
          </div>

          <!-- Section: Content -->
          <div class="af-section">
            <div class="af-section-header" style="color:var(--color-primary);">
              <i data-lucide="file-text" class="af-section-icon" style="color:var(--color-primary);"></i>
              <span>Content</span>
            </div>
            <div class="af-section-body">
              <div class="af-field">
                <label class="form-label">Description <span style="font-weight:400;color:var(--text-tertiary);">(Rich Text)</span></label>
                <div id="study-desc-editor" style="border-radius:var(--radius-md);background:var(--bg-surface);min-height:150px;"></div>
              </div>
              <div class="af-field">
                <label class="form-label">Comments / Notes</label>
                <div id="study-comments-editor" style="border-radius:var(--radius-md);background:var(--bg-surface);min-height:150px;"></div>
              </div>
            </div>
          </div>

          <!-- Section: Links -->
          <div class="af-section">
            <div class="af-section-header" style="color:var(--color-warning);">
              <i data-lucide="link" class="af-section-icon" style="color:var(--color-warning);"></i>
              <span>Linked Challenges</span>
            </div>
            <div class="af-section-body">
              <div class="af-field">
                <label class="form-label">Link a related program</label>
                <div style="display:flex;gap:0.5rem;">
                  <select id="study-challenge-select" class="form-select" style="flex:1;"></select>
                  <button onclick="addStudyRelatedChallenge()" class="btn btn-secondary btn-sm" style="white-space:nowrap;"><i data-lucide="link" style="width:13px;height:13px;"></i> Link</button>
                </div>
              </div>
              <div id="study-related-challenges-list" style="display:flex;flex-direction:column;gap:0.5rem;"></div>
            </div>
          </div>

          <!-- Section: Code -->
          <div class="af-section">
            <div class="af-section-header" style="color:var(--color-accent);">
              <i data-lucide="terminal" class="af-section-icon" style="color:var(--color-accent);"></i>
              <span>Global Starter Code</span>
            </div>
            <div class="af-section-body">
              <div class="af-field" style="min-height:180px;display:flex;flex-direction:column;">
                <label class="form-label" style="color:var(--color-accent);">Pre-filled code for Try Coding</label>
                <div class="editor-container" style="flex:1;border-color:var(--color-accent);">
                  <pre id="study-global-starter-pre" class="editor-pre"><code id="study-global-starter-code"></code></pre>
                  <textarea id="study-global-starter-textarea" spellcheck="false" class="editor-textarea" placeholder="// Add starter boilerplate here..."></textarea>
                </div>
              </div>
            </div>
          </div>

          <!-- Section: Examples -->
          <div class="af-section">
            <div class="af-section-header" style="color:var(--color-success);">
              <i data-lucide="play-circle" class="af-section-icon" style="color:var(--color-success);"></i>
              <span>Code Examples</span>
              <button onclick="addStudyExample()" class="btn btn-ghost btn-sm af-section-action" style="color:var(--color-success);">
                <i data-lucide="plus-circle" style="width:13px;height:13px;"></i> Add Example
              </button>
            </div>
            <div class="af-section-body" style="padding-top:0.5rem;">
              <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem;font-size:0.8125rem;flex-wrap:wrap;">
                <span style="color:var(--text-tertiary);font-weight:700;text-transform:uppercase;letter-spacing:0.04em;font-size:0.6875rem;">Try Coding Targets:</span>
                <div id="try-coding-targets-container" style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;"></div>
              </div>
              <div id="study-examples-tabs" class="variant-tabs"></div>
              <div id="study-examples-content" style="flex:1;display:flex;flex-direction:column;gap:1rem;margin-top:0.75rem;"></div>
            </div>
          </div>

          <div class="admin-form-footer">
            <div class="af-footer-hint"><kbd>Ctrl</kbd>+<kbd>S</kbd> save · <kbd>Esc</kbd> close</div>
            <div class="af-footer-actions">
              <button onclick="closeStudyForm()" class="btn btn-secondary">
                <i data-lucide="x" style="width:15px;height:15px;"></i> Discard
              </button>
              <button onclick="saveStudyForm()" class="btn btn-primary" id="save-study-btn">
                <i data-lucide="save" style="width:15px;height:15px;"></i> Save Snippet
              </button>
            </div>
          </div>
        </div>

        <div id="notebook-form-container" class="admin-form-panel hidden">
          <!-- Header -->
          <div class="admin-form-header">
            <div class="af-header-left">
              <div class="af-header-badge" style="background:rgba(245,158,11,0.12);">
                <i data-lucide="book-open" style="width:18px;height:18px;color:var(--color-warning);" aria-hidden="true"></i>
              </div>
              <div class="af-header-text">
                <h2 id="notebook-form-title">Edit Notebook</h2>
                <p>MCQ notebook / quiz configuration</p>
              </div>
              <span class="af-save-status" id="notebook-save-status" aria-live="polite"></span>
            </div>
            <button onclick="closeNotebookForm()" class="btn btn-ghost af-close-btn" aria-label="Close form" title="Close (Esc)">
              <i data-lucide="x" style="width:20px;height:20px;" aria-hidden="true"></i>
            </button>
          </div>

          <!-- Section: Identity -->
          <div class="af-section">
            <div class="af-section-header" style="color:var(--color-warning);">
              <i data-lucide="info" class="af-section-icon" style="color:var(--color-warning);"></i>
              <span>Basic Info</span>
            </div>
            <div class="af-section-body">
              <div class="af-row-2">
                <div class="af-field af-field-wide">
                  <label class="form-label" for="notebook-title"><i data-lucide="type" class="af-label-icon"></i>Notebook Title</label>
                  <input id="notebook-title" oninput="notebookAdminState.title = this.value" class="form-input af-input-bold" placeholder="e.g. Calculus Quiz 1" />
                </div>
                <div class="af-field">
                  <label class="form-label"><i data-lucide="folder" class="af-label-icon"></i>Category</label>
                  <div id="notebook-category-cs"></div>
                  <select id="notebook-category" onchange="notebookAdminState.parentId = this.value || null" class="hidden" aria-hidden="true" tabindex="-1"></select>
                </div>
              </div>

              <div class="af-row-2">
                <div class="af-field">
                  <label class="form-label"><i data-lucide="smile" class="af-label-icon"></i>Icon</label>
                  <div id="notebook-icon-picker-container"></div>
                </div>
                <div class="af-field af-field-wide">
                  <label class="form-label"><i data-lucide="tag" class="af-label-icon"></i>Tags</label>
                  <div class="af-tag-input-row">
                    <input id="notebook-tag-input" onkeydown="handleNotebookTagKeydown(event)" placeholder="Type a tag and press Enter (commas for multi)..." class="form-input" />
                    <button onclick="addNotebookTag()" class="btn btn-secondary btn-sm af-add-btn"><i data-lucide="plus" style="width:13px;height:13px;"></i> Add</button>
                  </div>
                  <div id="notebook-tag-suggestions" class="af-tag-suggestions"></div>
                  <div id="notebook-tags-list" class="af-tags-list"></div>
                </div>
              </div>

              <div class="af-field">
                <label class="form-label" for="notebook-desc"><i data-lucide="align-left" class="af-label-icon"></i>Description</label>
                <textarea id="notebook-desc" oninput="notebookAdminState.description = this.value" rows="3" class="form-textarea" placeholder="Brief overview of the notebook..."></textarea>
              </div>
            </div>
          </div>

          <!-- Section: Sections -->
          <div class="af-section">
            <div class="af-section-header" style="color:var(--color-primary);">
              <i data-lucide="list" class="af-section-icon" style="color:var(--color-primary);"></i>
              <span>Sections <span class="af-label-hint">(Question Parts)</span></span>
              <button onclick="addNotebookSection()" class="btn btn-ghost btn-sm af-section-action" style="color:var(--color-primary);">
                <i data-lucide="plus-circle" style="width:13px;height:13px;"></i> Add Section
              </button>
            </div>
            <div class="af-section-body" style="padding-top:0.5rem;">
              <div id="notebook-sections-content" style="display:flex;flex-direction:column;gap:1rem;"></div>
            </div>
          </div>

          <div class="admin-form-footer">
            <div class="af-footer-hint"><kbd>Ctrl</kbd>+<kbd>S</kbd> save · <kbd>Esc</kbd> close</div>
            <div class="af-footer-actions">
              <button onclick="closeNotebookForm()" class="btn btn-secondary">
                <i data-lucide="x" style="width:15px;height:15px;"></i> Discard
              </button>
              <button onclick="saveNotebookForm()" class="btn btn-primary" id="save-notebook-btn">
                <i data-lucide="save" style="width:15px;height:15px;"></i> Save Notebook
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  `;
}

function getNotebookFormHTML() {
  return `
    <div id="notebook-form-container" class="admin-form-panel">
      <div class="admin-form-header">
        <div class="af-header-left">
          <div class="af-header-badge" style="background:rgba(245,158,11,0.12);">
            <i data-lucide="book-open" style="width:18px;height:18px;color:var(--color-warning);"></i>
          </div>
          <div class="af-header-text">
            <h2 id="notebook-form-title">Edit Notebook</h2>
            <p>MCQ notebook / quiz configuration</p>
          </div>
          <span class="af-save-status" id="notebook-save-status" aria-live="polite"></span>
        </div>
      </div>

      <div class="af-section">
        <div class="af-section-header" style="color:var(--color-warning);">
          <i data-lucide="info" class="af-section-icon" style="color:var(--color-warning);"></i>
          <span>Basic Info</span>
        </div>
        <div class="af-section-body">
          <div class="af-row-2">
            <div class="af-field af-field-wide">
              <label class="form-label">Notebook Title</label>
              <input id="notebook-title" oninput="notebookAdminState.title = this.value" class="form-input af-input-bold" placeholder="e.g. Calculus Quiz 1" />
            </div>
            <div class="af-field">
              <label class="form-label">Category</label>
              <div id="notebook-category-cs"></div>
              <select id="notebook-category" onchange="notebookAdminState.parentId = this.value || null" class="hidden" aria-hidden="true" tabindex="-1"></select>
            </div>
          </div>
          <div class="af-row-2">
            <div class="af-field">
              <label class="form-label">Icon</label>
              <div id="notebook-icon-picker-container"></div>
            </div>
            <div class="af-field af-field-wide">
              <label class="form-label">Tags</label>
              <div class="af-tag-input-row">
                <input id="notebook-tag-input" onkeydown="handleNotebookTagKeydown(event)" placeholder="Type a tag and press Enter..." class="form-input" />
                <button onclick="addNotebookTag()" class="btn btn-secondary btn-sm af-add-btn"><i data-lucide="plus" style="width:13px;height:13px;"></i> Add</button>
              </div>
              <div id="notebook-tag-suggestions" class="af-tag-suggestions"></div>
              <div id="notebook-tags-list" class="af-tags-list"></div>
            </div>
          </div>
          <div class="af-field">
            <label class="form-label">Description</label>
            <textarea id="notebook-desc" oninput="notebookAdminState.description = this.value" rows="3" class="form-textarea" placeholder="Brief overview of the notebook..."></textarea>
          </div>
        </div>
      </div>

      <div class="af-section">
        <div class="af-section-header" style="color:var(--color-primary);">
          <i data-lucide="list" class="af-section-icon" style="color:var(--color-primary);"></i>
          <span>Sections</span>
          <button onclick="addNotebookSection()" class="btn btn-ghost btn-sm af-section-action" style="color:var(--color-primary);">
            <i data-lucide="plus-circle" style="width:13px;height:13px;"></i> Add Section
          </button>
        </div>
        <div class="af-section-body" style="padding-top:0.5rem;">
          <div id="notebook-sections-content" style="display:flex;flex-direction:column;gap:1rem;"></div>
        </div>
      </div>

      <div class="admin-form-footer">
        <div class="af-footer-hint"><kbd>Ctrl</kbd>+<kbd>S</kbd> save</div>
        <div class="af-footer-actions">
          <button onclick="saveNotebookForm()" class="btn btn-primary" id="save-notebook-btn">
            <i data-lucide="save" style="width:15px;height:15px;"></i> Save Notebook
          </button>
        </div>
      </div>
    </div>
  `;
}

function adminInit() {
  renderAdmin();
  if (typeof bindAdminFormListeners === 'function') bindAdminFormListeners();
  if (typeof bindAdminKeyboardShortcuts === 'function') bindAdminKeyboardShortcuts();
  GuidedTutorial.init('admin');
}

function adminDestroy() {
  window.adminIsDirty = false;
  if (typeof unbindAdminKeyboardShortcuts === 'function') unbindAdminKeyboardShortcuts();
}
