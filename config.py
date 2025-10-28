# ============================================
# config.py
# ============================================
# This is the central configuration file for the AI Team Collaboration application.
# It handles all database connections, models, and utility functions for logging.
# 
# Key Responsibilities:
# 1. Database Connection Management: Creates and manages PostgreSQL connections
# 2. Database Models: Defines SQLAlchemy models for data structures
# 3. Activity Logging: Tracks user actions for audit and monitoring
# 4. Environment Configuration: Loads environment variables from .env file
#
# This module is used by app.py and serves as the foundation for all database operations.
# ============================================

# Import required libraries
import os  # For accessing environment variables and file system operations
from dotenv import load_dotenv  # For loading environment variables from .env file
import psycopg2  # PostgreSQL database adapter for Python (raw SQL queries)
import psycopg2.extras  # Extra utilities for psycopg2, including DictCursor for dict-like results
from flask_sqlalchemy import SQLAlchemy  # ORM (Object-Relational Mapping) for Flask
from datetime import datetime  # For handling date and time operations

# Load environment variables from .env file into the system environment
# This allows us to keep sensitive information (like database URLs) out of the code
load_dotenv()


def get_db_connection():
    """
    Creates and returns a new PostgreSQL database connection using psycopg2.
    
    This function is used for raw SQL queries throughout the application.
    It reads the DATABASE_URL from environment variables, which is automatically
    provided by hosting platforms like Render.
    
    Returns:
        psycopg2.connection: A database connection object with DictCursor factory
                            (allows accessing columns by name like a dictionary)
    
    Raises:
        RuntimeError: If DATABASE_URL environment variable is not set
    
    Example Usage:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM projects")
        results = cur.fetchall()
        cur.close()
        conn.close()
    """
    # Retrieve the database URL from environment variables
    database_url = os.getenv("DATABASE_URL")
    
    # Validate that the database URL exists
    if not database_url:
        raise RuntimeError("Please set the DATABASE_URL environment variable.")
    
    # Create and return a new database connection
    # - dsn: Data Source Name (the database URL)
    # - cursor_factory: DictCursor allows column access by name (e.g., row['column_name'])
    conn = psycopg2.connect(dsn=database_url, cursor_factory=psycopg2.extras.DictCursor)
    return conn


# Initialize SQLAlchemy instance (used for ORM-based database operations)
# This will be initialized with the Flask app in app.py using db.init_app(app)
db = SQLAlchemy()


# ============================================
# DATABASE MODELS
# ============================================
# These classes define the structure of database tables using SQLAlchemy ORM.
# Each class represents a table, and each class attribute represents a column.


# --- Activity Log Model ---
class ActivityLog(db.Model):
    """
    Model for tracking user activities in the application.
    
    This table logs all important actions performed by users, such as:
    - Creating, updating, or deleting tasks
    - Modifying projects
    - Uploading attachments
    - Any other significant user actions
    
    Use Cases:
    - Audit trail for compliance and security
    - User activity monitoring
    - Debugging and troubleshooting
    - Analytics and usage statistics
    """
    # Define the actual table name in the PostgreSQL database
    __tablename__ = 'activity_logg'
    
    # Primary key: Unique identifier for each activity log entry
    id = db.Column(db.Integer, primary_key=True)
    
    # User ID: References the user who performed the action
    user_id = db.Column(db.Integer, nullable=False)
    
    # Action Type: The type of action performed (e.g., "create", "update", "delete")
    action_type = db.Column(db.String(50), nullable=False)
    
    # Object Type: The type of object affected (e.g., "task", "project", "attachment")
    object_type = db.Column(db.String(50), nullable=False)
    
    # Object ID: The ID of the specific object that was affected
    object_id = db.Column(db.Integer, nullable=False)
    
    # Timestamp: When the action occurred (automatically set to current UTC time)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)


def log_activity(user_id, action_type, object_type, object_id):
    """
    Helper function to log user activities to the database.
    
    This function is called throughout the application whenever a significant
    action is performed. It uses raw SQL instead of ORM to avoid circular
    dependencies and ensure logging doesn't fail the main operation.
    
    Args:
        user_id (int): The ID of the user performing the action
        action_type (str): The type of action (e.g., "create_task", "update_project")
        object_type (str): The type of object affected (e.g., "task", "project")
        object_id (int): The ID of the affected object
    
    Returns:
        None
    
    Note:
        If logging fails, it prints an error but doesn't raise an exception.
        This ensures that logging failures don't break the main functionality.
    
    Example Usage:
        log_activity(user_id=1, action_type="create_task", 
                    object_type="task", object_id=42)
    """
    try:
        # Establish a new database connection
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Insert the activity log entry into the database
        cur.execute("""
            INSERT INTO activity_logg (user_id, action_type, object_type, object_id)
            VALUES (%s, %s, %s, %s)
        """, (user_id, action_type, object_type, object_id))
        
        # Commit the transaction to save the changes
        conn.commit()
        
        # Clean up database resources
        cur.close()
        conn.close()
    except Exception as e:
        # If logging fails, print the error but don't crash the application
        print(f"Error logging activity: {e}")
        # Don't let logging errors break the main functionality


# --- Chat Model ---
class Chat(db.Model):
    """
    Model for storing team chat messages.
    
    This table stores all chat messages exchanged in the team collaboration space.
    Each message includes the sender's name, message content, and timestamp.
    
    Features:
    - Real-time team communication
    - Message history and persistence
    - Timezone-aware timestamps
    """
    # Define the actual table name in the PostgreSQL database
    __tablename__ = 'chat'
    
    # Primary key: Unique identifier for each chat message
    id = db.Column(db.Integer, primary_key=True)
    
    # Name: The name of the person who sent the message
    name = db.Column(db.String(100), nullable=False)
    
    # Message: The actual content of the chat message
    message = db.Column(db.Text, nullable=False)
    
    # Time: When the message was sent (automatically set by database)
    # timezone=True ensures the timestamp is timezone-aware
    # server_default uses the database server's NOW() function
    time = db.Column(db.DateTime(timezone=True), server_default=db.func.now())

    def to_dict(self):
        """
        Converts the Chat object to a dictionary for JSON serialization.
        
        This method is used when sending chat data to the frontend via API.
        It formats the timestamp as a human-readable string.
        
        Returns:
            dict: Dictionary representation of the chat message
        
        Example Output:
            {
                'id': 1,
                'name': 'John Doe',
                'message': 'Hello team!',
                'time': '2025-10-28 03:00:00'
            }
        """
        return {
            'id': self.id,
            'name': self.name,
            'message': self.message,
            # Format the timestamp as 'YYYY-MM-DD HH:MM:SS'
            'time': self.time.strftime('%Y-%m-%d %H:%M:%S')
        }


# --- Task Model ---
class Task(db.Model):
    """
    Model for storing project tasks.
    
    This table stores all tasks in the project management system.
    Each task includes details like title, description, assignment, status,
    priority level, and due date.
    
    Features:
    - Task assignment to team members
    - Status tracking (todo, in-progress, done)
    - Priority levels (1-5, where 5 is highest)
    - Due date management
    """
    # Define the actual table name in the PostgreSQL database
    __tablename__ = 'tasks'
    
    # Primary key: Unique identifier for each task
    id = db.Column(db.Integer, primary_key=True)
    
    # Title: Short name/summary of the task (required)
    title = db.Column(db.String, nullable=False)
    
    # Description: Detailed description of what needs to be done (optional)
    description = db.Column(db.Text)
    
    # Assigned To: Name of the person responsible for this task (optional)
    assigned_to = db.Column(db.String)
    
    # Status: Current state of the task (default: 'todo')
    # Common values: 'todo', 'in-progress', 'done', 'blocked'
    status = db.Column(db.String, default='todo')
    
    # Priority: Importance level from 1-5 (default: 3 = medium)
    # 1 = lowest priority, 5 = highest priority
    priority = db.Column(db.Integer, default=3)
    
    # Due Date: When the task should be completed (optional)
    due_date = db.Column(db.Date)

    def to_dict(self):
        """
        Converts the Task object to a dictionary for JSON serialization.
        
        This method is used when sending task data to the frontend via API.
        It handles the date formatting properly.
        
        Returns:
            dict: Dictionary representation of the task
        
        Example Output:
            {
                "id": 1,
                "title": "Implement login feature",
                "description": "Add user authentication",
                "assigned_to": "John Doe",
                "status": "in-progress",
                "priority": 4,
                "due_date": "2025-10-30"
            }
        """
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "assigned_to": self.assigned_to,
            "status": self.status,
            "priority": self.priority,
            # Format due_date as 'YYYY-MM-DD' if it exists, otherwise return None
            "due_date": self.due_date.strftime("%Y-%m-%d") if self.due_date else None
        }

