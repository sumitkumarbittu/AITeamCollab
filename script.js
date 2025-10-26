// Global function to show views - accessible from anywhere
window.showView = function(view) {
  console.log(`🧭 showView called: "${view}"`);
  
  // Update active state in navigation
  document.querySelectorAll('.nav-item').forEach(i => {
    i.classList.remove('active');
    if (i.dataset.view === view) {
      i.classList.add('active');
    }
  });

  // Update header
  const viewTitle = document.getElementById('view-title');
  const viewSubtitle = document.getElementById('view-subtitle');
  if (viewTitle) {
    viewTitle.textContent = view.charAt(0).toUpperCase() + view.slice(1);
  }
  if (viewSubtitle) {
    viewSubtitle.textContent = getViewSubtitle(view);
  }

  // Show/hide views
  document.querySelectorAll('.view-section').forEach(sec => sec.style.display = 'none');
  const targetView = document.getElementById(`${view}-view`);
  if (targetView) {
    targetView.style.display = 'block';
    console.log(`✅ Showing view: ${view}`);
  } else {
    console.error(`❌ View not found: ${view}-view`);
  }

  // Load data for the view
  loadViewData(view);
}

// Simple navigation for PS16 Collaborative Workspace
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 PS16 Workspace loaded');

  // Set up navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const view = item.dataset.view;
      if (view) {
        showView(view);
      }
    });
  });

  // Load initial data
  loadProjects();
  loadTasksForSelect();

  console.log('✅ PS16 Workspace initialized');
});

function getViewSubtitle(view) {
  const subtitles = {
    'ai-suggestions': 'Get AI-powered suggestions for your tasks',
    calendar: 'View and manage task deadlines',
    graph: 'Visual project and task relationships',
    projects: 'Manage your projects and track progress',
    tasks: 'Create and manage tasks for your projects',
    attachments: 'Upload and manage project files',
    alerts: 'Stay updated with important notifications and alerts'
  };
  return subtitles[view] || '';
}

async function loadViewData(view) {
  switch(view) {
    case 'ai-suggestions':
      await loadAISuggestions();
      break;
    case 'calendar':
      await loadCalendar();
      break;
    case 'graph':
      await loadGraph();
      break;
    case 'projects':
      await loadProjects();
      break;
    case 'tasks':
      await loadTasks();
      break;
    case 'alerts':
      await loadAlerts();
      break;
    case 'attachments':
      await loadTasksForSelect();
      await loadAttachments();
      break;
  }
}

// Projects
async function loadProjects() {
  try {
    const res = await fetch('/api/projects');
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
    const res = await fetch('/api/tasks');
    const data = await res.json();
    const list = document.getElementById('tasks-list');
    list.innerHTML = '';

    if (data.length === 0) {
      list.innerHTML = `<div class="empty-state"><p>No tasks yet. Create your first task above!</p></div>`;
      return;
    }

    // Get projects for display
    const projectsRes = await fetch('/api/projects');
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

// Priority slider functionality
const prioritySlider = document.getElementById('task-priority');
const priorityDisplay = document.getElementById('priority-display');

function updatePriorityDisplay(value) {
  const priorityNames = {
    1: '🔴 Urgent',
    2: '🟠 High',
    3: '🟡 Medium',
    4: '🔵 Low',
    5: '⚪ Minimal'
  };
  
  if (priorityDisplay) {
    priorityDisplay.innerHTML = `<span class="priority-badge priority-${value}">${priorityNames[value]}</span>`;
  }
}

if (prioritySlider) {
  prioritySlider.addEventListener('input', (e) => {
    updatePriorityDisplay(e.target.value);
  });
  
  // Initialize display
  updatePriorityDisplay(prioritySlider.value);
}

// Form handlers
document.getElementById('create-project-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const editId = form.dataset.editId;
  
  const payload = {
    name: document.getElementById('project-name').value,
    start_date: document.getElementById('project-start').value || null,
    end_date: document.getElementById('project-end').value || null,
    description: document.getElementById('project-desc').value || null
  };

  try {
    const url = editId ? `/api/projects/${editId}` : '/api/projects';
    const method = editId ? 'PUT' : 'POST';
    
    const res = await fetch(url, {
      method: method,
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      e.target.reset();
      delete form.dataset.editId;
      
      // Reset form title and button
      const formTitle = document.querySelector('#projects-view .card-title');
      const formButton = form.querySelector('button[type="submit"]');
      if (formTitle) formTitle.textContent = 'Create New Project';
      if (formButton) {
        formButton.innerHTML = `
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          Create Project
        `;
      }
      
      loadProjects();
      // Refresh activity widget immediately
      refreshActivityLog();
    } else {
      alert(editId ? 'Failed to update project' : 'Failed to create project');
    }
  } catch (error) {
    console.error('Error saving project:', error);
    alert('Failed to save project');
  }
});

document.getElementById('create-task-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const editId = form.dataset.editId;
  
  const parentTaskId = document.getElementById('task-parent-select').value;
  const dependsOnTaskId = document.getElementById('task-depends-select').value;
  
  const payload = {
    project_id: parseInt(document.getElementById('task-project-select').value),
    title: document.getElementById('task-title').value,
    assigned_to: document.getElementById('task-assigned').value || null,
    due_date: document.getElementById('task-due').value || null,
    priority: parseInt(document.getElementById('task-priority').value),
    parent_task_id: parentTaskId ? parseInt(parentTaskId) : null,
    depends_on_task_id: dependsOnTaskId ? parseInt(dependsOnTaskId) : null
  };

  try {
    const url = editId ? `/api/tasks/${editId}` : '/api/tasks';
    const method = editId ? 'PUT' : 'POST';
    
    const res = await fetch(url, {
      method: method,
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      e.target.reset();
      delete form.dataset.editId;
      
      // Reset form title and button
      const formTitle = document.querySelector('#tasks-view .card-title');
      const formButton = form.querySelector('button[type="submit"]');
      if (formTitle) formTitle.textContent = 'Create New Task';
      if (formButton) {
        formButton.innerHTML = `
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          Create Task
        `;
      }
      
      loadTasks();
      // Refresh activity widget immediately
      refreshActivityLog();
    } else {
      alert(editId ? 'Failed to update task' : 'Failed to create task');
    }
  } catch (error) {
    console.error('Error saving task:', error);
    alert('Failed to save task');
  }
});

// Task management
async function loadTasksForSelect() {
  try {
    const res = await fetch('/api/tasks');
    const tasks = await res.json();

    // Update task dropdown in create task form
    const taskSelect = document.getElementById('task-project-select');
    if (taskSelect) {
      const projectRes = await fetch('/api/projects');
      const projects = await projectRes.json();
      taskSelect.innerHTML = `<option value="">Select Project *</option>`;
      projects.forEach(p => {
        taskSelect.innerHTML += `<option value="${p.id}">${p.name}</option>`;
      });
    }

    // Update parent task dropdown
    const parentSelect = document.getElementById('task-parent-select');
    if (parentSelect) {
      parentSelect.innerHTML = `<option value="">None (Independent Task)</option>`;
      tasks.forEach(t => {
        const statusBadge = t.status === 'done' ? '✅' : t.status === 'in_progress' ? '🔄' : '📝';
        parentSelect.innerHTML += `<option value="${t.id}">${statusBadge} ${t.title}</option>`;
      });
    }

    // Update depends on task dropdown
    const dependsSelect = document.getElementById('task-depends-select');
    if (dependsSelect) {
      dependsSelect.innerHTML = `<option value="">No Dependencies</option>`;
      tasks.forEach(t => {
        const statusBadge = t.status === 'done' ? '✅' : t.status === 'in_progress' ? '🔄' : '📝';
        dependsSelect.innerHTML += `<option value="${t.id}">${statusBadge} ${t.title}</option>`;
      });
    }

    // Update task dropdown in upload form
    const uploadSelect = document.getElementById('upload-task-select');
    if (uploadSelect) {
      uploadSelect.innerHTML = `<option value="">Select Task *</option>`;
      tasks.forEach(t => {
        uploadSelect.innerHTML += `<option value="${t.id}">${t.title}</option>`;
      });
    }
  } catch (error) {
    console.error('Error loading tasks for select:', error);
  }
}

async function deleteProject(id) {
  if (!confirm('Delete this project?')) return;
  try {
    await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    loadProjects();
    // Refresh activity widget immediately
    refreshActivityLog();
  } catch (error) {
    console.error('Error deleting project:', error);
  }
}

async function deleteTask(id) {
  if (!confirm('Delete this task?')) return;
  try {
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    loadTasks();
    // Refresh activity widget immediately
    refreshActivityLog();
  } catch (error) {
    console.error('Error deleting task:', error);
  }
}

// File upload
document.getElementById('upload-file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  document.getElementById('file-name-display').textContent = file ? file.name : '';
});

document.getElementById('upload-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const fileInput = document.getElementById('upload-file');
  const taskId = document.getElementById('upload-task-select').value;
  const uploadedBy = document.getElementById('upload-by').value;

  if (!fileInput.files.length || !taskId) {
    alert('Please select a task and a file.');
    return;
  }

  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  formData.append('uploaded_by', uploadedBy);

  try {
    const res = await fetch(`/api/tasks/${taskId}/attachments`, {
      method: 'POST',
      body: formData
    });

    if (res.ok) {
      alert('✅ Upload successful!');
      e.target.reset();
      document.getElementById('file-name-display').textContent = '';
      loadAttachments(); // Refresh the all attachments view
      // Refresh activity widget immediately
      refreshActivityLog();
    } else {
      const error = await res.json();
      alert(`❌ Upload failed: ${error.error || res.statusText}`);
    }
  } catch (error) {
    alert(`❌ Upload failed: ${error.message}`);
  }
});

// Load all attachments (not filtered by task)
async function loadAttachments() {
  try {
    // Fetch all attachments with task and project info
    const res = await fetch('/api/attachments');
    const data = await res.json();
    const list = document.getElementById('attachments-list');
    list.innerHTML = '';

    if (data.length === 0) {
      list.innerHTML = `<div class="empty-state"><p>No attachments yet. Upload your first file above!</p></div>`;
      return;
    }

    data.forEach(att => {
      const div = document.createElement('div');
      div.className = 'item';
      div.innerHTML = `
        <div class="item-header">
          <span class="item-title">${att.filename}</span>
          <div class="item-actions">
            <a href="/api/attachments/${att.id}" class="btn btn-sm btn-primary" download>Download</a>
            <button class="btn btn-sm btn-danger" onclick="deleteAttachment(${att.id})">Delete</button>
          </div>
        </div>
        <div class="item-meta">Project: ${att.project_name || 'Unknown Project'} | Task: ${att.task_title || 'Unknown Task'} | Uploaded by: ${att.uploaded_by || '—'} | At: ${new Date(att.uploaded_at).toLocaleString()}</div>
      `;
      list.appendChild(div);
    });
  } catch (error) {
    console.error('Error loading attachments:', error);
    document.getElementById('attachments-list').innerHTML = `<div class="empty-state"><p>Error loading attachments.</p></div>`;
  }
}

async function deleteAttachment(id) {
  if (!confirm('Delete this attachment?')) return;
  try {
    await fetch(`/api/attachments/${id}`, { method: 'DELETE' });
    loadAttachments(); // Refresh the all attachments view
    // Refresh activity widget immediately
    refreshActivityLog();
    alert('Attachment deleted');
  } catch (error) {
    console.error('Error deleting attachment:', error);
    alert('Delete failed');
  }
}





// ========== Floating Activity Log ==========
const activityWidget = document.getElementById('activity-widget');
const activityHeader = document.getElementById('activity-header');
const activityToggleBtn = document.getElementById('toggle-activity');
const activityBody = document.getElementById('activity-body');
const activityContent = document.getElementById('activity-content');

// Helper function to refresh activity widget after any data modification
function refreshActivityLog() {
  if (typeof window !== 'undefined' && window.refreshActivityWidget) {
    console.log('📊 Refreshing activity log after data change...');
    window.refreshActivityWidget();
  }
}

// Get minimized buttons
const activityMinimizedBtn = document.getElementById('activity-minimized-btn');
const chatMinimizedBtn = document.getElementById('chat-minimized-btn');

// Activity widget auto-minimize timers
let activityIdleTimer = null;
let activityInitialTimer = null;

function minimizeActivityWidget() {
  if (activityWidget && activityMinimizedBtn && !activityWidget.classList.contains('minimized')) {
    activityWidget.classList.add('minimized');
    activityMinimizedBtn.style.display = 'flex';
    console.log('📦 Activity widget auto-minimized');
  }
}

function resetActivityIdleTimer() {
  clearTimeout(activityIdleTimer);
  activityIdleTimer = setTimeout(() => {
    minimizeActivityWidget();
  }, 20000); // 20 seconds idle
}

function startActivityInitialTimer() {
  activityInitialTimer = setTimeout(() => {
    minimizeActivityWidget();
  }, 2000); // 5 seconds on load
}

// Toggle minimize/expand for activity widget
if (activityToggleBtn && activityMinimizedBtn) {
  activityToggleBtn.addEventListener('click', () => {
    clearTimeout(activityIdleTimer);
    clearTimeout(activityInitialTimer);
    activityWidget.classList.add('minimized');
    activityMinimizedBtn.style.display = 'flex';
  });
  
  // Click minimized button to restore
  activityMinimizedBtn.addEventListener('click', () => {
    activityWidget.classList.remove('minimized');
    activityMinimizedBtn.style.display = 'none';
    resetActivityIdleTimer();
  });
  
  // Reset idle timer on any interaction with widget
  if (activityWidget) {
    ['click', 'mousemove', 'mouseenter', 'scroll'].forEach(event => {
      activityWidget.addEventListener(event, resetActivityIdleTimer);
    });
    
    // Start initial 5-second timer when page loads
    startActivityInitialTimer();
  }
}

// Refresh button for activity widget
const refreshActivityBtn = document.getElementById('refresh-activity');
if (refreshActivityBtn) {
  refreshActivityBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent triggering drag
    refreshActivityBtn.style.transform = 'rotate(360deg)';
    loadActivityWidget();
    setTimeout(() => {
      refreshActivityBtn.style.transform = 'rotate(0deg)';
    }, 500);
  });
}

// Load activity logs dynamically
// Helper function to get relative time
function getRelativeTime(timestamp) {
  const now = new Date();
  const time = new Date(timestamp);
  const diffInSeconds = Math.floor((now - time) / 1000);
  
  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return time.toLocaleDateString();
}

// Helper function to get action icon and color
function getActionDetails(actionType) {
  const actions = {
    'created': {
      icon: `<svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd"/>
      </svg>`,
      class: 'created',
      text: 'Created'
    },
    'updated': {
      icon: `<svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20">
        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
      </svg>`,
      class: 'updated',
      text: 'Updated'
    },
    'deleted': {
      icon: `<svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>
      </svg>`,
      class: 'deleted',
      text: 'Deleted'
    }
  };
  return actions[actionType.toLowerCase()] || actions['updated'];
}

// Helper function to format object type
function formatObjectType(objectType) {
  const types = {
    'project': { emoji: '📁', name: 'Project' },
    'task': { emoji: '✓', name: 'Task' },
    'attachment': { emoji: '📎', name: 'Attachment' },
    'chat': { emoji: '💬', name: 'Chat' }
  };
  return types[objectType.toLowerCase()] || { emoji: '📄', name: objectType };
}

// Enhanced Activity Widget State
let allActivities = [];
let activityFilters = {
  type: 'all',
  action: 'all',
  search: ''
};

async function loadActivityWidget() {
  console.log('🔍 WIDGET: Loading enhanced activity logs...');
  try {
    const res = await fetch('/api/activity');
    const data = await res.json();
    allActivities = data; // Store all activities
    console.log('📊 WIDGET: Received', data.length, 'activities from API');

    renderActivityWidget();
    
  } catch (error) {
    console.error('❌ WIDGET ERROR:', error);
    if (activityContent) {
      activityContent.innerHTML = `
        <div class="activity-loading">
          <p style="color: #ef4444;">⚠️ Error loading activities</p>
          <small style="color: #999;">${error.message}</small>
        </div>
      `;
    }
  }
}

function renderActivityWidget() {
  if (!activityContent) return;
  
  // Apply filters
  let filteredActivities = allActivities;
  
  // Filter by type
  if (activityFilters.type !== 'all') {
    filteredActivities = filteredActivities.filter(a => 
      a.object_type.toLowerCase() === activityFilters.type
    );
  }
  
  // Filter by action
  if (activityFilters.action !== 'all') {
    filteredActivities = filteredActivities.filter(a => 
      a.action_type.toLowerCase() === activityFilters.action
    );
  }
  
  // Filter by search
  if (activityFilters.search) {
    const searchLower = activityFilters.search.toLowerCase();
    filteredActivities = filteredActivities.filter(a => {
      const objectName = formatObjectType(a.object_type).name.toLowerCase();
      const actionName = getActionDetails(a.action_type).text.toLowerCase();
      return objectName.includes(searchLower) || 
             actionName.includes(searchLower) ||
             (a.description && a.description.toLowerCase().includes(searchLower)) ||
             a.object_id.toString().includes(searchLower);
    });
  }
  
  activityContent.innerHTML = '';
  
  if (filteredActivities.length === 0) {
    const isFiltered = activityFilters.type !== 'all' || activityFilters.action !== 'all' || activityFilters.search;
    
    if (isFiltered) {
      activityContent.innerHTML = `
        <div class="activity-empty-filtered">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <p>No activities match your filters</p>
          <button onclick="clearActivityFilters()">Clear Filters</button>
        </div>
      `;
    } else {
      activityContent.innerHTML = `
        <div class="activity-loading">
          <p style="color: #999;">No activity yet</p>
          <small style="color: #ccc;">Activity will appear here as you work</small>
        </div>
      `;
    }
    
    updateActivityFooter(0, filteredActivities.length);
    return;
  }
  
  // Get recent activities (last 20)
  const recentActivities = filteredActivities.slice(-20).reverse();
  
  console.log('📋 WIDGET: Displaying', recentActivities.length, 'filtered activities');
  
  recentActivities.forEach(log => {
    const actionDetails = getActionDetails(log.action_type);
    const objectDetails = formatObjectType(log.object_type);
    const relativeTime = getRelativeTime(log.timestamp);
    const fullTime = new Date(log.timestamp).toLocaleString();
    
    // Fetch additional details for comprehensive display
    const metadataHTML = buildActivityMetadata(log);
    
    const div = document.createElement('div');
    div.className = `activity-item ${actionDetails.class}`;
    div.innerHTML = `
      <div class="activity-item-header">
        <div class="activity-icon ${actionDetails.class}">
          ${actionDetails.icon}
        </div>
        <div class="activity-details">
          <div class="activity-action">
            ${actionDetails.text}
          </div>
          <div class="activity-object">
            <span class="activity-object-type">${objectDetails.emoji} ${objectDetails.name}</span>
            <span style="color: #9ca3af;">#${log.object_id}</span>
          </div>
          ${metadataHTML}
        </div>
        <div class="activity-timestamp" title="${fullTime}">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          ${relativeTime}
        </div>
      </div>
    `;
    activityContent.appendChild(div);
  });
  
  updateActivityFooter(allActivities.length, filteredActivities.length);
}

// Build comprehensive metadata display
function buildActivityMetadata(log) {
  let metadata = '<div class="activity-metadata">';
  
  // Add description if available
  if (log.description) {
    metadata += `<div class="activity-description">${escapeHtml(log.description)}</div>`;
  }
  
  // Add user if available
  if (log.user_name || log.performed_by) {
    metadata += `
      <div class="activity-meta-row">
        <span class="activity-meta-label">👤 By:</span>
        <span class="activity-meta-value">${log.user_name || log.performed_by || 'System'}</span>
      </div>
    `;
  }
  
  // Add project info if available
  if (log.project_name) {
    metadata += `
      <div class="activity-meta-row">
        <span class="activity-meta-label">📁 Project:</span>
        <span class="activity-meta-value">${log.project_name}</span>
      </div>
    `;
  }
  
  // Add status if available
  if (log.status) {
    const statusEmoji = {
      'todo': '📝',
      'in_progress': '🔄',
      'done': '✅',
      'overdue': '⚠️'
    };
    metadata += `
      <div class="activity-meta-row">
        <span class="activity-meta-label">📊 Status:</span>
        <span class="activity-meta-value">${statusEmoji[log.status] || ''} ${log.status}</span>
      </div>
    `;
  }
  
  // Add priority if available
  if (log.priority) {
    const priorityNames = {
      1: '🔴 Urgent',
      2: '🟠 High',
      3: '🟡 Medium',
      4: '🔵 Low',
      5: '⚪ Minimal'
    };
    metadata += `
      <div class="activity-meta-row">
        <span class="activity-meta-label">⚡ Priority:</span>
        <span class="activity-meta-value">${priorityNames[log.priority] || 'N/A'}</span>
      </div>
    `;
  }
  
  metadata += '</div>';
  return metadata;
}

// Helper to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Update footer with counts
function updateActivityFooter(total, filtered) {
  const countEl = document.querySelector('.activity-count');
  const statusEl = document.querySelector('.activity-filter-status');
  
  if (countEl) {
    countEl.textContent = `${total} ${total === 1 ? 'activity' : 'activities'}`;
  }
  
  if (statusEl) {
    if (filtered < total) {
      statusEl.textContent = `(${filtered} shown)`;
    } else {
      statusEl.textContent = '';
    }
  }
  
  // Update minimized button badge
  if (activityMinimizedBtn) {
    const badge = activityMinimizedBtn.querySelector('.notification-badge');
    if (badge) {
      badge.textContent = total > 99 ? '99+' : total;
    }
  }
}

// Auto-refresh activity widget every 2 seconds
if (activityWidget && activityContent) {
  setInterval(loadActivityWidget, 2000);
  loadActivityWidget();

  // Global refresh function
  window.refreshActivityWidget = function() {
    console.log('🔄 Refreshing activity widget immediately...');
    loadActivityWidget();
  };

  console.log('✅ WIDGET INIT: Activity widget fully initialized');
  
  // Set up filter buttons
  document.querySelectorAll('.activity-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Toggle active state
      document.querySelectorAll('.activity-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Update filter and re-render
      activityFilters.type = btn.dataset.filter;
      renderActivityWidget();
      
      // Show/hide clear button
      updateClearButtonVisibility();
      
      console.log('🎨 Activity filter changed to:', activityFilters.type);
    });
  });
  
  // Set up action buttons
  document.querySelectorAll('.activity-action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Toggle active state
      document.querySelectorAll('.activity-action-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Update filter and re-render
      activityFilters.action = btn.dataset.action;
      renderActivityWidget();
      
      // Show/hide clear button
      updateClearButtonVisibility();
      
      console.log('🎨 Activity action filter changed to:', activityFilters.action);
    });
  });
  
  // Set up search input
  const searchInput = document.getElementById('activity-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      activityFilters.search = e.target.value;
      renderActivityWidget();
      updateClearButtonVisibility();
    });
    
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        searchInput.value = '';
        activityFilters.search = '';
        renderActivityWidget();
        updateClearButtonVisibility();
      }
    });
  }
  
  // Set up clear filters button
  const clearFiltersBtn = document.getElementById('clear-activity-filters');
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', () => {
      clearActivityFilters();
    });
  }
  
  // Set up clear all activity button
  const clearAllBtn = document.getElementById('clear-all-activity');
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', async () => {
      const confirmed = confirm('⚠️ Are you sure you want to clear ALL activity logs?\n\nThis action cannot be undone and will permanently delete all activity history.');
      
      if (!confirmed) return;
      
      try {
        console.log('🗑️ Clearing all activity logs...');
        
        const res = await fetch('/api/activity/clear', {
          method: 'DELETE'
        });
        
        if (res.ok) {
          const data = await res.json();
          console.log(`✅ Successfully cleared ${data.deleted_count || 'all'} activity logs`);
          
          // Clear the local activities array
          allActivities = [];
          
          // Re-render to show empty state
          renderActivityWidget();
          
          // Show success message
          alert(`✅ Successfully cleared all activity logs!`);
        } else {
          const error = await res.json();
          console.error('❌ Failed to clear activity logs:', error);
          alert('❌ Failed to clear activity logs. Please try again.');
        }
      } catch (error) {
        console.error('❌ Error clearing activity logs:', error);
        alert('❌ Error clearing activity logs. Please try again.');
      }
    });
  }
  
} else {
  console.error('❌ WIDGET INIT: Activity widget elements missing');
}

// Global function to clear activity filters
window.clearActivityFilters = function() {
  activityFilters = {
    type: 'all',
    action: 'all',
    search: ''
  };
  
  // Reset UI
  document.querySelectorAll('.activity-filter-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.activity-filter-btn[data-filter="all"]').classList.add('active');
  
  document.querySelectorAll('.activity-action-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.activity-action-btn[data-action="all"]').classList.add('active');
  
  const searchInput = document.getElementById('activity-search');
  if (searchInput) searchInput.value = '';
  
  renderActivityWidget();
  updateClearButtonVisibility();
  
  console.log('🔄 Activity filters cleared');
};

// Update clear button visibility based on active filters
function updateClearButtonVisibility() {
  const clearBtn = document.getElementById('clear-activity-filters');
  if (!clearBtn) return;
  
  const hasFilters = activityFilters.type !== 'all' || 
                     activityFilters.action !== 'all' || 
                     activityFilters.search !== '';
  
  clearBtn.style.display = hasFilters ? 'flex' : 'none';
}

// ========== Make Activity Widget Draggable ==========
let activityOffsetX, activityOffsetY, isActivityDragging = false;

// Only add draggable functionality if elements exist
if (activityWidget && activityHeader) {
  activityHeader.addEventListener('mousedown', (e) => {
    isActivityDragging = true;
    activityOffsetX = e.clientX - activityWidget.getBoundingClientRect().left;
    activityOffsetY = e.clientY - activityWidget.getBoundingClientRect().top;
    activityWidget.style.transition = 'none';
    resetActivityIdleTimer(); // Reset timer when dragging
  });

  document.addEventListener('mousemove', (e) => {
    if (!isActivityDragging) return;
    activityWidget.style.left = `${e.clientX - activityOffsetX}px`;
    activityWidget.style.top = `${e.clientY - activityOffsetY}px`;
    activityWidget.style.bottom = 'auto';
    activityWidget.style.right = 'auto';
  });

  document.addEventListener('mouseup', () => {
    isActivityDragging = false;
    activityWidget.style.transition = 'all 0.2s ease-in-out';
  });

  console.log('✅ WIDGET INIT: Activity widget draggable functionality added');
} else {
  console.error('❌ WIDGET INIT: Cannot add activity widget draggable functionality - missing elements');
}

// ========== Floating Chat Widget ==========
const chatWidget = document.getElementById('chat-widget');
const chatHeader = document.getElementById('chat-header');
const chatToggleBtn = document.getElementById('toggle-chat');
const chatBody = document.getElementById('chat-body');
const chatBox = document.getElementById('chat-box');
const messageForm = document.getElementById('message-form');
const nameInput = document.getElementById('name-input');
const messageInput = document.getElementById('message-input');
const resizeHandle = document.getElementById('resize-handle');

// Chat widget auto-minimize timers
let chatIdleTimer = null;
let chatInitialTimer = null;

function minimizeChatWidget() {
  if (chatWidget && chatMinimizedBtn && !chatWidget.classList.contains('minimized')) {
    chatWidget.classList.add('minimized');
    chatMinimizedBtn.style.display = 'flex';
    console.log('📦 Chat widget auto-minimized');
  }
}

function resetChatIdleTimer() {
  clearTimeout(chatIdleTimer);
  chatIdleTimer = setTimeout(() => {
    minimizeChatWidget();
  }, 20000); // 20 seconds idle
}

function startChatInitialTimer() {
  chatInitialTimer = setTimeout(() => {
    minimizeChatWidget();
  }, 2000); // 5 seconds on load
}

// Chat widget functionality
if (chatToggleBtn && chatWidget && chatMinimizedBtn) {
  chatToggleBtn.addEventListener('click', () => {
    clearTimeout(chatIdleTimer);
    clearTimeout(chatInitialTimer);
    chatWidget.classList.add('minimized');
    chatMinimizedBtn.style.display = 'flex';
  });
  
  // Click minimized button to restore
  chatMinimizedBtn.addEventListener('click', () => {
    chatWidget.classList.remove('minimized');
    chatMinimizedBtn.style.display = 'none';
    resetChatIdleTimer();
  });
  
  // Reset idle timer on any interaction with widget
  if (chatWidget) {
    ['click', 'mousemove', 'mouseenter', 'scroll', 'keypress'].forEach(event => {
      chatWidget.addEventListener(event, resetChatIdleTimer);
    });
    
    // Start initial 5-second timer when page loads
    startChatInitialTimer();
  }
}

// Clear chat functionality
const clearChatBtn = document.getElementById('clear-chat');
if (clearChatBtn && chatBox) {
  clearChatBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all chat messages?')) {
      chatBox.innerHTML = `
        <div class="chat-welcome">
          <div class="welcome-icon">💬</div>
          <h3>Welcome to Team Chat</h3>
          <p>Start a conversation with your team</p>
        </div>
      `;
    }
  });
}

// Helper function to get user initials
function getUserInitials(name) {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
}

// ========== Drag Chat Widget to Move ==========
let chatOffsetX, chatOffsetY, isChatDragging = false;
if (chatHeader && chatWidget) {
  chatHeader.addEventListener('mousedown', (e) => {
    isChatDragging = true;
    chatOffsetX = e.clientX - chatWidget.getBoundingClientRect().left;
    chatOffsetY = e.clientY - chatWidget.getBoundingClientRect().top;
    chatWidget.style.transition = 'none';
    resetChatIdleTimer(); // Reset timer when dragging
  });
}

document.addEventListener('mousemove', (e) => {
  if (!isChatDragging) return;
  if (chatWidget) {
    chatWidget.style.left = `${e.clientX - chatOffsetX}px`;
    chatWidget.style.top = `${e.clientY - chatOffsetY}px`;
    chatWidget.style.bottom = 'auto';
  }
});

document.addEventListener('mouseup', () => {
  isChatDragging = false;
  if (chatWidget) {
    chatWidget.style.transition = 'height 0.25s ease';
  }
});

// ========== Drag Chat Widget to Resize ==========
let isResizing = false, startX, startY, startWidth, startHeight;
if (resizeHandle && chatWidget) {
  resizeHandle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    isResizing = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = chatWidget.getBoundingClientRect();
    startWidth = rect.width;
    startHeight = rect.height;
  });
}

document.addEventListener('mousemove', (e) => {
  if (!isResizing) return;
  if (chatWidget) {
    const newWidth = Math.max(250, startWidth + (e.clientX - startX));
    const newHeight = Math.max(250, startHeight + (e.clientY - startY));
    chatWidget.style.width = `${newWidth}px`;
    chatWidget.style.height = `${newHeight}px`;
  }
});

document.addEventListener('mouseup', () => isResizing = false);

// ========== Drag Activity Widget to Resize ==========
let isResizingActivity = false, startXActivity, startYActivity, startWidthActivity, startHeightActivity;
const activityResizeHandle = document.getElementById('activity-resize-handle');

if (activityResizeHandle && activityWidget) {
  activityResizeHandle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent dragging widget while resizing
    isResizingActivity = true;
    startXActivity = e.clientX;
    startYActivity = e.clientY;
    const rect = activityWidget.getBoundingClientRect();
    startWidthActivity = rect.width;
    startHeightActivity = rect.height;
    console.log('🔧 Activity widget resize started');
  });
}

document.addEventListener('mousemove', (e) => {
  if (!isResizingActivity) return;
  if (activityWidget) {
    // Calculate new dimensions (minimum 280px width, 300px height)
    const newWidth = Math.max(280, startWidthActivity + (e.clientX - startXActivity));
    const newHeight = Math.max(300, startHeightActivity + (e.clientY - startYActivity));
    
    activityWidget.style.width = `${newWidth}px`;
    activityWidget.style.height = `${newHeight}px`;
    
    // Adjust body height to accommodate filters and footer
    const activityBody = document.getElementById('activity-body');
    if (activityBody) {
      // Calculate available height: total height - header - filters - footer
      const headerHeight = document.getElementById('activity-header')?.offsetHeight || 60;
      const filtersHeight = document.getElementById('activity-filters')?.offsetHeight || 120;
      const footerHeight = document.getElementById('activity-footer')?.offsetHeight || 40;
      const bodyHeight = newHeight - headerHeight - filtersHeight - footerHeight - 40; // 40px padding
      activityBody.style.height = `${Math.max(150, bodyHeight)}px`;
    }
  }
});

document.addEventListener('mouseup', () => {
  if (isResizingActivity) {
    isResizingActivity = false;
    console.log('✅ Activity widget resize completed');
  }
});

// ========== Chat Message Functions ==========
// Make deleteMessage globally accessible
window.deleteMessage = async function(messageId) {
  if (!confirm('Delete this message?')) return;
  
  try {
    const res = await fetch(`/chat/delete/${messageId}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (data.status === 'success') {
      await fetchMessages();
    } else {
      alert('Failed to delete message');
    }
  } catch (err) {
    console.error('Delete error:', err);
    alert('Failed to delete message');
  }
}

async function fetchMessages() {
  try {
    const res = await fetch('/chat/get');
    const data = await res.json();
    if (chatBox && data.status === 'success') {
      const msgs = data.messages.reverse();
      if (msgs.length === 0) {
        chatBox.innerHTML = `
          <div class="chat-welcome">
            <div class="welcome-icon">💬</div>
            <h3>Welcome to Team Chat</h3>
            <p>Start a conversation with your team</p>
          </div>
        `;
      } else {
        chatBox.innerHTML = '';
        msgs.forEach(m => {
          const initials = getUserInitials(m.name);
          const div = document.createElement('div');
          div.className = 'message';
          div.innerHTML = `
            <div class="message-avatar">${initials}</div>
            <div class="message-content">
              <div class="message-header">
                <strong>${m.name}</strong>
                <span class="time">${m.time}</span>
              </div>
              <div class="message-text">${m.message}</div>
            </div>
            <button class="message-delete" onclick="deleteMessage(${m.id})" title="Delete message">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          `;
          chatBox.appendChild(div);
        });
        if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
      }
      
      // Update online count
      const onlineCount = document.querySelector('.chat-online-count');
      if (onlineCount) {
        const uniqueUsers = new Set(msgs.map(m => m.name)).size;
        onlineCount.textContent = `● ${uniqueUsers > 0 ? uniqueUsers : 1} online`;
      }
      
      // Update minimized button badge
      if (chatMinimizedBtn) {
        const badge = chatMinimizedBtn.querySelector('.notification-badge');
        if (badge) {
          badge.textContent = msgs.length > 99 ? '99+' : msgs.length;
        }
      }
    }
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

if (messageForm && nameInput && messageInput) {
  messageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = nameInput.value.trim() || 'Unknown'; // Use "Unknown" if empty
    const message = messageInput.value.trim();
    if (!message) return; // Only check if message is empty

    try {
      await fetch('/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, message })
      });
      messageInput.value = '';
      await fetchMessages();
    } catch (err) {
      console.error('Send error:', err);
    }
  });
}

setInterval(fetchMessages, 3000);
fetchMessages();

console.log('✅ CHAT INIT: Chat widget fully initialized');




// ========== Graph Functionality ==========
let cy;


async function loadGraph() {
  console.log('📊 GRAPH: Loading graph data...');
  try {
    // Check if Cytoscape is loaded
    if (typeof cytoscape === 'undefined') {
      console.error('❌ GRAPH: Cytoscape.js not loaded');
      document.getElementById('cy').innerHTML = '<div style="padding: 20px; text-align: center; color: #e74c3c;">Cytoscape.js library not loaded. Please refresh the page.</div>';
      return;
    }

    console.log('✅ GRAPH: Cytoscape.js is loaded');

    // Check if container exists
    const container = document.getElementById('cy');
    if (!container) {
      console.error('❌ GRAPH: Container element #cy not found');
      return;
    }

    console.log('✅ GRAPH: Container element found');

    const res = await fetch('/api/graph');
    if (!res.ok) {
      console.error('❌ GRAPH: API request failed', res.status);
      container.innerHTML = '<div style="padding: 20px; text-align: center; color: #e74c3c;">Failed to load graph data. Please try again.</div>';
      return;
    }

    const elements = await res.json();
    console.log('📊 GRAPH: Received', elements.length, 'elements from API');

    if (!elements || elements.length === 0) {
      console.log('📊 GRAPH: No elements to display');
      container.innerHTML = '<div style="padding: 20px; text-align: center; color: #64748b;">No graph data available. Create some projects and tasks first.</div>';
      return;
    }

    if (!cy) {
      console.log('📊 GRAPH: Creating new Cytoscape instance');

      // Create new cytoscape instance
      cy = cytoscape({
        container: container,
        elements: elements,
        
        // Renderer settings for better quality
        renderer: {
          name: 'canvas',
          hideEdgesOnViewport: false,
          hideLabelsOnViewport: false,
          textureOnViewport: false,
          motionBlur: false,
          motionBlurOpacity: 0.2,
          wheelSensitivity: 0.1
        },
        
        style: [
          {
            selector: 'node[type="project"]',
            style: {
              'label': 'data(label)',
              'shape': 'ellipse',
              'background-color': '#3498db',
              'color': '#fff',
              'text-valign': 'center',
              'text-halign': 'center',
              'width': 120,
              'height': 60,
              'font-size': 12,
              'border-width': 2,
              'border-color': '#2980b9',
              'z-index': 10
            }
          },
          {
            selector: 'node[type="task"]',
            style: {
              'label': 'data(label)',
              'shape': 'round-rectangle',
              'background-color': function(ele) {
                // Use status-based colors since color field may not be available
                const status = ele.data('status');
                switch(status) {
                  case 'completed': return '#10b981';
                  case 'in_progress': return '#f59e0b';
                  case 'todo': return '#3b82f6';
                  case 'overdue': return '#ef4444';
                  default: return '#6b7280';
                }
              },
              'color': '#fff',
              'text-valign': 'center',
              'text-halign': 'center',
              'width': 140,
              'height': 50,
              'font-size': 11,
              'border-width': 2,
              'border-color': '#2c3e50',
              'z-index': 10
            }
          },
          {
            selector: 'edge',
            style: {
              'width': 4,
              'line-color': '#3498db',
              'target-arrow-shape': 'triangle',
              'target-arrow-color': '#3498db',
              'source-arrow-shape': 'none',
              'curve-style': 'bezier',
              'arrow-scale': 1.8,
              'opacity': 0.95,
              'z-index': 999,
              'overlay-opacity': 0,
              'line-cap': 'round'
            }
          },
          {
            selector: 'edge[type="belongs_to"]',
            style: {
              'line-color': '#28a745',
              'target-arrow-color': '#28a745',
              'width': 4,
              'opacity': 0.95,
              'z-index': 999
            }
          },
          {
            selector: 'edge[type="subtask"]',
            style: {
              'line-style': 'dashed',
              'line-dash-pattern': [10, 5],
              'line-color': '#6f42c1',
              'target-arrow-color': '#6f42c1',
              'width': 3,
              'opacity': 0.95,
              'z-index': 999
            }
          },
          {
            selector: 'edge[type="depends_on"]',
            style: {
              'line-color': '#dc3545',
              'target-arrow-color': '#dc3545',
              'width': 4,
              'target-arrow-shape': 'triangle',
              'source-arrow-shape': 'circle',
              'opacity': 0.95,
              'z-index': 999
            }
          },
          {
            selector: 'edge:selected',
            style: {
              'line-color': '#f39c12',
              'target-arrow-color': '#f39c12',
              'width': 5,
              'opacity': 1,
              'z-index': 1000
            }
          },
          {
            selector: 'node:selected',
            style: {
              'border-width': 4,
              'border-color': '#f39c12',
              'overlay-opacity': 0.2,
              'overlay-color': '#f39c12'
            }
          },
          {
            selector: 'node:active',
            style: {
              'overlay-opacity': 0.3,
              'overlay-color': '#3498db'
            }
          }
        ],
        layout: {
          name: 'breadthfirst',
          directed: true,
          padding: 80,
          spacingFactor: 1.5,
          avoidOverlap: true,
          maximal: true,
          grid: false,
          circle: false,
          tree: false
        }
      });

      console.log('✅ GRAPH: Cytoscape instance created successfully');
      console.log('📊 GRAPH: Nodes in instance:', cy.nodes().length);
      console.log('📊 GRAPH: Edges in instance:', cy.edges().length);
      
      // Log node types for debugging
      const projectNodes = cy.nodes('[type="project"]').length;
      const taskNodes = cy.nodes('[type="task"]').length;
      console.log(`📁 Project nodes: ${projectNodes}`);
      console.log(`✓ Task nodes: ${taskNodes}`);
      
      // Sample node IDs for debugging
      if (cy.nodes().length > 0) {
        const sampleNode = cy.nodes()[0];
        console.log(`🔍 Sample node ID: "${sampleNode.data('id')}", Type: "${sampleNode.data('type')}", Label: "${sampleNode.data('label')}"`);
      }
      
      // Multiple passes to force edge visibility
      const forceEdgeVisibility = () => {
        if (cy && cy.edges()) {
          cy.edges().forEach(edge => {
            edge.style({
              'opacity': 0.95,
              'z-index': 999,
              'display': 'element'
            });
          });
        }
      };
      
      // Force edges at multiple intervals
      setTimeout(() => {
        forceEdgeVisibility();
        cy.fit(50);
        console.log('🔄 GRAPH: Pass 1 - Edge visibility enforced');
      }, 100);
      
      setTimeout(() => {
        forceEdgeVisibility();
        cy.forceRender();
        console.log('🔄 GRAPH: Pass 2 - Forced render');
      }, 300);
      
      setTimeout(() => {
        forceEdgeVisibility();
        console.log('🔄 GRAPH: Pass 3 - Final edge check');
      }, 600);
      
      // Keep edges visible on any graph event
      cy.on('render', function() {
        cy.edges().forEach(edge => {
          if (edge.style('opacity') < 0.9) {
            edge.style('opacity', 0.95);
          }
        });
      });
      
      // ========== INTERACTIVE GRAPH FEATURES ==========
      
      console.log('🎮 Setting up interactive graph features...');
      
      // Enhanced hover effects with animation
      cy.on('mouseover', 'node', function(evt) {
        const node = evt.target;
        const nodeType = node.data('type');
        const nodeId = node.data('id');
        
        node.animate({
          style: {
            'border-width': 5,
            'border-color': '#f39c12',
            'box-shadow': '0 0 20px rgba(243, 156, 18, 0.6)',
            'z-index': 999
          },
          duration: 200
        });
        
        // Show visual tooltip
        const label = node.data('label');
        const type = nodeType === 'project' ? '📁 Project' : '✓ Task';
        console.log(`🎯 Hover: ${type} "${label}" (ID: ${nodeId}) - Click to edit!`);
        
        // Change cursor
        const cyContainer = document.getElementById('cy');
        if (cyContainer) cyContainer.style.cursor = 'pointer';
      });
      
      cy.on('mouseout', 'node', function(evt) {
        const node = evt.target;
        const nodeType = node.data('type');
        
        node.animate({
          style: {
            'border-width': 2,
            'border-color': nodeType === 'project' ? '#2980b9' : '#2c3e50',
            'box-shadow': 'none',
            'z-index': 10
          },
          duration: 200
        });
        
        // Reset cursor
        document.getElementById('cy').style.cursor = 'grab';
      });
      
      // Click to edit - Projects
      cy.on('tap', 'node[type="project"]', function(evt) {
        evt.preventDefault();
        const node = evt.target;
        const nodeId = node.data('id');
        const projectName = node.data('label');
        
        // Extract numeric ID from formats like "project-1" or "project_1"
        const projectId = nodeId.replace(/project[-_]/, '');
        
        console.log(`📁 CLICK DETECTED: Project "${projectName}" (Node ID: ${nodeId}, Extracted ID: ${projectId})`);
        
        // Visual feedback - pulse animation
        node.animate({
          style: {
            'border-color': '#3498db',
            'border-width': 8
          },
          duration: 200,
          complete: function() {
            node.style({
              'border-width': 2,
              'border-color': '#2980b9'
            });
          }
        });
        
        // Fetch and edit
        console.log(`🔍 Fetching project data from /api/projects/${projectId}...`);
        fetch(`/api/projects/${projectId}`)
          .then(res => {
            console.log(`📡 Response status: ${res.status}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch project`);
            return res.json();
          })
          .then(project => {
            console.log('✅ Project data loaded:', project);
            console.log('🔄 Switching to projects view...');
            showView('projects');
            setTimeout(() => {
              console.log('✏️ Calling editProject function...');
              if (typeof editProject === 'function') {
                editProject(
                  project.id,
                  project.name || '',
                  project.start_date || '',
                  project.end_date || '',
                  project.description || ''
                );
                console.log('✅ Edit form populated successfully');
              } else {
                console.error('❌ editProject function not found!');
                alert('Edit function not available. Please refresh the page.');
              }
            }, 300);
          })
          .catch(err => {
            console.error('❌ Error fetching project:', err);
            alert(`⚠️ Failed to load project details: ${err.message}`);
          });
      });
      
      // Click to edit - Tasks
      cy.on('tap', 'node[type="task"]', function(evt) {
        evt.preventDefault();
        const node = evt.target;
        const nodeId = node.data('id');
        const taskLabel = node.data('label');
        
        // Extract numeric ID from formats like "task-5" or "task_5"
        const taskId = nodeId.replace(/task[-_]/, '');
        
        console.log(`✓ CLICK DETECTED: Task "${taskLabel}" (Node ID: ${nodeId}, Extracted ID: ${taskId})`);
        
        // Visual feedback - pulse animation
        node.animate({
          style: {
            'border-color': '#3498db',
            'border-width': 8
          },
          duration: 200,
          complete: function() {
            node.style({
              'border-width': 2,
              'border-color': '#2c3e50'
            });
          }
        });
        
        // Navigate and edit
        console.log('🔄 Switching to tasks view...');
        showView('tasks');
        setTimeout(() => {
          console.log(`✏️ Calling editTask(${taskId})...`);
          if (typeof editTask === 'function') {
            editTask(parseInt(taskId));
            console.log('✅ Edit form should be loading...');
          } else {
            console.error('❌ editTask function not found!');
            alert('Edit function not available. Please refresh the page.');
          }
        }, 300);
      });
      
      // Double-click for quick edit (alternative interaction)
      cy.on('dbltap', 'node', function(evt) {
        const node = evt.target;
        console.log(`⚡ Double-click detected on: ${node.data('label')}`);
        // Trigger single click handler
        evt.target.trigger('tap');
      });
      
      // Visual feedback on edges hover
      cy.on('mouseover', 'edge', function(evt) {
        const edge = evt.target;
        edge.animate({
          style: {
            'width': 6,
            'line-color': '#f39c12',
            'target-arrow-color': '#f39c12',
            'opacity': 1
          },
          duration: 200
        });
      });
      
      cy.on('mouseout', 'edge', function(evt) {
        const edge = evt.target;
        const type = edge.data('type');
        let color = '#3498db';
        
        if (type === 'belongs_to') color = '#28a745';
        if (type === 'subtask') color = '#6f42c1';
        if (type === 'depends_on') color = '#dc3545';
        
        edge.animate({
          style: {
            'width': 4,
            'line-color': color,
            'target-arrow-color': color,
            'opacity': 0.95
          },
          duration: 200
        });
      });
      
      console.log('✅ All interactive event handlers registered successfully!');
      console.log('🎯 Click any node to edit (Projects or Tasks)');
      console.log('💡 TIP: Check console for detailed debugging info when clicking');
      
    } else {
      // Update existing instance
      cy.json({ elements: elements });
      cy.layout({
        name: 'breadthfirst',
        directed: true,
        padding: 80,
        spacingFactor: 1.5,
        avoidOverlap: true,
        maximal: true,
        animate: true,
        animationDuration: 500
      }).run();
      
      // Force edges to stay visible after update - multiple passes
      const forceEdgeVisibility = () => {
        if (cy && cy.edges()) {
          cy.edges().forEach(edge => {
            edge.style({
              'opacity': 0.95,
              'z-index': 999,
              'display': 'element'
            });
          });
        }
      };
      
      setTimeout(() => {
        forceEdgeVisibility();
        console.log('🔄 UPDATE: Pass 1 - Edge visibility enforced');
      }, 200);
      
      setTimeout(() => {
        forceEdgeVisibility();
        cy.forceRender();
        console.log('🔄 UPDATE: Pass 2 - Forced render');
      }, 600);
      
      setTimeout(() => {
        forceEdgeVisibility();
        console.log('🔄 UPDATE: Pass 3 - Final edge check');
      }, 1000);
      
      console.log('✅ GRAPH: Graph updated with new data');
    }

    // Debug: Log edge information
    if (cy && elements) {
      const edges = elements.filter(el => el.data.source && el.data.target);
      console.log(`📊 GRAPH DEBUG: ${edges.length} edges loaded`);
      if (edges.length > 0) {
        edges.forEach((edge, index) => {
          if (index < 3) { // Log first 3 edges
            console.log(`   Edge ${index}: ${edge.data.source} → ${edge.data.target} (${edge.data.type})`);
          }
        });
      }

      // Check if nodes exist for edges
      const nodes = elements.filter(el => !el.data.source);
      const nodeIds = nodes.map(n => n.data.id);
      const validEdges = edges.filter(edge =>
        nodeIds.includes(edge.data.source) && nodeIds.includes(edge.data.target)
      );
      console.log(`📊 GRAPH DEBUG: ${validEdges.length}/${edges.length} edges have valid source/target nodes`);

      if (edges.length !== validEdges.length) {
        console.warn('⚠️ GRAPH WARNING: Some edges reference non-existent nodes');
      }
    }

    // ========== ENHANCED GRAPH CONTROLS ==========
    
    // Update graph statistics
    function updateGraphStats() {
      if (!cy) return;
      
      const projectCount = cy.nodes('[type="project"]').length;
      const taskCount = cy.nodes('[type="task"]').length;
      const edgeCount = cy.edges().length;
      const zoomLevel = Math.round(cy.zoom() * 100);
      
      const projectCountEl = document.getElementById('projectCount');
      const taskCountEl = document.getElementById('taskCount');
      const edgeCountEl = document.getElementById('edgeCount');
      const zoomLevelEl = document.getElementById('zoomLevel');
      
      if (projectCountEl) projectCountEl.textContent = projectCount;
      if (taskCountEl) taskCountEl.textContent = taskCount;
      if (edgeCountEl) edgeCountEl.textContent = edgeCount;
      if (zoomLevelEl) zoomLevelEl.textContent = zoomLevel + '%';
      
      console.log(`📊 Stats: ${projectCount} projects, ${taskCount} tasks, ${edgeCount} edges, ${zoomLevel}% zoom`);
    }
    
    // Update stats on zoom and pan
    cy.on('zoom', updateGraphStats);
    cy.on('pan', updateGraphStats);
    
    // Initial stats update
    setTimeout(updateGraphStats, 500);
    
    // Set up layout selector with enhanced options
    const layoutSelect = document.getElementById('layoutSelect');
    if (layoutSelect) {
      layoutSelect.onchange = (e) => {
        const layoutName = e.target.value;
        let layoutConfig;

        switch (layoutName) {
          case 'breadthfirst':
            layoutConfig = {
              name: 'breadthfirst',
              directed: true,
              padding: 80,
              spacingFactor: 1.5,
              avoidOverlap: true,
              maximal: true,
              animate: true,
              animationDuration: 500
            };
            break;
          case 'cose':
            layoutConfig = {
              name: 'cose',
              animate: true,
              padding: 80,
              nodeOverlap: 20,
              idealEdgeLength: 100,
              nodeRepulsion: 400000,
              edgeElasticity: 100,
              gravity: 80,
              numIter: 1000,
              animationDuration: 500
            };
            break;
          case 'concentric':
            layoutConfig = {
              name: 'concentric',
              animate: true,
              padding: 80,
              startAngle: 3.14 / 2,
              sweep: undefined,
              clockwise: true,
              equidistant: false,
              minNodeSpacing: 50,
              concentric: function(node) {
                return node.data('type') === 'project' ? 2 : 1;
              },
              levelWidth: function() { return 2; },
              animationDuration: 500
            };
            break;
          case 'grid':
            layoutConfig = {
              name: 'grid',
              padding: 80,
              avoidOverlap: true,
              avoidOverlapPadding: 20,
              animate: true,
              animationDuration: 500
            };
            break;
          case 'circle':
            layoutConfig = {
              name: 'circle',
              padding: 80,
              avoidOverlap: true,
              animate: true,
              animationDuration: 500,
              radius: undefined,
              startAngle: 3.14 / 2,
              sweep: undefined,
              clockwise: true
            };
            break;
          case 'dagre':
            layoutConfig = {
              name: 'breadthfirst',
              directed: true,
              padding: 100,
              spacingFactor: 2,
              avoidOverlap: true,
              nodeDimensionsIncludeLabels: true,
              animate: true,
              animationDuration: 500
            };
            break;
          case 'cola':
            layoutConfig = {
              name: 'cose',
              animate: true,
              padding: 100,
              nodeOverlap: 30,
              idealEdgeLength: 150,
              nodeRepulsion: 500000,
              edgeElasticity: 50,
              gravity: 50,
              animationDuration: 500
            };
            break;
          default:
            layoutConfig = {
              name: 'breadthfirst',
              directed: true,
              padding: 80,
              spacingFactor: 1.5,
              animate: true,
              animationDuration: 500
            };
        }

        cy.layout(layoutConfig).run();
        console.log('🔄 GRAPH: Layout changed to', layoutName);
      };
    }

    // Zoom controls
    const zoomInBtn = document.getElementById('zoomIn');
    const zoomOutBtn = document.getElementById('zoomOut');
    const fitGraphBtn = document.getElementById('fitGraph');
    const resetViewBtn = document.getElementById('resetView');
    
    if (zoomInBtn) {
      zoomInBtn.onclick = () => {
        cy.zoom(cy.zoom() * 1.2);
        cy.center();
        console.log('🔍 Zoom In');
      };
    }
    
    if (zoomOutBtn) {
      zoomOutBtn.onclick = () => {
        cy.zoom(cy.zoom() * 0.8);
        cy.center();
        console.log('🔍 Zoom Out');
      };
    }
    
    if (fitGraphBtn) {
      fitGraphBtn.onclick = () => {
        cy.fit(50);
        console.log('🔍 Fit to Screen');
      };
    }
    
    if (resetViewBtn) {
      resetViewBtn.onclick = () => {
        cy.zoom(1);
        cy.center();
        console.log('🔍 Reset View');
      };
    }

    // Filter controls
    const showProjectsCheckbox = document.getElementById('showProjects');
    const showTasksCheckbox = document.getElementById('showTasks');
    const showEdgesCheckbox = document.getElementById('showEdges');
    
    function applyFilters() {
      if (!cy) return;
      
      const showProjects = showProjectsCheckbox ? showProjectsCheckbox.checked : true;
      const showTasks = showTasksCheckbox ? showTasksCheckbox.checked : true;
      const showEdges = showEdgesCheckbox ? showEdgesCheckbox.checked : true;
      
      // Show/hide projects
      if (showProjects) {
        cy.nodes('[type="project"]').style('display', 'element');
      } else {
        cy.nodes('[type="project"]').style('display', 'none');
      }
      
      // Show/hide tasks
      if (showTasks) {
        cy.nodes('[type="task"]').style('display', 'element');
      } else {
        cy.nodes('[type="task"]').style('display', 'none');
      }
      
      // Show/hide edges
      if (showEdges) {
        cy.edges().style('display', 'element');
      } else {
        cy.edges().style('display', 'none');
      }
      
      updateGraphStats();
      console.log('🎨 Filters applied:', { showProjects, showTasks, showEdges });
    }
    
    if (showProjectsCheckbox) showProjectsCheckbox.onchange = applyFilters;
    if (showTasksCheckbox) showTasksCheckbox.onchange = applyFilters;
    if (showEdgesCheckbox) showEdgesCheckbox.onchange = applyFilters;

    // Search and highlight functionality
    const searchInput = document.getElementById('searchGraph');
    const clearSearchBtn = document.getElementById('clearSearch');
    let highlightedNodes = null;
    
    function searchNodes(searchTerm) {
      if (!cy || !searchTerm) {
        clearSearch();
        return;
      }
      
      const term = searchTerm.toLowerCase();
      
      // Reset all nodes to normal
      cy.nodes().style({
        'opacity': 0.3,
        'border-width': 2
      });
      
      cy.edges().style('opacity', 0.2);
      
      // Find matching nodes
      highlightedNodes = cy.nodes().filter(function(node) {
        const label = node.data('label').toLowerCase();
        return label.includes(term);
      });
      
      // Highlight matching nodes
      highlightedNodes.style({
        'opacity': 1,
        'border-width': 4,
        'border-color': '#f39c12'
      });
      
      // Highlight connected edges
      highlightedNodes.connectedEdges().style('opacity', 1);
      
      console.log(`🔍 Search: Found ${highlightedNodes.length} matching nodes for "${searchTerm}"`);
      
      // Fit view to highlighted nodes if any found
      if (highlightedNodes.length > 0) {
        cy.fit(highlightedNodes, 100);
      }
    }
    
    function clearSearch() {
      if (!cy) return;
      
      cy.nodes().style({
        'opacity': 1,
        'border-width': 2
      });
      
      cy.edges().style('opacity', 0.95);
      
      highlightedNodes = null;
      
      if (searchInput) searchInput.value = '';
      
      console.log('🔍 Search cleared');
    }
    
    if (searchInput) {
      searchInput.oninput = (e) => {
        searchNodes(e.target.value);
      };
      
      searchInput.onkeydown = (e) => {
        if (e.key === 'Escape') {
          clearSearch();
        }
      };
    }
    
    if (clearSearchBtn) {
      clearSearchBtn.onclick = clearSearch;
    }

    // Export graph as PNG
    const exportBtn = document.getElementById('exportGraph');
    if (exportBtn) {
      exportBtn.onclick = () => {
        if (!cy) {
          alert('Graph not loaded');
          return;
        }
        
        try {
          // Get PNG data
          const png64 = cy.png({
            output: 'blob',
            bg: '#ffffff',
            full: true,
            scale: 2
          });
          
          // Create download link
          const url = URL.createObjectURL(png64);
          const link = document.createElement('a');
          link.href = url;
          link.download = `graph-${new Date().getTime()}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          
          console.log('📸 Graph exported as PNG');
          
          // Visual feedback
          exportBtn.innerHTML = `
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
            Exported!
          `;
          
          setTimeout(() => {
            exportBtn.innerHTML = `
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>
              Export PNG
            `;
          }, 2000);
          
        } catch (error) {
          console.error('❌ Export error:', error);
          alert('Failed to export graph. Please try again.');
        }
      };
    }

    // Set up refresh button
    const refreshBtn = document.getElementById('refreshGraph');
    if (refreshBtn) {
      refreshBtn.onclick = () => {
        loadGraph();
        console.log('🔄 GRAPH: Manual refresh triggered');
      };
    }

  } catch (err) {
    console.error('❌ GRAPH ERROR:', err);
    const container = document.getElementById('cy');
    if (container) {
      container.innerHTML = '<div style="padding: 20px; text-align: center; color: #e74c3c;">Error loading graph: ' + err.message + '</div>';
    }
  }
}

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



// ========== Enhanced Interactive Calendar Functionality ==========
let calendar;
let calendarTasks = [];
let calendarFilters = {
  todo: true,
  in_progress: true,
  done: true,
  overdue: true
};

// Update calendar stats
function updateCalendarStats(tasks) {
  const total = tasks.length;
  const completed = tasks.filter(t => t.status === 'done').length;
  const pending = tasks.filter(t => t.status === 'todo' || t.status === 'in_progress').length;
  const overdue = tasks.filter(t => t.status === 'overdue').length;
  
  const totalEl = document.getElementById('calTotalTasks');
  const completedEl = document.getElementById('calCompletedTasks');
  const pendingEl = document.getElementById('calPendingTasks');
  const overdueEl = document.getElementById('calOverdueTasks');
  
  if (totalEl) totalEl.textContent = total;
  if (completedEl) completedEl.textContent = completed;
  if (pendingEl) pendingEl.textContent = pending;
  if (overdueEl) overdueEl.textContent = overdue;
  
  console.log(`📊 Calendar Stats: ${total} total, ${completed} completed, ${pending} pending, ${overdue} overdue`);
}

async function loadCalendar() {
  console.log('📅 CALENDAR: Loading enhanced interactive calendar...');
  
  // Show loading overlay
  const loadingEl = document.getElementById('calendarLoading');
  if (loadingEl) loadingEl.style.display = 'flex';
  
  try {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) {
      console.error('❌ CALENDAR: Calendar element not found');
      return;
    }

    if (calendar) {
      calendar.refetchEvents();
      console.log('✅ CALENDAR: Calendar refreshed');
      if (loadingEl) loadingEl.style.display = 'none';
      return;
    }

    calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: 'dayGridMonth',
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,listWeek'
      },
      height: 'auto',
      aspectRatio: 1.5,
      editable: true, // Enable drag and drop
      droppable: true,
      eventDurationEditable: true,
      eventStartEditable: true,
      selectable: true, // Enable date selection
      selectMirror: true,
      
      // Date click - create new task
      dateClick: function(info) {
        console.log('📅 Date clicked:', info.dateStr);
        const createQuickTask = confirm(`Create a new task for ${info.dateStr}?`);
        if (createQuickTask) {
          showView('tasks');
          setTimeout(() => {
            document.getElementById('task-due').value = info.dateStr;
            document.getElementById('task-title').focus();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }, 300);
        }
      },
      
      // Fetch events with filtering
      events: async (info, successCallback, failureCallback) => {
        try {
          const from = info.startStr.split('T')[0];
          const to = info.endStr.split('T')[0];
          console.log(`📅 CALENDAR: Fetching tasks from ${from} to ${to}`);

          const res = await fetch(`/api/calendar/tasks?from=${from}&to=${to}`);
          const tasks = await res.json();
          
          calendarTasks = tasks; // Store for stats
          updateCalendarStats(tasks);

          if (res.ok) {
            // Apply filters
            const filteredTasks = tasks.filter(t => {
              if (!t.due_date) return false;
              return calendarFilters[t.status] !== false;
            });
            
            const events = filteredTasks.map(t => ({
              id: t.id,
              title: `${t.title}${t.assigned_to ? ` — ${t.assigned_to}` : ''}`,
              start: t.due_date,
              backgroundColor: getTaskColor(t.status),
              borderColor: getBorderColor(t.status),
              textColor: '#ffffff',
              extendedProps: {
                status: t.status,
                assigned_to: t.assigned_to,
                priority: t.priority,
                project_id: t.project_id
              }
            }));

            console.log(`📅 CALENDAR: Loaded ${events.length} events (filtered from ${tasks.length})`);
            successCallback(events);
          } else {
            console.error('❌ CALENDAR: Failed to fetch tasks');
            failureCallback(new Error('Failed to fetch tasks'));
          }
        } catch (err) {
          console.error('❌ CALENDAR: Error fetching tasks:', err);
          failureCallback(err);
        } finally {
          if (loadingEl) loadingEl.style.display = 'none';
        }
      },
      
      // Event click - show details with better UI
      eventClick: async (info) => {
        try {
          const res = await fetch(`/api/tasks/${info.event.id}`);
          const task = await res.json();

          if (res.ok) {
            const statusEmoji = {
              'todo': '📝',
              'in_progress': '🔄',
              'done': '✅',
              'overdue': '⚠️'
            };
            
            const priorityText = {
              1: '🔴 Urgent',
              2: '🟠 High',
              3: '🟡 Medium',
              4: '🔵 Low',
              5: '⚪ Minimal'
            };

            const details = 
              `📋 ${task.title}\n\n` +
              `Status: ${statusEmoji[task.status] || '❓'} ${task.status}\n` +
              `Priority: ${priorityText[task.priority] || 'N/A'}\n` +
              `Assigned to: ${task.assigned_to || 'Unassigned'}\n` +
              `Due: ${task.due_date || 'No due date'}\n` +
              `\nClick OK to edit this task.`;
            
            const shouldEdit = confirm(details);
            if (shouldEdit) {
              showView('tasks');
              setTimeout(() => {
                editTask(task.id);
              }, 300);
            }
          } else {
            alert('Error loading task details');
          }
        } catch (err) {
          console.error('Error loading task details:', err);
          alert('Error loading task details');
        }
      },
      
      // Enhanced hover tooltip
      eventMouseEnter: (info) => {
        const status = info.event.extendedProps.status;
        const assigned = info.event.extendedProps.assigned_to;
        const priority = info.event.extendedProps.priority;
        
        const priorityText = {
          1: '🔴 Urgent',
          2: '🟠 High',
          3: '🟡 Medium',
          4: '🔵 Low',
          5: '⚪ Minimal'
        };
        
        info.el.title = `Status: ${status}\nPriority: ${priorityText[priority] || 'N/A'}${assigned ? `\nAssigned: ${assigned}` : ''}\n\n✨ Click for details • Drag to reschedule`;
        info.el.style.cursor = 'move';
      },
      
      // Drag and drop - update task date
      eventDrop: async (info) => {
        const newDate = info.event.start.toISOString().split('T')[0];
        console.log(`🔄 Task ${info.event.id} moved to ${newDate}`);
        
        try {
          const res = await fetch(`/api/tasks/${info.event.id}`);
          const task = await res.json();
          
          if (res.ok) {
            const updateRes = await fetch(`/api/tasks/${info.event.id}`, {
              method: 'PUT',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({
                ...task,
                due_date: newDate
              })
            });
            
            if (updateRes.ok) {
              console.log('✅ Task date updated successfully');
              
              // Refresh activity widget immediately
              refreshActivityLog();
              
              // Show success feedback
              info.el.style.animation = 'pulse 0.5s ease-in-out';
              setTimeout(() => {
                info.el.style.animation = '';
              }, 500);
            } else {
              console.error('❌ Failed to update task');
              info.revert();
              alert('Failed to update task date. Please try again.');
            }
          }
        } catch (err) {
          console.error('❌ Error updating task:', err);
          info.revert();
          alert('Error updating task date');
        }
      },
      
      // Event resize (if enabled)
      eventResize: (info) => {
        console.log('Task duration changed:', info.event);
        // Could implement multi-day task support here
      }
    });

    calendar.render();
    console.log('✅ CALENDAR: Enhanced interactive calendar initialized');
    
    // Set up filter controls
    setupCalendarFilters();
    
    // Set up quick action buttons
    setupCalendarButtons();

  } catch (err) {
    console.error('❌ CALENDAR ERROR:', err);
    const calendarEl = document.getElementById('calendar');
    if (calendarEl) {
      calendarEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #e74c3c;">Error loading calendar. Please check if tasks have due dates.</div>';
    }
  } finally {
    if (loadingEl) loadingEl.style.display = 'none';
  }
}

// Helper functions for calendar
function getTaskColor(status) {
  const colors = {
    'todo': '#3b82f6',
    'in_progress': '#f59e0b', 
    'done': '#10b981',
    'overdue': '#ef4444'
  };
  return colors[status] || '#6b7280';
}

function getBorderColor(status) {
  const colors = {
    'todo': '#1e40af',
    'in_progress': '#d97706',
    'done': '#047857',
    'overdue': '#991b1b'
  };
  return colors[status] || '#374151';
}

// Set up calendar filter controls
function setupCalendarFilters() {
  const filters = ['Todo', 'InProgress', 'Done', 'Overdue'];
  
  filters.forEach(filter => {
    const checkbox = document.getElementById(`filter${filter}`);
    if (checkbox) {
      checkbox.addEventListener('change', (e) => {
        const statusKey = filter.toLowerCase().replace('inprogress', 'in_progress');
        calendarFilters[statusKey] = e.target.checked;
        console.log(`🎨 Filter ${filter} ${e.target.checked ? 'enabled' : 'disabled'}`);
        if (calendar) {
          calendar.refetchEvents();
        }
      });
    }
  });
}

// Set up calendar action buttons
function setupCalendarButtons() {
  const todayBtn = document.getElementById('todayBtn');
  const refreshBtn = document.getElementById('refreshCalendar');
  const addTaskBtn = document.getElementById('addCalendarTask');
  
  if (todayBtn) {
    todayBtn.addEventListener('click', () => {
      if (calendar) {
        calendar.today();
        console.log('📅 Jumped to today');
      }
    });
  }
  
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      if (calendar) {
        const loadingEl = document.getElementById('calendarLoading');
        if (loadingEl) loadingEl.style.display = 'flex';
        calendar.refetchEvents();
        setTimeout(() => {
          if (loadingEl) loadingEl.style.display = 'none';
        }, 500);
        console.log('🔄 Calendar refreshed');
      }
    });
  }
  
  if (addTaskBtn) {
    addTaskBtn.addEventListener('click', () => {
      showView('tasks');
      setTimeout(() => {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('task-due').value = today;
        document.getElementById('task-title').focus();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 300);
    });
  }
}

// ============================================
// AI SUGGESTIONS FUNCTIONALITY
// ============================================

let allAITasks = [];

// Load AI Suggestions view
async function loadAISuggestions() {
  try {
    const res = await fetch('/api/tasks');
    allAITasks = await res.json();
    
    // Normalize statuses
    allAITasks = allAITasks.map(t => {
      let normalized = (t.status || 'todo').toLowerCase();
      if (normalized === 'done') normalized = 'done';
      else if (normalized === 'in-progress') normalized = 'in_progress';
      return { ...t, status: normalized };
    });
    
    renderAITasks(allAITasks);
    setupAIFilters();
  } catch (error) {
    console.error('Error loading AI suggestions:', error);
    document.getElementById('taskListAI').innerHTML = '<p style="color: red;">Error loading tasks</p>';
  }
}

// Setup filter buttons
function setupAIFilters() {
  const filterButtons = document.querySelectorAll('.filter-btn');
  const refreshBtn = document.getElementById('refreshAIBtn');
  
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyAIFilter(btn.dataset.filter);
    });
  });
  
  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadAISuggestions);
  }
}

// Apply filter to tasks
function applyAIFilter(status) {
  let filtered = [];
  if (status === 'all') {
    filtered = allAITasks;
  } else {
    filtered = allAITasks.filter(t => t.status === status);
  }
  renderAITasks(filtered);
}

// Render tasks in AI view
function renderAITasks(tasks) {
  const taskList = document.getElementById('taskListAI');
  taskList.innerHTML = '';
  
  if (!tasks.length) {
    taskList.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">No tasks found.</p>';
    return;
  }
  
  tasks.forEach(task => {
    const taskBtn = document.createElement('button');
    taskBtn.className = 'task-btn-ai';
    taskBtn.style.cssText = 'display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 12px 15px; margin: 8px 0; background: #f0f4ff; border: none; border-radius: 8px; cursor: pointer; font-size: 1rem; text-align: left; transition: background 0.2s;';
    taskBtn.innerHTML = `
      <span>📋 ${task.title}</span>
      <span style="font-size:0.9rem; color:#555;">${task.status}</span>
    `;
    taskBtn.onmouseover = function() { this.style.background = '#dce3fc'; };
    taskBtn.onmouseout = function() { this.style.background = '#f0f4ff'; };
    taskBtn.onclick = () => showTaskAISuggestions(task.id);
    taskList.appendChild(taskBtn);
    
    const suggestionBox = document.createElement('div');
    suggestionBox.id = `suggestion-${task.id}`;
    suggestionBox.className = 'suggestion-box-ai';
    suggestionBox.style.cssText = 'background: #FFF8B0; border-left: 6px solid #c5b002; border-radius: 10px; padding: 15px; margin-top: 10px; white-space: pre-wrap; display: none; color: #3a3000; font-size: 0.95rem;';
    taskList.appendChild(suggestionBox);
  });
}

// Show AI suggestions for a specific task
async function showTaskAISuggestions(taskId) {
  const box = document.getElementById(`suggestion-${taskId}`);
  
  // Toggle open/close
  if (box.style.display === 'block') {
    box.style.display = 'none';
    return;
  }
  
  box.style.display = 'block';
  box.innerHTML = `
    <div style="text-align: center; padding: 20px;">
      <div class="ai-loading-spinner"></div>
      <p style="font-style: italic; color: #555; margin-top: 10px;">🤖 AI analyzing your task...</p>
    </div>
  `;
  
  try {
    const res = await fetch(`/api/ai/suggestions/${taskId}`);
    const data = await res.json();
    
    // Handle errors
    if (data.error) {
      box.innerHTML = `
        <div class="ai-error">
          <strong>⚠️ ${data.error}</strong>
          <p style="margin-top: 10px;">${data.suggestions || 'Please try again later.'}</p>
        </div>
      `;
      return;
    }
    
    // Get urgency badge color
    const urgencyColors = {
      '🔴 OVERDUE': '#ff4444',
      '⚠️ DUE SOON': '#ff9800',
      '⚠️ URGENT': '#ff5722',
      'Standard': '#4CAF50'
    };
    const urgencyColor = urgencyColors[data.urgency] || '#4CAF50';
    
    // Format timestamp
    const timestamp = data.generated_at ? new Date(data.generated_at).toLocaleString() : '';
    
    // Build enhanced display
    box.innerHTML = `
      <div class="ai-suggestion-header">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <div>
            <span class="ai-badge" style="background: ${urgencyColor};">${data.urgency || data.status}</span>
            <span style="font-size: 0.85em; color: #666; margin-left: 10px;">✨ AI Generated</span>
          </div>
          ${timestamp ? `<span style="font-size: 0.75em; color: #999;">${timestamp}</span>` : ''}
        </div>
      </div>
      
      <div class="ai-suggestion-content">
        <strong style="color: #2c3e50; font-size: 1.1em;">🧠 Strategic Insights:</strong>
        <div style="margin-top: 15px; line-height: 1.8;">
          ${formatAISuggestions(data.suggestions)}
        </div>
      </div>
      
      <div class="ai-suggestion-footer">
        <small style="color: #999;">💡 These suggestions are AI-generated. Use your judgment for implementation.</small>
      </div>
    `;
  } catch (err) {
    box.innerHTML = `
      <div class="ai-error">
        <strong>❌ Connection Error</strong>
        <p style="margin-top: 10px;">${err.message}</p>
        <button onclick="showTaskAISuggestions(${taskId})" style="margin-top: 10px; padding: 8px 16px; background: #4b6cb7; color: white; border: none; border-radius: 6px; cursor: pointer;">
          🔄 Try Again
        </button>
      </div>
    `;
  }
}

// Format AI suggestions with better styling
function formatAISuggestions(text) {
  if (!text) return '<p style="color: #999;">No suggestions available.</p>';
  
  // Convert markdown-style formatting
  let formatted = text
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color: #2c3e50;">$1</strong>') // Bold
    .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
    .replace(/^(\d+\.\s)/gm, '<br><strong style="color: #4b6cb7;">$1</strong>') // Numbered lists
    .replace(/^[-•]\s/gm, '<br>• ') // Bullet points
    .replace(/\n\n/g, '<br><br>') // Paragraphs
    .replace(/\n/g, '<br>'); // Line breaks
  
  return formatted;
}

// ========== Edit Project Function ==========
window.editProject = async function(projectId, name, startDate, endDate, description) {
  // Scroll to form
  document.getElementById('projects-view').scrollIntoView({ behavior: 'smooth' });
  
  // Populate form fields
  document.getElementById('project-name').value = name || '';
  document.getElementById('project-start').value = startDate || '';
  document.getElementById('project-end').value = endDate || '';
  document.getElementById('project-desc').value = description || '';
  
  // Change form title and button
  const formTitle = document.querySelector('#projects-view .card-title');
  const formButton = document.querySelector('#create-project-form button[type="submit"]');
  
  if (formTitle) formTitle.textContent = '✏️ Edit Project';
  if (formButton) {
    formButton.innerHTML = `
      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
      </svg>
      Update Project
    `;
  }
  
  // Store project ID for update
  document.getElementById('create-project-form').dataset.editId = projectId;
}

// ========== Edit Task Function ==========
window.editTask = async function(taskId) {
  try {
    // Fetch task details
    const res = await fetch(`/api/tasks/${taskId}`);
    const task = await res.json();
    
    // Scroll to form
    document.getElementById('tasks-view').scrollIntoView({ behavior: 'smooth' });
    
    // Populate form fields
    document.getElementById('task-project-select').value = task.project_id || '';
    document.getElementById('task-title').value = task.title || '';
    document.getElementById('task-assigned').value = task.assigned_to || '';
    document.getElementById('task-due').value = task.due_date || '';
    document.getElementById('task-priority').value = task.priority || 3;
    document.getElementById('task-parent-select').value = task.parent_task_id || '';
    document.getElementById('task-depends-select').value = task.depends_on_task_id || '';
    
    // Update priority slider display
    updatePriorityDisplay(task.priority || 3);
    
    // Change form title and button
    const formTitle = document.querySelector('#tasks-view .card-title');
    const formButton = document.querySelector('#create-task-form button[type="submit"]');
    
    if (formTitle) formTitle.textContent = '✏️ Edit Task';
    if (formButton) {
      formButton.innerHTML = `
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
        </svg>
        Update Task
      `;
    }
    
    // Store task ID for update
    document.getElementById('create-task-form').dataset.editId = taskId;
  } catch (error) {
    console.error('Error fetching task:', error);
    alert('Failed to load task details');
  }
}

// ============================================
// EXPORT DATA FUNCTIONALITY
// ============================================

const exportModal = document.getElementById('export-modal');
const exportDataBtn = document.getElementById('export-data-btn');
const closeExportModal = document.getElementById('close-export-modal');
const cancelExportBtn = document.getElementById('cancel-export');
const confirmExportBtn = document.getElementById('confirm-export');

// Open export modal
if (exportDataBtn) {
  exportDataBtn.addEventListener('click', () => {
    exportModal.style.display = 'flex';
    console.log('📥 Export modal opened');
  });
}

// Close export modal
function closeExportModalFunc() {
  exportModal.style.display = 'none';
}

if (closeExportModal) closeExportModal.addEventListener('click', closeExportModalFunc);
if (cancelExportBtn) cancelExportBtn.addEventListener('click', closeExportModalFunc);

// Close modal on outside click
if (exportModal) {
  exportModal.addEventListener('click', (e) => {
    if (e.target === exportModal) {
      closeExportModalFunc();
    }
  });
}

// Confirm export button
if (confirmExportBtn) {
  confirmExportBtn.addEventListener('click', async () => {
    try {
      console.log('📥 Starting data export...');
      
      // Get selected data types
      const includeProjects = document.getElementById('export-projects').checked;
      const includeTasks = document.getElementById('export-tasks').checked;
      const includeAttachments = document.getElementById('export-attachments').checked;
      const includeActivity = document.getElementById('export-activity').checked;
      const includeChat = document.getElementById('export-chat').checked;
      
      // Get selected format
      const format = document.querySelector('input[name="export-format"]:checked').value;
      
      // Validate selection
      if (!includeProjects && !includeTasks && !includeAttachments && !includeActivity && !includeChat) {
        alert('⚠️ Please select at least one data type to export');
        return;
      }
      
      // Show loading state
      confirmExportBtn.disabled = true;
      confirmExportBtn.innerHTML = `
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="animation: spin 1s linear infinite;">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
        Exporting...
      `;
      
      // Fetch data
      const exportData = {};
      
      if (includeProjects) {
        const res = await fetch('/api/projects');
        exportData.projects = await res.json();
        console.log(`✅ Fetched ${exportData.projects.length} projects`);
      }
      
      if (includeTasks) {
        const res = await fetch('/api/tasks');
        exportData.tasks = await res.json();
        console.log(`✅ Fetched ${exportData.tasks.length} tasks`);
      }
      
      if (includeAttachments) {
        const res = await fetch('/api/attachments');
        exportData.attachments = await res.json();
        console.log(`✅ Fetched ${exportData.attachments.length} attachments`);
      }
      
      if (includeActivity) {
        const res = await fetch('/api/activity');
        exportData.activity_logs = await res.json();
        console.log(`✅ Fetched ${exportData.activity_logs.length} activity logs`);
      }
      
      if (includeChat) {
        const res = await fetch('/chat/get');
        const chatData = await res.json();
        exportData.chat_messages = chatData.messages || [];
        console.log(`✅ Fetched ${exportData.chat_messages.length} chat messages`);
      }
      
      // Add metadata
      exportData.export_metadata = {
        export_date: new Date().toISOString(),
        format: format,
        included_data: {
          projects: includeProjects,
          tasks: includeTasks,
          attachments: includeAttachments,
          activity_logs: includeActivity,
          chat_messages: includeChat
        }
      };
      
      // Convert and download
      if (format === 'json') {
        downloadJSON(exportData);
      } else if (format === 'csv') {
        downloadCSV(exportData);
      }
      
      // Reset button
      confirmExportBtn.disabled = false;
      confirmExportBtn.innerHTML = `
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
        </svg>
        Export Data
      `;
      
      // Close modal
      closeExportModalFunc();
      
      // Show success message
      alert('✅ Data exported successfully!');
      
    } catch (error) {
      console.error('❌ Export error:', error);
      alert('❌ Failed to export data. Please try again.');
      
      // Reset button
      confirmExportBtn.disabled = false;
      confirmExportBtn.innerHTML = `
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
        </svg>
        Export Data
      `;
    }
  });
}

// Download as JSON
function downloadJSON(data) {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ps16_export_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  console.log('📥 JSON file downloaded');
}

// Download as CSV
function downloadCSV(data) {
  let csvContent = '';
  
  // Export projects
  if (data.projects && data.projects.length > 0) {
    csvContent += '=== PROJECTS ===\n';
    csvContent += 'ID,Name,Description,Start Date,End Date,Status,Created At\n';
    data.projects.forEach(p => {
      csvContent += `${p.id},"${(p.name || '').replace(/"/g, '""')}","${(p.description || '').replace(/"/g, '""')}",${p.start_date || ''},${p.end_date || ''},${p.status || ''},${p.created_at || ''}\n`;
    });
    csvContent += '\n';
  }
  
  // Export tasks
  if (data.tasks && data.tasks.length > 0) {
    csvContent += '=== TASKS ===\n';
    csvContent += 'ID,Project ID,Title,Description,Assigned To,Status,Priority,Due Date,Created At\n';
    data.tasks.forEach(t => {
      csvContent += `${t.id},${t.project_id || ''},"${(t.title || '').replace(/"/g, '""')}","${(t.description || '').replace(/"/g, '""')}",${t.assigned_to || ''},${t.status || ''},${t.priority || ''},${t.due_date || ''},${t.created_at || ''}\n`;
    });
    csvContent += '\n';
  }
  
  // Export attachments
  if (data.attachments && data.attachments.length > 0) {
    csvContent += '=== ATTACHMENTS ===\n';
    csvContent += 'ID,Task ID,Filename,Uploaded By,Uploaded At\n';
    data.attachments.forEach(a => {
      csvContent += `${a.id},${a.task_id || ''},"${(a.filename || '').replace(/"/g, '""')}",${a.uploaded_by || ''},${a.uploaded_at || ''}\n`;
    });
    csvContent += '\n';
  }
  
  // Export activity logs
  if (data.activity_logs && data.activity_logs.length > 0) {
    csvContent += '=== ACTIVITY LOGS ===\n';
    csvContent += 'ID,Action Type,Object Type,Object ID,Timestamp\n';
    data.activity_logs.forEach(a => {
      csvContent += `${a.id},${a.action_type || ''},${a.object_type || ''},${a.object_id || ''},${a.timestamp || ''}\n`;
    });
    csvContent += '\n';
  }
  
  // Export chat messages
  if (data.chat_messages && data.chat_messages.length > 0) {
    csvContent += '=== CHAT MESSAGES ===\n';
    csvContent += 'ID,Name,Message,Time\n';
    data.chat_messages.forEach(c => {
      csvContent += `${c.id},"${(c.name || '').replace(/"/g, '""')}","${(c.message || '').replace(/"/g, '""')}",${c.time || ''}\n`;
    });
  }
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ps16_export_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  console.log('📥 CSV file downloaded');
}

console.log('✅ Export functionality initialized');

// ============================================
// ALERTS FUNCTIONALITY
// ============================================

async function loadAlerts() {
  console.log('🔔 Loading alerts...');
  const alertsList = document.getElementById('alerts-list');
  
  if (!alertsList) return;
  
  try {
    // Fetch tasks and projects to generate alerts
    const tasksRes = await fetch('/api/tasks');
    const tasks = await tasksRes.json();
    
    const projectsRes = await fetch('/api/projects');
    const projects = await projectsRes.json();
    
    // Generate alerts
    const alerts = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Check for overdue tasks
    tasks.forEach(task => {
      if (task.due_date && task.status !== 'done') {
        const dueDate = new Date(task.due_date);
        const diffTime = dueDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) {
          alerts.push({
            type: 'error',
            icon: '🔴',
            title: 'Overdue Task',
            message: `"${task.title}" is ${Math.abs(diffDays)} day(s) overdue`,
            time: task.due_date,
            priority: 'high'
          });
        } else if (diffDays <= 3) {
          alerts.push({
            type: 'warning',
            icon: '⚠️',
            title: 'Task Due Soon',
            message: `"${task.title}" is due in ${diffDays} day(s)`,
            time: task.due_date,
            priority: 'medium'
          });
        }
      }
    });
    
    // Check for high priority tasks
    tasks.forEach(task => {
      if (task.priority === 1 && task.status !== 'done') {
        alerts.push({
          type: 'info',
          icon: '🔥',
          title: 'Urgent Priority Task',
          message: `"${task.title}" requires immediate attention`,
          time: new Date().toISOString(),
          priority: 'high'
        });
      }
    });
    
    // Sort alerts by priority and time
    alerts.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
    
    // Render alerts
    if (alerts.length === 0) {
      alertsList.innerHTML = `
        <div class="empty-state">
          <svg width="64" height="64" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin: 0 auto 16px; opacity: 0.3;">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
          </svg>
          <p>No alerts at the moment</p>
          <small style="color: #999;">You'll be notified about important updates here</small>
        </div>
      `;
    } else {
      alertsList.innerHTML = alerts.map(alert => `
        <div class="alert-item alert-${alert.type}">
          <div class="alert-icon">${alert.icon}</div>
          <div class="alert-content">
            <div class="alert-title">${alert.title}</div>
            <div class="alert-message">${alert.message}</div>
            <div class="alert-time">${formatAlertTime(alert.time)}</div>
          </div>
          <button class="alert-dismiss" onclick="dismissAlert(this)" title="Dismiss">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      `).join('');
    }
    
    console.log(`✅ Loaded ${alerts.length} alerts`);
    
  } catch (error) {
    console.error('❌ Error loading alerts:', error);
    alertsList.innerHTML = `
      <div class="empty-state">
        <p style="color: #ef4444;">Failed to load alerts</p>
        <small style="color: #999;">${error.message}</small>
      </div>
    `;
  }
}

function formatAlertTime(timeStr) {
  const date = new Date(timeStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// Global function to dismiss alert
window.dismissAlert = function(button) {
  const alertItem = button.closest('.alert-item');
  if (alertItem) {
    alertItem.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => alertItem.remove(), 300);
  }
};

// Clear all alerts
const clearAllAlertsBtn = document.getElementById('clear-all-alerts');
if (clearAllAlertsBtn) {
  clearAllAlertsBtn.addEventListener('click', () => {
    const alertsList = document.getElementById('alerts-list');
    if (alertsList) {
      alertsList.innerHTML = `
        <div class="empty-state">
          <svg width="64" height="64" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin: 0 auto 16px; opacity: 0.3;">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
          </svg>
          <p>No alerts at the moment</p>
          <small style="color: #999;">You'll be notified about important updates here</small>
        </div>
      `;
    }
  });
}

// Mark all as read
const markAllReadBtn = document.getElementById('mark-all-read');
if (markAllReadBtn) {
  markAllReadBtn.addEventListener('click', () => {
    document.querySelectorAll('.alert-item').forEach(item => {
      item.style.opacity = '0.6';
    });
  });
}

console.log('✅ Alerts functionality initialized');
