"""Seed the database with a test job for end-to-end testing."""
import asyncio
from src.models.database import init_db, insert_job


async def main():
    await init_db()
    job_id = await insert_job({
        "external_id": "test-001",
        "title": "Senior Product Manager, AI Platform",
        "company": "Acme Corp",
        "location": "Remote",
        "salary_min": 185000,
        "salary_max": 220000,
        "description": "Test job for endpoint validation",
        "url": "https://example.com/jobs/test-001",
        "source": "manual",
        "score": 0.92,
        "score_breakdown": {"title": 0.95, "remote": 1.0, "salary": 0.9},
    })
    print(f"Inserted test job with id={job_id}")


if __name__ == "__main__":
    asyncio.run(main())
