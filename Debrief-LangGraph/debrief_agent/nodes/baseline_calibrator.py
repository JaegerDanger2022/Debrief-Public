from debrief_agent.state.session_state import SessionState
from debrief_agent.memory.store import get_memory_store


async def baseline_calibrator(state: SessionState) -> dict:
    """
    Compute avg WPM and pitch from calibration audio prosody events
    and persist as the user's baseline to the database.
    Called only during the onboarding calibration flow, not in regular sessions.
    """
    events = state.get("prosody_events", [])
    if not events:
        return {}

    avg_wpm = sum(e.get("wpm", 0) for e in events) / len(events)
    avg_pitch = sum(e.get("pitch_hz", 0) for e in events) / len(events)

    store = await get_memory_store()
    await store.save_baseline(state["user_id"], avg_wpm=avg_wpm, avg_pitch_hz=avg_pitch)

    return {}
