// ============================================
// VIEW DATA LOADING DISPATCHER
// ============================================

/**
 * Load data for a specific view.
 * 
 * This function acts as a dispatcher that calls the appropriate
 * data loading function based on the selected view. Each view has
 * its own loading function that fetches data from the backend API.
 * 
 * Why async?
 * - All data loading functions make HTTP requests (async operations)
 * - Using async/await makes the code cleaner and easier to read
 * - Allows proper error handling with try/catch
 * 
 * @param {string} view - The name of the view to load data for
 * @returns {Promise<void>} - Resolves when data loading is complete
 * 
 * Example Flow:
 * 1. User clicks "Projects" in navigation
 * 2. showView('projects') is called
 * 3. loadViewData('projects') is called
 * 4. loadProjects() is called to fetch project data from API
 * 5. Projects are rendered in the UI
 */
async function loadViewData(view) {
  // Use a switch statement to call the appropriate loading function
  // Each case corresponds to a different view in the application
  switch(view) {
    case 'ai-suggestions':
      // Load AI-powered task suggestions
      await loadAISuggestions();
      break;
      
    case 'calendar':
      // Load calendar view with task deadlines
      await loadCalendar();
      break;
      
    case 'graph':
      // Load D3.js visualization of project/task relationships
      await loadGraph();
      break;
      
    case 'ideas':
      // Load innovation ideas with voting/comments
      await loadIdeas();
      break;
      
    case 'events':
      // Load team events and competitions
      await loadEvents();
      break;
      
    case 'projects':
      // Load all projects
      await loadProjects();
      break;
      
    case 'tasks':
      // Load all tasks with filtering options
      await loadTasks();
      break;
      
    case 'alerts':
      // Load notifications and alerts
      await loadAlerts();
      break;
      
    case 'attachments':
      // Load task list for attachment management
      await loadTasksForSelect();
      await loadAttachments();
      break;
  }
}

// Projects
async function loadProjects() {
  try {
    const res = await fetch(API_BASE_URL + '/api/projects');
    const data = await res.json();
    const list = document.getElementById('projects-list');
    list.innerHTML = '';

    if (data.length === 0) {
      list.innerHTML = `<div class="empty-state"><p>No projects yet. Create your first project above!</p></div>`;
      return;
    }

    data.forEach(proj => {
      const div = document.createElement('div');
      div.className = 'item';
      div.innerHTML = `
        <div class="item-header">
          <span class="item-title">${proj.name}</span>
          <div class="item-actions">
            <button class="btn btn-sm btn-primary" onclick="editProject(${proj.id}, '${proj.name.replace(/'/g, "\\'")}', '${proj.start_date || ''}', '${proj.end_date || ''}', '${(proj.description || '').replace(/'/g, "\\'")}')">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="display: inline; vertical-align: middle; margin-right: 4px;">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
              Edit
            </button>
            <button class="btn btn-sm btn-danger" onclick="deleteProject(${proj.id})">Delete</button>
          </div>
        </div>
        <div class="item-meta">Start: ${proj.start_date || '—'} | End: ${proj.end_date || '—'}</div>
        <div class="item-description">${proj.description || ''}</div>
      `;
      list.appendChild(div);
    });
  } catch (error) {
    console.error('Error loading projects:', error);
  }
}

// Tasks
async function loadTasks() {
  try {
    const res = await fetch(API_BASE_URL + '/api/tasks');
    const data = await res.json();
    const list = document.getElementById('tasks-list');
    list.innerHTML = '';

    if (data.length === 0) {
      list.innerHTML = `<div class="empty-state"><p>No tasks yet. Create your first task above!</p></div>`;
      return;
    }

    // Get projects for display
    const projectsRes = await fetch(API_BASE_URL + '/api/projects');
    const projects = await projectsRes.json();
    const projectMap = {};
    projects.forEach(p => projectMap[p.id] = p.name);

    // Create task map for relationships
    const taskMap = {};
    data.forEach(t => taskMap[t.id] = t.title);

    data.forEach(task => {
      // Detailed priority classification with new colors
      let priorityClass, priorityText;
      if (task.priority === 1) {
        priorityClass = 'priority-badge priority-1';
        priorityText = '🔴 Urgent';
      } else if (task.priority === 2) {
        priorityClass = 'priority-badge priority-2';
        priorityText = '🟠 High';
      } else if (task.priority === 3) {
        priorityClass = 'priority-badge priority-3';
        priorityText = '🟡 Medium';
      } else if (task.priority === 4) {
        priorityClass = 'priority-badge priority-4';
        priorityText = '🔵 Low';
      } else {
        priorityClass = 'priority-badge priority-5';
        priorityText = '⚪ Minimal';
      }
      
      // Build relationships display
      let relationshipsHTML = '';
      if (task.parent_task_id) {
        const parentName = taskMap[task.parent_task_id] || 'Unknown Task';
        relationshipsHTML += `
          <div class="task-relationship-badge parent">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
            </svg>
            <span><strong>Subtask of:</strong> ${parentName}</span>
          </div>
        `;
      }
      if (task.depends_on_task_id) {
        const dependsName = taskMap[task.depends_on_task_id] || 'Unknown Task';
        relationshipsHTML += `
          <div class="task-relationship-badge dependency">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
            </svg>
            <span><strong>Depends on:</strong> ${dependsName}</span>
          </div>
        `;
      }
      
      const div = document.createElement('div');
      div.className = 'item';
      div.innerHTML = `
        <div class="item-header">
          <span class="item-title">${task.title}</span>
          <div class="item-actions">
            <button class="btn btn-sm btn-primary" onclick="editTask(${task.id})">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="display: inline; vertical-align: middle; margin-right: 4px;">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
              Edit
            </button>
            <button class="btn btn-sm btn-danger" onclick="deleteTask(${task.id})">Delete</button>
          </div>
        </div>
        <div class="item-meta">Project: ${projectMap[task.project_id] || '—'} | Due: ${task.due_date || '—'}</div>
        <div class="item-description">Assigned to: ${task.assigned_to || 'Unassigned'}</div>
        <span class="${priorityClass}">${priorityText}</span>
        ${relationshipsHTML}
      `;
      list.appendChild(div);
    });
  } catch (error) {
    console.error('Error loading tasks:', error);
  }
}