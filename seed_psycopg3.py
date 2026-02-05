
import random
import json
from datetime import datetime, timedelta
import psycopg
from config import get_db_connection

# Lists of realistic dummy data
USER_NAMES = ["Alice", "Bob", "Charlie", "David", "Eve", "Frank", "Grace", "Heidi", "Ivan", "Judy"]
PROJECT_NAMES = [
    "Website Redesign", 
    "Mobile App Launch", 
    "Internal Dashboard", 
    "Customer Support Portal", 
    "Marketing Campaign Q3"
]
TASK_TITLES = [
    "Design Mockups", "Setup Database", "Create API Endpoints", "Frontend Integration", 
    "Unit Testing", "User Acceptance Testing", "Deploy to Staging", "Fix Bugs", 
    "Write Documentation", "Client Meeting"
]
DESCRIPTIONS = [
    "We need to focus on usability and accessibility.",
    "Ensure high performance and scalability.",
    "This task is critical for the MVP launch.",
    "Coordinate with the design team for assets.",
    "Refactor legacy code for better maintainability."
]
EVENT_NAMES = [
    "Team Hackathon", "Code Review Session", "Project Kickoff", "Weekly Sync", "Tech Talk"
]
IDEAS = [
    ("Dark Mode", "Implement a dark mode toggle for better night time usage."),
    ("Voice Search", "Add voice search capability for tasks."),
    ("Gamification", "Add badges and points for completing tasks."),
    ("Integration with Slack", "Notify channels on task updates."),
    ("Mobile Native App", "Build a React Native version.")
]
CHAT_MESSAGES = [
    "Hey everyone, how's the progress?",
    "I just pushed the latest changes.",
    "Can you review my PR?",
    "Meeting in 5 minutes.",
    "We need to fix the build pipeline.",
    "Great job on the demo!",
    "Lunch?",
    "I'm blocked on the API integration."
]

def clear_data(cur):
    print("🗑️ Clearing existing data...")
    tables = ["activity_logg", "chat", "attachments", "tasks", "projects", "events", "ideas"]
    for table in tables:
        # Check if table exists before truncating to avoid errors on fresh DB
        cur.execute(f"TRUNCATE TABLE {table} RESTART IDENTITY CASCADE;")

def create_projects(cur):
    print("📁 Creating projects...")
    projects = []
    for name in PROJECT_NAMES:
        start_date = datetime.now() - timedelta(days=random.randint(0, 30))
        end_date = start_date + timedelta(days=random.randint(30, 90))
        cur.execute("""
            INSERT INTO projects (name, description, start_date, end_date, status)
            VALUES (%s, %s, %s, %s, 'active') RETURNING id;
        """, (name, f"Description for {name}", start_date.date(), end_date.date()))
        projects.append(cur.fetchone()[0])
    return projects

def create_tasks(cur, project_ids):
    print("✅ Creating tasks...")
    tasks = []
    for _ in range(30):
        project_id = random.choice(project_ids)
        title = random.choice(TASK_TITLES)
        priority = random.randint(1, 5)
        status = random.choice(['todo', 'in-progress', 'done'])
        assigned = random.choice(USER_NAMES)
        due_date = datetime.now() + timedelta(days=random.randint(-5, 20))
        
        cur.execute("""
            INSERT INTO tasks (project_id, title, description, assigned_to, status, priority, due_date)
            VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id;
        """, (project_id, title, random.choice(DESCRIPTIONS), assigned, status, priority, due_date.date()))
        tasks.append(cur.fetchone()[0])
    
    # Create relationships (subtasks/dependencies)
    for task_id in tasks:
        if random.random() < 0.3: # 30% chance of being a subtask
            parent = random.choice([t for t in tasks if t != task_id])
            cur.execute("UPDATE tasks SET parent_task_id = %s WHERE id = %s", (parent, task_id))
        
        if random.random() < 0.2: # 20% chance of dependency
            dependency = random.choice([t for t in tasks if t != task_id])
            cur.execute("UPDATE tasks SET depends_on_task_id = %s WHERE id = %s", (dependency, task_id))

def create_events(cur):
    print("📅 Creating events...")
    for name in EVENT_NAMES:
        date = datetime.now() + timedelta(days=random.randint(1, 30))
        cur.execute("""
            INSERT INTO events (event_name, organisation, platform, team_size, team_slots_available, added_by, event_date, end_date, end_time)
            VALUES (%s, 'Acme Corp', 'Zoom', 5, 2, %s, %s, %s, '09:00:00');
        """, (name, random.choice(USER_NAMES), date.date(), date.date()))

def create_ideas(cur):
    print("💡 Creating ideas...")
    for title, desc in IDEAS:
        added_by = random.choice(USER_NAMES)
        cur.execute("""
            INSERT INTO ideas (idea_title, idea_description, added_by, status, priority)
            VALUES (%s, %s, %s, 'proposed', 'medium');
        """, (title, desc, added_by))

def create_chat_messages(cur):
    print("💬 Creating chat messages...")
    for _ in range(20):
        msg = random.choice(CHAT_MESSAGES)
        name = random.choice(USER_NAMES)
        time = datetime.now() - timedelta(minutes=random.randint(1, 1000))
        cur.execute("""
            INSERT INTO chat (name, message, time)
            VALUES (%s, %s, %s);
        """, (name, msg, time))

def create_activity_logs(cur):
    print("📜 Creating activity logs...")
    # Just insert some random logs
    actions = ['created', 'updated', 'deleted', 'completed']
    types = ['task', 'project', 'event']
    for _ in range(15):
        cur.execute("""
            INSERT INTO activity_logg (user_id, action_type, object_type, object_id, timestamp)
            VALUES (1, %s, %s, %s, %s);
        """, (random.choice(actions), random.choice(types), random.randint(1, 50), datetime.now()))

def main():
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        clear_data(cur)
        project_ids = create_projects(cur)
        create_tasks(cur, project_ids)
        create_events(cur)
        create_ideas(cur)
        create_chat_messages(cur)
        create_activity_logs(cur)
        
        conn.commit()
        print("\n✨ Dummy data generation complete!")
        print("Run the app and refresh to see the data.")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    main()
