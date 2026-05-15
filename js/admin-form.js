/* ============================================================
   ADMIN-FORM.JS — Challenge Form Open/Close/Save/Tags
   ============================================================ */

function openAdminForm(id) {
  if (window.currentAdminMode === 'study') return openStudyForm(id);

  // Hide Empty State, Show Form
  const emptyState = document.getElementById('admin-empty-state');
  if (emptyState) emptyState.classList.add('hidden');
  const formContainer = document.getElementById('admin-form-container');
  if (formContainer) {
    formContainer.classList.remove('hidden');
    if (formContainer.parentElement) formContainer.parentElement.scrollTop = 0;
  }

  window.adminIsDirty = false;
  window.saveCurrentAdminForm = saveAdminForm;
  setSaveStatus('admin-save-status', '');

  // Build folder picker for admin form
  const catSelect = document.getElementById('admin-category');
  const fpOpts = [];
  function buildFP(pid, d) {
    getChildFolders(pid, 'challenge').forEach(f => {
      fpOpts.push({ id: f.id, label: '  '.repeat(d) + f.name });
      buildFP(f.id, d + 1);
    });
  }
  buildFP(null, 0);
  catSelect.innerHTML = `<option value="">Uncategorized</option>` + fpOpts.map(f => `<option value="${escapeHTML(f.id)}">${escapeHTML(f.label)}</option>`).join('');

  const c = id !== 'new' ? state.challenges.find(ch => ch.id === id) : null;

  if (id === 'new' || !c) {
    const firstFolder = state.nodes.find(n => n.type === 'folder' && n.scope === 'challenge');
    adminState = {
      id: id === 'new' ? 'new' : id,
      title: '', parentId: firstFolder ? firstFolder.id : null, coverDescription: '',
      tags: [],
      variants: [{ id: generateId(), name: 'Version 1', description: '', starterCode: '', code: '', samples: [] }],
      activeVariantIndex: 0
    };
  } else {
    adminState = JSON.parse(JSON.stringify(c));
    if (!adminState.tags) adminState.tags = [];
    if (!adminState.variants || adminState.variants.length === 0) {
      adminState.variants = [{ id: generateId(), name: 'Version 1', description: '', starterCode: '', code: '', samples: [] }];
    } else {
      adminState.variants.forEach(v => {
        if (!v.description) v.description = '';
        if (!v.starterCode) v.starterCode = '';
        if (!v.code) v.code = '';
        if (!v.samples) v.samples = [];
      });
    }
    adminState.activeVariantIndex = 0;
  }

  // Ensure all variants have a files[] (migration guard)
  adminState.variants.forEach(v => {
    if (!v.files || v.files.length === 0) {
      v.files = [{ id: generateId(), name: 'main', ext: '.c', starterCode: v.starterCode || '', code: v.code || '' }];
    }
    v.activeFileIndex = 0;
  });

  document.getElementById('admin-form-title').innerText = id === 'new' ? 'Create Program' : 'Edit Program';
  document.getElementById('admin-title').value = adminState.title;
  document.getElementById('admin-category').value = adminState.parentId || '';
  document.getElementById('admin-cover-desc').value = adminState.coverDescription || '';
  document.getElementById('admin-tag-input').value = '';

  // Render custom category dropdown
  if (typeof renderCustomSelect === 'function') {
    const _fpOpts2 = [{ value: '', label: 'Uncategorized', icon: 'inbox' }].concat(
      fpOpts.map(f => ({ value: f.id, label: f.label.trim(), icon: 'folder' }))
    );
    renderCustomSelect('admin-category-cs', _fpOpts2, adminState.parentId || '', (val) => {
      adminState.parentId = val || null;
      document.getElementById('admin-category').value = val;
      window.adminIsDirty = true;
      setSaveStatus('admin-save-status', 'unsaved');
    }, 'Select category...');
  }

  renderAdminTags();
  renderTagSuggestions('admin', 'challenge');
  renderAdminVariantForm();

  if (id === 'new') {
    setTimeout(() => document.getElementById('admin-title')?.focus(), 60);
  }
}

function closeAdminForm() {
  const el = document.getElementById('admin-form-container');
  if (el) el.classList.add('hidden');

  // Also close visualization modal if it exists
  const vizModal = document.getElementById('viz-admin-modal');
  if (vizModal) vizModal.classList.add('hidden');

  // Show Empty State
  const emptyState = document.getElementById('admin-empty-state');
  if (emptyState) emptyState.classList.remove('hidden');

  adminState = null;
}

function renderAdminTags() {
  if (!adminState) return;
  const container = document.getElementById('admin-tags-list');
  if (!container) return;
  container.innerHTML = adminState.tags.map((t, idx) => `
    <span class="tag">
      ${escapeHTML(t)}
      <button onclick="removeAdminTag(${idx})" title="Remove tag" aria-label="Remove tag ${escapeHTML(t)}"><i data-lucide="x" style="width:12px;height:12px;"></i></button>
    </span>
  `).join('');
  lucide.createIcons({ el: container });
}

function handleAdminTagKeydown(ev) {
  if (ev.key === 'Enter') { ev.preventDefault(); addAdminTag(); return; }
  if (ev.key === ',') { ev.preventDefault(); addAdminTag(); return; }
  if (ev.key === 'Backspace' && !ev.target.value && adminState && adminState.tags.length > 0) {
    ev.preventDefault();
    adminState.tags.pop();
    renderAdminTags();
  }
}

function addAdminTag() {
  const input = document.getElementById('admin-tag-input');
  if (!input) return;
  const raw = input.value.trim();
  if (!raw) return;
  raw.split(',').map(v => v.trim()).filter(v => v).forEach(val => {
    if (adminState && !adminState.tags.includes(val)) {
      adminState.tags.push(val);
    }
  });
  input.value = '';
  renderAdminTags();
  renderTagSuggestions('admin', 'challenge');
  window.adminIsDirty = true;
  setSaveStatus('admin-save-status', 'unsaved');
}

function removeAdminTag(idx) {
  if (!adminState) return;
  adminState.tags.splice(idx, 1);
  renderAdminTags();
  renderTagSuggestions('admin', 'challenge');
  window.adminIsDirty = true;
  setSaveStatus('admin-save-status', 'unsaved');
}

function saveAdminForm(opts = {}) {
  // Sync DOM fields back to state before saving
  const titleEl = document.getElementById('admin-title');
  const catEl = document.getElementById('admin-category');
  const coverDescEl = document.getElementById('admin-cover-desc');
  if (titleEl) adminState.title = titleEl.value;
  if (catEl) adminState.parentId = catEl.value || null;
  if (coverDescEl) adminState.coverDescription = coverDescEl.value;

  const title = adminState.title.trim();
  if (!title) {
    showValidationError(titleEl, "Program Title is required.");
    if (!opts.silent) showMessage("Error", "Program Title is required.", true);
    return false;
  }

  let isValid = true;
  let firstInvalidVariantIdx = -1;
  adminState.variants.forEach((v, vi) => {
    if (!v.name.trim()) { isValid = false; if (firstInvalidVariantIdx === -1) firstInvalidVariantIdx = vi; return; }
    if (v.files && v.files.length > 0) {
      v.code = v.files[0].code || '';
      v.starterCode = v.files[0].starterCode || '';
    }
    const hasCode = v.files ? v.files.some(f => f.code.trim()) : v.code.trim();
    if (!hasCode) { isValid = false; if (firstInvalidVariantIdx === -1) firstInvalidVariantIdx = vi; }
  });

  if (!isValid) {
    if (firstInvalidVariantIdx >= 0 && adminState.activeVariantIndex !== firstInvalidVariantIdx) {
      adminState.activeVariantIndex = firstInvalidVariantIdx;
      if (typeof renderAdminVariantForm === 'function') renderAdminVariantForm();
    }
    if (!opts.silent) showMessage("Error", "All versions must have a name and at least one file with target code.", true);
    return false;
  }

  const { activeVariantIndex, ...toSave } = adminState;

  if (toSave.id === 'new') {
    toSave.id = generateId();
    state.challenges.push(toSave);
  } else {
    const exists = state.challenges.some(c => c.id === toSave.id);
    if (!exists) {
      state.challenges.push(toSave);
    } else {
      state.challenges = state.challenges.map(c => c.id === toSave.id ? toSave : c);
    }
  }

  saveData();
  setSaveStatus('admin-save-status', 'saved');
  if (opts.silent) {
    // Keep form open for autosave/silent saves
    window.adminIsDirty = false;
  } else {
    closeAdminForm();
    renderAdmin();
    window.adminIsDirty = false;
    showMessage("Success", "Program saved successfully.");
  }
  return true;
}

function deleteChallenge(id) {
  showConfirm("Delete Challenge", "Are you sure you want to delete this challenge program?", () => {
    state.challenges = state.challenges.filter(c => c.id !== id);
    if (adminState && adminState.id === id) closeAdminForm();
    saveData();
    renderAdmin();
  });
}

/* ============================================================
   SHARED HELPERS (used by all admin forms)
   ============================================================ */

// Save status indicator (text in form header)
function setSaveStatus(elId, status) {
  const el = document.getElementById(elId);
  if (!el) return;
  const map = {
    unsaved: { txt: 'Unsaved changes', cls: 'af-save-unsaved', icon: 'circle' },
    saving: { txt: 'Saving...', cls: 'af-save-saving', icon: 'loader' },
    saved: { txt: 'Saved', cls: 'af-save-saved', icon: 'check-circle' },
    '': { txt: '', cls: '', icon: '' }
  };
  const s = map[status] || map[''];
  el.className = 'af-save-status ' + s.cls;
  el.innerHTML = s.txt ? `<i data-lucide="${s.icon}" style="width:12px;height:12px;"></i> ${s.txt}` : '';
  if (typeof lucide !== 'undefined' && s.icon) lucide.createIcons({ el });
  if (status === 'saved') {
    setTimeout(() => {
      if (el.classList.contains('af-save-saved')) setSaveStatus(elId, '');
    }, 2200);
  }
}

// Tag suggestion list (frequent tags from existing items in scope)
function getTopTags(scope, limit) {
  const items = scope === 'challenge' ? (state.challenges || [])
               : scope === 'snippet' ? (state.snippets || [])
               : scope === 'notebook' ? (state.notebooks || [])
               : [];
  const counts = new Map();
  items.forEach(it => (it.tags || []).forEach(t => counts.set(t, (counts.get(t) || 0) + 1)));
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit || 8).map(([t]) => t);
}

function renderTagSuggestions(prefix, scope) {
  const container = document.getElementById(prefix + '-tag-suggestions');
  if (!container) return;
  const currentTags = (prefix === 'admin' ? adminState : prefix === 'study' ? studyModeState : notebookAdminState);
  if (!currentTags) { container.innerHTML = ''; return; }
  const existing = new Set(currentTags.tags || []);
  const suggestions = getTopTags(scope, 12).filter(t => !existing.has(t));
  if (suggestions.length === 0) { container.innerHTML = ''; return; }
  container.innerHTML = `<div class="af-tag-suggest-label">Quick add:</div>` + suggestions.map(t => `
    <button type="button" class="af-tag-suggest" onclick="addTagSuggestion('${prefix}', '${escapeHTML(t).replace(/'/g, "\\'")}')">${escapeHTML(t)}</button>
  `).join('');
}

function addTagSuggestion(prefix, tag) {
  const target = prefix === 'admin' ? adminState : prefix === 'study' ? studyModeState : notebookAdminState;
  if (!target) return;
  if (!target.tags) target.tags = [];
  if (!target.tags.includes(tag)) target.tags.push(tag);
  if (prefix === 'admin') {
    renderAdminTags(); renderTagSuggestions('admin', 'challenge');
    setSaveStatus('admin-save-status', 'unsaved');
  } else if (prefix === 'study') {
    renderStudyTags(); renderTagSuggestions('study', 'snippet');
    setSaveStatus('study-save-status', 'unsaved');
  } else if (prefix === 'notebook') {
    renderNotebookTags(); renderTagSuggestions('notebook', 'notebook');
    setSaveStatus('notebook-save-status', 'unsaved');
  }
  window.adminIsDirty = true;
}

// Visual validation error: shake + focus + scroll
function showValidationError(el, msg) {
  if (!el) return;
  el.classList.remove('error');
  void el.offsetWidth; // restart animation
  el.classList.add('error');
  setTimeout(() => el.classList.remove('error'), 1000);
  try { el.focus({ preventScroll: false }); } catch (e) { el.focus(); }
  try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
}

/* ============================================================
   KEYBOARD SHORTCUTS (Admin-wide)
   ============================================================ */
let _adminKeyHandler = null;

function bindAdminKeyboardShortcuts() {
  if (_adminKeyHandler) document.removeEventListener('keydown', _adminKeyHandler);
  _adminKeyHandler = function(e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) {
      // Allow Ctrl+S in form fields
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (typeof window.saveCurrentAdminForm === 'function') {
          window.saveCurrentAdminForm({ silent: true });
        }
      }
      // Allow Esc to blur first, second Esc to close form
      if (e.key === 'Escape') {
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (typeof window.saveCurrentAdminForm === 'function') {
        window.saveCurrentAdminForm({ silent: true });
      }
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      if (typeof openNewAdminItem === 'function') openNewAdminItem();
    } else if (e.key === 'Escape') {
      // Close whichever form is open
      const adminFrm = document.getElementById('admin-form-container');
      const studyFrm = document.getElementById('study-form-container');
      const nbFrm = document.getElementById('notebook-form-container');
      if (adminFrm && !adminFrm.classList.contains('hidden') && typeof closeAdminForm === 'function') closeAdminForm();
      else if (studyFrm && !studyFrm.classList.contains('hidden') && typeof closeStudyForm === 'function') closeStudyForm();
      else if (nbFrm && !nbFrm.classList.contains('hidden') && typeof closeNotebookForm === 'function') closeNotebookForm();
    }
  };
  document.addEventListener('keydown', _adminKeyHandler);
}

function unbindAdminKeyboardShortcuts() {
  if (_adminKeyHandler) {
    document.removeEventListener('keydown', _adminKeyHandler);
    _adminKeyHandler = null;
  }
}
