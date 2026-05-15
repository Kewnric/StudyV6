/* ============================================================
   DIALOGS.JS — Modal / Dialog System
   ============================================================ */

// Smooth modal close with fade-out animation
function closeModalSmooth(modalEl) {
  if (!modalEl) return;
  const content = modalEl.querySelector('.modal-content');
  modalEl.style.transition = 'opacity 0.2s ease';
  modalEl.style.opacity = '0';
  if (content) {
    content.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
    content.style.transform = 'scale(0.95)';
    content.style.opacity = '0';
  }
  setTimeout(() => {
    modalEl.classList.add('hidden');
    modalEl.style.opacity = '';
    modalEl.style.transition = '';
    if (content) {
      content.style.transform = '';
      content.style.opacity = '';
      content.style.transition = '';
    }
  }, 200);
}

/** @param {string} title @param {string} message @param {boolean} [isError] */
function showMessage(title, message, isError = false) {
  const modal = document.getElementById('dialog-modal');
  if (!modal) { alert(title + ': ' + message); return; }
  document.getElementById('dialog-title').innerText = title;
  document.getElementById('dialog-msg').innerText = message;
  const iconEl = document.getElementById('dialog-icon');
  iconEl.innerHTML = isError
    ? '<i data-lucide="alert-circle" class="modal-icon-svg" style="color: var(--color-danger);"></i>'
    : '<i data-lucide="info" class="modal-icon-svg" style="color: var(--color-primary);"></i>';
  document.getElementById('dialog-actions').innerHTML = `
    <button onclick="closeModalSmooth(document.getElementById('dialog-modal'))" class="btn btn-secondary" style="flex:1;">OK</button>
  `;
  modal.classList.remove('hidden');
  if (isError) {
    const content = modal.querySelector('.modal-content');
    if (content) {
      content.style.animation = 'none';
      void content.offsetWidth;
      content.style.animation = 'shake 0.5s ease-in-out, bounceIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
    }
  }
  lucide.createIcons();
}

/** @param {string} title @param {string} message @param {function} onConfirm */
function showConfirm(title, message, onConfirm) {
  const modal = document.getElementById('dialog-modal');
  if (!modal) { if (confirm(title + ': ' + message)) onConfirm(); return; }
  document.getElementById('dialog-title').innerText = title;
  document.getElementById('dialog-msg').innerText = message;
  document.getElementById('dialog-icon').innerHTML = '<i data-lucide="help-circle" class="modal-icon-svg" style="color: var(--color-warning);"></i>';

  const btnContainer = document.getElementById('dialog-actions');
  btnContainer.innerHTML = `
    <button id="dlg-cancel" class="btn btn-secondary" style="flex:1;">Cancel</button>
    <button id="dlg-confirm" class="btn btn-danger" style="flex:1;">Confirm</button>
  `;

  document.getElementById('dlg-cancel').onclick = () => closeModalSmooth(modal);
  document.getElementById('dlg-confirm').onclick = () => {
    closeModalSmooth(modal);
    onConfirm();
  };

  modal.classList.remove('hidden');
  lucide.createIcons();
}

function showUnsavedConfirm(onDiscard, onSave) {
  const modal = document.getElementById('dialog-modal');
  if (!modal) {
    if (confirm('You have unsaved changes. Discard?')) onDiscard();
    return;
  }
  document.getElementById('dialog-title').innerText = 'Unsaved Changes';
  document.getElementById('dialog-msg').innerText = 'You have unsaved modifications. What would you like to do?';
  document.getElementById('dialog-icon').innerHTML = '<i data-lucide="alert-triangle" class="modal-icon-svg" style="color: var(--color-warning);"></i>';

  const btnContainer = document.getElementById('dialog-actions');
  btnContainer.innerHTML = `
    <button id="dlg-cancel" class="btn btn-ghost" style="flex:1;">Cancel</button>
    <button id="dlg-discard" class="btn btn-danger" style="flex:1;">Discard</button>
    <button id="dlg-save" class="btn btn-primary" style="flex:1;">Save Changes</button>
  `;

  document.getElementById('dlg-cancel').onclick = () => closeModalSmooth(modal);
  document.getElementById('dlg-discard').onclick = () => {
    closeModalSmooth(modal);
    onDiscard();
  };
  document.getElementById('dlg-save').onclick = () => {
    closeModalSmooth(modal);
    onSave();
  };

  modal.classList.remove('hidden');
  lucide.createIcons();
}

function showResultModal(score, isPerfect, earnedBadges = []) {
  const modal = document.getElementById('result-modal');
  if (!modal) return;
  const iconContainer = document.getElementById('rm-icon');
  const titleEl = document.getElementById('rm-title');
  const descEl = document.getElementById('rm-desc');
  const actionsEl = document.getElementById('rm-actions');

  // Build badges HTML if any were earned
  let badgesHTML = '';
  if (earnedBadges.length > 0) {
    badgesHTML = `
      <div class="result-badges-container">
        <div class="result-badges-title">🏆 Achievement Unlocked!</div>
        ${earnedBadges.map(b => `
          <div class="result-badge-item">
            <span class="result-badge-icon">${b.icon}</span>
            <div>
              <div class="result-badge-name">${escapeHTML(b.name)}</div>
              <div class="result-badge-desc">${escapeHTML(b.desc)}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  if (isPerfect) {
    iconContainer.innerHTML = '<i data-lucide="check-circle-2" class="modal-icon-svg" style="color: var(--color-success);"></i>';
    titleEl.innerText = 'Perfect Score!';
    descEl.innerHTML = "Logic matched perfectly! (Spacing/Formatting ignored)" + badgesHTML;
    actionsEl.innerHTML = `
      <button onclick="closeResultModal(); goToSolution();" class="btn btn-secondary" style="flex:1;">
        <i data-lucide="file-diff" style="width:18px;height:18px;"></i> View Solution
      </button>
      <button onclick="closeResultModal(); spaNavigate('browse');" class="btn btn-primary" style="flex:1;">Continue</button>
    `;
  } else {
    iconContainer.innerHTML = '<i data-lucide="alert-circle" class="modal-icon-svg" style="color: var(--color-warning);"></i>';
    titleEl.innerText = score + '% Match';
    descEl.innerHTML = "You're getting there! Review your syntax and logic compared to the solution." + badgesHTML;
    actionsEl.innerHTML = `
      <button onclick="retryPractice()" class="btn btn-secondary" style="flex:1;">
        <i data-lucide="refresh-ccw" style="width:18px;height:18px;"></i> Retry
      </button>
      <button onclick="closeResultModal(); goToSolution();" class="btn btn-primary" style="flex:1;">
        <i data-lucide="file-text" style="width:18px;height:18px;"></i> Check Solution
      </button>
    `;
  }

  modal.classList.remove('hidden');
  lucide.createIcons();
}

function closeResultModal() {
  const modal = document.getElementById('result-modal');
  if (modal) modal.classList.add('hidden');
}

// ── showInputDialog — replaces native prompt() ──
// onConfirm receives the trimmed non-empty string the user typed.
/** Replaces native prompt(). @param {string} title @param {string|null} message @param {string} placeholder @param {string} defaultValue @param {function(string): void} onConfirm called only with non-empty trimmed value */
function showInputDialog(title, message, placeholder, defaultValue, onConfirm) {
  const modal = document.getElementById('dialog-modal');
  if (!modal) {
    const result = prompt(message || title, defaultValue || '');
    if (result !== null && result.trim()) onConfirm(result.trim());
    return;
  }

  document.getElementById('dialog-title').innerText = title;
  document.getElementById('dialog-msg').innerText = message || '';
  document.getElementById('dialog-icon').innerHTML =
    '<i data-lucide="edit-3" class="modal-icon-svg" style="color:var(--color-primary);"></i>';

  const btnContainer = document.getElementById('dialog-actions');
  btnContainer.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:0.625rem;width:100%;">
      <input id="dlg-input" class="form-input"
        placeholder="${escapeHTML(placeholder || '')}"
        value="${escapeHTML(defaultValue || '')}"
        style="width:100%;" />
      <div style="display:flex;gap:0.5rem;">
        <button id="dlg-cancel" class="btn btn-secondary" style="flex:1;">Cancel</button>
        <button id="dlg-confirm" class="btn btn-primary" style="flex:1;">Confirm</button>
      </div>
    </div>
  `;

  const input = document.getElementById('dlg-input');
  const doConfirm = () => {
    const val = input.value.trim();
    if (!val) { input.focus(); return; }
    closeModalSmooth(modal);
    onConfirm(val);
  };

  document.getElementById('dlg-cancel').onclick = () => closeModalSmooth(modal);
  document.getElementById('dlg-confirm').onclick = doConfirm;
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doConfirm(); });

  modal.classList.remove('hidden');
  lucide.createIcons();
  setTimeout(() => input.focus(), 80);
}

// ── showListPickerDialog — replaces numbered-list prompt() ──
// options = [{ label: string (HTML-safe), value: any }]
// onConfirm receives the chosen option's value, or null for "Root".
/** Replaces numbered-list prompt(). @param {string} title @param {string|null} message @param {Array<{label:string,value:*}>} options @param {function(*): void} onConfirm called with selected value (null = root) */
function showListPickerDialog(title, message, options, onConfirm) {
  const modal = document.getElementById('dialog-modal');
  if (!modal) {
    let opts = '0 — Root (no parent)\n';
    options.forEach((o, i) => { opts += `${i + 1} — ${o.label}\n`; });
    const choice = prompt('Choose destination:\n' + opts);
    if (choice === null) return;
    const idx = parseInt(choice);
    if (!isNaN(idx)) onConfirm(idx === 0 ? null : (options[idx - 1]?.value ?? null));
    return;
  }

  document.getElementById('dialog-title').innerText = title;
  document.getElementById('dialog-msg').innerText = message || '';
  document.getElementById('dialog-icon').innerHTML =
    '<i data-lucide="folder-tree" class="modal-icon-svg" style="color:var(--color-primary);"></i>';

  const allOpts = [{ label: 'Root (no parent)', value: null }, ...options];

  const btnContainer = document.getElementById('dialog-actions');
  btnContainer.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:0.625rem;width:100%;">
      <div style="max-height:260px;overflow-y:auto;display:flex;flex-direction:column;gap:0.25rem;">
        ${allOpts.map((o, i) => `
          <div class="dlg-pick-item" data-idx="${i}"
            style="padding:0.5rem 0.75rem;border-radius:var(--radius-sm);cursor:pointer;
                   border:1px solid var(--border-color);font-size:0.8125rem;
                   color:var(--text-primary);display:flex;align-items:center;gap:0.5rem;"
            onmouseenter="this.style.background='var(--bg-surface-hover)'"
            onmouseleave="this.style.background=''">
            ${i === 0 ? '<i data-lucide="home" style="width:12px;height:12px;flex-shrink:0;"></i>' : '<i data-lucide="folder" style="width:12px;height:12px;flex-shrink:0;"></i>'}
            ${o.label}
          </div>
        `).join('')}
      </div>
      <button id="dlg-cancel" class="btn btn-secondary" style="width:100%;">Cancel</button>
    </div>
  `;

  document.getElementById('dlg-cancel').onclick = () => closeModalSmooth(modal);

  btnContainer.querySelectorAll('.dlg-pick-item').forEach((item) => {
    item.onclick = () => {
      const idx = parseInt(item.getAttribute('data-idx'));
      closeModalSmooth(modal);
      onConfirm(allOpts[idx] ? allOpts[idx].value : null);
    };
  });

  modal.classList.remove('hidden');
  lucide.createIcons();
}

// Global Modal Hooks: Close on Escape key and Click Outside
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(modal => {
      closeModalSmooth(modal);
    });
  }
});

document.addEventListener('click', (e) => {
  if (e.target && e.target.classList && e.target.classList.contains('modal-overlay')) {
    closeModalSmooth(e.target);
  }
});
