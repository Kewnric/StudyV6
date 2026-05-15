/* ============================================================
   FIREBASE-AUTH.JS — Firebase Init, Auth, Cloud Save/Load (Unified)
   ----
   Cloud document layout (firestore: users/{uid}):
     {
       app:       { ...state fields: nodes, challenges, snippets, notebooks, ... },
       viz:       { nodes, links, pan, zoom, fogEnabled }      // per-module
       vizPerMod: { challenge: {...}, snippet: {...}, notebook: {...}, general: {...} } // future
       brain:     { versions, folders, activeVersionId }
       quests:    { quests, player, lastLoginDate }
       settings:  { theme, sidebarExpanded, tutorialsDone[] }
       lastSaved: <timestamp>
     }
   ============================================================ */

const firebaseConfig = {
  apiKey: "AIzaSyANt1EyX048v3DcF84Z8mY8dMJE1EfzUCE",
  authDomain: "study-session-kk02.firebaseapp.com",
  projectId: "study-session-kk02",
  storageBucket: "study-session-kk02.firebasestorage.app",
  messagingSenderId: "742476751171",
  appId: "1:742476751171:web:429ec4a13a2203631d8ff6",
  measurementId: "G-56NYN0YPS7"
};

firebase.initializeApp(firebaseConfig);
const fbAuth = firebase.auth();
const fbDb = firebase.firestore();

// SESSION persistence: the auth session only lives until the browser tab/window
// is closed. The next browser launch is a clean slate and the user has to sign
// in again. (LOCAL would persist indefinitely; NONE would even forget across
// reloads.) See: https://firebase.google.com/docs/auth/web/auth-state-persistence
try { fbAuth.setPersistence(firebase.auth.Auth.Persistence.SESSION); } catch (e) {}

// `storageMode` is now read from sessionStorage (browser-tab scoped) instead of
// localStorage, so a fresh browser launch always shows the picker. We keep a
// per-tab record so SPA reloads within the same session don't re-prompt.
let storageMode = sessionStorage.getItem('storageMode') || null;
let currentFirebaseUser = null;
let _appBooted = false;

// Dirty-state tracking for "Save Now" + unsaved-changes prompt
let _cloudIsDirty = false;
let _cloudIsSaving = false;
let _lastCloudSaveAt = null;
// Suppress cloud uploads during initialization / route mount when local-only
// helpers (vizAutoPopulate, checkDailyReset) write to localStorage but the data
// hasn't actually changed in any user-meaningful way.
let _suppressCloudSave = false;

/* ============================================================
   PUBLIC SYNC HOOKS — call these from any save site
   ============================================================ */

/** Mark in-memory state as dirty (needs cloud upload). Called from saveData(),
 *  vizSave(), brainSave(), saveQuestData(), toggleTheme(), etc. */
function markCloudDirty() {
  _cloudIsDirty = true;
  _updateCloudStatusUI();
}

/** Force an immediate flush to cloud. Returns a Promise. */
async function flushCloudNow() {
  if (storageMode !== 'online' || !currentFirebaseUser) return false;
  return await saveToFirestore(currentFirebaseUser.uid);
}

/** Manual "Save Now" — visible feedback on the badge button. */
async function manualCloudSave() {
  if (storageMode !== 'online' || !currentFirebaseUser) {
    showCloudToast('Sign in to save to cloud', true);
    return;
  }
  await flushCloudNow();
}

/* ============================================================
   SIGN-IN PROGRESS BAR
   ============================================================ */
let _signinProgress = { current: 0, target: 0, interval: null, finished: false };

function _resetSigninProgress() {
  if (_signinProgress.interval) clearInterval(_signinProgress.interval);
  _signinProgress = { current: 0, target: 0, interval: null, finished: false };
}

function _renderSigninProgress(text) {
  const bar = document.getElementById('smp-progress-bar');
  const txt = document.getElementById('smp-progress-text');
  const pct = Math.max(0, Math.min(100, Math.round(_signinProgress.current)));
  if (bar) bar.style.width = pct + '%';
  if (txt) txt.textContent = (text || 'Signing in...') + ' ' + pct + '%';
}

function _startSigninProgressTicker() {
  if (_signinProgress.interval) return;
  _signinProgress.interval = setInterval(() => {
    if (_signinProgress.finished) return;
    const gap = _signinProgress.target - _signinProgress.current;
    if (gap > 0.4) _signinProgress.current += Math.max(0.4, gap * 0.06);
    else if (gap < -0.4) _signinProgress.current = _signinProgress.target;
    _renderSigninProgress(_signinProgress._lastText || 'Signing in...');
  }, 90);
}

function _signinProgressTo(target, text) {
  _signinProgress._lastText = text;
  _signinProgress.target = Math.max(_signinProgress.target, target);
  _startSigninProgressTicker();
}

function _signinProgressFinish(text) {
  _signinProgress.finished = true;
  _signinProgress.current = 100;
  _signinProgress.target = 100;
  _renderSigninProgress(text || 'Complete!');
  if (_signinProgress.interval) { clearInterval(_signinProgress.interval); _signinProgress.interval = null; }
}

/* ---------- Storage Mode Popup ---------- */

function showStorageModePicker() {
  const popup = document.getElementById('storage-mode-popup');
  if (popup) popup.classList.remove('hidden');
  const appLayout = document.querySelector('.app-layout');
  if (appLayout) appLayout.style.visibility = 'hidden';
  _showSigninChooseView();
}

function hideStorageModePicker() {
  const popup = document.getElementById('storage-mode-popup');
  if (popup) popup.classList.add('hidden');
  const appLayout = document.querySelector('.app-layout');
  if (appLayout) appLayout.style.visibility = '';
}

function _showSigninChooseView() {
  const body = document.querySelector('#storage-mode-popup .smp-body');
  const progContainer = document.getElementById('smp-progress-container');
  if (body) body.classList.remove('hidden');
  if (progContainer) progContainer.classList.add('hidden');
  const onlineBtn = document.getElementById('smp-online-btn');
  const localBtn = document.getElementById('smp-local-btn');
  if (onlineBtn) { onlineBtn.disabled = false; onlineBtn.classList.remove('smp-btn-disabled'); }
  if (localBtn)  { localBtn.disabled = false; localBtn.classList.remove('smp-btn-disabled'); }
  _resetSigninProgress();
  _renderSigninProgress('Signing in...');
}

function _showSigninLoadingView() {
  const body = document.querySelector('#storage-mode-popup .smp-body');
  const progContainer = document.getElementById('smp-progress-container');
  if (body) body.classList.add('hidden');
  if (progContainer) progContainer.classList.remove('hidden');
}

function finishBoot() {
  if (_appBooted) return;
  _appBooted = true;
  SpaRouter.init();
  _attachUnloadGuard();
  _updateCloudStatusUI();
}

/* ---------- Choose Local ---------- */

function chooseLocalMode() {
  storageMode = 'local';
  sessionStorage.setItem('storageMode', 'local');
  hideStorageModePicker();
  loadData();
  finishBoot();
}

/* ---------- Choose Online (Google Sign-In) ---------- */

async function chooseOnlineMode() {
  _resetSigninProgress();
  _showSigninLoadingView();
  _signinProgressTo(20, 'Waiting for Google login...');

  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    _signinProgressTo(40, 'Waiting for Google login...');
    const result = await fbAuth.signInWithPopup(provider);

    _signinProgressTo(65, 'Authenticating user...');
    currentFirebaseUser = result.user;
    storageMode = 'online';
    sessionStorage.setItem('storageMode', 'online');
    updateCloudUserBadge();

    _signinProgressTo(85, 'Syncing cloud data...');
    await loadFromFirestore(currentFirebaseUser.uid);

    _signinProgressFinish('Complete!');

    setTimeout(() => {
      hideStorageModePicker();
      _showSigninChooseView();
      finishBoot();
      showCloudToast('Signed in as ' + (currentFirebaseUser.displayName || currentFirebaseUser.email));
    }, 380);

  } catch (err) {
    console.error('[Firebase] Sign-in failed:', err);
    _resetSigninProgress();
    _showSigninChooseView();
    if (err && err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
      showCloudToast('Sign-in failed: ' + (err.message || err.code || 'unknown error'), true);
    }
  }
}

/* ============================================================
   LOAD FROM FIRESTORE — restores all domains
   ============================================================ */
async function loadFromFirestore(uid) {
  // Suppress cloud uploads during the entire load — flushing, seeding defaults,
  // re-rendering routes etc. all call saveData/vizSave which would otherwise
  // schedule unwanted uploads back to Firestore on every sign-in.
  const __prevSuppress = _suppressCloudSave;
  _suppressCloudSave = true;
  try {
    // CRITICAL: flush all in-memory domains so the previous account's data
    // cannot leak into the new account's view.
    _flushAllInMemoryDomains();

    const doc = await fbDb.collection('users').doc(uid).get();

    if (doc.exists) {
      const data = doc.data();

      // ── Core app data ─────────────────────────────────────────────
      const parsed = data.app || data; // back-compat with old flat docs
      state.challenges = migrateLegacyData(parsed.challenges || []);
      state.snippets = parsed.snippets || [];
      state.notebooks = parsed.notebooks || [];
      state.categoryRequirements = parsed.categoryRequirements || {};
      state.snippetProgress = parsed.snippetProgress || {};
      state.badges = parsed.badges || [];
      state.notebookHistory = parsed.notebookHistory || [];
      state.history = parsed.history || [];
      state.activeAttempts = parsed.activeAttempts || {};
      state.expandedNodes = parsed.expandedNodes || [];

      if (parsed.nodes && parsed.nodes.length > 0) {
        state.nodes = parsed.nodes;
      } else if (parsed.categories) {
        state.categories = parsed.categories;
        state.snippetCategories = parsed.snippetCategories || [];
        state.notebookCategories = parsed.notebookCategories || ['General'];
        state.nodes = migrateCategoriesToNodes(parsed);
      } else {
        seedDefaultData(); // doc exists but no nodes — seed
      }

      // ── Visualization (single global canvas) ─────────────────────
      if (data.viz && typeof viz !== 'undefined') {
        const v = data.viz;
        viz.nodes = v.nodes || [];
        viz.links = v.links || [];
        viz.pan = v.pan || { x: 0, y: 0 };
        viz.zoom = v.zoom || 1;
        viz.fogEnabled = !!v.fogEnabled;
      }

      // ── Brain (versioned comments) ───────────────────────────────
      if (data.brain && typeof brain !== 'undefined') {
        brain.versions = data.brain.versions || [];
        brain.folders = data.brain.folders || [];
        brain.activeVersionId = data.brain.activeVersionId || null;
      }

      // ── Quests (board + player) ──────────────────────────────────
      if (data.quests && typeof questState !== 'undefined') {
        questState.quests = data.quests.quests || [];
        if (data.quests.player) questState.player = data.quests.player;
        if (data.quests.lastLoginDate) questState.lastLoginDate = data.quests.lastLoginDate;
      }

      // ── Settings (theme, sidebar, tutorials) ─────────────────────
      if (data.settings) {
        if (data.settings.theme) {
          localStorage.setItem('theme', data.settings.theme);
          document.documentElement.setAttribute('data-theme', data.settings.theme);
        }
        if (typeof data.settings.sidebarExpanded === 'boolean') {
          localStorage.setItem('sidebarExpanded', String(data.settings.sidebarExpanded));
        }
        if (Array.isArray(data.settings.tutorialsDone)) {
          data.settings.tutorialsDone.forEach(t => {
            localStorage.setItem('tutorial_done_' + t, '1');
          });
        }
      }

      _cacheAllToLocalStorage();
      _cloudIsDirty = false;
      _lastCloudSaveAt = Date.now();
      // Re-render any currently-mounted route so it picks up the new account's data
      _rerenderActiveRoute();
      console.log('[Firebase] Loaded cloud data for', uid);
    } else {
      // No cloud doc — fresh account → canonical starter content.
      console.log('[Firebase] No cloud data for this account. Seeding defaults.');
      seedDefaultData();
      _cacheAllToLocalStorage();
      await saveToFirestore(uid);
    }
  } catch (err) {
    console.error('[Firebase] Load failed:', err);
    try { loadData(); } catch (e) { seedDefaultData(); }
    showCloudToast('Cloud load failed — using cached/local data', true);
  } finally {
    _suppressCloudSave = __prevSuppress;
    _cloudIsDirty = false;
    _updateCloudStatusUI();
  }
}

/** After loading new account data, force the currently-displayed route to
 *  re-render with the fresh data (otherwise the canvas still shows the old
 *  account's nodes until the user navigates away and back). */
function _rerenderActiveRoute() {
  if (typeof viz !== 'undefined' && typeof vizRenderCanvas === 'function') {
    try { vizRenderContentPane && vizRenderContentPane(); } catch (e) {}
    try { vizRenderCanvas(); } catch (e) {}
  }
  if (typeof brain !== 'undefined' && typeof brainRenderCanvas === 'function') {
    try { brainRenderSidebar && brainRenderSidebar(); } catch (e) {}
    try { brainRenderCanvas(); } catch (e) {}
  }
  if (typeof renderAdmin === 'function' && document.getElementById('admin-table-body-preview')) {
    try { renderAdmin(); } catch (e) {}
  }
  if (typeof renderHome === 'function' && document.getElementById('home-greeting')) {
    try { renderHome(); } catch (e) {}
  }
  if (typeof renderBrowse === 'function' && document.getElementById('browse-tree-list')) {
    try { renderBrowse(); } catch (e) {}
  }
  if (typeof renderStudyHome === 'function' && document.getElementById('study-tree-list')) {
    try { renderStudyHome(); } catch (e) {}
  }
  if (typeof renderQuestBoard === 'function' && document.getElementById('quest-board-root')) {
    try { renderQuestBoard(); } catch (e) {}
  }
}

/** Wipe every in-memory domain to a clean shape before loading another account. */
function _flushAllInMemoryDomains() {
  // Core app state
  state.nodes = [];
  state.expandedNodes = [];
  state.categoryRequirements = {};
  state.snippetProgress = {};
  state.badges = [];
  state.snippets = [];
  state.notebooks = [];
  state.notebookHistory = [];
  state.challenges = [];
  state.history = [];
  state.activeAttempts = {};
  state.activeChallenge = null;
  state.activeVariant = null;
  state.userCode = '';
  state.sessionData = null;
  state.timeLimit = 0;
  state.lastDiffs = [];

  // Viz canvas
  if (typeof viz !== 'undefined') {
    viz.nodes = [];
    viz.links = [];
    viz.pan = { x: 0, y: 0 };
    viz.zoom = 1;
    viz.fogEnabled = false;
    if (viz.expandedFolderIds && viz.expandedFolderIds.clear) viz.expandedFolderIds.clear();
  }

  // Brain
  if (typeof brain !== 'undefined') {
    brain.versions = [];
    brain.folders = [];
    brain.activeVersionId = null;
    brain.nodes = [];
    brain.links = [];
  }

  // Quests
  if (typeof questState !== 'undefined') {
    questState.quests = [];
    if (questState.player) {
      questState.player.xp = 0;
      questState.player.level = 1;
      questState.player.streakDays = 0;
    }
  }
}

/** Write all current domains to localStorage caches (skips cloud upload). */
function _cacheAllToLocalStorage() {
  // App
  try {
    localStorage.setItem(getAppStorageKey(), JSON.stringify({
      categories: getNodeNamesForScope('challenge'),
      snippetCategories: getNodeNamesForScope('snippet'),
      notebookCategories: getNodeNamesForScope('notebook'),
      nodes: state.nodes,
      expandedNodes: state.expandedNodes,
      categoryRequirements: state.categoryRequirements,
      snippetProgress: state.snippetProgress,
      badges: state.badges,
      snippets: state.snippets,
      notebooks: state.notebooks,
      notebookHistory: state.notebookHistory,
      challenges: state.challenges,
      history: state.history,
      activeAttempts: state.activeAttempts
    }));
  } catch (e) { /* ignore */ }

  // Viz
  if (typeof viz !== 'undefined') {
    try {
      localStorage.setItem(getVizStorageKey(), JSON.stringify({
        nodes: viz.nodes, links: viz.links, pan: viz.pan, zoom: viz.zoom, fogEnabled: viz.fogEnabled
      }));
    } catch (e) { /* ignore */ }
  }

  // Brain
  if (typeof brain !== 'undefined') {
    try {
      localStorage.setItem(getBrainStorageKey(), JSON.stringify({
        versions: brain.versions, folders: brain.folders, activeVersionId: brain.activeVersionId
      }));
    } catch (e) { /* ignore */ }
  }

  // Quests
  if (typeof questState !== 'undefined') {
    try {
      localStorage.setItem(getQuestStorageKey(), JSON.stringify({
        quests: questState.quests, player: questState.player, lastLoginDate: questState.lastLoginDate
      }));
    } catch (e) { /* ignore */ }
  }
}

/* ============================================================
   SAVE TO FIRESTORE — pushes all domains
   ============================================================ */
/** Strip values Firestore can't store: undefined, functions, Set, Map, DOM nodes,
 *  Date (converted to ms), circular refs. Returns a deep-cloned plain object. */
function _sanitizeForFirestore(v, seen) {
  seen = seen || new WeakSet();
  if (v === null || v === undefined) return null;
  if (typeof v === 'function') return null;
  if (typeof v !== 'object') {
    if (typeof v === 'number' && (!isFinite(v) || isNaN(v))) return null;
    return v;
  }
  if (v instanceof Date) return v.getTime();
  if (v instanceof Set) return Array.from(v).map(x => _sanitizeForFirestore(x, seen));
  if (v instanceof Map) {
    const o = {};
    v.forEach((val, k) => { o[String(k)] = _sanitizeForFirestore(val, seen); });
    return o;
  }
  if (v instanceof Node) return null;
  if (seen.has(v)) return null;
  seen.add(v);
  if (Array.isArray(v)) {
    return v.map(item => _sanitizeForFirestore(item, seen));
  }
  const out = {};
  for (const k of Object.keys(v)) {
    if (k.startsWith('_')) continue; // skip private fields (e.g. _undoStack)
    const sanitized = _sanitizeForFirestore(v[k], seen);
    if (sanitized !== undefined) out[k] = sanitized;
  }
  return out;
}

async function saveToFirestore(uid) {
  if (!uid) return false;
  _cloudIsSaving = true;
  _updateCloudStatusUI();
  try {
    // Gather all domains (raw)
    const raw = {
      app: {
        nodes: state.nodes,
        expandedNodes: state.expandedNodes,
        categoryRequirements: state.categoryRequirements,
        snippetProgress: state.snippetProgress,
        badges: state.badges,
        snippets: state.snippets,
        notebooks: state.notebooks,
        notebookHistory: state.notebookHistory,
        challenges: state.challenges,
        history: state.history,
        activeAttempts: state.activeAttempts
      }
    };

    if (typeof viz !== 'undefined') {
      raw.viz = {
        nodes: viz.nodes || [],
        links: viz.links || [],
        pan: viz.pan || { x: 0, y: 0 },
        zoom: viz.zoom || 1,
        fogEnabled: !!viz.fogEnabled
      };
    }
    if (typeof brain !== 'undefined') {
      raw.brain = {
        versions: brain.versions || [],
        folders: brain.folders || [],
        activeVersionId: brain.activeVersionId || null
      };
    }
    if (typeof questState !== 'undefined') {
      raw.quests = {
        quests: questState.quests || [],
        player: questState.player || null,
        lastLoginDate: questState.lastLoginDate || null
      };
    }

    const tutorialsDone = Object.keys(localStorage)
      .filter(k => k.startsWith('tutorial_done_'))
      .map(k => k.slice('tutorial_done_'.length));
    raw.settings = {
      theme: localStorage.getItem('theme') || 'dark',
      sidebarExpanded: localStorage.getItem('sidebarExpanded') === 'true',
      tutorialsDone
    };

    const payload = _sanitizeForFirestore(raw) || {};
    payload.lastSaved = firebase.firestore.FieldValue.serverTimestamp();

    // Detect oversize payload BEFORE sending (Firestore document limit is 1 MB).
    let payloadSize = 0;
    try {
      payloadSize = JSON.stringify(payload).length;
    } catch (e) {}
    if (payloadSize > 1048000) {
      const err = new Error('Document too large (' + Math.round(payloadSize/1024) + ' KB) — Firestore limit is 1 MB. Trim history or split data.');
      err.code = 'doc-too-large';
      throw err;
    }

    const writePromise = fbDb.collection('users').doc(uid).set(payload, { merge: false });
    let timeoutId = null;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        const err = new Error(
          'Cloud save timed out (60s). Your Firestore Security Rules may be blocking writes — ' +
          'open Firebase Console → Firestore → Rules and set: ' +
          'allow read, write: if request.auth != null && request.auth.uid == userId;'
        );
        err.code = 'deadline-exceeded';
        reject(err);
      }, 60000);
    });
    try {
      await Promise.race([writePromise, timeoutPromise]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }

    _cloudIsDirty = false;
    _cloudIsSaving = false;
    _lastCloudSaveAt = Date.now();
    _updateCloudStatusUI();
    showCloudToast('Saved to cloud');
    return true;
  } catch (err) {
    console.error('[Firebase] Save failed:', err);
    // Always reset the saving flag so the UI doesn't get stuck on "Saving..."
    _cloudIsSaving = false;
    _updateCloudStatusUI();
    // Give the user a specific message based on the firestore error code
    let msg = 'Cloud save failed';
    if (err) {
      const code = err.code || '';
      const isPermDenied = code === 'permission-denied' || code === 'PERMISSION_DENIED' ||
        (err.message && err.message.toLowerCase().includes('permission'));
      const isTimeout = code === 'deadline-exceeded' ||
        (err.message && err.message.toLowerCase().includes('timed out'));
      if (isPermDenied) {
        msg = 'Save blocked by Firestore rules. Go to Firebase Console → Firestore → Rules and add: allow read, write: if request.auth.uid == userId;';
      } else if (isTimeout) {
        msg = 'Save timed out — check Firestore Security Rules (most common cause) or your network.';
      } else {
        switch (code) {
          case 'unauthenticated':
            msg = 'Save failed: session expired. Please sign in again.';
            break;
          case 'unavailable':
            msg = 'Save failed: Firebase offline. Try again.';
            break;
          case 'resource-exhausted':
            msg = 'Save failed: quota exceeded. Try again later.';
            break;
          case 'invalid-argument':
            msg = 'Save failed: invalid data. ' + (err.message || '');
            break;
          case 'doc-too-large':
            msg = err.message;
            break;
          default:
            msg = 'Cloud save failed: ' + (err.message || code || 'unknown error');
        }
      }
    }
    showCloudToast(msg, true);
    return false;
  }
}

/** Called by saveData()/vizSave()/brainSave()/saveQuestData() — marks dirty only.
 *  Auto-saves are disabled; the user saves manually via "Save now". */
function scheduleCloudSave() {
  if (_suppressCloudSave) return;
  markCloudDirty();
}

/** Run `fn` with cloud-save suppression — useful during init flows where
 *  helpers like vizAutoPopulate or checkDailyReset call saveData/vizSave/etc
 *  but no real user change has occurred yet. */
function withCloudSaveSuppressed(fn) {
  const prev = _suppressCloudSave;
  _suppressCloudSave = true;
  try { return fn(); } finally { _suppressCloudSave = prev; }
}

/* ---------- Cloud Toast ---------- */

function showCloudToast(message, isError) {
  let toast = document.getElementById('cloud-save-toast');
  if (!toast) return;
  toast.textContent = (isError ? '✕ ' : '✓ ') + message;
  toast.className = 'cloud-toast' + (isError ? ' cloud-toast-error' : '') + ' cloud-toast-show';
  clearTimeout(toast._hideTimeout);
  toast._hideTimeout = setTimeout(() => {
    toast.classList.remove('cloud-toast-show');
  }, 2500);
}

/* ---------- Cloud User Badge (sidebar) ---------- */

function updateCloudUserBadge() {
  const badge = document.getElementById('cloud-user-badge');
  if (!badge) return;

  if (storageMode === 'online' && currentFirebaseUser) {
    const name = currentFirebaseUser.displayName || currentFirebaseUser.email || 'User';
    const photo = currentFirebaseUser.photoURL;
    badge.innerHTML = `
      <div class="cu-row">
        ${photo ? '<img src="' + photo + '" alt="" class="cloud-user-avatar" referrerpolicy="no-referrer">' : '<i data-lucide="cloud" style="width:16px;height:16px;color:var(--color-success);"></i>'}
        <span class="cloud-user-name" title="${escapeHTML(name)}">${escapeHTML(name)}</span>
      </div>
      <div class="cu-status">
        <span class="cu-status-dot" id="cu-status-dot" aria-hidden="true"></span>
        <span class="cu-status-text" id="cu-status-text">All saved</span>
      </div>
      <div class="cu-actions">
        <button id="cu-save-btn" onclick="manualCloudSave()" class="cu-action-btn cu-save-btn" title="Save now (Ctrl+Shift+S)" aria-label="Save now">
          <i data-lucide="save" style="width:14px;height:14px;"></i>
          <span>Save now</span>
        </button>
        <button onclick="firebaseSignOut()" class="cu-action-btn cu-signout-btn" title="Sign out" aria-label="Sign out">
          <i data-lucide="log-out" style="width:14px;height:14px;"></i>
          <span>Sign out</span>
        </button>
      </div>
    `;
    badge.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons({ el: badge });
    _updateCloudStatusUI();
  } else {
    badge.classList.add('hidden');
  }
}

function _updateCloudStatusUI() {
  const dot = document.getElementById('cu-status-dot');
  const txt = document.getElementById('cu-status-text');
  const btn = document.getElementById('cu-save-btn');
  if (!dot || !txt) return;
  if (_cloudIsSaving) {
    dot.className = 'cu-status-dot saving';
    txt.textContent = 'Saving...';
    if (btn) { btn.disabled = true; }
  } else if (_cloudIsDirty) {
    dot.className = 'cu-status-dot dirty';
    txt.textContent = 'Unsaved';
    if (btn) { btn.disabled = false; }
  } else {
    dot.className = 'cu-status-dot saved';
    txt.textContent = 'All saved';
    if (btn) { btn.disabled = false; }
  }
}

/* ============================================================
   SIGN OUT — with unsaved-data confirm prompt
   ============================================================ */

async function firebaseSignOut() {
  // If we have unsaved cloud changes, prompt the user.
  if (_cloudIsDirty || _cloudIsSaving) {
    const proceed = await _confirmUnsavedSignOut();
    if (!proceed) return;
  }
  await _doSignOut();
}

/** Promise that resolves true (proceed) or false (cancel) based on user choice.
 *  Uses showConfirm() if available so we get the styled modal. */
function _confirmUnsavedSignOut() {
  return new Promise((resolve) => {
    const message = 'You have unsaved cloud changes. Save them before signing out?\n\n' +
                    '• Save & sign out — uploads your changes, then signs you out.\n' +
                    '• Sign out anyway — discards unsaved changes since the last cloud save.\n' +
                    '• Cancel — stay signed in.';

    // Use a custom 3-button modal so we have the full options.
    _showThreeButtonDialog(
      'Unsaved Cloud Changes',
      message,
      [
        { label: 'Save & sign out', primary: true, action: 'save' },
        { label: 'Sign out anyway', danger: true, action: 'discard' },
        { label: 'Cancel', action: 'cancel' }
      ],
      async (action) => {
        if (action === 'cancel') return resolve(false);
        if (action === 'save') {
          // Flush, then sign out
          showCloudToast('Saving before sign out...');
          const ok = await flushCloudNow();
          if (!ok) {
            showCloudToast('Save failed — sign out cancelled', true);
            return resolve(false);
          }
          return resolve(true);
        }
        if (action === 'discard') return resolve(true);
      }
    );
  });
}

function _showThreeButtonDialog(title, message, actions, onChoice) {
  const modal = document.getElementById('dialog-modal');
  if (!modal) {
    // Native fallback
    const ans = confirm(title + '\n\n' + message + '\n\nOK = Save & sign out, Cancel = Cancel');
    onChoice(ans ? 'save' : 'cancel');
    return;
  }
  document.getElementById('dialog-title').innerText = title;
  document.getElementById('dialog-msg').innerText = message;
  document.getElementById('dialog-icon').innerHTML =
    '<i data-lucide="alert-triangle" class="modal-icon-svg" style="color:var(--color-warning);"></i>';
  const btnContainer = document.getElementById('dialog-actions');
  btnContainer.innerHTML = actions.map((a, i) => {
    const cls = a.primary ? 'btn btn-primary' : (a.danger ? 'btn btn-danger' : 'btn btn-secondary');
    return `<button id="3btn-${i}" class="${cls}" style="flex:1;">${escapeHTML(a.label)}</button>`;
  }).join('');
  actions.forEach((a, i) => {
    const btn = document.getElementById('3btn-' + i);
    if (btn) btn.onclick = () => {
      if (typeof closeModalSmooth === 'function') closeModalSmooth(modal);
      else modal.classList.add('hidden');
      onChoice(a.action);
    };
  });
  modal.classList.remove('hidden');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function _doSignOut() {
  try {
    await fbAuth.signOut();
    currentFirebaseUser = null;
    storageMode = null;
    sessionStorage.removeItem('storageMode');
    localStorage.removeItem('storageMode'); // clean up legacy key from older builds

    // Wipe ALL cached cloud data from localStorage so next sign-in starts clean
    localStorage.removeItem(getAppStorageKey());
    localStorage.removeItem('codePlatformData_online');
    localStorage.removeItem('vizCanvasData_online');
    localStorage.removeItem('brainCanvasData_online');
    localStorage.removeItem('questBoardData_online');

    // Also wipe sessionStorage so nothing carries over to the next account
    try { sessionStorage.clear(); } catch (e) {}

    _cloudIsDirty = false;
    _cloudIsSaving = false;
    updateCloudUserBadge();
    window.location.reload();
  } catch (err) {
    console.error('[Firebase] Sign-out failed:', err);
  }
}

/* ============================================================
   BROWSER UNLOAD GUARD — warn if closing tab with unsaved cloud data
   ============================================================ */
function _attachUnloadGuard() {
  if (window._cloudUnloadAttached) return;
  window._cloudUnloadAttached = true;
  window.addEventListener('beforeunload', (e) => {
    if (storageMode === 'online' && (_cloudIsDirty || _cloudIsSaving)) {
      e.preventDefault();
      e.returnValue = 'You have unsaved cloud changes. Are you sure you want to leave?';
      return e.returnValue;
    }
  });
  // Keyboard shortcut: Ctrl/Cmd + Shift + S = save now
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (storageMode === 'online' && currentFirebaseUser) manualCloudSave();
    }
  });
}

/* ---------- Boot ---------- */

function bootApp() {
  // Read from sessionStorage so a fresh browser launch (no session) always
  // returns null and shows the picker. Within the same browser session, SPA
  // reloads still see the choice.
  const savedMode = sessionStorage.getItem('storageMode');
  // Clean up legacy localStorage key from previous builds so it doesn't
  // accidentally auto-resume an old session on first run after the upgrade.
  if (localStorage.getItem('storageMode')) localStorage.removeItem('storageMode');

  if (savedMode === 'local') {
    storageMode = 'local';
    loadData();
    finishBoot();
    return;
  }

  if (savedMode === 'online') {
    storageMode = 'online';
    showStorageModePicker();
    _showSigninLoadingView();
    _resetSigninProgress();
    _signinProgressTo(25, 'Restoring session...');

    const unsub = fbAuth.onAuthStateChanged(async (user) => {
      unsub();
      if (user) {
        currentFirebaseUser = user;
        updateCloudUserBadge();
        _signinProgressTo(70, 'Syncing cloud data...');
        await loadFromFirestore(user.uid);
        _signinProgressFinish('Welcome back!');
        setTimeout(() => {
          hideStorageModePicker();
          _showSigninChooseView();
          finishBoot();
        }, 320);
      } else {
        _resetSigninProgress();
        _showSigninChooseView();
      }
    });
    return;
  }

  // First visit — show picker
  showStorageModePicker();
}
