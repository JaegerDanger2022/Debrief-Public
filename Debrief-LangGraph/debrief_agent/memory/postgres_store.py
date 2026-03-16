import asyncpg

from debrief_agent.config import get_agent_settings
from debrief_agent.memory.store import MemoryStore


class PostgresMemoryStore(MemoryStore):
    """asyncpg-based implementation of MemoryStore.

    Reads and writes to the shared PostgreSQL instance managed by Debrief-Backend.
    Only touches the `insights` and `baselines` tables.
    """

    def __init__(self):
        self._pool: asyncpg.Pool | None = None

    async def connect(self) -> None:
        settings = get_agent_settings()
        self._pool = await asyncpg.create_pool(settings.postgres_url)

    async def save_insight(self, user_id: str, session_id: str, insight: dict) -> str:
        import json, uuid
        record_id = str(uuid.uuid4())
        async with self._pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO insights (id, session_id, summary_text, topics, avg_wpm, avg_pitch_hz, breakthrough)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (session_id) DO UPDATE
                SET summary_text = EXCLUDED.summary_text, topics = EXCLUDED.topics
                """,
                record_id,
                session_id,
                insight.get("summary_text", ""),
                json.dumps(insight.get("topics", [])),
                insight.get("avg_wpm"),
                insight.get("avg_pitch_hz"),
                insight.get("breakthrough", False),
            )
        return record_id

    async def get_past_triggers(self, user_id: str, topics: list[str]) -> list[dict]:
        if not topics:
            return []
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT i.session_id, i.topics, i.summary_text, s.started_at
                FROM insights i
                JOIN sessions s ON s.id = i.session_id
                WHERE s.user_id = $1
                ORDER BY s.started_at DESC
                LIMIT 10
                """,
                user_id,
            )
        return [dict(r) for r in rows]

    async def save_baseline(self, user_id: str, avg_wpm: float, avg_pitch_hz: float) -> None:
        async with self._pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO baselines (user_id, avg_wpm, avg_pitch_hz)
                VALUES ($1, $2, $3)
                ON CONFLICT (user_id) DO UPDATE
                SET avg_wpm = EXCLUDED.avg_wpm, avg_pitch_hz = EXCLUDED.avg_pitch_hz, recorded_at = now()
                """,
                user_id,
                avg_wpm,
                avg_pitch_hz,
            )

    async def delete_user(self, user_id: str) -> list[str]:
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                "DELETE FROM insights USING sessions WHERE insights.session_id = sessions.id AND sessions.user_id = $1 RETURNING insights.id",
                user_id,
            )
            await conn.execute("DELETE FROM baselines WHERE user_id = $1", user_id)
        return [str(r["id"]) for r in rows]
