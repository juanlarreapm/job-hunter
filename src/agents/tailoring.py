"""
Resume Tailoring Agent

Takes a job description + base resume and produces:
1. A tailored resume (reordered bullets, keyword-optimized)
2. A cover letter
3. An ATS compatibility analysis
"""
import json
import re
from pathlib import Path

# Claude API client will be initialized with actual key
# For now, this defines the prompts and logic

BASE_RESUME_PATH = Path(__file__).parent.parent.parent / "data" / "base_resume.json"


def load_base_resume() -> dict:
    """Load the structured base resume."""
    with open(BASE_RESUME_PATH) as f:
        return json.load(f)


TAILORING_SYSTEM_PROMPT = """You are an expert resume tailoring assistant. Given a candidate's base resume and a target job description, produce a tailored resume, ATS analysis, and cover letter in a single response.

RESUME RULES:
1. Never fabricate experience, skills, or achievements. Only use what's in the base resume.
2. Rewrite bullet points to emphasize skills and keywords that match the job description.
3. Reorder experience bullets so the most relevant ones come first.
4. Mirror language from the job description where truthful.
5. Keep bullet points concise — strong action verbs, metrics where available.
6. For roles older than 5 years, condense or omit bullets that aren't relevant.
7. Use standard section headers; no tables or graphics.

COVER LETTER RULES:
1. 3-4 short paragraphs, under 300 words.
2. Open with genuine enthusiasm — reference something specific about the role or company.
3. Connect 2-3 of the candidate's most relevant achievements to what the company needs.
4. Close with a confident, forward-looking statement.
5. Tone: professional but warm, confident but not arrogant.
6. Never use phrases like "I believe I would be a great fit" or "I am writing to express my interest."

OUTPUT FORMAT — return a single JSON object:
{
  "tailored_resume": {
    "contact": { ... },
    "summary": "2-3 sentence professional summary tailored to this role",
    "experience": [
      {
        "id": "...",
        "title": "...",
        "company": "...",
        "dates": "...",
        "location": "...",
        "bullets": ["tailored bullet 1", ...]
      }
    ],
    "skills": ["skill1", ...]
  },
  "ats_analysis": {
    "score": 0.85,
    "keywords_matched": ["keyword1", ...],
    "keywords_missing": ["keyword3"],
    "suggestions": ["suggestion"]
  },
  "tailoring_notes": "Brief explanation of key changes made",
  "cover_letter": "Full cover letter text ready to send"
}"""


def build_tailoring_prompt(job_description: str, base_resume: dict, company_info: str = "") -> list:
    """Build the messages array for the tailoring API call."""
    company_section = f"\nCOMPANY INFO:\n{company_info}" if company_info else ""
    return [
        {
            "role": "user",
            "content": f"""CANDIDATE RESUME:
{json.dumps(base_resume)}

JOB DESCRIPTION:
{job_description}{company_section}

Tailor the resume and write the cover letter for this role. Return the JSON output."""
        }
    ]


async def tailor_resume(job_description: str, anthropic_client, company_info: str = "") -> dict:
    """
    Main entry point: takes a job description, returns tailored materials.

    Returns:
        {
            "tailored_resume": {...},
            "ats_analysis": {...},
            "tailoring_notes": "...",
            "cover_letter": "..."
        }
    """
    base_resume = load_base_resume()

    response = await anthropic_client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        system=TAILORING_SYSTEM_PROMPT,
        messages=build_tailoring_prompt(job_description, base_resume, company_info=company_info)
    )

    # Parse response — strip markdown code fences if present
    raw_text = response.content[0].text.strip()
    match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', raw_text)
    if match:
        raw_text = match.group(1)

    return json.loads(raw_text)
