/* Route: register */
function registerAllRoutes() {
  SpaRouter.register('home', { title: 'StudySession Pro — Dashboard', templateFn: homeTemplate, initFn: homeInit, destroyFn: homeDestroy, sidebarVisible: true, navId: 'nav-home' });
  SpaRouter.register('browse', { title: 'StudySession Pro — Coding Library', templateFn: browseTemplate, initFn: browseInit, destroyFn: browseDestroy, sidebarVisible: true, navId: 'nav-browse' });
  SpaRouter.register('study', { title: 'StudySession Pro — Notes Library', templateFn: studyTemplate, initFn: studyInit, destroyFn: studyDestroy, sidebarVisible: true, navId: 'nav-study' });
  SpaRouter.register('analytics', { title: 'StudySession Pro — Analytics', templateFn: analyticsTemplate, initFn: analyticsInit, destroyFn: analyticsDestroy, sidebarVisible: true, navId: 'nav-analytics' });
  SpaRouter.register('admin', { title: 'StudySession Pro — Admin Panel', templateFn: adminTemplate, initFn: adminInit, destroyFn: adminDestroy, sidebarVisible: true, navId: 'nav-admin' });
  SpaRouter.register('visualization', { title: 'StudySession Pro — Visualization', templateFn: vizTemplate, initFn: vizInit, destroyFn: vizDestroy, sidebarVisible: true, navId: 'nav-mindmap' });
  SpaRouter.register('quests', { title: 'StudySession Pro — Quest Board', templateFn: questTemplate, initFn: questInit, destroyFn: questDestroy, sidebarVisible: true, navId: 'nav-quests' });
  SpaRouter.register('practice', { title: 'StudySession Pro — Practice', templateFn: practiceTemplate, initFn: practiceInit, destroyFn: practiceDestroy, sidebarVisible: false, navId: null });
  SpaRouter.register('solution', { title: 'StudySession Pro — Solution', templateFn: solutionTemplate, initFn: solutionInit, destroyFn: solutionDestroy, sidebarVisible: false, navId: null });
  SpaRouter.register('notes-practice', { title: 'Notebook Session — StudySession Pro', templateFn: notesPracticeTemplate, initFn: notesPracticeInit, destroyFn: notesPracticeDestroy, sidebarVisible: false, navId: null });
  SpaRouter.register('notes-solution', { title: 'Notebook Results — StudySession Pro', templateFn: notesSolutionTemplate, initFn: notesSolutionInit, destroyFn: notesSolutionDestroy, sidebarVisible: false, navId: null });
}
