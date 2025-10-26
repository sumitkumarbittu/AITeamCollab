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
    log_activity(user_id=1, action_type="create_project", object_type="project", object_id=project['id'])
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
    log_activity(user_id=1, action_type="view_project", object_type="project", object_id=project_id)
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
    log_activity(user_id=1, action_type="update_project", object_type="project", object_id=project_id)
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
    log_activity(user_id=1, action_type="delete_project", object_type="project", object_id=project_id)
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
    log_activity(user_id=1, action_type="create_task", object_type="task", object_id=task['id'])
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
    log_activity(user_id=1, action_type="update_task", object_type="task", object_id=task_id)
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
    log_activity(user_id=1, action_type="delete_task", object_type="task", object_id=task_id)
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
    log_activity(user_id=1, action_type="create_subtask", object_type="task", object_id=task_id)
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
        log_activity(user_id=1, action_type="upload_attachment", object_type="attachment", object_id=att[0])
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
    log_activity(user_id=1, action_type="delete_attachment", object_type="attachment", object_id=attachment_id)
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
        log_activity(user_id=1, action_type="init_db", object_type="system", object_id=0)
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --------- API: Activity Logs ----------
@app.route('/api/activity', methods=['GET'])
def get_activity_logs():
    """
    Returns the most recent activity logs from the database
    """
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                SELECT id, action_type, object_type, object_id, timestamp
                FROM activity_logg
                ORDER BY timestamp DESC
                LIMIT 20
            """)
            rows = cur.fetchall()

        logs = [
            {
                "id": r[0],
                "action_type": r[1],
                "object_type": r[2],
                "object_id": r[3],
                "timestamp": r[4].strftime("%Y-%m-%d %H:%M:%S") if r[4] else "Unknown"
            }
            for r in rows
        ]
        return jsonify(logs), 200

    except Exception as e:
        print("Error fetching activity logs:", e)
        return jsonify({"error": "Failed to fetch logs"}), 500




@app.route('/chat/send', methods=['POST'])
def send_message():
    try:
        data = request.json
        if not data or 'name' not in data or 'message' not in data:
            return jsonify({'error': 'Missing name or message'}), 400
        
        new_message = Chat(name=data['name'], message=data['message'])
        db.session.add(new_message)
        db.session.commit()
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



@app.route('/api/graph')
def get_graph():
    """
    Returns graph data for projects and tasks using raw SQL queries
    """
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()

            # Get projects
            cur.execute("SELECT id, name FROM projects ORDER BY name;")
            projects = cur.fetchall()

            # Get tasks
            cur.execute("SELECT id, title, status, project_id, parent_task_id, depends_on_task_id FROM tasks ORDER BY title;")
            tasks = cur.fetchall()

        elements = []

        # Project nodes
        for project in projects:
            elements.append({
                'data': {
                    'id': f'project_{project["id"]}',
                    'label': project['name'],
                    'type': 'project'
                }
            })

        # Task nodes
        for task in tasks:
            # Color mapping based on status
            color_map = {
                'todo': '#32CD32',
                'in_progress': '#FFD700',
                'done': '#1E90FF',
                'blocked': '#FF4500'
            }
            color = color_map.get(task['status'], '#32CD32')

            elements.append({
                'data': {
                    'id': f'task_{task["id"]}',
                    'label': task['title'],
                    'type': 'task',
                    'status': task['status'],
                    'color': color
                }
            })

            # Project to task edges
            if task['project_id']:
                elements.append({
                    'data': {
                        'source': f'project_{task["project_id"]}',
                        'target': f'task_{task["id"]}',
                        'type': 'belongs_to'
                    }
                })

            # Parent task to subtask edges
            if task['parent_task_id']:
                elements.append({
                    'data': {
                        'source': f'task_{task["parent_task_id"]}',
                        'target': f'task_{task["id"]}',
                        'type': 'subtask'
                    }
                })

            # Dependency edges
            if task['depends_on_task_id']:
                elements.append({
                    'data': {
                        'source': f'task_{task["depends_on_task_id"]}',
                        'target': f'task_{task["id"]}',
                        'type': 'depends_on'
                    }
                })

        return jsonify(elements), 200

    except Exception as e:
        print(f"Error generating graph: {e}")
        return jsonify({"error": "Failed to generate graph"}), 500



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
    task = Task.query.get(task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404

    prompt = f"""
You are a concise project assistant AI.
Task details:
Title: {task.title}
Description: {task.description or 'No description'}
Status: {task.status}
Assigned To: {task.assigned_to or 'Unassigned'}
Priority: {task.priority}
Due Date: {task.due_date or 'N/A'}

Provide short high-impact suggestions (max 5 bullet points).
"""
    try:
        model = genai.GenerativeModel("models/gemini-2.5-pro")
        response = model.generate_content(prompt)
        suggestion = getattr(response, "text", "No suggestions returned")
        return jsonify({"task_id": task.id, "title": task.title, "suggestions": suggestion.strip()})
    except Exception as e:
        logging.error("Gemini API error", exc_info=True)
        return jsonify({"error": str(e)}), 500



# --------- Run ----------
if __name__ == '__main__':
    # Listen on 0.0.0.0 for Render compatibility
    port = int(os.environ.get("PORT", 5001))
    app.run(host='0.0.0.0', port=port, debug=True)
