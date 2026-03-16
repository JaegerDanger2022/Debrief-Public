import logging
from typing import Optional

from langchain_aws import ChatBedrock
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel

from debrief_agent.config import get_agent_settings
from debrief_agent.state.session_state import SessionState

log = logging.getLogger(__name__)


class TopicList(BaseModel):
    """Structured output: 1–3 short keyword topics from the session transcript."""
    topics: list[str]


def _build_llm() -> ChatBedrock:
    settings = get_agent_settings()
    return ChatBedrock(
        model_id=settings.bedrock_text_model_id,
        region_name=settings.aws_region,
        aws_access_key_id=settings.aws_access_key_id or None,
        aws_secret_access_key=settings.aws_secret_access_key or None,
    )


def _build_transcript(messages: list) -> Optional[str]:
    chunks = []
    for msg in messages:
        content = getattr(msg, "content", "") if hasattr(msg, "content") else str(msg)
        if content and content.strip():
            chunks.append(content.strip())
    return "\n".join(chunks) if chunks else None


async def topic_tracker(state: SessionState) -> dict:
    """
    Extract 1–3 keyword topics from the session transcript via an LLM call.

    Uses ChatBedrock with structured output (TopicList) to force a clean JSON
    array of short topic strings. Falls back to ["general"] if the transcript
    is empty or the LLM call fails.
    """
    messages = state.get("messages", [])
    log.info("[topic_tracker] Processing %d transcript messages", len(messages))

    transcript = _build_transcript(messages)
    if not transcript:
        log.info("[topic_tracker] Empty transcript — returning ['general']")
        return {"detected_topics": ["general"]}

    try:
        llm = _build_llm().with_structured_output(TopicList)

        system = SystemMessage(content=(
            "You are an expert at analysing emotional processing conversations. "
            "Extract 1 to 3 short keyword topics (1–2 words each) that represent "
            "the core subjects the speaker discussed. Topics should be concrete "
            "nouns or short noun phrases (e.g. 'quarterly goals', 'reorg', 'coach'). "
            "Do not include filler words or emotional states as topics."
        ))
        human = HumanMessage(content=(
            f"Session transcript:\n{transcript}\n\n"
            "Return a JSON object with a 'topics' key containing a list of 1–3 keyword strings."
        ))

        result: TopicList = await llm.ainvoke([system, human])
        # Sanitise: strip whitespace, lowercase, drop blanks, cap at 3
        topics = [t.strip().lower() for t in result.topics if t.strip()][:3]
        if not topics:
            topics = ["general"]

        log.info("[topic_tracker] Detected topics: %s", topics)
        return {"detected_topics": topics}

    except Exception as exc:
        log.warning("[topic_tracker] LLM call failed (%s: %s) — falling back to ['general']",
                    type(exc).__name__, exc)
        return {"detected_topics": ["general"]}
