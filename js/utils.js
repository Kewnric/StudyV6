/* ============================================================
   UTILS.JS — Utility Functions
   ============================================================ */

// Tier definitions for global use (Mindmap, Browse, Admin)
const TIER_LEVELS = [
  { value: '', label: '—', cssClass: '' },
  { value: 's', label: 'S', cssClass: 'tier-s' },
  { value: 'a', label: 'A', cssClass: 'tier-a' },
  { value: 'b', label: 'B', cssClass: 'tier-b' },
  { value: 'c', label: 'C', cssClass: 'tier-c' },
  { value: 'd', label: 'D', cssClass: 'tier-d' },
  { value: 'e', label: 'E', cssClass: 'tier-e' }
];

/** @param {string} tier - one of s|a|b|c|d|e @returns {string} badge HTML or '' */
function getTierBadgeHTML(tier) {
  if (!tier) return '';
  const t = TIER_LEVELS.find(l => l.value === tier);
  if (!t || !t.cssClass) return '';
  return `<span class="tier-badge ${t.cssClass}">${t.label}-Tier</span>`;
}

/** @param {string} str @returns {string} HTML-entity-escaped string */
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** @param {number} secs total seconds @returns {string} "HH:MM:SS" or "MM:SS" */
function formatTimeDisplay(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/** LCS-based similarity ratio. @returns {number} 0.0–1.0 */
function calculateSimilarity(s1, s2) {
  // Quick equality checks first
  if (s1 === s2) return 1.0;
  if (s1.trim() === s2.trim()) return 0.95;
  if (s1.replace(/\s/g, '') === s2.replace(/\s/g, '')) return 0.9;

  // Character-level LCS ratio for partial match detection
  const a = s1.replace(/\s/g, '');
  const b = s2.replace(/\s/g, '');
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  // Optimized 2-row LCS for memory efficiency
  const n = a.length, m = b.length;
  let prev = new Array(m + 1).fill(0);
  let curr = new Array(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1] + 1;
      } else {
        curr[j] = Math.max(prev[j], curr[j - 1]);
      }
    }
    [prev, curr] = [curr, prev];
    curr.fill(0);
  }
  const lcsLen = prev[m];
  return (2 * lcsLen) / (a.length + b.length);
}

// Strip dangerous HTML tags/attributes from marked output to prevent XSS
function sanitizeHTML(html) {
  // Remove script tags and their content
  html = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  // Remove event handler attributes (onclick, onerror, onload, etc.)
  html = html.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '');
  // Remove javascript: hrefs
  html = html.replace(/href\s*=\s*["']?\s*javascript:[^"'\s>]*/gi, 'href="#"');
  // Remove dangerous tags
  html = html.replace(/<(iframe|object|embed|form|input|button|base|meta|link)[^>]*>/gi, '');
  return html;
}

// Custom Rich Text + Markdown Support
/** Renders markdown + [[color:text]] syntax to sanitized HTML. @returns {string} */
function formatRichText(text) {
  if (!text) return '';
  let html;
  if (typeof marked !== 'undefined') {
    // Configure marked to avoid deprecated options warning
    html = marked.parse(text, { breaks: true });
    html = sanitizeHTML(html);
  } else {
    html = escapeHTML(text);
  }
  // Keep custom color syntax: [[color:text]] → <span style="color: color;">text</span>
  html = html.replace(/\[\[([a-zA-Z#0-9(),.\s%]+):([\s\S]*?)\]\]/g, '<span style="color: $1;">$2</span>');
  return html;
}

/** @param {Function} fn @param {number} wait ms @returns {Function} debounced wrapper */
function debounce(fn, wait) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

/** Highlights "Label:" prefix and [[color:text]] tokens in plain text. @returns {string} HTML */
function formatSampleText(text) {
  if (!text) return '';
  let html = escapeHTML(text);
  html = html.replace(/^([^:\n]+):/gm, '<span class="sample-label">$1:</span>');
  html = html.replace(/\[\[([^:]+):(.*?)\]\]/g, '<span style="color: $1;">$2</span>');
  return html;
}

/** Subsequence match — true if all chars of pattern appear in order within str. @returns {boolean} */
function fuzzyMatch(str, pattern) {
  if (!pattern) return true;
  str = str.toLowerCase();
  pattern = pattern.toLowerCase();

  if (str.includes(pattern)) return true;

  let patternIdx = 0;
  let strIdx = 0;
  while (patternIdx < pattern.length && strIdx < str.length) {
    if (pattern[patternIdx] === str[strIdx]) {
      patternIdx++;
    }
    strIdx++;
  }
  return patternIdx === pattern.length;
}

/** @param {Element} [root] scope icon scan to a subtree; omit for full document */
function refreshIcons(root) {
  if (typeof lucide === 'undefined') return;
  root ? lucide.createIcons({ root }) : lucide.createIcons();
}

// ======================== TEMPLATE HELPERS ========================

/**
 * Tagged template literal — enables HTML syntax highlighting in editors.
 * Usage: html`<div class="foo">${expr}</div>`
 * @returns {string}
 */
function html(strings, ...vals) {
  return strings.reduce((out, str, i) => out + str + (vals[i] ?? ''), '');
}

// ======================== RESIZER LOGIC ========================
function initResizerDrag(e, resizer) {
  e.preventDefault();
  const prevSibling = resizer.previousElementSibling;
  const nextSibling = resizer.nextElementSibling;
  if (!prevSibling || !nextSibling) return;
  
  const startX = e.clientX;
  const startWidth = prevSibling.getBoundingClientRect().width;
  
  // Create overlay to prevent iframes/canvases from capturing mouse events
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.zIndex = '999999';
  overlay.style.cursor = 'col-resize';
  document.body.appendChild(overlay);
  
  const mouseMoveHandler = (e) => {
    // Prevent sidebar from becoming too small or pushing the main content offscreen completely
    const newWidth = Math.max(200, startWidth + (e.clientX - startX));
    // Use parent's width instead of window.innerWidth
    const parentWidth = resizer.parentElement.getBoundingClientRect().width;
    const maxWidth = parentWidth - 200; // Keep a 200px buffer for the next sibling
    const finalWidth = Math.min(newWidth, maxWidth);
    
    prevSibling.style.width = finalWidth + 'px';
    prevSibling.style.flexBasis = finalWidth + 'px';
    prevSibling.style.flexShrink = '0';
    prevSibling.style.maxWidth = 'none';
  };
  
  const mouseUpHandler = () => {
    document.body.removeChild(overlay);
    document.removeEventListener('mousemove', mouseMoveHandler);
    document.removeEventListener('mouseup', mouseUpHandler);
    window.dispatchEvent(new Event('resize')); // Important for canvas/editors
  };
  
  document.addEventListener('mousemove', mouseMoveHandler);
  document.addEventListener('mouseup', mouseUpHandler);
}