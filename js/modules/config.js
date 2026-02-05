// ============================================
// script.js - AI Team Collaboration Frontend
// ============================================
//
// DESCRIPTION:
// This is the main JavaScript file for the AI Team Collaboration application.
// It implements a Single Page Application (SPA) architecture where all views
// are dynamically loaded and switched without page reloads.
//
// ARCHITECTURE:
// - Single Page Application (SPA) with dynamic view switching
// - RESTful API communication with Flask backend
// - Event-driven programming with DOM manipulation
// - Modular function design for maintainability
//
// KEY FEATURES:
// 1. Navigation System - Switch between different views (Projects, Tasks, Events, Ideas, etc.)
// 2. Project Management - Create, edit, delete projects
// 3. Task Management - Hierarchical tasks with subtasks and dependencies
// 4. Events System - Team events and competitions with participation tracking
// 5. Ideas Platform - Innovation ideas with voting and commenting
// 6. AI Suggestions - AI-powered recommendations for task management
// 7. Calendar View - Visual timeline of task deadlines
// 8. Graph Visualization - D3.js-based project and task relationship diagrams
// 9. File Attachments - Upload and download task-related files
// 10. Alerts System - Notifications and reminders
// 11. Chat Integration - Real-time team communication
//
// API ENDPOINTS USED:
// - /api/projects - Project CRUD operations
// - /api/tasks - Task management
// - /api/events - Event management
// - /api/ideas - Ideas submission and voting
// - /api/attachments - File handling
// - /api/alerts - Notification system
// - /api/ai-suggestions - AI recommendations
// - /api/chat - Chat messages
//
// DESIGN PATTERNS:
// - Module Pattern: Functions grouped by feature
// - Async/Await: For clean asynchronous code
// - Event Delegation: For dynamic content
// - Separation of Concerns: Data fetching, rendering, and UI logic separated
//
// BROWSER COMPATIBILITY:
// - Modern browsers (Chrome, Firefox, Safari, Edge)
// - Requires ES6+ support (async/await, arrow functions, template literals)
// - Requires Fetch API support
//
// ============================================
// CONFIGURATION
// ============================================

// API Base URL - Change this to your deployed backend URL
// For local development, use 'http://localhost:5000'
// For production (Render), use 'https://<your-app>.onrender.com'
const API_BASE_URL = 'https://teamcollabai.onrender.com';

// Check if we are in production (GitHub Pages)
if (window.location.hostname.includes('github.io')) {
    // TODO: Update this URL after deploying backend to Render
    // API_BASE_URL = 'https://aiteamcollab.onrender.com';
    console.warn('⚠️ Please configure API_BASE_URL in js/modules/config.js for production!');
}