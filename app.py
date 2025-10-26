# app.py
# Single-file Flask app implementing CRUD for Projects, Tasks (subtasks & dependencies), Attachments stored in Postgres.
# Usage:
#   export DATABASE_URL="postgres://user:pass@host:5432/dbname"
#   python app.py

import os
import io
from datetime import datetime
from flask import Flask, request, jsonify, send_file, send_from_directory
from werkzeug.utils import secure_filename
from config import get_db_connection, db, log_activity, ActivityLog, Chat
import psycopg2
import psycopg2.extras
import logging
import requests


app = Flask(__name__)

# Configure SQLAlchemy
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize SQLAlchemy
db.init_app(app)

from flask_cors import CORS
CORS(app)


# ✅ Serve index.html directly from root
@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

@app.route('/style.css')
def serve_css():
    return send_from_directory('.', 'style.css')

@app.route('/script.js')
def serve_js():
    return send_from_directory('.', 'script.js')

# --------- DB initialization helper ----------
def init_db():
    """Create tables if they don't already exist."""
    conn = get_db_connection()
    cur = conn.cursor()
    # Projects table
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
    # Tasks table (supports subtasks via parent_task_id and dependencies via depends_on_task_id)
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
    # Attachments table (store file bytes directly in Postgres bytea)
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
    # Activity log table
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
    conn.commit()
    cur.close()
    conn.close()

# Create all tables with SQLAlchemy (including activity log)
with app.app_context():
    try:
        db.create_all()
        print("✅ All database tables created successfully")
    except Exception as e:
        print(f"Database table creation error: {e}")

# initialize DB on startup
try:
    init_db()
except Exception as e:
    # if init fails, show a helpful message but continue (app will error on DB calls)
    print("Database initialization error:", e)

# --------- Utilities ----------
def row_to_dict(row):
    if not row:
        return None
    return dict(row)

# --------- Routes: Frontend ----------
@app.route('/')
def index():
    # Single page app: serve index.html directly from root
    return send_from_directory('.', 'index.html')

# --------- API: Projects ----------
@app.route('/api/projects', methods=['GET'])
def list_projects():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM projects ORDER BY created_at DESC;")
    rows = cur.fetchall()
    projects = [dict(r) for r in rows]
    cur.close()
    conn.close()
    return jsonify(projects)

@app.route('/api/projects', methods=['POST'])
def create_project():
    data = request.get_json() or {}
    name = data.get('name')
    description = data.get('description')
    start_date = data.get('start_date')
    end_date = data.get('end_date')
    if not name:
        return jsonify({"error": "Project name is required"}), 400
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO projects (name, description, start_date, end_date)
        VALUES (%s, %s, %s, %s) RETURNING *;
    """, (name, description, start_date, end_date))
    project = dict(cur.fetchone())
    conn.commit()
    cur.close()
    conn.close()
    log_activity(user_id=1, action_type="created", object_type="project", object_id=project['id'])
    return jsonify(project), 201

@app.route('/api/projects/<int:project_id>', methods=['GET'])
def get_project(project_id):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM projects WHERE id=%s;", (project_id,))
    project = cur.fetchone()
    if not project:
        cur.close()
        conn.close()
        return jsonify({"error": "Project not found"}), 404
    project = dict(project)
    # include tasks for this project
    cur.execute("SELECT * FROM tasks WHERE project_id=%s ORDER BY created_at;", (project_id,))
    tasks = [dict(r) for r in cur.fetchall()]
    cur.close()
    conn.close()
    project['tasks'] = tasks
    # Removed view logging to reduce noise
    # log_activity(user_id=1, action_type="viewed", object_type="project", object_id=project_id)
    return jsonify(project)

@app.route('/api/projects/<int:project_id>', methods=['PUT'])
def update_project(project_id):
    data = request.get_json() or {}
    fields = []
    vals = []
    for key in ['name', 'description', 'start_date', 'end_date', 'status']:
        if key in data:
            fields.append(f"{key} = %s")
            vals.append(data[key])
    if not fields:
        return jsonify({"error": "No updatable fields provided"}), 400
    vals.append(project_id)
    cur_sql = "UPDATE projects SET " + ", ".join(fields) + ", updated_at = now() WHERE id = %s RETURNING *;"
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(cur_sql, tuple(vals))
    updated = cur.fetchone()
    if not updated:
        cur.close()
        conn.close()
        return jsonify({"error": "Project not found"}), 404
    conn.commit()
    project = dict(updated)
    cur.close()
    conn.close()
    log_activity(user_id=1, action_type="updated", object_type="project", object_id=project_id)
    return jsonify(project)

@app.route('/api/projects/<int:project_id>', methods=['DELETE'])
def delete_project(project_id):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM projects WHERE id=%s RETURNING id;", (project_id,))
    deleted = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
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
