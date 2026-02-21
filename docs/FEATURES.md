# Planned Features

## 1. View Current Default Resume
Display the base resume (`data/base_resume.json`) in the dashboard so Juan can review what the AI is working from at any time.

- Read and render `data/base_resume.json` in the frontend
- Show it in a clean, structured layout (not raw JSON)
- Sections: summary, experience, skills, education, etc.

---

## 2. Compare Default Resume vs. Tailored Resume
Side-by-side diff view between the base resume and the tailored version generated for a specific job.

- Show original vs. tailored content section by section
- Highlight additions, removals, and rewrites (diff-style)
- Accessible from the job detail view after tailoring runs
- Should show cover letter alongside or as a separate tab

---

## 3. Fix Job Dashboard UX
Improve how jobs are displayed on the main dashboard.

- Card layout with key info: title, company, salary, match score, date found
- Status badges (new, tailored, applied, rejected)
- Filter/sort by score, date, status, company
- Click-through to job detail page
- Don't show raw data or wall-of-text descriptions

---

## 4. Manual Job Entry (Paste JD or URL)
Add a job manually — paste in a raw job description or enter a URL — and trigger the full tailoring pipeline from the UI without waiting for the discovery agent to find it.

- Input form with two modes:
  - **Paste mode** — textarea to paste raw JD text directly
  - **URL mode** — URL field that scrapes the job posting (title, company, description) on submit
- On submit, save the job to the DB (status: `new`) and immediately kick off resume tailoring
- Resulting tailored resume and cover letter accessible from the job detail view (same as discovered jobs)
- Optionally allow overriding title/company fields before saving
- Backend: new `POST /api/jobs/manual` route that accepts `{ jd_text?, url?, title?, company? }`, scrapes URL if provided, then calls `tailor_resume()`

---

## 5. Settings Page
Editable UI for Juan's job search configuration — no more editing JSON files manually.

- **Default Resume editor** — edit work experience, skills, summary, etc.
- **Preferences editor** — target salary, locations, company types, keywords
- **Search queries** — add/remove SerpAPI search strings
- **Scoring weights** — adjust what the AI prioritizes (salary, company size, etc.)
- Changes should persist to `data/base_resume.json` and `data/preferences.json`
