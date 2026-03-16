from typing_extensions import TypedDict


class BaselineProfile(TypedDict):
    avg_wpm: float
    avg_pitch_hz: float
    recorded_at: str


class MemoryState(TypedDict):
    """Cross-session memory state for a user."""
    user_id: str
    past_topics: list[str]
    emotional_triggers: list[dict]  # {topic, marker, session_id, date}
    baseline_profile: BaselineProfile | None
