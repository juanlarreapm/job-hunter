# Claude Code Development Guide — Job Hunter

## Project Overview
Job Hunter is an AI-powered job search agent for Juan Larrea, a Senior PM looking for remote PM roles ($180k+). It discovers jobs, tailors resumes, generates cover letters, and queues everything for one-click application via a dashboard.

## Current State (as of February 2026)
- ✅ Project structure created
- ✅ Base resume parsed into structured JSON (`data/base_resume.json`)
- ✅ Job preferences configured (`data/preferences.json`)
- ✅ Database schema + CRUD (`src/models/database.py`) — SQLite with jobs, applications, outreach tables
- ✅ Resume tailoring agent (`src/agents/tailoring.py`) — Claude Sonnet, full JSON output
- ✅ Job discovery agent (`src/agents/discovery.py`) — SerpAPI + Claude Haiku scoring, fully wired
- ✅ Outreach agent (`src/agents/outreach.py`) — Claude Haiku, 3 message types
- ✅ FastAPI backend (`src/api.py`) — all routes live, zero 501s
- ✅ API keys configured (`.env` — Anthropic + SerpAPI)
- ✅ DOCX generation (`src/utils/docx_builder.py`) — ATS-compliant, 6 resumes already generated
- ✅ Frontend dashboard (`frontend/`) — Next.js 16, React 19, Tailwind 4, dark mode
  - Job feed with filters + score coloring
  - Job detail: full JD + resume/cover letter/ATS analysis tabs
  - Tailoring trigger + .docx download
  - Outreach drafting + message queue with copy-to-clipboard
- ⬜ Application submission (Playwright — Priority 1)
- ⬜ Stats/analytics view (UI scaffolded, needs backend metrics — Priority 2)
- ⬜ `src/services/` and `src/config/` (currently empty — low priority refactor)

## Tech Stack
- **Backend:** Python 3.12+, FastAPI, SQLite (aiosqlite)
- **Frontend:** Next.js, React, Tailwind CSS
- **AI:** Claude API (Anthropic) via `anthropic` Python SDK
- **Job Search:** SerpAPI (`google-search-results` package)
- **Resume Gen:** `python-docx`
- **Future:** Playwright for ATS form automation

## Development Priorities (in order)

### Priority 1: Application Submission (Playwright)
- Start with Greenhouse and Lever form automation
- Map common form fields (name, email, resume upload, cover letter, LinkedIn URL)
- Always open a preview before submitting — never auto-submit without review

### Priority 2: Stats / Analytics Dashboard
- Backend: add a `/api/stats` route returning jobs discovered, applications created, response rate, etc.
- Frontend: wire up the stats view (UI scaffolding already in place)

### Priority 3: Outreach Polish
- Add recruiter/HM lookup (manual for now, can parse from job listings)
- Follow-up scheduling with reminders
- Message templates for different scenarios

## Key Design Decisions

### LinkedIn Safety
- NEVER automate anything directly on LinkedIn
- Job discovery goes through Google search (SerpAPI) with `site:linkedin.com/jobs`
- Outreach messages are drafted for manual sending
- Application links open in browser for LinkedIn Easy Apply

### Human-in-the-Loop
- Every action that sends data externally requires user approval via the dashboard
- The agent prepares everything; Juan clicks "Apply" / "Send" / "Approve"
- No auto-submissions, no auto-messages

### Resume Tailoring Philosophy  
- Never fabricate experience or skills
- Rewrite and reorder bullets to match JD language
- Add a tailored professional summary
- Mirror keywords from the job description where truthful
- Keep it to 1 page (condense older roles)

## File Reference
```
data/base_resume.json          — Juan's structured resume (source of truth)
data/preferences.json          — Job search criteria and scoring weights
data/jobs.db                   — SQLite database (jobs, applications, outreach)
data/resumes/                  — Generated .docx tailored resumes
src/api.py                     — FastAPI routes (all live)
src/agents/tailoring.py        — Resume + cover letter generation (Claude Sonnet)
src/agents/discovery.py        — Job search and scoring (SerpAPI + Claude Haiku)
src/agents/outreach.py         — LinkedIn message drafting (Claude Haiku)
src/models/database.py         — SQLite schema and CRUD operations
src/utils/docx_builder.py      — ATS-compliant .docx generation (python-docx)
frontend/app/page.tsx          — Job feed (filters, score cards, run discovery)
frontend/app/jobs/[id]/page.tsx — Job detail (JD, resume/CL/ATS tabs, download)
frontend/app/outreach/page.tsx — Outreach queue (copy-to-clipboard)
frontend/components/Sidebar.tsx — Navigation
frontend/lib/api.ts            — TypeScript API client
.env.example                   — Required environment variables
```

## Environment Setup
```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Add API keys to .env
uvicorn src.api:app --reload --port 8000
```

## Notes for Claude Code
- DOCX files: no tables, no columns, no graphics — ATS systems choke on these (already enforced in docx_builder.py).
- The scoring weights in preferences.json can be tuned — start with the defaults and adjust based on results.
- Keep API calls efficient — use prompt caching where possible (Juan is cost-conscious about AI API usage).
- Discovery uses Claude Haiku for scoring (cost) and Sonnet for tailoring (quality). Don't swap these.
- The database is SQLite for simplicity. If this scales, migration to Postgres would be straightforward since we're using async patterns already.
- Frontend runs on port 3000, backend on port 8000. `frontend/.env.local` points to localhost:8000.
