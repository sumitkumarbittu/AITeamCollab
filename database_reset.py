import os
import psycopg
from dotenv import load_dotenv

load_dotenv()

TABLES_TO_DROP = [
    'projects',
    'tasks', 
    'meetings',
    'events',
    'ideas',
    'attachments',
    'activity_log',
    'chat',
    'alerts'
]

def get_db_connection():
    """Establish database connection"""
    return psycopg.connect(os.getenv("DATABASE_URL"))

def verify_tables_exist(conn):
    """Check which tables actually exist"""
    cur = conn.cursor()
    cur.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = ANY(%s)
    """, (TABLES_TO_DROP,))
    return [row[0] for row in cur.fetchall()]

def drop_tables(conn, tables):
    """Safely drop tables with CASCADE"""
    cur = conn.cursor()
    for table in tables:
        print(f"🌀 Dropping table: {table}")
        cur.execute(f"DROP TABLE IF EXISTS {table} CASCADE")
    conn.commit()
    print("✅ All specified tables dropped successfully")

def main():
    print("🔍 Starting database reset...")
    conn = get_db_connection()
    
    try:
        existing_tables = verify_tables_exist(conn)
        print("📋 Tables found:", existing_tables)
        
        if not existing_tables:
            print("ℹ️ No tables to drop - database appears empty")
            return
            
        print(f"⚠️ WARNING: This will drop {len(existing_tables)} tables permanently")
        confirm = input("❗ Confirm drop? (type 'DROP' to proceed): ")
        
        if confirm == "DROP":
            drop_tables(conn, existing_tables)
        else:
            print("🚫 Operation cancelled by user")
            
    except Exception as e:
        print(f"❌ Error during reset: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    main()
