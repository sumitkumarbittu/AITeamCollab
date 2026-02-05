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
    const res = await fetch(`${API_BASE_URL}/chat/delete/${messageId}`, {
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
    const res = await fetch(API_BASE_URL + '/chat/get');
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
                <span class="time">${m.timestamp || m.time}</span>
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
      await fetch(API_BASE_URL + '/chat/send', {
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