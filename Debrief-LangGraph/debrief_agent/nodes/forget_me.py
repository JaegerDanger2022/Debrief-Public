from debrief_agent.state.forget_me_state import ForgetMeState
from debrief_agent.memory.store import get_memory_store


async def forget_me(state: ForgetMeState) -> dict:
    """
    Permanently purge all agent-owned data for a user:
    - Insights records
    - Baseline calibration
    - Vector embeddings

    Called by the forget_me_graph. The backend's user_service handles deleting
    the User, Session, and Baseline ORM rows after this node completes.
    """
    user_id = state["user_id"]
    try:
        store = await get_memory_store()
        affected_ids = await store.delete_user(user_id)
        return {"purge_status": "complete", "affected_record_ids": affected_ids, "error": None}
    except Exception as e:
        return {"purge_status": "failed", "error": str(e)}
