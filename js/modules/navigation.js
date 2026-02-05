// ============================================
// NAVIGATION SYSTEM
// ============================================

/**
 * GLOBAL FUNCTION: showView()
 * 
 * Central navigation function that switches between different views in the SPA.
 * This function is attached to the window object to make it globally accessible
 * from anywhere in the code, including inline event handlers.
 * 
 * How It Works:
 * 1. Updates navigation menu to highlight active item
 * 2. Updates page header with view title and subtitle
 * 3. Hides all view sections
 * 4. Shows the requested view section
 * 5. Loads data for the selected view
 * 
 * @param {string} view - The name of the view to display
 *                        Valid values: 'projects', 'tasks', 'events', 'ideas',
 *                        'ai-suggestions', 'calendar', 'graph', 'attachments', 'alerts'
 * 
 * @example
 * showView('projects');  // Switches to projects view
 * showView('tasks');     // Switches to tasks view
 * 
 * HTML Integration:
 * This function is called when users click on navigation items or when
 * the application needs to programmatically switch views.
 */
window.showView = function(view) {
  // Log the navigation action for debugging
  console.log(`🧭 showView called: "${view}"`);
  
  // ========================================
  // STEP 1: UPDATE NAVIGATION MENU
  // ========================================
  // Remove 'active' class from all navigation items
  // Then add 'active' class to the clicked item
  document.querySelectorAll('.nav-item').forEach(i => {
    i.classList.remove('active');  // Remove active state from all items
    
    // If this nav item matches the requested view, make it active
    if (i.dataset.view === view) {
      i.classList.add('active');
    }
  });

  // ========================================
  // STEP 2: UPDATE PAGE HEADER
  // ========================================
  // Update the main title and subtitle in the header section
  const viewTitle = document.getElementById('view-title');
  const viewSubtitle = document.getElementById('view-subtitle');
  
  // Set the title (capitalize first letter)
  if (viewTitle) {
    viewTitle.textContent = view.charAt(0).toUpperCase() + view.slice(1);
  }
  
  // Set the descriptive subtitle
  if (viewSubtitle) {
    viewSubtitle.textContent = getViewSubtitle(view);
  }

  // ========================================
  // STEP 3: SWITCH VIEW SECTIONS
  // ========================================
  // Hide all view sections first
  document.querySelectorAll('.view-section').forEach(sec => sec.style.display = 'none');
  
  // Show the requested view section
  const targetView = document.getElementById(`${view}-view`);
  if (targetView) {
    targetView.style.display = 'block';
    console.log(`✅ Showing view: ${view}`);
  } else {
    // Log error if the view doesn't exist (helps with debugging)
    console.error(`❌ View not found: ${view}-view`);
  }

  // ========================================
  // STEP 4: LOAD VIEW DATA
  // ========================================
  // Trigger data loading for the selected view
  // This ensures fresh data is displayed when switching views
  loadViewData(view);
}


// ============================================
// APPLICATION INITIALIZATION
// ============================================

/**
 * DOMContentLoaded Event Handler
 * 
 * This event fires when the HTML document has been completely loaded and parsed,
 * without waiting for stylesheets, images, and subframes to finish loading.
 * 
 * Initialization Steps:
 * 1. Set up navigation event listeners for all menu items
 * 2. Load initial data (projects and tasks)
 * 3. Set up any global event handlers
 * 
 * Why DOMContentLoaded?
 * - Ensures all HTML elements exist before JavaScript tries to access them
 * - Faster than 'load' event (which waits for all resources)
 * - Best practice for initializing JavaScript applications
 */
document.addEventListener('DOMContentLoaded', () => {
  // Log successful application load
  console.log('🚀 PS16 Workspace loaded');

  // ========================================
  // SET UP NAVIGATION EVENT LISTENERS
  // ========================================
  // Find all navigation items and attach click handlers
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      // Get the view name from the data-view attribute
      const view = item.dataset.view;
      
      // If a valid view is specified, show it
      if (view) {
        showView(view);
      }
    });
  });

  // ========================================
  // SET UP CREATE VIEW TAB SWITCHING
  // ========================================
  // Handle switching between tabs in the centralized create view
  document.querySelectorAll('.create-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      switchCreateTab(tab.dataset.tab);
    });
  });
  
  // Initialize priority sliders
  initPrioritySlider();
  initIdeaPrioritySlider();
  
  // Load projects for project selector
  loadProjectsForSelector();
  
  // Load tasks for task selector
  loadTasksForSelector();
  
  // Load events for event selector
  loadEventsForSelector();
  
  // Load ideas for idea selector
  loadIdeasForSelector();
  
  // Load organization and platform lists for events
  loadOrganizationsAndPlatforms();
  
  // Set up project selector change handler
  const projectSelector = document.getElementById('project-selector');
  if (projectSelector) {
    projectSelector.addEventListener('change', async (e) => {
      const projectId = e.target.value;
      if (projectId) {
        // Fetch and populate project data
        try {
          const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}`);
          const project = await res.json();
          
          document.getElementById('project-name').value = project.name || '';
          document.getElementById('project-start').value = project.start_date || '';
          document.getElementById('project-end').value = project.end_date || '';
          document.getElementById('project-desc').value = project.description || '';
          
          // Set edit mode
          const form = document.getElementById('create-project-form');
          form.dataset.editId = projectId;
          
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
        } catch (error) {
          console.error('Error loading project:', error);
          alert('Failed to load project details');
        }
      } else {
        // Reset form for new project
        document.getElementById('create-project-form').reset();
        delete document.getElementById('create-project-form').dataset.editId;
        
        const formTitle = document.querySelector('.create-content[data-content="project"] .card-title');
        const formButton = document.querySelector('#create-project-form button[type="submit"]');
        
        if (formTitle) formTitle.textContent = '📁 Create New Project';
        if (formButton) {
          formButton.innerHTML = `
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
            Create Project
          `;
        }
      }
    });
  }
  
  // Set up cancel button handlers
  const cancelProjectBtn = document.getElementById('cancel-project-btn');
  if (cancelProjectBtn) {
    cancelProjectBtn.addEventListener('click', () => {
      document.getElementById('create-project-form').reset();
      delete document.getElementById('create-project-form').dataset.editId;
      
      if (projectSelector) projectSelector.value = '';
      
      const formTitle = document.querySelector('.create-content[data-content="project"] .card-title');
      const formButton = document.querySelector('#create-project-form button[type="submit"]');
      
      if (formTitle) formTitle.textContent = '📁 Create New Project';
      if (formButton) {
        formButton.innerHTML = `
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          Create Project
        `;
      }
    });
  }
  
  const cancelTaskBtn = document.getElementById('cancel-task-btn');
  if (cancelTaskBtn) {
    cancelTaskBtn.addEventListener('click', () => {
      document.getElementById('create-task-form').reset();
      delete document.getElementById('create-task-form').dataset.editId;
      updatePriorityDisplay(3);
      
      const formTitle = document.querySelector('.create-content[data-content="task"] .card-title');
      const formButton = document.querySelector('#create-task-form button[type="submit"]');
      
      if (formTitle) formTitle.textContent = '✓ Create New Task';
      if (formButton) {
        formButton.innerHTML = `
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          Create Task
        `;
      }
    });
  }
  
  // Set up task selector change handler
  const taskSelector = document.getElementById('task-selector');
  if (taskSelector) {
    taskSelector.addEventListener('change', async (e) => {
      const taskId = e.target.value;
      if (taskId) {
        // Use existing editTask function
        await editTask(taskId);
      } else {
        // Reset form for new task
        document.getElementById('create-task-form').reset();
        delete document.getElementById('create-task-form').dataset.editId;
        updatePriorityDisplay(3);
        
        const formTitle = document.querySelector('.create-content[data-content="task"] .card-title');
        const formButton = document.querySelector('#create-task-form button[type="submit"]');
        
        if (formTitle) formTitle.textContent = '✓ Create New Task';
        if (formButton) {
          formButton.innerHTML = `
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
            Create Task
          `;
        }
      }
    });
  }
  
  // Set up event selector change handler
  const eventSelector = document.getElementById('event-selector');
  if (eventSelector) {
    eventSelector.addEventListener('change', async (e) => {
      const eventId = e.target.value;
      if (eventId) {
        // Use existing editEvent function
        await editEvent(eventId);
      } else {
        // Reset form for new event
        document.getElementById('event-form').reset();
        document.getElementById('event-end-time').value = '23:59';
        currentEditingEventId = null;
        
        const formTitle = document.querySelector('.create-content[data-content="event"] .card-title');
        const formButton = document.getElementById('create-event-btn');
        
        if (formTitle) formTitle.textContent = '📅 Create New Event';
        if (formButton) {
          formButton.innerHTML = `
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-right: 8px;">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
            Create Event
          `;
        }
      }
    });
  }
  
  // Set up idea selector change handler
  const ideaSelector = document.getElementById('idea-selector');
  if (ideaSelector) {
    ideaSelector.addEventListener('change', async (e) => {
      const ideaId = e.target.value;
      if (ideaId) {
        // Use existing editIdea function
        await editIdea(ideaId);
      } else {
        // Reset form for new idea
        document.getElementById('idea-form').reset();
        currentEditingIdeaId = null;
        initIdeaPrioritySlider();
        
        const formTitle = document.querySelector('.create-content[data-content="idea"] .card-title');
        const formButton = document.getElementById('submit-idea-btn');
        
        if (formTitle) formTitle.textContent = '💡 Submit New Idea';
        if (formButton) {
          formButton.innerHTML = `
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-right: 8px;">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
            Submit Idea
          `;
        }
      }
    });
  }
  
  // Helper function to switch create tabs
  window.switchCreateTab = function(tabName) {
    // Remove active class from all tabs
    document.querySelectorAll('.create-tab').forEach(t => t.classList.remove('active'));
    
    // Add active class to the target tab
    const targetTab = document.querySelector(`.create-tab[data-tab="${tabName}"]`);
    if (targetTab) {
      targetTab.classList.add('active');
    }
    
    // Hide all create content sections
    document.querySelectorAll('.create-content').forEach(content => content.classList.remove('active'));
    
    // Show the corresponding create content
    const targetContent = document.querySelector(`.create-content[data-content="${tabName}"]`);
    if (targetContent) {
      targetContent.classList.add('active');
      console.log(`✅ CREATE TAB: Switched to ${tabName} form`);
    }
    
    // Re-initialize priority sliders for the active tab
    if (tabName === 'task') {
      initPrioritySlider();
    } else if (tabName === 'idea') {
      initIdeaPrioritySlider();
    }
  };

  // ========================================
  // LOAD INITIAL DATA
  // ========================================
  // Pre-load project data for the projects view
  loadProjects();
  
  // Pre-load tasks for dropdown/select elements
  // This is used in various forms throughout the application
  loadTasksForSelect();

  // Log successful initialization
  console.log('✅ PS16 Workspace initialized');
});


// ============================================
// VIEW SUBTITLE CONFIGURATION
// ============================================

/**
 * Get the descriptive subtitle for each view.
 * 
 * Subtitles provide users with context about what each view does.
 * They appear in the header section below the main title.
 * 
 * @param {string} view - The name of the view
 * @returns {string} - The descriptive subtitle for the view
 * 
 * Example Usage:
 * getViewSubtitle('projects');  // Returns: "Manage your projects and track progress"
 */
function getViewSubtitle(view) {
  // Object mapping view names to their subtitles
  const subtitles = {
    create: 'Create new projects, tasks, events, and ideas',
    'ai-suggestions': 'Get AI-powered suggestions for your tasks',
    calendar: 'View and manage task deadlines',
    graph: 'Visual project and task relationships',
    ideas: 'Share and manage innovative ideas for the team',
    events: 'Create and manage team events and competitions',
    projects: 'Manage your projects and track progress',
    tasks: 'Create and manage tasks for your projects',
    attachments: 'Upload and manage project files',
    alerts: 'Stay updated with important notifications and alerts'
  };
  
  // Return the subtitle for the requested view
  // If view doesn't exist in the map, return empty string
  return subtitles[view] || '';
}