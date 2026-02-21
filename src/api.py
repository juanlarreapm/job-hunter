"""
Job Hunter API — FastAPI Backend

Routes for job discovery, resume tailoring, applications, and outreach.
"""
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
import json
import anthropic
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent.parent / ".env", override=True)

from src.models.database import (
    init_db, get_jobs, insert_job, update_job_status,
    insert_application, get_application,
    get_outreach, insert_outreach
)
from src.agents.tailoring import tailor_resume, load_base_resume
from src.agents.discovery import run_discovery, load_preferences
from src.agents.outreach import draft_outreach
from src.utils.docx_builder import build_docx

app = FastAPI(title="Job Hunter", version="0.1.0")

# CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Anthropic client — initialized once, reused across requests
_anthropic_client = None


def get_anthropic_client() -> anthropic.AsyncAnthropic:
    """Get or create the Anthropic async client."""
    global _anthropic_client
    if _anthropic_client is None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key or api_key == "your_anthropic_api_key_here":
            raise HTTPException(500, "ANTHROPIC_API_KEY not configured in .env")
        _anthropic_client = anthropic.AsyncAnthropic(api_key=api_key)
    return _anthropic_client


@app.on_event("startup")
async def startup():
    await init_db()


# ---- Health ----

@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}


# ---- Jobs ----

class JobFilter(BaseModel):
    status: Optional[str] = None
    min_score: Optional[float] = None
    limit: int = 50

@app.get("/api/jobs")
async def list_jobs(status: str = None, min_score: float = None, limit: int = 50):
    """List jobs with optional filters."""
    jobs = await get_jobs(status=status, min_score=min_score, limit=limit)
    return {"jobs": jobs, "count": len(jobs)}

@app.get("/api/jobs/{job_id}")
async def get_job(job_id: int):
    """Get a single job by ID."""
    jobs = await get_jobs()
    job = next((j for j in jobs if j["id"] == job_id), None)
    if not job:
        raise HTTPException(404, f"Job {job_id} not found")
    return job

@app.post("/api/jobs/{job_id}/status")
async def change_job_status(job_id: int, status: str):
    """Update job status (reviewed, favorited, rejected, archived)."""
    valid_statuses = ["new", "reviewed", "favorited", "applied", "rejected", "archived"]
    if status not in valid_statuses:
        raise HTTPException(400, f"Invalid status. Must be one of: {valid_statuses}")
    await update_job_status(job_id, status)
    return {"ok": True}

@app.post("/api/jobs/discover")
async def trigger_discovery():
    """Trigger a job discovery run. Searches, scores, and stores new jobs."""
    serpapi_key = os.getenv("SERPAPI_API_KEY")
    if not serpapi_key or serpapi_key == "your_serpapi_key_here":
        raise HTTPException(500, "SERPAPI_API_KEY not configured in .env")

    client = get_anthropic_client()
    jobs = await run_discovery(serpapi_key, client)

    saved = 0
    for job in jobs:
        job_id = await insert_job(job)
        if job_id:
            saved += 1

    return {
        "status": "ok",
        "found": len(jobs),
        "saved": saved,
        "top_jobs": [
            {"title": j["title"], "company": j["company"], "score": round(j["score"], 2)}
            for j in jobs[:5]
        ],
    }


# ---- Applications ----

class TailorRequest(BaseModel):
    job_id: int
    job_description: str
    company_info: Optional[str] = None

@app.post("/api/applications/tailor")
async def tailor_for_job(request: TailorRequest):
    """Generate tailored resume + cover letter for a specific job."""
    client = get_anthropic_client()

    result = await tailor_resume(
        request.job_description, client, company_info=request.company_info
    )

    # Generate .docx resume
    tailored_resume = result["tailored_resume"]
    company_slug = request.company_info[:20].strip() if request.company_info else f"job{request.job_id}"
    filename = f"resume_{tailored_resume.get('contact', {}).get('name', 'Juan').replace(' ', '_')}_{company_slug}"
    docx_path = build_docx(tailored_resume, filename)

    app_id = await insert_application({
        "job_id": request.job_id,
        "tailored_resume_json": result["tailored_resume"],
        "tailored_resume_path": str(docx_path),
        "cover_letter": result["cover_letter"],
        "ats_score": result["ats_analysis"]["score"],
        "ats_keywords_matched": result["ats_analysis"]["keywords_matched"],
        "ats_keywords_missing": result["ats_analysis"]["keywords_missing"],
    })

    return {"application_id": app_id, "docx_path": str(docx_path), **result}

@app.get("/api/applications/{job_id}")
async def get_job_application(job_id: int):
    """Get the tailored application for a job."""
    application = await get_application(job_id)
    if not application:
        raise HTTPException(404, "No application found for this job")
    return application

@app.get("/api/applications/{job_id}/download")
async def download_resume(job_id: int):
    """Download the tailored resume .docx for a job."""
    application = await get_application(job_id)
    if not application:
        raise HTTPException(404, "No application found for this job")
    resume_path = application.get("tailored_resume_path")
    if not resume_path or not Path(resume_path).exists():
        raise HTTPException(404, "Resume file not found on disk")
    return FileResponse(
        resume_path,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=Path(resume_path).name,
    )


# ---- Outreach ----

@app.get("/api/outreach")
async def list_outreach(status: str = None):
    """List outreach messages."""
    messages = await get_outreach(status=status)
    return {"messages": messages, "count": len(messages)}

class OutreachRequest(BaseModel):
    job_id: int
    recipient_name: str
    recipient_title: str
    recipient_linkedin_url: Optional[str] = None
    recipient_type: str = "recruiter"  # recruiter | hiring_manager
    message_type: str = "connection_request"

@app.post("/api/outreach/draft")
async def draft_outreach_message(request: OutreachRequest):
    """Draft an outreach message for review."""
    client = get_anthropic_client()

    # Get the job for context
    jobs = await get_jobs()
    job = next((j for j in jobs if j["id"] == request.job_id), None)
    if not job:
        raise HTTPException(404, f"Job {request.job_id} not found")

    message_text = await draft_outreach(
        job_title=job["title"],
        company=job["company"],
        recipient_name=request.recipient_name,
        recipient_title=request.recipient_title,
        message_type=request.message_type,
        anthropic_client=client,
    )

    outreach_id = await insert_outreach({
        "job_id": request.job_id,
        "recipient_name": request.recipient_name,
        "recipient_title": request.recipient_title,
        "recipient_linkedin_url": request.recipient_linkedin_url,
        "recipient_type": request.recipient_type,
        "message_type": request.message_type,
        "message_text": message_text,
        "status": "draft",
    })

    return {"outreach_id": outreach_id, "message": message_text}


# ---- Preferences ----

@app.get("/api/preferences")
async def get_preferences():
    """Get current job search preferences."""
    return load_preferences()

@app.get("/api/resume")
async def get_base_resume():
    """Get the base resume data."""
    return load_base_resume()
