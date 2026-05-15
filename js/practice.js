/* ============================================================
   PRACTICE.JS — Practice Session + Timer Logic
   ============================================================ */

window.activeTimerInterval = null;
let _submitInProgress = false;
let _autoSaveInterval = null;

function initPractice() {
  const challengeId = getSessionParam('practiceChallenge');
  const variantId = getSessionParam('practiceVariant');
  const timeLimit = getSessionParam('timeLimit') || 0;

  if (!challengeId || !variantId) { spaNavigate('browse'); return; }

  const challenge = state.challenges.find(c => c.id === challengeId);
  const variant = challenge ? challenge.variants.find(v => v.id === variantId) : null;

  if (!challenge || !variant) { spaNavigate('browse'); return; }

  // Ensure files[] exists
  if (!variant.files || variant.files.length === 0) {
    variant.files = [{ id: generateId(), name: 'main', ext: '.c', starterCode: variant.starterCode || '', code: variant.code || '' }];
  }

  state.activeChallenge = challenge;
  state.activeVariant = variant;
  state.userCode = variant.files[0].starterCode || '';
  // Per-file user code storage — restore auto-saved code if available
  const autoSaved = getSessionParam('autoSavedFiles');
  state.userFiles = variant.files.map(f => {
    const saved = autoSaved && autoSaved.find(s => s.name === f.name && s.ext === f.ext);
    return { ...f, userCode: saved ? saved.userCode : (f.starterCode || '') };
  });
  state.activeFileIndex = 0;
  _submitInProgress = false;
  state.timeLimit = timeLimit;
  state.sessionData = { startTime: Date.now(), timeLimit: timeLimit, attemptsThisSession: 1 };

  // Populate sidebar
  document.getElementById('practice-title').innerText = `${challenge.title} — ${variant.name}`;
  document.getElementById('practice-desc').innerHTML = formatRichText(variant.description || challenge.description) || 'No description provided.';

  const samplesContainer = document.getElementById('practice-samples-container');
  if (variant.samples && variant.samples.length > 0) {
    samplesContainer.innerHTML = variant.samples.map(s => `
      <div style="margin-bottom:0.5rem;">
        <h3 class="sample-title">${escapeHTML(s.title)}</h3>
        <div class="sample-content">${formatSampleText(s.content)}</div>
      </div>
    `).join('');
  } else {
    samplesContainer.innerHTML = '';
  }

  renderPracticeFileTabs();
  loadPracticeFile(0);

  // Boss bar
  const bossBarEnabled = sessionStorage.getItem('bossBarEnabled') === 'true';
  const bossWrapper = document.getElementById('boss-health-wrapper');
  if (bossWrapper) bossWrapper.style.display = bossBarEnabled ? '' : 'none';
  const bossToggleBtn = document.getElementById('boss-bar-toggle-btn');
  if (bossToggleBtn) bossToggleBtn.style.color = bossBarEnabled ? 'var(--color-warning)' : 'var(--text-tertiary)';

  // Timer
  if (window.activeTimerInterval) clearInterval(window.activeTimerInterval);
  updatePracticeTimerDisplay();
  window.activeTimerInterval = setInterval(updatePracticeTimerDisplay, 1000);

  // Auto-save: persist user code every 30 s so a tab close doesn't lose work
  if (_autoSaveInterval) clearInterval(_autoSaveInterval);
  _autoSaveInterval = setInterval(() => {
    if (!state.userFiles) return;
    savePracticeFileCode();
    setSessionParam('autoSavedFiles', state.userFiles.map(f => ({ name: f.name, ext: f.ext, userCode: f.userCode || '' })));
  }, 30000);

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderPracticeFileTabs() {
  const tabBar = document.getElementById('practice-file-tabs');
  if (!tabBar || !state.userFiles) return;
  tabBar.innerHTML = state.userFiles.map((f, fi) => `
    <div class="file-tab ${fi === state.activeFileIndex ? 'active' : ''}" onclick="switchPracticeFile(${fi})">
      <span class="file-tab-name">${escapeHTML(f.name + f.ext)}</span>
    </div>
  `).join('') + `<button class="file-tab-add" onclick="practiceAddFile()" title="Add File"><i data-lucide="plus" style="width:13px;height:13px;"></i></button>`;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: tabBar });
}

function savePracticeFileCode() {
  const textarea = document.getElementById('editor-textarea');
  if (!textarea || !state.userFiles) return;
  state.userFiles[state.activeFileIndex].userCode = textarea.value;
  state.userCode = textarea.value; // keep legacy field in sync
}

function loadPracticeFile(fi) {
  if (!state.userFiles || fi >= state.userFiles.length) return;
  savePracticeFileCode();
  state.activeFileIndex = fi;
  const file = state.userFiles[fi];
  const textarea = document.getElementById('editor-textarea');
  const preCode = document.getElementById('editor-code');
  if (!textarea || !preCode) return;

  if (_starterAnimator) _starterAnimator.abort();

  const code = file.userCode || '';
  if (!code && file.starterCode && typeof SyntaxTextAnimator !== 'undefined') {
    // Only animate on first load (no user code yet)
    state.userFiles[fi].userCode = file.starterCode;
    textarea.value = '';
    preCode.innerHTML = '<br/>';
    animateStarterCode(file.starterCode, textarea, preCode);
  } else {
    textarea.value = code;
    preCode.innerHTML = syntaxHighlight(code) + '<br/>';
  }

  if (typeof setupSpecificEditor === 'function') {
    setupSpecificEditor('editor-textarea', 'editor-pre', 'editor-code', true);
  }

  // Update boss bar for this file
  const handler = e => {
    state.userFiles[state.activeFileIndex].userCode = e.target.value;
    updateBossHealthBar(e.target.value);
  };
  textarea.removeEventListener('input', textarea._inputHandler);
  textarea._inputHandler = handler;
  textarea.addEventListener('input', handler);
  
  updateBossHealthBar(textarea.value);
  renderPracticeFileTabs();
  textarea.focus();
}



function practiceAddFile() {
  let overlay = document.getElementById('practice-add-file-overlay');
  if (overlay) overlay.remove();
  overlay = document.createElement('div');
  overlay.id = 'practice-add-file-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(5px);';
  overlay.innerHTML = `
    <div style="background:var(--bg-elevated);border:1px solid var(--border-color);border-radius:var(--radius-lg);padding:2rem;width:380px;box-shadow:0 24px 48px rgba(0,0,0,0.5);">
      <h3 style="font-weight:700;margin-bottom:1.25rem;display:flex;align-items:center;gap:0.5rem;font-size:1rem;">
        <i data-lucide="file-plus" style="width:18px;height:18px;color:var(--color-primary);"></i> Add File
      </h3>
      <div style="display:flex;gap:0.5rem;margin-bottom:0.5rem;">
        <input id="paf-name" class="form-input" placeholder="Filename*" style="flex:1;" />
        <select id="paf-ext" class="form-select" style="width:95px;">
          <option value=".c">.c</option>
          <option value=".h">.h</option>
          <option value=".cpp">.cpp</option>
          <option value=".txt">.txt</option>
        </select>
      </div>
      <p style="font-size:0.75rem;color:var(--text-tertiary);margin-bottom:1rem;">The available extensions will depend on the currently selected language</p>
      <div style="display:flex;gap:0.5rem;justify-content:flex-end;">
        <button onclick="document.getElementById('practice-add-file-overlay').remove()" class="btn btn-secondary btn-sm">Cancel</button>
        <button onclick="practiceConfirmAddFile()" class="btn btn-primary btn-sm">Create</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: overlay });
  setTimeout(() => document.getElementById('paf-name')?.focus(), 50);
  overlay.addEventListener('keydown', e => { if (e.key === 'Enter') practiceConfirmAddFile(); if (e.key === 'Escape') overlay.remove(); });
}

function practiceConfirmAddFile() {
  const nameEl = document.getElementById('paf-name');
  const extEl = document.getElementById('paf-ext');
  const name = nameEl ? nameEl.value.trim() : '';
  const ext = extEl ? extEl.value : '.c';
  if (!name) { nameEl?.focus(); return; }
  savePracticeFileCode();
  state.userFiles.push({ id: generateId(), name, ext, starterCode: '', code: '', userCode: '' });
  document.getElementById('practice-add-file-overlay')?.remove();
  loadPracticeFile(state.userFiles.length - 1);
}

let _starterAnimAborted = false;
let _starterAnimator = null;

document.addEventListener('click', () => {
  if (_starterAnimator && _starterAnimator._aborted === false && !_starterAnimator._forceComplete) {
    _starterAnimator.complete();
  }
});

/** MiSide-style animation for starter code appearing in the editor (DOM-safe) */
async function animateStarterCode(code, textarea, preCode) {
  _starterAnimAborted = false;

  // Abort any previous animator
  if (_starterAnimator) _starterAnimator.abort();

  if (typeof SyntaxTextAnimator !== 'undefined') {
    _starterAnimator = new SyntaxTextAnimator({
      speed: 18,
      onProgress: (typed) => {
        updateBossHealthBar(typed);
      },
      onComplete: () => {
        if (typeof state !== 'undefined') state.userCode = code;
        updateBossHealthBar(code);
      }
    });

    // Sync state as animation progresses
    await _starterAnimator.animate(code, preCode, textarea, syntaxHighlight);
  } else {
    // Fallback if animation class is missing
    textarea.value = code;
    preCode.innerHTML = syntaxHighlight(code) + '<br/>';
  }

  if (!_starterAnimAborted && typeof state !== 'undefined') {
    state.userCode = code;
  }
}

function updatePracticeTimerDisplay() {
  if (!state.sessionData) {
    if (window.activeTimerInterval) clearInterval(window.activeTimerInterval);
    return;
  }

  const elapsed = Math.floor((Date.now() - state.sessionData.startTime) / 1000);
  const displayEl = document.getElementById('practice-timer');
  if (!displayEl) return;

  if (state.sessionData.timeLimit > 0) {
    const remaining = state.sessionData.timeLimit - elapsed;
    if (remaining <= 0) {
      displayEl.innerText = "00:00";
      displayEl.classList.add('timer-expired');
      if (window.activeTimerInterval) clearInterval(window.activeTimerInterval);
      submitCode();
    } else {
      displayEl.innerText = formatTimeDisplay(remaining);
      displayEl.classList.remove('timer-expired');
    }
  } else {
    displayEl.innerText = formatTimeDisplay(elapsed);
    displayEl.classList.remove('timer-expired');
  }
}

function submitCode() {
  if (!state.activeVariant) return;
  if (_submitInProgress) return;
  _submitInProgress = true;

  // Disable submit button visually
  const submitBtn = document.getElementById('submit-btn');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.style.opacity = '0.6'; }

  if (window.activeTimerInterval) clearInterval(window.activeTimerInterval);
  if (_autoSaveInterval) { clearInterval(_autoSaveInterval); _autoSaveInterval = null; }
  clearSessionParam('autoSavedFiles');

  // Save the currently active file's code
  savePracticeFileCode();

  const variant = state.activeVariant;
  const files = variant.files && variant.files.length > 0 ? variant.files : null;

  // Build per-file diffs array: [{ fileName, diffs }]
  let allFileDiffs = [];
  let totalScore = 0, totalLines = 0;

  if (files && state.userFiles) {
    files.forEach((targetFile, fi) => {
      const userFile = state.userFiles.find(uf => uf.name === targetFile.name && uf.ext === targetFile.ext) ||
                       state.userFiles[fi] || { userCode: '' };
      const userCode = userFile.userCode || '';
      const { diffs, scoreCount, cLinesLen } = computeDiffs(userCode, targetFile.code || '');
      allFileDiffs.push({ fileName: targetFile.name + targetFile.ext, diffs });
      totalScore += scoreCount;
      totalLines += cLinesLen;
    });
  } else {
    const textarea = document.getElementById('editor-textarea');
    if (textarea) state.userCode = textarea.value;
    const { diffs, scoreCount, cLinesLen } = computeDiffs(state.userCode, variant.code || '');
    allFileDiffs.push({ fileName: 'main.c', diffs });
    totalScore += scoreCount;
    totalLines += cLinesLen;
  }

  const percentage = totalLines > 0 ? Math.round((totalScore / totalLines) * 100) : 0;
  const finalPercentage = Math.min(percentage, 100);
  const isPerfect = finalPercentage === 100;
  const submitTime = Date.now();
  const durationSeconds = Math.round((submitTime - state.sessionData.startTime) / 1000);
  const primaryUserCode = state.userFiles ? (state.userFiles[0]?.userCode || '') : state.userCode;

  const attemptCounter = (state.activeAttempts[state.activeChallenge.id] || 0) + 1;

  // FIX: Capture all files safely instead of just file[0]
  const savedUserFiles = state.userFiles ? JSON.parse(JSON.stringify(state.userFiles)) : null;
  const savedTargetFiles = variant.files ? JSON.parse(JSON.stringify(variant.files)) : null;

  const historyEntry = {
    id: generateId(),
    challengeId: state.activeChallenge.id,
    challengeTitle: `${state.activeChallenge.title} - ${state.activeVariant.name}`,
    category: (() => { const folder = state.nodes.find(n => n.id === state.activeChallenge.parentId); return folder ? folder.name : 'Uncategorized'; })(),
    date: new Date().toLocaleDateString(),
    startTime: state.sessionData.startTime,
    submitTime: submitTime,
    duration: durationSeconds,
    score: finalPercentage,
    attemptNumber: attemptCounter,
    
    // FIX: Store the arrays instead of a single string, fallback to strings for legacy
    userCode: primaryUserCode, 
    expectedCode: variant.files ? variant.files[0]?.code || '' : variant.code || '',
    userFiles: savedUserFiles,     // NEW: Required to prevent data loss in history
    targetFiles: savedTargetFiles  // NEW: Required to prevent data loss in history
  };

  // Gamification badges
  const earnedBadges = [];
  const hour = new Date().getHours();
  if (!state.badges) state.badges = [];
  if (isPerfect && attemptCounter === 1 && !state.badges.includes('Flawless')) { state.badges.push('Flawless'); earnedBadges.push({ name: 'Flawless', icon: '🎯', desc: '100% on First Try' }); }
  if (isPerfect && durationSeconds < 60 && !state.badges.includes('Speed Demon')) { state.badges.push('Speed Demon'); earnedBadges.push({ name: 'Speed Demon', icon: '⚡', desc: 'Perfect in Under 60s' }); }
  if ((hour >= 22 || hour < 4) && !state.badges.includes('Night Owl')) { state.badges.push('Night Owl'); earnedBadges.push({ name: 'Night Owl', icon: '🦉', desc: 'Late Night Coder' }); }
  if (attemptCounter >= 5 && !state.badges.includes('Persistent')) { state.badges.push('Persistent'); earnedBadges.push({ name: 'Persistent', icon: '💪', desc: '5+ Attempts on One Challenge' }); }
  if (state.history.length >= 49 && !state.badges.includes('Marathoner')) { state.badges.push('Marathoner'); earnedBadges.push({ name: 'Marathoner', icon: '🏃', desc: '50+ Total Submissions' }); }

  state.history.unshift(historyEntry);
  state.activeAttempts[state.activeChallenge.id] = isPerfect ? 0 : attemptCounter;
  state.lastDiffs = allFileDiffs[0]?.diffs || []; // legacy single-file compat
  state.lastFileDiffs = allFileDiffs;
  saveData();

  setSessionParam('lastDiffs', allFileDiffs[0]?.diffs || []);
  setSessionParam('lastFileDiffs', allFileDiffs);

  if (typeof showResultModal === 'function') showResultModal(finalPercentage, isPerfect, earnedBadges);

  // Re-enable submit after modal is shown
  const submitBtnPost = document.getElementById('submit-btn');
  if (submitBtnPost) { submitBtnPost.disabled = false; submitBtnPost.style.opacity = ''; }
  _submitInProgress = false;
}

function retryPractice() {
  _starterAnimAborted = true;
  if (_starterAnimator) _starterAnimator.abort();
  if (typeof closeResultModal === 'function') closeResultModal();

  const variant = state.activeVariant;
  if (!variant) return;

  // Reset all files to starter code
  if (state.userFiles) {
    state.userFiles = variant.files ? variant.files.map(f => ({ ...f, userCode: f.starterCode || '' })) :
                      [{ id: generateId(), name: 'main', ext: '.c', starterCode: variant.starterCode || '', code: variant.code || '', userCode: variant.starterCode || '' }];
    state.activeFileIndex = 0;
  }
  state.userCode = variant.files ? (variant.files[0]?.starterCode || '') : (variant.starterCode || '');

  const textarea = document.getElementById('editor-textarea');
  const preCode = document.getElementById('editor-code');
  const starterCode = state.userCode;

  if (starterCode && typeof SyntaxTextAnimator !== 'undefined') {
    textarea.value = '';
    preCode.innerHTML = '<br/>';
    animateStarterCode(starterCode, textarea, preCode);
  } else {
    textarea.value = starterCode;
    preCode.innerHTML = typeof syntaxHighlight === 'function' ? syntaxHighlight(starterCode) + '<br/>' : starterCode + '<br/>';
  }

  renderPracticeFileTabs();
  state.sessionData.startTime = Date.now();
  state.sessionData.attemptsThisSession++;

  if (window.activeTimerInterval) clearInterval(window.activeTimerInterval);
  updatePracticeTimerDisplay();
  window.activeTimerInterval = setInterval(updatePracticeTimerDisplay, 1000);

  if (_autoSaveInterval) clearInterval(_autoSaveInterval);
  _autoSaveInterval = setInterval(() => {
    if (!state.userFiles) return;
    savePracticeFileCode();
    setSessionParam('autoSavedFiles', state.userFiles.map(f => ({ name: f.name, ext: f.ext, userCode: f.userCode || '' })));
  }, 30000);

  _submitInProgress = false;
  updateBossHealthBar(textarea.value);
  textarea.focus();
}

function updateBossHealthBar(currentCode) {
  const bar = document.getElementById('boss-health-bar');
  if (!bar || !state.activeVariant) return;

  // 1. Ensure the currently typing file is updated in the state BEFORE calculating global health
  if (state.userFiles && state.activeFileIndex !== undefined) {
    state.userFiles[state.activeFileIndex].userCode = currentCode;
  }

  let totalSim = 0;
  let totalWeight = 0;

  // 2. Aggregate similarity across ALL files in the challenge
  if (state.activeVariant.files && state.activeVariant.files.length > 0 && state.userFiles) {
    state.activeVariant.files.forEach((targetFile, index) => {
      const userFile = state.userFiles.find(uf => uf.name === targetFile.name && uf.ext === targetFile.ext) || state.userFiles[index];
      const uCode = userFile ? (userFile.userCode || '') : '';
      const tCode = targetFile.code || '';
      
      // FIX: Normalize both strings by removing ALL whitespace before comparing
      // This prevents indentation or newlines from penalizing the health bar.
      const normalizedCurrent = uCode.replace(/\s+/g, '');
      const normalizedTarget = tCode.replace(/\s+/g, '');
      
      const weight = normalizedTarget.length || 1; 
      let sim = 0;
      if (typeof calculateSimilarity === 'function') {
        sim = calculateSimilarity(normalizedCurrent, normalizedTarget);
      } else {
        sim = normalizedCurrent === normalizedTarget ? 1 : 0;
      }
      
      totalSim += (sim * weight);
      totalWeight += weight;
    });
  } else {
    // Legacy single-file fallback
    const targetCode = state.activeVariant.code || '';
    if (!targetCode) return;
    
    const normalizedCurrent = currentCode.replace(/\s+/g, '');
    const normalizedTarget = targetCode.replace(/\s+/g, '');
    
    totalWeight = normalizedTarget.length || 1;
    let sim = 0;
    if (typeof calculateSimilarity === 'function') {
      sim = calculateSimilarity(normalizedCurrent, normalizedTarget);
    } else {
      sim = normalizedCurrent === normalizedTarget ? 1 : 0;
    }
    totalSim = sim * totalWeight;
  }

  // 3. Calculate final global percentage
  const overallSim = totalWeight > 0 ? (totalSim / totalWeight) : 0;
  const healthPercent = Math.max(0, 100 - (overallSim * 100));

  bar.style.width = healthPercent + '%';

  if (healthPercent > 60) {
    bar.style.background = 'linear-gradient(90deg, #ef4444, #f97316)';
    bar.style.boxShadow = '0 0 10px rgba(239, 68, 68, 0.5)';
  } else if (healthPercent > 20) {
    bar.style.background = 'linear-gradient(90deg, #f59e0b, #eab308)';
    bar.style.boxShadow = '0 0 10px rgba(245, 158, 11, 0.5)';
  } else {
    bar.style.background = 'linear-gradient(90deg, #10b981, #34d399)';
    bar.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.5)';
  }
}

function toggleBossHealthBar() {
  const wrapper = document.getElementById('boss-health-wrapper');
  const btn = document.getElementById('boss-bar-toggle-btn');
  if (!wrapper) return;
  const isVisible = wrapper.style.display !== 'none';
  wrapper.style.display = isVisible ? 'none' : '';
  sessionStorage.setItem('bossBarEnabled', isVisible ? 'false' : 'true');
  if (btn) btn.style.color = isVisible ? 'var(--text-tertiary)' : 'var(--color-warning)';
}

function goToSolution() {
  setSessionParam('solutionBack', 'practice');
  setSessionParam('lastDiffs', state.lastDiffs);
  spaNavigate('solution');
}

// ── Lazy-load JSCPP on first Run Code click (Item #10) ──
function ensureJSCPP(callback) {
  if (typeof JSCPP !== 'undefined') { callback(); return; }

  const outputEl = document.getElementById('run-code-output');
  const statusEl = document.getElementById('run-code-status');
  if (outputEl) outputEl.innerHTML = '<span class="run-code-compiling"><i data-lucide="loader" class="run-code-spinner"></i> Loading C interpreter…</span>';
  if (statusEl) statusEl.textContent = '⏳ Loading interpreter (first run only)…';
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: outputEl });

  const script = document.createElement('script');
  script.src = typeof JSCPP_SRC !== 'undefined' ? JSCPP_SRC : 'js/JSCPP.es5.min.js';
  script.onload = callback;
  script.onerror = () => {
    if (outputEl) { outputEl.textContent = 'Error: Could not load the C interpreter.\nCheck your network connection and try again.'; outputEl.className = 'run-code-output run-code-error'; }
    if (statusEl) statusEl.textContent = '❌ Interpreter load failed';
  };
  document.head.appendChild(script);
}

// ── Run Code via Piston API ──
function runCodeWithPiston() {
  const textarea = document.getElementById('editor-textarea');
  if (!textarea) return;
  const code = textarea.value;

  // Build the overlay
  let overlay = document.getElementById('run-code-overlay');
  if (overlay) overlay.remove();

  overlay = document.createElement('div');
  overlay.id = 'run-code-overlay';
  overlay.className = 'run-code-overlay';
  document.body.appendChild(overlay);

  overlay.innerHTML = `
    <div class="run-code-window">
      <div class="run-code-header">
        <div class="run-code-header-left">
          <i data-lucide="terminal"></i>
          <span>Run Code — Output</span>
        </div>
        <button class="run-code-close-btn" id="run-code-close-btn"><i data-lucide="x"></i></button>
      </div>
      <div class="run-code-body" style="flex-direction: column; gap: 1rem;">
        <div style="display: flex; flex-direction: column;">
          <label style="color:var(--term-text-muted); font-size:0.8125rem; font-weight:600; margin-bottom:0.375rem; display:flex; justify-content:space-between;">
            <span>Standard Input (stdin)</span>
            <span style="font-size:0.75rem; font-weight:normal; font-style:italic;">Edit & click Re-run if your code needs input</span>
          </label>
          <textarea id="run-code-stdin" style="background:var(--term-bg); color:var(--term-text); border:1px solid var(--term-border); border-radius:6px; padding:0.75rem; font-family:'Consolas', 'Courier New', monospace; font-size:0.875rem; min-height:80px; resize:vertical; outline:none;" placeholder="Enter input values here (separated by spaces or newlines)..."></textarea>
        </div>
        <div style="display: flex; flex-direction: column; flex: 1; min-height: 0;">
          <label style="color:var(--term-text-muted); font-size:0.8125rem; font-weight:600; margin-bottom:0.375rem;">Output</label>
          <pre class="run-code-output" id="run-code-output" style="margin:0; height:100%;"><span class="run-code-compiling"><i data-lucide="loader" class="run-code-spinner"></i> Compiling & Running...</span></pre>
        </div>
      </div>
      <div class="run-code-footer">
        <span class="run-code-status" id="run-code-status">⏳ Sending to compiler...</span>
        <button class="btn btn-primary btn-sm" id="run-code-rerun-btn"><i data-lucide="play" style="width:14px;height:14px;fill:currentColor;"></i> Run / Re-run</button>
      </div>
    </div>
  `;

  if (typeof lucide !== 'undefined') lucide.createIcons({ root: overlay });

  // Close button
  document.getElementById('run-code-close-btn').onclick = () => {
    overlay.remove();
    const existingToast = document.getElementById('run-code-toast');
    if (existingToast) existingToast.remove();
  };

  // Re-run button
  document.getElementById('run-code-rerun-btn').onclick = () => {
    const existingToast = document.getElementById('run-code-toast');
    if (existingToast) existingToast.remove();

    const freshCode = document.getElementById('editor-textarea')?.value || '';
    const stdinValue = document.getElementById('run-code-stdin')?.value || '';
    ensureJSCPP(() => executeBrowserCode(freshCode, stdinValue));
  };

  // Click backdrop to close
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
      const existingToast = document.getElementById('run-code-toast');
      if (existingToast) existingToast.remove();
    }
  });

  ensureJSCPP(() => executeBrowserCode(code, ''));
}

/**
 * Comprehensive C → JSCPP Preprocessor.
 *
 * JSCPP is a C++ interpreter. It does NOT support:
 *   - malloc / calloc / realloc / free (no heap allocator)
 *   - sizeof (except as a compile-time literal we inject)
 *   - struct / union / enum as typedef patterns
 *   - goto, file I/O (fopen etc.)
 *
 * This preprocessor converts idiomatic C code into a form that JSCPP
 * can actually interpret, covering the patterns students encounter
 * in introductory C programming courses.
 */
function preprocessCForJSCPP(code) {
  // ── 1. Header mapping (C → C++) ──
  const headerMap = {
    '<stdio.h>': '<cstdio>',
    '<stdlib.h>': '<cstdlib>',
    '<string.h>': '<cstring>',
    '<math.h>': '<cmath>',
    '<ctype.h>': '<cctype>',
    '<limits.h>': '<climits>',
    '<stdbool.h>': '',
    '<assert.h>': '<cassert>',
    '<float.h>': '<cfloat>',
    '<time.h>': '<ctime>',
    '<stddef.h>': '',
    '<errno.h>': '',
    '<signal.h>': '',
    '<stdarg.h>': '',
  };

  let p = code;

  for (const [cH, cppH] of Object.entries(headerMap)) {
    const re = new RegExp('#\\s*include\\s*' + escapeRegex(cH), 'g');
    p = cppH ? p.replace(re, `#include ${cppH}`) : p.replace(new RegExp(re.source + '\\s*\\n?', 'g'), '');
  }

  // ── 2. Add 'using namespace std;' ──
  if (!p.includes('using namespace std')) {
    const li = p.lastIndexOf('#include');
    if (li !== -1) {
      const le = p.indexOf('\n', li);
      if (le !== -1) p = p.slice(0, le + 1) + 'using namespace std;\n' + p.slice(le + 1);
    }
  }

  // If no includes at all, add the basics
  if (!p.includes('#include')) {
    p = '#include <cstdio>\n#include <cstdlib>\nusing namespace std;\n' + p;
  }

  // ── 3. sizeof → numeric literals ──
  const sizeofMap = {
    'int': 4, 'unsigned int': 4, 'signed int': 4,
    'short': 2, 'unsigned short': 2, 'signed short': 2,
    'long': 4, 'unsigned long': 4, 'signed long': 4,
    'long long': 8, 'unsigned long long': 8,
    'char': 1, 'unsigned char': 1, 'signed char': 1,
    'float': 4, 'double': 8,
    'bool': 1,
    'int*': 4, 'char*': 4, 'float*': 4, 'double*': 4, 'void*': 4,
  };
  // sizeof(type)
  p = p.replace(/sizeof\s*\(\s*([^)]+?)\s*\)/g, (match, typeExpr) => {
    const t = typeExpr.replace(/\s+/g, ' ').trim();
    if (sizeofMap[t] !== undefined) return String(sizeofMap[t]);
    // sizeof(type *) → 4
    if (t.endsWith('*')) return '4';
    // sizeof(variable) – leave as-is for JSCPP to handle, but most likely it's a type
    return match;
  });

  // ── 4. Dynamic memory: malloc / calloc → VLA (Variable-Length Array) ──
  // Pattern: type *name = (type*)malloc(expr * sizeof(type));
  // → type name[expr];
  // Also: type *name = (type*)calloc(n, sizeof(type));
  // → type name[n]; memset-equivalent not needed, JSCPP zero-inits

  // malloc with sizeof already resolved (sizeof replaced to number above)
  // e.g. int *arr = (int*)malloc(n * 4);
  p = p.replace(
    /(\w[\w\s]*?)\s*\*\s*(\w+)\s*=\s*\([^)]*\)\s*malloc\s*\(\s*(.+?)\s*\*\s*\d+\s*\)\s*;/g,
    (match, type, name, countExpr) => {
      const t = type.trim();
      return `${t} ${name}[${countExpr.trim()}];`;
    }
  );
  // malloc with just an expression: int *arr = (int*)malloc(n);
  p = p.replace(
    /(\w[\w\s]*?)\s*\*\s*(\w+)\s*=\s*\([^)]*\)\s*malloc\s*\(\s*(.+?)\s*\)\s*;/g,
    (match, type, name, expr) => {
      const t = type.trim();
      return `${t} ${name}[${expr.trim()}];`;
    }
  );
  // malloc without cast: int *arr = malloc(expr);
  p = p.replace(
    /(\w[\w\s]*?)\s*\*\s*(\w+)\s*=\s*malloc\s*\(\s*(.+?)\s*\)\s*;/g,
    (match, type, name, expr) => {
      const t = type.trim();
      // Try to extract count from expr like "n * sizeof(int)" → n
      const countMatch = expr.match(/^(.+?)\s*\*\s*\d+$/);
      const count = countMatch ? countMatch[1].trim() : expr.trim();
      return `${t} ${name}[${count}];`;
    }
  );
  // calloc: int *arr = (int*)calloc(n, sizeof(int));
  p = p.replace(
    /(\w[\w\s]*?)\s*\*\s*(\w+)\s*=\s*(?:\([^)]*\)\s*)?calloc\s*\(\s*(.+?)\s*,\s*(?:sizeof\s*\([^)]*\)|\d+)\s*\)\s*;/g,
    (match, type, name, countExpr) => {
      const t = type.trim();
      return `${t} ${name}[${countExpr.trim()}];`;
    }
  );
  // realloc – just leave the variable as-is (best-effort)
  p = p.replace(
    /(\w+)\s*=\s*(?:\([^)]*\)\s*)?realloc\s*\([^)]*\)\s*;/g,
    '/* realloc not supported in browser interpreter */'
  );

  // ── 5. Remove free() calls ──
  p = p.replace(/\bfree\s*\([^)]*\)\s*;/g, '/* free removed – browser interpreter */');

  // ── 6. Remove system("pause") and similar ──
  p = p.replace(/\bsystem\s*\(\s*"pause"\s*\)\s*;/g, '');
  p = p.replace(/\bgetch\s*\(\s*\)\s*;/g, '');

  // ── 7. Handle typedef struct patterns ──
  // typedef struct { ... } Name;  →  (JSCPP doesn't support this)
  // We'll try to convert simple struct usage but complex ones will still fail

  // ── 8. Convert C99 bool to C++ bool ──
  // (stdbool.h removed above, so true/false/bool should work natively)

  // ── 9. Handle void main() → int main() ──
  p = p.replace(/\bvoid\s+main\s*\(/g, 'int main(');

  return p;
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Execute C code in the browser using JSCPP.
 * Handles stdin consumption and echoes input values into the output
 * to mimic a real terminal experience.
 */
function executeBrowserCode(code, stdin = '') {
  const outputEl = document.getElementById('run-code-output');
  const statusEl = document.getElementById('run-code-status');
  if (!outputEl || !statusEl) return;

  outputEl.innerHTML = '<span class="run-code-compiling"><i data-lucide="loader" class="run-code-spinner"></i> Compiling & Running...</span>';
  statusEl.textContent = '⏳ Interpreting code...';
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: outputEl });

  setTimeout(() => {
    if (typeof JSCPP === 'undefined') {
      outputEl.textContent = 'Error: JSCPP library not loaded.\n\nMake sure you have internet connection on first load\nto download the interpreter engine.';
      outputEl.className = 'run-code-output run-code-error';
      statusEl.textContent = '❌ Interpreter not available';
      return;
    }

    let capturedOutput = '';

    try {
      const processedCode = preprocessCForJSCPP(code);

      const exitCode = JSCPP.run(processedCode, stdin, {
        stdio: {
          write: function (s) {
            capturedOutput += s;
          }
        },
        unsigned_overflow: 'warn'
      });

      // ── Build terminal-style output with echoed stdin ──
      const finalOutput = buildTerminalOutput(capturedOutput, stdin, code);

      if (finalOutput.length === 0) {
        outputEl.textContent = '(No output)\n\nProgram exited with code ' + exitCode;
        outputEl.className = 'run-code-output run-code-success';
      } else {
        outputEl.textContent = finalOutput;
        outputEl.className = 'run-code-output run-code-success';
      }
      statusEl.textContent = '✅ Executed Successfully (exit code: ' + exitCode + ')';

    } catch (err) {
      const errMsg = err.message || String(err);

      // ── Friendly error mapping ──
      if (errMsg.includes('parse') || errMsg.includes('unexpected') || errMsg.includes('Syntax') || errMsg.includes('missing')) {
        outputEl.textContent = 'Compilation Error:\n\n' + errMsg;
        outputEl.className = 'run-code-output run-code-error';
        statusEl.textContent = '❌ Syntax / Compilation Error';
      } else if (errMsg.includes('variable malloc does not exist') || errMsg.includes('variable calloc does not exist') || errMsg.includes('variable realloc does not exist')) {
        outputEl.textContent = 'Unsupported Feature: Dynamic Memory Allocation\n\nThe browser interpreter does not support malloc/calloc/realloc.\nYour code has been auto-converted to use stack arrays where possible,\nbut this pattern could not be converted automatically.\n\nTip: Use fixed-size arrays instead, e.g.:\n  int arr[100]; instead of int *arr = (int*)malloc(100 * sizeof(int));';
        outputEl.className = 'run-code-output run-code-warning';
        statusEl.textContent = '⚠️ Unsupported Feature';
      } else if (errMsg.includes('does not exist')) {
        const varMatch = errMsg.match(/variable (\w+) does not exist/);
        const varName = varMatch ? varMatch[1] : 'unknown';
        outputEl.textContent = `Unsupported Feature:\n\n"${varName}" is not available in the browser interpreter.\n\nSupported libraries: stdio (printf, scanf, getchar, gets, puts),\nstdlib (rand, srand, atoi, abs, qsort), cmath, cstring, cctype, ctime.\n\nUnsupported: malloc/free, file I/O (fopen/fclose), threads, networking.`;
        outputEl.className = 'run-code-output run-code-warning';
        statusEl.textContent = '⚠️ Unsupported Feature';
      } else if (errMsg.includes('not supported') || errMsg.includes('not implemented')) {
        outputEl.textContent = 'Unsupported Feature:\n\n' + errMsg + '\n\n(The browser interpreter supports most standard C constructs\nbut some advanced features may not be available.)';
        outputEl.className = 'run-code-output run-code-warning';
        statusEl.textContent = '⚠️ Unsupported Feature';
      } else if (errMsg.includes('Memory overflow') || errMsg.includes('EOF')) {
        // Program ran out of stdin – show what it printed so far + blinking cursor
        const partialOutput = buildTerminalOutput(capturedOutput, stdin, code);
        outputEl.innerHTML = escapeHTML(partialOutput) + '<span class="run-code-cursor"></span>';
        outputEl.className = 'run-code-output run-code-success';
        statusEl.textContent = '⏳ Waiting for input...';

        // Show floating toast
        const existingToast = document.getElementById('run-code-toast');
        if (existingToast) existingToast.remove();

        const toast = document.createElement('div');
        toast.id = 'run-code-toast';
        toast.className = 'run-code-toast run-code-toast-warning';
        toast.innerHTML = `
          <div style="display:flex; align-items:flex-start; gap:0.5rem; line-height: 1.4;">
            <i data-lucide="alert-triangle" style="margin-top:2px;"></i>
            <span>Program paused: Waiting for input... Please enter it in the Standard Input box and click Run.</span>
          </div>
          <button onclick="this.parentElement.remove()" style="background:none; border:none; color:inherit; cursor:pointer; padding:0; margin-left:1rem; opacity:0.8;"><i data-lucide="x" style="width:16px;height:16px;"></i></button>
        `;
        document.body.appendChild(toast);
        if (typeof lucide !== 'undefined') lucide.createIcons({ root: toast });

        setTimeout(() => {
          if (document.body.contains(toast)) toast.remove();
        }, 7000);
      } else {
        outputEl.textContent = 'Runtime Error:\n\n' + errMsg;
        outputEl.className = 'run-code-output run-code-error';
        statusEl.textContent = '❌ Runtime Error';
      }
    }
  }, 50);
}

/**
 * Build terminal-style output by interleaving program output with echoed stdin.
 *
 * In a real terminal, when scanf reads input, the user's typed value is echoed
 * on-screen followed by a newline (from pressing Enter). JSCPP doesn't do this,
 * so we reconstruct it by detecting where each scanf consumed a value and
 * injecting the input tokens into the output stream at the correct positions.
 */
function buildTerminalOutput(rawOutput, stdin, originalCode) {
  if (!stdin || !stdin.trim()) return rawOutput;

  // Count how many scanf / cin reads the code has
  const scanfMatches = originalCode.match(/scanf\s*\(/g);
  const cinMatches = originalCode.match(/cin\s*>>/g);

  if (!scanfMatches && !cinMatches) return rawOutput;

  // Count the total number of format specifiers across all scanf calls
  let totalReads = 0;
  if (scanfMatches) {
    // For each scanf call, count format specifiers like %d, %f, %s, %c, etc.
    const scanfCalls = originalCode.match(/scanf\s*\(\s*"([^"]*)"/g);
    if (scanfCalls) {
      for (const call of scanfCalls) {
        const fmtMatch = call.match(/"([^"]*)"/);
        if (fmtMatch) {
          const specs = fmtMatch[1].match(/%[*]?[0-9]*[diouxXeEfFgGaAcspn]/g);
          totalReads += specs ? specs.length : 0;
        }
      }
    }
  }
  if (cinMatches) {
    totalReads += cinMatches.length;
  }

  if (totalReads === 0) return rawOutput;

  // Split stdin into individual tokens (by whitespace/newlines)
  const inputTokens = stdin.trim().split(/[\s]+/);
  const tokensToEcho = inputTokens.slice(0, totalReads);

  if (tokensToEcho.length === 0) return rawOutput;

  // Strategy: Insert each input token + newline into the raw output
  // at the boundaries where printf output segments meet.
  // 
  // The raw output from JSCPP contains all printf output concatenated.
  // For a typical pattern like:
  //   printf("Enter: "); scanf("%d",&n); printf("%d", n);
  // The rawOutput would be: "Enter: 5"
  // We want:                "Enter: 5\n5"
  // 
  // We detect printf output segments by looking at the source code structure.
  // Simple approach: append echo after each newline-less prompt that precedes a scanf.

  // Build a simple interleaved version
  let result = rawOutput;

  // For each input token, find where it appears in the output and add a newline after it
  // This handles the common case where printf prints the value right after scanf consumed it
  for (let i = 0; i < tokensToEcho.length; i++) {
    const token = tokensToEcho[i];
    // Find the first occurrence of this token in the remaining result that doesn't 
    // already have a newline after it
    const idx = result.indexOf(token);
    if (idx !== -1) {
      const afterIdx = idx + token.length;
      // If the character right after the token is NOT already a newline, insert one
      if (afterIdx < result.length && result[afterIdx] !== '\n') {
        result = result.slice(0, afterIdx) + '\n' + result.slice(afterIdx);
      }
    }
  }

  return result;
}