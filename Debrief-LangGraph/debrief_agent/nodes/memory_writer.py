import logging

from debrief_agent.state.session_state import SessionState
from debrief_agent.memory.store import get_memory_store

log = logging.getLogger(__name__)


async def memory_writer(state: SessionState) -> dict:
    """
    Persist new insights and topic embeddings to the memory store after a session completes.
    """
    insight = state.get("insight_payload")
    if not insight:
        log.warning("[memory_writer] No insight_payload in state — nothing to persist")
        return {}

    store = await get_memory_store()
    if store is None:
        log.warning("[memory_writer] No DB connection — insight not persisted to vector store")
        return {}

    log.info("[memory_writer] Saving insight to vector store (session=%s user=%s)",
             state.get("session_id"), state.get("user_id"))
    await store.save_insight(
        user_id=state["user_id"],
        session_id=state["session_id"],
        insight=insight,
    )
    log.info("[memory_writer] Insight saved")
    return {}
