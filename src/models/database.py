"""
Database models and schema for Job Hunter.
Uses SQLite with aiosqlite for async operations.
"""
import aiosqlite
import json
from datetime import datetime
from pathlib import Path
from typing import Optional

DATABASE_PATH = Path(__file__).parent.parent.parent / "data" / "jobs.db"


async def init_db():
    """Initialize the database schema."""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.executescript("""
            -- Discovered jobs
            CREATE TABLE IF NOT EXISTS jobs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                external_id TEXT UNIQUE,          -- Dedup key (URL hash or job ID)
                title TEXT NOT NULL,
                company TEXT NOT NULL,
                location TEXT,
                salary_min INTEGER,
                salary_max INTEGER,
                description TEXT,
                url TEXT NOT NULL,
                source TEXT,                       -- 'google_jobs', 'linkedin', etc.
                posted_date TEXT,
                
                -- Scoring
                score REAL,                        -- 0.0 - 1.0 overall match score
                score_breakdown TEXT,              -- JSON: {"title": 0.9, "remote": 1.0, ...}
                
                -- Status
                status TEXT DEFAULT 'new',         -- new, reviewed, favorited, applied, rejected, archived
                
                -- Metadata
                raw_data TEXT,                     -- Full raw response from source
                discovered_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            );

            -- Tailored application materials
            CREATE TABLE IF NOT EXISTS applications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                job_id INTEGER NOT NULL REFERENCES jobs(id),
                
                -- Tailored materials
                tailored_resume_json TEXT,          -- Structured tailored resume
                tailored_resume_path TEXT,          -- Path to generated .docx
                cover_letter TEXT,
                
                -- ATS analysis
                ats_score REAL,
                ats_keywords_matched TEXT,          -- JSON array
                ats_keywords_missing TEXT,          -- JSON array
                
                -- Application status
                status TEXT DEFAULT 'draft',        -- draft, ready, submitted, confirmed
                submitted_at TEXT,
                submitted_via TEXT,                  -- 'manual', 'easy_apply', 'greenhouse', etc.
                
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            );

            -- Outreach messages
            CREATE TABLE IF NOT EXISTS outreach (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                job_id INTEGER REFERENCES jobs(id),
                application_id INTEGER REFERENCES applications(id),
                
                -- Target
                recipient_name TEXT,
                recipient_title TEXT,
                recipient_linkedin_url TEXT,
                recipient_type TEXT,                -- 'recruiter', 'hiring_manager'
                
                -- Message
                message_type TEXT,                  -- 'connection_request', 'inmail', 'follow_up'
                message_text TEXT,
                
                -- Status
                status TEXT DEFAULT 'draft',        -- draft, approved, sent, replied
                scheduled_for TEXT,
                sent_at TEXT,
                
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            );

            -- Create indexes
            CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
            CREATE INDEX IF NOT EXISTS idx_jobs_score ON jobs(score DESC);
            CREATE INDEX IF NOT EXISTS idx_jobs_external_id ON jobs(external_id);
            CREATE INDEX IF NOT EXISTS idx_applications_job_id ON applications(job_id);
            CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
            CREATE INDEX IF NOT EXISTS idx_outreach_status ON outreach(status);
        """)
        await db.commit()


# ---- Job CRUD ----

async def insert_job(job_data: dict) -> int:
    """Insert a new job. Returns the job ID."""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        cursor = await db.execute("""
            INSERT OR IGNORE INTO jobs 
            (external_id, title, company, location, salary_min, salary_max, 
             description, url, source, posted_date, score, score_breakdown, raw_data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            job_data.get("external_id"),
            job_data["title"],
            job_data["company"],
            job_data.get("location"),
            job_data.get("salary_min"),
            job_data.get("salary_max"),
            job_data.get("description"),
            job_data["url"],
            job_data.get("source"),
            job_data.get("posted_date"),
            job_data.get("score"),
            json.dumps(job_data.get("score_breakdown", {})),
            json.dumps(job_data.get("raw_data", {})),
        ))
        await db.commit()
        return cursor.lastrowid


async def get_jobs(status: str = None, min_score: float = None, limit: int = 50) -> list:
    """Get jobs with optional filters."""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        query = "SELECT * FROM jobs WHERE 1=1"
        params = []
        
        if status:
            query += " AND status = ?"
            params.append(status)
        if min_score is not None:
            query += " AND score >= ?"
            params.append(min_score)
        
        query += " ORDER BY score DESC, discovered_at DESC LIMIT ?"
        params.append(limit)
        
        cursor = await db.execute(query, params)
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]


async def update_job_status(job_id: int, status: str):
    """Update a job's status."""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.execute(
            "UPDATE jobs SET status = ?, updated_at = datetime('now') WHERE id = ?",
            (status, job_id)
        )
        await db.commit()


# ---- Application CRUD ----

async def insert_application(app_data: dict) -> int:
    """Insert a new application. Returns the application ID."""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        cursor = await db.execute("""
            INSERT INTO applications 
            (job_id, tailored_resume_json, tailored_resume_path, cover_letter,
             ats_score, ats_keywords_matched, ats_keywords_missing)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            app_data["job_id"],
            json.dumps(app_data.get("tailored_resume_json", {})),
            app_data.get("tailored_resume_path"),
            app_data.get("cover_letter"),
            app_data.get("ats_score"),
            json.dumps(app_data.get("ats_keywords_matched", [])),
            json.dumps(app_data.get("ats_keywords_missing", [])),
        ))
        await db.commit()
        return cursor.lastrowid


async def get_application(job_id: int) -> Optional[dict]:
    """Get application for a specific job."""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM applications WHERE job_id = ? ORDER BY created_at DESC LIMIT 1",
            (job_id,)
        )
        row = await cursor.fetchone()
        return dict(row) if row else None


# ---- Outreach CRUD ----

async def get_outreach(status: str = None) -> list:
    """Get outreach messages with optional status filter."""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        query = "SELECT * FROM outreach WHERE 1=1"
        params = []
        if status:
            query += " AND status = ?"
            params.append(status)
        query += " ORDER BY created_at DESC"
        cursor = await db.execute(query, params)
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]


async def insert_outreach(outreach_data: dict) -> int:
    """Insert a new outreach message. Returns the outreach ID."""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        cursor = await db.execute("""
            INSERT INTO outreach 
            (job_id, application_id, recipient_name, recipient_title, 
             recipient_linkedin_url, recipient_type, message_type, message_text, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            outreach_data.get("job_id"),
            outreach_data.get("application_id"),
            outreach_data.get("recipient_name"),
            outreach_data.get("recipient_title"),
            outreach_data.get("recipient_linkedin_url"),
            outreach_data.get("recipient_type"),
            outreach_data.get("message_type"),
            outreach_data.get("message_text"),
            outreach_data.get("status", "draft"),
        ))
        await db.commit()
        return cursor.lastrowid
