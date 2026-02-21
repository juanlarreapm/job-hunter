# 🎯 Job Hunter — AI-Powered Job Search Agent

An autonomous job search agent that discovers PM roles, tailors your resume for each one, generates cover letters, and queues everything for one-click application — all with you in the loop.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Dashboard (Next.js)               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │ Job Feed │ │ Review   │ │ Outreach │ │ Stats  │ │
│  │ & Scores │ │ & Apply  │ │ Queue    │ │        │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘ │
└──────────────────────┬──────────────────────────────┘
                       │ API
┌──────────────────────┴──────────────────────────────┐
│                 Python Backend (FastAPI)              │
│                                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │  Discovery   │  │   Tailoring  │  │  Outreach  │  │
│  │  Agent       │  │   Agent      │  │  Agent     │  │
│  │             │  │              │  │            │  │
│  │ • SerpAPI   │  │ • Resume     │  │ • Message  │  │
│  │ • Scoring   │  │ • Cover Ltr  │  │   Drafting │  │
│  │ • Dedup     │  │ • ATS Check  │  │ • Follow-up│  │
│  └─────────────┘  └──────────────┘  └────────────┘  │
│                                                      │
│  ┌─────────────────────────────────────────────────┐ │
│  │              SQLite Database                     │ │
│  │  jobs | applications | outreach | preferences   │ │
│  └─────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

## Tech Stack

- **Backend:** Python 3.12+, FastAPI, SQLite
- **Frontend:** Next.js (React), Tailwind CSS
- **AI:** Claude API (Anthropic) — resume tailoring, cover letters, job scoring, outreach drafting
- **Job Discovery:** SerpAPI (Google Jobs search, avoids direct LinkedIn scraping)
- **Resume Generation:** python-docx
- **Browser Automation (future):** Playwright (for ATS form submission)

## Project Structure

```
job-hunter/
├── src/
│   ├── agents/           # AI agent logic
│   │   ├── discovery.py  # Job discovery & scoring
│   │   ├── tailoring.py  # Resume & cover letter generation
│   │   └── outreach.py   # Recruiter/HM message drafting
│   ├── services/         # External service integrations
│   │   ├── serpapi.py     # SerpAPI client
│   │   ├── claude.py      # Anthropic API client
│   │   └── ats.py         # ATS form submission (Playwright)
│   ├── models/           # Database models
│   │   └── database.py    # SQLite schema & queries
│   ├── utils/            # Helpers
│   │   ├── resume_parser.py
│   │   └── docx_builder.py
│   ├── config/           # Configuration
│   │   └── preferences.py
│   └── api.py            # FastAPI routes
├── frontend/             # Next.js dashboard
├── data/
│   ├── base_resume.json  # Structured resume data
│   └── jobs.db           # SQLite database
├── templates/            # Resume & cover letter templates
├── docs/                 # Documentation
│   └── CLAUDE_CODE.md    # Instructions for Claude Code
├── .env.example          # Environment variables template
├── requirements.txt
└── README.md
```

## Getting Started

### Prerequisites
- Python 3.12+
- Node.js 20+
- API Keys: Anthropic (Claude), SerpAPI

### Setup
```bash
# Clone and setup
cd job-hunter
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Configure
cp .env.example .env
# Add your API keys to .env

# Run backend
uvicorn src.api:app --reload

# Run frontend (in separate terminal)
cd frontend
npm install
npm run dev
```

## Development Phases

### Phase 1: Resume Tailoring Engine ← START HERE
- Parse base resume into structured JSON
- Build Claude-powered tailoring agent
- Generate ATS-optimized .docx output
- Cover letter generation

### Phase 2: Job Discovery
- SerpAPI integration for job search
- Claude-powered job scoring against preferences
- Deduplication and tracking

### Phase 3: Dashboard
- Next.js UI to review jobs, tailored resumes, and applications
- One-click apply workflow

### Phase 4: Application Automation
- Playwright-based ATS form submission
- Support for Greenhouse, Lever, Workday

### Phase 5: Outreach
- Recruiter/HM identification
- Personalized message drafting
- Follow-up scheduling

## LinkedIn Safety

This project deliberately avoids any direct automation of LinkedIn to protect your account:
- Job discovery uses Google search (via SerpAPI) with `site:linkedin.com/jobs`
- No LinkedIn login, scraping, or API abuse
- Outreach messages are drafted for you to send manually
- Application links open in your browser for LinkedIn Easy Apply
