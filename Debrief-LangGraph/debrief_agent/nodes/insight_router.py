import logging

from langchain_aws import ChatBedrock
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel

from debrief_agent.config import get_agent_settings
from debrief_agent.state.session_state import SessionState

log = logging.getLogger(__name__)


# ── Canonical InsightPayload schema ───────────────────────────────────────────
# Single source of truth. Must stay in sync with:
#   - Debrief-NextJS/src/types/insights.ts           (TypeScript interface)
#   - Debrief-Backend/app/models/insight.py           (JSONB column)
#   - Debrief-Backend/app/schemas/insight.py          (response schema)

class AcousticTelemetryPoint(BaseModel):
    timestamp: int   # milliseconds from session start
    wpm: float
    pitch_hz: float


class InsightPayload(BaseModel):
    state_shift_summary: str
    acoustic_telemetry: list[AcousticTelemetryPoint]
    action_items: list[str]
    identified_triggers: list[str]
    core_breakthrough: bool


# ── Helpers ───────────────────────────────────────────────────────────────────

def _build_llm() -> ChatBedrock:
    settings = get_agent_settings()
    return ChatBedrock(
        model_id=settings.bedrock_text_model_id,
        region_name=settings.aws_region,
        aws_access_key_id=settings.aws_access_key_id or None,
        aws_secret_access_key=settings.aws_secret_access_key or None,
    )


def _format_transcript(messages: list) -> str:
    chunks = []
    for msg in messages:
        content = getattr(msg, "content", "") if hasattr(msg, "content") else str(msg)
        if content and content.strip():
            chunks.append(content.strip())
    return "\n".join(chunks) if chunks else "(no transcript)"


def _format_triggers(past_triggers: list[dict]) -> str:
    if not past_triggers:
        return "None recorded."
    return "\n".join(
        f"  - Topic '{t.get('topic')}' previously caused {t.get('marker')} ({t.get('date', 'unknown date')})"
        for t in past_triggers[:10]
    )


def _build_telemetry(events: list[dict]) -> list[AcousticTelemetryPoint]:
    return [
        AcousticTelemetryPoint(
            timestamp=e.get("timestamp_ms", 0),
            wpm=e.get("wpm", 0.0),
            pitch_hz=e.get("pitch_hz", 0.0),
        )
        for e in events
    ]


def _fallback_payload(events: list[dict], markers: list[str], topics: list[str]) -> dict:
    """Deterministic fallback used when the LLM call fails."""
    core_breakthrough = "pace_spike" in markers and "pitch_drop" in markers
    identified_triggers = list(set(topics)) if markers else []

    summary_parts = []
    if markers:
        summary_parts.append(f"Emotional markers detected: {', '.join(markers)}.")
    if identified_triggers:
        summary_parts.append(f"Topics of activation: {', '.join(identified_triggers)}.")
    if core_breakthrough:
        summary_parts.append("A core breakthrough shift in vocal baseline was detected.")
    state_shift_summary = " ".join(summary_parts) or "No significant emotional shifts detected this session."

    action_items: list[str] = []
    if "pace_spike" in markers:
        action_items.append("Notice what you were saying when your pace accelerated — that topic carries energy.")
    if "pitch_drop" in markers:
        action_items.append("The drop in your pitch suggests resignation or deflation. Sit with that feeling.")
    if "sigh_detected" in markers:
        action_items.append("You sighed during this session. What were you releasing?")

    payload = InsightPayload(
        state_shift_summary=state_shift_summary,
        acoustic_telemetry=_build_telemetry(events),
        action_items=action_items,
        identified_triggers=identified_triggers,
        core_breakthrough=core_breakthrough,
    )
    return payload.model_dump()


# ── Node ──────────────────────────────────────────────────────────────────────

async def insight_router(state: SessionState) -> dict:
    """
    Synthesise the final InsightPayload from the full session context via an LLM call.

    The LLM receives:
      - The full transcript
      - Detected topics (from topic_tracker)
      - Emotional markers (from prosody_analyzer)
      - Historical triggers for this user (from memory_retriever)

    Output is validated against InsightPayload via .with_structured_output() before
    being stored. Falls back to deterministic logic if the LLM call fails.
    """
    topics    = state.get("detected_topics", [])
    markers   = state.get("emotional_markers", [])
    events    = state.get("prosody_events", [])
    past_triggers = state.get("past_triggers", [])
    messages  = state.get("messages", [])

    log.info("[insight_router] Building InsightPayload — topics=%s markers=%s events=%d",
             topics, markers, len(events))

    transcript      = _format_transcript(messages)
    triggers_text   = _format_triggers(past_triggers)
    telemetry       = _build_telemetry(events)
    telemetry_text  = "\n".join(
        f"  t={p.timestamp}ms  wpm={p.wpm:.0f}  pitch={p.pitch_hz:.0f}Hz"
        for p in telemetry
    ) or "  (no telemetry)"

    system_prompt = SystemMessage(content=(
        "You are an expert emotional processing analyst. "
        "Your job is to synthesise a session debrief from a voice conversation transcript, "
        "acoustic prosody data, and the user's historical emotional trigger patterns. "
        "Be specific, honest, and compassionate. Write for the user — not about them. "
        "Every field you return will be shown directly to the user on their dashboard."
    ))

    human_prompt = HumanMessage(content=f"""
## Session Transcript
{transcript}

## Acoustic Telemetry (WPM and pitch per chunk)
{telemetry_text}

## Emotional Markers Detected (from acoustic analysis)
{', '.join(markers) if markers else 'None'}

## Topics Discussed
{', '.join(topics) if topics else 'None identified'}

## User's Historical Emotional Triggers
{triggers_text}

---

Using all of the above, return a structured InsightPayload with these fields:

**state_shift_summary** (string):
  Write 2–4 sentences that correlate what was SAID with the acoustic markers.
  Be specific: if pace spiked when discussing a topic, name it.
  Describe the emotional arc of the session — where did it start, where did it end?

**action_items** (list of 2–4 strings):
  Concrete, first-person prompts the user can sit with or act on.
  Ground each one in something actually said in the transcript.
  Do NOT use generic self-help language.

**identified_triggers** (list of strings):
  Topics from the transcript that co-occurred with an emotional marker.
  Use short noun phrases (1–3 words). Empty list if no clear triggers.

**core_breakthrough** (boolean):
  True if the emotional tone meaningfully resolved or shifted toward clarity/relief
  by the end of the session. False if the session ended in the same state it started.

**acoustic_telemetry** (list):
  Return this exactly as provided — do not modify the telemetry data:
{[p.model_dump() for p in telemetry]}
""")

    try:
        llm = _build_llm().with_structured_output(InsightPayload)
        result: InsightPayload = await llm.ainvoke([system_prompt, human_prompt])

        # Preserve the deterministic telemetry — don't let the LLM hallucinate it
        result.acoustic_telemetry = telemetry

        log.info("[insight_router] InsightPayload — breakthrough=%s triggers=%s actions=%d summary=%r",
                 result.core_breakthrough, result.identified_triggers,
                 len(result.action_items), result.state_shift_summary[:80])
        return {"insight_payload": result.model_dump()}

    except Exception as exc:
        log.warning("[insight_router] LLM call failed (%s: %s) — using deterministic fallback",
                    type(exc).__name__, exc)
        payload = _fallback_payload(events, markers, topics)
        log.info("[insight_router] Fallback InsightPayload — breakthrough=%s triggers=%s",
                 payload["core_breakthrough"], payload["identified_triggers"])
        return {"insight_payload": payload}
