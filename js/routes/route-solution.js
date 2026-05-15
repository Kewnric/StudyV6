/* Route: solution */
function solutionTemplate() {
  return `
    <div class="solution-layout">
      <div class="diff-topbar">
        <button id="solution-back-btn" class="btn-back-dark"><i data-lucide="chevron-left" style="width:18px;height:18px;"></i> Back to Editor</button>
        <div class="file-tab-bar" id="solution-file-tabs" style="border-bottom:none; background:transparent;"></div>
        <div class="diff-legend">
          <span class="diff-legend-item"><span class="diff-legend-dot match"></span> Match</span>
          <span class="diff-legend-item"><span class="diff-legend-dot minor"></span> Minor Diff</span>
          <span class="diff-legend-item"><span class="diff-legend-dot wrong"></span> Wrong/Missing</span>
        </div>
      </div>
      <div class="diff-panels">
        <div class="diff-panel"><div class="diff-panel-header actual">Your Submission</div><div id="diff-actual" class="diff-panel-body"></div></div>
        <div class="diff-panel"><div class="diff-panel-header expected">Correct Solution</div><div id="diff-expected" class="diff-panel-body"></div></div>
      </div>
    </div>
  `;
}
function solutionInit() { initSolution(); }
function solutionDestroy() { }
