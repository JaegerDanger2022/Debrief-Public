from typing import Annotated
from typing_extensions import TypedDict
from langgraph.graph.message import add_messages


class ProsodyEvent(TypedDict):
    timestamp_ms: int
    wpm: float
    pitch_hz: float
    pitch_delta: float
    marker: str  # e.g. "pace_spike", "pitch_drop", "sigh"


class SessionState(TypedDict):
    """State passed between nodes in the session graph."""
    session_id: str
    user_id: str
    messages: Annotated[list, add_messages]
    prosody_events: list[ProsodyEvent]
    detected_topics: list[str]
    emotional_markers: list[str]
    past_triggers: list[dict]  # injected by memory_retriever
    insight_payload: dict | None  # populated by insight_router
    ledger_item: dict | None        # optional: set when session originates from a ledger capture
    ledger_resolution_outcome: str | None  # "close_tab" | "mobile_notification" | "none"
