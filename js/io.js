/* ============================================================
   IO.JS — Import / Export Handlers
   ============================================================ */

function handleDataExport() {
  const data = {
    // New tree system
    nodes: state.nodes,
    expandedNodes: state.expandedNodes,
    // Legacy (backward compat)
    categories: getNodeNamesForScope('challenge'),
    snippetCategories: getNodeNamesForScope('snippet'),
    notebookCategories: getNodeNamesForScope('notebook'),
    // Existing
    categoryRequirements: state.categoryRequirements,
    snippetProgress: state.snippetProgress,
    badges: state.badges,
    snippets: state.snippets,
    notebooks: state.notebooks,
    notebookHistory: state.notebookHistory,
    challenges: state.challenges,
    history: state.history,
    activeAttempts: state.activeAttempts
  };
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `code_platform_backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showMessage("Export Complete", "Your data has been downloaded as a JSON backup file.");
}

function handleDataImport(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (!file.name.endsWith('.json') && file.type !== 'application/json') {
    showMessage("Error", "Please select a valid .json backup file.", true);
    e.target.value = '';
    return;
  }

  showConfirm("Import Data", "This will overwrite all your current data (folders, challenges, snippets, history, badges). Are you sure?", () => {
    // Show loading state
    const importLabel = document.querySelector('label[for="import-input"], label .sidebar-label');
    const exportBtn = document.getElementById('export-btn-sidebar');
    if (exportBtn) exportBtn.disabled = true;

    const reader = new FileReader();

    reader.onerror = () => {
      if (exportBtn) exportBtn.disabled = false;
      showMessage("Error", "Failed to read the file. Please try again.", true);
    };

    reader.onload = (event) => {
      try {
        let parsed;
        try {
          parsed = JSON.parse(event.target.result);
        } catch (parseErr) {
          showMessage("Error", `Could not parse the file — it may be corrupted or not a valid JSON backup.\n\nDetails: ${parseErr.message}`, true);
          if (exportBtn) exportBtn.disabled = false;
          return;
        }

        if (!parsed || typeof parsed !== 'object') {
          showMessage("Error", "Invalid backup file format.", true);
          if (exportBtn) exportBtn.disabled = false;
          return;
        }

        if (!parsed.challenges) {
          showMessage("Error", "Invalid backup file: missing required 'challenges' field. This may not be a StudySession Pro backup.", true);
          if (exportBtn) exportBtn.disabled = false;
          return;
        }

        state.challenges = migrateLegacyData(parsed.challenges);
        state.snippets = parsed.snippets || [];
        state.notebooks = parsed.notebooks || [];
        state.categoryRequirements = parsed.categoryRequirements || {};
        state.snippetProgress = parsed.snippetProgress || {};
        state.badges = parsed.badges || [];
        state.notebookHistory = parsed.notebookHistory || [];
        state.history = parsed.history || [];
        state.activeAttempts = parsed.activeAttempts || {};

        if (parsed.nodes && parsed.nodes.length > 0) {
          state.nodes = parsed.nodes;
          state.expandedNodes = parsed.expandedNodes || [];
        } else {
          state.categories = parsed.categories || ['Basics'];
          state.snippetCategories = parsed.snippetCategories || [];
          state.notebookCategories = parsed.notebookCategories || ['General'];
          state.nodes = migrateCategoriesToNodes(parsed);
          state.expandedNodes = [];
        }

        saveData();
        if (exportBtn) exportBtn.disabled = false;
        showMessage("Success", `Data imported successfully — ${state.challenges.length} programs, ${state.snippets.length} snippets, ${state.notebooks.length} notebooks loaded. The page will now reload.`);
        setTimeout(() => { window.location.hash = '#/home'; window.location.reload(); }, 1400);
      } catch (err) {
        console.error('[Import] Unexpected error:', err);
        if (exportBtn) exportBtn.disabled = false;
        showMessage("Error", `Import failed unexpectedly: ${err.message || String(err)}`, true);
      }
    };

    reader.readAsText(file);
  });

  e.target.value = '';
}

function handleDataReset() {
  showConfirm("Reset All Data", "⚠️ This will permanently delete ALL your programs, snippets, notebooks, and history. This cannot be undone.\n\nAre you sure you want to continue?", () => {
    showConfirm("Final Confirmation", "🚨 Last chance — are you absolutely certain? All data will be replaced with defaults and CANNOT be recovered.", () => {
      // Build the canonical default seed (shared with first-time boot)
      const seed = buildDefaultSeed();

      state = {
        view: 'browse',
        categories: getNodeNamesForScopeFromNodes(seed.nodes, 'challenge'),
        snippetCategories: getNodeNamesForScopeFromNodes(seed.nodes, 'snippet'),
        notebookCategories: getNodeNamesForScopeFromNodes(seed.nodes, 'notebook'),
        nodes: seed.nodes,
        expandedNodes: seed.expandedNodes,
        activeNodeId: null,
        categoryRequirements: seed.categoryRequirements,
        snippetProgress: seed.snippetProgress,
        badges: seed.badges,
        snippets: seed.snippets,
        notebooks: seed.notebooks,
        notebookHistory: seed.notebookHistory,
        challenges: seed.challenges,
        history: seed.history,
        activeAttempts: seed.activeAttempts,
        activeChallenge: null,
        activeVariant: null,
        userCode: '',
        sessionData: null,
        timeLimit: 0,
        lastDiffs: []
      };

      saveData();

      // If signed in to cloud, push the default seed to firestore so the user's
      // cloud storage also reflects the reset.
      if (typeof storageMode !== 'undefined' && storageMode === 'online' && typeof currentFirebaseUser !== 'undefined' && currentFirebaseUser && typeof saveToFirestore === 'function') {
        saveToFirestore(currentFirebaseUser.uid).catch(() => {});
      }

      // Clear auxiliary local data, but PRESERVE storageMode so the user doesn't
      // get bounced back to the picker on the reload.
      localStorage.removeItem('vizCanvasData');
      localStorage.removeItem('brainCanvasData');
      localStorage.removeItem('vizCanvasData_online');
      localStorage.removeItem('brainCanvasData_online');
      localStorage.removeItem('questBoardData');
      localStorage.removeItem('questBoardData_v2');
      localStorage.removeItem('questBoardData_v3');
      localStorage.removeItem('questBoardData_online');
      localStorage.removeItem('sidebarExpanded');
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('tutorial_done_')) localStorage.removeItem(key);
      });
      sessionStorage.clear();

      showMessage("Success", "Data has been reset to defaults. The page will now reload.");
      setTimeout(() => window.location.reload(), 1200);
    }); // inner confirm
  }); // outer confirm
}

// Helper for handleDataReset — derives legacy category-name list from new tree nodes.
function getNodeNamesForScopeFromNodes(nodes, scope) {
  return nodes.filter(n => n.type === 'folder' && n.scope === scope && n.parentId === null).map(n => n.name);
}