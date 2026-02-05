// ========================================
// PRIORITY SLIDER FUNCTIONALITY
// ========================================
function updatePriorityDisplay(value) {
  const priorityNames = {
    1: '🔴 Urgent',
    2: '🟠 High',
    3: '🟡 Medium',
    4: '🔵 Low',
    5: '⚪ Minimal'
  };
  
  const priorityDisplay = document.getElementById('priority-display');
  if (priorityDisplay) {
    priorityDisplay.innerHTML = `<span class="priority-badge priority-${value}">${priorityNames[value]}</span>`;
  }
}

// Initialize priority slider (will be called after DOM loads)
function initPrioritySlider() {
  const prioritySlider = document.getElementById('task-priority');
  if (prioritySlider) {
    prioritySlider.addEventListener('input', (e) => {
      updatePriorityDisplay(e.target.value);
    });
    
    // Initialize display
    updatePriorityDisplay(prioritySlider.value);
  }
}