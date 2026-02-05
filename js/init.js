// ========== DOM Content Loaded Initialization ==========
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 DOM Content Loaded - Initializing PS16 Workspace...');

  // Initialize navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const view = item.dataset.view;
      console.log('🧭 NAVIGATION: Switching to view:', view);

      // Update active state
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      // Update header
      const titleElement = document.getElementById('view-title');
      const subtitleElement = document.getElementById('view-subtitle');

      if (titleElement) {
        titleElement.textContent = view.charAt(0).toUpperCase() + view.slice(1);
      }

      if (subtitleElement) {
        const subtitles = {
          calendar: 'View and manage task deadlines',
          graph: 'Visual project and task relationships',
          projects: 'Manage your projects and track progress',
          tasks: 'Create and manage tasks for your projects',
          attachments: 'Upload and manage project files'
        };
        subtitleElement.textContent = subtitles[view] || '';
      }

      // Show/hide views
      document.querySelectorAll('.view-section').forEach(sec => sec.style.display = 'none');
      const viewElement = document.getElementById(`${view}-view`);
      if (viewElement) {
        viewElement.style.display = 'block';
        console.log(`✅ NAVIGATION: ${view} view shown`);
      } else {
        console.error(`❌ NAVIGATION: ${view}-view element not found`);
      }

      // Load data for the view
      if (view === 'calendar') {
        if (typeof loadCalendar === 'function') loadCalendar();
      } else if (view === 'graph') {
        if (typeof loadGraph === 'function') loadGraph();
      } else if (view === 'projects') {
        if (typeof loadProjects === 'function') loadProjects();
      } else if (view === 'tasks') {
        if (typeof loadTasksForSelect === 'function') loadTasksForSelect();
        // loadTasks() is already called by showView, no need to call it again
      } else if (view === 'attachments') {
        if (typeof loadTasksForSelect === 'function') loadTasksForSelect();
        if (typeof loadAttachments === 'function') loadAttachments();
      }
    });
  });

  // Load initial data
  if (typeof loadProjects === 'function') loadProjects();
  if (typeof loadTasksForSelect === 'function') loadTasksForSelect();

  console.log('✅ PS16 Workspace fully initialized');
});