# Claude Code Development Guide — Job Hunter

## Project Overview
Job Hunter is an AI-powered job search agent for Juan Larrea, a Senior PM looking for remote PM roles ($180k+). It discovers jobs, tailors resumes, generates cover letters, and queues everything for one-click application via a dashboard.

## Current State (as of project scaffolding)
- ✅ Project structure created
- ✅ Base resume parsed into structured JSON (`data/base_resume.json`)
- ✅ Job preferences configured (`data/preferences.json`)
- ✅ Database schema defined (`src/models/database.py`) — SQLite with jobs, applications, outreach tables
- ✅ Resume tailoring agent with prompts (`src/agents/tailoring.py`)
- ✅ Job discovery agent with scoring (`src/agents/discovery.py`)
- ✅ Outreach agent with templates (`src/agents/outreach.py`)
- ✅ FastAPI backend with routes (`src/api.py`)
- ⬜ Frontend dashboard (Next.js)
- ⬜ API keys integration
- ⬜ DOCX resume generation
- ⬜ End-to-end testing

## Tech Stack
- **Backend:** Python 3.12+, FastAPI, SQLite (aiosqlite)
- **Frontend:** Next.js, React, Tailwind CSS
- **AI:** Claude API (Anthropic) via `anthropic` Python SDK
- **Job Search:** SerpAPI (`google-search-results` package)
- **Resume Gen:** `python-docx`
- **Future:** Playwright for ATS form automation

## Development Priorities (in order)

### Priority 1: Get Resume Tailoring Working End-to-End
This is the highest-value feature. Steps:
1. Set up `.env` with `ANTHROPIC_API_KEY`
2. Wire up the Anthropic client in `src/api.py` 
3. Test the `/api/applications/tailor` endpoint with a real job description
4. Add DOCX generation (`src/utils/docx_builder.py`) — take the tailored JSON and produce a clean, ATS-friendly .docx file
5. Test with a few real PM job descriptions from LinkedIn

### Priority 2: Job Discovery Pipeline
1. Set up `.env` with `SERPAPI_API_KEY`
2. Wire up the SerpAPI client 
3. Test the discovery agent with the configured search queries
4. Verify scoring produces reasonable results
5. Store results in SQLite and expose via `/api/jobs`

### Priority 3: Next.js Dashboard
Build a clean dashboard with these views:
- **Job Feed:** Cards showing discovered jobs, sorted by score. Each card shows title, company, score, location, salary range. Click to expand full description.
- **Application Review:** For a selected job, show the tailored resume (side-by-side with original), cover letter, ATS analysis. "Apply" button.
- **Outreach Queue:** Draft messages waiting for approval. One-click copy to clipboard.
- **Stats:** Jobs discovered, applications sent, response rate, etc.

UI preferences: Clean, minimal, professional. Dark mode would be nice. Think Linear or Notion-inspired.

### Priority 4: Application Submission (Playwright)
- Start with Greenhouse and Lever form automation
- Map common form fields (name, email, resume upload, cover letter, LinkedIn URL)
- Always open a preview before submitting — never auto-submit without review

### Priority 5: Outreach Polish
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
data/base_resume.json     — Juan's structured resume (source of truth)
data/preferences.json     — Job search criteria and scoring weights
src/agents/tailoring.py   — Resume + cover letter generation prompts
src/agents/discovery.py   — Job search and scoring logic
src/agents/outreach.py    — LinkedIn message drafting
src/models/database.py    — SQLite schema and CRUD operations
src/api.py                — FastAPI routes
.env.example              — Required environment variables
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
- When generating DOCX files, use clean formatting: no tables, no columns, no graphics. ATS systems choke on these.
- For the frontend, use `npx create-next-app@latest frontend --typescript --tailwind --app` to initialize.
- The scoring weights in preferences.json can be tuned — start with the defaults and adjust based on results.
- Keep API calls efficient — use prompt caching where possible (Juan is cost-conscious about AI API usage).
- The database is SQLite for simplicity. If this scales, migration to Postgres would be straightforward since we're using async patterns already.
