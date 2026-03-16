import logging

from debrief_agent.state.session_state import SessionState

log = logging.getLogger(__name__)


async def prosody_analyzer(state: SessionState) -> dict:
    """
    Analyze raw prosody events from Nova Sonic.
    Tags each event with an emotional marker (pace_spike, pitch_drop, sigh, etc.)
    and extracts a list of notable emotional_markers for downstream nodes.
    """
    events = state.get("prosody_events", [])
    log.info("[prosody_analyzer] Analyzing %d prosody events", len(events))
    markers = []

    for event in events:
        if event.get("wpm", 0) > 180:
            markers.append("pace_spike")
        if event.get("pitch_delta", 0) < -20:
            markers.append("pitch_drop")
        if event.get("marker") == "sigh":
            markers.append("sigh_detected")

    # Deduplicate markers
    unique_markers = list(dict.fromkeys(markers))
    log.info("[prosody_analyzer] Markers detected: %s", unique_markers)
    return {"emotional_markers": unique_markers}
