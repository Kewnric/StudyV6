/* ============================================================
   NAVIGATION.JS — Theme Toggle, Sidebar + Navigation Helpers
   ============================================================ */

// --- Sidebar Toggle ---
function toggleSidebar() {
  const sidebar = document.querySelector('.app-sidebar');
  if (!sidebar) return;

  const isMobile = window.innerWidth <= 640;
  const btn = document.querySelector('.sidebar-toggle-btn');

  if (isMobile) {
    const isOpen = sidebar.classList.contains('mobile-open');
    sidebar.classList.toggle('mobile-open', !isOpen);
    const backdrop = document.getElementById('sidebar-backdrop');
    if (backdrop) backdrop.classList.toggle('hidden', isOpen);
    if (btn) btn.setAttribute('aria-expanded', String(!isOpen));
  } else {
    sidebar.style.width = '';
    sidebar.style.flexBasis = '';
    sidebar.classList.toggle('expanded');
    localStorage.setItem('sidebarExpanded', sidebar.classList.contains('expanded'));
    if (btn) btn.setAttribute('aria-expanded', String(sidebar.classList.contains('expanded')));
    if (typeof scheduleCloudSave === 'function') scheduleCloudSave();
  }
}

function closeMobileSidebar() {
  const sidebar = document.querySelector('.app-sidebar');
  if (sidebar) sidebar.classList.remove('mobile-open');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (backdrop) backdrop.classList.add('hidden');
  const btn = document.querySelector('.sidebar-toggle-btn');
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

const THEMES = ['dark', 'light', 'purple', 'green'];

function toggleTheme() {
  const root = document.documentElement;

  root.classList.add('theme-transitioning');

  const currentTheme = root.getAttribute('data-theme') || 'dark';
  let nextIndex = THEMES.indexOf(currentTheme) + 1;
  if (nextIndex >= THEMES.length) nextIndex = 0;
  const newTheme = THEMES[nextIndex];

  root.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);

  updateThemeIcon(newTheme);
  if (typeof scheduleCloudSave === 'function') scheduleCloudSave();

  setTimeout(() => {
    root.classList.remove('theme-transitioning');
  }, 600);
}

function updateThemeIcon(theme) {
  const themeIcon = document.getElementById('theme-icon');
  if (themeIcon) {
    let iconName = 'moon'; // default for dark
    if (theme === 'light') iconName = 'sun';
    else if (theme === 'purple') iconName = 'sparkles';
    else if (theme === 'green') iconName = 'leaf';

    themeIcon.setAttribute('data-lucide', iconName);
    if (window.lucide) {
      lucide.createIcons();
    }
  }
}

function initTheme() {
  // 1. Suppress all entry animations during initial page paint
  document.body.classList.add('no-entry-animation');

  // 2. Init Theme
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);

  // 3. Init Sidebar State — suppress transition to prevent layout jump
  const sidebar = document.querySelector('.app-sidebar');
  if (sidebar) {
    sidebar.classList.add('no-transition');
    if (localStorage.getItem('sidebarExpanded') === 'true') {
      sidebar.classList.add('expanded');
    }
  }

  // 4. Re-enable transitions and animations after first paint
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (sidebar) sidebar.classList.remove('no-transition');
      document.body.classList.remove('no-entry-animation');
    });
  });
}

// --- Nav Active State ---
function setActiveNav(page) {
  document.querySelectorAll('.sidebar-link').forEach(el => {
    el.classList.remove('active');
  });
  const activeEl = document.getElementById('nav-' + page);
  if (activeEl) activeEl.classList.add('active');
}

// --- Page Navigation Helper ---
function navigateTo(page) {
  spaNavigate(page);
}

// ============================================================
// GLOBAL ESCAPE KEY — closes any open modal
// ============================================================
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;

  // Global search takes priority
  const gsModal = document.getElementById('global-search-modal');
  if (gsModal && !gsModal.classList.contains('hidden')) {
    closeGlobalSearch();
    return;
  }

  // Close any visible modal-overlay (hint, timer, icon-picker, answer-key, etc.)
  const openModal = document.querySelector('.modal-overlay:not(.hidden)');
  if (openModal) {
    openModal.classList.add('hidden');
    return;
  }

  // Close mindmap overlay
  const mindmap = document.getElementById('mindmap-overlay');
  if (mindmap && !mindmap.classList.contains('hidden')) {
    if (typeof closeMindmap === 'function') closeMindmap();
  }
});

// ============================================================
// GLOBAL SEARCH
// ============================================================
function openGlobalSearch() {
  const modal = document.getElementById('global-search-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  const input = document.getElementById('global-search-input');
  if (input) { input.value = ''; input.focus(); }
  renderGlobalSearchResults();
}

function closeGlobalSearch() {
  const modal = document.getElementById('global-search-modal');
  if (modal) modal.classList.add('hidden');
}

// Close on backdrop click
document.addEventListener('click', (e) => {
  const modal = document.getElementById('global-search-modal');
  if (modal && e.target === modal) closeGlobalSearch();
});

function renderGlobalSearchResults() {
  const input = document.getElementById('global-search-input');
  const container = document.getElementById('global-search-results');
  if (!input || !container) return;

  const q = input.value.trim().toLowerCase();

  if (!q) {
    container.innerHTML = `<div style="padding:1.5rem;text-align:center;color:var(--text-tertiary);font-size:0.875rem;">
      Start typing to search across programs, snippets, and notebooks…
    </div>`;
    return;
  }

  const results = [];

  // Search challenges
  (state.challenges || []).forEach(c => {
    if (fuzzyMatch(c.title, q) || (c.tags || []).some(t => fuzzyMatch(t, q)) || fuzzyMatch(c.coverDescription || '', q)) {
      const folder = state.nodes && state.nodes.find(n => n.id === c.parentId);
      results.push({ type: 'challenge', icon: 'code-2', label: c.title, sub: folder ? folder.name : 'Uncategorized', id: c.id, parentId: c.parentId });
    }
  });

  // Search snippets
  (state.snippets || []).forEach(s => {
    if (fuzzyMatch(s.title, q) || (s.tags || []).some(t => fuzzyMatch(t, q))) {
      const folder = state.nodes && state.nodes.find(n => n.id === s.parentId);
      results.push({ type: 'snippet', icon: 'file-code', label: s.title, sub: folder ? folder.name : 'Uncategorized', id: s.id, parentId: s.parentId });
    }
  });

  // Search notebooks
  (state.notebooks || []).forEach(nb => {
    if (fuzzyMatch(nb.title, q) || (nb.tags || []).some(t => fuzzyMatch(t, q))) {
      const folder = state.nodes && state.nodes.find(n => n.id === nb.parentId);
      results.push({ type: 'notebook', icon: 'book-open', label: nb.title, sub: folder ? folder.name : 'Uncategorized', id: nb.id });
    }
  });

  if (results.length === 0) {
    container.innerHTML = `<div style="padding:1.5rem;text-align:center;color:var(--text-tertiary);font-size:0.875rem;">
      No results for "<strong>${escapeHTML(q)}</strong>"
    </div>`;
    return;
  }

  const typeLabels = { challenge: 'Program', snippet: 'Snippet', notebook: 'Notebook' };
  const typeColors = { challenge: 'var(--color-primary)', snippet: 'var(--color-accent)', notebook: 'var(--color-warning)' };

  container.innerHTML = results.slice(0, 40).map(r => `
    <div class="global-search-result-item" role="option"
      onclick="handleGlobalSearchSelect('${r.type}','${r.id}','${r.parentId || ''}')"
      tabindex="-1"
      style="display:flex;align-items:center;gap:0.75rem;padding:0.625rem 0.75rem;border-radius:var(--radius-md);cursor:pointer;transition:background var(--transition-fast);"
      onmouseenter="this.style.background='var(--bg-surface-hover)'" onmouseleave="this.style.background=''">
      <i data-lucide="${r.icon}" style="width:16px;height:16px;color:${typeColors[r.type]};flex-shrink:0;" aria-hidden="true"></i>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:600;font-size:0.875rem;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHTML(r.label)}</div>
        <div style="font-size:0.75rem;color:var(--text-tertiary);">${escapeHTML(r.sub)}</div>
      </div>
      <span style="font-size:0.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:${typeColors[r.type]};background:var(--bg-surface-hover);padding:0.125rem 0.5rem;border-radius:var(--radius-full);">${typeLabels[r.type]}</span>
    </div>
  `).join('');

  if (typeof lucide !== 'undefined') lucide.createIcons({ root: container });
}

function handleGlobalSearchSelect(type, id, parentId) {
  closeGlobalSearch();
  if (type === 'challenge') {
    if (typeof selectBrowseNode === 'function') selectBrowseNode(parentId || null);
    spaNavigate('browse');
    setTimeout(() => {
      if (typeof navigateToFolderAndFocus === 'function') navigateToFolderAndFocus(parentId || '__root__', id);
    }, 150);
  } else if (type === 'snippet') {
    setSessionParam('studyTab', 'snippets');
    setSessionParam('activeSnippet', id);
    spaNavigate('study');
  } else if (type === 'notebook') {
    setSessionParam('studyTab', 'notes');
    setSessionParam('activeNotebook', id);
    spaNavigate('study');
  }
}

// Keyboard navigation inside global search
document.addEventListener('keydown', (e) => {
  const modal = document.getElementById('global-search-modal');
  if (!modal || modal.classList.contains('hidden')) return;

  const items = modal.querySelectorAll('.global-search-result-item');
  if (!items.length) return;

  let focused = modal.querySelector('.global-search-result-item:focus');
  const idx = focused ? Array.from(items).indexOf(focused) : -1;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    const next = items[idx + 1] || items[0];
    next.focus();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    const prev = items[idx - 1] || items[items.length - 1];
    prev.focus();
  } else if (e.key === 'Enter' && focused) {
    focused.click();
  }
});

// Also allow Ctrl+K / Cmd+K to open search from anywhere
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    const modal = document.getElementById('global-search-modal');
    if (modal && modal.classList.contains('hidden')) {
      openGlobalSearch();
    } else {
      closeGlobalSearch();
    }
  }
});

// --- Unsaved Changes Interceptor (SPA version) ---
document.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('click', (e) => {
    // FIX: Target ANY link that starts with a hash route, not just sidebar links.
    // This protects against clicks on the brand logo or internal cross-links.
    const link = e.target.closest('a[href^="#/"]');
    if (!link) return;

    const dest = link.getAttribute('href');
    if (!dest) return;

    if (window.adminIsDirty) {
      e.preventDefault(); // Stop the link from navigating immediately
      const route = dest.replace(/^#\/?/, ''); // Clean the route string

      showUnsavedConfirm(
        () => {
          // Discard changes
          window.adminIsDirty = false;
          spaNavigate(route);
        },
        () => {
          // Attempt to save changes
          if (window.saveCurrentAdminForm) {
            const success = window.saveCurrentAdminForm({ silent: true });
            if (success === false) return; // Keep user on page if save fails
          }
          window.adminIsDirty = false;
          spaNavigate(route);
        }
      );
    }
  });
});