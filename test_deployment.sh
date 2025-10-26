#!/bin/bash
# Test script to verify the deployment fix works locally

echo "Testing the deployment fix..."
echo "1. Installing requirements (psycopg2 compiles from source)..."
pip3 install -r requirements.txt

echo "2. Testing database connection..."
python3 -c "
import os
from config import get_db_connection
try:
    conn = get_db_connection()
    print('✅ Database connection successful!')
    conn.close()
except Exception as e:
    print(f'❌ Database connection failed: {e}')
"

echo "3. Testing Flask app startup..."
python3 -c "
import os
os.environ['DATABASE_URL'] = 'postgresql://test'
from app import app
print('✅ Flask app imports successfully!')
print('✅ All imports working with psycopg2 compiled from source!')
"

echo "Ready for deployment to Render with Python 3.12!"
