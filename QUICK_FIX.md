# Quick Deployment Fix

## The Problem
SQLAlchemy was trying to import `psycopg2` but we migrated to `psycopg` (v3).

## The Solution
Modified the database URL to explicitly tell SQLAlchemy to use the `psycopg` driver:

```python
# In app.py
database_url = os.getenv('DATABASE_URL')

# Convert postgres:// to postgresql+psycopg://
if database_url and database_url.startswith('postgres://'):
    database_url = database_url.replace('postgres://', 'postgresql+psycopg://', 1)
elif database_url and database_url.startswith('postgresql://'):
    database_url = database_url.replace('postgresql://', 'postgresql+psycopg://', 1)

app.config['SQLALCHEMY_DATABASE_URI'] = database_url
```

## Deploy Now

```bash
git add .
git commit -m "Fix: SQLAlchemy psycopg driver configuration"
git push origin main
```

Render will redeploy automatically. The error should be resolved.

## What Changed
- ✅ SQLAlchemy now uses `postgresql+psycopg://` driver
- ✅ Added connection pool settings for stability
- ✅ Non-blocking database initialization
- ✅ Health check endpoint at `/health`

## Verify Deployment
Once deployed, check:
1. Logs should show: `✅ All database tables created successfully`
2. Visit: `https://your-app.onrender.com/health`
3. Should return: `{"status": "healthy", "service": "AITeamCollab"}`
