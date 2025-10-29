import os
import sys
from config import get_db_connection

def migrate_events():
    try:
        print("🔵 Starting events table migration...")
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Step 1: Backup existing events
        print("📋 Backing up existing events data...")
        cur.execute("""
            SELECT 
                id, event_name, organisation, platform, team_size,
                team_slots_available, added_by, event_date, team_members,
                created_at, updated_at
            FROM events
        """)
        events_backup = cur.fetchall()
        print(f"✅ Backed up {len(events_backup)} events")
        
        # Step 2: Drop and recreate the table
        print("🔄 Recreating events table with new schema...")
        
        # Drop the table and let SERIAL handle sequence creation
        cur.execute("""
            -- Drop the table if it exists (this will drop dependent objects)
            DROP TABLE IF EXISTS events CASCADE;
            
            -- Create new table with updated schema
            CREATE TABLE events (
                id SERIAL PRIMARY KEY,
                event_name TEXT NOT NULL,
                organisation TEXT,
                platform TEXT,
                team_size INTEGER,
                team_slots_available INTEGER,
                added_by TEXT NOT NULL,
                event_date DATE,
                start_date DATE,
                start_time TIME,
                end_date DATE,
                end_time TIME,
                team_members TEXT,
                created_at TIMESTAMP DEFAULT now(),
                updated_at TIMESTAMP DEFAULT now()
            );
        """)
                id SERIAL PRIMARY KEY,
                event_name TEXT NOT NULL,
                organisation TEXT,
                platform TEXT,
                team_size INTEGER,
                team_slots_available INTEGER,
                added_by TEXT NOT NULL,
                event_date DATE,
                start_date DATE,
                start_time TIME,
                end_date DATE,
                end_time TIME,
                team_members TEXT,
                created_at TIMESTAMP DEFAULT now(),
                updated_at TIMESTAMP DEFAULT now()
            );
            
            -- Recreate the sequence
            CREATE SEQUENCE events_id_seq
                START WITH 1
                INCREMENT BY 1
                NO MINVALUE
                NO MAXVALUE
                CACHE 1;
                
            -- Set the sequence to be owned by the id column
            ALTER SEQUENCE events_id_seq OWNED BY events.id;
            ALTER TABLE events ALTER COLUMN id SET DEFAULT nextval('events_id_seq');
        """)
        conn.commit()
        
        # Step 3: Restore data
        if events_backup:
            print("🔄 Restoring events...")
            for event in events_backup:
                # Unpack all fields except the first one (id)
                (_, event_name, org, platform, team_size, slots, added_by, 
                 event_date, members, created_at, updated_at) = event
                
                cur.execute("""
                    INSERT INTO events (
                        event_name, organisation, platform, team_size,
                        team_slots_available, added_by, event_date, team_members,
                        created_at, updated_at, start_date, start_time, end_date, end_time
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, '00:00:00', %s, '23:59:59')
                """, (event_name, org, platform, team_size, slots, added_by, 
                     event_date, members, created_at, updated_at, 
                     event_date, event_date))  # Use event_date for both start_date and end_date
            conn.commit()
            print(f"✅ Restored {len(events_backup)} events")
        
        print("✨ Migration completed successfully!")
        
    except Exception as e:
        print(f"❌ Error during migration: {str(e)}")
        if 'conn' in locals():
            conn.rollback()
        sys.exit(1)
    finally:
        if 'cur' in locals():
            cur.close()
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    migrate_events()
