# ============================================
# app.py - AI Team Collaboration Application
# ============================================
# 
# DESCRIPTION:
# This is the main Flask application file for the AI Team Collaboration platform.
# It provides a comprehensive REST API for managing team collaboration features including:
# - Projects and Tasks with subtasks and dependencies
# - File Attachments stored directly in PostgreSQL
# - Team Chat functionality
# - Events and Competitions
# - Ideas submission and voting system
# - AI-powered suggestions for task management
# - Activity logging and monitoring
# 
# ARCHITECTURE:
# - Backend: Flask (Python web framework)
# - Database: PostgreSQL with psycopg2 (raw SQL) and SQLAlchemy (ORM)
# - Frontend: Vanilla JavaScript (Single Page Application)
# - Deployment: Render.com with PostgreSQL database
# 
# DATABASE DESIGN:
# The application uses 8 main tables:
# 1. projects - Main project management
# 2. tasks - Task tracking with parent/child relationships and dependencies
# 3. attachments - File storage using PostgreSQL BYTEA
# 4. activity_logg - User activity audit trail
# 5. chat - Team communication messages
# 6. events - Team events and competitions
# 7. ideas - Innovation ideas with voting and comments
# 8. alerts - System notifications and alerts
# 
# USAGE:
#   1. Set environment variable: export DATABASE_URL="postgres://user:pass@host:5432/dbname"
#   2. Run the application: python app.py
#   3. Access at: http://localhost:5000
# 
# API ENDPOINTS:
# - /api/projects - Project CRUD operations
# - /api/tasks - Task management with subtasks
# - /api/attachments - File upload/download
# - /api/chat - Real-time chat messages
# - /api/events - Event management
# - /api/ideas - Ideas submission and voting
# - /api/alerts - Notification system
# - /api/ai-suggestions - AI-powered recommendations
# 
# ============================================

# ============================================
# IMPORTS
# ============================================

# Standard library imports
import os  # Operating system interface for environment variables and file operations
import io  # Core tools for working with streams (used for file handling)
import json  # JSON encoding and decoding for API data serialization
from datetime import datetime  # Date and time manipulation

# Flask framework imports
from flask import Flask, request, jsonify, send_file, send_from_directory
# - Flask: Main application class
# - request: Access incoming request data (form data, JSON, query params)
# - jsonify: Convert Python dictionaries to JSON responses
# - send_file: Send files (like attachments) as responses
# - send_from_directory: Serve static files (HTML, CSS, JS)

# Security and utilities
from werkzeug.utils import secure_filename  # Sanitize uploaded filenames to prevent security issues

# Custom configuration imports
from config import get_db_connection, db, log_activity, ActivityLog, Chat
# - get_db_connection: Function to create PostgreSQL connections
# - db: SQLAlchemy database instance
# - log_activity: Helper function to log user activities
# - ActivityLog, Chat: Database models

# External libraries
import logging  # Python's built-in logging framework for debugging
import requests  # HTTP library for making external API calls (used for AI features)
import psycopg2  # PostgreSQL database adapter
import psycopg2.extras  # Additional psycopg2 utilities


# ============================================
# FLASK APPLICATION INITIALIZATION
# ============================================

# Create the Flask application instance
# __name__ tells Flask where to look for resources (templates, static files)
app = Flask(__name__)

# ============================================
# DATABASE CONFIGURATION
# ============================================

# Configure SQLAlchemy ORM settings
# SQLALCHEMY_DATABASE_URI: Connection string to PostgreSQL database
# Retrieved from environment variable DATABASE_URL (set by Render or locally)
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')

# SQLALCHEMY_TRACK_MODIFICATIONS: Disable modification tracking feature
# This feature adds overhead and is not needed in production
# Setting to False improves performance
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize the SQLAlchemy database instance with our Flask app
# This connects the db object from config.py to our Flask application
db.init_app(app)

# ============================================
# CORS (Cross-Origin Resource Sharing) CONFIGURATION
# ============================================

# Import and enable CORS to allow frontend and backend communication
from flask_cors import CORS
# CORS allows the frontend (which may be on a different domain) to make
# API requests to this backend without browser security restrictions
CORS(app)


# ============================================
# STATIC FILE SERVING ROUTES
# ============================================
# These routes serve the frontend application files
# In production, these files would typically be served by a web server like Nginx,
# but for simplicity, Flask serves them directly here

@app.route('/')
def serve_index():
    """
    Serve the main HTML file (index.html) when accessing the root URL.
    
    This is the entry point for the Single Page Application (SPA).
    When a user visits http://localhost:5000/, they receive the index.html file.
    
    Returns:
        HTML file: The main application interface
    """
    return send_from_directory('.', 'index.html')


@app.route('/style.css')
def serve_css():
    """
    Serve the CSS stylesheet file.
    
    The frontend requests this file to apply visual styling to the application.
    This route handles requests to http://localhost:5000/style.css
    
    Returns:
        CSS file: Application styles and layout
    """
    return send_from_directory('.', 'style.css')


@app.route('/script.js')
def serve_js():
    """
    Serve the JavaScript application file.
    
    This file contains all the frontend logic including:
    - User interface interactions
    - API calls to backend endpoints
    - Dynamic content rendering
    - State management
    
    Returns:
        JavaScript file: Frontend application logic
    """
    return send_from_directory('.', 'script.js')

# ============================================
# DATABASE INITIALIZATION FUNCTION
# ============================================

def init_db():
    """
    Initialize the database by creating all required tables if they don't exist.
    
    This function is called when the application starts to ensure all database
    tables are properly set up. It uses raw SQL CREATE TABLE statements with
    "IF NOT EXISTS" to avoid errors if tables already exist.
    
    Database Schema Overview:
    1. projects - Main project management
    2. tasks - Task tracking with hierarchical relationships
    3. attachments - File storage using PostgreSQL BYTEA
    4. activity_logg - User activity audit trail
    5. events - Team events and competitions
    6. ideas - Innovation ideas with voting/comments
    7. alerts - Notification system
    8. chat - Team communication (created via SQLAlchemy)
    
    Design Decisions:
    - Uses SERIAL for auto-incrementing IDs (PostgreSQL-specific)
    - CASCADE deletions maintain referential integrity
    - Timestamps track creation and modification times
    - JSONB used for flexible structured data (comments, attachments)
    - BYTEA used for binary file storage
    
    Returns:
        None
    
    Raises:
        psycopg2.Error: If database connection or query execution fails
    """
    # Establish a connection to the PostgreSQL database
    conn = get_db_connection()
    
    # Create a cursor object to execute SQL queries
    cur = conn.cursor()
    
    # ========================================
    # TABLE 1: PROJECTS
    # ========================================
    # This table stores high-level project information
    # Projects can contain multiple tasks and serve as organizational units
    #
    # Columns:
    #   - id: Unique identifier (auto-increment)
    #   - name: Project name (REQUIRED)
    #   - description: Detailed project description
    #   - start_date: When the project begins
    #   - end_date: Target completion date
    #   - status: Current state (default: 'active')
    #   - created_at: When the record was created
    #   - updated_at: Last modification timestamp
    cur.execute("""
    CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        start_date DATE,
        end_date DATE,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT now(),
        updated_at TIMESTAMP DEFAULT now()
    );
    """)
    
    # ========================================
    # TABLE 2: TASKS
    # ========================================
    # This table stores individual tasks and subtasks
    # 
    # Key Features:
    # - Hierarchical structure via parent_task_id (subtasks)
    # - Task dependencies via depends_on_task_id
    # - Foreign key to projects table
    # - Cascading deletes ensure data integrity
    #
    # Columns:
    #   - id: Unique task identifier
    #   - project_id: Links to parent project (CASCADE DELETE)
    #   - title: Short task name (REQUIRED)
    #   - description: Detailed task description
    #   - assigned_to: Person responsible for the task
    #   - status: Current state (todo, in-progress, done)
    #   - priority: Importance level (1-5, default: 3)
    #   - due_date: Target completion date
    #   - parent_task_id: For subtasks, links to parent (CASCADE DELETE)
    #   - depends_on_task_id: For dependencies, links to blocking task
    #   - created_at: Creation timestamp
    #   - updated_at: Last modification timestamp
    #
    # Relationships:
    # - Parent-Child: parent_task_id creates task hierarchies
    # - Dependencies: depends_on_task_id creates task chains
    # - Project Ownership: project_id links task to project
    cur.execute("""
    CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        assigned_to TEXT,
        status TEXT DEFAULT 'todo',
        priority INTEGER DEFAULT 3,
        due_date DATE,
        parent_task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        depends_on_task_id INTEGER REFERENCES tasks(id),
        created_at TIMESTAMP DEFAULT now(),
        updated_at TIMESTAMP DEFAULT now()
    );
    """)
    
    # ========================================
    # TABLE 3: ATTACHMENTS
    # ========================================
    # This table stores file attachments directly in PostgreSQL using BYTEA
    #
    # Design Decision:
    # Files are stored IN the database (not on filesystem) for simplicity
    # and to ensure atomic transactions. This works well for smaller files
    # but may need modification for very large files in production.
    #
    # Columns:
    #   - id: Unique attachment identifier
    #   - task_id: Links to associated task (CASCADE DELETE)
    #   - filename: Original filename with extension
    #   - content_type: MIME type (e.g., 'image/png', 'application/pdf')
    #   - content: Binary file data stored as BYTEA
    #   - uploaded_by: Name of person who uploaded the file
    #   - uploaded_at: Upload timestamp
    #
    # Security Note:
    # Filenames are sanitized using secure_filename() to prevent
    # directory traversal and other file-based attacks
    cur.execute("""
    CREATE TABLE IF NOT EXISTS attachments (
        id SERIAL PRIMARY KEY,
        task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        filename TEXT,
        content_type TEXT,
        content BYTEA,
        uploaded_by TEXT,
        uploaded_at TIMESTAMP DEFAULT now()
    );
    """)
    
    # ========================================
    # TABLE 4: ACTIVITY LOG
    # ========================================
    # This table tracks all user actions for audit and monitoring
    #
    # Use Cases:
    # - Security auditing
    # - User behavior analytics
    # - Debugging and troubleshooting
    # - Activity feed generation
    #
    # Columns:
    #   - id: Unique log entry identifier
    #   - user_id: ID of user who performed the action
    #   - action_type: Type of action (create, update, delete)
    #   - object_type: Type of object affected (task, project, etc.)
    #   - object_id: ID of the affected object
    #   - timestamp: When the action occurred
    #
    # Example Log Entry:
    # user_id=1, action_type='update', object_type='task', object_id=42
    # Meaning: User 1 updated task 42
    cur.execute("""
    CREATE TABLE IF NOT EXISTS activity_logg (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        action_type TEXT NOT NULL,
        object_type TEXT NOT NULL,
        object_id INTEGER NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)
    
    # ========================================
    # TABLE 5: EVENTS
    # ========================================
    # This table manages team events, competitions, hackathons, and meetups
    #
    # Features:
    # - Track external events (hackathons, competitions)
    # - Manage team formation and participation
    # - Monitor available slots for team members
    # - Store event details and dates
    #
    # Columns:
    #   - id: Unique event identifier
    #   - event_name: Name of the event (REQUIRED)
    #   - organisation: Organizing body/company (e.g., "Google", "HackerRank")
    #   - platform: Hosting platform (e.g., "Devfolio", "HackerRank")
    #   - team_size: Maximum team size allowed
    #   - team_slots_available: Remaining slots for team members
    #   - added_by: Person who created this event entry (REQUIRED)
    #   - event_date: Date of the event (REQUIRED)
    #   - team_members: Comma-separated list of team member names
    #   - created_at: Record creation timestamp
    #   - updated_at: Last modification timestamp
    #
    # Use Case Example:
    # A hackathon allows teams of 4, and 2 people have joined.
    # team_size=4, team_slots_available=2, team_members="Alice, Bob"
    cur.execute("""
    CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        event_name TEXT NOT NULL,
        organisation TEXT,
        platform TEXT,
        team_size INTEGER,
        team_slots_available INTEGER,
        added_by TEXT NOT NULL,
        event_date DATE NOT NULL,
        team_members TEXT,
        created_at TIMESTAMP DEFAULT now(),
        updated_at TIMESTAMP DEFAULT now()
    );
    
    # ========================================
    # TABLE 6: IDEAS
    # ========================================
    # This table manages innovation ideas with social features
    #
    # Features:
    # - Submit and share team ideas
    # - Like/voting system using comma-separated names
    # - Commenting system using JSONB for structured data
    # - File attachments with captions (max 3 per idea)
    # - Status tracking (proposed → implemented)
    # - Priority levels for idea triage
    #
    # Columns:
    #   - id: Unique idea identifier
    #   - idea_title: Short descriptive title (REQUIRED)
    #   - idea_description: Detailed explanation (REQUIRED)
    #   - added_by: Person who submitted the idea (REQUIRED)
    #   - likes: Comma-separated list of names who liked this idea
    #              Example: "Alice, Bob, Charlie"
    #   - comments: JSONB array of comment objects
    #               Format: [{"name": "Alice", "text": "Great!", "timestamp": "..."}]
    #   - attachments: JSONB array of attachment objects
    #                  Format: [{"name": "file.png", "type": "image/png", 
    #                           "data": "base64...", "caption": "Screenshot"}]
    #   - status: Current state of the idea
    #             Values: 'proposed', 'under review', 'in progress', 
    #                     'implemented', 'archived'
    #   - priority: Importance level
    #              Values: 'low', 'medium', 'high'
    #   - created_at: When the idea was submitted
    #   - updated_at: Last modification timestamp
    #
    # Design Decision - JSONB vs Separate Tables:
    # Using JSONB for comments and attachments provides flexibility
    # and avoids complex joins for simple social features. This is
    # acceptable since these are not core business entities requiring
    # complex queries or indexing.
    CREATE TABLE IF NOT EXISTS ideas (
        id SERIAL PRIMARY KEY,
        idea_title TEXT NOT NULL,
        idea_description TEXT NOT NULL,
        added_by TEXT NOT NULL,
        likes TEXT DEFAULT '',
        comments JSONB DEFAULT '[]',
        attachments JSONB DEFAULT '[]',
        status TEXT DEFAULT 'proposed',
        priority TEXT DEFAULT 'medium',
        created_at TIMESTAMP DEFAULT now(),
        updated_at TIMESTAMP DEFAULT now()
    );
    """)
    
    # ========================================
    # COMMIT AND CLEANUP
    # ========================================
    # Commit all table creation statements to the database
    conn.commit()
    
    # Close the cursor to free resources
    cur.close()
    
    # Close the database connection
    conn.close()


# ============================================
# SQLALCHEMY TABLE CREATION
# ============================================
# Create tables defined using SQLAlchemy models (like Chat, ActivityLog)
# This complements the raw SQL table creation above
with app.app_context():
    try:
        # Create all tables defined via SQLAlchemy models
        db.create_all()
        print("✅ All database tables created successfully")
    except Exception as e:
        print(f"❌ Database table creation error: {e}")


# ============================================
# INITIALIZE DATABASE ON STARTUP
# ============================================
# Call init_db() when the application starts to ensure
# all tables exist before handling any requests
try:
    init_db()
except Exception as e:
    # If initialization fails, log the error but don't crash the app
    # This allows the app to start even if the database is temporarily unavailable
    print("❌ Database initialization error:", e)


# ============================================
# UTILITY FUNCTIONS
# ============================================

def row_to_dict(row):
    """
    Convert a psycopg2 DictRow to a standard Python dictionary.
    
    This utility function is used throughout the API to convert
    database query results into JSON-serializable dictionaries.
    
    Args:
        row: A psycopg2.extras.DictRow object from a database query
    
    Returns:
        dict: Standard Python dictionary, or None if row is None
    
    Example:
        cur.execute("SELECT * FROM projects WHERE id = 1")
        row = cur.fetchone()
        project_dict = row_to_dict(row)
        return jsonify(project_dict)
    """
    # Handle None/empty results
    if not row:
        return None
    
    # Convert DictRow to standard dict for JSON serialization
    return dict(row)

# ============================================
# FRONTEND ROUTES (DUPLICATE - Already defined above)
# ============================================
# Note: This route is duplicated. The actual frontend routes are defined
# at the top of the file (lines 129-171). This can be safely removed.

@app.route('/')
def index():
    """
    Duplicate route - already defined above as serve_index()
    Serves the main HTML file for the Single Page Application
    """
    return send_from_directory('.', 'index.html')


# ============================================
# API: PROJECTS
# ============================================
# This section implements a full CRUD (Create, Read, Update, Delete) API
# for project management. Projects serve as containers for tasks and provide
# high-level organization for team collaboration.
#
# RESTful Design Pattern:
# - GET    /api/projects          → List all projects
# - POST   /api/projects          → Create new project
# - GET    /api/projects/<id>     → Get single project with tasks
# - PUT    /api/projects/<id>     → Update existing project
# - DELETE /api/projects/<id>     → Delete project (cascades to tasks)
#
# All routes follow REST conventions and return JSON responses.


@app.route('/api/projects', methods=['GET'])
def list_projects():
    """
    Retrieve a list of all projects, ordered by creation date (newest first).
    
    HTTP Method: GET
    URL: /api/projects
    
    Query Parameters: None
    
    Returns:
        JSON array: List of all project objects
        HTTP 200: Success
    
    Response Example:
        [
            {
                "id": 1,
                "name": "Website Redesign",
                "description": "Modernize company website",
                "start_date": "2025-10-01",
                "end_date": "2025-12-31",
                "status": "active",
                "created_at": "2025-10-15T10:30:00",
                "updated_at": "2025-10-15T10:30:00"
            },
            ...
        ]
    
    Error Handling:
        - Database connection errors propagate as 500 Internal Server Error
    """
    # Establish database connection
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Query all projects, ordered by newest first
    cur.execute("SELECT * FROM projects ORDER BY created_at DESC;")
    
    # Fetch all results
    rows = cur.fetchall()
    
    # Convert DictRow objects to standard dictionaries for JSON serialization
    projects = [dict(r) for r in rows]
    
    # Clean up database resources
    cur.close()
    conn.close()
    
    # Return JSON response
    return jsonify(projects)


@app.route('/api/projects', methods=['POST'])
def create_project():
    """
    Create a new project with the provided details.
    
    HTTP Method: POST
    URL: /api/projects
    Content-Type: application/json
    
    Request Body (JSON):
        {
            "name": "Project Name" (REQUIRED),
            "description": "Detailed description" (optional),
            "start_date": "YYYY-MM-DD" (optional),
            "end_date": "YYYY-MM-DD" (optional)
        }
    
    Returns:
        JSON object: The newly created project with auto-generated ID
        HTTP 201: Created successfully
        HTTP 400: Bad request (missing required fields)
    
    Response Example:
        {
            "id": 5,
            "name": "New Mobile App",
            "description": "iOS and Android app",
            "start_date": "2025-11-01",
            "end_date": "2026-02-28",
            "status": "active",
            "created_at": "2025-10-28T03:15:22",
            "updated_at": "2025-10-28T03:15:22"
        }
    
    Side Effects:
        - Logs activity to activity_logg table
        - Auto-generates id, created_at, updated_at
        - Sets default status to 'active'
    """
    # Extract JSON data from request body (default to empty dict if none)
    data = request.get_json() or {}
    
    # Extract individual fields from the request data
    name = data.get('name')
    description = data.get('description')
    start_date = data.get('start_date')
    end_date = data.get('end_date')
    
    # Validate required fields
    if not name:
        return jsonify({"error": "Project name is required"}), 400
    
    # Establish database connection
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Insert new project and return the created record
    # RETURNING * returns the complete row including auto-generated fields
    cur.execute("""
        INSERT INTO projects (name, description, start_date, end_date)
        VALUES (%s, %s, %s, %s) RETURNING *;
    """, (name, description, start_date, end_date))
    
    # Fetch the newly created project
    project = dict(cur.fetchone())
    
    # Commit the transaction to save changes
    conn.commit()
    
    # Clean up database resources
    cur.close()
    conn.close()
    
    # Log the creation activity for audit trail
    # Note: user_id=1 is a placeholder; implement proper authentication in production
    log_activity(user_id=1, action_type="created", object_type="project", object_id=project['id'])
    
    # Return the created project with HTTP 201 Created status
    return jsonify(project), 201


@app.route('/api/projects/<int:project_id>', methods=['GET'])
def get_project(project_id):
    """
    Retrieve a single project by ID, including all associated tasks.
    
    HTTP Method: GET
    URL: /api/projects/<project_id>
    
    URL Parameters:
        project_id (int): The unique identifier of the project
    
    Returns:
        JSON object: Project details with nested tasks array
        HTTP 200: Success
        HTTP 404: Project not found
    
    Response Example:
        {
            "id": 1,
            "name": "Website Redesign",
            "description": "Modernize company website",
            "start_date": "2025-10-01",
            "end_date": "2025-12-31",
            "status": "active",
            "created_at": "2025-10-15T10:30:00",
            "updated_at": "2025-10-15T10:30:00",
            "tasks": [
                {
                    "id": 10,
                    "project_id": 1,
                    "title": "Design homepage mockup",
                    "status": "done",
                    ...
                },
                ...
            ]
        }
    
    Features:
        - Includes all tasks belonging to this project
        - Tasks are ordered by creation date
        - Activity logging disabled to reduce noise
    """
    # Establish database connection
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Query for the specific project
    cur.execute("SELECT * FROM projects WHERE id=%s;", (project_id,))
    project = cur.fetchone()
    
    # Handle project not found
    if not project:
        cur.close()
        conn.close()
        return jsonify({"error": "Project not found"}), 404
    
    # Convert to dictionary
    project = dict(project)
    
    # Fetch all tasks associated with this project
    cur.execute("SELECT * FROM tasks WHERE project_id=%s ORDER BY created_at;", (project_id,))
    tasks = [dict(r) for r in cur.fetchall()]
    
    # Clean up database resources
    cur.close()
    conn.close()
    
    # Add tasks as a nested array in the project object
    project['tasks'] = tasks
    
    # Note: View logging is disabled to reduce noise in activity logs
    # Uncomment the following line to enable:
    # log_activity(user_id=1, action_type="viewed", object_type="project", object_id=project_id)
    
    # Return the complete project with tasks
    return jsonify(project)


@app.route('/api/projects/<int:project_id>', methods=['PUT'])
def update_project(project_id):
    """
    Update an existing project with new values.
    
    HTTP Method: PUT
    URL: /api/projects/<project_id>
    Content-Type: application/json
    
    URL Parameters:
        project_id (int): The unique identifier of the project to update
    
    Request Body (JSON):
        Any combination of these fields:
        {
            "name": "Updated name",
            "description": "Updated description",
            "start_date": "YYYY-MM-DD",
            "end_date": "YYYY-MM-DD",
            "status": "active" or "completed" or "archived"
        }
    
    Returns:
        JSON object: The updated project
        HTTP 200: Success
        HTTP 400: No updatable fields provided
        HTTP 404: Project not found
    
    Features:
        - Partial updates supported (only send fields you want to change)
        - Automatically updates the updated_at timestamp
        - Logs the update activity
        - Dynamic SQL generation for flexible updates
    
    Security Note:
        Only allows updating whitelisted fields (name, description, start_date, end_date, status)
        This prevents malicious updates to system fields like id or created_at
    """
    # Extract JSON data from request body
    data = request.get_json() or {}
    
    # Build dynamic UPDATE query based on provided fields
    fields = []  # Will store "field = %s" strings
    vals = []    # Will store corresponding values
    
    # Only process whitelisted fields for security
    for key in ['name', 'description', 'start_date', 'end_date', 'status']:
        if key in data:
            fields.append(f"{key} = %s")
            vals.append(data[key])
    
    # Validate that at least one field is being updated
    if not fields:
        return jsonify({"error": "No updatable fields provided"}), 400
    
    # Add project_id to the values list (used in WHERE clause)
    vals.append(project_id)
    
    # Construct the dynamic UPDATE SQL
    # Example: "UPDATE projects SET name = %s, status = %s, updated_at = now() WHERE id = %s RETURNING *;"
    cur_sql = "UPDATE projects SET " + ", ".join(fields) + ", updated_at = now() WHERE id = %s RETURNING *;"
    
    # Establish database connection
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Execute the update query
    cur.execute(cur_sql, tuple(vals))
    
    # Fetch the updated record
    updated = cur.fetchone()
    
    # Handle project not found
    if not updated:
        cur.close()
        conn.close()
        return jsonify({"error": "Project not found"}), 404
    
    # Commit the transaction
    conn.commit()
    
    # Convert to dictionary
    project = dict(updated)
    
    # Clean up database resources
    cur.close()
    conn.close()
    
    # Log the update activity
    log_activity(user_id=1, action_type="updated", object_type="project", object_id=project_id)
    
    # Return the updated project
    return jsonify(project)


@app.route('/api/projects/<int:project_id>', methods=['DELETE'])
def delete_project(project_id):
    """
    Delete a project and all associated tasks (cascade delete).
    
    HTTP Method: DELETE
    URL: /api/projects/<project_id>
    
    URL Parameters:
        project_id (int): The unique identifier of the project to delete
    
    Returns:
        JSON object: Confirmation message with deleted project ID
        HTTP 200: Success
        HTTP 404: Project not found
    
    Response Example:
        {
            "message": "Project deleted successfully",
            "id": 5
        }
    
    Side Effects:
        - Permanently deletes the project from the database
        - Cascades deletion to all associated tasks (due to ON DELETE CASCADE)
        - Cascades deletion to all attachments on those tasks
        - Logs the deletion activity
        - This operation is IRREVERSIBLE
    
    Warning:
        This is a destructive operation. Consider implementing soft deletes
        (status = 'deleted') in production for data recovery.
    """
    # Establish database connection
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Delete the project and return its ID to confirm deletion
    # RETURNING id ensures we know which project was actually deleted
    cur.execute("DELETE FROM projects WHERE id=%s RETURNING id;", (project_id,))
    deleted = cur.fetchone()
    
    # Commit the transaction
    conn.commit()
    
    # Clean up database resources
    cur.close()
    conn.close()
    
    # Handle project not found
    if not deleted:
        return jsonify({"error": "Project not found"}), 404
    log_activity(user_id=1, action_type="deleted", object_type="project", object_id=project_id)
    return jsonify({"deleted": True, "id": deleted[0]})

# --------- API: Tasks ----------
@app.route('/api/tasks', methods=['GET'])
def list_tasks():
    project_id = request.args.get('project_id')
    conn = get_db_connection()
    cur = conn.cursor()
    if project_id:
        cur.execute("SELECT * FROM tasks WHERE project_id=%s ORDER BY created_at;", (project_id,))
    else:
        cur.execute("SELECT * FROM tasks ORDER BY created_at DESC;")
    tasks = [dict(r) for r in cur.fetchall()]
    cur.close()
    conn.close()
    return jsonify(tasks)

@app.route('/api/tasks', methods=['POST'])
def create_task():
    data = request.get_json() or {}
    required = ['project_id', 'title']
    for r in required:
        if r not in data:
            return jsonify({"error": f"{r} is required"}), 400
    project_id = data.get('project_id')
    title = data.get('title')
    description = data.get('description')
    assigned_to = data.get('assigned_to')
    status = data.get('status', 'todo')
    priority = data.get('priority', 3)
    due_date = data.get('due_date')
    parent_task_id = data.get('parent_task_id')
    depends_on_task_id = data.get('depends_on_task_id')

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO tasks (project_id, title, description, assigned_to, status, priority, due_date, parent_task_id, depends_on_task_id)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *;
    """, (project_id, title, description, assigned_to, status, priority, due_date, parent_task_id, depends_on_task_id))
    task = dict(cur.fetchone())
    conn.commit()
    cur.close()
    conn.close()
    log_activity(user_id=1, action_type="created", object_type="task", object_id=task['id'])
    return jsonify(task), 201

@app.route('/api/tasks/<int:task_id>', methods=['GET'])
def get_task(task_id):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM tasks WHERE id=%s;", (task_id,))
    t = cur.fetchone()
    if not t:
        cur.close()
        conn.close()
        return jsonify({"error": "Task not found"}), 404
    task = dict(t)
    # attach subtasks
    cur.execute("SELECT * FROM tasks WHERE parent_task_id=%s ORDER BY created_at;", (task_id,))
    subtasks = [dict(r) for r in cur.fetchall()]
    # attachments list
    cur.execute("SELECT id, filename, uploaded_at, uploaded_by FROM attachments WHERE task_id=%s ORDER BY uploaded_at;", (task_id,))
    attachments = [dict(r) for r in cur.fetchall()]
    cur.close()
    conn.close()
    task['subtasks'] = subtasks
    task['attachments'] = attachments
    return jsonify(task)

@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    data = request.get_json() or {}
    fields = []
    vals = []
    allowed = ['title','description','assigned_to','status','priority','due_date','parent_task_id','depends_on_task_id']
    for key in allowed:
        if key in data:
            fields.append(f"{key} = %s")
            vals.append(data[key])
    if not fields:
        return jsonify({"error": "No updatable fields provided"}), 400
    vals.append(task_id)
    sql = "UPDATE tasks SET " + ", ".join(fields) + ", updated_at = now() WHERE id = %s RETURNING *;"
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(sql, tuple(vals))
    updated = cur.fetchone()
    if not updated:
        cur.close()
        conn.close()
        return jsonify({"error": "Task not found"}), 404
    conn.commit()
    task = dict(updated)
    cur.close()
    conn.close()
    log_activity(user_id=1, action_type="updated", object_type="task", object_id=task_id)
    return jsonify(task)

@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM tasks WHERE id=%s RETURNING id;", (task_id,))
    deleted = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    if not deleted:
        return jsonify({"error": "Task not found"}), 404
    log_activity(user_id=1, action_type="deleted", object_type="task", object_id=task_id)
    return jsonify({"deleted": True, "id": deleted[0]})

# Subtasks creation (alternative endpoint)
@app.route('/api/tasks/<int:task_id>/subtasks', methods=['POST'])
def create_subtask(task_id):
    data = request.get_json() or {}
    # treat parent_task_id as task_id
    data['parent_task_id'] = task_id
    data.setdefault('project_id', None)
    # ensure project_id set (fetch from parent)
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT project_id FROM tasks WHERE id=%s;", (task_id,))
    parent = cur.fetchone()
    if not parent:
        cur.close()
        conn.close()
        return jsonify({"error": "Parent task not found"}), 404
    parent_project = parent['project_id']
    data['project_id'] = parent_project
    cur.close()
    conn.close()
    # reuse create_task logic by calling the endpoint handler internally (simple approach)
    log_activity(user_id=1, action_type="created", object_type="task", object_id=task_id)
    return create_task()

# --------- API: Attachments (store in Postgres) ----------
@app.route('/api/tasks/<int:task_id>/attachments', methods=['POST'])
def upload_attachment(task_id):
    """
    Expects multipart/form-data with 'file' and optional 'uploaded_by'
    Stores file content in attachments.content (bytea)
    """
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400

        file = request.files['file']
        filename = secure_filename(file.filename)
        content = file.read()
        content_type = file.content_type or 'application/octet-stream'
        uploaded_by = request.form.get('uploaded_by')

        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT id FROM tasks WHERE id=%s;", (task_id,))
        if not cur.fetchone():
            cur.close()
            conn.close()
            return jsonify({"error": "Task not found"}), 404

        cur.execute("""
            INSERT INTO attachments (task_id, filename, content_type, content, uploaded_by)
            VALUES (%s, %s, %s, %s, %s) RETURNING id, filename, uploaded_at, uploaded_by;
        """, (task_id, filename, content_type, psycopg2.Binary(content), uploaded_by))
        att = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        log_activity(user_id=1, action_type="created", object_type="attachment", object_id=att[0])
        return jsonify({"id": att[0], "filename": att[1], "uploaded_at": att[2].isoformat(), "uploaded_by": att[3]}), 201

    except Exception as e:
        return jsonify({"error": f"Upload failed: {str(e)}"}), 500

@app.route('/api/tasks/<int:task_id>/attachments', methods=['GET'])
def list_attachments(task_id):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, filename, content_type, uploaded_at, uploaded_by FROM attachments WHERE task_id=%s ORDER BY uploaded_at;", (task_id,))
    items = [dict(r) for r in cur.fetchall()]
    cur.close()
    conn.close()
    return jsonify(items)

@app.route('/api/attachments/<int:attachment_id>', methods=['GET'])
def download_attachment(attachment_id):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT filename, content_type, content FROM attachments WHERE id=%s;", (attachment_id,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    if not row:
        return jsonify({"error": "Attachment not found"}), 404
    filename = row['filename']
    content_type = row['content_type'] or 'application/octet-stream'
    content = bytes(row['content'])
    # stream the file
    return send_file(
        io.BytesIO(content),
        as_attachment=True,
        download_name=filename,
        mimetype=content_type
    )

@app.route('/api/attachments/<int:attachment_id>', methods=['DELETE'])
def delete_attachment(attachment_id):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM attachments WHERE id=%s RETURNING id;", (attachment_id,))
    deleted = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    if not deleted:
        return jsonify({"error": "Attachment not found"}), 404
    log_activity(user_id=1, action_type="deleted", object_type="attachment", object_id=attachment_id)
    return jsonify({"deleted": True, "id": deleted[0]})

# --------- API: All Attachments (for frontend convenience) ----------
@app.route('/api/attachments', methods=['GET'])
def list_all_attachments():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT
            a.id, a.task_id, a.filename, a.uploaded_at, a.uploaded_by, a.content_type,
            t.title as task_title, t.project_id,
            p.name as project_name
        FROM attachments a
        LEFT JOIN tasks t ON a.task_id = t.id
        LEFT JOIN projects p ON t.project_id = p.id
        ORDER BY a.uploaded_at DESC;
    """)
    rows = cur.fetchall()
    items = [dict(r) for r in rows]
    cur.close()
    conn.close()
    return jsonify(items)

# --------- Helper endpoints ----------
@app.route('/api/init', methods=['POST'])
def api_init():
    """Manual trigger to re-run DB init (safe to call)."""
    try:
        init_db()
        log_activity(user_id=1, action_type="created", object_type="system", object_id=0)
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --------- API: Activity Logs ----------
@app.route('/api/activity', methods=['GET'])
def get_activity_logs():
    """
    Returns comprehensive activity logs with detailed metadata
    Includes project names, task details, status, priority, and user information
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Get activity logs with detailed information
        cur.execute("""
            SELECT 
                a.id,
                a.action_type,
                a.object_type,
                a.object_id,
                a.timestamp,
                a.user_id,
                -- Project details (if applicable)
                p.name as project_name,
                p.description as project_description,
                p.status as project_status,
                -- Task details (if applicable)
                t.title as task_title,
                t.description as task_description,
                t.status as task_status,
                t.priority as task_priority,
                t.assigned_to as task_assigned_to,
                t.due_date as task_due_date,
                t.project_id as task_project_id,
                -- Parent project name for tasks
                tp.name as task_project_name,
                -- Attachment details (if applicable)
                att.filename as attachment_filename,
                att.uploaded_by as attachment_uploaded_by,
                -- Chat details (if applicable)
                c.name as chat_user_name,
                c.message as chat_message
            FROM activity_logg a
            LEFT JOIN projects p ON a.object_type = 'project' AND a.object_id = p.id
            LEFT JOIN tasks t ON a.object_type = 'task' AND a.object_id = t.id
            LEFT JOIN projects tp ON t.project_id = tp.id
            LEFT JOIN attachments att ON a.object_type = 'attachment' AND a.object_id = att.id
            LEFT JOIN chat c ON a.object_type = 'chat' AND a.object_id = c.id
            ORDER BY a.timestamp DESC
            LIMIT 100
        """)
        rows = cur.fetchall()
        cur.close()
        conn.close()

        logs = []
        for r in rows:
            log = {
                "id": r['id'],
                "action_type": r['action_type'],
                "object_type": r['object_type'],
                "object_id": r['object_id'],
                "timestamp": r['timestamp'].isoformat() if r['timestamp'] else None,
                "user_id": r['user_id']
            }
            
            # Add detailed metadata based on object type
            if r['object_type'] == 'project':
                log['description'] = r['project_description'] or ''
                log['status'] = r['project_status'] or ''
                log['project_name'] = r['project_name'] or ''
                
            elif r['object_type'] == 'task':
                log['description'] = r['task_description'] or ''
                log['status'] = r['task_status'] or 'todo'
                log['priority'] = r['task_priority'] or 3
                log['assigned_to'] = r['task_assigned_to'] or ''
                log['due_date'] = str(r['task_due_date']) if r['task_due_date'] else None
                log['project_id'] = r['task_project_id']
                log['project_name'] = r['task_project_name'] or ''
                
            elif r['object_type'] == 'attachment':
                log['description'] = f"File: {r['attachment_filename']}" if r['attachment_filename'] else ''
                log['uploaded_by'] = r['attachment_uploaded_by'] or ''
                
            elif r['object_type'] == 'chat':
                log['description'] = r['chat_message'] or ''
                log['user_name'] = r['chat_user_name'] or 'Unknown'
                
            logs.append(log)
        
        print(f"✅ Returning {len(logs)} activity logs with detailed metadata")
        return jsonify(logs), 200

    except Exception as e:
        print(f"❌ Error fetching activity logs: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Failed to fetch logs"}), 500


@app.route('/api/activity/clear', methods=['DELETE'])
def clear_all_activity_logs():
    """
    Clears all activity logs from the database
    Returns the count of deleted records
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Count existing logs before deletion
        cur.execute("SELECT COUNT(*) as count FROM activity_logg")
        count_result = cur.fetchone()
        deleted_count = count_result['count'] if count_result else 0
        
        # Delete all activity logs
        cur.execute("DELETE FROM activity_logg")
        conn.commit()
        cur.close()
        conn.close()
        
        print(f"✅ Cleared {deleted_count} activity logs from database")
        return jsonify({
            "success": True,
            "deleted_count": deleted_count,
            "message": f"Successfully cleared {deleted_count} activity logs"
        }), 200
        
    except Exception as e:
        print(f"❌ Error clearing activity logs: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Failed to clear activity logs"}), 500


# ============================================
# API: EVENTS
# ============================================

@app.route('/api/events', methods=['GET'])
def list_events():
    """
    GET ALL EVENTS ENDPOINT
    
    Purpose: Retrieve all events from the database
    Method: GET
    URL: /api/events
    
    Returns:
        - 200: JSON array of all events, sorted by event_date (descending - newest first)
        - 500: Error message if database query fails
    
    Response Format:
        [
            {
                "id": 1,
                "event_name": "Hackathon 2025",
                "organisation": "TechCorp",
                "platform": "Devfolio",
                "team_size": 4,
                "team_slots_available": 2,
                "added_by": "John Doe",
                "event_date": "2025-01-15",
                "team_members": "Alice, Bob, Charlie",
                "created_at": "2025-01-01T10:00:00",
                "updated_at": "2025-01-01T10:00:00"
            },
            ...
        ]
    """
    try:
        # Establish connection to PostgreSQL database
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Execute SQL query to fetch all events
        # ORDER BY event_date DESC ensures most recent/upcoming events appear first
        cur.execute("""
            SELECT id, event_name, organisation, platform, team_size, 
                   team_slots_available, added_by, event_date, team_members,
                   created_at, updated_at
            FROM events
            ORDER BY event_date DESC
        """)
        
        # Fetch all rows from the query result
        rows = cur.fetchall()
        
        # Close database cursor and connection to free resources
        cur.close()
        conn.close()
        
        # Build the response array by transforming database rows into JSON-serializable dictionaries
        events = []
        for r in rows:
            events.append({
                'id': r['id'],
                'event_name': r['event_name'],
                'organisation': r['organisation'],
                'platform': r['platform'],
                'team_size': r['team_size'],
                'team_slots_available': r['team_slots_available'],
                'added_by': r['added_by'],
                # Convert date objects to ISO format strings for JSON serialization
                'event_date': r['event_date'].isoformat() if r['event_date'] else None,
                'team_members': r['team_members'],
                # Convert timestamp objects to ISO format strings
                'created_at': r['created_at'].isoformat() if r['created_at'] else None,
                'updated_at': r['updated_at'].isoformat() if r['updated_at'] else None
            })
        
        # Return the events array as JSON with 200 OK status
        return jsonify(events), 200
        
    except Exception as e:
        # Log the error with full stack trace for debugging
        logging.error(f"Error fetching events: {e}", exc_info=True)
        # Return error message to client with 500 Internal Server Error status
        return jsonify({"error": str(e)}), 500


@app.route('/api/events', methods=['POST'])
def create_event():
    """
    CREATE NEW EVENT ENDPOINT
    
    Purpose: Insert a new event into the database
    Method: POST
    URL: /api/events
    
    Request Body (JSON):
        {
            "event_name": "string (REQUIRED)",
            "organisation": "string (optional)",
            "platform": "string (optional)",
            "team_size": integer (optional),
            "team_slots_available": integer (optional),
            "added_by": "string (REQUIRED)",
            "event_date": "YYYY-MM-DD (REQUIRED)",
            "team_members": "comma-separated string (optional)"
        }
    
    Returns:
        - 201: JSON object of created event
        - 400: Validation error if required fields are missing
        - 500: Server error if database insert fails
    
    Side Effects:
        - Creates activity log entry for the new event
    """
    try:
        # Parse JSON data from request body, default to empty dict if no data
        data = request.get_json() or {}
        
        # ========================================
        # VALIDATION: Check all required fields
        # ========================================
        # event_name is required - cannot create an event without a name
        if not data.get('event_name'):
            return jsonify({"error": "Event name is required"}), 400
        
        # added_by is required - we need to know who created this event
        if not data.get('added_by'):
            return jsonify({"error": "Added by is required"}), 400
        
        # event_date is required - every event must have a date
        if not data.get('event_date'):
            return jsonify({"error": "Event date is required"}), 400
        
        # ========================================
        # DATABASE INSERT
        # ========================================
        conn = get_db_connection()
        cur = conn.cursor()
        
        # INSERT query with RETURNING clause to get the newly created record
        # This is more efficient than doing INSERT then SELECT
        cur.execute("""
            INSERT INTO events (event_name, organisation, platform, team_size, 
                               team_slots_available, added_by, event_date, team_members)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, event_name, organisation, platform, team_size, 
                      team_slots_available, added_by, event_date, team_members,
                      created_at, updated_at
        """, (
            data.get('event_name'),
            data.get('organisation'),
            data.get('platform'),
            data.get('team_size'),  # Will be NULL if not provided
            data.get('team_slots_available'),  # Will be NULL if not provided
            data.get('added_by'),
            data.get('event_date'),
            data.get('team_members')  # Will be NULL if not provided
        ))
        
        # Fetch the newly created row returned by RETURNING clause
        row = cur.fetchone()
        
        # Commit the transaction to save changes to database
        conn.commit()
        
        # ========================================
        # BUILD RESPONSE OBJECT
        # ========================================
        # Transform the database row into a JSON-serializable dictionary
        event = {
            'id': row['id'],
            'event_name': row['event_name'],
            'organisation': row['organisation'],
            'platform': row['platform'],
            'team_size': row['team_size'],
            'team_slots_available': row['team_slots_available'],
            'added_by': row['added_by'],
            # Convert date/timestamp objects to ISO format strings
            'event_date': row['event_date'].isoformat() if row['event_date'] else None,
            'team_members': row['team_members'],
            'created_at': row['created_at'].isoformat() if row['created_at'] else None,
            'updated_at': row['updated_at'].isoformat() if row['updated_at'] else None
        }
        
        # Clean up database resources
        cur.close()
        conn.close()
        
        # ========================================
        # ACTIVITY LOGGING
        # ========================================
        # Log this creation action for audit trail and activity feed
        # user_id=1 is used as a placeholder (in production, use actual authenticated user)
        log_activity(user_id=1, action_type="created", object_type="event", object_id=event['id'])
        
        # Return the created event with 201 Created status
        return jsonify(event), 201
        
    except Exception as e:
        # Log any errors with full stack trace for debugging
        logging.error(f"Error creating event: {e}", exc_info=True)
        # Return error message to client
        return jsonify({"error": str(e)}), 500


@app.route('/api/events/<int:event_id>', methods=['GET'])
def get_event(event_id):
    """
    GET SINGLE EVENT BY ID ENDPOINT
    
    Purpose: Retrieve a specific event's details
    Method: GET
    URL: /api/events/<event_id>
    
    URL Parameters:
        - event_id: Integer ID of the event to retrieve
    
    Returns:
        - 200: JSON object of the requested event
        - 404: Error if event with given ID doesn't exist
        - 500: Server error if database query fails
    
    Use Case: Used when editing an event to populate the form with existing data
    """
    try:
        # Connect to database
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Query for specific event by ID using parameterized query (prevents SQL injection)
        cur.execute("""
            SELECT id, event_name, organisation, platform, team_size, 
                   team_slots_available, added_by, event_date, team_members,
                   created_at, updated_at
            FROM events
            WHERE id = %s
        """, (event_id,))
        
        # Fetch single row (returns None if no match found)
        row = cur.fetchone()
        
        # Clean up database resources
        cur.close()
        conn.close()
        
        # Check if event exists - return 404 if not found
        if not row:
            return jsonify({"error": "Event not found"}), 404
        
        # Build response object by transforming database row to dict
        event = {
            'id': row['id'],
            'event_name': row['event_name'],
            'organisation': row['organisation'],
            'platform': row['platform'],
            'team_size': row['team_size'],
            'team_slots_available': row['team_slots_available'],
            'added_by': row['added_by'],
            # Convert date/timestamp to ISO format string for JSON
            'event_date': row['event_date'].isoformat() if row['event_date'] else None,
            'team_members': row['team_members'],
            'created_at': row['created_at'].isoformat() if row['created_at'] else None,
            'updated_at': row['updated_at'].isoformat() if row['updated_at'] else None
        }
        
        # Return event data with 200 OK status
        return jsonify(event), 200
        
    except Exception as e:
        # Log error and return error message
        logging.error(f"Error fetching event: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@app.route('/api/events/<int:event_id>', methods=['PUT'])
def update_event(event_id):
    """
    UPDATE EXISTING EVENT ENDPOINT
    
    Purpose: Modify an existing event's details
    Method: PUT
    URL: /api/events/<event_id>
    
    URL Parameters:
        - event_id: Integer ID of the event to update
    
    Request Body (JSON): Same format as POST /api/events
        All fields are sent, even if only some are changed
    
    Returns:
        - 200: JSON object of updated event
        - 400: Validation error if required fields are missing
        - 404: Error if event with given ID doesn't exist
        - 500: Server error if database update fails
    
    Side Effects:
        - Updates the updated_at timestamp automatically
        - Creates activity log entry for the update
    """
    try:
        # Parse request body JSON data
        data = request.get_json() or {}
        
        # ========================================
        # VALIDATION: Same validation as create
        # ========================================
        # event_name is required
        if not data.get('event_name'):
            return jsonify({"error": "Event name is required"}), 400
        
        # added_by is required
        if not data.get('added_by'):
            return jsonify({"error": "Added by is required"}), 400
        
        # event_date is required
        if not data.get('event_date'):
            return jsonify({"error": "Event date is required"}), 400
        
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            UPDATE events 
            SET event_name = %s, organisation = %s, platform = %s, 
                team_size = %s, team_slots_available = %s, added_by = %s, 
                event_date = %s, team_members = %s, updated_at = now()
            WHERE id = %s
            RETURNING id, event_name, organisation, platform, team_size, 
                      team_slots_available, added_by, event_date, team_members,
                      created_at, updated_at
        """, (
            data.get('event_name'),
            data.get('organisation'),
            data.get('platform'),
            data.get('team_size'),
            data.get('team_slots_available'),
            data.get('added_by'),
            data.get('event_date'),
            data.get('team_members'),
            event_id
        ))
        row = cur.fetchone()
        conn.commit()
        
        if not row:
            cur.close()
            conn.close()
            return jsonify({"error": "Event not found"}), 404
        
        event = {
            'id': row['id'],
            'event_name': row['event_name'],
            'organisation': row['organisation'],
            'platform': row['platform'],
            'team_size': row['team_size'],
            'team_slots_available': row['team_slots_available'],
            'added_by': row['added_by'],
            'event_date': row['event_date'].isoformat() if row['event_date'] else None,
            'team_members': row['team_members'],
            'created_at': row['created_at'].isoformat() if row['created_at'] else None,
            'updated_at': row['updated_at'].isoformat() if row['updated_at'] else None
        }
        
        cur.close()
        conn.close()
        
        # Log activity
        log_activity(user_id=1, action_type="updated", object_type="event", object_id=event_id)
        
        return jsonify(event), 200
    except Exception as e:
        logging.error(f"Error updating event: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@app.route('/api/events/<int:event_id>', methods=['DELETE'])
def delete_event(event_id):
    """
    DELETE EVENT ENDPOINT
    
    Purpose: Permanently remove an event from the database
    Method: DELETE
    URL: /api/events/<event_id>
    
    URL Parameters:
        - event_id: Integer ID of the event to delete
    
    Returns:
        - 200: Success confirmation with deleted event ID
        - 404: Error if event with given ID doesn't exist
        - 500: Server error if database delete fails
    
    Side Effects:
        - Permanently removes event from database (cannot be undone)
        - Creates activity log entry for the deletion
    
    Security Note:
        - Frontend should confirm deletion with user before calling this
    """
    try:
        # Connect to database
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Execute DELETE with RETURNING clause to confirm deletion
        # If no rows match, deleted will be None
        cur.execute("DELETE FROM events WHERE id = %s RETURNING id", (event_id,))
        deleted = cur.fetchone()
        
        # Commit the transaction to make deletion permanent
        conn.commit()
        
        # Clean up database resources
        cur.close()
        conn.close()
        
        # Check if event was found and deleted
        if not deleted:
            return jsonify({"error": "Event not found"}), 404
        
        # ========================================
        # ACTIVITY LOGGING
        # ========================================
        # Log the deletion action for audit trail
        log_activity(user_id=1, action_type="deleted", object_type="event", object_id=event_id)
        
        # Return success confirmation
        return jsonify({"deleted": True, "id": deleted['id']}), 200
        
    except Exception as e:
        # Log error and return error message
        logging.error(f"Error deleting event: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


# ============================================
# API: IDEAS
# ============================================

@app.route('/api/ideas', methods=['GET'])
def list_ideas():
    """Get all ideas"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT id, idea_title, idea_description, added_by, likes, 
                   comments, attachments, status, priority,
                   created_at, updated_at
            FROM ideas
            ORDER BY created_at DESC
        """)
        rows = cur.fetchall()
        cur.close()
        conn.close()
        
        ideas = []
        for r in rows:
            ideas.append({
                'id': r['id'],
                'idea_title': r['idea_title'],
                'idea_description': r['idea_description'],
                'added_by': r['added_by'],
                'likes': r['likes'] or '',
                'comments': r['comments'] if r['comments'] else [],
                'attachments': r['attachments'] if r['attachments'] else [],
                'status': r['status'],
                'priority': r['priority'],
                'created_at': r['created_at'].isoformat() if r['created_at'] else None,
                'updated_at': r['updated_at'].isoformat() if r['updated_at'] else None
            })
        return jsonify(ideas), 200
    except Exception as e:
        logging.error(f"Error fetching ideas: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@app.route('/api/ideas', methods=['POST'])
def create_idea():
    """Create a new idea"""
    try:
        data = request.get_json() or {}
        
        # Validate required fields
        if not data.get('idea_title'):
            return jsonify({"error": "Idea title is required"}), 400
        if not data.get('idea_description'):
            return jsonify({"error": "Idea description is required"}), 400
        if not data.get('added_by'):
            return jsonify({"error": "Added by is required"}), 400
        
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO ideas (idea_title, idea_description, added_by, likes,
                              comments, attachments, status, priority)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, idea_title, idea_description, added_by, likes,
                      comments, attachments, status, priority,
                      created_at, updated_at
        """, (
            data.get('idea_title'),
            data.get('idea_description'),
            data.get('added_by'),
            data.get('likes', ''),
            json.dumps(data.get('comments', [])),
            json.dumps(data.get('attachments', [])),
            data.get('status', 'proposed'),
            data.get('priority', 'medium')
        ))
        row = cur.fetchone()
        conn.commit()
        
        idea = {
            'id': row['id'],
            'idea_title': row['idea_title'],
            'idea_description': row['idea_description'],
            'added_by': row['added_by'],
            'likes': row['likes'] or '',
            'comments': row['comments'] if row['comments'] else [],
            'attachments': row['attachments'] if row['attachments'] else [],
            'status': row['status'],
            'priority': row['priority'],
            'created_at': row['created_at'].isoformat() if row['created_at'] else None,
            'updated_at': row['updated_at'].isoformat() if row['updated_at'] else None
        }
        
        cur.close()
        conn.close()
        
        log_activity(user_id=1, action_type="created", object_type="idea", object_id=idea['id'])
        
        return jsonify(idea), 201
    except Exception as e:
        logging.error(f"Error creating idea: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@app.route('/api/ideas/<int:idea_id>', methods=['GET'])
def get_idea(idea_id):
    """Get a single idea by ID"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT id, idea_title, idea_description, added_by, likes,
                   comments, attachments, status, priority,
                   created_at, updated_at
            FROM ideas
            WHERE id = %s
        """, (idea_id,))
        row = cur.fetchone()
        cur.close()
        conn.close()
        
        if not row:
            return jsonify({"error": "Idea not found"}), 404
        
        idea = {
            'id': row['id'],
            'idea_title': row['idea_title'],
            'idea_description': row['idea_description'],
            'added_by': row['added_by'],
            'likes': row['likes'] or '',
            'comments': row['comments'] if row['comments'] else [],
            'attachments': row['attachments'] if row['attachments'] else [],
            'status': row['status'],
            'priority': row['priority'],
            'created_at': row['created_at'].isoformat() if row['created_at'] else None,
            'updated_at': row['updated_at'].isoformat() if row['updated_at'] else None
        }
        return jsonify(idea), 200
    except Exception as e:
        logging.error(f"Error fetching idea: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@app.route('/api/ideas/<int:idea_id>', methods=['PUT'])
def update_idea(idea_id):
    """Update an existing idea"""
    try:
        data = request.get_json() or {}
        
        # Validate required fields
        if not data.get('idea_title'):
            return jsonify({"error": "Idea title is required"}), 400
        if not data.get('idea_description'):
            return jsonify({"error": "Idea description is required"}), 400
        if not data.get('added_by'):
            return jsonify({"error": "Added by is required"}), 400
        
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            UPDATE ideas 
            SET idea_title = %s, idea_description = %s, added_by = %s,
                likes = %s, comments = %s, attachments = %s,
                status = %s, priority = %s, updated_at = now()
            WHERE id = %s
            RETURNING id, idea_title, idea_description, added_by, likes,
                      comments, attachments, status, priority,
                      created_at, updated_at
        """, (
            data.get('idea_title'),
            data.get('idea_description'),
            data.get('added_by'),
            data.get('likes', ''),
            json.dumps(data.get('comments', [])),
            json.dumps(data.get('attachments', [])),
            data.get('status', 'proposed'),
            data.get('priority', 'medium'),
            idea_id
        ))
        row = cur.fetchone()
        conn.commit()
        
        if not row:
            cur.close()
            conn.close()
            return jsonify({"error": "Idea not found"}), 404
        
        idea = {
            'id': row['id'],
            'idea_title': row['idea_title'],
            'idea_description': row['idea_description'],
            'added_by': row['added_by'],
            'likes': row['likes'] or '',
            'comments': row['comments'] if row['comments'] else [],
            'attachments': row['attachments'] if row['attachments'] else [],
            'status': row['status'],
            'priority': row['priority'],
            'created_at': row['created_at'].isoformat() if row['created_at'] else None,
            'updated_at': row['updated_at'].isoformat() if row['updated_at'] else None
        }
        
        cur.close()
        conn.close()
        
        log_activity(user_id=1, action_type="updated", object_type="idea", object_id=idea_id)
        
        return jsonify(idea), 200
    except Exception as e:
        logging.error(f"Error updating idea: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@app.route('/api/ideas/<int:idea_id>', methods=['DELETE'])
def delete_idea(idea_id):
    """Delete an idea"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM ideas WHERE id = %s RETURNING id", (idea_id,))
        deleted = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        
        if not deleted:
            return jsonify({"error": "Idea not found"}), 404
        
        log_activity(user_id=1, action_type="deleted", object_type="idea", object_id=idea_id)
        
        return jsonify({"deleted": True, "id": deleted['id']}), 200
    except Exception as e:
        logging.error(f"Error deleting idea: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@app.route('/chat/send', methods=['POST'])
def send_message():
    try:
        data = request.json
        if not data or 'message' not in data:
            return jsonify({'error': 'Missing message'}), 400
        
        # Use "Unknown" if name is empty or not provided
        name = data.get('name', '').strip() or 'Unknown'
        message = data['message'].strip()
        
        if not message:
            return jsonify({'error': 'Message cannot be empty'}), 400
        
        new_message = Chat(name=name, message=message)
        db.session.add(new_message)
        db.session.commit()
        
        # Log chat activity
        log_activity(user_id=1, action_type="created", object_type="chat", object_id=new_message.id)
        
        return jsonify({"status": "success", "message": new_message.to_dict()})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/chat/get')
def get_messages():
    try:
        messages = Chat.query.order_by(Chat.time.desc()).all()
        return jsonify({"status": "success", "messages": [m.to_dict() for m in messages]})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/chat/delete/<int:message_id>', methods=['DELETE'])
def delete_message(message_id):
    try:
        message = Chat.query.get(message_id)
        if not message:
            return jsonify({"error": "Message not found"}), 404
        
        db.session.delete(message)
        db.session.commit()
        
        # Log chat deletion activity
        log_activity(user_id=1, action_type="deleted", object_type="chat", object_id=message_id)
        
        return jsonify({"status": "success", "message": "Message deleted"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500



@app.route('/api/graph')
def get_graph():
    """
    Enhanced graph API with rich metadata for interactive click-to-edit functionality
    Returns comprehensive node and edge data for Cytoscape.js visualization
    """
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()

            # Get projects with full details for editing
            cur.execute("""
                SELECT id, name, description, start_date, end_date, status, created_at, updated_at 
                FROM projects 
                ORDER BY name;
            """)
            projects = cur.fetchall()

            # Get tasks with full details including priority and assignments
            cur.execute("""
                SELECT id, title, description, status, priority, assigned_to, due_date,
                       project_id, parent_task_id, depends_on_task_id, created_at, updated_at
                FROM tasks 
                ORDER BY priority, title;
            """)
            tasks = cur.fetchall()

        elements = []
        
        print(f"📊 GRAPH API: Building graph with {len(projects)} projects and {len(tasks)} tasks")

        # Project nodes with rich metadata
        for project in projects:
            elements.append({
                'data': {
                    'id': f'project-{project["id"]}',
                    'label': project['name'],
                    'type': 'project',
                    # Metadata for editing
                    'description': project.get('description', ''),
                    'start_date': str(project['start_date']) if project.get('start_date') else None,
                    'end_date': str(project['end_date']) if project.get('end_date') else None,
                    'status': project.get('status', 'active'),
                    'created_at': str(project['created_at']) if project.get('created_at') else None,
                    # For tooltips
                    'tooltip': f"📁 {project['name']}\nStatus: {project.get('status', 'active')}\nClick to edit"
                }
            })

        # Task nodes with rich metadata
        for task in tasks:
            # Enhanced color mapping based on status
            color_map = {
                'todo': '#3b82f6',          # Blue
                'in_progress': '#f59e0b',   # Orange
                'done': '#10b981',          # Green
                'blocked': '#ef4444',       # Red
                'overdue': '#dc2626'        # Dark Red
            }
            color = color_map.get(task['status'], '#6b7280')
            
            # Priority color for additional context
            priority_map = {
                1: '#e53e3e',  # Urgent - Red
                2: '#fb923c',  # High - Orange
                3: '#fbbf24',  # Medium - Yellow
                4: '#60a5fa',  # Low - Blue
                5: '#9ca3af'   # Minimal - Gray
            }
            priority_color = priority_map.get(task.get('priority', 3), '#fbbf24')

            elements.append({
                'data': {
                    'id': f'task-{task["id"]}',
                    'label': task['title'],
                    'type': 'task',
                    # Core data
                    'status': task['status'],
                    'color': color,
                    'priority': task.get('priority', 3),
                    'priority_color': priority_color,
                    # Metadata for editing
                    'description': task.get('description', ''),
                    'assigned_to': task.get('assigned_to', ''),
                    'due_date': str(task['due_date']) if task.get('due_date') else None,
                    'project_id': task.get('project_id'),
                    'parent_task_id': task.get('parent_task_id'),
                    'depends_on_task_id': task.get('depends_on_task_id'),
                    # For tooltips
                    'tooltip': f"✓ {task['title']}\nStatus: {task['status']}\nPriority: {task.get('priority', 3)}\nAssigned: {task.get('assigned_to', 'Unassigned')}\nClick to edit"
                }
            })

            # Project to task edges (belongs_to relationship)
            if task['project_id']:
                elements.append({
                    'data': {
                        'id': f"edge-project-{task['project_id']}-task-{task['id']}",
                        'source': f'project-{task["project_id"]}',
                        'target': f'task-{task["id"]}',
                        'type': 'belongs_to',
                        'label': 'belongs to'
                    }
                })

            # Parent task to subtask edges
            if task['parent_task_id']:
                elements.append({
                    'data': {
                        'id': f"edge-parent-{task['parent_task_id']}-child-{task['id']}",
                        'source': f'task-{task["parent_task_id"]}',
                        'target': f'task-{task["id"]}',
                        'type': 'subtask',
                        'label': 'subtask'
                    }
                })

            # Dependency edges
            if task['depends_on_task_id']:
                elements.append({
                    'data': {
                        'id': f"edge-depends-{task['depends_on_task_id']}-on-{task['id']}",
                        'source': f'task-{task["depends_on_task_id"]}',
                        'target': f'task-{task["id"]}',
                        'type': 'depends_on',
                        'label': 'blocks'
                    }
                })

        print(f"✅ GRAPH API: Generated {len(elements)} total elements")
        return jsonify(elements), 200

    except Exception as e:
        print(f"❌ GRAPH API ERROR: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Failed to generate graph", "details": str(e)}), 500


@app.route('/api/graph/node/<node_id>')
def get_graph_node(node_id):
    """
    Get detailed information about a specific graph node
    Supports quick tooltip data and validation before editing
    """
    try:
        # Parse node type and ID from format: "project-1" or "task-5"
        parts = node_id.split('-')
        if len(parts) != 2:
            return jsonify({"error": "Invalid node ID format"}), 400
        
        node_type, entity_id = parts[0], parts[1]
        
        with get_db_connection() as conn:
            cur = conn.cursor()
            
            if node_type == 'project':
                cur.execute("""
                    SELECT id, name, description, start_date, end_date, status, 
                           created_at, updated_at
                    FROM projects 
                    WHERE id = %s;
                """, (entity_id,))
                data = cur.fetchone()
                
                if not data:
                    return jsonify({"error": "Project not found"}), 404
                
                # Count related tasks
                cur.execute("SELECT COUNT(*) as count FROM tasks WHERE project_id = %s;", (entity_id,))
                task_count = cur.fetchone()['count']
                
                return jsonify({
                    "type": "project",
                    "id": data['id'],
                    "name": data['name'],
                    "description": data.get('description', ''),
                    "start_date": str(data['start_date']) if data.get('start_date') else None,
                    "end_date": str(data['end_date']) if data.get('end_date') else None,
                    "status": data.get('status', 'active'),
                    "task_count": task_count,
                    "created_at": str(data['created_at']),
                    "updated_at": str(data.get('updated_at', ''))
                }), 200
                
            elif node_type == 'task':
                cur.execute("""
                    SELECT t.id, t.title, t.description, t.status, t.priority, 
                           t.assigned_to, t.due_date, t.project_id, 
                           t.parent_task_id, t.depends_on_task_id,
                           t.created_at, t.updated_at,
                           p.name as project_name
                    FROM tasks t
                    LEFT JOIN projects p ON t.project_id = p.id
                    WHERE t.id = %s;
                """, (entity_id,))
                data = cur.fetchone()
                
                if not data:
                    return jsonify({"error": "Task not found"}), 404
                
                # Get subtask count
                cur.execute("SELECT COUNT(*) as count FROM tasks WHERE parent_task_id = %s;", (entity_id,))
                subtask_count = cur.fetchone()['count']
                
                return jsonify({
                    "type": "task",
                    "id": data['id'],
                    "title": data['title'],
                    "description": data.get('description', ''),
                    "status": data['status'],
                    "priority": data.get('priority', 3),
                    "assigned_to": data.get('assigned_to', ''),
                    "due_date": str(data['due_date']) if data.get('due_date') else None,
                    "project_id": data.get('project_id'),
                    "project_name": data.get('project_name', ''),
                    "parent_task_id": data.get('parent_task_id'),
                    "depends_on_task_id": data.get('depends_on_task_id'),
                    "subtask_count": subtask_count,
                    "created_at": str(data['created_at']),
                    "updated_at": str(data.get('updated_at', ''))
                }), 200
            else:
                return jsonify({"error": "Invalid node type"}), 400
                
    except Exception as e:
        print(f"❌ NODE DETAILS ERROR: {e}")
        return jsonify({"error": "Failed to get node details", "details": str(e)}), 500


@app.route('/api/graph/refresh')
def refresh_graph():
    """
    Quick refresh endpoint that returns only IDs and status/priority for efficient updates
    Used for real-time graph updates without full data reload
    """
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            
            # Get minimal project data
            cur.execute("SELECT id, name, status FROM projects;")
            projects = cur.fetchall()
            
            # Get minimal task data with status and priority
            cur.execute("""
                SELECT id, title, status, priority, project_id, 
                       parent_task_id, depends_on_task_id 
                FROM tasks;
            """)
            tasks = cur.fetchall()
        
        result = {
            "projects": [
                {
                    "id": f"project-{p['id']}", 
                    "label": p['name'],
                    "status": p.get('status', 'active')
                } for p in projects
            ],
            "tasks": [
                {
                    "id": f"task-{t['id']}", 
                    "label": t['title'],
                    "status": t['status'],
                    "priority": t.get('priority', 3)
                } for t in tasks
            ],
            "timestamp": datetime.now().isoformat()
        }
        
        return jsonify(result), 200
        
    except Exception as e:
        print(f"❌ REFRESH ERROR: {e}")
        return jsonify({"error": "Failed to refresh graph"}), 500


@app.route('/api/graph/stats')
def get_graph_stats():
    """
    Get graph statistics for dashboard/overview
    """
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            
            # Project stats
            cur.execute("SELECT COUNT(*) as total, status FROM projects GROUP BY status;")
            project_stats = cur.fetchall()
            
            # Task stats
            cur.execute("SELECT COUNT(*) as total, status FROM tasks GROUP BY status;")
            task_stats = cur.fetchall()
            
            # Priority distribution
            cur.execute("SELECT COUNT(*) as total, priority FROM tasks GROUP BY priority;")
            priority_stats = cur.fetchall()
            
            # Edge counts
            cur.execute("SELECT COUNT(*) as total FROM tasks WHERE project_id IS NOT NULL;")
            project_task_edges = cur.fetchone()['total']
            
            cur.execute("SELECT COUNT(*) as total FROM tasks WHERE parent_task_id IS NOT NULL;")
            subtask_edges = cur.fetchone()['total']
            
            cur.execute("SELECT COUNT(*) as total FROM tasks WHERE depends_on_task_id IS NOT NULL;")
            dependency_edges = cur.fetchone()['total']
        
        return jsonify({
            "projects": {
                "total": sum(p['total'] for p in project_stats),
                "by_status": {p['status']: p['total'] for p in project_stats}
            },
            "tasks": {
                "total": sum(t['total'] for t in task_stats),
                "by_status": {t['status']: t['total'] for t in task_stats}
            },
            "priorities": {
                f"priority_{p['priority']}": p['total'] for p in priority_stats
            },
            "edges": {
                "project_tasks": project_task_edges,
                "subtasks": subtask_edges,
                "dependencies": dependency_edges,
                "total": project_task_edges + subtask_edges + dependency_edges
            }
        }), 200
        
    except Exception as e:
        print(f"❌ STATS ERROR: {e}")
        return jsonify({"error": "Failed to get graph stats"}), 500


#Calender
@app.route('/api/calendar/tasks')
def get_calendar_tasks():
    """
    Returns tasks for calendar view using raw SQL queries
    """
    try:
        from_date = request.args.get('from')
        to_date = request.args.get('to')

        with get_db_connection() as conn:
            cur = conn.cursor()

            # Build query based on date range
            if from_date and to_date:
                cur.execute("""
                    SELECT id, title, assigned_to, status, due_date
                    FROM tasks
                    WHERE due_date BETWEEN %s AND %s
                    ORDER BY due_date;
                """, (from_date, to_date))
            else:
                cur.execute("""
                    SELECT id, title, assigned_to, status, due_date
                    FROM tasks
                    WHERE due_date IS NOT NULL
                    ORDER BY due_date;
                """)

            tasks = cur.fetchall()

        # Process tasks and mark overdue ones
        today = datetime.utcnow().date()
        task_list = []

        for task in tasks:
            task_dict = {
                "id": task["id"],
                "title": task["title"],
                "assigned_to": task["assigned_to"],
                "status": task["status"],
                "due_date": task["due_date"].strftime("%Y-%m-%d") if task["due_date"] else None
            }

            # Mark overdue tasks
            if task["due_date"] and task["due_date"] < today and task["status"] != 'done':
                task_dict['status'] = 'overdue'

            task_list.append(task_dict)

        return jsonify(task_list), 200

    except Exception as e:
        print(f"Error fetching calendar tasks: {e}")
        return jsonify({"error": "Failed to fetch calendar tasks"}), 500


@app.route('/api/calendar/tasks/<int:task_id>')
def get_calendar_task(task_id):
    """
    Returns a single task for calendar view using raw SQL queries
    """
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                SELECT id, title, assigned_to, status, due_date, description, priority
                FROM tasks
                WHERE id = %s;
            """, (task_id,))

            task = cur.fetchone()
            cur.close()

        if not task:
            return jsonify({"error": "Task not found"}), 404

        # Convert to dict and format dates
        task_dict = {
            "id": task["id"],
            "title": task["title"],
            "assigned_to": task["assigned_to"],
            "status": task["status"],
            "due_date": task["due_date"].strftime("%Y-%m-%d") if task["due_date"] else None,
            "description": task["description"],
            "priority": task["priority"]
        }

        return jsonify(task_dict), 200

    except Exception as e:
        print(f"Error fetching calendar task: {e}")
        return jsonify({"error": "Failed to fetch task"}), 500


@app.route('/api/gemini/tasks')
def get_gemini_tasks():
    tasks = Task.query.all()
    today = datetime.utcnow().date()
    result = []
    for t in tasks:
        data = t.to_dict()
        if t.due_date and t.due_date < today and t.status != 'done':
            data['status'] = 'overdue'
        result.append(data)
    return jsonify(result)


@app.route('/api/ai/suggestions/<int:task_id>')
def ai_task_suggestions(task_id):
    """Generate intelligent AI suggestions for a specific task using Google Gemini"""
    from datetime import datetime
    
    # Fetch task using raw SQL (no ORM)
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM tasks WHERE id=%s;", (task_id,))
    task_row = cur.fetchone()
    cur.close()
    conn.close()
    
    if not task_row:
        return jsonify({"error": "Task not found"}), 404
    
    # Convert to dict for easier access
    task = dict(task_row)

    # Determine urgency
    urgency = "⚠️ URGENT" if (task.get('priority') or 3) <= 2 else "Standard"
    if task.get('due_date'):
        due_date = task['due_date']
        if isinstance(due_date, str):
            due_date = datetime.fromisoformat(due_date).date()
        days_until_due = (due_date - datetime.utcnow().date()).days
        if days_until_due < 0:
            urgency = "🔴 OVERDUE"
        elif days_until_due <= 3:
            urgency = "⚠️ DUE SOON"
    
    # Build enhanced prompt
    prompt = f"""You are an expert project management AI assistant. Analyze this task and provide strategic, actionable insights.

📋 TASK ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 Title: {task.get('title', 'Untitled Task')}
📝 Description: {task.get('description') or 'No detailed description provided'}
🎯 Current Status: {(task.get('status') or 'todo').upper()}
👤 Assigned To: {task.get('assigned_to') or 'Unassigned - needs assignment'}
⭐ Priority Level: {task.get('priority', 3)}/5 ({urgency})
📅 Due Date: {task.get('due_date') or 'No deadline set'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🤖 YOUR MISSION:
Provide 4-6 concise, high-impact suggestions covering:

1. **🎯 Next Actions**: Immediate concrete steps to move this task forward
2. **⚠️ Potential Risks**: What could go wrong or block progress?
3. **💡 Smart Tips**: Best practices or efficiency improvements
4. **👥 Collaboration**: Who should be involved or consulted?
5. **⏰ Time Management**: How to prioritize or break down the work
6. **✅ Success Criteria**: How to know when this task is truly complete

Keep each point brief (1-2 lines max). Be specific and actionable. Use emojis for visual clarity.

Format your response as clear bullet points."""

    try:
        from google import genai
        
        # Validate API key
        api_key = os.getenv('GEMINI_API_KEY')
        if not api_key:
            logging.error("GEMINI_API_KEY not found in environment variables")
            return jsonify({
                "error": "AI service not configured",
                "suggestions": "⚠️ Unable to generate AI suggestions. Please contact your administrator."
            }), 500
        
        # Initialize Gemini client
        client = genai.Client(api_key=api_key)
        
        # Generate AI suggestions - Using valid Gemini model name
        response = client.models.generate_content(
            model='gemini-2.5-flash',  # Valid Gemini model (gemini-2.5-flash doesn't exist)
            contents=prompt
        )
        
        # Process response with better error handling
        if hasattr(response, 'text'):
            suggestions_text = response.text.strip()
        elif hasattr(response, 'candidates') and len(response.candidates) > 0:
            suggestions_text = response.candidates[0].content.parts[0].text.strip()
        else:
            suggestions_text = ""
        
        # Add fallback if response is empty
        if not suggestions_text:
            suggestions_text = "✨ AI is analyzing your task. Please try again in a moment."
        
        return jsonify({
            "task_id": task.get('id'),
            "title": task.get('title', 'Untitled Task'),
            "status": task.get('status', 'todo'),
            "urgency": urgency,
            "suggestions": suggestions_text,
            "generated_at": datetime.utcnow().isoformat()
        })
        
    except ImportError as e:
        logging.error(f"Failed to import Google Genai SDK: {str(e)}")
        return jsonify({
            "error": "AI module not installed",
            "suggestions": "⚠️ AI suggestions feature requires additional setup. Install google-genai package."
        }), 500
        
    except AttributeError as e:
        logging.error(f"API response format error: {str(e)}")
        return jsonify({
            "error": "Unexpected API response format",
            "suggestions": "⚠️ Unable to parse AI response. Please try again."
        }), 500
        
    except ValueError as e:
        error_msg = str(e)
        logging.error(f"Gemini API validation error: {error_msg}")
        return jsonify({
            "error": "API validation error",
            "suggestions": f"⚠️ Model configuration error. Please ensure you're using a valid Gemini model. Error: {error_msg}"
        }), 500
        
    except Exception as e:
        error_details = str(e)
        logging.error(f"Gemini API error: {error_details}", exc_info=True)
        
        # Provide helpful error messages
        if "API key" in error_details.lower() or "authentication" in error_details.lower():
            return jsonify({
                "error": "Invalid API key",
                "suggestions": "⚠️ AI service authentication failed. Please check your GEMINI_API_KEY environment variable."
            }), 500
        elif "quota" in error_details.lower() or "rate limit" in error_details.lower():
            return jsonify({
                "error": "API quota exceeded",
                "suggestions": "⚠️ AI service temporarily unavailable due to usage limits. Try again later."
            }), 503
        elif "pattern" in error_details.lower() or "match" in error_details.lower():
            return jsonify({
                "error": "Invalid model configuration",
                "suggestions": "⚠️ AI model configuration error. Using fallback model. Please contact administrator."
            }), 500
        else:
            return jsonify({
                "error": f"AI generation failed",
                "suggestions": f"⚠️ Unable to generate suggestions: {error_details}\n\nPlease check your Gemini API configuration and try again."
            }), 500



# ============================================
# SLACK ALERT INTEGRATION
# ============================================

# Slack Webhook Configuration
# Set via environment variable: export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."
SLACK_WEBHOOK_URL = os.environ.get("SLACK_WEBHOOK_URL")

# Fallback for local testing (remove in production)
if not SLACK_WEBHOOK_URL:
    SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/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"

@app.route('/api/send_slack_alert', methods=['POST'])
def send_slack_alert():
    """Send alert notification to Slack"""
    try:
        data = request.get_json()
        alert_type = data.get('type', 'info')
        title = data.get('title', 'Alert')
        message = data.get('message', 'No message provided')
        
        # Determine emoji based on alert type
        emoji_map = {
            'error': '🔴',
            'warning': '⚠️',
            'info': '🔵'
        }
        emoji = emoji_map.get(alert_type, '🔔')
        
        # Construct Slack message with rich formatting
        payload = {
            "blocks": [
                {
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": f"{emoji} {title}",
                        "emoji": True
                    }
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*Message:* {message}"
                    }
                },
                {
                    "type": "section",
                    "fields": [
                        {
                            "type": "mrkdwn",
                            "text": f"*Type:*\n{alert_type.upper()}"
                        },
                        {
                            "type": "mrkdwn",
                            "text": f"*Time:*\n{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
                        }
                    ]
                },
                {
                    "type": "divider"
                },
                {
                    "type": "context",
                    "elements": [
                        {
                            "type": "mrkdwn",
                            "text": "📊 Sent from *PS16 Collaborative Workspace* | Project Management System"
                        }
                    ]
                }
            ]
        }
        
        # Send to Slack
        resp = requests.post(SLACK_WEBHOOK_URL, json=payload, timeout=5)
        
        if resp.status_code == 200:
            # Log activity with correct parameters: user_id, action_type, object_type, object_id
            log_activity(
                user_id="system",
                action_type="slack_notification",
                object_type="alert",
                object_id=f"{alert_type}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
            )
            return jsonify({
                "status": "success",
                "message": "Alert sent to Slack successfully ✅"
            }), 200
        else:
            logging.error(f"Slack webhook failed: {resp.status_code} - {resp.text}")
            return jsonify({
                "status": "error",
                "message": f"Slack responded with {resp.status_code}"
            }), resp.status_code
            
    except requests.exceptions.Timeout:
        return jsonify({
            "status": "error",
            "message": "Request to Slack timed out"
        }), 504
    except Exception as e:
        logging.error(f"Slack alert error: {str(e)}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": f"Failed to send alert: {str(e)}"
        }), 500


# --------- Run ----------
if __name__ == '__main__':
    # Listen on 0.0.0.0 for Render compatibility
    port = int(os.environ.get("PORT", 5001))
    app.run(host='0.0.0.0', port=port, debug=True)
