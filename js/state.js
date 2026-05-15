/* ============================================================
   STATE.JS — Global State, Data Persistence, Local Storage
   ============================================================ */

const generateId = () => Math.random().toString(36).slice(2, 11);

// --- Global State ---
let state = {
  view: 'browse',
  // Legacy (kept for migration only)
  categories: ['Basics', 'Algorithms', 'Data Structures'],
  snippetCategories: ['Basics/Loops', 'Basics/Functions', 'Advanced/Web'],
  notebookCategories: ['General'],
  // New Tree System
  nodes: [],            // Array of { id, type:'folder', name, parentId, scope }
  expandedNodes: [],     // Array of node IDs currently expanded in tree UI
  activeNodeId: null,    // Currently selected folder node ID
  // Existing
  categoryRequirements: {},
  snippetProgress: {},
  badges: [],
  snippets: [],
  notebooks: [],
  notebookHistory: [],
  challenges: [],
  history: [],
  activeAttempts: {},
  activeChallenge: null,
  activeVariant: null,
  userCode: '',
  sessionData: null,
  timeLimit: 0,
  lastDiffs: []
};

// Admin Flow State
let adminState = null;
let pendingChallengeId = null;
let activeTimerInterval = null;

// --- Data Migration ---
function migrateLegacyData(challenges) {
  return challenges.map(c => {
    if (!c.tags) c.tags = [];
    if (!c.variants) {
      return {
        id: c.id,
        title: c.title,
        category: c.category,
        tags: c.tags,
        coverDescription: c.description || '',
        variants: [{
          id: generateId(),
          name: 'Version 1',
          description: c.description || '',
          code: c.code || '',
          starterCode: '',
          files: [{ id: generateId(), name: 'main', ext: '.c', starterCode: '', code: c.code || '' }],
          samples: []
        }]
      };
    }
    // Migrate variants that don't yet have a files[] array
    c.variants = c.variants.map(v => {
      if (!v.files || v.files.length === 0) {
        v.files = [{ id: generateId(), name: 'main', ext: '.c', starterCode: v.starterCode || '', code: v.code || '' }];
      }
      if (!v.samples) v.samples = [];
      return v;
    });
    return c;
  });
}


// --- Migrate flat categories to tree nodes ---
function migrateCategoriesToNodes(parsed) {
  const nodes = [];
  const reqMapping = {}; // old category name → new node ID (for lock rules)

  // Practice categories → folder nodes
  let folderOrderCounterCh = 0;
  (parsed.categories || []).forEach(cat => {
    const folderId = generateId();
    nodes.push({ id: folderId, type: 'folder', name: cat, parentId: null, scope: 'challenge', order: folderOrderCounterCh++ });
    reqMapping[cat] = folderId;
    let itemOrder = 0;
    state.challenges.forEach(c => {
      if (c.category === cat) { c.parentId = folderId; c.order = itemOrder++; }
    });
  });
  // Orphan challenges → null parentId (root)
  let rootOrderCh = 0;
  state.challenges.forEach(c => { if (!c.parentId) { c.parentId = null; c.order = rootOrderCh++; } });

  // Snippet categories → folder nodes
  let folderOrderCounterSn = 0;
  (parsed.snippetCategories || []).forEach(cat => {
    const folderId = generateId();
    nodes.push({ id: folderId, type: 'folder', name: cat, parentId: null, scope: 'snippet', order: folderOrderCounterSn++ });
    let itemOrder = 0;
    (state.snippets || []).forEach(s => {
      if (s.category === cat) { s.parentId = folderId; s.order = itemOrder++; }
    });
  });
  // Orphan snippets
  let rootOrderSn = 0;
  (state.snippets || []).forEach(s => { if (!s.parentId) { s.parentId = null; s.order = rootOrderSn++; } });

  // Notebook categories → folder nodes
  let folderOrderCounterNb = 0;
  (parsed.notebookCategories || []).forEach(cat => {
    const folderId = generateId();
    nodes.push({ id: folderId, type: 'folder', name: cat, parentId: null, scope: 'notebook', order: folderOrderCounterNb++ });
    let itemOrder = 0;
    (state.notebooks || []).forEach(n => {
      if (n.category === cat) { n.parentId = folderId; n.order = itemOrder++; }
    });
  });
  // Orphan notebooks
  let rootOrderNb = 0;
  (state.notebooks || []).forEach(n => { if (!n.parentId) { n.parentId = null; n.order = rootOrderNb++; } });

  // Migrate category requirements to use node IDs
  if (parsed.categoryRequirements) {
    const newReqs = {};
    Object.entries(parsed.categoryRequirements).forEach(([catName, req]) => {
      const nodeId = reqMapping[catName];
      if (nodeId) {
        newReqs[nodeId] = {
          reqNodeId: reqMapping[req.reqCat] || null,
          reqCat: req.reqCat, // Keep for display fallback
          count: req.count
        };
      }
    });
    state.categoryRequirements = newReqs;
  }

  return nodes;
}

// --- Data Persistence ---
function loadData() {
  const saved = localStorage.getItem(getAppStorageKey());
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      state.categories = parsed.categories || state.categories;
      state.snippetCategories = parsed.snippetCategories || state.snippetCategories;
      state.categoryRequirements = parsed.categoryRequirements || {};
      state.snippetProgress = parsed.snippetProgress || {};
      state.badges = parsed.badges || [];
      state.snippets = parsed.snippets || [];
      state.notebooks = parsed.notebooks || [];
      state.notebookCategories = parsed.notebookCategories || ['General'];
      state.notebookHistory = parsed.notebookHistory || [];
      state.challenges = migrateLegacyData(parsed.challenges || state.challenges);
      state.history = parsed.history || [];
      state.activeAttempts = parsed.activeAttempts || {};
      state.expandedNodes = parsed.expandedNodes || [];

      // Tree migration: if nodes don't exist yet, migrate from flat categories
      if (parsed.nodes && parsed.nodes.length > 0) {
        state.nodes = parsed.nodes;
      } else {
        state.nodes = migrateCategoriesToNodes(parsed);
        console.log('[Migration] Converted flat categories → tree nodes:', state.nodes.length, 'folders created');
      }
    } catch (e) {
      console.error("Failed to parse local storage", e);
    }
  } else {
    // ── Seed default/example content for first-time users ──
    seedDefaultData();
  }
}

/**
 * Build the canonical default seed payload — used by both first-time boot and
 * the "Reset Data" button. Returns an object the caller can merge into `state`.
 *
 * The payload contains 3 challenge folders, 3 snippet folders, 2 notebook folders,
 * 4 example programs, 3 example snippets, and 2 example notebooks so a new user
 * immediately sees a populated workspace.
 */
function buildDefaultSeed() {
  // Challenge folders
  const fChBasics      = { id: 'default_folder_ch_basics',      type: 'folder', name: 'Getting Started',    parentId: null, scope: 'challenge', order: 0, description: 'Beginner-friendly programs to get familiar with the editor.' };
  const fChAlgorithms  = { id: 'default_folder_ch_algorithms',  type: 'folder', name: 'Algorithms',         parentId: null, scope: 'challenge', order: 1, description: 'Sorting, searching, and classic algorithm problems.' };
  const fChStructures  = { id: 'default_folder_ch_structures',  type: 'folder', name: 'Data Structures',    parentId: null, scope: 'challenge', order: 2, description: 'Linked lists, trees, hash maps, and more.' };

  // Snippet folders
  const fSnBasics      = { id: 'default_folder_sn_basics',      type: 'folder', name: 'Basics',             parentId: null, scope: 'snippet',   order: 0, description: 'Core syntax and patterns.' };
  const fSnPatterns    = { id: 'default_folder_sn_patterns',    type: 'folder', name: 'Patterns',           parentId: null, scope: 'snippet',   order: 1, description: 'Reusable code patterns.' };
  const fSnAdvanced    = { id: 'default_folder_sn_advanced',    type: 'folder', name: 'Advanced',           parentId: null, scope: 'snippet',   order: 2, description: 'Higher-level techniques.' };

  // Notebook folders
  const fNbGeneral     = { id: 'default_folder_nb_general',     type: 'folder', name: 'General',            parentId: null, scope: 'notebook',  order: 0, description: 'General-purpose quizzes.' };
  const fNbConcepts    = { id: 'default_folder_nb_concepts',    type: 'folder', name: 'Concepts',           parentId: null, scope: 'notebook',  order: 1, description: 'Concept-focused quizzes.' };

  const nodes = [
    fChBasics, fChAlgorithms, fChStructures,
    fSnBasics, fSnPatterns, fSnAdvanced,
    fNbGeneral, fNbConcepts
  ];

  const challenges = [
    {
      id: 'default_challenge_hello', _isDefault: true,
      title: 'Hello, World!', parentId: fChBasics.id, order: 0,
      tags: ['Beginner', 'C', 'Example'],
      coverDescription: 'The traditional first program — print Hello, World! to the console.',
      variants: [{
        id: 'def_v_hello', name: 'C Version',
        description: 'Write a C program that prints `Hello, World!` followed by a newline.',
        starterCode: '#include <stdio.h>\n\nint main(void) {\n    // Your code here\n    return 0;\n}\n',
        code: '#include <stdio.h>\n\nint main(void) {\n    printf("Hello, World!\\n");\n    return 0;\n}\n',
        files: [{ id: 'def_f_hello_main', name: 'main', ext: '.c',
          starterCode: '#include <stdio.h>\n\nint main(void) {\n    // Your code here\n    return 0;\n}\n',
          code: '#include <stdio.h>\n\nint main(void) {\n    printf("Hello, World!\\n");\n    return 0;\n}\n'
        }],
        samples: [{ title: 'Expected Output', content: 'Hello, World!\n' }]
      }]
    },
    {
      id: 'default_challenge_sum', _isDefault: true,
      title: 'Sum of Two Integers', parentId: fChBasics.id, order: 1,
      tags: ['Beginner', 'Arithmetic'],
      coverDescription: 'Read two integers from input and print their sum.',
      variants: [{
        id: 'def_v_sum', name: 'C Version',
        description: 'Read two integers `a` and `b` separated by whitespace, then print `a + b`.',
        starterCode: '#include <stdio.h>\n\nint main(void) {\n    int a, b;\n    // TODO: read a and b, print a + b\n    return 0;\n}\n',
        code: '#include <stdio.h>\n\nint main(void) {\n    int a, b;\n    scanf("%d %d", &a, &b);\n    printf("%d\\n", a + b);\n    return 0;\n}\n',
        files: [{ id: 'def_f_sum_main', name: 'main', ext: '.c',
          starterCode: '#include <stdio.h>\n\nint main(void) {\n    int a, b;\n    // TODO: read a and b, print a + b\n    return 0;\n}\n',
          code: '#include <stdio.h>\n\nint main(void) {\n    int a, b;\n    scanf("%d %d", &a, &b);\n    printf("%d\\n", a + b);\n    return 0;\n}\n'
        }],
        samples: [{ title: 'Sample 1', content: 'Input:\n3 4\nOutput:\n7\n' }]
      }]
    },
    {
      id: 'default_challenge_reverse', _isDefault: true,
      title: 'Reverse a String', parentId: fChAlgorithms.id, order: 0,
      tags: ['String', 'Algorithm'],
      coverDescription: 'Reverse the characters of a null-terminated C string in place.',
      variants: [{
        id: 'def_v_reverse', name: 'In-place',
        description: 'Write a function `void reverse(char *s)` that reverses `s` in place. Then read a line from stdin and print the reversed string.',
        starterCode: '#include <stdio.h>\n#include <string.h>\n\nvoid reverse(char *s) {\n    // TODO\n}\n\nint main(void) {\n    char buf[256];\n    if (fgets(buf, sizeof buf, stdin)) {\n        size_t n = strlen(buf);\n        if (n && buf[n-1] == \'\\n\') buf[n-1] = 0;\n        reverse(buf);\n        printf("%s\\n", buf);\n    }\n    return 0;\n}\n',
        code: '#include <stdio.h>\n#include <string.h>\n\nvoid reverse(char *s) {\n    size_t i = 0, j = strlen(s);\n    if (!j) return;\n    for (--j; i < j; ++i, --j) {\n        char t = s[i]; s[i] = s[j]; s[j] = t;\n    }\n}\n\nint main(void) {\n    char buf[256];\n    if (fgets(buf, sizeof buf, stdin)) {\n        size_t n = strlen(buf);\n        if (n && buf[n-1] == \'\\n\') buf[n-1] = 0;\n        reverse(buf);\n        printf("%s\\n", buf);\n    }\n    return 0;\n}\n',
        files: [{ id: 'def_f_reverse_main', name: 'main', ext: '.c',
          starterCode: '#include <stdio.h>\n#include <string.h>\n\nvoid reverse(char *s) {\n    // TODO\n}\n',
          code: '#include <stdio.h>\n#include <string.h>\n\nvoid reverse(char *s) {\n    size_t i = 0, j = strlen(s);\n    if (!j) return;\n    for (--j; i < j; ++i, --j) {\n        char t = s[i]; s[i] = s[j]; s[j] = t;\n    }\n}\n'
        }],
        samples: [{ title: 'Sample', content: 'Input:\nhello\nOutput:\nolleh\n' }]
      }]
    },
    {
      id: 'default_challenge_linkedlist', _isDefault: true,
      title: 'Linked List — Print in Order', parentId: fChStructures.id, order: 0,
      tags: ['Linked List', 'Pointer'],
      coverDescription: 'Define a simple singly-linked list and print all values from head to tail.',
      variants: [{
        id: 'def_v_ll', name: 'Singly Linked',
        description: 'Build a linked list of 3 nodes containing 1, 2, 3 and print each value on its own line.',
        starterCode: '#include <stdio.h>\n#include <stdlib.h>\n\ntypedef struct Node { int val; struct Node *next; } Node;\n\nint main(void) {\n    // TODO: build list 1 -> 2 -> 3 and print each value\n    return 0;\n}\n',
        code: '#include <stdio.h>\n#include <stdlib.h>\n\ntypedef struct Node { int val; struct Node *next; } Node;\n\nint main(void) {\n    Node *c = malloc(sizeof *c); c->val = 3; c->next = NULL;\n    Node *b = malloc(sizeof *b); b->val = 2; b->next = c;\n    Node *a = malloc(sizeof *a); a->val = 1; a->next = b;\n    for (Node *p = a; p; p = p->next) printf("%d\\n", p->val);\n    return 0;\n}\n',
        files: [{ id: 'def_f_ll_main', name: 'main', ext: '.c',
          starterCode: '#include <stdio.h>\n#include <stdlib.h>\n\ntypedef struct Node { int val; struct Node *next; } Node;\n\nint main(void) {\n    // TODO\n    return 0;\n}\n',
          code: '#include <stdio.h>\n#include <stdlib.h>\n\ntypedef struct Node { int val; struct Node *next; } Node;\n\nint main(void) {\n    Node *c = malloc(sizeof *c); c->val = 3; c->next = NULL;\n    Node *b = malloc(sizeof *b); b->val = 2; b->next = c;\n    Node *a = malloc(sizeof *a); a->val = 1; a->next = b;\n    for (Node *p = a; p; p = p->next) printf("%d\\n", p->val);\n    return 0;\n}\n'
        }],
        samples: [{ title: 'Expected Output', content: '1\n2\n3\n' }]
      }]
    }
  ];

  const snippets = [
    {
      id: 'default_snippet_for_loop', _isDefault: true,
      title: 'For Loop Pattern', parentId: fSnBasics.id, order: 0,
      tags: ['Loop', 'Beginner'],
      description: '<p>A <strong>for loop</strong> iterates over a range of numbers. It has three parts: <em>initialization</em>, <em>condition</em>, and <em>increment</em>.</p>',
      comments: '<p>Use <code>for</code> when you know how many times you want to iterate. Use <code>while</code> when the count is condition-driven.</p>',
      starterCode: '',
      relatedChallenges: [],
      examples: [{ id: 'def_ex_for_1', name: 'Count to 5', code: 'for (int i = 0; i < 5; i++) {\n    printf("%d\\n", i);\n}\n', highlightLines: '1' }],
      tryCodingTargetIndices: [0]
    },
    {
      id: 'default_snippet_pointers', _isDefault: true,
      title: 'Pointer Basics', parentId: fSnBasics.id, order: 1,
      tags: ['Pointer', 'Memory'],
      description: '<p>A <strong>pointer</strong> stores the address of a value. Dereference with <code>*</code>, take address with <code>&amp;</code>.</p>',
      comments: '<p>A NULL pointer points to nothing — always check before dereferencing.</p>',
      starterCode: '',
      relatedChallenges: [],
      examples: [{ id: 'def_ex_ptr_1', name: 'Address & Deref', code: 'int x = 42;\nint *p = &x;\nprintf("%d\\n", *p);  // prints 42\n', highlightLines: '2-3' }],
      tryCodingTargetIndices: [0]
    },
    {
      id: 'default_snippet_swap', _isDefault: true,
      title: 'Swap Pattern', parentId: fSnPatterns.id, order: 0,
      tags: ['Pattern', 'Swap'],
      description: '<p>Swapping two values needs a temporary variable (or, for ints, an XOR trick).</p>',
      comments: '<p>Prefer the temporary-variable version for clarity. The XOR trick fails if both addresses are the same.</p>',
      starterCode: '',
      relatedChallenges: [],
      examples: [
        { id: 'def_ex_swap_1', name: 'With Temp', code: 'int t = a;\na = b;\nb = t;\n', highlightLines: '' },
        { id: 'def_ex_swap_2', name: 'XOR Trick', code: 'a ^= b;\nb ^= a;\na ^= b;\n', highlightLines: '' }
      ],
      tryCodingTargetIndices: [0]
    }
  ];

  const notebooks = [
    {
      id: 'default_notebook_quickstart', _isDefault: true,
      title: 'Quick Start Quiz', parentId: fNbGeneral.id, order: 0,
      icon: 'book',
      tags: ['Beginner'],
      description: 'A sample notebook with example questions to get you started.',
      sections: [{
        id: 'def_sec_qs_basics', label: 'Basics', choices: 4,
        questions: [1, 2, 3],
        answerKey: '1=A\n2=C\n3=B',
        answerKeysData: [
          { qNum: 1, type: 'mcq', answer: 'A', explanation: 'printf is the standard C output function.', question: 'Which function prints to stdout in C?', hint: '', choices: { A: 'printf()', B: 'console.log()', C: 'echo()', D: 'System.out.println()' } },
          { qNum: 2, type: 'mcq', answer: 'C', explanation: 'const declares a value that cannot be reassigned.', question: 'Which keyword declares a constant?', hint: '', choices: { A: 'var', B: 'let', C: 'const', D: 'static' } },
          { qNum: 3, type: 'mcq', answer: 'B', explanation: 'A semicolon terminates statements in C.', question: 'Which character ends a statement in C?', hint: '', choices: { A: ':', B: ';', C: '.', D: ',' } }
        ]
      }]
    },
    {
      id: 'default_notebook_pointers', _isDefault: true,
      title: 'Pointer Concepts', parentId: fNbConcepts.id, order: 0,
      icon: 'cpu',
      tags: ['Pointer'],
      description: 'Test your understanding of C pointers.',
      sections: [{
        id: 'def_sec_ptr', label: 'Pointers', choices: 4,
        questions: [1, 2],
        answerKey: '1=B\n2=A',
        answerKeysData: [
          { qNum: 1, type: 'mcq', answer: 'B', explanation: 'The & operator returns the address of a variable.', question: 'Which operator returns the address of a variable?', hint: '', choices: { A: '*', B: '&', C: '@', D: '#' } },
          { qNum: 2, type: 'mcq', answer: 'A', explanation: 'NULL is the conventional sentinel for a pointer that points to nothing.', question: 'What value indicates a pointer that points to nothing?', hint: '', choices: { A: 'NULL', B: '0xFFFF', C: 'undefined', D: '-1' } }
        ]
      }]
    }
  ];

  return {
    nodes,
    challenges,
    snippets,
    notebooks,
    expandedNodes: [fChBasics.id, fSnBasics.id, fNbGeneral.id],
    categoryRequirements: {},
    snippetProgress: {},
    badges: [],
    notebookHistory: [],
    history: [],
    activeAttempts: {}
  };
}

function seedDefaultData() {
  const seed = buildDefaultSeed();
  state.nodes = seed.nodes;
  state.challenges = seed.challenges;
  state.snippets = seed.snippets;
  state.notebooks = seed.notebooks;
  state.expandedNodes = seed.expandedNodes;
  state.categoryRequirements = seed.categoryRequirements;
  state.snippetProgress = seed.snippetProgress;
  state.badges = seed.badges;
  state.notebookHistory = seed.notebookHistory;
  state.history = seed.history;
  state.activeAttempts = seed.activeAttempts;
  saveData();
}

let saveTimeout;
let _breadcrumbCache = new Map();

/** Debounced localStorage persist — also clears the breadcrumb path cache. */
function saveData() {
  _breadcrumbCache = new Map(); // Invalidate path cache on every state change
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    const dataToSave = {
      // Legacy (kept for backward compat on export)
      categories: getNodeNamesForScope('challenge'),
      snippetCategories: getNodeNamesForScope('snippet'),
      notebookCategories: getNodeNamesForScope('notebook'),
      // New tree system
      nodes: state.nodes,
      expandedNodes: state.expandedNodes,
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
    try {
      localStorage.setItem(getAppStorageKey(), JSON.stringify(dataToSave));
    } catch (e) {
      console.error("Storage Error:", e);
      if (typeof showMessage === 'function') {
        showMessage("Storage Limit Reached", "Could not save data. Local storage has a 5MB limit.", true);
      } else {
        alert("Could not save data: Local storage 5MB limit exceeded.");
      }
    }
    // Also push to Firebase if in online mode
    if (typeof scheduleCloudSave === 'function') scheduleCloudSave();
  }, DEBOUNCE_SAVE_MS);
}

// ============================================================
// TREE HELPER FUNCTIONS
// ============================================================

// Get all items in the database by their scope category
function getItemsForScope(scope) {
  if (scope === 'challenge') return state.challenges || [];
  if (scope === 'snippet') return state.snippets || [];
  if (scope === 'notebook') return state.notebooks || [];
  return [];
}

// Get root-level folder names for a scope (for legacy compat)
function getNodeNamesForScope(scope) {
  return state.nodes
    .filter(n => n.type === 'folder' && n.scope === scope && n.parentId === null)
    .map(n => n.name);
}

// Get child folders of a parent
function getChildFolders(parentId, scope) {
  return state.nodes
    .filter(n =>
      n.type === 'folder' &&
      n.parentId === (parentId || null) &&
      (!scope || n.scope === scope)
    )
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

// Count all items recursively inside a folder
function countItemsRecursive(folderId, scope) {
  let count = 0;
  // Direct items
  if (scope === 'challenge') count += state.challenges.filter(c => c.parentId === folderId).length;
  else if (scope === 'snippet') count += (state.snippets || []).filter(s => s.parentId === folderId).length;
  else if (scope === 'notebook') count += (state.notebooks || []).filter(n => n.parentId === folderId).length;
  // Child folders
  const childFolders = state.nodes.filter(n => n.type === 'folder' && n.parentId === folderId);
  childFolders.forEach(cf => { count += countItemsRecursive(cf.id, scope); });
  return count;
}

// Get items directly in a folder
function getItemsInFolder(folderId, scope) {
  const parentId = folderId || null;
  let items = [];
  if (scope === 'challenge') items = state.challenges.filter(c => c.parentId === parentId);
  else if (scope === 'snippet') items = (state.snippets || []).filter(s => s.parentId === parentId);
  else if (scope === 'notebook') items = (state.notebooks || []).filter(n => n.parentId === parentId);
  return items.sort((a, b) => (a.order || 0) - (b.order || 0));
}

/** @param {string} nodeId @returns {Array} ordered array of node objects from root to nodeId */
function getBreadcrumbPath(nodeId) {
  if (_breadcrumbCache.has(nodeId)) return _breadcrumbCache.get(nodeId);
  const path = [];
  let current = state.nodes.find(n => n.id === nodeId);
  while (current) {
    path.unshift(current);
    current = current.parentId ? state.nodes.find(n => n.id === current.parentId) : null;
  }
  _breadcrumbCache.set(nodeId, path);
  return path;
}

// Check if nodeId is a descendant of ancestorId (circular reference guard)
function isDescendantOf(nodeId, ancestorId) {
  let current = state.nodes.find(n => n.id === nodeId);
  while (current) {
    if (current.parentId === ancestorId) return true;
    current = current.parentId ? state.nodes.find(n => n.id === current.parentId) : null;
  }
  return false;
}

// --- CRUD Operations ---
function createNode(name, type, parentId, scope) {
  const node = { id: generateId(), type, name, parentId: parentId || null, scope: scope || 'challenge' };
  state.nodes.push(node);
  saveData();
  return node;
}

function deleteNode(nodeId) {
  const node = state.nodes.find(n => n.id === nodeId);
  if (!node) return;
  const promotedParentId = node.parentId || null;

  // Find the current highest order in the promoted parent so we don't overlap
  const existingFolders = getChildFolders(promotedParentId, node.scope);
  const existingItems = getItemsInFolder(promotedParentId, node.scope);
  let maxOrder = Math.max(
    -1,
    ...existingFolders.map(f => f.order || 0),
    ...existingItems.map(i => i.order || 0)
  );

  // Promote immediate child folders to the deleted node's parent
  state.nodes.filter(n => n.parentId === nodeId).forEach(child => {
    child.parentId = promotedParentId;
    child.order = ++maxOrder;
  });

  // Promote items whose parentId was this node
  state.challenges.forEach(c => { if (c.parentId === nodeId) { c.parentId = promotedParentId; c.order = ++maxOrder; }});
  if (state.snippets) state.snippets.forEach(s => { if (s.parentId === nodeId) { s.parentId = promotedParentId; s.order = ++maxOrder; }});
  if (state.notebooks) state.notebooks.forEach(n => { if (n.parentId === nodeId) { n.parentId = promotedParentId; n.order = ++maxOrder; }});

  // Remove only the target node
  state.nodes = state.nodes.filter(n => n.id !== nodeId);

  // Clean up requirements for just this node
  delete state.categoryRequirements[nodeId];

  // Also remove this node from being a requirement for OTHER categories
  Object.keys(state.categoryRequirements).forEach(key => {
    if (state.categoryRequirements[key].reqNodeId === nodeId) {
      state.categoryRequirements[key].reqNodeId = promotedParentId; 
      if (!promotedParentId) delete state.categoryRequirements[key];
    }
  });

  saveData();
}

function moveNode(nodeId, newParentId) {
  // Guard: can't move into self or descendant
  if (nodeId === newParentId) return;
  if (newParentId && isDescendantOf(newParentId, nodeId)) return;

  const node = state.nodes.find(n => n.id === nodeId);
  if (node) {
    node.parentId = newParentId || null;
    saveData();
  }
}

function renameNode(nodeId, newName) {
  if (!newName || !newName.trim()) return;
  const node = state.nodes.find(n => n.id === nodeId);
  if (node) {
    node.name = newName.trim();
    saveData();
  }
}

function moveItemToFolder(itemId, itemType, newFolderId) {
  if (itemType === 'challenge') {
    const item = state.challenges.find(c => c.id === itemId);
    if (item) { item.parentId = newFolderId || null; saveData(); }
  } else if (itemType === 'snippet') {
    const item = (state.snippets || []).find(s => s.id === itemId);
    if (item) { item.parentId = newFolderId || null; saveData(); }
  } else if (itemType === 'notebook') {
    const item = (state.notebooks || []).find(n => n.id === itemId);
    if (item) { item.parentId = newFolderId || null; saveData(); }
  }
}

// Toggle expand/collapse
function toggleNodeExpanded(nodeId) {
  const idx = state.expandedNodes.indexOf(nodeId);
  if (idx >= 0) {
    state.expandedNodes.splice(idx, 1);
  } else {
    state.expandedNodes.push(nodeId);
  }
  saveData();
}

function isNodeExpanded(nodeId) {
  return state.expandedNodes.includes(nodeId);
}

function updateTreeOrder(parentId, scope, sortedIds) {
  // Update order property for folders
  sortedIds.forEach((id, index) => {
    const node = state.nodes.find(n => n.id === id);
    if (node) {
      node.order = index;
      node.parentId = parentId || null;
    } else {
      // Check items
      const items = getItemsForScope(scope);
      const item = items.find(it => it.id === id);
      if (item) {
        item.order = index;
        item.parentId = parentId || null;
      }
    }
  });
  saveData();
}

/** @param {string} key SESSION_KEYS constant @param {*} value JSON-serializable */
function setSessionParam(key, value) {
  sessionStorage.setItem(SESSION_PREFIX + key, JSON.stringify(value));
}

/** @param {string} key @returns {*} parsed value or null */
function getSessionParam(key) {
  const val = sessionStorage.getItem(SESSION_PREFIX + key);
  if (val) {
    try { return JSON.parse(val); } catch (e) { return null; }
  }
  return null;
}

function clearSessionParam(key) {
  sessionStorage.removeItem(SESSION_PREFIX + key);
}

/** Atomic state mutation + save. @param {function(state): void} updaterFn */
function setState(updaterFn) {
  updaterFn(state);
  saveData();
}

// --- Shareable Challenge/Snippet URL Encoding ---
function encodeShareData(data) {
  try {
    return btoa(encodeURIComponent(JSON.stringify(data)));
  } catch (e) {
    console.error('[Share] Encode failed:', e);
    return null;
  }
}

function decodeShareData(str) {
  try {
    const base64Str = str.replace(/ /g, '+');
    return JSON.parse(decodeURIComponent(atob(base64Str)));
  } catch (e) {
    console.error('[Share] Decode failed:', e);
    return null;
  }
}