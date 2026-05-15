/* ============================================================
   ADMIN-VARIANTS.JS — Variant Tabs, File Tabs, Editors, Samples
   ============================================================ */

function renderAdminVariantForm() {
  if (!adminState || !adminState.variants) return;

  const tabsContainer = document.getElementById('admin-variant-tabs');
  tabsContainer.innerHTML = adminState.variants.map((v, i) => `
    <div onclick="switchAdminVariant(${i})" class="variant-tab ${i === adminState.activeVariantIndex ? 'active' : ''}">
      ${escapeHTML(v.name || 'Unnamed')}
      ${adminState.variants.length > 1 ? `<span onclick="event.stopPropagation(); deleteAdminVariant(${i})" class="variant-tab-close"><i data-lucide="x" style="width:12px;height:12px;"></i></span>` : ''}
    </div>
  `).join('');

  const activeVar = adminState.variants[adminState.activeVariantIndex];
  if (!activeVar.files || activeVar.files.length === 0) {
    activeVar.files = [{ id: generateId(), name: 'main', ext: '.c', starterCode: activeVar.starterCode || '', code: activeVar.code || '' }];
  }
  if (typeof activeVar.activeFileIndex !== 'number') activeVar.activeFileIndex = 0;
  const activeFile = activeVar.files[activeVar.activeFileIndex];

  function fileTabsHTML(prefix, actionAdd) {
    return `<div class="file-tab-bar">
      ${activeVar.files.map((f, fi) => `
        <div class="file-tab ${fi === activeVar.activeFileIndex ? 'active' : ''}" onclick="adminSwitchFile(${fi})">
          <span class="file-tab-name">${escapeHTML(f.name + f.ext)}</span>
          ${activeVar.files.length > 1 ? `<span class="file-tab-x" onclick="event.stopPropagation(); adminDeleteFile(${fi})">×</span>` : ''}
        </div>
      `).join('')}
      <button class="file-tab-add" onclick="adminAddFile()" title="Add File"><i data-lucide="plus" style="width:13px;height:13px;"></i></button>
    </div>`;
  }

  const contentContainer = document.getElementById('admin-variant-content');

  contentContainer.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:1rem;">
      <div>
        <label class="form-label">Version Name</label>
        <input value="${escapeHTML(activeVar.name)}" oninput="updateActiveVariantField('name', this.value)" class="form-input" />
      </div>
      <div>
        <label class="form-label-inline"><span>Instruction / Description</span></label>
        <textarea rows="3" oninput="updateActiveVariantField('description', this.value)" class="form-textarea">${escapeHTML(activeVar.description || '')}</textarea>
      </div>

      <div style="display:flex; flex-direction:column; flex:1; min-height:220px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
          <label class="form-label" style="color:var(--color-accent); margin-bottom:0;">Starter Code <span style="font-weight:400; font-size:0.75rem; opacity:0.7;">(pre-filled for user)</span></label>
        </div>
        ${fileTabsHTML('starter')}
        <div class="editor-container" style="flex:1; border-color:var(--color-accent); border-top:none; border-radius:0 0 var(--radius-md) var(--radius-md);">
          <pre id="admin-starter-pre" class="editor-pre"><code id="admin-starter-code"></code></pre>
          <textarea id="admin-starter-ta" spellcheck="false" class="editor-textarea" placeholder="// Add starter boilerplate here..."></textarea>
        </div>
      </div>

      <div style="display:flex; flex-direction:column; flex:1; min-height:240px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
          <label class="form-label" style="color:var(--color-success); margin-bottom:0;">Target Code <span style="font-weight:400; font-size:0.75rem; opacity:0.7;">(hidden solution)</span></label>
        </div>
        ${fileTabsHTML('target')}
        <div class="editor-container" style="flex:1; border-color:var(--color-success); border-top:none; border-radius:0 0 var(--radius-md) var(--radius-md);">
          <pre id="admin-target-pre" class="editor-pre"><code id="admin-target-code"></code></pre>
          <textarea id="admin-target-ta" spellcheck="false" class="editor-textarea" placeholder="// Target code for this file..."></textarea>
        </div>
      </div>

      <div class="divider"></div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
        <label class="form-label" style="margin-bottom:0;">Sample Outputs</label>
        <button onclick="addAdminSample()" class="btn btn-ghost btn-sm" style="color:var(--color-primary); font-weight:600;">
          <i data-lucide="plus-circle" style="width:14px;height:14px;"></i> Add Sample
        </button>
      </div>
      <div id="admin-samples-list" style="display:flex; flex-direction:column; gap:0.75rem;">
        ${activeVar.samples.map((s, sampleIdx) => `
          <div class="sample-item">
            <div style="flex:1; display:flex; flex-direction:column; gap:0.5rem;">
              <input value="${escapeHTML(s.title || '')}" oninput="updateSampleField(${sampleIdx}, 'title', this.value)" placeholder="Sample Title" class="form-input" style="font-weight:600; font-size:0.8125rem; padding:0.375rem 0.5rem;" />
              <textarea rows="2" oninput="updateSampleField(${sampleIdx}, 'content', this.value)" placeholder="Sample content..." class="form-textarea" style="font-family:var(--font-mono); font-size:0.75rem; min-height:40px; padding:0.375rem 0.5rem;">${escapeHTML(s.content || '')}</textarea>
            </div>
            <button onclick="deleteAdminSample(${sampleIdx})" class="btn btn-ghost" style="padding:0.25rem;" title="Delete Sample">
              <i data-lucide="trash-2" style="width:16px;height:16px;color:var(--color-danger);"></i>
            </button>
          </div>
        `).join('') + (activeVar.samples.length === 0 ? '<p style="font-size:0.75rem; color:var(--text-tertiary); font-style:italic;">No samples added.</p>' : '')}
      </div>
    </div>
  `;

  // Initialize Starter Code Editor for active file
  const starterTA = document.getElementById('admin-starter-ta');
  const starterPre = document.getElementById('admin-starter-code');
  starterTA.value = activeFile.starterCode || '';
  starterPre.innerHTML = syntaxHighlight(activeFile.starterCode || '') + '<br/>';
  starterTA.oninput = function() {
    activeFile.starterCode = this.value;
    starterPre.innerHTML = syntaxHighlight(this.value) + '<br/>';
    // Keep legacy field in sync with first file
    if (activeVar.activeFileIndex === 0) activeVar.starterCode = this.value;
  };
  if (typeof setupSpecificEditor === 'function') {
    setupSpecificEditor('admin-starter-ta', 'admin-starter-pre', 'admin-starter-code', false, null);
  }

  // Initialize Target Code Editor for active file
  const targetTA = document.getElementById('admin-target-ta');
  const targetPre = document.getElementById('admin-target-code');
  targetTA.value = activeFile.code || '';
  targetPre.innerHTML = syntaxHighlight(activeFile.code || '') + '<br/>';
  targetTA.oninput = function() {
    activeFile.code = this.value;
    targetPre.innerHTML = syntaxHighlight(this.value) + '<br/>';
    // Keep legacy field in sync with first file
    if (activeVar.activeFileIndex === 0) activeVar.code = this.value;
  };
  if (typeof setupSpecificEditor === 'function') {
    setupSpecificEditor('admin-target-ta', 'admin-target-pre', 'admin-target-code', false, null);
  }

  lucide.createIcons();
}

function switchAdminVariant(idx) {
  adminState.activeVariantIndex = idx;
  renderAdminVariantForm();
}

function addAdminVariant() {
  const vLen = adminState.variants.length + 1;
  adminState.variants.push({
    id: generateId(),
    name: `Version ${vLen}`,
    description: '',
    starterCode: '',
    code: '',
    activeFileIndex: 0,
    files: [{ id: generateId(), name: 'main', ext: '.c', starterCode: '', code: '' }],
    samples: []
  });
  adminState.activeVariantIndex = adminState.variants.length - 1;
  renderAdminVariantForm();
}

function adminSwitchFile(fi) {
  const v = adminState.variants[adminState.activeVariantIndex];
  v.activeFileIndex = fi;
  renderAdminVariantForm();
}

function adminAddFile() {
  const v = adminState.variants[adminState.activeVariantIndex];
  // Prompt for filename + extension
  let overlay = document.getElementById('admin-add-file-overlay');
  if (overlay) overlay.remove();
  overlay = document.createElement('div');
  overlay.id = 'admin-add-file-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';
  overlay.innerHTML = `
    <div style="background:var(--bg-elevated);border:1px solid var(--border-color);border-radius:var(--radius-lg);padding:1.75rem;width:360px;box-shadow:0 20px 40px rgba(0,0,0,0.4);">
      <h3 style="font-weight:700;margin-bottom:1rem;display:flex;align-items:center;gap:0.5rem;">
        <i data-lucide="file-plus" style="width:18px;height:18px;color:var(--color-primary);"></i> Add File
      </h3>
      <div style="display:flex;gap:0.5rem;margin-bottom:0.75rem;">
        <input id="aaf-name" class="form-input" placeholder="Filename (e.g. utils)" style="flex:1;" />
        <select id="aaf-ext" class="form-select" style="width:90px;">
          <option value=".c">.c</option>
          <option value=".h">.h</option>
          <option value=".cpp">.cpp</option>
          <option value=".txt">.txt</option>
        </select>
      </div>
      <div style="display:flex;gap:0.5rem;justify-content:flex-end;">
        <button onclick="document.getElementById('admin-add-file-overlay').remove()" class="btn btn-secondary btn-sm">Cancel</button>
        <button onclick="adminConfirmAddFile()" class="btn btn-primary btn-sm">Create</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: overlay });
  setTimeout(() => document.getElementById('aaf-name')?.focus(), 50);
  overlay.addEventListener('keydown', e => { if (e.key === 'Enter') adminConfirmAddFile(); if (e.key === 'Escape') overlay.remove(); });
}

function adminConfirmAddFile() {
  const nameEl = document.getElementById('aaf-name');
  const extEl = document.getElementById('aaf-ext');
  const name = nameEl ? nameEl.value.trim() : '';
  const ext = extEl ? extEl.value : '.c';
  if (!name) { nameEl && nameEl.focus(); return; }
  const v = adminState.variants[adminState.activeVariantIndex];
  v.files.push({ id: generateId(), name, ext, starterCode: '', code: '' });
  v.activeFileIndex = v.files.length - 1;
  document.getElementById('admin-add-file-overlay')?.remove();
  renderAdminVariantForm();
}

function adminDeleteFile(fi) {
  const v = adminState.variants[adminState.activeVariantIndex];
  if (v.files.length <= 1) return; // keep at least one
  v.files.splice(fi, 1);
  v.activeFileIndex = Math.max(0, Math.min(v.activeFileIndex, v.files.length - 1));
  renderAdminVariantForm();
}

function deleteAdminVariant(idx) {
  showConfirm("Delete Version", "Remove this variant entirely?", () => {
    adminState.variants.splice(idx, 1);
    adminState.activeVariantIndex = Math.max(0, adminState.activeVariantIndex - 1);
    renderAdminVariantForm();
  });
}

function updateActiveVariantField(field, value) {
  if (adminState && adminState.variants[adminState.activeVariantIndex]) {
    adminState.variants[adminState.activeVariantIndex][field] = value;
    if (field === 'name') {
      const tabs = document.getElementById('admin-variant-tabs');
      const tab = tabs && tabs.children[adminState.activeVariantIndex];
      if (tab) {
        const textNode = Array.from(tab.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
        if (textNode) textNode.nodeValue = ' ' + value + ' ';
        else tab.firstChild && tab.firstChild.nodeType !== Node.TEXT_NODE
          ? tab.insertBefore(document.createTextNode(' ' + value + ' '), tab.firstChild)
          : null;
      }
    }
  }
}

function addAdminSample() {
  adminState.variants[adminState.activeVariantIndex].samples.push({
    title: `Sample Output ${adminState.variants[adminState.activeVariantIndex].samples.length + 1}`,
    content: ''
  });
  renderAdminVariantForm();
}

function updateSampleField(idx, field, value) {
  adminState.variants[adminState.activeVariantIndex].samples[idx][field] = value;
}

function deleteAdminSample(idx) {
  adminState.variants[adminState.activeVariantIndex].samples.splice(idx, 1);
  renderAdminVariantForm();
}
