/* Route: practice */
function practiceTemplate() {
  return `
    <div class="practice-layout">
      <div class="practice-topbar">
        <div class="practice-topbar-left">
          <button onclick="spaNavigate('browse')" class="btn-back-dark" id="practice-back-btn">
            <i data-lucide="chevron-left" style="width:18px;height:18px;"></i> Back
          </button>
        </div>
        <div class="practice-topbar-center" style="flex: 1; min-width: 0; margin: 0 0.5rem; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; overflow: hidden;">
          <span id="practice-title" class="practice-title-badge"></span>
          <div class="boss-health-container" id="boss-health-wrapper" style="width: 100%; max-width: 600px; height: 12px; background: rgba(0,0,0,0.5); border-radius: 6px; border: 1px solid var(--border-color); overflow: hidden; position: relative; display: none;">
            <div id="boss-health-bar" style="width: 100%; height: 100%; background: linear-gradient(90deg, var(--color-danger), var(--color-warning)); transition: width 0.3s ease, background 0.3s ease; box-shadow: 0 0 10px var(--color-danger-bg);"></div>
          </div>
        </div>
        <div class="practice-topbar-right">
          <button class="btn btn-ghost" onclick="toggleBossHealthBar()" title="Toggle Boss Health Bar" id="boss-bar-toggle-btn" aria-label="Toggle Boss Health Bar" style="padding:0.375rem; color:var(--text-tertiary); font-size:0.75rem;">
            <i data-lucide="swords" style="width:16px;height:16px;" aria-hidden="true"></i>
          </button>
          <div class="timer-display"><i data-lucide="clock"></i><span id="practice-timer">00:00</span></div>
          <button class="btn btn-secondary" onclick="retryPractice()"><i data-lucide="rotate-ccw"></i> Retry</button>
          <button class="btn btn-run-code" onclick="runCodeWithPiston()"><i data-lucide="play"></i> Run Code</button>
          <button class="btn btn-primary" onclick="submitCode()"><i data-lucide="check-circle"></i> Submit Code</button>
        </div>
      </div>
      <div class="practice-body">
        <div class="practice-sidebar">
          <div><h2>Description</h2><p id="practice-desc"></p></div>
          <div id="practice-samples-container" style="display:flex; flex-direction:column; gap:1rem;"></div>
          <div class="practice-footer"><p>Practice writing the exact code logic. Line spaces & empty lines are forgiven. Press Submit to compare.</p></div>
        </div>
        <div class="resizer-divider" onmousedown="initResizerDrag(event, this)"></div>
        <div class="practice-editor-area" style="display:flex; flex-direction:column;">
          <div class="file-tab-bar" id="practice-file-tabs"></div>
          <div style="flex:1; position:relative; min-height:0;">
            <pre id="editor-pre" class="editor-pre"><code id="editor-code"></code></pre>
            <textarea id="editor-textarea" spellcheck="false" class="editor-textarea" placeholder="// Start typing your code here..."></textarea>
          </div>
        </div>
      </div>
    </div>
  `;
}
function practiceInit() { initPractice(); GuidedTutorial.init('practice'); }
function practiceDestroy() {
  if (window.activeTimerInterval) {
    clearInterval(window.activeTimerInterval);
    window.activeTimerInterval = null;
  }
  if (typeof _autoSaveInterval !== 'undefined' && _autoSaveInterval) {
    clearInterval(_autoSaveInterval);
    _autoSaveInterval = null;
  }
  if (typeof _starterAnimator !== 'undefined' && _starterAnimator) {
    _starterAnimator.abort();
  }
}