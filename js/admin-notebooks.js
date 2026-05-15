/* ============================================================
   ADMIN-NOTEBOOKS.JS — Training Grounds: Notebooks (MCQ) Admin
   (Answer Key Modal, Given Question Modal)
   ============================================================ */

let notebookAdminState = null;

function switchAdminStudyTab(tabId, btnEl) {
  if (window.adminIsDirty) {
    showUnsavedConfirm(
      () => { window.adminIsDirty = false; switchAdminStudyTab(tabId, btnEl); },
      () => {
        if (window.saveCurrentAdminForm) {
          const success = window.saveCurrentAdminForm({ silent: true });
          if (success === false) return; // validation failed
        }
        window.adminIsDirty = false; switchAdminStudyTab(tabId, btnEl);
      }
    );
    return;
  }

  document.querySelectorAll('#admin-study-wrapper .study-tab').forEach(el => el.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');

  currentAdminStudyTab = tabId;
  const snippetTbody = document.getElementById('study-table-body');
  const notebookTbody = document.getElementById('notebook-table-body');
  const studyCatContainer = document.getElementById('study-category-container');
  const notebookCatContainer = document.getElementById('notebook-category-container');
  const newProgramBtnText = document.getElementById('new-btn-text');

  if (tabId === 'snippets') {
    snippetTbody.classList.remove('hidden');
    notebookTbody.classList.add('hidden');
    studyCatContainer.classList.remove('hidden');
    notebookCatContainer.classList.add('hidden');
    if (newProgramBtnText) newProgramBtnText.textContent = 'Create New Snippet';
    renderStudyAdmin();
  } else {
    snippetTbody.classList.add('hidden');
    notebookTbody.classList.remove('hidden');
    studyCatContainer.classList.add('hidden');
    notebookCatContainer.classList.remove('hidden');
    if (newProgramBtnText) newProgramBtnText.textContent = 'Create New Notebook';
  }

  closeAdminForm();
  closeStudyForm();
  if (typeof closeNotebookForm === 'function') closeNotebookForm();

  adminCategoryFilter = 'All';
  updateAdminFilter();

  if (tabId === 'snippets') renderStudyAdmin();
  else renderNotebookAdmin();
}

function renderNotebookAdmin() {
  updateAdminFilter();

  const tbody = document.getElementById('notebook-table-body');
  if (!tbody) return;

  if (!state.notebooks || state.notebooks.length === 0) {
    tbody.innerHTML = '<div class="empty-state" style="padding:2rem;"><p>No notebooks inside Training Grounds.</p></div>';
  } else {
    // Build notebook folder picker
    const nfpOpts = [];
    function buildNFP(pid, d) {
      getChildFolders(pid, 'notebook').forEach(f => {
        nfpOpts.push({ id: f.id, label: '  '.repeat(d) + f.name });
        buildNFP(f.id, d + 1);
      });
    }
    buildNFP(null, 0);

    let filteredNotebooks = state.notebooks;

    const searchInput = document.getElementById('admin-search-input');
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

    if (query) {
      filteredNotebooks = filteredNotebooks.filter(nb => fuzzyMatch(nb.title, query) || (nb.tags || []).some(t => fuzzyMatch(t, query)));
    }

    if (adminCategoryFilter === '__uncategorized__') {
      filteredNotebooks = filteredNotebooks.filter(nb => nb.parentId === null || nb.parentId === undefined);
    } else if (adminCategoryFilter !== 'All') {
      const fids = new Set();
      function collectNFIds(id) { fids.add(id); getChildFolders(id, 'notebook').forEach(cf => collectNFIds(cf.id)); }
      collectNFIds(adminCategoryFilter);
      filteredNotebooks = filteredNotebooks.filter(nb => fids.has(nb.parentId));
    }

    tbody.innerHTML = filteredNotebooks.map(nb => `
      <div class="admin-list-item${notebookAdminState && notebookAdminState.id === nb.id ? ' active' : ''}"
        role="button" tabindex="0"
        onclick="document.querySelectorAll('.admin-list-item').forEach(el=>el.classList.remove('active'));this.classList.add('active');openNotebookForm('${nb.id}')"
        onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();document.querySelectorAll('.admin-list-item').forEach(el=>el.classList.remove('active'));this.classList.add('active');openNotebookForm('${nb.id}')}"
        aria-label="${escapeHTML(nb.title)}">
        <div class="admin-list-item-left">
          <div class="admin-list-item-title" style="display:flex; align-items:center; gap:0.5rem;">
            <i data-lucide="${nb.icon || 'book'}" style="width:16px;height:16px;color:var(--color-primary);"></i>
            ${escapeHTML(nb.title)}
          </div>
          <div class="admin-list-item-meta">
            <span>${(nb.sections || []).length} section${(nb.sections || []).length !== 1 ? 's' : ''}</span>
            <span class="admin-list-item-dot" aria-hidden="true">·</span>
            <button onclick="event.stopPropagation(); openListItemFolderPicker('${nb.id}', 'notebook', this)" class="ali-folder-btn" title="Move to folder" aria-label="Move to folder">
              <i data-lucide="folder" style="width:11px;height:11px;"></i>
              <span>${nb.parentId ? escapeHTML((nfpOpts.find(f=>f.id===nb.parentId)||{label:'Folder'}).label.trim()) : 'Uncategorized'}</span>
              <i data-lucide="chevron-down" style="width:10px;height:10px;opacity:0.6;"></i>
            </button>
          </div>
        </div>
        <div class="admin-list-item-actions">
          <button onclick="event.stopPropagation(); openNotebookForm('${nb.id}')" class="btn btn-ghost" title="Edit" aria-label="Edit ${escapeHTML(nb.title)}">
            <i data-lucide="pencil" style="width:16px;height:16px;color:var(--color-primary);" aria-hidden="true"></i>
          </button>
          <button onclick="event.stopPropagation(); deleteNotebook('${nb.id}')" class="btn btn-ghost" title="Delete" aria-label="Delete ${escapeHTML(nb.title)}">
            <i data-lucide="trash-2" style="width:16px;height:16px;color:var(--color-danger);" aria-hidden="true"></i>
          </button>
        </div>
      </div>
    `).join('');
  }

  // Folder list (tree view)
  const catList = document.getElementById('notebook-category-list');
  if (catList) {
    catList.innerHTML = renderAdminFolderTree(null, 'notebook', 0);
    if (!catList.innerHTML) {
      catList.innerHTML = '<p style="font-size:0.8rem; color:var(--text-tertiary); padding:0.5rem;">No folders. Add one below.</p>';
    }
  }

  lucide.createIcons();
}

function openNotebookForm(id) {
  const emptyState = document.getElementById('admin-empty-state');
  if (emptyState) emptyState.classList.add('hidden');
  const formContainer = document.getElementById('notebook-form-container');
  if (formContainer) {
    formContainer.classList.remove('hidden');
    if (formContainer.parentElement) formContainer.parentElement.scrollTop = 0;
  }

  window.adminIsDirty = false;
  window.saveCurrentAdminForm = saveNotebookForm;
  if (typeof setSaveStatus === 'function') setSaveStatus('notebook-save-status', '');

  // Build notebook folder picker
  const catSelect = document.getElementById('notebook-category');
  const nbFpOpts = [];
  function buildNFP2(pid, d) {
    getChildFolders(pid, 'notebook').forEach(f => {
      nbFpOpts.push({ id: f.id, label: '  '.repeat(d) + f.name });
      buildNFP2(f.id, d + 1);
    });
  }
  buildNFP2(null, 0);
  catSelect.innerHTML = `<option value="">Uncategorized</option>` + nbFpOpts.map(f => `<option value="${escapeHTML(f.id)}">${escapeHTML(f.label)}</option>`).join('');

  if (id === 'new') {
    const firstNbFolder = state.nodes.find(n => n.type === 'folder' && n.scope === 'notebook');
    notebookAdminState = {
      id: 'new', title: '', parentId: firstNbFolder ? firstNbFolder.id : null,
      icon: 'book', tags: [], description: '', sections: []
    };
  } else {
    const existing = state.notebooks.find(n => n.id === id);
    notebookAdminState = JSON.parse(JSON.stringify(existing));
    if (!notebookAdminState.tags) notebookAdminState.tags = [];
    if (!notebookAdminState.sections) notebookAdminState.sections = [];
  }

  document.getElementById('notebook-form-title').textContent = id === 'new' ? 'New Notebook' : 'Edit Notebook';
  document.getElementById('notebook-title').value = notebookAdminState.title;
  document.getElementById('notebook-category').value = notebookAdminState.parentId || '';

  // Render custom category dropdown
  if (typeof renderCustomSelect === 'function') {
    const _nbFpOpts = [{ value: '', label: 'Uncategorized', icon: 'inbox' }].concat(
      nbFpOpts.map(f => ({ value: f.id, label: f.label.trim(), icon: 'folder' }))
    );
    renderCustomSelect('notebook-category-cs', _nbFpOpts, notebookAdminState.parentId || '', (val) => {
      notebookAdminState.parentId = val || null;
      document.getElementById('notebook-category').value = val;
      window.adminIsDirty = true;
      if (typeof setSaveStatus === 'function') setSaveStatus('notebook-save-status', 'unsaved');
    }, 'Select category...');
  }

  renderIconDropdown('notebook-icon-picker-container', notebookAdminState.icon || 'book', (newIcon) => {
    notebookAdminState.icon = newIcon;
    window.adminIsDirty = true;
    if (typeof setSaveStatus === 'function') setSaveStatus('notebook-save-status', 'unsaved');
  });
  document.getElementById('notebook-desc').value = notebookAdminState.description || '';

  renderNotebookTags();
  if (typeof renderTagSuggestions === 'function') renderTagSuggestions('notebook', 'notebook');
  renderNotebookSectionsForm();

  if (id === 'new') {
    setTimeout(() => document.getElementById('notebook-title')?.focus(), 60);
  }
}

function closeNotebookForm() {
  notebookAdminState = null;
  const form = document.getElementById('notebook-form-container');
  if (form) form.classList.add('hidden');
  const emptyState = document.getElementById('admin-empty-state');
  if (emptyState) emptyState.classList.remove('hidden');
}

function saveNotebookForm(opts = {}) {
  // Sync DOM fields back to state before saving
  const titleEl = document.getElementById('notebook-title');
  const catEl = document.getElementById('notebook-category');
  const descEl = document.getElementById('notebook-desc');
  if (titleEl) notebookAdminState.title = titleEl.value;
  if (catEl) notebookAdminState.parentId = catEl.value || null;
  if (descEl) notebookAdminState.description = descEl.value;

  if (!notebookAdminState.title.trim()) {
    if (typeof showValidationError === 'function') showValidationError(titleEl, 'Title is required');
    if (!opts.silent) showMessage('Error', 'Title is required', true);
    return false;
  }

  // Update sections with current input values
  notebookAdminState.sections.forEach((sec, idx) => {
    const labelEl = document.getElementById(`nb-sec-label-${idx}`);
    const choicesEl = document.getElementById(`nb-sec-choices-${idx}`);
    const countEl = document.getElementById(`nb-sec-count-${idx}`);
    if (labelEl) sec.label = labelEl.value;
    if (choicesEl) sec.choices = parseInt(choicesEl.value) || 4;
    if (countEl) {
      const count = parseInt(countEl.value) || 1;
      sec.questions = Array.from({ length: count }, (_, i) => i + 1);
    }
  });

  if (notebookAdminState.id === 'new') {
    notebookAdminState.id = 'nb_' + Date.now();
    state.notebooks.unshift(notebookAdminState);
  } else {
    const index = state.notebooks.findIndex(n => n.id === notebookAdminState.id);
    if (index !== -1) state.notebooks[index] = notebookAdminState;
  }

  saveData();
  if (typeof setSaveStatus === 'function') setSaveStatus('notebook-save-status', 'saved');
  if (opts.silent) {
    window.adminIsDirty = false;
  } else {
    closeNotebookForm();
    window.adminIsDirty = false;
    showMessage('Success', 'Notebook saved successfully!');
    renderNotebookAdmin();
  }
  return true;
}

function deleteNotebook(id) {
  showConfirm('Delete Notebook', 'Are you sure you want to delete this notebook?', () => {
    state.notebooks = state.notebooks.filter(n => n.id !== id);
    saveData();
    renderNotebookAdmin();
  });
}

function addNotebookCategory() {
  const input = document.getElementById('new-notebook-category-input');
  const cat = input.value.trim();
  if (cat) {
    createNode(cat, 'folder', null, 'notebook');
    input.value = '';
    renderNotebookAdmin();
  }
}

function removeNotebookCategory(nodeId) {
  const folder = state.nodes.find(n => n.id === nodeId);
  if (!folder) return;
  showConfirm("Delete Folder", `Delete "${escapeHTML(folder.name)}"? Items will become uncategorized.`, () => {
    deleteNode(nodeId);
    renderNotebookAdmin();
  });
}

function handleNotebookTagKeydown(ev) {
  if (ev.key === 'Enter') { ev.preventDefault(); addNotebookTag(); return; }
  if (ev.key === ',') { ev.preventDefault(); addNotebookTag(); return; }
  if (ev.key === 'Backspace' && !ev.target.value && notebookAdminState && notebookAdminState.tags.length > 0) {
    ev.preventDefault();
    notebookAdminState.tags.pop();
    renderNotebookTags();
  }
}

function addNotebookTag() {
  const input = document.getElementById('notebook-tag-input');
  if (!input) return;
  const raw = input.value.trim();
  if (!raw) return;
  raw.split(',').map(v => v.trim()).filter(v => v).forEach(val => {
    if (notebookAdminState && !notebookAdminState.tags.includes(val)) {
      notebookAdminState.tags.push(val);
    }
  });
  input.value = '';
  renderNotebookTags();
  if (typeof renderTagSuggestions === 'function') renderTagSuggestions('notebook', 'notebook');
  window.adminIsDirty = true;
  if (typeof setSaveStatus === 'function') setSaveStatus('notebook-save-status', 'unsaved');
}

function removeNotebookTag(tag) {
  notebookAdminState.tags = notebookAdminState.tags.filter(t => t !== tag);
  renderNotebookTags();
  if (typeof renderTagSuggestions === 'function') renderTagSuggestions('notebook', 'notebook');
  window.adminIsDirty = true;
  if (typeof setSaveStatus === 'function') setSaveStatus('notebook-save-status', 'unsaved');
}

function renderNotebookTags() {
  const list = document.getElementById('notebook-tags-list');
  if (!list) return;
  list.innerHTML = notebookAdminState.tags.map(t => `
    <span class="tag">
      ${escapeHTML(t)}
      <button onclick="removeNotebookTag('${escapeHTML(t).replace(/'/g, "\\'")}')" title="Remove tag" aria-label="Remove tag ${escapeHTML(t)}"><i data-lucide="x" style="width:12px;height:12px;"></i></button>
    </span>
  `).join('');
  lucide.createIcons({ el: list });
}

function addNotebookSection() {
  syncAllNotebookSections();
  const labelEl = document.getElementById('new-sec-label');
  const label = labelEl ? (labelEl.value.trim() || 'New Section') : 'New Section';
  const choices = parseInt(document.getElementById('new-sec-choices')?.value) || 4;

  notebookAdminState.sections.push({
    id: 'sec_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    label: label,
    choices: choices,
    questions: [1, 2, 3, 4, 5],
    answerKey: '',
    answerKeysData: []
  });
  if (labelEl) labelEl.value = '';
  renderNotebookSectionsForm();
  window.adminIsDirty = true;
  if (typeof setSaveStatus === 'function') setSaveStatus('notebook-save-status', 'unsaved');
}

// BUG-23 FIX applied inside this function (.slice instead of .substr)
function bulkAddNotebookSections() {
  syncAllNotebookSections();
  const input = document.getElementById('bulk-add-sec-input')?.value.trim();
  if (!input) return;

  // Format: Math 10 | Science 5 (A-E)
  const parts = input.split('|').map(p => p.trim());
  parts.forEach(part => {
    if (!part) return;
    // Extract choices e.g. (A-E)
    let choices = 4;
    const choiceMatch = part.match(/\([A-Fa-f]-[A-Fa-f]\)/);
    let label = part;
    if (choiceMatch) {
      const charStr = choiceMatch[0].toUpperCase();
      if (charStr === '(A-B)') choices = 2;
      else if (charStr === '(A-C)') choices = 3;
      else if (charStr === '(A-D)') choices = 4;
      else if (charStr === '(A-E)') choices = 5;
      else if (charStr === '(A-F)') choices = 6;
      label = part.replace(choiceMatch[0], '').trim();
    }

    // Extract count e.g. 10
    const countMatch = label.match(/\d+$/);
    let count = 5;
    if (countMatch) {
      count = parseInt(countMatch[0]);
      label = label.replace(/\d+$/, '').trim();
    }

    notebookAdminState.sections.push({
      id: 'sec_' + Date.now() + Math.random().toString(36).slice(2, 7),
      label: label || 'Section',
      choices: choices,
      questions: Array.from({ length: count }, (_, i) => i + 1),
      answerKey: '',
      answerKeysData: []
    });
  });
  const bulkInput = document.getElementById('bulk-add-sec-input');
  if (bulkInput) bulkInput.value = '';
  renderNotebookSectionsForm();
  window.adminIsDirty = true;
  if (typeof setSaveStatus === 'function') setSaveStatus('notebook-save-status', 'unsaved');
}

function removeNotebookSection(idx) {
  notebookAdminState.sections.splice(idx, 1);
  renderNotebookSectionsForm();
  window.adminIsDirty = true;
  if (typeof setSaveStatus === 'function') setSaveStatus('notebook-save-status', 'unsaved');
}

function renderNotebookSectionsForm() {
  const container = document.getElementById('notebook-sections-content');
  if (!container) return;

  let html = '<div class="nb-sections-wrap">';

  if (!notebookAdminState.sections || notebookAdminState.sections.length === 0) {
    html += '<div class="nb-section-empty">No sections added yet. Add one below to start.</div>';
  } else {
    html += notebookAdminState.sections.map((sec, idx) => `
      <div class="nb-section-card" data-idx="${idx}" draggable="true"
           ondragstart="nbSectionDragStart(event, ${idx})"
           ondragover="nbSectionDragOver(event)"
           ondrop="nbSectionDrop(event, ${idx})"
           ondragend="nbSectionDragEnd(event)">
        <div class="nb-section-card-header">
          <span class="nb-section-handle" title="Drag to reorder" aria-hidden="true"><i data-lucide="grip-vertical"></i></span>
          <h4 class="nb-section-card-title">Section ${idx + 1}</h4>
          <div class="nb-section-card-meta">${(sec.questions || []).length} question${(sec.questions || []).length !== 1 ? 's' : ''} · ${sec.choices || 4} choices</div>
          <button onclick="syncAllNotebookSections(); removeNotebookSection(${idx})" class="btn btn-ghost btn-sm nb-section-remove" title="Remove Section" aria-label="Remove Section ${idx + 1}">
            <i data-lucide="trash-2" style="width:14px;height:14px;color:var(--color-danger);"></i>
          </button>
        </div>
        <div class="nb-section-card-body">
          <div class="nb-section-fields">
            <div class="af-field" style="flex:1; min-width:160px;">
              <label class="form-label">Label</label>
              <input id="nb-sec-label-${idx}" class="form-input nb-input-compact" value="${escapeHTML(sec.label || '')}" oninput="syncNotebookSection(${idx})" placeholder="e.g. Math, Reading..." />
            </div>
            <div class="af-field" style="width:120px;">
              <label class="form-label">Choices</label>
              <select id="nb-sec-choices-${idx}" class="form-select nb-input-compact" onchange="syncNotebookSection(${idx}); renderNotebookSectionsForm()">
                <option value="2" ${sec.choices === 2 ? 'selected' : ''}>2 (A-B)</option>
                <option value="3" ${sec.choices === 3 ? 'selected' : ''}>3 (A-C)</option>
                <option value="4" ${sec.choices === 4 ? 'selected' : ''}>4 (A-D)</option>
                <option value="5" ${sec.choices === 5 ? 'selected' : ''}>5 (A-E)</option>
                <option value="6" ${sec.choices === 6 ? 'selected' : ''}>6 (A-F)</option>
              </select>
            </div>
            <div class="af-field" style="width:100px;">
              <label class="form-label">Questions</label>
              <input id="nb-sec-count-${idx}" type="number" min="1" max="200" class="form-input nb-input-compact" value="${(sec.questions || []).length}" oninput="syncNotebookSection(${idx})" />
            </div>
          </div>
          <div class="nb-section-actions">
            <button onclick="openGivenQuestionModal(${idx})" class="btn btn-secondary nb-section-action-btn">
              <i data-lucide="file-text" style="width:16px;height:16px;"></i> Modify Given Question
            </button>
            <button onclick="openAnswerKeyModal(${idx})" class="btn btn-secondary nb-section-action-btn">
              <i data-lucide="key" style="width:16px;height:16px;"></i> Modify Answer Key
            </button>
          </div>
        </div>
      </div>
    `).join('');
  }

  html += `
    <div class="nb-add-section-card">
      <div class="nb-add-section-header">
        <i data-lucide="plus-square" style="width:14px;height:14px;color:var(--color-primary);"></i>
        <span>Add New Section</span>
      </div>
      <div class="nb-add-section-row">
        <input id="new-sec-label" class="form-input" placeholder="Section name..." style="flex:1; min-width:160px;" onkeydown="if(event.key==='Enter') addNotebookSection()" />
        <select id="new-sec-choices" class="form-select" style="width:120px;">
          <option value="2">2 (A-B)</option>
          <option value="3">3 (A-C)</option>
          <option value="4" selected>4 (A-D)</option>
          <option value="5">5 (A-E)</option>
          <option value="6">6 (A-F)</option>
        </select>
        <button onclick="addNotebookSection()" class="btn btn-primary nb-add-section-btn">
          <i data-lucide="plus" style="width:14px;height:14px;"></i> Add
        </button>
      </div>
    </div>

    <div class="nb-add-section-card">
      <div class="nb-add-section-header">
        <i data-lucide="layers" style="width:14px;height:14px;color:var(--color-accent);"></i>
        <span>Bulk Add Sections</span>
        <span class="af-label-hint" style="margin-left:auto;">Format: <code>Name Count (A-E)</code> · separate with <code>|</code></span>
      </div>
      <div class="nb-add-section-row">
        <input id="bulk-add-sec-input" class="form-input" placeholder="Math 10 | Science 5 (A-E)" style="flex:1;" onkeydown="if(event.key==='Enter') bulkAddNotebookSections()" />
        <button onclick="bulkAddNotebookSections()" class="btn btn-secondary nb-add-section-btn">
          <i data-lucide="layers" style="width:14px;height:14px;"></i> Confirm
        </button>
      </div>
    </div>
  </div>`;

  container.innerHTML = html;
  lucide.createIcons({ el: container });
}

// === Drag-to-reorder sections ===
let _nbSectionDragIdx = -1;

function nbSectionDragStart(e, idx) {
  _nbSectionDragIdx = idx;
  e.dataTransfer.effectAllowed = 'move';
  try { e.dataTransfer.setData('text/plain', String(idx)); } catch (err) {}
  e.currentTarget.classList.add('nb-section-dragging');
  syncAllNotebookSections();
}

function nbSectionDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.nb-section-card').forEach(c => c.classList.remove('nb-section-drag-over'));
  const card = e.currentTarget;
  card.classList.add('nb-section-drag-over');
}

function nbSectionDrop(e, idx) {
  e.preventDefault();
  if (_nbSectionDragIdx < 0 || _nbSectionDragIdx === idx) return;
  const arr = notebookAdminState.sections;
  const [moved] = arr.splice(_nbSectionDragIdx, 1);
  arr.splice(idx, 0, moved);
  _nbSectionDragIdx = -1;
  renderNotebookSectionsForm();
  window.adminIsDirty = true;
  if (typeof setSaveStatus === 'function') setSaveStatus('notebook-save-status', 'unsaved');
}

function nbSectionDragEnd(e) {
  document.querySelectorAll('.nb-section-card').forEach(c => {
    c.classList.remove('nb-section-dragging');
    c.classList.remove('nb-section-drag-over');
  });
  _nbSectionDragIdx = -1;
}

function syncNotebookSection(idx) {
  if (!notebookAdminState || !notebookAdminState.sections[idx]) return;
  const sec = notebookAdminState.sections[idx];
  const labelEl = document.getElementById('nb-sec-label-' + idx);
  const choicesEl = document.getElementById('nb-sec-choices-' + idx);
  const countEl = document.getElementById('nb-sec-count-' + idx);
  if (labelEl) sec.label = labelEl.value;
  if (choicesEl) sec.choices = parseInt(choicesEl.value) || 4;
  if (countEl) {
    const count = Math.max(0, parseInt(countEl.value) || 0);
    sec.questions = Array.from({ length: count }, (_, i) => i + 1);
  }
}

function syncAllNotebookSections() {
  if (!notebookAdminState || !notebookAdminState.sections) return;
  notebookAdminState.sections.forEach((_, idx) => syncNotebookSection(idx));
}

// === Answer Key Modal Logic ===
let activeAnswerKeySectionIdx = -1;
let currentAnswerKeysData = [];

function parseOldAnswerKey(str) {
  const data = [];
  if (!str) return data;
  str.split('\n').forEach(line => {
    const match = line.trim().match(/^(\d+)\s*[=:]\s*([A-Ea-e])/);
    if (match) {
      data.push({ qNum: parseInt(match[1]), answer: match[2].toUpperCase(), explanation: '' });
    }
  });
  return data;
}

function openAnswerKeyModal(idx) {
  syncAllNotebookSections();
  activeAnswerKeySectionIdx = idx;
  const sec = notebookAdminState.sections[idx];

  if (!sec.answerKeysData) {
    sec.answerKeysData = parseOldAnswerKey(sec.answerKey);
  }

  currentAnswerKeysData = JSON.parse(JSON.stringify(sec.answerKeysData));

  // Ensure we have an entry for every question in the section
  sec.questions.forEach(q => {
    if (!currentAnswerKeysData.find(d => d.qNum === q)) {
      currentAnswerKeysData.push({ qNum: q, type: 'mcq', answer: '', explanation: '' });
    }
  });
  currentAnswerKeysData.sort((a, b) => a.qNum - b.qNum);

  document.getElementById('answer-key-modal').classList.remove('hidden');
  renderAnswerKeyContent();
}

function closeAnswerKeyModal() {
  document.getElementById('answer-key-modal').classList.add('hidden');
  activeAnswerKeySectionIdx = -1;
  currentAnswerKeysData = [];
}

function saveAnswerKeyModal() {
  if (activeAnswerKeySectionIdx === -1) return;
  const sec = notebookAdminState.sections[activeAnswerKeySectionIdx];

  syncAnswerKeyData();

  sec.answerKeysData = JSON.parse(JSON.stringify(currentAnswerKeysData));

  // Update old answerKey string for backward compatibility (MCQ only)
  sec.answerKey = currentAnswerKeysData
    .filter(d => (d.type || 'mcq') === 'mcq' && d.answer && typeof d.answer === 'string' && d.answer.trim() !== '')
    .map(d => `${d.qNum}=${d.answer.trim().toUpperCase()}`)
    .join('\n');

  closeAnswerKeyModal();
  renderNotebookSectionsForm();
}

function syncAnswerKeyData() {
  currentAnswerKeysData.forEach((d, i) => {
    const qType = d.type || 'mcq';
    const expEl = document.getElementById(`ak-exp-${i}`);
    if (expEl) d.explanation = expEl.value;

    if (qType === 'text') {
      const txtEl = document.getElementById(`ak-ans-text-${i}`);
      if (txtEl) d.answer = txtEl.value;
    } else if (qType === 'checkbox') {
      const checks = document.querySelectorAll(`input[name="ak-cb-${i}"]:checked`);
      d.answer = Array.from(checks).map(c => c.value);
    } else {
      const ansEl = document.getElementById(`ak-ans-${i}`);
      if (ansEl) d.answer = ansEl.value.toUpperCase();
    }
  });
}

function addAnswerKeySample() {
  syncAnswerKeyData();
  const nextQ = currentAnswerKeysData.length > 0 ? Math.max(...currentAnswerKeysData.map(d => d.qNum)) + 1 : 1;
  currentAnswerKeysData.push({ qNum: nextQ, answer: '', explanation: '' });
  renderAnswerKeyContent();
}

function removeAnswerKeySample(idx) {
  syncAnswerKeyData();
  currentAnswerKeysData.splice(idx, 1);
  renderAnswerKeyContent();
}

function bulkAddAnswers() {
  syncAnswerKeyData();
  const input = document.getElementById('ak-bulk-input').value.trim();
  const expInput = document.getElementById('ak-bulk-exp-input') ? document.getElementById('ak-bulk-exp-input').value.trim() : '';
  if (!input && !expInput) return;

  if (input) {
    let autoQNum = 1;
    input.split('\n').forEach(line => {
      line = line.trim();
      if (!line) return;

      // Format: "1. A" or "1=A"
      const match = line.match(/^(\d+)[.=:\s]+([A-Ea-e])/);
      let qNum;
      let ans;
      if (match) {
        qNum = parseInt(match[1]);
        ans = match[2].toUpperCase();
        autoQNum = qNum + 1;
      } else {
        qNum = autoQNum;
        autoQNum++;
        // Attempt to extract just a single letter if possible
        const straightMatch = line.match(/^["']?([A-Ea-e])["']?$/i);
        ans = straightMatch ? straightMatch[1].toUpperCase() : line.charAt(0).toUpperCase();
      }

      const existing = currentAnswerKeysData.find(d => d.qNum === qNum);
      if (existing) {
        existing.answer = ans;
      } else {
        currentAnswerKeysData.push({ qNum: qNum, answer: ans, explanation: '' });
      }
    });
  }

  if (expInput) {
    let autoQNum = 1;
    expInput.split('\n').forEach(line => {
      line = line.trim();
      if (!line) return;

      const match = line.match(/^(\d+)[.)=:]\s+["']?(.*?)["']?$/);
      let qNum;
      let text;
      if (match) {
        qNum = parseInt(match[1]);
        text = match[2].trim();
        autoQNum = qNum + 1;
      } else {
        qNum = autoQNum;
        autoQNum++;
        const stripQuotes = line.match(/^["']?(.*?)["']?$/);
        text = stripQuotes ? stripQuotes[1].trim() : line;
      }

      const existing = currentAnswerKeysData.find(d => d.qNum === qNum);
      if (existing) {
        existing.explanation = text;
      } else {
        currentAnswerKeysData.push({ qNum: qNum, answer: '', explanation: text });
      }
    });
  }

  currentAnswerKeysData.sort((a, b) => a.qNum - b.qNum);
  renderAnswerKeyContent();
}

function renderAnswerKeyContent() {
  const container = document.getElementById('answer-key-content');

  let html = `
    <div style="display: flex; gap: 2rem; height: 100%; flex-wrap: wrap;">
      <div style="flex: 1 1 500px; display:flex; flex-direction:column; min-width: 0; overflow-y: auto; max-height: 60vh;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
          <h4 style="font-weight:700; font-size:0.75rem; color:var(--text-tertiary); text-transform:uppercase; letter-spacing:0.05em; margin:0;">ANSWER KEYS</h4>
          <button onclick="addAnswerKeySample()" class="btn btn-ghost btn-sm" style="color:var(--color-primary); font-weight:600;">
            <i data-lucide="plus-circle" style="width:14px;height:14px;"></i> Add Answer
          </button>
        </div>

        <div style="display:flex; flex-direction:column; gap:1rem; margin-bottom:2rem;">
  `;

  if (currentAnswerKeysData.length === 0) {
    html += '<p style="color:var(--text-tertiary); font-size:0.875rem;">No answers added yet.</p>';
  } else {
    html += currentAnswerKeysData.map((d, i) => {
      const qType = d.type || 'mcq';
      const sec = notebookAdminState.sections[activeAnswerKeySectionIdx];
      const choiceLetters = Array.from({ length: sec.choices || 4 }, (_, ci) => String.fromCharCode(65 + ci));
      const typeBadgeColors = { mcq: '#818cf8', checkbox: '#10b981', text: '#fbbf24' };
      const typeLabels = { mcq: 'MCQ', checkbox: 'Multi', text: 'Text' };

      let answerInputHtml = '';
      if (qType === 'text') {
        answerInputHtml = `
          <div style="display:flex; flex-direction:column; gap:0.25rem;">
            <span style="font-size:0.75rem; color:var(--text-tertiary);">Correct Text Answer:</span>
            <input id="ak-ans-text-${i}" value="${escapeHTML(typeof d.answer === 'string' ? d.answer : '')}" class="form-input" style="font-size:0.875rem; padding:0.375rem 0.5rem;" placeholder="Expected answer text..." />
          </div>
        `;
      } else if (qType === 'checkbox') {
        const checkedArr = Array.isArray(d.answer) ? d.answer : [];
        answerInputHtml = `
          <div style="display:flex; flex-direction:column; gap:0.25rem;">
            <span style="font-size:0.75rem; color:var(--text-tertiary);">Correct Answers (select all):</span>
            <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
              ${choiceLetters.map(l => `
                <label style="display:flex; align-items:center; gap:0.25rem; cursor:pointer; background:var(--bg-surface); padding:0.25rem 0.5rem; border:1px solid var(--border-color); border-radius:var(--radius-sm); font-size:0.875rem; font-weight:600;">
                  <input type="checkbox" name="ak-cb-${i}" value="${l}" ${checkedArr.includes(l) ? 'checked' : ''} /> ${l}
                </label>
              `).join('')}
            </div>
          </div>
        `;
      } else {
        answerInputHtml = `
          <div style="display:flex; align-items:center; gap:0.5rem; background:var(--bg-surface); border:1px solid var(--border-color); padding:0.25rem 0.5rem; border-radius:var(--radius-sm);">
            <span style="font-size:0.875rem; font-family:var(--font-mono); color:var(--text-secondary);">Answer:</span>
            <input id="ak-ans-${i}" value="${escapeHTML(typeof d.answer === 'string' ? d.answer : '')}" class="form-input" style="flex:1; border:none; background:transparent; padding:0; height:auto; box-shadow:none; font-family:var(--font-mono); text-transform:uppercase;" maxlength="1" />
          </div>
        `;
      }

      return `
      <div class="card-flat" style="padding:1rem; border:1px solid var(--border-color); background:var(--bg-surface-hover);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <h5 style="font-weight:700; font-size:0.875rem; margin:0;">Question ${d.qNum}</h5>
            <span style="font-size:0.6rem; font-weight:700; padding:0.125rem 0.375rem; border-radius:999px; background:${typeBadgeColors[qType]}22; color:${typeBadgeColors[qType]}; border:1px solid ${typeBadgeColors[qType]}44;">${typeLabels[qType]}</span>
          </div>
          <button onclick="removeAnswerKeySample(${i})" class="btn btn-ghost btn-sm" title="Remove" style="padding:0.25rem;">
            <i data-lucide="trash-2" style="width:14px;height:14px;color:var(--color-danger);"></i>
          </button>
        </div>
        <div style="display:flex; flex-direction:column; gap:0.5rem;">
          ${answerInputHtml}
          <div style="display:flex; flex-direction:column; gap:0.25rem;">
            <label style="font-size:0.75rem; color:var(--text-tertiary);">Explanation (Optional)</label>
            <textarea id="ak-exp-${i}" rows="2" class="form-textarea" placeholder="Explanation for this answer..." style="font-size:0.875rem; padding:0.5rem;">${escapeHTML(d.explanation || '')}</textarea>
          </div>
        </div>
      </div>
    `;
    }).join('');
  }

  html += `
        </div>
      </div>

      <div style="flex: 1 1 300px; max-width: 400px; display:flex; flex-direction:column; gap:1rem; min-width: 0; overflow-y: auto; max-height: 60vh;">
        <div class="card-flat" style="padding:1.25rem; border:1px solid var(--border-color);">
          <h4 style="font-weight:700; font-size:0.75rem; color:var(--text-tertiary); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.75rem;">BULK ADD ANSWER KEY</h4>
          <p style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:0.5rem;">Format: '1. A' OR straight text per line (e.g. 'A')</p>
          <textarea id="ak-bulk-input" class="form-textarea" rows="4" placeholder="1. A\n2. B\nOR\nA\nB" style="font-family:var(--font-mono); font-size:0.875rem; margin-bottom:1rem;"></textarea>

          <h4 style="font-weight:700; font-size:0.75rem; color:var(--text-tertiary); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.75rem;">BULK EXPLANATIONS</h4>
          <p style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:0.5rem;">Format: '1. Explanation text' OR straight text per line</p>
          <textarea id="ak-bulk-exp-input" class="form-textarea" rows="4" placeholder="1. Explanation...\n2. Explanation..." style="font-family:var(--font-mono); font-size:0.875rem; margin-bottom:1rem;"></textarea>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;
  lucide.createIcons();
}

// === Given Question Modal Logic ===
let activeGivenQuestionSectionIdx = -1;
let currentGivenQuestionsData = [];

function openGivenQuestionModal(idx) {
  syncAllNotebookSections();
  activeGivenQuestionSectionIdx = idx;
  const sec = notebookAdminState.sections[idx];

  if (!sec.answerKeysData) {
    sec.answerKeysData = [];
  }

  currentGivenQuestionsData = JSON.parse(JSON.stringify(sec.answerKeysData));

  sec.questions.forEach(q => {
    if (!currentGivenQuestionsData.find(d => d.qNum === q)) {
      currentGivenQuestionsData.push({ qNum: q, type: 'mcq', answer: '', explanation: '', question: '', hint: '', choices: {} });
    }
  });
  currentGivenQuestionsData.sort((a, b) => a.qNum - b.qNum);

  document.getElementById('given-question-modal').classList.remove('hidden');
  renderGivenQuestionContent();
}

function closeGivenQuestionModal() {
  document.getElementById('given-question-modal').classList.add('hidden');
  activeGivenQuestionSectionIdx = -1;
  currentGivenQuestionsData = [];
}

function saveGivenQuestionModal() {
  if (activeGivenQuestionSectionIdx === -1) return;
  const sec = notebookAdminState.sections[activeGivenQuestionSectionIdx];

  syncGivenQuestionData();

  // Merge currentGivenQuestionsData into sec.answerKeysData to avoid overwriting answers
  if (!sec.answerKeysData) {
    sec.answerKeysData = [];
  }

  currentGivenQuestionsData.forEach(gq => {
    const existing = sec.answerKeysData.find(d => d.qNum === gq.qNum);
    if (existing) {
      existing.question = gq.question;
      existing.hint = gq.hint;
      existing.type = gq.type || existing.type || 'mcq';
      existing.choices = gq.choices || existing.choices || {};
    } else {
      sec.answerKeysData.push(gq);
    }
  });

  closeGivenQuestionModal();
  renderNotebookSectionsForm();
}

function syncGivenQuestionData() {
  const sec = notebookAdminState.sections[activeGivenQuestionSectionIdx];
  const choiceLetters = Array.from({ length: sec.choices || 4 }, (_, i) => String.fromCharCode(65 + i));

  currentGivenQuestionsData.forEach((d, i) => {
    const qEl = document.getElementById(`gq-text-${i}`);
    const hEl = document.getElementById(`gq-hint-${i}`);
    const tEl = document.getElementById(`gq-type-${i}`);
    if (qEl) d.question = qEl.value;
    if (hEl) d.hint = hEl.value;
    if (tEl) d.type = tEl.value;

    const qType = d.type || 'mcq';
    if (qType === 'mcq' || qType === 'checkbox') {
      if (!d.choices) d.choices = {};
      choiceLetters.forEach(letter => {
        const cEl = document.getElementById(`gq-choice-${i}-${letter}`);
        if (cEl) d.choices[letter] = cEl.value;
      });
    }
  });
}

function changeGivenQuestionType(idx, newType) {
  syncGivenQuestionData();
  currentGivenQuestionsData[idx].type = newType;
  renderGivenQuestionContent();
}

// BUG-22 FIX applied inside this function (mojibake character fix)

/* ----------------------------------------------------------
   NORMALIZE QUESTION BULK TEXT — auto-format pasted input
   ---------------------------------------------------------- */
function normalizeQuestionBulkText(text) {
  if (!text || !text.trim()) return text;

  const lines = text.split('\n');
  const normalized = [];

  for (let line of lines) {
    let l = line.trimEnd(); // preserve leading indent signal but strip trailing spaces
    const trimmed = l.trim();
    if (!trimmed) { normalized.push(''); continue; }

    // ── Question number normalization ──────────────────────────────────────────
    // Handles: "Q1." "Q1)" "Q1:" "1)" "1:" "1-" → "1. "
    let qMatch = trimmed.match(/^[Qq]?(\d+)\s*[\):\-]\s*(.*)$/);
    if (qMatch && !/^[A-Ea-e][\s\)\.\/:\-]/.test(trimmed)) {
      l = qMatch[1] + '. ' + qMatch[2].trim();
      normalized.push(l);
      continue;
    }
    // Already "1. text" — normalize spacing
    let qDotMatch = trimmed.match(/^(\d+)\.\s*(.*)$/);
    if (qDotMatch) {
      l = qDotMatch[1] + '. ' + qDotMatch[2].trim();
      normalized.push(l);
      continue;
    }

    // ── Choice marker normalization ────────────────────────────────────────────
    // Handles: "(A)" "a)" "A)" "a:" "A-" "a." "A." → "A. "
    let cParenMatch = trimmed.match(/^\(([A-Ea-e])\)\s*(.*)$/);
    if (cParenMatch) {
      l = cParenMatch[1].toUpperCase() + '. ' + cParenMatch[2].trim();
      normalized.push(l);
      continue;
    }
    let cMatch = trimmed.match(/^([A-Ea-e])\s*[\):\-\.\s]\s*(.*)$/);
    if (cMatch) {
      l = cMatch[1].toUpperCase() + '. ' + cMatch[2].trim();
      normalized.push(l);
      continue;
    }

    normalized.push(trimmed);
  }

  // Collapse runs of more than one blank line into a single blank
  const deduped = [];
  let prevBlank = false;
  for (const line of normalized) {
    const isBlank = line.trim() === '';
    if (isBlank && prevBlank) continue;
    deduped.push(line);
    prevBlank = isBlank;
  }

  return deduped.join('\n').trim();
}

function bulkAddGivenQuestions() {
  syncGivenQuestionData();
  const sec = notebookAdminState.sections[activeGivenQuestionSectionIdx];
  const choiceLetters = Array.from({ length: sec.choices || 4 }, (_, i) => String.fromCharCode(65 + i));
  const maxChoiceChar = choiceLetters[choiceLetters.length - 1];

  const qInput = document.getElementById('gq-bulk-questions').value.trim();
  const hInput = document.getElementById('gq-bulk-hints').value.trim();
  const cInput = document.getElementById('gq-bulk-choices') ? document.getElementById('gq-bulk-choices').value.trim() : '';

  // Helper: extract inline choices like "A) text B) text C) text" from a string
  function extractInlineChoices(text, maxLetter) {
    const choices = {};
    // Match patterns like A) text, A. text, A] text — capturing sentence-length content
    const regex = /\b([A-Ea-e])[\)\.\/\]]\s*/g;
    const parts = [];
    let m;
    while ((m = regex.exec(text)) !== null) {
      parts.push({ letter: m[1].toUpperCase(), index: m.index });
    }
    if (parts.length < 2) return { cleaned: text, choices: {} }; // Need at least 2 choices to be valid

    // Verify the choices are sequential starting from A
    const firstLetter = parts[0].letter;
    if (firstLetter !== 'A') return { cleaned: text, choices: {} };

    const questionText = text.substring(0, parts[0].index).trim();
    for (let i = 0; i < parts.length; i++) {
      const start = parts[i].index + parts[i].letter.length + 2; // skip "A) "
      const end = i + 1 < parts.length ? parts[i + 1].index : text.length;
      const choiceText = text.substring(start, end).trim();
      if (parts[i].letter <= maxLetter) {
        choices[parts[i].letter] = choiceText;
      }
    }
    return { cleaned: questionText, choices };
  }

  if (qInput) {
    let autoQNum = 1;
    let autoChoices = {};
    let bufferQNum = null;
    let bufferText = '';

    const lines = qInput.split('\n');
    lines.forEach((line, idx) => {
      line = line.trim();
      if (!line) return;

      // Check if line is a standalone choice, e.g. "A. Apple", "A) Apple", "A] Apple"
      const choiceMatch = line.match(/^([A-Ea-e])[\.\)\]]\s*(.*)$/);
      // Also check for bullet points: "- Apple", "• Apple", "* Apple"
      const bulletMatch = !choiceMatch ? line.match(/^[-•*]\s+(.*)$/) : null;

      if (choiceMatch && bufferQNum !== null) {
        const letter = choiceMatch[1].toUpperCase();
        if (letter <= maxChoiceChar) {
          autoChoices[letter] = choiceMatch[2].trim();
          return;
        }
      }
      if (bulletMatch && bufferQNum !== null) {
        const usedLetters = Object.keys(autoChoices);
        const nextLetterIdx = usedLetters.length;
        if (nextLetterIdx < choiceLetters.length) {
          autoChoices[choiceLetters[nextLetterIdx]] = bulletMatch[1].trim();
          return;
        }
      }

      // Check if line starts a new question, e.g. "1. Question"
      // Requires whitespace after separator so IP addresses like 142.59.112.25 are NOT matched as question #142
      const match = line.match(/^(\d+)[.)=:]\s+["']?(.*?)["']?$/);
      let qNum;
      let text;
      let isNewQ = false;

      if (match) {
        qNum = parseInt(match[1]);
        text = match[2].trim();
        autoQNum = qNum + 1;
        isNewQ = true;
      } else if (!choiceMatch) {
        qNum = autoQNum;
        autoQNum++;
        const stripQuotes = line.match(/^["']?(.*?)["']?$/);
        text = stripQuotes ? stripQuotes[1].trim() : line;
        isNewQ = true;
      }

      if (isNewQ) {
        // Save previous question
        if (bufferQNum !== null) {
          // Try to extract inline choices from the buffer text
          const extracted = extractInlineChoices(bufferText, maxChoiceChar);
          if (Object.keys(extracted.choices).length > 0) {
            bufferText = extracted.cleaned;
            autoChoices = { ...autoChoices, ...extracted.choices };
          }
          const existing = currentGivenQuestionsData.find(d => d.qNum === bufferQNum);
          if (existing) {
            existing.question = bufferText;
            existing.choices = { ...existing.choices, ...autoChoices };
          } else {
            currentGivenQuestionsData.push({ qNum: bufferQNum, question: bufferText, hint: '', answer: '', explanation: '', choices: { ...autoChoices } });
          }
        }
        bufferQNum = qNum;
        bufferText = text;
        autoChoices = {};
      } else if (!choiceMatch && bufferQNum !== null) {
        bufferText += '\n' + line;
      }
    });

    // Save the last buffered question
    if (bufferQNum !== null) {
      const extracted = extractInlineChoices(bufferText, maxChoiceChar);
      if (Object.keys(extracted.choices).length > 0) {
        bufferText = extracted.cleaned;
        autoChoices = { ...autoChoices, ...extracted.choices };
      }
      const existing = currentGivenQuestionsData.find(d => d.qNum === bufferQNum);
      if (existing) {
        existing.question = bufferText;
        existing.choices = { ...existing.choices, ...autoChoices };
      } else {
        currentGivenQuestionsData.push({ qNum: bufferQNum, question: bufferText, hint: '', answer: '', explanation: '', choices: { ...autoChoices } });
      }
    }
  }

  if (hInput) {
    let autoQNum = 1;
    hInput.split('\n').forEach(line => {
      line = line.trim();
      if (!line) return;
      const match = line.match(/^(\d+)[.)=:]\s+["']?(.*?)["']?$/);
      let qNum;
      let text;
      if (match) {
        qNum = parseInt(match[1]);
        text = match[2].trim();
        autoQNum = qNum + 1;
      } else {
        qNum = autoQNum;
        autoQNum++;
        const stripQuotes = line.match(/^["']?(.*?)["']?$/);
        text = stripQuotes ? stripQuotes[1].trim() : line;
      }
      const existing = currentGivenQuestionsData.find(d => d.qNum === qNum);
      if (existing) {
        existing.hint = text;
      } else {
        currentGivenQuestionsData.push({ qNum: qNum, question: '', hint: text, answer: '', explanation: '', choices: {} });
      }
    });
  }

  if (cInput) {
    let autoQNum = 1;
    let autoChoices = {};
    let bufferQNum = null;

    const lines = cInput.split('\n');
    lines.forEach((line, idx) => {
      line = line.trim();
      if (!line) return;

      const qMatch = line.match(/^(\d+)[.=:\s]*$/); // "1." or "1" alone on a line? Or assume unnumbered

      const match = line.match(/^(\d+)[.=:\s]+(.*)$/);
      if (qMatch) {
        if (bufferQNum !== null) {
          const existing = currentGivenQuestionsData.find(d => d.qNum === bufferQNum);
          if (existing) { existing.choices = { ...existing.choices, ...autoChoices }; }
          else { currentGivenQuestionsData.push({ qNum: bufferQNum, question: '', hint: '', answer: '', explanation: '', choices: { ...autoChoices } }); }
        }
        bufferQNum = parseInt(qMatch[1]);
        autoChoices = {};
        return;
      }

      if (match) {
        if (bufferQNum !== null) {
          const existing = currentGivenQuestionsData.find(d => d.qNum === bufferQNum);
          if (existing) { existing.choices = { ...existing.choices, ...autoChoices }; }
          else { currentGivenQuestionsData.push({ qNum: bufferQNum, question: '', hint: '', answer: '', explanation: '', choices: { ...autoChoices } }); }
        }
        bufferQNum = parseInt(match[1]);
        autoChoices = {};

        // Is there a choice on this same line?
        const choiceMatch = match[2].match(/^([A-Ea-e])[\.\)\]]\s*(.*)$/);
        if (choiceMatch) {
          const letter = choiceMatch[1].toUpperCase();
          if (letter <= maxChoiceChar) autoChoices[letter] = choiceMatch[2].trim();
        }
        return;
      }

      const choiceMatch = line.match(/^([A-Ea-e])[\.\)\]]\s*(.*)$/);
      const bulletMatch = !choiceMatch ? line.match(/^[-•*]\s+(.*)$/) : null;
      if (choiceMatch) {
        if (bufferQNum === null) {
          bufferQNum = autoQNum;
          autoQNum++;
        }
        const letter = choiceMatch[1].toUpperCase();
        if (letter <= maxChoiceChar) {
          autoChoices[letter] = choiceMatch[2].trim();
        }

        // If we hit the max choice, auto-increment for next implicit block
        if (letter === maxChoiceChar) {
          const existing = currentGivenQuestionsData.find(d => d.qNum === bufferQNum);
          if (existing) { existing.choices = { ...existing.choices, ...autoChoices }; }
          else { currentGivenQuestionsData.push({ qNum: bufferQNum, question: '', hint: '', answer: '', explanation: '', choices: { ...autoChoices } }); }
          bufferQNum = null;
          autoChoices = {};
        }
      } else if (bulletMatch) {
        if (bufferQNum === null) {
          bufferQNum = autoQNum;
          autoQNum++;
        }
        const usedLetters = Object.keys(autoChoices);
        const nextIdx = usedLetters.length;
        if (nextIdx < choiceLetters.length) {
          autoChoices[choiceLetters[nextIdx]] = bulletMatch[1].trim();
        }
        // If we hit the max choice count, auto-increment
        if (Object.keys(autoChoices).length >= choiceLetters.length) {
          const existing = currentGivenQuestionsData.find(d => d.qNum === bufferQNum);
          if (existing) { existing.choices = { ...existing.choices, ...autoChoices }; }
          else { currentGivenQuestionsData.push({ qNum: bufferQNum, question: '', hint: '', answer: '', explanation: '', choices: { ...autoChoices } }); }
          bufferQNum = null;
          autoChoices = {};
        }
      }
    });

    if (bufferQNum !== null && Object.keys(autoChoices).length > 0) {
      const existing = currentGivenQuestionsData.find(d => d.qNum === bufferQNum);
      if (existing) { existing.choices = { ...existing.choices, ...autoChoices }; }
      else { currentGivenQuestionsData.push({ qNum: bufferQNum, question: '', hint: '', answer: '', explanation: '', choices: { ...autoChoices } }); }
    }
  }

  currentGivenQuestionsData.sort((a, b) => a.qNum - b.qNum);

  // ── Step 1: Auto-format the textarea with the normalized text ──────────────
  const qTextarea = document.getElementById('gq-bulk-questions');
  if (qTextarea && qInput) {
    qTextarea.value = normalizeQuestionBulkText(qInput);
  }

  renderGivenQuestionContent();

  // ── Step 2: Report missing choices ────────────────────────────────────────
  const expectedChoiceCount = sec.choices || 4;
  const choiceLettersAll = Array.from({ length: expectedChoiceCount }, (_, i) => String.fromCharCode(65 + i));
  const missing = [];
  const incomplete = [];

  currentGivenQuestionsData.forEach(d => {
    const qType = d.type || 'mcq';
    if (qType === 'text') return; // text questions don't need choices
    const filled = choiceLettersAll.filter(l => d.choices && d.choices[l] && d.choices[l].trim() !== '');
    if (filled.length === 0) {
      missing.push(d.qNum);
    } else if (filled.length < expectedChoiceCount) {
      incomplete.push({ qNum: d.qNum, have: filled.length, need: expectedChoiceCount, letters: choiceLettersAll.filter(l => !filled.includes(l)) });
    }
  });

  if (missing.length === 0 && incomplete.length === 0) {
    // All good — show a brief success toast if showShareToast is available
    if (typeof showShareToast === 'function') {
      showShareToast(`✓ Parsed ${currentGivenQuestionsData.length} question(s) — all choices present.`);
    }
    return;
  }

  // Build a readable report
  let report = '';
  if (missing.length > 0) {
    report += `<p style="margin-bottom:0.75rem;"><strong style="color:var(--color-danger);">⚠ No choices found for ${missing.length} question(s):</strong><br/>`;
    report += `Questions: ${missing.map(n => '#' + n).join(', ')}</p>`;
  }
  if (incomplete.length > 0) {
    report += `<p style="margin-bottom:0.75rem;"><strong style="color:var(--color-warning);">⚠ Incomplete choices for ${incomplete.length} question(s):</strong></p>`;
    report += '<ul style="font-size:0.85rem; margin:0; padding-left:1.25rem;">';
    incomplete.forEach(({ qNum, have, need, letters }) => {
      report += `<li>Q${qNum}: has ${have}/${need} choices — missing: <strong>${letters.join(', ')}</strong></li>`;
    });
    report += '</ul>';
  }
  report += `<p style="margin-top:0.75rem; font-size:0.8rem; color:var(--text-tertiary);">You can add missing choices manually in the left panel or re-paste with the Bulk Add Choices box.</p>`;

  const dialogIcon = document.getElementById('dialog-icon');
  const dialogTitle = document.getElementById('dialog-title');
  const dialogMsg = document.getElementById('dialog-msg');
  const dialogActions = document.getElementById('dialog-actions');
  const modal = document.getElementById('dialog-modal');

  if (dialogIcon) dialogIcon.innerHTML = '<i data-lucide="alert-triangle" style="width:48px;height:48px;color:var(--color-warning);"></i>';
  if (dialogTitle) dialogTitle.textContent = 'Missing Choices Detected';
  if (dialogMsg) dialogMsg.innerHTML = report;
  if (dialogActions) dialogActions.innerHTML = '<button onclick="document.getElementById(\'dialog-modal\').classList.add(\'hidden\')" class="btn btn-primary" style="width:100%;">Understood</button>';
  if (modal) {
    modal.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
}

function renderGivenQuestionContent() {
  const container = document.getElementById('given-question-content');
  const sec = notebookAdminState.sections[activeGivenQuestionSectionIdx];
  const choiceLetters = Array.from({ length: sec.choices || 4 }, (_, i) => String.fromCharCode(65 + i));

  let html = `
    <div style="display: flex; gap: 2rem; height: 100%; flex-wrap: wrap;">
      <div style="flex: 1 1 500px; display:flex; flex-direction:column; min-width: 0; overflow-y: auto; max-height: 60vh;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
          <h4 style="font-weight:700; font-size:0.75rem; color:var(--text-tertiary); text-transform:uppercase; letter-spacing:0.05em; margin:0;">GIVEN QUESTIONS</h4>
        </div>

        <div style="display:flex; flex-direction:column; gap:1rem; margin-bottom:2rem;">
  `;

  if (currentGivenQuestionsData.length === 0) {
    html += '<p style="color:var(--text-tertiary); font-size:0.875rem;">No questions added yet.</p>';
  } else {
    html += currentGivenQuestionsData.map((d, i) => {
      const qType = d.type || 'mcq';
      const showChoices = qType === 'mcq' || qType === 'checkbox';
      let choicesHtml = '';
      if (showChoices) {
        choicesHtml = choiceLetters.map(letter => {
          let val = d.choices && d.choices[letter] ? escapeHTML(d.choices[letter]) : '';
          return `
            <div style="display:flex; align-items:center; gap:0.5rem;">
              <span style="font-size:0.75rem; font-weight:700; color:var(--text-tertiary); width:15px;">${letter}.</span>
              <input id="gq-choice-${i}-${letter}" class="form-input" style="flex:1; padding:0.25rem 0.5rem; font-size:0.875rem; height:auto;" placeholder="Choice ${letter}..." value="${val}" />
            </div>
          `;
        }).join('');
      }

      const typeBadgeColors = { mcq: 'var(--color-primary)', checkbox: 'var(--color-success)', text: 'var(--color-warning)' };

      return `
        <div class="card-flat" style="padding:1rem; border:1px solid var(--border-color); background:var(--bg-surface-hover);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
            <h5 style="font-weight:700; font-size:0.875rem; margin:0;">Question ${d.qNum}</h5>
            <select id="gq-type-${i}" class="form-select" style="width:auto; padding:0.2rem 0.5rem; font-size:0.75rem; height:auto; border-color:${typeBadgeColors[qType] || 'var(--border-color)'}; color:${typeBadgeColors[qType] || 'inherit'};" onchange="changeGivenQuestionType(${i}, this.value)">
              <option value="mcq" ${qType === 'mcq' ? 'selected' : ''}>MCQ (Single)</option>
              <option value="checkbox" ${qType === 'checkbox' ? 'selected' : ''}>Checkbox (Multi)</option>
              <option value="text" ${qType === 'text' ? 'selected' : ''}>Text Input</option>
            </select>
          </div>
          <div style="display:flex; flex-direction:column; gap:0.5rem;">
            <div style="display:flex; flex-direction:column; gap:0.25rem;">
              <label style="font-size:0.75rem; color:var(--text-tertiary);">Given Question</label>
              <textarea id="gq-text-${i}" rows="2" class="form-textarea" placeholder="Question text..." style="font-size:0.875rem; padding:0.5rem;">${escapeHTML(d.question || '')}</textarea>
            </div>

            ${showChoices ? `
            <div style="display:flex; flex-direction:column; gap:0.25rem; margin-top:0.5rem; background:var(--bg-surface); padding:0.75rem; border-radius:var(--radius-sm); border:1px solid var(--border-color);">
              <label style="font-size:0.75rem; color:var(--text-tertiary);">${qType === 'checkbox' ? 'Checkbox Choices' : 'MCQ Choices'}</label>
              <div style="display:flex; flex-direction:column; gap:0.375rem;">
                ${choicesHtml}
              </div>
            </div>
            ` : `
            <div style="background:var(--bg-surface); padding:0.75rem; border-radius:var(--radius-sm); border:1px solid var(--border-color); margin-top:0.5rem;">
              <p style="font-size:0.75rem; color:var(--text-tertiary); margin:0;">Text input — no choices needed. Set the correct answer text in Answer Key.</p>
            </div>
            `}

            <div style="display:flex; flex-direction:column; gap:0.25rem; margin-top:0.5rem;">
              <label style="font-size:0.75rem; color:var(--text-tertiary);">Hint (Optional)</label>
              <textarea id="gq-hint-${i}" rows="2" class="form-textarea" placeholder="Hint for this question..." style="font-size:0.875rem; padding:0.5rem;">${escapeHTML(d.hint || '')}</textarea>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  html += `
        </div>
      </div>

      <div style="flex: 1 1 300px; max-width: 400px; display:flex; flex-direction:column; gap:1rem; min-width: 0; overflow-y: auto; max-height: 60vh;">
        <div class="card-flat" style="padding:1.25rem; border:1px solid var(--border-color);">
          <h4 style="font-weight:700; font-size:0.75rem; color:var(--text-tertiary); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.75rem;">BULK ADD GIVEN QUESTION</h4>
          <p style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:0.5rem;">Format: 1. "Question text"<br/>(Choices A. B. appended below will be automatically parsed)</p>
          <textarea id="gq-bulk-questions" class="form-textarea" rows="4" placeholder="1. What is 1+1?\nA. 1\nB. 2" style="font-family:var(--font-mono); font-size:0.875rem; margin-bottom:1rem;"></textarea>

          <h4 style="font-weight:700; font-size:0.75rem; color:var(--text-tertiary); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.75rem;">BULK ADD CHOICES</h4>
          <p style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:0.5rem;">Format: A. Apple<br/>(Implicitly assigns to next empty question block, or specify 1. first)</p>
          <textarea id="gq-bulk-choices" class="form-textarea" rows="4" placeholder="1.\nA. Apple\nB. Banana\n2.\nA. Cat\nB. Dog" style="font-family:var(--font-mono); font-size:0.875rem; margin-bottom:1rem;"></textarea>

          <h4 style="font-weight:700; font-size:0.75rem; color:var(--text-tertiary); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.75rem;">HINTS</h4>
          <p style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:0.5rem;">Format: 1. "Hint text"</p>
          <textarea id="gq-bulk-hints" class="form-textarea" rows="3" placeholder="1. Think about addition." style="font-family:var(--font-mono); font-size:0.875rem; margin-bottom:0.75rem;"></textarea>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;
  lucide.createIcons();
}
