"""
Job Discovery Agent

Searches for PM jobs via SerpAPI (Google Jobs), scores them against
candidate preferences, deduplicates, and stores in the database.
"""
import json
import hashlib
import asyncio
import re
from pathlib import Path

PREFERENCES_PATH = Path(__file__).parent.parent.parent / "data" / "preferences.json"


def load_preferences() -> dict:
    """Load candidate job search preferences."""
    with open(PREFERENCES_PATH) as f:
        return json.load(f)


SCORING_SYSTEM_PROMPT = """You are a job matching expert. Given a candidate's profile/preferences and a job 
listing, score how well this job matches the candidate on a 0-1 scale.

Evaluate these dimensions:
- title_match: How well does the job title align with target titles?
- remote_match: Is this fully remote? (1.0 = remote, 0.5 = hybrid, 0.0 = in-office)
- salary_match: Does the salary range meet the minimum? (1.0 if meets/exceeds, scale down if below)
- company_size_match: Does company size match preferences?
- industry_match: How relevant is the industry?
- skills_match: How well do the required skills match the candidate's experience?
- seniority_match: Is the seniority level appropriate?

OUTPUT FORMAT (JSON):
{
  "overall_score": 0.82,
  "breakdown": {
    "title_match": 0.95,
    "remote_match": 1.0,
    "salary_match": 0.7,
    "company_size_match": 0.8,
    "industry_match": 0.6,
    "skills_match": 0.9,
    "seniority_match": 0.85
  },
  "reasoning": "Brief explanation of the score"
}"""


def generate_external_id(url: str) -> str:
    """Generate a dedup key from the job URL."""
    return hashlib.md5(url.encode()).hexdigest()


async def search_jobs(serpapi_api_key: str, query: str, num_results: int = 10) -> list:
    """
    Search for jobs using SerpAPI Google Jobs engine.
    Runs the blocking SerpAPI call in a thread pool to avoid blocking the event loop.
    """
    from serpapi import GoogleSearch

    def _fetch():
        search = GoogleSearch({
            "engine": "google_jobs",
            "q": query,
            "location": "United States",
            "num": num_results,
            "hl": "en",
            "gl": "us",
            "api_key": serpapi_api_key,
        })
        return search.get_dict().get("jobs_results", [])

    return await asyncio.to_thread(_fetch)


def _scoring_context(preferences: dict) -> dict:
    """Extract only the fields Claude needs for scoring — keeps the prompt small."""
    return {
        "target_titles": preferences["target_titles"],
        "location_requirement": preferences["location"]["requirement"],
        "min_salary": preferences["compensation"]["minimum_base_salary"],
        "preferred_company_sizes": preferences["company"]["preferred_sizes"],
        "preferred_industries": preferences["company"]["industries_preferred"],
        "scoring_weights": preferences["scoring"]["weights"],
    }


async def score_job(job_data: dict, preferences: dict, anthropic_client) -> dict:
    """
    Score a job listing against candidate preferences using Claude.

    Returns score data to be stored in the jobs table.
    """
    response = await anthropic_client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=400,
        system=SCORING_SYSTEM_PROMPT,
        messages=[{
            "role": "user",
            "content": f"""CANDIDATE PREFERENCES:
{json.dumps(_scoring_context(preferences))}

JOB LISTING:
Title: {job_data.get('title', 'Unknown')}
Company: {job_data.get('company_name', 'Unknown')}
Location: {job_data.get('location', 'Unknown')}
Description: {job_data.get('description', 'No description')[:1000]}

Score this job match."""
        }]
    )
    
    text = response.content[0].text
    # Strip markdown code fences if Claude wraps the JSON
    match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', text)
    if match:
        text = match.group(1)
    return json.loads(text.strip())


def _prefilter(job: dict, exclude_keywords: set, dealbreakers: set) -> bool:
    """
    Return True if a job should be kept, False if it can be dropped without
    calling Claude. Catches the obvious mismatches cheaply.
    """
    title = job.get("title", "").lower()
    if any(kw in title for kw in exclude_keywords):
        return False

    location = job.get("location", "").lower()
    description = job.get("description", "").lower()
    # Drop jobs whose location signals on-site/hybrid unless the description
    # explicitly mentions remote anywhere.
    if any(db in location for db in dealbreakers) and "remote" not in description:
        return False

    return True


async def run_discovery(serpapi_api_key: str, anthropic_client) -> list:
    """
    Run a full discovery cycle:
    1. Search all configured queries in parallel
    2. Deduplicate + pre-filter (no API calls)
    3. Score remaining candidates in parallel (concurrency-capped)

    Returns list of new jobs found and scored, sorted by score descending.
    """
    preferences = load_preferences()
    exclude_keywords = {k.lower() for k in preferences["discovery"]["exclude_keywords"]}
    dealbreakers = {k.lower() for k in preferences["location"]["dealbreakers"]}
    min_score = preferences["scoring"]["minimum_score_to_surface"]

    # 1. Run all searches in parallel
    search_results = await asyncio.gather(
        *[search_jobs(serpapi_api_key, q) for q in preferences["search_queries"]],
        return_exceptions=True,
    )

    # 2. Deduplicate + pre-filter
    seen = set()
    candidates = []
    for result in search_results:
        if isinstance(result, Exception):
            continue
        for job in result:
            apply_options = job.get("apply_options") or []
            url = (
                apply_options[0].get("link", "")
                if apply_options
                else job.get("link", "")
            ) or job.get("link", "")
            external_id = generate_external_id(url)
            if external_id in seen:
                continue
            seen.add(external_id)
            if _prefilter(job, exclude_keywords, dealbreakers):
                candidates.append((external_id, url, job))

    # 3. Score all candidates in parallel, capped at 5 concurrent Claude calls
    semaphore = asyncio.Semaphore(5)

    async def _score(external_id: str, url: str, job: dict):
        async with semaphore:
            return external_id, url, job, await score_job(job, preferences, anthropic_client)

    scored = await asyncio.gather(
        *[_score(eid, url, job) for eid, url, job in candidates],
        return_exceptions=True,
    )

    all_jobs = []
    for result in scored:
        if isinstance(result, Exception):
            continue
        external_id, url, job, score_data = result
        if score_data["overall_score"] >= min_score:
            all_jobs.append({
                "external_id": external_id,
                "title": job.get("title", "Unknown"),
                "company": job.get("company_name", "Unknown"),
                "location": job.get("location", "Unknown"),
                "description": job.get("description", ""),
                "url": url,
                "source": "google_jobs",
                "posted_date": job.get("detected_extensions", {}).get("posted_at"),
                "score": score_data["overall_score"],
                "score_breakdown": score_data["breakdown"],
                "raw_data": job,
            })

    all_jobs.sort(key=lambda x: x["score"], reverse=True)
    return all_jobs
