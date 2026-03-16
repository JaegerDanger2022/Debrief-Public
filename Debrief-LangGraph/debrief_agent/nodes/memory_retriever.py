import logging

from debrief_agent.state.session_state import SessionState
from debrief_agent.memory.store import get_memory_store

log = logging.getLogger(__name__)


async def memory_retriever(state: SessionState) -> dict:
    """
    Query the vector store for past emotional triggers that match current session topics.
    Injects past_triggers into state so insight_router can reference historical patterns.
    """
    topics = state.get("detected_topics", [])
    if not topics:
        log.info("[memory_retriever] No topics — skipping vector store query")
        return {"past_triggers": []}

    log.info("[memory_retriever] Querying vector store for topics: %s", topics)
    store = await get_memory_store()
    if store is None:
        log.warning("[memory_retriever] No DB connection — returning empty triggers")
        return {"past_triggers": []}

    past_triggers = await store.get_past_triggers(state["user_id"], topics)
    log.info("[memory_retriever] Found %d past triggers", len(past_triggers))
    return {"past_triggers": past_triggers}
