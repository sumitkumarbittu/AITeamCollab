// Simple navigation for PS16 Collaborative Workspace
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 PS16 Workspace loaded');

  // Set up navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const view = item.dataset.view;

      // Update active state
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      // Update header
      document.getElementById('view-title').textContent = view.charAt(0).toUpperCase() + view.slice(1);
      document.getElementById('view-subtitle').textContent = getViewSubtitle(view);

      // Show/hide views
      document.querySelectorAll('.view-section').forEach(sec => sec.style.display = 'none');
      document.getElementById(`${view}-view`).style.display = 'block';

      // Load data for the view
      loadViewData(view);
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
    attachments: 'Upload and manage project files'
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
      // Refresh activity widget immediately (if available)
      if (typeof window !== 'undefined' && window.refreshActivityWidget) {
        window.refreshActivityWidget();
      }
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
      // Refresh activity widget immediately (if available)
      if (typeof window !== 'undefined' && window.refreshActivityWidget) {
        window.refreshActivityWidget();
      }
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
    // Refresh activity widget immediately (if available)
    if (typeof window !== 'undefined' && window.refreshActivityWidget) {
      window.refreshActivityWidget();
    }
  } catch (error) {
    console.error('Error deleting project:', error);
  }
}

async function deleteTask(id) {
  if (!confirm('Delete this task?')) return;
  try {
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    loadTasks();
    // Refresh activity widget immediately (if available)
    if (typeof window !== 'undefined' && window.refreshActivityWidget) {
      window.refreshActivityWidget();
    }
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
      // Refresh activity widget immediately (if available)
      if (typeof window !== 'undefined' && window.refreshActivityWidget) {
        window.refreshActivityWidget();
      }
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
    // Refresh activity widget immediately (if available)
    if (typeof window !== 'undefined' && window.refreshActivityWidget) {
      window.refreshActivityWidget();
    }
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
  }, 5000); // 5 seconds on load
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

async function loadActivityWidget() {
  console.log('🔍 WIDGET: Loading activity logs...');
  try {
    const res = await fetch('/api/activity');
    const data = await res.json();
    console.log('📊 WIDGET: Received', data.length, 'activities from API');

    if (activityContent) {
      activityContent.innerHTML = '';

      if (data.length === 0) {
        activityContent.innerHTML = `
          <div class="activity-loading">
            <p style="color: #999;">No activity yet</p>
            <small style="color: #ccc;">Activity will appear here as you work</small>
          </div>
        `;
        // Update footer count
        const countEl = document.querySelector('.activity-count');
        if (countEl) countEl.textContent = '0 activities';
        return;
      }

      // Get recent activities (last 15)
      const recentActivities = data.slice(-15).reverse();
      
      console.log('📋 WIDGET: Displaying activities:', recentActivities.map(a => `${a.action_type} on ${a.object_type}`));
      
      recentActivities.forEach(log => {
        const actionDetails = getActionDetails(log.action_type);
        const objectDetails = formatObjectType(log.object_type);
        const relativeTime = getRelativeTime(log.timestamp);
        
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
                <span>#${log.object_id}</span>
              </div>
            </div>
            <div class="activity-timestamp">${relativeTime}</div>
          </div>
        `;
        activityContent.appendChild(div);
      });

      // Update footer count
      const countEl = document.querySelector('.activity-count');
      if (countEl) {
        countEl.textContent = `${data.length} ${data.length === 1 ? 'activity' : 'activities'}`;
      }

      // Update minimized button badge
      if (activityMinimizedBtn) {
        const badge = activityMinimizedBtn.querySelector('.notification-badge');
        if (badge) {
          badge.textContent = data.length > 99 ? '99+' : data.length;
        }
      }

      console.log('✅ WIDGET: Activity widget updated successfully');
    }
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
} else {
  console.error('❌ WIDGET INIT: Activity widget elements missing');
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
  }, 5000); // 5 seconds on load
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
      
      // Add interactive hover effects
      cy.on('mouseover', 'node', function(evt) {
        const node = evt.target;
        node.style({
          'border-width': 4,
          'border-color': '#f39c12',
          'cursor': 'pointer'
        });
      });
      
      cy.on('mouseout', 'node', function(evt) {
        const node = evt.target;
        const nodeType = node.data('type');
        node.style({
          'border-width': 2,
          'border-color': nodeType === 'project' ? '#2980b9' : '#2c3e50'
        });
      });
      
      // Add click handlers for editing
      cy.on('tap', 'node[type="project"]', function(evt) {
        const node = evt.target;
        const projectId = node.data('id').replace('project-', '');
        const projectName = node.data('label');
        
        // Fetch full project details and edit
        fetch(`/api/projects/${projectId}`)
          .then(res => res.json())
          .then(project => {
            showView('projects');
            setTimeout(() => {
              editProject(
                project.id,
                project.name || '',
                project.start_date || '',
                project.end_date || '',
                project.description || ''
              );
            }, 300);
          })
          .catch(err => {
            console.error('Error fetching project:', err);
            alert('Failed to load project details');
          });
      });
      
      cy.on('tap', 'node[type="task"]', function(evt) {
        const node = evt.target;
        const taskId = node.data('id').replace('task-', '');
        
        showView('tasks');
        setTimeout(() => {
          editTask(parseInt(taskId));
        }, 300);
      });
      
      // Add tooltip on hover
      cy.on('mouseover', 'node', function(evt) {
        const node = evt.target;
        const type = node.data('type');
        const status = node.data('status');
        
        let tooltipText = `${type === 'project' ? '📁 Project' : '✓ Task'}: ${node.data('label')}`;
        if (status) {
          tooltipText += `\nStatus: ${status}`;
        }
        tooltipText += '\n\nClick to edit';
        
        node.data('tooltip', tooltipText);
      });
      
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

    // Set up layout selector
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
              animate: true
            };
            break;
          case 'cose':
            layoutConfig = {
              name: 'cose',
              animate: true,
              padding: 80,
              nodeOverlap: 20,
              idealEdgeLength: 100
            };
            break;
          case 'grid':
            layoutConfig = {
              name: 'grid',
              padding: 80,
              avoidOverlap: true,
              animate: true
            };
            break;
          case 'circle':
            layoutConfig = {
              name: 'circle',
              padding: 80,
              avoidOverlap: true,
              animate: true
            };
            break;
          default:
            layoutConfig = {
              name: 'breadthfirst',
              directed: true,
              padding: 80,
              spacingFactor: 1.5,
              animate: true
            };
        }

        cy.layout(layoutConfig).run();
        console.log('🔄 GRAPH: Layout changed to', layoutName);
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



// ========== Calendar Functionality ==========
let calendar;
async function loadCalendar() {
  console.log('📅 CALENDAR: Loading calendar...');
  try {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) {
      console.error('❌ CALENDAR: Calendar element not found');
      return;
    }

    if (calendar) {
      calendar.render();
      console.log('✅ CALENDAR: Calendar re-rendered');
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
      events: async (info, successCallback, failureCallback) => {
        try {
          const from = info.startStr.split('T')[0];
          const to = info.endStr.split('T')[0];
          console.log(`📅 CALENDAR: Fetching tasks from ${from} to ${to}`);

          const res = await fetch(`/api/calendar/tasks?from=${from}&to=${to}`);
          const tasks = await res.json();

          if (res.ok) {
            const events = tasks.filter(t => t.due_date).map(t => ({
              id: t.id,
              title: `${t.title}${t.assigned_to ? ` — ${t.assigned_to}` : ''}`,
              start: t.due_date,
              backgroundColor: t.status === 'done' ? '#9AE19D' :
                              t.status === 'overdue' ? '#E57373' :
                              t.status === 'in_progress' ? '#FFD700' : '#AEDFF7',
              borderColor: t.status === 'overdue' ? '#C62828' : '#424242',
              extendedProps: {
                status: t.status,
                assigned_to: t.assigned_to
              }
            }));

            console.log(`📅 CALENDAR: Loaded ${events.length} events`);
            successCallback(events);
          } else {
            console.error('❌ CALENDAR: Failed to fetch tasks');
            failureCallback(new Error('Failed to fetch tasks'));
          }
        } catch (err) {
          console.error('❌ CALENDAR: Error fetching tasks:', err);
          failureCallback(err);
        }
      },
      eventClick: async (info) => {
        try {
          const res = await fetch(`/api/calendar/tasks/${info.event.id}`);
          const task = await res.json();

          if (res.ok) {
            const statusEmoji = {
              'todo': '📝',
              'in_progress': '🔄',
              'done': '✅',
              'overdue': '⚠️'
            };

            alert(`📋 ${task.title}\n` +
                  `Assigned to: ${task.assigned_to || 'Unassigned'}\n` +
                  `Status: ${statusEmoji[task.status] || '❓'} ${task.status}\n` +
                  `Priority: ${task.priority || 'N/A'}\n` +
                  `Due: ${task.due_date || 'No due date'}\n` +
                  `${task.description ? `Description: ${task.description}` : ''}`);
          } else {
            alert('Error loading task details');
          }
        } catch (err) {
          console.error('Error loading task details:', err);
          alert('Error loading task details');
        }
      },
      eventMouseEnter: (info) => {
        // Show tooltip on hover
        const status = info.event.extendedProps.status;
        const assigned = info.event.extendedProps.assigned_to;
        info.el.title = `Status: ${status}${assigned ? ` | Assigned: ${assigned}` : ''}`;
      }
    });

    calendar.render();
    console.log('✅ CALENDAR: Calendar initialized and rendered');

  } catch (err) {
    console.error('❌ CALENDAR ERROR:', err);
    const calendarEl = document.getElementById('calendar');
    if (calendarEl) {
      calendarEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #e74c3c;">Error loading calendar. Please check if tasks have due dates.</div>';
    }
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
