"""
Outreach Agent

Drafts personalized LinkedIn messages for recruiters and hiring managers.
All messages go to the dashboard for manual review and sending.
"""
import json


OUTREACH_TEMPLATES = {
    "connection_request": {
        "max_chars": 280,
        "system_prompt": """Draft a LinkedIn connection request note. Max 280 characters.
Be specific about the role. Be genuine and concise. No fluff."""
    },
    "follow_up": {
        "max_chars": 500,
        "system_prompt": """Draft a brief follow-up message for someone who accepted your 
connection request but hasn't responded. Keep it under 500 characters. 
Be respectful of their time. Reference the specific role."""
    },
    "inmail": {
        "max_chars": 1900,
        "system_prompt": """Draft a LinkedIn InMail message. Max 1900 characters.
Open with something specific about the company or role. Connect your experience 
to what they need. Close with a clear but low-pressure ask."""
    }
}


async def draft_outreach(
    job_title: str,
    company: str,
    recipient_name: str,
    recipient_title: str,
    message_type: str,
    anthropic_client,
    candidate_resume: dict = None,
    additional_context: str = ""
) -> str:
    """
    Draft an outreach message for review.
    
    Args:
        job_title: The role being applied to
        company: Company name
        recipient_name: Name of recruiter/HM
        recipient_title: Their title
        message_type: 'connection_request', 'follow_up', or 'inmail'
        anthropic_client: Anthropic API client
        candidate_resume: Optional tailored resume for context
        additional_context: Any extra context (e.g., mutual connections)
    
    Returns:
        Draft message text
    """
    template = OUTREACH_TEMPLATES.get(message_type, OUTREACH_TEMPLATES["connection_request"])
    
    context_parts = [
        f"Role: {job_title} at {company}",
        f"Recipient: {recipient_name}, {recipient_title}",
        f"Max length: {template['max_chars']} characters",
    ]
    
    if additional_context:
        context_parts.append(f"Additional context: {additional_context}")
    
    if candidate_resume:
        # Include key highlights for personalization
        highlights = candidate_resume.get("highlights", {})
        context_parts.append(f"Candidate highlights: {json.dumps(highlights)}")
    
    response = await anthropic_client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=256,
        system=template["system_prompt"],
        messages=[{
            "role": "user",
            "content": "\n".join(context_parts)
        }]
    )
    
    return response.content[0].text


def get_follow_up_schedule(initial_send_date: str) -> list:
    """
    Generate a follow-up schedule.
    
    Returns list of follow-up dates and types:
    - Day 5: Gentle follow-up if connection accepted but no reply
    - Day 14: Second follow-up
    - Day 30: Final check-in
    """
    from datetime import datetime, timedelta
    
    base = datetime.fromisoformat(initial_send_date)
    
    return [
        {
            "date": (base + timedelta(days=5)).isoformat(),
            "type": "follow_up",
            "note": "Gentle follow-up — reference the role, add value"
        },
        {
            "date": (base + timedelta(days=14)).isoformat(),
            "type": "follow_up",
            "note": "Second follow-up — brief, respectful"
        },
        {
            "date": (base + timedelta(days=30)).isoformat(),
            "type": "follow_up",
            "note": "Final check-in — keep the door open"
        },
    ]
