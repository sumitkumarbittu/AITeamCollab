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
  // Backend returns IST formatted string, just extract date part
  if (typeof timestamp === 'string' && timestamp.includes('IST')) {
    return timestamp.split(' ')[0]; // Return date part of IST string
  }
  return toIST(timestamp).split(',')[0];
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
    const res = await fetch(API_BASE_URL + '/api/activity');
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
    const fullTime = toIST(log.timestamp);
    
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
        
        const res = await fetch(API_BASE_URL + '/api/activity/clear', {
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