/* Route: analytics */
function analyticsTemplate() {
  return `
    <div class="messenger-layout">
      <main class="messenger-pane-1">
        <div class="pane-1-header">
          <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
            <h2 class="section-header-animated">
              <span class="section-header-icon-wrap analytics-icon-wrap">
                <i data-lucide="bar-chart-3"></i>
                <span class="section-header-icon-ring"></span>
              </span>
              <span class="section-header-text">
                <span class="section-header-title">Analytics</span>
                <span class="section-header-subtitle" id="analytics-header-stats">Loading...</span>
              </span>
            </h2>
            <button class="tutorial-trigger-btn" onclick="GuidedTutorial.start()" title="Show Page Tour" aria-label="Show Page Tour">
              <i data-lucide="graduation-cap" aria-hidden="true"></i>
            </button>
          </div>
          <div class="analytics-summary-strip" id="analytics-summary-strip"></div>
          <div class="admin-toggle-group" id="analytics-toggles" data-active="training" role="group" aria-label="Analytics view" style="width: 100%;">
            <div class="admin-toggle-slider"></div>
            <button class="admin-toggle-btn training-mode" id="toggle-training" onclick="switchAnalyticsTab('training')" aria-pressed="true"><i data-lucide="swords" aria-hidden="true"></i> Notes Mode</button>
            <button class="admin-toggle-btn practice-mode" id="toggle-practice" onclick="switchAnalyticsTab('practice')" aria-pressed="false"><i data-lucide="pen-tool" aria-hidden="true"></i> Coding Mode</button>
          </div>
        </div>
        <div class="pane-1-content" id="analytics-sidebar-content"></div>
      </main>
      <div class="resizer-divider" onmousedown="initResizerDrag(event, this)"></div>
      <section class="messenger-pane-2">
        <div id="analytics-detail-container" style="height: 100%;"></div>
      </section>
    </div>
  `;
}

function analyticsInit() {
  const container = document.getElementById('analytics-detail-container');
  if (container) {
    container.innerHTML = `
      <div class="empty-state" style="height: 100%; display: flex; align-items: center; justify-content: center; flex-direction: column;">
        <div class="empty-state-icon-animated">
          <i data-lucide="bar-chart-3" style="width: 48px; height: 48px; opacity: 0.5;"></i>
          <div class="empty-state-pulse-ring"></div>
        </div>
        <h2>Select an item</h2>
        <p style="font-size: 0.875rem; color: var(--text-tertiary); margin-top: 0.5rem;">Choose an item from the left pane to view its practice history.</p>
      </div>`;
  }
  renderHistory();
  updateAnalyticsSummary();
  GuidedTutorial.init('analytics');
}

function analyticsDestroy() { }

function updateAnalyticsSummary() {
  const strip = document.getElementById('analytics-summary-strip');
  const headerSub = document.getElementById('analytics-header-stats');
  if (!strip) return;

  const totalAttempts = state.history.length;
  const notebookAttempts = (state.notebookHistory || []).length;
  const perfectScores = state.history.filter(h => h.score === 100).length;
  const uniqueChallenges = new Set(state.history.map(h => h.challengeId)).size;
  const avgScore = totalAttempts > 0
    ? Math.round(state.history.reduce((sum, h) => sum + h.score, 0) / totalAttempts)
    : 0;
  const totalTime = state.history.reduce((sum, h) => sum + (h.duration || 0), 0);
  const streakDays = calcStudyStreak();

  if (headerSub) {
    headerSub.textContent = `${totalAttempts + notebookAttempts} total attempt${(totalAttempts + notebookAttempts) !== 1 ? 's' : ''}`;
  }

  strip.innerHTML = `
    <div class="analytics-mini-card" style="--card-accent: var(--color-primary);">
      <div class="analytics-mini-icon"><i data-lucide="target" style="width:14px;height:14px;"></i></div>
      <div class="analytics-mini-data">
        <span class="analytics-mini-value" data-count="${totalAttempts}">${totalAttempts}</span>
        <span class="analytics-mini-label">Attempts</span>
      </div>
    </div>
    <div class="analytics-mini-card" style="--card-accent: var(--color-success);">
      <div class="analytics-mini-icon"><i data-lucide="trophy" style="width:14px;height:14px;"></i></div>
      <div class="analytics-mini-data">
        <span class="analytics-mini-value" data-count="${perfectScores}">${perfectScores}</span>
        <span class="analytics-mini-label">Perfect</span>
      </div>
    </div>
    <div class="analytics-mini-card" style="--card-accent: var(--color-accent);">
      <div class="analytics-mini-icon"><i data-lucide="percent" style="width:14px;height:14px;"></i></div>
      <div class="analytics-mini-data">
        <span class="analytics-mini-value">${avgScore}%</span>
        <span class="analytics-mini-label">Avg Score</span>
      </div>
    </div>
    <div class="analytics-mini-card" style="--card-accent: var(--color-warning);">
      <div class="analytics-mini-icon"><i data-lucide="flame" style="width:14px;height:14px;"></i></div>
      <div class="analytics-mini-data">
        <span class="analytics-mini-value" data-count="${streakDays}">${streakDays}</span>
        <span class="analytics-mini-label">Day Streak</span>
      </div>
    </div>
  `;
  if (typeof lucide !== 'undefined') lucide.createIcons();
  animateCounters(strip);
}

function calcStudyStreak() {
  const allDates = new Set();
  state.history.forEach(h => { if (h.date) allDates.add(h.date); });
  if (state.notebookHistory) {
    state.notebookHistory.forEach(h => { if (h.date) allDates.add(h.date); });
  }
  if (allDates.size === 0) return 0;

  const sorted = Array.from(allDates).sort().reverse();
  const today = new Date(); today.setHours(0,0,0,0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);

  const latestDate = new Date(sorted[0]); latestDate.setHours(0,0,0,0);
  if (latestDate < yesterday) return 0;

  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]); prev.setHours(0,0,0,0);
    const curr = new Date(sorted[i]); curr.setHours(0,0,0,0);
    const diff = (prev - curr) / (1000 * 60 * 60 * 24);
    if (diff === 1) streak++;
    else break;
  }
  return streak;
}

function animateCounters(container) {
  container.querySelectorAll('[data-count]').forEach(el => {
    const target = parseInt(el.dataset.count);
    if (isNaN(target) || target === 0) return;
    let current = 0;
    const step = Math.max(1, Math.ceil(target / 30));
    const interval = setInterval(() => {
      current += step;
      if (current >= target) { current = target; clearInterval(interval); }
      el.textContent = current;
    }, 25);
  });
}
