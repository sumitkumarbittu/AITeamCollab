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
    const url = editId ? `${API_BASE_URL}/api/projects/${editId}` : API_BASE_URL + '/api/projects';
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
      const formTitle = document.querySelector('.create-content[data-content="project"] .card-title');
      const formButton = form.querySelector('button[type="submit"]');
      if (formTitle) formTitle.textContent = '📁 Create New Project';
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
      alert(editId ? '✅ Project updated successfully!' : '✅ Project created successfully!');
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
    const url = editId ? `${API_BASE_URL}/api/tasks/${editId}` : API_BASE_URL + '/api/tasks';
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
      const formTitle = document.querySelector('.create-content[data-content="task"] .card-title');
      const formButton = form.querySelector('button[type="submit"]');
      if (formTitle) formTitle.textContent = '✓ Create New Task';
      if (formButton) {
        formButton.innerHTML = `
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          Create Task
        `;
      }
      
      // Reset priority display
      updatePriorityDisplay(3);
      
      loadTasks();
      // Refresh activity widget immediately
      refreshActivityLog();
      alert(editId ? '✅ Task updated successfully!' : '✅ Task created successfully!');
    } else {
      alert(editId ? 'Failed to update task' : 'Failed to create task');
    }
  } catch (error) {
    console.error('Error saving task:', error);
    alert('Failed to save task');
  }
});

// Load projects for selector dropdown
async function loadProjectsForSelector() {
  try {
    const res = await fetch(API_BASE_URL + '/api/projects');
    const projects = await res.json();
    
    const projectSelector = document.getElementById('project-selector');
    if (projectSelector) {
      // Keep the "Create New" option and add all projects
      let options = '<option value="">➕ Create New Project</option>';
      projects.forEach(p => {
        options += `<option value="${p.id}">${p.name}</option>`;
      });
      projectSelector.innerHTML = options;
    }
  } catch (error) {
    console.error('Error loading projects for selector:', error);
  }
}

// Load tasks for selector dropdown
async function loadTasksForSelector() {
  try {
    const res = await fetch(API_BASE_URL + '/api/tasks');
    const tasks = await res.json();
    
    const taskSelector = document.getElementById('task-selector');
    if (taskSelector) {
      let options = '<option value="">➕ Create New Task</option>';
      tasks.forEach(t => {
        const statusBadge = t.status === 'done' ? '✅' : t.status === 'in_progress' ? '🔄' : '📝';
        options += `<option value="${t.id}">${statusBadge} ${t.title}</option>`;
      });
      taskSelector.innerHTML = options;
    }
  } catch (error) {
    console.error('Error loading tasks for selector:', error);
  }
}

// Load events for selector dropdown
async function loadEventsForSelector() {
  try {
    const res = await fetch(API_BASE_URL + '/api/events');
    const events = await res.json();
    
    const eventSelector = document.getElementById('event-selector');
    if (eventSelector) {
      let options = '<option value="">➕ Create New Event</option>';
      events.forEach(e => {
        const dateStr = e.end_date ? new Date(e.end_date).toLocaleDateString() : 'No date';
        options += `<option value="${e.id}">${e.event_name} (${dateStr})</option>`;
      });
      eventSelector.innerHTML = options;
    }
  } catch (error) {
    console.error('Error loading events for selector:', error);
  }
}

// Load ideas for selector dropdown
async function loadIdeasForSelector() {
  try {
    const res = await fetch(API_BASE_URL + '/api/ideas');
    const ideas = await res.json();
    
    const ideaSelector = document.getElementById('idea-selector');
    if (ideaSelector) {
      let options = '<option value="">➕ Create New Idea</option>';
      ideas.forEach(i => {
        const statusBadge = i.status === 'implemented' ? '✅' : i.status === 'in progress' ? '🔄' : '💡';
        options += `<option value="${i.id}">${statusBadge} ${i.idea_title}</option>`;
      });
      ideaSelector.innerHTML = options;
    }
  } catch (error) {
    console.error('Error loading ideas for selector:', error);
  }
}

// Load organizations and platforms for datalists
async function loadOrganizationsAndPlatforms() {
  try {
    const res = await fetch(API_BASE_URL + '/api/events');
    const events = await res.json();
    
    // Extract unique organizations and platforms
    const organizations = new Set();
    const platforms = new Set();
    
    events.forEach(e => {
      if (e.organisation) organizations.add(e.organisation);
      if (e.platform) platforms.add(e.platform);
    });
    
    // Populate organization datalist
    const orgList = document.getElementById('organisation-list');
    if (orgList) {
      orgList.innerHTML = Array.from(organizations).map(org => `<option value="${org}">`).join('');
    }
    
    // Populate platform datalist
    const platformList = document.getElementById('platform-list');
    if (platformList) {
      platformList.innerHTML = Array.from(platforms).map(plat => `<option value="${plat}">`).join('');
    }
  } catch (error) {
    console.error('Error loading organizations and platforms:', error);
  }
}

// Task management
async function loadTasksForSelect() {
  try {
    const res = await fetch(API_BASE_URL + '/api/tasks');
    const tasks = await res.json();

    // Update task dropdown in create task form
    const taskSelect = document.getElementById('task-project-select');
    if (taskSelect) {
      const projectRes = await fetch(API_BASE_URL + '/api/projects');
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
    await fetch(`${API_BASE_URL}/api/projects/${id}`, { method: 'DELETE' });
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
    await fetch(`${API_BASE_URL}/api/tasks/${id}`, { method: 'DELETE' });
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
    const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/attachments`, {
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
    const res = await fetch(API_BASE_URL + '/api/attachments');
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
            <a href=API_BASE_URL + "/api/attachments/${att.id}" class="btn btn-sm btn-primary" download>Download</a>
            <button class="btn btn-sm btn-danger" onclick="deleteAttachment(${att.id})">Delete</button>
          </div>
        </div>
        <div class="item-meta">Project: ${att.project_name || 'Unknown Project'} | Task: ${att.task_title || 'Unknown Task'} | Uploaded by: ${att.uploaded_by || '—'} | At: ${toIST(att.uploaded_at)}</div>
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
    await fetch(`${API_BASE_URL}/api/attachments/${id}`, { method: 'DELETE' });
    loadAttachments(); // Refresh the all attachments view
    // Refresh activity widget immediately
    refreshActivityLog();
    alert('Attachment deleted');
  } catch (error) {
    console.error('Error deleting attachment:', error);
    alert('Delete failed');
  }
}