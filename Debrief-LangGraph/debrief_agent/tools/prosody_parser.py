from debrief_agent.state.session_state import ProsodyEvent


def parse_nova_sonic_response(response: dict) -> list[ProsodyEvent]:
    """Parse the raw response from Nova Sonic into structured ProsodyEvent dicts.

    Nova Sonic returns a streaming response with prosody metadata. This function
    normalizes it into the ProsodyEvent format expected by prosody_analyzer.

    Args:
        response: Raw dict from Nova Sonic Bedrock response

    Returns:
        List of ProsodyEvent TypedDicts
    """
    events: list[ProsodyEvent] = []

    for chunk in response.get("chunks", []):
        prosody = chunk.get("prosody", {})
        if not prosody:
            continue
        events.append(ProsodyEvent(
            timestamp_ms=chunk.get("timestamp_ms", 0),
            wpm=prosody.get("words_per_minute", 0.0),
            pitch_hz=prosody.get("fundamental_frequency", 0.0),
            pitch_delta=prosody.get("pitch_delta", 0.0),
            marker=prosody.get("event_type", ""),
        ))

    return events
