from abc import ABC, abstractmethod
from typing import Optional


class MemoryStore(ABC):
    """Abstract interface for all Debrief memory operations.

    Both PostgresMemoryStore and (optionally) VectorStore implement this interface.
    The session_graph and forget_me_graph interact only with this abstraction.
    """

    @abstractmethod
    async def save_insight(self, user_id: str, session_id: str, insight: dict) -> str:
        """Persist an InsightPayload for a session. Returns the new insight record ID."""
        ...

    @abstractmethod
    async def get_past_triggers(self, user_id: str, topics: list[str]) -> list[dict]:
        """Return historical emotional triggers for a user that match the given topics."""
        ...

    @abstractmethod
    async def save_baseline(self, user_id: str, avg_wpm: float, avg_pitch_hz: float) -> None:
        """Upsert the user's vocal baseline calibration."""
        ...

    @abstractmethod
    async def delete_user(self, user_id: str) -> list[str]:
        """Purge all agent-owned data for a user. Returns IDs of deleted records."""
        ...


# Module-level singleton — initialized lazily
_store: Optional[MemoryStore] = None


async def get_memory_store() -> Optional[MemoryStore]:
    global _store
    if _store is None:
        import logging
        log = logging.getLogger(__name__)
        try:
            from debrief_agent.memory.postgres_store import PostgresMemoryStore
            candidate = PostgresMemoryStore()
            await candidate.connect()
            _store = candidate  # only assign after successful connect
            log.info("[memory_store] Connected to PostgreSQL")
        except Exception as exc:
            log.warning("[memory_store] PostgreSQL unavailable — memory ops will be skipped: %s", exc)
            return None
    return _store
