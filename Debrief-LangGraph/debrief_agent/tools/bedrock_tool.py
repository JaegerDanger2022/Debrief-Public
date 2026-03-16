from langchain_core.tools import tool
from debrief_agent.config import get_agent_settings


@tool
async def stream_to_nova_sonic(audio_chunk_b64: str) -> dict:
    """LangGraph tool: reserved for post-session re-analysis using Nova Sonic.

    Live audio streaming is handled by BedrockService in the FastAPI layer
    (Debrief-Backend/app/services/bedrock_service.py) via a persistent
    bidirectional stream per session. This tool is intentionally not wired into
    any session node; it exists as a hook for future offline use cases such as
    re-processing stored transcripts through Nova Sonic.

    Args:
        audio_chunk_b64: Base64-encoded audio bytes (LPCM 16kHz 16-bit mono)

    Returns:
        dict with keys: prosody_events, transcript_chunk, barge_in_signal
    """
    raise NotImplementedError(
        "stream_to_nova_sonic is reserved for future offline use. "
        "Live streaming is handled by BedrockService in the FastAPI layer."
    )
