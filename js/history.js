/* ============================================================
   HISTORY.JS — Analytics / History Rendering (Dual-Pane)
   ============================================================ */

let activeHistoryChallengeId = null;
let activeAnalyticsTab = 'training';
let activeNotebookHistoryId = null;

let bulkResetMode = false;

window.switchAnalyticsTab = function (tab) {
  activeAnalyticsTab = tab;
  bulkResetMode = false;

  // Update toggle group active state + aria-pressed
  const toggleGroup = document.getElementById('analytics-toggles');
  if (toggleGroup) {
    toggleGroup.dataset.active = tab === 'training' ? 'training' : 'practice';
    const trainingBtn = document.getElementById('toggle-training');
    const practiceBtn = document.getElementById('toggle-practice');
    if (trainingBtn) trainingBtn.setAttribute('aria-pressed', String(tab === 'training'));
    if (practiceBtn) practiceBtn.setAttribute('aria-pressed', String(tab === 'practice'));
  }

  activeHistoryChallengeId = null;
  activeNotebookHistoryId = null;

  const container = document.getElementById('analytics-detail-container');
  if (container) {
    container.innerHTML = `<div class="empty-state" style="height: 100%; display: flex; align-items: center; justify-content: center; flex-direction: column;"><i data-lucide="bar-chart-3" style="width: 48px; height: 48px; opacity: 0.5; margin-bottom: 1rem;"></i><h2>Select an item</h2><p style="font-size: 0.875rem; color: var(--text-tertiary); margin-top: 0.5rem;">Choose an item from the left pane to view its practice history.</p></div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  renderHistory();
};

function renderSRSQueue() {
  const bestScores = {};
  state.history.forEach(log => {
    if (!bestScores[log.challengeId] || log.score > bestScores[log.challengeId].score) {
      bestScores[log.challengeId] = log;
    }
  });

  const reviewQueue = Object.values(bestScores)
    .filter(log => log.score < 100)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);

  if (reviewQueue.length === 0) {
    return `<div class="empty-state" style="padding: 1rem;"><p>You're all caught up! 100% on all attempted challenges.</p></div>`;
  }

  return reviewQueue.map(log => {
    const challenge = state.challenges.find(c => c.id === log.challengeId);
    if (!challenge) return '';
    return `
      <div class="card" style="border-left: 4px solid var(--color-warning); margin-bottom: 0.75rem;">
        <h3 style="font-weight:700; font-size:1rem; margin-bottom:0.5rem;">${escapeHTML(challenge.title)}</h3>
        <p style="font-size: 0.8125rem; color: var(--text-secondary); margin-bottom: 0.75rem;">Your best score: <span style="color:var(--color-warning); font-weight:700;">${log.score}%</span></p>
        <button onclick="promptTimer('${challenge.id}')" class="btn btn-secondary btn-sm" style="width:100%;">
          <i data-lucide="refresh-cw" style="width:14px;height:14px;"></i> Review Now
        </button>
      </div>
    `;
  }).join('');
}

function renderBadges() {
  if (!state.badges || state.badges.length === 0) return '';
  return `
    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
      ${state.badges.map(b => `
        <div style="background: var(--color-primary-subtle); color: var(--color-primary); padding: 0.5rem 0.75rem; border-radius: var(--radius-md); border: 1px solid rgba(99, 102, 241, 0.2); display: flex; align-items: center; gap: 0.375rem; font-weight: 700; font-size: 0.8125rem;">
          <i data-lucide="award" style="width: 16px; height: 16px;"></i> ${escapeHTML(b)}
        </div>
      `).join('')}
    </div>
  `;
}

// BUG-06 & Phase 5 FIX: Implement recursive tree rendering for history overview
function renderAnalyticsTreeRecursive(parentId, scope, depth) {
  const folders = getChildFolders(parentId, scope);
  let html = '';

  folders.forEach(folder => {
    // Only show folders that have history somewhere inside them
    if (!folderHasHistory(folder.id, scope)) return;

    // Use a specific suffix for analytics expansion state to avoid colliding with browse
    const expandedKey = folder.id + '_analytics';
    const expanded = isNodeExpanded(expandedKey);
    const indent = depth * 0.75;

    html += `<details class="snippet-folder" style="margin-bottom: 0.5rem;" ${expanded ? 'open' : ''}>
      <summary class="snippet-folder-summary" onclick="event.preventDefault(); toggleNodeExpanded('${expandedKey}'); renderHistory();">
        <i data-lucide="chevron-right" class="folder-icon ${expanded ? 'expanded' : ''}"></i>
        <i data-lucide="folder" class="tree-node-icon folder-icon-color" style="margin-right:0.5rem; width:14px; height:14px;"></i>
        ${escapeHTML(folder.name)}
      </summary>
      <div class="snippet-folder-content" style="padding-left: ${indent + 0.5}rem;">
    `;

    // Render items in this folder that have history
    const items = getItemsInFolder(folder.id, scope);
    items.forEach(item => {
      const logs = scope === 'challenge'
        ? (_historyItemMap[item.id] || [])
        : (_notebookHistoryItemMap[item.id] || []);

      if (logs.length > 0) {
        html += renderAnalyticsItem(item, logs, scope);
      }
    });

    // Recurse into subfolders
    html += renderAnalyticsTreeRecursive(folder.id, scope, depth + 1);

    html += `</div></details>`;
  });

  return html;
}

let _historyItemMap = {};
let _notebookHistoryItemMap = {};
let _folderHasHistoryMemo = {};

function folderHasHistory(folderId, scope) {
  const memoKey = folderId + '_' + scope;
  if (_folderHasHistoryMemo[memoKey] !== undefined) return _folderHasHistoryMemo[memoKey];

  const items = getItemsInFolder(folderId, scope);
  const hasDirect = items.some(item => {
    if (scope === 'challenge') return !!_historyItemMap[item.id];
    if (scope === 'notebook') return !!_notebookHistoryItemMap[item.id];
    return false;
  });
  if (hasDirect) {
    _folderHasHistoryMemo[memoKey] = true;
    return true;
  }
  const childFolders = getChildFolders(folderId, scope);
  const hasChild = childFolders.some(cf => folderHasHistory(cf.id, scope));
  _folderHasHistoryMemo[memoKey] = hasChild;
  return hasChild;
}

function renderAnalyticsItem(item, logs, scope) {
  const bestScore = scope === 'challenge' ? Math.max(...logs.map(l => l.score)) : getBestNotebookScore(logs);
  const completions = scope === 'challenge' ? logs.filter(l => l.score === 100).length : logs.filter(l => l.score === 100 || l.progress === 100).length;
  
  const isActive = scope === 'challenge' ? activeHistoryChallengeId === item.id : activeNotebookHistoryId === item.id;
  const onClick = bulkResetMode ? '' : (scope === 'challenge' ? `showHistoryDetail('${item.id}')` : `showNotebookHistoryDetail('${item.id}')`);
  const title = scope === 'challenge' ? item.title : (item.title || logs[0].notebookTitle || 'Unknown Notebook');

  const completionBadge = completions > 1 ? `<span style="font-size:0.65rem; color:var(--color-primary); background:rgba(59,130,246,0.1); padding:2px 6px; border-radius:12px; margin-right:0.5rem; font-weight:700;">${completions}x Completed</span>` : '';

  return `<div class="snippet-list-item ${isActive ? 'active' : ''} ${bulkResetMode ? 'bulk-mode' : ''}" onclick="${onClick}" style="margin-bottom:0.5rem; display:flex; gap:0.5rem; align-items:center;">
      ${bulkResetMode ? `<input type="checkbox" class="bulk-reset-cb" value="${item.id}" style="width:16px;height:16px;accent-color:var(--color-danger);cursor:pointer;">` : ''}
      <div style="flex:1;">
        <div class="snippet-list-title" style="display:flex; justify-content:space-between; align-items:center;">
          <span style="display:flex; align-items:center;">${escapeHTML(title)}</span>
          <div style="display:flex; align-items:center;">
            ${completionBadge}
            <span class="score-badge ${bestScore === 100 ? 'score-perfect' : 'score-partial'}" style="font-size:0.65rem;">${bestScore}%</span>
          </div>
        </div>
        <div style="font-size:0.7rem; color:var(--text-tertiary); margin-top:0.25rem;">${logs.length} attempt${logs.length !== 1 ? 's' : ''} total</div>
      </div>
    </div>`;
}

function getBestNotebookScore(logs) {
  let best = 0;
  logs.forEach(l => {
    let c = 0, q = 0;
    if (l.sections) l.sections.forEach(s => { c += (s.correct || 0); q += (s.total || 0); });
    let pct = q > 0 ? Math.round((c / q) * 100) : 0;
    if (pct > best) best = pct;
  });
  return best;
}

function renderHistory() {
  const container = document.getElementById('analytics-sidebar-content');
  if (!container) return;

  _historyItemMap = {};
  state.history.forEach(h => {
    if (!_historyItemMap[h.challengeId]) _historyItemMap[h.challengeId] = [];
    _historyItemMap[h.challengeId].push(h);
  });
  
  _notebookHistoryItemMap = {};
  if (state.notebookHistory) {
    state.notebookHistory.forEach(h => {
      if (!_notebookHistoryItemMap[h.notebookId]) _notebookHistoryItemMap[h.notebookId] = [];
      _notebookHistoryItemMap[h.notebookId].push(h);
    });
  }
  
  _folderHasHistoryMemo = {};

  let sidebarHTML = '';

  if (activeAnalyticsTab === 'practice') {
    if (state.badges && state.badges.length > 0) {
      sidebarHTML += `<div style="margin-bottom: 0.5rem;"><div class="analytics-section-label"><i data-lucide="award" style="width:14px;height:14px;"></i> Achievement Badges</div>${renderBadges()}</div>`;
    }

    sidebarHTML += `<div style="margin-bottom: 0.5rem;"><div class="analytics-section-label" style="color: var(--color-warning);"><i data-lucide="brain" style="width:14px;height:14px;"></i> Daily Review (SRS)</div><p style="font-size: 0.75rem; color: var(--text-tertiary); margin-bottom: 0.75rem;">Challenges you scored lowest on.</p>${renderSRSQueue()}</div>`;

    sidebarHTML += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
      <div class="analytics-section-label"><i data-lucide="folder" style="width:14px;height:14px;"></i> Full History</div>
      <button onclick="toggleBulkResetMode()" class="btn btn-ghost btn-sm" style="font-size:0.7rem; padding:0.25rem 0.5rem; color:${bulkResetMode ? 'var(--color-danger)' : 'var(--text-tertiary)'};">
        <i data-lucide="${bulkResetMode ? 'x' : 'trash-2'}" style="width:12px;height:12px;"></i> ${bulkResetMode ? 'Cancel' : 'Bulk Reset'}
      </button>
    </div>`;
    
    if (bulkResetMode) {
      sidebarHTML += `<div style="margin-bottom:1rem; padding:0.75rem; background:rgba(239, 68, 68, 0.1); border-radius:var(--radius-md); border:1px solid rgba(239, 68, 68, 0.2);">
        <p style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:0.5rem;">Select items below to completely wipe their history.</p>
        <div style="display:flex; gap:0.5rem;">
          <button onclick="selectAllBulkReset()" class="btn btn-secondary btn-sm" style="flex:1;">Select All</button>
          <button onclick="executeBulkReset()" class="btn btn-danger btn-sm" style="flex:1;"><i data-lucide="trash-2" style="width:14px;height:14px;"></i> Delete</button>
        </div>
      </div>`;
    }

    sidebarHTML += `<div>`;

    // Render tree recursively instead of using flat categories array
    sidebarHTML += renderAnalyticsTreeRecursive(null, 'challenge', 0);

    // Explicitly handle root/uncategorized challenges
    const rootChallenges = state.challenges.filter(c => !c.parentId);
    rootChallenges.forEach(c => {
      const logs = _historyItemMap[c.id] || [];
      if (logs.length > 0) {
        sidebarHTML += renderAnalyticsItem(c, logs, 'challenge');
      }
    });

    sidebarHTML += '</div>';

    if (state.history.length === 0) {
      sidebarHTML += '<div class="empty-state" style="padding: 1rem;"><p>No history entries yet. Start practicing!</p></div>';
    }
  } else {
    sidebarHTML += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
      <div class="analytics-section-label"><i data-lucide="book" style="width:14px;height:14px;"></i> Notebook History</div>
      <button onclick="toggleBulkResetMode()" class="btn btn-ghost btn-sm" style="font-size:0.7rem; padding:0.25rem 0.5rem; color:${bulkResetMode ? 'var(--color-danger)' : 'var(--text-tertiary)'};">
        <i data-lucide="${bulkResetMode ? 'x' : 'trash-2'}" style="width:12px;height:12px;"></i> ${bulkResetMode ? 'Cancel' : 'Bulk Reset'}
      </button>
    </div>`;
    
    if (bulkResetMode && state.notebookHistory && state.notebookHistory.length > 0) {
      sidebarHTML += `<div style="margin-bottom:1rem; padding:0.75rem; background:rgba(239, 68, 68, 0.1); border-radius:var(--radius-md); border:1px solid rgba(239, 68, 68, 0.2);">
        <p style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:0.5rem;">Select notebooks below to completely wipe their history.</p>
        <div style="display:flex; gap:0.5rem;">
          <button onclick="selectAllBulkReset()" class="btn btn-secondary btn-sm" style="flex:1;">Select All</button>
          <button onclick="executeBulkReset()" class="btn btn-danger btn-sm" style="flex:1;"><i data-lucide="trash-2" style="width:14px;height:14px;"></i> Delete</button>
        </div>
      </div>`;
    }

    sidebarHTML += `<div>`;

    if (!state.notebookHistory || state.notebookHistory.length === 0) {
      sidebarHTML += '<div class="empty-state" style="padding: 1rem;"><p>No notebook attempts yet. Go to Notes Library and start a session!</p></div>';
    } else {
      // Render tree recursively for notebooks
      sidebarHTML += renderAnalyticsTreeRecursive(null, 'notebook', 0);

      // Explicitly handle root/uncategorized notebooks
      const rootNotebooks = state.notebooks.filter(n => !n.parentId);
      rootNotebooks.forEach(n => {
        const logs = _notebookHistoryItemMap[n.id] || [];
        if (logs.length > 0) {
          sidebarHTML += renderAnalyticsItem(n, logs, 'notebook');
        }
      });
    }

    sidebarHTML += '</div>';
  }

  container.innerHTML = sidebarHTML;
  if (typeof lucide !== 'undefined') lucide.createIcons();
  if (typeof updateAnalyticsSummary === 'function') updateAnalyticsSummary();
}

function showHistoryDetail(challengeId) {
  activeHistoryChallengeId = challengeId;
  renderHistory(); // Re-render sidebar to update active state
  renderHistoryDetail(challengeId);
}

function backToHistoryOverview() {
  activeHistoryChallengeId = null;
  renderHistory();

  // Reset right pane to empty state
  const container = document.getElementById('analytics-detail-container');
  if (container) {
    container.innerHTML = `
      <div class="empty-state" style="height: 100%; display: flex; align-items: center; justify-content: center; flex-direction: column;">
        <i data-lucide="bar-chart-3" style="width: 48px; height: 48px; opacity: 0.5; margin-bottom: 1rem;"></i>
        <h2>Select a challenge</h2>
        <p style="font-size: 0.875rem; color: var(--text-tertiary); margin-top: 0.5rem;">Choose a challenge from the left pane to view its practice history.</p>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
}

// Bind globally for checkbox actions
window.toggleAllBulk = function (source) {
  const cbs = document.querySelectorAll('.bulk-history-cb');
  cbs.forEach(cb => cb.checked = source.checked);
};

function renderHistoryDetail(challengeId) {
  const challenge = state.challenges.find(c => c.id === challengeId);
  if (!challenge) return;

  const container = document.getElementById('analytics-detail-container');
  const logs = state.history.filter(h => h.challengeId === challengeId);

  if (logs.length === 0) {
    container.innerHTML = `
      <div style="padding: 2rem;">
        <button onclick="backToHistoryOverview()" class="btn btn-ghost" style="margin-bottom:1.5rem; color:var(--text-secondary);" id="back-to-overview-btn">
          <i data-lucide="chevron-left" style="width:18px;height:18px;"></i> Back to Categories
        </button>
        <div class="empty-state" style="border:2px dashed var(--border-color); border-radius:var(--radius-lg); background:var(--bg-surface);">
          <i data-lucide="history"></i>
          <h2>No History Yet</h2>
          <p>You haven't practiced this program yet.</p>
        </div>
      </div>
    `;
  } else {
    const bestScore = Math.max(...logs.map(l => l.score));
    const totalAttempts = logs.length;
    const avgScore = Math.round(logs.reduce((sum, l) => sum + l.score, 0) / totalAttempts);
    const totalTime = logs.reduce((sum, l) => sum + (l.duration || 0), 0);

    // Resolve category name from parentId
    const parentFolder = state.nodes.find(n => n.id === challenge.parentId);
    const catName = parentFolder ? parentFolder.name : 'Uncategorized';

    // Build score sparkline data
    const sparklinePoints = logs.slice(-10).map((l, i, arr) => {
      const x = (i / Math.max(arr.length - 1, 1)) * 100;
      const y = 100 - l.score;
      return `${x},${y}`;
    }).join(' ');
    const sparklineFill = logs.slice(-10).map((l, i, arr) => {
      const x = (i / Math.max(arr.length - 1, 1)) * 100;
      const y = 100 - l.score;
      return `${x},${y}`;
    });
    const sparklineFillPath = `0,100 ${sparklineFill.join(' ')} 100,100`;

    // Determine improvement trend
    const recentScores = logs.slice(-5).map(l => l.score);
    const olderScores = logs.slice(-10, -5).map(l => l.score);
    const recentAvg = recentScores.length > 0 ? recentScores.reduce((a,b)=>a+b,0)/recentScores.length : 0;
    const olderAvg = olderScores.length > 0 ? olderScores.reduce((a,b)=>a+b,0)/olderScores.length : recentAvg;
    const trend = recentAvg > olderAvg ? 'up' : recentAvg < olderAvg ? 'down' : 'flat';
    const trendIcon = trend === 'up' ? 'trending-up' : trend === 'down' ? 'trending-down' : 'minus';
    const trendColor = trend === 'up' ? 'var(--color-success)' : trend === 'down' ? 'var(--color-danger)' : 'var(--text-tertiary)';

    container.innerHTML = `
      <div style="padding: 2rem;" class="animate-fade-in">
        <div class="analytics-detail-header">
          <div>
            <h2 class="analytics-detail-title">${escapeHTML(challenge.title)}</h2>
            <p class="analytics-detail-category">
              <i data-lucide="folder" style="width:13px;height:13px;"></i> ${escapeHTML(catName)}
              <span class="analytics-trend-badge" style="color:${trendColor};">
                <i data-lucide="${trendIcon}" style="width:13px;height:13px;"></i> ${trend === 'up' ? 'Improving' : trend === 'down' ? 'Declining' : 'Steady'}
              </span>
            </p>
          </div>
          <div class="analytics-score-ring-lg" title="Best Score: ${bestScore}%">
            <svg viewBox="0 0 36 36">
              <path class="score-ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
              <path class="score-ring-fill ${bestScore === 100 ? 'perfect' : ''}" stroke-dasharray="${bestScore}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
            </svg>
            <span class="score-ring-text">${bestScore}%</span>
          </div>
        </div>

        <div class="analytics-stat-grid">
          <div class="analytics-stat-card-enhanced" style="--stat-accent: var(--color-success);">
            <div class="stat-card-icon"><i data-lucide="trophy" style="width:18px;height:18px;"></i></div>
            <div class="analytics-stat-value" style="color:var(--color-success);">${bestScore}%</div>
            <div class="analytics-stat-label">Best Score</div>
          </div>
          <div class="analytics-stat-card-enhanced" style="--stat-accent: var(--color-primary);">
            <div class="stat-card-icon"><i data-lucide="calculator" style="width:18px;height:18px;"></i></div>
            <div class="analytics-stat-value">${avgScore}%</div>
            <div class="analytics-stat-label">Avg Score</div>
          </div>
          <div class="analytics-stat-card-enhanced" style="--stat-accent: var(--color-accent);">
            <div class="stat-card-icon"><i data-lucide="repeat" style="width:18px;height:18px;"></i></div>
            <div class="analytics-stat-value">${totalAttempts}</div>
            <div class="analytics-stat-label">Attempts</div>
          </div>
          <div class="analytics-stat-card-enhanced" style="--stat-accent: var(--color-warning);">
            <div class="stat-card-icon"><i data-lucide="timer" style="width:18px;height:18px;"></i></div>
            <div class="analytics-stat-value">${formatTimeDisplay(totalTime)}</div>
            <div class="analytics-stat-label">Total Time</div>
          </div>
        </div>

        ${logs.length >= 2 ? `
        <div class="analytics-sparkline-card">
          <div class="sparkline-header">
            <span class="sparkline-title"><i data-lucide="activity" style="width:14px;height:14px;"></i> Score Trend (last ${Math.min(logs.length, 10)})</span>
          </div>
          <svg class="sparkline-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
            <polygon class="sparkline-fill" points="${sparklineFillPath}"/>
            <polyline class="sparkline-line" points="${sparklinePoints}" fill="none"/>
          </svg>
        </div>` : ''}

        <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-bottom: 1rem;">
          <button onclick="document.getElementById('history-table').classList.toggle('show-bulk-actions')" class="btn btn-secondary btn-sm" id="toggle-bulk-btn">
            <i data-lucide="check-square" style="width:16px;height:16px;"></i> Toggle Bulk Actions
          </button>
          <button onclick="bulkDeleteSelected('${challengeId}')" class="btn btn-danger btn-sm bulk-delete-btn" id="bulk-delete-btn" style="display:none;">
            <i data-lucide="trash-2" style="width:16px;height:16px;"></i> Delete Selected
          </button>
        </div>

        <div class="table-container">
          <table class="table" id="history-table">
            <thead>
              <tr>
                <th class="bulk-checkbox-col" style="padding-right:0;"><input type="checkbox" onclick="toggleAllBulk(this)"></th>
                <th>Date</th>
                <th>Version</th>
                <th>Score</th>
                <th style="text-align:right;">Time Spent</th>
                <th style="text-align:center;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${(() => {
                let currentCompletion = logs.filter(l => l.score === 100).length;
                return logs.map(entry => {
                  let compLabel = '';
                  if (entry.score === 100) {
                    if (currentCompletion > 1) compLabel = `<span style="font-size:0.6rem; opacity:0.8; margin-left:4px;">(#${currentCompletion})</span>`;
                    currentCompletion--;
                  }
                  return `
                <tr>
                  <td class="bulk-checkbox-col" style="padding-right:0;"><input type="checkbox" class="bulk-history-cb" value="${entry.id}"></td>
                  <td style="color:var(--text-secondary);">
                    ${entry.date}
                    <span style="display:block; font-size:0.75rem; opacity:0.7;">${new Date(entry.startTime).toLocaleTimeString()}</span>
                  </td>
                  <td style="font-weight:600;">${escapeHTML(entry.challengeTitle.split(' - ')[1] || 'Unknown')} ${entry.isArchived ? '<span class="badge badge-neutral" style="font-size:0.6rem;">Archived</span>' : ''}</td>
                  <td>
                    <span class="score-badge ${entry.score === 100 ? 'score-perfect' : 'score-partial'}">
                      ${entry.score}% ${compLabel}
                    </span>
                  </td>
                  <td style="text-align:right; color:var(--text-secondary);">${formatTimeDisplay(entry.duration)}</td>
                  <td style="text-align:center;">
                    <button onclick="viewHistoricalDiff('${entry.id}', '${challengeId}')" class="btn btn-ghost" title="View Code Comparison" id="view-diff-${entry.id}">
                      <i data-lucide="eye" style="width:16px;height:16px;color:var(--color-primary);"></i>
                    </button>
                    <button onclick="deleteHistoryLog('${entry.id}', '${challengeId}')" class="btn btn-ghost" title="Delete Log" id="delete-log-${entry.id}">
                      <i data-lucide="trash-2" style="width:16px;height:16px;color:var(--color-danger);"></i>
                    </button>
                  </td>
                </tr>
              `;}).join('');
              })()}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
  lucide.createIcons();

  // Wire up bulk toggle visibility
  const toggleBtn = document.getElementById('toggle-bulk-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const delBtn = document.getElementById('bulk-delete-btn');
      if (delBtn) delBtn.style.display = delBtn.style.display === 'none' ? 'inline-flex' : 'none';
    });
  }
}

function viewHistoricalDiff(id, challengeId) {
  const entry = state.history.find(h => h.id === id);
  if (!entry) return;
  const diffResults = computeDiffs(entry.userCode || '', entry.expectedCode || '');
  setSessionParam('lastDiffs', diffResults.diffs);
  setSessionParam('solutionBack', 'analytics');
  setSessionParam('solutionChallengeId', challengeId);
  spaNavigate('solution');
}

function deleteHistoryLog(id, challengeId) {
  showConfirm("Delete Record", "Are you sure you want to delete this history record?", () => {
    state.history = state.history.filter(h => h.id !== id);
    saveData();
    renderHistoryDetail(challengeId);
    renderHistory(); // Update sidebar counts
  });
}

function bulkDeleteSelected(challengeId) {
  const selected = Array.from(document.querySelectorAll('.bulk-history-cb:checked')).map(cb => cb.value);
  if (selected.length === 0) {
    showMessage("No Selection", "Please select at least one history entry to delete.", true);
    return;
  }
  showConfirm("Delete Selected", `Are you sure you want to delete ${selected.length} selected record(s)?`, () => {
    state.history = state.history.filter(h => !selected.includes(h.id));
    saveData();
    renderHistoryDetail(challengeId);
    renderHistory(); // Update sidebar counts
  });
}

// Timer modal functions for analytics page (SRS Review Now)
function promptTimer(challengeId) {
  pendingChallengeId = challengeId;
  const challenge = state.challenges.find(c => c.id === challengeId);
  if (!challenge) return;

  const variantSelect = document.getElementById('timer-variant-select');
  if (!variantSelect) return;
  variantSelect.innerHTML = challenge.variants.map(v =>
    `<option value="${v.id}">${escapeHTML(v.name)}</option>`
  ).join('');

  document.getElementById('timer-h').value = '0';
  document.getElementById('timer-m').value = '0';
  document.getElementById('timer-s').value = '0';
  document.getElementById('timer-modal').classList.remove('hidden');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeTimerModal() {
  document.getElementById('timer-modal').classList.add('hidden');
}

function confirmStartPractice() {
  const h = parseInt(document.getElementById('timer-h').value) || 0;
  const m = parseInt(document.getElementById('timer-m').value) || 0;
  const s = parseInt(document.getElementById('timer-s').value) || 0;
  const vId = document.getElementById('timer-variant-select').value;

  closeTimerModal();

  setSessionParam('practiceChallenge', pendingChallengeId);
  setSessionParam('practiceVariant', vId);
  setSessionParam('timeLimit', (h * 3600) + (m * 60) + s);

  spaNavigate('practice');
}

function showNotebookHistoryDetail(notebookId) {
  activeNotebookHistoryId = notebookId;
  renderHistory();
  renderNotebookHistoryDetailView(notebookId);
}

function renderNotebookHistoryDetailView(notebookId) {
  const container = document.getElementById('analytics-detail-container');
  const logs = state.notebookHistory.filter(h => h.notebookId === notebookId);

  if (logs.length === 0) {
    container.innerHTML = `
      <div style="padding: 2rem;">
        <button onclick="window.switchAnalyticsTab('training')" class="btn btn-ghost" style="margin-bottom:1.5rem; color:var(--text-secondary);">
          <i data-lucide="chevron-left" style="width:18px;height:18px;"></i> Back to Notebooks
        </button>
        <div class="empty-state" style="border:2px dashed var(--border-color); border-radius:var(--radius-lg); background:var(--bg-surface);">
          <i data-lucide="history"></i>
          <h2>No History Yet</h2>
          <p>You haven't practiced this notebook yet.</p>
        </div>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  let bestScore = 0;
  let totalScoreSum = 0;
  let totalQsSum = 0;
  let totalTime = 0;

  logs.forEach(l => {
    let c = 0, q = 0;
    if (l.sections) l.sections.forEach(s => { c += (s.correct || 0); q += (s.total || 0); });
    let pct = q > 0 ? Math.round((c / q) * 100) : 0;
    if (pct > bestScore) bestScore = pct;
    totalScoreSum += pct;
    totalTime += (l.duration || 0);
  });

  const avgScore = Math.round(totalScoreSum / logs.length);
  const totalAttempts = logs.length;
  const title = logs[0].notebookTitle || 'Unknown Notebook';

  // BUG-07 FIX: Dynamically fetch proper notebook category instead of hardcoded 'Basics'
  const notebook = state.notebooks.find(n => n.id === notebookId);
  const parentFolder = notebook ? state.nodes.find(n => n.id === notebook.parentId) : null;
  const categoryName = parentFolder ? parentFolder.name : 'Uncategorized';

  container.innerHTML = `
    <div style="padding: 2rem;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
        <div>
          <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--text-primary); margin-bottom: 0.25rem;">
            ${escapeHTML(title)}
          </h2>
          <p style="font-size: 0.875rem; color: var(--text-secondary);">${escapeHTML(categoryName)}</p>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:0.75rem; margin-bottom:1.5rem;">
        <div class="analytics-stat-card"><div class="analytics-stat-value" style="color:var(--color-success);">${bestScore}%</div><div class="analytics-stat-label">Best Score</div></div>
        <div class="analytics-stat-card"><div class="analytics-stat-value">${avgScore}%</div><div class="analytics-stat-label">Avg Score</div></div>
        <div class="analytics-stat-card"><div class="analytics-stat-value">${totalAttempts}</div><div class="analytics-stat-label">Attempts</div></div>
        <div class="analytics-stat-card"><div class="analytics-stat-value">${formatTimeDisplay(totalTime)}</div><div class="analytics-stat-label">Total Time</div></div>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-bottom: 1rem;">
        <button onclick="document.getElementById('history-table').classList.toggle('show-bulk-actions')" class="btn btn-secondary btn-sm" id="toggle-bulk-btn">
          <i data-lucide="check-square" style="width:16px;height:16px;"></i> Toggle Bulk Actions
        </button>
        <button onclick="bulkDeleteNotebookSelected('${notebookId}')" class="btn btn-danger btn-sm bulk-delete-btn" id="bulk-delete-btn" style="display:none;">
          <i data-lucide="trash-2" style="width:16px;height:16px;"></i> Delete Selected
        </button>
      </div>

      <div class="table-container">
        <table class="table" id="history-table">
          <thead>
            <tr>
              <th class="bulk-checkbox-col" style="padding-right:0;"><input type="checkbox" onclick="toggleAllBulk(this)"></th>
              <th>Date</th>
              <th>Version</th>
              <th>Score</th>
              <th style="text-align:right;">Time Spent</th>
              <th style="text-align:center;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${(() => {
              let currentCompletion = logs.filter((l) => {
                let cc = 0, qq = 0;
                if (l.sections) l.sections.forEach(s => { cc += (s.correct || 0); qq += (s.total || 0); });
                return qq > 0 && Math.round((cc / qq) * 100) === 100;
              }).length;
              
              return logs.map((entry, idx) => {
                let c = 0, q = 0;
                if (entry.sections) entry.sections.forEach(s => { c += (s.correct || 0); q += (s.total || 0); });
                let pct = q > 0 ? Math.round((c / q) * 100) : 0;
                
                let compLabel = '';
                if (pct === 100) {
                  if (currentCompletion > 1) compLabel = `<span style="font-size:0.6rem; opacity:0.8; margin-left:4px;">(#${currentCompletion})</span>`;
                  currentCompletion--;
                }
                
                return `
              <tr>
                <td class="bulk-checkbox-col" style="padding-right:0;"><input type="checkbox" class="bulk-history-cb" value="${entry.id}"></td>
                <td style="color:var(--text-secondary);">
                  ${entry.date}
                  <span style="display:block; font-size:0.75rem; opacity:0.7;">${entry.time || ''}</span>
                </td>
                <td style="font-weight:600;">Version ${logs.length - idx} ${entry.isArchived ? '<span class="badge badge-neutral" style="font-size:0.6rem;">Archived</span>' : ''}</td>
                <td>
                  <span class="score-badge ${pct === 100 ? 'score-perfect' : 'score-partial'}">
                    ${pct}% ${compLabel}
                  </span>
                </td>
                <td style="text-align:right; color:var(--text-secondary);">${formatTimeDisplay(entry.duration)}</td>
                <td style="text-align:center;">
                  <button onclick="viewNotebookHistory('${entry.id}')" class="btn btn-ghost" title="View Attempt">
                    <i data-lucide="eye" style="width:16px;height:16px;color:var(--color-primary);"></i>
                  </button>
                  <button onclick="deleteNotebookHistoryLog('${entry.id}', '${notebookId}')" class="btn btn-ghost" title="Delete Log">
                    <i data-lucide="trash-2" style="width:16px;height:16px;color:var(--color-danger);"></i>
                  </button>
                </td>
              </tr>
            `;
              }).join('');
            })()}
          </tbody>
        </table>
      </div>
    </div>
  `;
  lucide.createIcons();

  const toggleBtn = document.getElementById('toggle-bulk-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const delBtn = document.getElementById('bulk-delete-btn');
      if (delBtn) delBtn.style.display = delBtn.style.display === 'none' ? 'inline-flex' : 'none';
    });
  }
}

function viewNotebookHistory(id) {
  setSessionParam('reviewNotebookRecordId', id);
  spaNavigate('notes-practice');
}

function deleteNotebookHistoryLog(id, notebookId) {
  showConfirm("Delete Record", "Are you sure you want to delete this history record?", () => {
    state.notebookHistory = state.notebookHistory.filter(h => h.id !== id);
    saveData();
    renderNotebookHistoryDetailView(notebookId);
    renderHistory();
  });
}

function bulkDeleteNotebookSelected(notebookId) {
  const selected = Array.from(document.querySelectorAll('.bulk-history-cb:checked')).map(cb => cb.value);
  if (selected.length === 0) {
    showMessage("No Selection", "Please select at least one history entry to delete.", true);
    return;
  }
  showConfirm("Delete Selected", `Are you sure you want to delete ${selected.length} selected record(s)?`, () => {
    state.notebookHistory = state.notebookHistory.filter(h => !selected.includes(h.id));
    saveData();
    renderNotebookHistoryDetailView(notebookId);
    renderHistory();
  });
}

// ======================== BULK RESET LIBRARY ITEMS ========================
function toggleBulkResetMode() {
  bulkResetMode = !bulkResetMode;
  renderHistory();
}

function selectAllBulkReset() {
  const cbs = document.querySelectorAll('.bulk-reset-cb');
  const allChecked = Array.from(cbs).every(cb => cb.checked);
  cbs.forEach(cb => cb.checked = !allChecked);
}

function executeBulkReset() {
  const selectedIds = Array.from(document.querySelectorAll('.bulk-reset-cb:checked')).map(cb => cb.value);
  
  if (selectedIds.length === 0) {
    if (typeof showMessage === 'function') showMessage("No Selection", "Please select at least one item to reset.", true);
    return;
  }

  const typeLabel = activeAnalyticsTab === 'training' ? 'notebooks' : 'challenges';

  if (typeof showConfirm === 'function') {
    showConfirm("Bulk Reset Progress", `Are you sure you want to reset the progress for ${selectedIds.length} selected ${typeLabel}?\n\nPast history will be kept, but the items will be marked as incomplete.`, () => {
      
      if (activeAnalyticsTab === 'practice') {
        state.history.forEach(h => {
          if (selectedIds.includes(h.challengeId)) h.isArchived = true;
        });
        // Reset active attempts too
        selectedIds.forEach(id => {
          if (state.activeAttempts) delete state.activeAttempts[id];
        });
      } else {
        state.notebookHistory.forEach(h => {
          if (selectedIds.includes(h.notebookId)) h.isArchived = true;
        });
      }
      
      saveData();
      bulkResetMode = false;
      
      // If we had a detail view open for one of the deleted items, clear it
      if (activeHistoryChallengeId && selectedIds.includes(activeHistoryChallengeId)) activeHistoryChallengeId = null;
      if (activeNotebookHistoryId && selectedIds.includes(activeNotebookHistoryId)) activeNotebookHistoryId = null;
      
      if (!activeHistoryChallengeId && !activeNotebookHistoryId) {
        const container = document.getElementById('analytics-detail-container');
        if (container) {
          container.innerHTML = `<div class="empty-state" style="height: 100%; display: flex; align-items: center; justify-content: center; flex-direction: column;"><i data-lucide="bar-chart-3" style="width: 48px; height: 48px; opacity: 0.5; margin-bottom: 1rem;"></i><h2>Select an item</h2><p style="font-size: 0.875rem; color: var(--text-tertiary); margin-top: 0.5rem;">Choose an item from the left pane to view its practice history.</p></div>`;
          if (typeof lucide !== 'undefined') lucide.createIcons();
        }
      } else {
        if (activeHistoryChallengeId) renderHistoryDetail(activeHistoryChallengeId);
        if (activeNotebookHistoryId) renderNotebookHistoryDetailView(activeNotebookHistoryId);
      }
      
      renderHistory();
      if (typeof showMessage === 'function') showMessage("Progress Reset", `History for ${selectedIds.length} items has been wiped.`, false);
    });
  }
}