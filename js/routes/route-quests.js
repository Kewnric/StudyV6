/* Route: quests */
function questTemplate() {
  return `
    <div class="messenger-layout">
      <div class="system-status-bar">
        <div class="system-status-left">
          <span class="system-status-title">Player Status</span>
          <span class="system-status-level" id="player-level-display">Lv. 1</span>
        </div>
        <div class="system-status-xp-container">
          <div style="display: flex; justify-content: space-between;">
            <span class="quest-job-label" id="player-job-display">Job: Shadow Monarch</span>
            <span class="system-xp-text" id="player-xp-display">0 / 100 XP</span>
          </div>
          <div class="system-xp-bar-bg"><div class="system-xp-bar-fill" id="player-xp-bar" style="width: 0%;"></div></div>
        </div>
      </div>
      <div style="display: flex; flex: 1; overflow: hidden;">
        <main class="messenger-pane-1" style="height: 100%;">
          <div class="pane-1-header" style="padding-bottom: 0;">
            <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; margin-bottom: 1rem;">
              <h2 style="font-size: 1.25rem; font-weight: 800; display: flex; align-items: center; gap: 0.5rem;">
                <i data-lucide="scroll-text" style="color: var(--color-primary);"></i> Quest Board
              </h2>
              <button class="btn btn-ghost btn-sm" onclick="createNewQuest()" title="Create New Quest"><i data-lucide="plus"></i></button>
            </div>
            <div class="study-tabs" style="margin: 0; border-bottom: none;">
              <button class="study-tab active" id="tab-ongoing" onclick="setQuestTab('ongoing')" style="flex:1; justify-content:center;"><i data-lucide="swords"></i> Ongoing</button>
              <button class="study-tab" id="tab-pending" onclick="setQuestTab('pending')" style="flex:1; justify-content:center;"><i data-lucide="clock"></i> Pending</button>
              <button class="study-tab" id="tab-completed" onclick="setQuestTab('completed')" style="flex:1; justify-content:center;"><i data-lucide="check-circle-2"></i> Completed</button>
            </div>
          </div>
          <div class="pane-1-content" id="quest-list-container" style="padding-top: 1rem;"></div>
        </main>
        <div class="resizer-divider" onmousedown="initResizerDrag(event, this)"></div>
        <section class="messenger-pane-2">
          <div id="quest-details-container" style="padding: 2rem; min-height: 100%; display: flex; flex-direction: column;">
            <div class="empty-state" style="height: 100%; flex: 1; display: flex; align-items: center; justify-content: center; flex-direction: column;">
              <i data-lucide="target" style="width: 48px; height: 48px; opacity: 0.5; margin-bottom: 1rem;"></i>
              <h2>Select a Quest</h2>
              <p style="font-size: 0.875rem; color: var(--text-tertiary); margin-top: 0.5rem;">Choose a quest from the left pane to view its details, or create a new one.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
    <div id="system-overlay" class="system-overlay">
      <div class="system-message-box">
        <div id="system-msg-title" class="system-msg-title">QUEST COMPLETED</div>
        <div id="system-msg-desc" class="system-msg-desc">You have completed the quest.</div>
        <div id="system-msg-rewards" class="system-msg-rewards"></div>
        <button class="btn-system" onclick="closeSystemOverlay()">CONFIRM</button>
      </div>
    </div>
  `;
}
function questInit() {
  if (typeof initQuestBoard === 'function') initQuestBoard();
}
function questDestroy() { if (window.questGlobalTimer) { clearInterval(window.questGlobalTimer); window.questGlobalTimer = null; } }
