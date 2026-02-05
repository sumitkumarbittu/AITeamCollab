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

          const res = await fetch(`${API_BASE_URL}/api/calendar/tasks?from=${from}&to=${to}`);
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
              title: t.title,
              start: t.due_date,
              backgroundColor: t.status === 'done' ? '#10b981' : t.status === 'in_progress' ? '#3b82f6' : '#6b7280',
              borderColor: t.status === 'done' ? '#059669' : t.status === 'in_progress' ? '#2563eb' : '#4b5563',
              extendedProps: {
                status: t.status,
                priority: t.priority,
                assigned_to: t.assigned_to,
                project_id: t.project_id
              }
            }));
            
            console.log(`✅ CALENDAR: Loaded ${events.length} events`);
            successCallback(events);
          } else {
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
          const res = await fetch(`${API_BASE_URL}/api/tasks/${info.event.id}`);
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
          const res = await fetch(`${API_BASE_URL}/api/tasks/${info.event.id}`);
          const task = await res.json();
          
          if (res.ok) {
            const updateRes = await fetch(`${API_BASE_URL}/api/tasks/${info.event.id}`, {
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
    const res = await fetch(API_BASE_URL + '/api/tasks');
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
    const res = await fetch(`${API_BASE_URL}/api/ai/suggestions/${taskId}`);
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
    const timestamp = data.generated_at ? toIST(data.generated_at) : '';
    
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
  showView('create');
  switchCreateTab('project');
  
  // Update project selector to show current project
  const projectSelector = document.getElementById('project-selector');
  if (projectSelector) {
    projectSelector.value = projectId;
  }
  
  setTimeout(() => {
    // Populate form fields
    document.getElementById('project-name').value = name || '';
    document.getElementById('project-start').value = startDate || '';
    document.getElementById('project-end').value = endDate || '';
    document.getElementById('project-desc').value = description || '';
    
    // Change form title and button
    const formTitle = document.querySelector('.create-content[data-content="project"] .card-title');
    const formButton = document.querySelector('#create-project-form button[type="submit"]');
    
    if (formTitle) formTitle.textContent = '📁 Edit Project';
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
    
    // Scroll to form
    document.getElementById('create-view').scrollIntoView({ behavior: 'smooth' });
  }, 100);
}

// ========== Edit Task Function ==========
window.editTask = async function(taskId) {
  try {
    // Fetch task details
    const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`);
    const task = await res.json();
    
    // Navigate to create view
    showView('create');
    
    // Switch to task tab
    switchCreateTab('task');
    
    // Update task selector to show current task
    const taskSelector = document.getElementById('task-selector');
    if (taskSelector) {
      taskSelector.value = taskId;
    }
    
    // Small delay to ensure DOM is ready
    setTimeout(() => {
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
      const formTitle = document.querySelector('.create-content[data-content="task"] .card-title');
      const formButton = document.querySelector('#create-task-form button[type="submit"]');
      
      if (formTitle) formTitle.textContent = '✓ Edit Task';
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
      
      // Scroll to form
      document.getElementById('create-view').scrollIntoView({ behavior: 'smooth' });
    }, 100);
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
        const res = await fetch(API_BASE_URL + '/api/projects');
        exportData.projects = await res.json();
        console.log(`✅ Fetched ${exportData.projects.length} projects`);
      }
      
      if (includeTasks) {
        const res = await fetch(API_BASE_URL + '/api/tasks');
        exportData.tasks = await res.json();
        console.log(`✅ Fetched ${exportData.tasks.length} tasks`);
      }
      
      if (includeAttachments) {
        const res = await fetch(API_BASE_URL + '/api/attachments');
        exportData.attachments = await res.json();
        console.log(`✅ Fetched ${exportData.attachments.length} attachments`);
      }
      
      if (includeActivity) {
        const res = await fetch(API_BASE_URL + '/api/activity');
        exportData.activity_logs = await res.json();
        console.log(`✅ Fetched ${exportData.activity_logs.length} activity logs`);
      }
      
      if (includeChat) {
        const res = await fetch(API_BASE_URL + '/chat/get');
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
    const tasksRes = await fetch(API_BASE_URL + '/api/tasks');
    const tasks = await tasksRes.json();
    
    const projectsRes = await fetch(API_BASE_URL + '/api/projects');
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
      alertsList.innerHTML = alerts.map((alert, index) => `
        <div class="alert-item alert-${alert.type}" data-alert-index="${index}">
          <div class="alert-icon">${alert.icon}</div>
          <div class="alert-content">
            <div class="alert-title">${alert.title}</div>
            <div class="alert-message">${alert.message}</div>
            <div class="alert-time">${formatAlertTime(alert.time)}</div>
          </div>
          <div class="alert-actions">
            <button class="alert-slack-btn" onclick="sendAlertToSlack(${index})" title="Send to Slack">
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
              </svg>
              <span>Slack</span>
            </button>
            <button class="alert-dismiss" onclick="dismissAlert(this)" title="Dismiss">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>
      `).join('');
      
      // Store alerts globally for Slack sending
      window.currentAlerts = alerts;
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
  // Check if date is already IST formatted string
  if (typeof date === 'string' && date.includes('IST')) {
    return date.split(' ')[0]; // Return date part
  }
  return toIST(date).split(',')[0];
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

// Send alert to Slack
window.sendAlertToSlack = async function(alertIndex) {
  if (!window.currentAlerts || !window.currentAlerts[alertIndex]) {
    console.error('Alert not found');
    return;
  }
  
  const alert = window.currentAlerts[alertIndex];
  const alertItem = document.querySelector(`[data-alert-index="${alertIndex}"]`);
  const slackBtn = alertItem?.querySelector('.alert-slack-btn');
  
  if (slackBtn) {
    // Show loading state
    const originalHTML = slackBtn.innerHTML;
    slackBtn.disabled = true;
    slackBtn.innerHTML = `
      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="animation: spin 1s linear infinite;">
        <circle cx="12" cy="12" r="10" stroke-width="4" stroke="currentColor" fill="none" opacity="0.25"/>
        <path d="M4 12a8 8 0 018-8" stroke-width="4" stroke="currentColor" fill="none" stroke-linecap="round"/>
      </svg>
      <span>Sending...</span>
    `;
    
    try {
      const response = await fetch(API_BASE_URL + '/api/send_slack_alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: alert.type,
          title: alert.title,
          message: alert.message
        })
      });
      
      const result = await response.json();
      
      if (result.status === 'success') {
        // Show success state
        slackBtn.innerHTML = `
          <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
          <span>Sent!</span>
        `;
        slackBtn.style.background = '#10b981';
        
        // Show success notification
        showNotification('✅ Alert sent to Slack successfully!', 'success');
        
        // Reset button after 3 seconds
        setTimeout(() => {
          slackBtn.innerHTML = originalHTML;
          slackBtn.disabled = false;
          slackBtn.style.background = '';
        }, 3000);
        
      } else {
        throw new Error(result.message || 'Failed to send alert');
      }
      
    } catch (error) {
      console.error('❌ Slack alert error:', error);
      
      // Show error state
      slackBtn.innerHTML = `
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
        <span>Failed</span>
      `;
      slackBtn.style.background = '#ef4444';
      
      // Show error notification
      showNotification(`❌ Failed to send: ${error.message}`, 'error');
      
      // Reset button after 3 seconds
      setTimeout(() => {
        slackBtn.innerHTML = originalHTML;
        slackBtn.disabled = false;
        slackBtn.style.background = '';
      }, 3000);
    }
  }
};

// Helper function to show notifications
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `slack-notification slack-notification-${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 16px 24px;
    background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
    color: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    animation: slideInRight 0.3s ease-out;
    font-weight: 500;
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOutRight 0.3s ease-out';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

console.log('✅ Alerts functionality initialized');


// ============================================
// EVENTS FUNCTIONALITY
// ============================================
// This section handles all event management features including:
// - Loading and displaying events from the database
// - Creating new events
// - Editing existing events
// - Deleting events
// - Form state management

// ========================================
// GLOBAL STATE VARIABLE
// ========================================
// currentEditingEventId: Tracks which event is currently being edited
// - null: Form is in "create new event" mode
// - number: Form is in "edit event" mode with the ID of the event being edited
// This allows the same form to be used for both creating and editing
let currentEditingEventId = null;

// ========================================
// LOAD EVENTS FUNCTION
// ========================================
/**
 * Fetches all events from the backend and displays them in the UI
 * 
 * Called when:
 * - User navigates to the Events page
 * - After creating a new event
 * - After updating an event
 * - After deleting an event
 * - When refresh button is clicked
 * 
 * Behavior:
 * - Displays empty state if no events exist
 * - Renders event cards if events exist
 * - Shows error message if fetch fails
 */
async function loadEvents() {
  console.log('📅 Loading events...');
  
  // Get the DOM element where events will be displayed
  const eventsList = document.getElementById('events-list');
  
  // Safety check: if element doesn't exist, exit early (shouldn't happen)
  if (!eventsList) return;
  
  try {
    // ========================================
    // FETCH DATA FROM BACKEND
    // ========================================
    // Make HTTP GET request to fetch all events
    const response = await fetch(API_BASE_URL + '/api/events');
    
    // Parse JSON response body
    const events = await response.json();
    
    // ========================================
    // RENDER UI BASED ON DATA
    // ========================================
    if (events.length === 0) {
      // NO EVENTS: Show empty state with calendar icon and helpful message
      eventsList.innerHTML = `
        <div class="empty-state">
          <svg width="64" height="64" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin: 0 auto 16px; opacity: 0.3;">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
          </svg>
          <p>No events created yet</p>
          <small style="color: #999;">Create your first event using the form above</small>
        </div>
      `;
    } else {
      // EVENTS EXIST: Render each event as a card
      // map() transforms each event object into HTML string
      // join('') concatenates all HTML strings into one
      eventsList.innerHTML = events.map(event => renderEventCard(event)).join('');
    }
    
    // ========================================
    // ADD EVENT LISTENERS FOR DELETE BUTTONS
    // ========================================
    // Since buttons are dynamically created, we need to add event listeners after rendering
    document.querySelectorAll('.event-card .btn-danger').forEach(btn => {
      btn.addEventListener('click', function() {
        const eventCard = this.closest('.event-card');
        const eventId = parseInt(eventCard.dataset.eventId);
        const eventName = eventCard.querySelector('.event-title').textContent;
        console.log('Delete button clicked for event:', eventId, eventName);
        deleteEvent(eventId, eventName);
      });
    });
    
    // Log success message with count
    console.log(`✅ Loaded ${events.length} events`);
    
  } catch (error) {
    // ========================================
    // ERROR HANDLING
    // ========================================
    // Log error to console for debugging
    console.error('❌ Error loading events:', error);
    
    // Display user-friendly error message in the UI
    eventsList.innerHTML = `
      <div class="empty-state">
        <p style="color: #ef4444;">Failed to load events</p>
        <small style="color: #999;">${error.message}</small>
      </div>
    `;
  }
}

// ========================================
// RENDER EVENT CARD FUNCTION
// ========================================
/**
 * Generates HTML markup for a single event card
 * 
 * @param {Object} event - Event data object from the database
 * @returns {string} - HTML string for the event card
 * 
 * Features:
 * - Displays event name, date, and organization
 * - Shows team size and available slots
 * - Lists team members (shows first 3, counts rest)
 * - Includes edit and delete action buttons
 * - Only shows optional fields if they have values
 * - Uses semantic HTML with proper accessibility attributes
 * 
 * Structure:
 * - Card Header: Icon, title, date, action buttons
 * - Card Body: Grid layout with all event details
 */
function renderEventCard(event) {
  // ========================================
  // FORMAT DATE AND TIME HELPERS
  // ========================================
  // Format a date string to a readable format (e.g., "Jan 15, 2025")
  const formatDate = (dateStr) => {
    if (!dateStr) return 'TBD';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Format time string (e.g., "13:30" -> "1:30 PM")
  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const date = new Date();
    date.setHours(parseInt(hours, 10), parseInt(minutes, 10));
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  // Format date and time range
  const formatDateTimeRange = () => {
    const startDate = event.start_date || event.event_date;
    const endDate = event.end_date || event.event_date;
    const startTime = event.start_time || '00:00';
    const endTime = event.end_time || '23:59';

    if (!startDate && !endDate) return 'No dates specified';

    const startDateStr = formatDate(startDate);
    const endDateStr = formatDate(endDate);
    const startTimeStr = formatTime(startTime);
    const endTimeStr = formatTime(endTime);

    if (startDate === endDate) {
      if (startTime === '00:00' && endTime === '23:59') {
        return `${startDateStr} (All day)`;
      }
      return `${startDateStr} • ${startTimeStr} - ${endTimeStr}`;
    }

    return `${startDateStr} ${startTimeStr} -<br>${endDateStr} ${endTimeStr}`;
  };
  
  // ========================================
  // PROCESS TEAM MEMBERS STRING
  // ========================================
  // Team members are stored as comma-separated string: "Alice, Bob, Charlie"
  // Split by comma, trim whitespace, remove empty strings
  const teamMembers = event.team_members ? event.team_members.split(',').map(m => m.trim()).filter(m => m) : [];
  
  // Display logic:
  // - 0 members: "No team members"
  // - 1-3 members: "Alice, Bob, Charlie"
  // - 4+ members: "Alice, Bob, Charlie +2 more"
  const membersDisplay = teamMembers.length > 0 
    ? teamMembers.slice(0, 3).join(', ') + (teamMembers.length > 3 ? ` +${teamMembers.length - 3} more` : '')
    : 'No team members';
    
  // Format date range for display
  const dateTimeDisplay = formatDateTimeRange();
  
  // ========================================
  // BUILD HTML TEMPLATE
  // ========================================
  // Returns a template literal string containing:
  // 1. event-card container with data-event-id for identification
  // 2. event-card-header with:
  //    - Calendar emoji icon
  //    - Event name and formatted date
  //    - Edit and Delete action buttons (inline onclick handlers)
  // 3. event-card-body with:
  //    - Conditional rendering of optional fields (organisation, platform, team_size, etc.)
  //    - Only displays fields that have values
  //    - Uses ternary operators: ${condition ? html : ''} to show/hide fields
  // 4. Special handling for event_name in delete button (escapes single quotes to prevent JS errors)
  return `
    <div class="event-card" data-event-id="${event.id}">
      <div class="event-card-header">
        <div class="event-icon">📅</div>
        <div class="event-title-section">
          <h4 class="event-title">${event.event_name}</h4>
          <div class="event-date">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
            <span class="date-range">${dateTimeDisplay}</span>
          </div>
        </div>
        <div class="event-actions">
          <button class="btn-icon" onclick="editEvent(${event.id})" title="Edit Event">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
          </button>
          <button class="btn-icon btn-danger" title="Delete Event">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        </div>
      </div>
      
      <div class="event-card-body">
        <div class="event-details">
          ${event.organisation ? `
            <div class="event-detail">
              <span class="detail-label">Organisation:</span>
              <span class="detail-value">${event.organisation}</span>
            </div>
          ` : ''}
          
          ${event.platform ? `
            <div class="event-detail">
              <span class="detail-label">Platform:</span>
              <span class="detail-value">${event.platform}</span>
            </div>
          ` : ''}
          
          ${event.team_size ? `
            <div class="event-detail">
              <span class="detail-label">Team Size:</span>
              <span class="detail-value">${event.team_size}</span>
            </div>
          ` : ''}
          
          ${event.team_slots_available !== null && event.team_slots_available !== undefined ? `
            <div class="event-detail">
              <span class="detail-label">Slots Available:</span>
              <span class="detail-value">${event.team_slots_available}</span>
            </div>
          ` : ''}
          
          <div class="event-detail">
            <span class="detail-label">Added By:</span>
            <span class="detail-value">${event.added_by}</span>
          </div>
          
          <div class="event-detail full-width">
            <span class="detail-label">Team Members:</span>
            <span class="detail-value team-members">${membersDisplay}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ========================================
// EVENT FORM SUBMISSION HANDLER
// ========================================
/**
 * Handles both CREATE and UPDATE operations for events
 * 
 * Flow:
 * 1. Prevent default form submission (no page reload)
 * 2. Collect all form data into an object
 * 3. Show loading state on submit button
 * 4. Check if currentEditingEventId exists:
 *    - If yes: Send PUT request to update existing event
 *    - If no: Send POST request to create new event
 * 5. On success: Reset form, reload events list, show success message
 * 6. On error: Show error message, re-enable button
 * 
 * Optional Chaining (?.) is used to prevent errors if element doesn't exist
 */
document.getElementById('event-form')?.addEventListener('submit', async (e) => {
  // Prevent default form submission behavior (which would reload the page)
  e.preventDefault();
  
  // ========================================
  // COLLECT FORM DATA
  // ========================================
  // Get values from all form inputs
  // - trim() removes leading/trailing whitespace
  // - || null converts empty strings to null for optional fields
  // - parseInt() converts string numbers to integers
  const eventData = {
    event_name: document.getElementById('event-name').value.trim(),
    organisation: document.getElementById('event-organisation').value.trim() || null,
    platform: document.getElementById('event-platform').value.trim() || null,
    team_size: document.getElementById('event-team-size').value ? parseInt(document.getElementById('event-team-size').value) : null,
    team_slots_available: document.getElementById('event-slots').value ? parseInt(document.getElementById('event-slots').value) : null,
    added_by: document.getElementById('event-added-by').value.trim(),
    start_date: document.getElementById('event-start-date').value || null,
    start_time: document.getElementById('event-start-time').value || null,
    end_date: document.getElementById('event-end-date').value || null,
    end_time: document.getElementById('event-end-time').value || null,
    team_members: document.getElementById('event-members').value.trim() || null
  };
  
  // ========================================
  // PREPARE UI FOR LOADING STATE
  // ========================================
  const createBtn = document.getElementById('create-event-btn');
  const originalBtnText = createBtn.innerHTML;  // Save to restore later
  
  try {
    // Disable button to prevent double-submission
    createBtn.disabled = true;
    
    // Show loading spinner and dynamic text based on operation
    createBtn.innerHTML = `
      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="animation: spin 1s linear infinite; margin-right: 8px;">
        <circle cx="12" cy="12" r="10" stroke-width="4" stroke="currentColor" fill="none" opacity="0.25"/>
        <path d="M4 12a8 8 0 018-8" stroke-width="4" stroke="currentColor" fill="none" stroke-linecap="round"/>
      </svg>
      ${currentEditingEventId ? 'Updating...' : 'Creating...'}
    `;
    
    // ========================================
    // SEND HTTP REQUEST
    // ========================================
    let response;
    
    if (currentEditingEventId) {
      // MODE: UPDATE EXISTING EVENT
      // Send PUT request with event ID in URL
      response = await fetch(`${API_BASE_URL}/api/events/${currentEditingEventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData)
      });
    } else {
      // MODE: CREATE NEW EVENT
      // Send POST request to events endpoint
      response = await fetch(API_BASE_URL + '/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData)
      });
    }
    
    // ========================================
    // CHECK RESPONSE STATUS
    // ========================================
    // If response is not OK (2xx status), throw error with server message
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save event');
    }
    
    // ========================================
    // SUCCESS HANDLING
    // ========================================
    // Store editing state before resetting
    const wasEditing = currentEditingEventId !== null;
    
    // Reset the form to clear all inputs
    document.getElementById('event-form').reset();
    
    // Clear the editing state (back to create mode)
    currentEditingEventId = null;
    
    // Reset form title and button
    const formTitle = document.querySelector('.create-content[data-content="event"] .card-title');
    if (formTitle) formTitle.textContent = '📅 Create New Event';
    
    createBtn.innerHTML = `
      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-right: 8px;">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
      </svg>
      Create Event
    `;
    
    // Reload the events list to show the new/updated event
    await loadEvents();
    
    // Show success notification to user
    showNotification(wasEditing ? '✅ Event updated successfully!' : '✅ Event created successfully!', 'success');
    
  } catch (error) {
    // ========================================
    // ERROR HANDLING
    // ========================================
    // Log error to console for debugging
    console.error('❌ Error saving event:', error);
    
    // Restore original button text
    createBtn.innerHTML = originalBtnText;
    
    // Show error notification to user with error message
    showNotification(`❌ Failed to save event: ${error.message}`, 'error');
    
  } finally {
    // ========================================
    // CLEANUP
    // ========================================
    // Re-enable button regardless of success or failure
    // This runs after try or catch block completes
    createBtn.disabled = false;
  }
});

// ========================================
// CANCEL BUTTON HANDLER
// ========================================
/**
 * Resets the form to initial state
 * 
 * Purpose:
 * - Clear all form inputs
 * - Exit edit mode (if in edit mode)
 * - Reset button back to "Create Event" text
 * 
 * This allows users to abandon creating/editing without submitting
 */
document.getElementById('cancel-event-btn')?.addEventListener('click', () => {
  // Clear all form field values
  document.getElementById('event-form').reset();
  
  // Exit edit mode by setting ID back to null
  currentEditingEventId = null;
  
  // Reset button to original "Create Event" state
  document.getElementById('create-event-btn').innerHTML = `
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-right: 8px;">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
    </svg>
    Create Event
  `;
});

// ========================================
// EDIT EVENT FUNCTION
// ========================================
/**
 * Loads an existing event into the form for editing
 * 
 * @param {number} eventId - ID of the event to edit
 * 
 * Flow:
 * 1. Fetch event data from backend by ID
 * 2. Populate all form fields with existing values
 * 3. Set currentEditingEventId to track edit mode
 * 4. Change button text to "Update Event"
 * 5. Scroll form into view for user convenience
 * 
 * Called when user clicks the Edit (pencil) icon on an event card
 * Attached to window object so it can be called from inline onclick in HTML
 */
window.editEvent = async function(eventId) {
  try {
    // ========================================
    // FETCH EVENT DATA
    // ========================================
    const response = await fetch(`${API_BASE_URL}/api/events/${eventId}`);
    const event = await response.json();
    
    // Navigate to create view
    showView('create');
    
    // Switch to event tab
    switchCreateTab('event');
    
    // Update event selector to show current event
    const eventSelector = document.getElementById('event-selector');
    if (eventSelector) {
      eventSelector.value = eventId;
    }
    
    // Small delay to ensure DOM is ready
    setTimeout(() => {
      // ========================================
      // POPULATE FORM FIELDS
      // ========================================
      // Fill each input with existing event data
      // || '' provides empty string fallback if value is null
      document.getElementById('event-name').value = event.event_name || '';
      document.getElementById('event-organisation').value = event.organisation || '';
      document.getElementById('event-platform').value = event.platform || '';
      document.getElementById('event-team-size').value = event.team_size || '';
      document.getElementById('event-slots').value = event.team_slots_available || '';
      document.getElementById('event-added-by').value = event.added_by || '';
      document.getElementById('event-start-date').value = event.start_date || event.event_date || '';
      document.getElementById('event-start-time').value = event.start_time || '';
      document.getElementById('event-end-date').value = event.end_date || event.event_date || '';
      document.getElementById('event-end-time').value = event.end_time || '23:59';
      document.getElementById('event-members').value = event.team_members || '';
      
      // Update form state
      currentEditingEventId = eventId;
      
      // Change form title and button
      const formTitle = document.querySelector('.create-content[data-content="event"] .card-title');
      const formButton = document.getElementById('create-event-btn');
      
      if (formTitle) formTitle.textContent = '📅 Edit Event';
      if (formButton) {
        formButton.innerHTML = `
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-right: 8px;">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
          </svg>
          Update Event
        `;
      }
      
      // Scroll to form
      document.getElementById('create-view').scrollIntoView({ behavior: 'smooth' });
    }, 100);
    
  } catch (error) {
    console.error('❌ Error loading event:', error);
    showNotification(`❌ Failed to load event: ${error.message}`, 'error');
  }
};

// ========================================
// DELETE EVENT FUNCTION
// ========================================
/**
 * Permanently deletes an event from the database
 * 
 * @param {number} eventId - ID of the event to delete
 * @param {string} eventName - Name of event (for confirmation dialog)
 * 
 * Flow:
 * 1. Show confirmation dialog (prevents accidental deletion)
 * 2. If confirmed, send DELETE request to backend
 * 3. On success: Reload events list, show success message
 * 4. On error: Show error message
 * 
 * Called when user clicks the Delete (trash) icon on an event card
 * Attached to window object so it can be called from inline onclick in HTML
 * 
 * Security Note:
 * - Confirmation dialog is the only safeguard
 * - There is NO undo functionality
 * - Deletion is immediate and permanent
 */
window.deleteEvent = async function(eventId, eventName) {
  console.log('🗑️ deleteEvent called with ID:', eventId, 'Name:', eventName);
  
  // ========================================
  // CONFIRMATION DIALOG
  // ========================================
  // Show browser confirmation dialog with event name
  // Returns true if user clicks OK, false if Cancel
  if (!confirm(`Are you sure you want to delete "${eventName}"?\n\nThis action cannot be undone.`)) {
    console.log('❌ Delete cancelled by user');
    return;  // Exit function if user cancels
  }
  
  console.log('✅ Delete confirmed, proceeding with deletion');
  
  try {
    // ========================================
    // SEND DELETE REQUEST
    // ========================================
    console.log('📡 Sending DELETE request to:', `${API_BASE_URL}/api/events/${eventId}`);
    const response = await fetch(`${API_BASE_URL}/api/events/${eventId}`, {
      method: 'DELETE'
    });
    
    console.log('📡 Response received:', response.status, response.statusText);
    
    // Check if deletion was successful
    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ Response not ok, error:', errorText);
      throw new Error(`Failed to delete event: ${errorText}`);
    }
    
    console.log('✅ Delete request successful');
    
    // ========================================
    // SUCCESS HANDLING
    // ========================================
    // Reload events list (deleted event will be gone)
    await loadEvents();
    
    // Show success notification
    showNotification('✅ Event deleted successfully!', 'success');
    
  } catch (error) {
    // ========================================
    // ERROR HANDLING
    // ========================================
    console.error('❌ Error deleting event:', error);
    showNotification(`❌ Failed to delete event: ${error.message}`, 'error');
  }
};

// ========================================
// REFRESH EVENTS BUTTON HANDLER
// ========================================
/**
 * Manually reloads the events list
 * 
 * Purpose:
 * - Allows users to fetch latest data from database
 * - Useful if events are created/modified by other users
 * - Provides visual feedback with loading state
 * 
 * Flow:
 * 1. Disable button and show loading spinner
 * 2. Call loadEvents() to fetch fresh data
 * 3. Restore button to original state
 */
document.getElementById('refresh-events-btn')?.addEventListener('click', async () => {
  const btn = document.getElementById('refresh-events-btn');
  
  // Save original button HTML to restore later
  const originalHTML = btn.innerHTML;
  
  // ========================================
  // SHOW LOADING STATE
  // ========================================
  // Disable button to prevent multiple refresh clicks
  btn.disabled = true;
  
  // Replace button content with spinning icon and "Refreshing..." text
  btn.innerHTML = `
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="animation: spin 1s linear infinite;">
      <circle cx="12" cy="12" r="10" stroke-width="4" stroke="currentColor" fill="none" opacity="0.25"/>
      <path d="M4 12a8 8 0 018-8" stroke-width="4" stroke="currentColor" fill="none" stroke-linecap="round"/>
    </svg>
    Refreshing...
  `;
  
  // ========================================
  // RELOAD EVENTS
  // ========================================
  // Fetch and display latest events from database
  await loadEvents();
  
  // ========================================
  // RESTORE BUTTON STATE
  // ========================================
  // Put back original button HTML
  btn.innerHTML = originalHTML;
  
  // Re-enable button for future clicks
  btn.disabled = false;
});

console.log('✅ Events functionality initialized');
// ============================================
// IDEAS FUNCTIONALITY
// ============================================

let currentEditingIdeaId = null;
let attachmentCount = 1;
let usedNames = new Set();

// Load all ideas
async function loadIdeas() {
  console.log('💡 Loading ideas...');
  const ideasList = document.getElementById('ideas-list');
  
  if (!ideasList) return;
  
  try {
    const response = await fetch(API_BASE_URL + '/api/ideas');
    const ideas = await response.json();
    
    // Collect used names for autocomplete
    ideas.forEach(idea => {
      usedNames.add(idea.added_by);
      if (idea.likes) {
        idea.likes.split(',').filter(n => n.trim()).forEach(name => usedNames.add(name.trim()));
      }
      if (idea.comments && idea.comments.length > 0) {
        idea.comments.forEach(comment => usedNames.add(comment.name));
      }
    });
    updateNameDatalist();
    
    if (ideas.length === 0) {
      ideasList.innerHTML = `
        <div class="empty-state">
          <svg width="64" height="64" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin: 0 auto 16px; opacity: 0.3;">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
          </svg>
          <p>No ideas submitted yet</p>
          <small style="color: #999;">Be the first to share your brilliant idea!</small>
        </div>
      `;
    } else {
      ideasList.innerHTML = ideas.map(idea => renderIdeaCard(idea)).join('');
    }
    
    console.log(`✅ Loaded ${ideas.length} ideas`);
  } catch (error) {
    console.error('❌ Error loading ideas:', error);
    ideasList.innerHTML = `
      <div class="empty-state">
        <p style="color: #ef4444;">Failed to load ideas</p>
        <small style="color: #999;">${error.message}</small>
      </div>
    `;
  }
}

// Update name datalist
function updateNameDatalist() {
  const datalist = document.getElementById('idea-names-list');
  if (datalist) {
    datalist.innerHTML = Array.from(usedNames).map(name => `<option value="${name}">`).join('');
  }
}

// Render a single idea card
function renderIdeaCard(idea) {
  const createdDate = idea.created_at ? toIST(idea.created_at).split(',')[0] : 'Unknown date';
  
  const likesArray = idea.likes ? idea.likes.split(',').filter(n => n.trim()) : [];
  const likesCount = likesArray.length;
  const commentsCount = idea.comments ? idea.comments.length : 0;
  
  const priorityClass = idea.priority === 'high' ? 'priority-high' : 
                        idea.priority === 'low' ? 'priority-low' : 'priority-medium';
  
  const statusClass = idea.status.replace(' ', '-');
  
  // Render attachments preview
  let attachmentsHtml = '';
  if (idea.attachments && idea.attachments.length > 0) {
    attachmentsHtml = `
      <div class="idea-attachments">
        <strong>Attachments:</strong>
        <div class="attachments-preview">
          ${idea.attachments.map((att, idx) => `
            <div class="attachment-preview">
              ${att.type && att.type.startsWith('image/') ? 
                `<img src="${att.data}" alt="${att.name}" class="attachment-img">` :
                `<div class="attachment-file">
                  <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                  <span>${att.name}</span>
                </div>`
              }
              ${att.caption ? `<p class="attachment-caption">${att.caption}</p>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
  
  return `
    <div class="idea-card" data-idea-id="${idea.id}">
      <div class="idea-card-header">
        <div class="idea-header-left">
          <div class="idea-icon">💡</div>
          <div>
            <h4 class="idea-title">${idea.idea_title}</h4>
            <div class="idea-meta">
              <span class="idea-author">by ${idea.added_by}</span>
              <span class="idea-date">${createdDate}</span>
            </div>
          </div>
        </div>
        <div class="idea-header-right">
          <span class="idea-status status-${statusClass}">${idea.status}</span>
          <span class="idea-priority ${priorityClass}">${idea.priority}</span>
          <div class="idea-actions">
            <button class="btn-icon" onclick="editIdea(${idea.id})" title="Edit Idea">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
            </button>
            <button class="btn-icon btn-danger" onclick="deleteIdea(${idea.id}, '${idea.idea_title.replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\\/g, '\\\\')}')" title="Delete Idea">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      <div class="idea-card-body">
        <p class="idea-description">${idea.idea_description}</p>
        
        ${attachmentsHtml}
        
        <div class="idea-interactions">
          <button class="idea-interaction-btn" onclick="toggleLikeIdea(${idea.id})">
            <svg width="20" height="20" fill="${likesArray.length > 0 ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
            </svg>
            <span id="likes-count-${idea.id}">${likesCount}</span> Like${likesCount !== 1 ? 's' : ''}
          </button>
          
          <button class="idea-interaction-btn" onclick="toggleComments(${idea.id})">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"/>
            </svg>
            ${commentsCount} Comment${commentsCount !== 1 ? 's' : ''}
          </button>
        </div>
        
        ${likesCount > 0 ? `
          <div class="idea-likes-list">
            <small>Liked by: ${likesArray.join(', ')}</small>
          </div>
        ` : ''}
        
        <div class="idea-comments" id="comments-${idea.id}" style="display:none;">
          <div class="comments-list" id="comments-list-${idea.id}">
            ${idea.comments && idea.comments.length > 0 ? 
              idea.comments.map(comment => `
                <div class="comment">
                  <strong>${comment.name}</strong>
                  <p>${comment.text}</p>
                  <small>${toIST(comment.timestamp)}</small>
                </div>
              `).join('') : 
              '<p class="no-comments">No comments yet</p>'
            }
          </div>
          <div class="add-comment-form">
            <input type="text" id="comment-name-${idea.id}" placeholder="Your name" list="idea-names-list" class="comment-input">
            <input type="text" id="comment-text-${idea.id}" placeholder="Add a comment..." class="comment-input">
            <button class="btn btn-primary btn-small" onclick="addComment(${idea.id})">Post</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Toggle like on idea
async function toggleLikeIdea(ideaId) {
  const name = prompt('Enter your name to like this idea:');
  if (!name || !name.trim()) return;
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/ideas/${ideaId}`);
    const idea = await response.json();
    
    const likesArray = idea.likes ? idea.likes.split(',').filter(n => n.trim()) : [];
    const nameIndex = likesArray.indexOf(name.trim());
    
    if (nameIndex > -1) {
      likesArray.splice(nameIndex, 1);
    } else {
      likesArray.push(name.trim());
      usedNames.add(name.trim());
      updateNameDatalist();
    }
    
    idea.likes = likesArray.join(',');
    
    const updateResponse = await fetch(`${API_BASE_URL}/api/ideas/${ideaId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(idea)
    });
    
    if (!updateResponse.ok) throw new Error('Failed to update likes');
    
    await loadIdeas();
    showNotification(nameIndex > -1 ? '👍 Like removed' : '❤️ Liked!', 'success');
  } catch (error) {
    console.error('Error toggling like:', error);
    showNotification('❌ Failed to update like', 'error');
  }
}

// Toggle comments section
function toggleComments(ideaId) {
  const commentsSection = document.getElementById(`comments-${ideaId}`);
  if (commentsSection) {
    commentsSection.style.display = commentsSection.style.display === 'none' ? 'block' : 'none';
  }
}

// Add comment to idea
async function addComment(ideaId) {
  const nameInput = document.getElementById(`comment-name-${ideaId}`);
  const textInput = document.getElementById(`comment-text-${ideaId}`);
  
  const name = nameInput.value.trim();
  const text = textInput.value.trim();
  
  if (!name || !text) {
    showNotification('❌ Please enter your name and comment', 'error');
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/ideas/${ideaId}`);
    const idea = await response.json();
    
    if (!idea.comments) idea.comments = [];
    
    idea.comments.push({
      name: name,
      text: text,
      timestamp: new Date().toISOString()
    });
    
    usedNames.add(name);
    updateNameDatalist();
    
    const updateResponse = await fetch(`${API_BASE_URL}/api/ideas/${ideaId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(idea)
    });
    
    if (!updateResponse.ok) throw new Error('Failed to add comment');
    
    nameInput.value = '';
    textInput.value = '';
    
    await loadIdeas();
    toggleComments(ideaId);
    showNotification('💬 Comment added!', 'success');
  } catch (error) {
    console.error('Error adding comment:', error);
    showNotification('❌ Failed to add comment', 'error');
  }
}

// Handle idea form submission
document.getElementById('idea-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  // Collect attachments
  const attachments = [];
  for (let i = 1; i <= 3; i++) {
    const fileInput = document.getElementById(`idea-attachment-${i}`);
    const captionInput = document.getElementById(`idea-caption-${i}`);
    
    if (fileInput && fileInput.files.length > 0) {
      const file = fileInput.files[0];
      const reader = new FileReader();
      
      await new Promise((resolve) => {
        reader.onload = (e) => {
          attachments.push({
            name: file.name,
            type: file.type,
            data: e.target.result,
            caption: captionInput.value.trim()
          });
          resolve();
        };
        reader.readAsDataURL(file);
      });
    }
  }
  
  const priorityValue = document.getElementById('idea-priority').value;
  const priorityMap = { '1': 'urgent', '2': 'high', '3': 'medium', '4': 'low', '5': 'minimal' };
  
  const ideaData = {
    idea_title: document.getElementById('idea-title').value.trim(),
    idea_description: document.getElementById('idea-description').value.trim(),
    added_by: document.getElementById('idea-added-by').value.trim(),
    status: document.getElementById('idea-status').value,
    priority: priorityMap[priorityValue],
    likes: '',
    comments: [],
    attachments: attachments
  };
  
  const submitBtn = document.getElementById('submit-idea-btn');
  const originalBtnText = submitBtn.innerHTML;
  
  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="animation: spin 1s linear infinite; margin-right: 8px;">
        <circle cx="12" cy="12" r="10" stroke-width="4" stroke="currentColor" fill="none" opacity="0.25"/>
        <path d="M4 12a8 8 0 018-8" stroke-width="4" stroke="currentColor" fill="none" stroke-linecap="round"/>
      </svg>
      ${currentEditingIdeaId ? 'Updating...' : 'Submitting...'}
    `;
    
    let response;
    if (currentEditingIdeaId) {
      const existingIdea = await fetch(`${API_BASE_URL}/api/ideas/${currentEditingIdeaId}`).then(r => r.json());
      ideaData.likes = existingIdea.likes;
      ideaData.comments = existingIdea.comments;
      
      response = await fetch(`${API_BASE_URL}/api/ideas/${currentEditingIdeaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ideaData)
      });
    } else {
      response = await fetch(API_BASE_URL + '/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ideaData)
      });
    }
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save idea');
    }
    
    // Store editing state before resetting
    const wasEditing = currentEditingIdeaId !== null;
    
    document.getElementById('idea-form').reset();
    currentEditingIdeaId = null;
    
    // Reset form title and button
    const formTitle = document.querySelector('.create-content[data-content="idea"] .card-title');
    if (formTitle) formTitle.textContent = '💡 Submit New Idea';
    
    submitBtn.innerHTML = `
      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-right: 8px;">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
      </svg>
      Submit Idea
    `;
    
    document.getElementById('idea-priority-value').textContent = 'Medium';
    resetAttachments();
    await loadIdeas();
    
    showNotification(wasEditing ? '✅ Idea updated successfully!' : '✅ Idea submitted successfully!', 'success');
    
  } catch (error) {
    console.error('❌ Error saving idea:', error);
    submitBtn.innerHTML = originalBtnText;
    showNotification(`❌ Failed: ${error.message}`, 'error');
  } finally {
    submitBtn.disabled = false;
  }
});

// Initialize idea priority slider
function initIdeaPrioritySlider() {
  const ideaPrioritySlider = document.getElementById('idea-priority');
  const ideaPriorityValue = document.getElementById('idea-priority-value');
  
  if (ideaPrioritySlider && ideaPriorityValue) {
    // Remove existing event listeners by replacing the element
    const newSlider = ideaPrioritySlider.cloneNode(true);
    ideaPrioritySlider.parentNode.replaceChild(newSlider, ideaPrioritySlider);
    
    newSlider.addEventListener('input', (e) => {
      const value = e.target.value;
      const labels = ['🔴 Urgent', '🟠 High', '🟡 Medium', '🔵 Low', '⚪ Minimal'];
      document.getElementById('idea-priority-value').textContent = labels[value - 1];
    });
    
    // Initialize display
    const value = newSlider.value;
    const labels = ['🔴 Urgent', '🟠 High', '🟡 Medium', '🔵 Low', '⚪ Minimal'];
    ideaPriorityValue.textContent = labels[value - 1];
  }
}

// Priority slider handler
document.getElementById('idea-priority')?.addEventListener('input', (e) => {
  const value = e.target.value;
  const labels = ['🔴 Urgent', '🟠 High', '🟡 Medium', '🔵 Low', '⚪ Minimal'];
  document.getElementById('idea-priority-value').textContent = labels[value - 1];
});

// Add attachment button
document.getElementById('add-attachment-btn')?.addEventListener('click', () => {
  if (attachmentCount < 3) {
    attachmentCount++;
    const group = document.querySelector(`.attachment-input-group:nth-child(${attachmentCount})`);
    if (group) group.style.display = 'flex';
    
    if (attachmentCount === 3) {
      document.getElementById('add-attachment-btn').style.display = 'none';
    }
  }
});

// Reset attachments
function resetAttachments() {
  attachmentCount = 1;
  for (let i = 2; i <= 3; i++) {
    const group = document.querySelector(`.attachment-input-group:nth-child(${i})`);
    if (group) group.style.display = 'none';
  }
  document.getElementById('add-attachment-btn').style.display = 'block';
}

// Cancel button
document.getElementById('cancel-idea-btn')?.addEventListener('click', () => {
  document.getElementById('idea-form').reset();
  currentEditingIdeaId = null;
  document.getElementById('submit-idea-btn').innerHTML = `
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-right: 8px;">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
    </svg>
    Submit Idea
  `;
  document.getElementById('idea-priority-value').textContent = 'Medium';
  resetAttachments();
});

// Edit idea
window.editIdea = async function(ideaId) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/ideas/${ideaId}`);
    const idea = await response.json();
    
    // Navigate to create view
    showView('create');
    
    // Switch to idea tab
    switchCreateTab('idea');
    
    // Update idea selector to show current idea
    const ideaSelector = document.getElementById('idea-selector');
    if (ideaSelector) {
      ideaSelector.value = ideaId;
    }
    
    // Small delay to ensure DOM is ready
    setTimeout(() => {
      document.getElementById('idea-title').value = idea.idea_title || '';
      document.getElementById('idea-description').value = idea.idea_description || '';
      document.getElementById('idea-added-by').value = idea.added_by || '';
      document.getElementById('idea-status').value = idea.status || 'proposed';
      
      const priorityMap = { 'urgent': '1', 'high': '2', 'medium': '3', 'low': '4', 'minimal': '5' };
      const priorityValue = priorityMap[idea.priority] || '3';
      document.getElementById('idea-priority').value = priorityValue;
      
      const priorityLabels = { '1': '🔴 Urgent', '2': '🟠 High', '3': '🟡 Medium', '4': '🔵 Low', '5': '⚪ Minimal' };
      document.getElementById('idea-priority-value').textContent = priorityLabels[priorityValue] || '🟡 Medium';
      
      currentEditingIdeaId = ideaId;
      
      // Change form title and button
      const formTitle = document.querySelector('.create-content[data-content="idea"] .card-title');
      const formButton = document.getElementById('submit-idea-btn');
      
      if (formTitle) formTitle.textContent = '💡 Edit Idea';
      if (formButton) {
        formButton.innerHTML = `
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-right: 8px;">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
          </svg>
          Update Idea
        `;
      }
      
      // Scroll to form
      document.getElementById('create-view').scrollIntoView({ behavior: 'smooth' });
    }, 100);
    
  } catch (error) {
    console.error('❌ Error loading idea:', error);
    showNotification(`❌ Failed to load idea: ${error.message}`, 'error');
  }
};

// Delete idea
window.deleteIdea = async function(ideaId, ideaTitle) {
  if (!confirm(`Are you sure you want to delete "${ideaTitle}"?\n\nThis action cannot be undone.`)) {
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/ideas/${ideaId}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete idea');
    }
    
    await loadIdeas();
    showNotification('✅ Idea deleted successfully!', 'success');
    
  } catch (error) {
    console.error('❌ Error deleting idea:', error);
    showNotification(`❌ Failed to delete idea: ${error.message}`, 'error');
  }
};

// Refresh ideas
document.getElementById('refresh-ideas-btn')?.addEventListener('click', async () => {
  const btn = document.getElementById('refresh-ideas-btn');
  const originalHTML = btn.innerHTML;
  
  btn.disabled = true;
  btn.innerHTML = `
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="animation: spin 1s linear infinite;">
      <circle cx="12" cy="12" r="10" stroke-width="4" stroke="currentColor" fill="none" opacity="0.25"/>
      <path d="M4 12a8 8 0 018-8" stroke-width="4" stroke="currentColor" fill="none" stroke-linecap="round"/>
    </svg>
    Refreshing...
  `;
  
  await loadIdeas();
  
  btn.innerHTML = originalHTML;
  btn.disabled = false;
});

console.log('✅ Ideas functionality initialized');