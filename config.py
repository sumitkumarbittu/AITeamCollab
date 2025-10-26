# config.py
# Helper module for DB connection and small utilities.
# Reads DATABASE_URL from the environment (Render/Postgres ready).

import os
from dotenv import load_dotenv
import psycopg2
import psycopg2.extras
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

load_dotenv()


def get_db_connection():
    """
    Returns a new psycopg2 connection using DATABASE_URL from env.
    For Render, DATABASE_URL is provided in the environment.
    """
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("Please set the DATABASE_URL environment variable.")
    # psycopg2 accepts the URL directly
    conn = psycopg2.connect(dsn=database_url, cursor_factory=psycopg2.extras.DictCursor)
    return conn


db = SQLAlchemy()

# --- Activity Log Model ---
class ActivityLog(db.Model):
    __tablename__ = 'activity_logg'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, nullable=False)
    action_type = db.Column(db.String(50), nullable=False)  # e.g., "update_task"
    object_type = db.Column(db.String(50), nullable=False)  # e.g., "task"
    object_id = db.Column(db.Integer, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

# --- Helper Function for Logging ---
def log_activity(user_id, action_type, object_type, object_id):
    """
    Logs an activity to the database using direct PostgreSQL queries
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO activity_logg (user_id, action_type, object_type, object_id)
            VALUES (%s, %s, %s, %s)
        """, (user_id, action_type, object_type, object_id))
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error logging activity: {e}")
        # Don't let logging errors break the main functionality


# ========== Database Model ==========
class Chat(db.Model):
    __tablename__ = 'chat'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    message = db.Column(db.Text, nullable=False)
    time = db.Column(db.DateTime(timezone=True), server_default=db.func.now())

    def to_dict(self):
        return {
            'name': self.name,
            'message': self.message,
            'time': self.time.strftime('%Y-%m-%d %H:%M:%S')
        }


# -------------------
# MODELS
# -------------------
class Task(db.Model):
    __tablename__ = 'tasks'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String, nullable=False)
    assigned_to = db.Column(db.String)
    status = db.Column(db.String, default='todo')
    due_date = db.Column(db.Date)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "assigned_to": self.assigned_to,
            "status": self.status,
            "due_date": self.due_date.strftime("%Y-%m-%d") if self.due_date else None
        }

