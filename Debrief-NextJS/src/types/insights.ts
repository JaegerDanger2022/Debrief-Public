/**
 * InsightPayload — the canonical schema produced by the LangGraph session_graph
 * and consumed by the Vocal Vibe dashboard components.
 *
 * This interface is the contract between Debrief-LangGraph → Debrief-Backend → Debrief-NextJS.
 * Any change here must be reflected in:
 *   - Debrief-LangGraph/debrief_agent/nodes/insight_router.py  (InsightPayload Pydantic model)
 *   - Debrief-Backend/app/models/insight.py                    (JSONB column)
 *   - Debrief-Backend/app/schemas/insight.py                   (InsightResponse Pydantic schema)
 */
export interface InsightPayload {
  /** Natural language summary of the emotional state shift detected this session. */
  state_shift_summary: string;

  /** Per-chunk acoustic telemetry recorded during the session. */
  acoustic_telemetry: Array<{
    /** Timestamp in milliseconds from session start. */
    timestamp: number;
    /** Speaking pace at this moment in words per minute. */
    wpm: number;
    /** Fundamental frequency (pitch) in Hz at this moment. */
    pitch_hz: number;
  }>;

  /** Concrete follow-up actions or reflections suggested by the AI. */
  action_items: string[];

  /** Topics or phrases that triggered a prosody shift during this session. */
  identified_triggers: string[];

  /** True if a permanent vocal baseline shift was detected — a "breakthrough" moment. */
  core_breakthrough: boolean;
}
