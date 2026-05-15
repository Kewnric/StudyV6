/* ============================================================
   QUEST-BOARD.JS — Solo Leveling / SAO System Logic
   ============================================================ */

// (Removed QUEST_STORAGE_KEY constant, using getQuestStorageKey() instead)

let questState = {
  player: {
    level: 1,
    xp: 0,
    job: 'Shadow Monarch',
    title: 'None'
  },
  quests: [],
  activeTab: 'ongoing', // 'ongoing', 'pending', 'completed'
  activeQuestId: null,
  isEditMode: false,
  isActionMode: false,
  lastLoginDate: new Date().toDateString()
};

const XP_BASE = 100;
function getXPForNextLevel(level) {
  return Math.floor(XP_BASE * Math.pow(1.5, level - 1));
}

function getRankColor(rank) {
  const map = { 'E': '#94a3b8', 'D': '#22c55e', 'C': '#3b82f6', 'B': '#a855f7', 'A': '#f97316', 'S': '#ef4444' };
  return map[rank] || map['E'];
}

// ============================================================
// DATA MODELS & PERSISTENCE
// ============================================================
function generateItem() {
  return {
    id: generateId(),
    text: '',
    desc: '',
    done: false,
    expanded: true,
    timer: { durationMs: 0, elapsedMs: 0, date: null },
    children: []
  };
}

function migrateOldData(oldQuests) {
  return oldQuests.map(q => {
    if (!q.rank) q.rank = 'E';
    if (!q.type) q.type = 'main';
    if (q.xpReward === undefined) q.xpReward = 50;
    
    // Convert old timers
    const convertTimers = (items) => {
      items.forEach(item => {
        if (item.timer && item.timer.durationMs === undefined) {
          let ms = ((item.timer.d || 0)*86400 + (item.timer.h || 0)*3600 + (item.timer.m || 0)*60 + (item.timer.s || 0)) * 1000;
          item.timer = { durationMs: ms, elapsedMs: 0, date: item.timer.date || null };
        }
        if (item.children) convertTimers(item.children);
      });
    }
    if (q.checklist) convertTimers(q.checklist);
    return q;
  });
}

function loadQuestData() {
  try {
    const raw = localStorage.getItem(getQuestStorageKey()) || localStorage.getItem('questBoardData_v2');
    if (raw) {
      const data = JSON.parse(raw);
      questState.quests = migrateOldData(data.quests || []);
      if (data.player) questState.player = data.player;
      if (data.lastLoginDate) questState.lastLoginDate = data.lastLoginDate;
    }
    checkDailyReset();
  } catch (e) {
    console.error('Failed to load quest data:', e);
  }
}

function saveQuestData() {
  try {
    questState.lastLoginDate = new Date().toDateString();
    localStorage.setItem(getQuestStorageKey(), JSON.stringify({
      quests: questState.quests,
      player: questState.player,
      lastLoginDate: questState.lastLoginDate
    }));
  } catch (e) {
    console.error('Failed to save quest data:', e);
  }
  if (typeof scheduleCloudSave === 'function') scheduleCloudSave();
}

function checkDailyReset() {
  const today = new Date().toDateString();
  if (questState.lastLoginDate !== today) {
    let resetOccurred = false;
    questState.quests.forEach(q => {
      if (q.type === 'daily') {
        q.status = 'pending';
        q.ongoingAt = null;
        q.completedAt = null;
        resetChecklist(q.checklist);
        resetOccurred = true;
      }
    });
    if (resetOccurred) {
      saveQuestData();
      showSystemOverlay('DAILY RESET', 'Your daily quests have been reset.', []);
    }
  }
}

function resetChecklist(items) {
  items.forEach(item => {
    item.done = false;
    if (item.timer) item.timer.elapsedMs = 0;
    if (item.children) resetChecklist(item.children);
  });
}

// ============================================================
// INITIALIZATION & PLAYER STATUS
// ============================================================
function initQuestBoard() {
  const _withSuppress = (fn) => (typeof withCloudSaveSuppressed === 'function') ? withCloudSaveSuppressed(fn) : fn();
  _withSuppress(() => {
    loadQuestData();
    renderPlayerStatus();
    setQuestTab('ongoing');
  });
  startGlobalCountdownLoop();
}

function renderPlayerStatus() {
  const p = questState.player;
  const levelEl = document.getElementById('player-level-display');
  const jobEl = document.getElementById('player-job-display');
  const xpEl = document.getElementById('player-xp-display');
  const xpBar = document.getElementById('player-xp-bar');
  
  if (levelEl) levelEl.textContent = `Lv. ${p.level}`;
  if (jobEl) jobEl.textContent = `Job: ${p.job}`;
  
  const needed = getXPForNextLevel(p.level);
  if (xpEl) xpEl.textContent = `${p.xp} / ${needed} XP`;
  
  if (xpBar) {
    const pct = Math.min(100, Math.max(0, (p.xp / needed) * 100));
    xpBar.style.width = `${pct}%`;
  }
}

function addXP(amount) {
  questState.player.xp += parseInt(amount);
  let needed = getXPForNextLevel(questState.player.level);
  let leveledUp = false;
  
  while (questState.player.xp >= needed) {
    questState.player.xp -= needed;
    questState.player.level++;
    leveledUp = true;
    needed = getXPForNextLevel(questState.player.level);
  }
  
  saveQuestData();
  renderPlayerStatus();
  return leveledUp;
}

// ============================================================
// LEFT PANE (LIST) LOGIC
// ============================================================
function setQuestTab(tabName) {
  questState.activeTab = tabName;
  document.querySelectorAll('.study-tab').forEach(el => el.classList.remove('active'));
  const activeTabEl = document.getElementById(`tab-${tabName}`);
  if (activeTabEl) activeTabEl.classList.add('active');
  renderQuestList();
}

function renderQuestList() {
  const container = document.getElementById('quest-list-container');
  if (!container) return;

  const filtered = questState.quests.filter(q => q.status === questState.activeTab || (questState.activeTab === 'ongoing' && q.status === 'penalty'));

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p style="font-size:0.875rem; color:var(--text-tertiary);">No ${questState.activeTab} quests.</p>
      </div>`;
    return;
  }

  let html = '';
  for (let q of filtered) {
    const isActive = q.id === questState.activeQuestId;
    const isPenalty = q.status === 'penalty';
    html += `
      <div class="quest-card ${isActive ? 'active' : ''} ${isPenalty ? 'penalty' : ''}" onclick="selectQuest('${q.id}')">
        <div class="quest-card-header">
          <span class="rank-badge rank-${q.rank}">${q.rank}</span>
          <div class="quest-card-title">${escapeHTML(q.title) || 'Untitled'}</div>
          ${q.type !== 'main' ? `<span class="quest-type-badge ${q.type}">${q.type}</span>` : ''}
        </div>
        ${q.description ? `<div class="quest-card-desc">${escapeHTML(q.description)}</div>` : ''}
        ${isPenalty ? `<div style="color: #ef4444; font-size: 0.75rem; font-weight: 700; margin-top: 0.25rem;">PENALTY ZONE ACTIVE</div>` : ''}
      </div>
    `;
  }
  container.innerHTML = html;
}

// ============================================================
// RIGHT PANE (DETAILS) LOGIC
// ============================================================
function selectQuest(questId) {
  questState.activeQuestId = questId;
  questState.isEditMode = false;
  questState.isActionMode = false;
  renderQuestList();
  renderQuestDetails();
}

function toggleActionMode() {
  questState.isActionMode = !questState.isActionMode;
  renderQuestDetails();
}

function createNewQuest() {
  const q = {
    id: generateId(),
    title: 'New Quest',
    rank: 'E',
    type: 'main',
    xpReward: 50,
    reward: '',
    punishment: '',
    description: '',
    status: 'pending',
    createdAt: new Date().toISOString(),
    ongoingAt: null,
    completedAt: null,
    checklist: [generateItem()]
  };
  questState.quests.push(q);
  saveQuestData();
  
  questState.activeTab = 'pending';
  setQuestTab('pending');
  questState.activeQuestId = q.id;
  questState.isEditMode = true;
  renderQuestDetails();
}

function enterEditMode() {
  const q = questState.quests.find(q => q.id === questState.activeQuestId);
  if (!q) return;

  if (q.status === 'ongoing' || q.status === 'penalty') {
    showConfirm('Edit Active Quest', 'Editing will pause the quest and save elapsed time. Continue?', () => {
      pauseQuestTimers(q);
      q.status = 'pending';
      q.ongoingAt = null;
      saveQuestData();
      setQuestTab('pending');
      questState.isEditMode = true;
      renderQuestDetails();
    });
  } else {
    questState.isEditMode = true;
    renderQuestDetails();
  }
}

function pauseQuestTimers(q) {
  if (!q.ongoingAt) return;
  const now = Date.now();
  const elapsedSinceStart = now - new Date(q.ongoingAt).getTime();
  
  const addElapsed = (items) => {
    items.forEach(item => {
      if (item.timer && item.timer.durationMs > 0 && !item.done) {
        item.timer.elapsedMs += elapsedSinceStart;
      }
      if (item.children) addElapsed(item.children);
    });
  }
  addElapsed(q.checklist);
}

function cancelEditMode() {
  questState.isEditMode = false;
  renderQuestDetails();
}

function saveEditMode() {
  const q = questState.quests.find(q => q.id === questState.activeQuestId);
  if (q) updateParentStatuses(q.checklist);
  saveQuestData();
  questState.isEditMode = false;
  renderQuestDetails();
  renderQuestList();
}

function deleteActiveQuest() {
  showConfirm('Delete Quest', 'Permanently delete this quest?', () => {
    questState.quests = questState.quests.filter(q => q.id !== questState.activeQuestId);
    questState.activeQuestId = null;
    saveQuestData();
    renderQuestList();
    renderQuestDetails();
  });
}

function updateQuestField(field, value) {
  const q = questState.quests.find(q => q.id === questState.activeQuestId);
  if (q) q[field] = value;
}

// STATUS TRANSITIONS
function setQuestStatus(status) {
  const q = questState.quests.find(q => q.id === questState.activeQuestId);
  if (!q) return;
  
  if (status === 'ongoing') {
    q.ongoingAt = new Date().toISOString();
    q.completedAt = null;
  } else if (status === 'completed') {
    q.completedAt = new Date().toISOString();
    completeQuest(q);
  } else if (status === 'pending') {
    pauseQuestTimers(q);
    q.ongoingAt = null;
    q.completedAt = null;
  }
  
  q.status = status;
  questState.isActionMode = false;
  saveQuestData();
  setQuestTab(status === 'penalty' ? 'ongoing' : status);
  renderQuestDetails();
}

function completeQuest(q) {
  const leveledUp = addXP(q.xpReward);
  let title = leveledUp ? 'LEVEL UP!' : 'QUEST COMPLETED';
  let rewards = [
    `+${q.xpReward} XP`
  ];
  if (q.reward) rewards.push(q.reward);
  
  showSystemOverlay(title, `You completed: ${q.title}`, rewards, leveledUp);
}

// --- MAIN RENDERER ---
function renderQuestDetails() {
  const container = document.getElementById('quest-details-container');
  if (!container) return;

  const q = questState.quests.find(q => q.id === questState.activeQuestId);
  
  if (!q) {
    container.innerHTML = `
      <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;">
        <h2 style="color: rgba(0, 168, 255, 0.5); letter-spacing: 2px;">SYSTEM STANDBY</h2>
        <p style="color: #64748b; font-size: 0.85rem;">Select a quest from the interface.</p>
      </div>`;
    return;
  }

  container.innerHTML = questState.isEditMode ? renderEditForm(q) : renderViewLayout(q);
  lucide.createIcons();
}

// ============================================================
// VIEW MODE
// ============================================================
function renderViewLayout(q) {
  const eyeIcon = questState.isActionMode ? 'eye-off' : 'eye';

  let actionButtons = '';
  if (q.status === 'pending') {
    actionButtons = `<button class="btn btn-primary" style="padding: 0.5rem 1.5rem;" onclick="setQuestStatus('ongoing')">Accept Quest</button>`;
  } else if (q.status === 'ongoing' || q.status === 'penalty') {
    actionButtons = `<button class="btn btn-ghost btn-icon" title="Toggle Action Mode" onclick="toggleActionMode()" style="${questState.isActionMode ? 'color: var(--color-primary); filter: drop-shadow(0 0 8px var(--color-primary-glow));' : 'color: var(--text-tertiary);'}">
      <i data-lucide="${eyeIcon}"></i>
    </button>`;
  } else {
    actionButtons = `<button class="btn btn-secondary" onclick="setQuestStatus('pending')">Restart</button>`;
  }

  return `
    <div class="quest-detail-header">
      <div style="flex:1;">
        <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem;">
          <span class="rank-badge rank-${q.rank}">Rank ${q.rank}</span>
          <span class="quest-type-badge ${q.type}">${q.type}</span>
          <span class="quest-meta-label" style="margin-left: auto;">Reward: ${q.xpReward} XP</span>
        </div>
        <h2 class="quest-detail-title" style="${q.status === 'penalty' ? 'color: #ef4444; text-shadow: 0 0 10px #ef4444;' : ''}">
          ${q.status === 'penalty' ? '[PENALTY] ' : ''}${escapeHTML(q.title)}
        </h2>
      </div>
      <div style="display:flex; gap:0.5rem; flex-shrink:0;">
        <button class="btn btn-ghost btn-icon" onclick="enterEditMode()" title="Edit Quest" style="color: #00a8ff;">
          <i data-lucide="pencil"></i>
        </button>
        <button class="btn btn-ghost btn-icon" onclick="deleteActiveQuest()" style="color:#ef4444;" title="Delete">
          <i data-lucide="trash-2"></i>
        </button>
      </div>
    </div>

    <div style="display:flex; gap:2rem; flex-wrap:wrap; margin-bottom:1.5rem; padding-bottom:1.5rem; border-bottom:1px solid rgba(0,168,255,0.2);">
      <div style="flex:1; min-width:300px;">
        <p style="font-size:0.95rem; color:#cbd5e1; white-space:pre-wrap; line-height:1.6;">${escapeHTML(q.description) || '<em style="color:#64748b;">No description.</em>'}</p>
      </div>
    </div>

    <div style="margin-bottom:1rem; display:flex; justify-content:space-between; align-items:center;">
      <h3 style="font-size:1.1rem; font-weight:800; color:#00f0ff; letter-spacing:1px;">
        QUEST OBJECTIVES
      </h3>
      ${actionButtons}
    </div>

    <div class="cl-tree-container" style="margin-bottom: 2rem; flex: 1;">
      ${q.checklist.length === 0 ? '<div style="color:#64748b;">No objectives defined.</div>' : renderChecklistView(q.checklist, q)}
    </div>

    <div style="display:flex; gap:1rem; width:100%; margin-top:auto;">
      <div class="system-reward-box" onclick="showSystemModal('Reward', '${escapeHTML(q.reward || 'None')}')">
        <i data-lucide="award" style="color: #10b981; width: 24px; height: 24px;"></i>
        <div>
          <div style="font-size: 0.7rem; font-weight: 800; color: #10b981; letter-spacing: 1px;">REWARD</div>
          <div style="color: #fff; font-weight: 600;">${escapeHTML(q.reward) || 'None'}</div>
        </div>
      </div>
      <div class="system-punish-box" onclick="showSystemModal('Penalty', '${escapeHTML(q.punishment || 'Penalty Zone')}')">
        <i data-lucide="skull" style="color: #ef4444; width: 24px; height: 24px;"></i>
        <div>
          <div style="font-size: 0.7rem; font-weight: 800; color: #ef4444; letter-spacing: 1px;">PENALTY</div>
          <div style="color: #fff; font-weight: 600;">${escapeHTML(q.punishment) || 'Penalty Zone'}</div>
        </div>
      </div>
    </div>
  `;
}

window.showSystemModal = function(title, msg) {
  const modal = document.getElementById('dialog-modal');
  document.getElementById('dialog-title').textContent = title.toUpperCase();
  document.getElementById('dialog-msg').textContent = msg;
  document.getElementById('dialog-icon').innerHTML = '';
  document.getElementById('dialog-actions').innerHTML = `<button class="btn-system" onclick="document.getElementById('dialog-modal').classList.add('hidden')">CLOSE</button>`;
  modal.classList.remove('hidden');
}

function renderChecklistView(items, quest, level = 0) {
  let html = '';
  const isInteractive = quest.status === 'ongoing' || quest.status === 'penalty';

  for (let item of items) {
    const hasChildren = item.children && item.children.length > 0;
    const isLeaf = !hasChildren;
    const canCheck = isInteractive && isLeaf && questState.isActionMode;

    const expandIcon = hasChildren 
      ? `<i data-lucide="${item.expanded ? 'chevron-down' : 'chevron-right'}" class="cl-expander" onclick="toggleExpand('${item.id}')"></i>` 
      : `<span style="width:18px; display:inline-block; flex-shrink:0;"></span>`;

    let checkHTML = '';
    if (!isLeaf) {
      if (item.done) {
        checkHTML = `<i data-lucide="check-circle-2" style="color:#10b981; width:20px; height:20px; margin-top:2px; flex-shrink:0; filter: drop-shadow(0 0 6px rgba(16, 185, 129, 0.8));"></i>`;
      } else {
        checkHTML = `<i data-lucide="circle-alert" style="color:#fbbf24; width:20px; height:20px; margin-top:2px; flex-shrink:0; filter: drop-shadow(0 0 6px rgba(251, 191, 36, 0.8));"></i>`;
      }
    } else {
      checkHTML = `
        <label class="quest-checkbox-label ${canCheck ? 'clickable' : ''}" style="margin-top:2px;" ${canCheck ? `onclick="event.preventDefault(); toggleItemDone('${item.id}')"` : ''}>
          <input type="checkbox" ${item.done ? 'checked' : ''} ${canCheck ? '' : 'disabled'} />
          <span class="quest-checkbox-custom"></span>
        </label>
      `;
    }

    html += `
      <div class="cl-item-row ${item.done ? 'done' : ''}">
        <div class="cl-item-main">
          ${expandIcon}
          ${checkHTML}
          <div class="cl-item-content">
            <div class="cl-item-title">${escapeHTML(item.text) || 'Unknown Objective'}</div>
            ${item.desc ? `<div class="cl-item-desc">${escapeHTML(item.desc)}</div>` : ''}
          </div>
          ${getTimerDisplayHTML(item, quest)}
        </div>
      </div>
    `;

    if (hasChildren && item.expanded) {
      html += `<div class="cl-children">${renderChecklistView(item.children, quest, level + 1)}</div>`;
    }
  }
  return html;
}

// ============================================================
// EDIT MODE
// ============================================================
function renderEditForm(q) {
  return `
    <div class="quest-detail-header" style="flex-direction:column; gap:1rem;">
      <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
        <h2 class="quest-detail-title" style="margin:0; font-size:1.5rem;">EDIT SYSTEM QUEST</h2>
        <div style="display:flex; gap:0.5rem;">
          <button class="btn-system" style="border-color:#64748b; color:#64748b;" onclick="cancelEditMode()">CANCEL</button>
          <button class="btn-system" onclick="saveEditMode()">SAVE</button>
        </div>
      </div>
      
      <div style="width:100%; display:flex; flex-direction:column; gap:1rem;">
        <div>
          <label class="quest-meta-label">Quest Title</label>
          <input type="text" class="system-input" style="width:100%; font-size:1.2rem; font-weight:800;" value="${escapeHTML(q.title)}" oninput="updateQuestField('title', this.value)" />
        </div>
        
        <div style="display:flex; gap:1rem; flex-wrap:wrap;">
          <div style="flex:1; min-width:150px;">
            <label class="quest-meta-label">Rank</label>
            <select class="system-input" style="width:100%;" onchange="updateQuestField('rank', this.value)">
              ${['E','D','C','B','A','S'].map(r => `<option value="${r}" ${q.rank === r ? 'selected' : ''}>Rank ${r}</option>`).join('')}
            </select>
          </div>
          <div style="flex:1; min-width:150px;">
            <label class="quest-meta-label">Type</label>
            <select class="system-input" style="width:100%;" onchange="updateQuestField('type', this.value)">
              <option value="main" ${q.type === 'main' ? 'selected' : ''}>Main Quest</option>
              <option value="daily" ${q.type === 'daily' ? 'selected' : ''}>Daily Quest</option>
              <option value="hidden" ${q.type === 'hidden' ? 'selected' : ''}>Hidden Quest</option>
            </select>
          </div>
          <div style="flex:1; min-width:150px;">
            <label class="quest-meta-label">XP Reward</label>
            <input type="number" class="system-input" style="width:100%;" value="${q.xpReward}" oninput="updateQuestField('xpReward', parseInt(this.value)||0)" />
          </div>
        </div>

        <div style="display:flex; gap:1rem;">
          <div style="flex:1;">
            <label class="quest-meta-label">Item Reward</label>
            <input type="text" class="system-input" style="width:100%;" value="${escapeHTML(q.reward)}" oninput="updateQuestField('reward', this.value)" />
          </div>
          <div style="flex:1;">
            <label class="quest-meta-label">Penalty</label>
            <input type="text" class="system-input" style="width:100%;" value="${escapeHTML(q.punishment)}" oninput="updateQuestField('punishment', this.value)" />
          </div>
        </div>
        <div>
          <label class="quest-meta-label">Description</label>
          <textarea class="system-input" style="width:100%;" rows="3" oninput="updateQuestField('description', this.value)">${escapeHTML(q.description)}</textarea>
        </div>
      </div>
    </div>

    <div style="margin-bottom:1rem; display:flex; justify-content:space-between; align-items:center;">
      <h3 style="font-size:1.1rem; font-weight:800; color:#00f0ff;"><i data-lucide="list-checks"></i> OBJECTIVES</h3>
      <button class="btn-system" style="padding: 0.4rem 1rem; font-size: 0.8rem;" onclick="addClChild(null)">ADD TARGET</button>
    </div>

    <div class="cl-tree-container">
      ${q.checklist.length === 0 ? '<div style="color:#64748b;">No objectives. Add one to begin.</div>' : renderChecklistEdit(q.checklist)}
    </div>
  `;
}

function renderChecklistEdit(items, level = 0) {
  let html = '';
  for (let item of items) {
    const hasChildren = item.children && item.children.length > 0;
    
    // Convert durationMs back to h, m, s for UI edit
    let totalSecs = Math.floor((item.timer.durationMs || 0) / 1000);
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;

    html += `
      <div class="cl-edit-box">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem; gap:1rem;">
          <input type="text" class="system-input" style="font-weight:700; flex:1;" value="${escapeHTML(item.text)}" oninput="updateClField('${item.id}', 'text', this.value)" placeholder="Target Title" />
          <button class="btn btn-ghost btn-sm btn-icon" onclick="removeClItem('${item.id}')" style="color:#ef4444;"><i data-lucide="trash-2"></i></button>
        </div>
        <textarea class="system-input" style="width:100%; margin-bottom:1rem;" rows="2" oninput="updateClField('${item.id}', 'desc', this.value)" placeholder="Target Details...">${escapeHTML(item.desc)}</textarea>
        
        <div class="cl-timer-edit-row">
          <div style="display:flex; flex-direction:column; align-items:center;">
            <span class="quest-meta-label" style="margin-bottom:0.25rem;">Hrs</span>
            <input type="number" min="0" class="system-input timer-input-big" value="${h}" oninput="updateClTimerDuration('${item.id}', 'h', this.value)" />
          </div>
          <span style="font-weight:900; font-size:1.5rem; color:rgba(0,168,255,0.3);">:</span>
          <div style="display:flex; flex-direction:column; align-items:center;">
            <span class="quest-meta-label" style="margin-bottom:0.25rem;">Min</span>
            <input type="number" min="0" max="59" class="system-input timer-input-big" value="${m}" oninput="updateClTimerDuration('${item.id}', 'm', this.value)" />
          </div>
          <span style="font-weight:900; font-size:1.5rem; color:rgba(0,168,255,0.3);">:</span>
          <div style="display:flex; flex-direction:column; align-items:center;">
            <span class="quest-meta-label" style="margin-bottom:0.25rem;">Sec</span>
            <input type="number" min="0" max="59" class="system-input timer-input-big" value="${s}" oninput="updateClTimerDuration('${item.id}', 's', this.value)" />
          </div>
          
          <div style="margin:0 1rem; color:#64748b; font-weight:800; font-size:0.75rem;">OR</div>
          
          <div style="display:flex; flex-direction:column; flex:1; min-width:200px;">
            <span class="quest-meta-label" style="margin-bottom:0.25rem;">Absolute Deadline</span>
            <input type="datetime-local" class="system-input" style="height:50px;" value="${item.timer.date || ''}" oninput="updateClField('${item.id}', 'timer.date', this.value)" />
          </div>
        </div>

        <div style="margin-top:1rem;">
          <button class="btn-system" style="padding: 0.3rem 0.8rem; font-size: 0.75rem; border-color: rgba(0,168,255,0.5);" onclick="addClChild('${item.id}')">ADD SUB-TARGET</button>
        </div>

        ${hasChildren ? `<div class="cl-edit-children">${renderChecklistEdit(item.children, level + 1)}</div>` : ''}
      </div>
    `;
  }
  return html;
}

// ============================================================
// CHECKLIST TREE MANIPULATION
// ============================================================
function findClItem(items, id) {
  for (let item of items) {
    if (item.id === id) return item;
    if (item.children) {
      let found = findClItem(item.children, id);
      if (found) return found;
    }
  }
  return null;
}

function removeClItemRecursive(items, id) {
  for (let i = 0; i < items.length; i++) {
    if (items[i].id === id) {
      items.splice(i, 1);
      return true;
    }
    if (items[i].children && removeClItemRecursive(items[i].children, id)) {
      return true;
    }
  }
  return false;
}

function updateClField(id, field, value) {
  const q = questState.quests.find(q => q.id === questState.activeQuestId);
  if (!q) return;
  const item = findClItem(q.checklist, id);
  if (item) {
    if (field === 'timer.date') item.timer.date = value;
    else item[field] = value;
  }
}

function updateClTimerDuration(id, unit, value) {
  const q = questState.quests.find(q => q.id === questState.activeQuestId);
  if (!q) return;
  const item = findClItem(q.checklist, id);
  if (!item) return;

  let totalSecs = Math.floor((item.timer.durationMs || 0) / 1000);
  let h = Math.floor(totalSecs / 3600);
  let m = Math.floor((totalSecs % 3600) / 60);
  let s = totalSecs % 60;

  const val = parseInt(value) || 0;
  if (unit === 'h') h = val;
  if (unit === 'm') m = val;
  if (unit === 's') s = val;

  item.timer.durationMs = (h * 3600 + m * 60 + s) * 1000;
}

function addClChild(parentId) {
  const q = questState.quests.find(q => q.id === questState.activeQuestId);
  if (!q) return;
  
  const newItem = generateItem();
  if (parentId === null) {
    q.checklist.push(newItem);
  } else {
    const parent = findClItem(q.checklist, parentId);
    if (parent) {
      parent.children.push(newItem);
      parent.expanded = true;
    }
  }
  renderQuestDetails();
}

function removeClItem(id) {
  const q = questState.quests.find(q => q.id === questState.activeQuestId);
  if (!q) return;
  removeClItemRecursive(q.checklist, id);
  renderQuestDetails();
}

function toggleExpand(id) {
  const q = questState.quests.find(q => q.id === questState.activeQuestId);
  if (!q) return;
  const item = findClItem(q.checklist, id);
  if (item) {
    item.expanded = !item.expanded;
    renderQuestDetails();
  }
}

function toggleItemDone(id) {
  const q = questState.quests.find(q => q.id === questState.activeQuestId);
  if (!q) return;
  const item = findClItem(q.checklist, id);
  if (!item) return;

  item.done = !item.done;

  const allDone = updateParentStatuses(q.checklist);

  if (allDone && q.checklist.length > 0 && (q.status === 'ongoing' || q.status === 'penalty')) {
    q.status = 'completed';
    q.completedAt = new Date().toISOString();
    setQuestTab('completed');
    completeQuest(q);
  } else {
    renderQuestDetails();
  }
  saveQuestData();
}

function updateParentStatuses(items) {
  if (!items || items.length === 0) return true;
  
  let allSiblingsDone = true;
  for (let item of items) {
    if (item.children && item.children.length > 0) {
      item.done = updateParentStatuses(item.children);
    }
    if (!item.done) {
      allSiblingsDone = false;
    }
  }
  return allSiblingsDone;
}

// ============================================================
// COUNTDOWN TIMER LOGIC
// ============================================================
function getDeadlineTime(item, quest) {
  if (item.timer.date) {
    return new Date(item.timer.date).getTime();
  }
  
  if (!item.timer.durationMs) return null;

  if (quest.status !== 'ongoing' && quest.status !== 'penalty') {
    return null; // Don't return deadline if not active
  }

  // deadline = now + (duration - elapsedSinceLastStart - savedElapsed)
  // Which simplifies to:
  const start = new Date(quest.ongoingAt).getTime();
  const alreadyElapsed = item.timer.elapsedMs || 0;
  return start + (item.timer.durationMs - alreadyElapsed);
}

function getTimerDisplayHTML(item, quest) {
  const targetTime = getDeadlineTime(item, quest);
  
  if (!targetTime) {
    if (item.timer.durationMs > 0) {
      const ms = item.timer.durationMs - (item.timer.elapsedMs || 0);
      if (ms <= 0) return `<div class="system-timer-display overdue">OVERDUE</div>`;
      
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      const text = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
      return `<div class="system-timer-display" style="opacity:0.5;" title="Timer starts when quest is Ongoing"><i data-lucide="pause-circle" style="width:14px;height:14px;display:inline-block;vertical-align:-3px;margin-right:4px;"></i>${text}</div>`;
    }
    return '';
  }

  const isOngoing = quest.status === 'ongoing' || quest.status === 'penalty';
  return `<div class="system-timer-display" data-countdown-target="${targetTime}" data-quest-id="${quest.id}">--:--:--</div>`;
}

function startGlobalCountdownLoop() {
  if (window.questGlobalTimer) clearInterval(window.questGlobalTimer);
  window.questGlobalTimer = setInterval(() => {
    const displays = document.querySelectorAll('[data-countdown-target]');
    const now = Date.now();
    let requiresRender = false;

    displays.forEach(el => {
      const targetTime = parseInt(el.getAttribute('data-countdown-target'), 10);
      const questId = el.getAttribute('data-quest-id');
      const diff = targetTime - now;

      const row = el.closest('.cl-item-row');
      const isDone = row && row.classList.contains('done');

      if (isDone) {
        if (el.textContent !== 'CLEARED') {
          el.textContent = 'CLEARED';
          el.style.color = '#10b981';
          el.style.borderColor = 'rgba(16, 185, 129, 0.4)';
          el.style.background = 'transparent';
          el.classList.remove('overdue');
        }
        return;
      }

      if (diff <= 0) {
        if (el.textContent !== 'OVERDUE') {
          el.textContent = 'OVERDUE';
          el.classList.add('overdue');
          
          // Trigger Penalty Zone if quest isn't already
          const q = questState.quests.find(q => q.id === questId);
          if (q && q.status === 'ongoing') {
            q.status = 'penalty';
            saveQuestData();
            requiresRender = true;
          }
        }
        return;
      }

      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);

      const text = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
      if (el.textContent !== text) {
        el.textContent = text;
      }
    });

    if (requiresRender) {
      renderQuestList();
      renderQuestDetails();
    }
  }, 1000);
}

// ============================================================
// SYSTEM OVERLAYS
// ============================================================
function showSystemOverlay(title, desc, rewards, isLevelUp = false) {
  const overlay = document.getElementById('system-overlay');
  const titleEl = document.getElementById('system-msg-title');
  const descEl = document.getElementById('system-msg-desc');
  const rewardsEl = document.getElementById('system-msg-rewards');

  titleEl.textContent = title;
  if (isLevelUp) {
    titleEl.classList.add('level-up');
  } else {
    titleEl.classList.remove('level-up');
  }

  descEl.textContent = desc;

  rewardsEl.innerHTML = rewards.map(r => `<div class="system-reward-item">${escapeHTML(r)}</div>`).join('');

  overlay.classList.add('active');
}

window.closeSystemOverlay = function() {
  document.getElementById('system-overlay').classList.remove('active');
}
