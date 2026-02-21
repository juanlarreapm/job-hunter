# Job Hunter — Lab Post Draft

## Metadata

| Field | Value |
|---|---|
| **Title** | Job Hunter |
| **Tagline** | An AI agent that finds, scores, and tailors job applications — so you only focus on what's worth your time |
| **Status** | active |
| **Date** | February 2026 |
| **Tech Stack** | `Python` `FastAPI` `SQLite` `Claude` `SerpAPI` `Next.js` |
| **GitHub** | your job-hunter repo URL |

---

## Description

Job searching at the senior level is its own full-time job. You're not just submitting applications — you're strategically positioning yourself, tailoring every resume for every JD, writing cover letters that don't sound like everyone else's, and doing all of this while currently employed. The signal-to-noise ratio is brutal. Most job boards surface roles that don't fit. Most applications go into a black hole.

I wanted to build an agent that does the grunt work for me. Not to fully automate the process — I'm a firm believer in human-in-the-loop for anything that represents me professionally — but to handle the discovery, the scoring, and the tailoring, so that by the time I'm making a decision, I'm only looking at high-quality opportunities with a ready-to-submit package sitting next to them.

The core loop has three phases: discover, score, tailor. Discovery pulls job listings using SerpAPI, running parallel Google searches with queries I configured in a preferences file — remote-only, senior PM, $180k+. Every result gets stored in a SQLite database with the full job description and metadata. Deduplication happens by URL hash so the same listing doesn't surface twice across searches.

Scoring is where I spent the most time thinking. Each job gets evaluated against a set of weighted criteria: salary range, remote policy, company size, industry, and seniority signal. I'm using Claude Haiku for this — it's fast and cheap, which matters when you're scoring dozens of results at once. Claude reads the raw job description and extracts structured signals: does this actually pay what it says, is it actually remote, is this a real PM role or a project coordinator with a fancier title. The output is a normalized score I can sort and filter on. I set a minimum threshold below which jobs don't even surface — I don't want to see noise.

Tailoring is the part I was most excited to build. Once a job clears the score threshold and I decide it's worth pursuing, I trigger a tailoring request from the dashboard. Claude Sonnet reads my base resume — stored as structured JSON and treated as the source of truth — alongside the job description, and outputs a tailored resume with rewritten bullets, a role-specific professional summary, a cover letter, and an ATS analysis. The ATS analysis includes a keyword match score plus a list of terms from the JD that appear in the tailored resume and those that are still missing. The whole package comes back in one API call.

The tailored resume then goes through a DOCX builder that produces an ATS-compliant Word file. The constraints here are real: no tables, no columns, no text boxes, no graphics. ATS parsers are notoriously bad at anything that isn't clean, linear text. Calibri font, proper margins, standard section headers. I've already run six real PM job descriptions through it — for companies like Linear, Dealerware, and Perfect Venue — and the output drops right into an ATS upload field.

The frontend is a dark-mode Next.js dashboard. The main view is a job feed with filter tabs (new, favorited, applied, archived) and score-colored cards. Clicking into a job gives you the full JD on the left and tabs for the tailored resume, cover letter, and ATS analysis on the right. There's a "Generate" button to trigger tailoring and a "Download" button to grab the .docx. The outreach section lets me draft a LinkedIn message for any job — I specify the recipient's name and title, pick a message type (connection request, follow-up, or InMail), and Claude generates it for manual review before I send anything. Nothing goes out automatically.

The design rules I set for myself upfront: never fabricate resume content, never auto-submit applications, never automate anything directly on LinkedIn. Every action that touches the outside world requires me to click a button. The agent prepares everything; I make the call.

What's left: I want to add Playwright integration for ATS form auto-fill — not auto-submit, just pre-populating the fields so I'm one review away from applying. And I want to build out the stats view to track how many jobs I've run through the pipeline, what my application rate is, and eventually response rate. The core loop is working today. Thanks for reading :)
