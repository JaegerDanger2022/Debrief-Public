from typing import Literal
from typing_extensions import TypedDict


class ForgetMeState(TypedDict):
    """State for the forget_me purge graph."""
    user_id: str
    purge_status: Literal["pending", "in_progress", "complete", "failed"]
    affected_record_ids: list[str]
    error: str | None
