export type SessionTag = "Therapy" | "Coaching" | "Solo Vent";
export type SessionStatus = "active" | "processing" | "complete" | "failed";

export interface Session {
  id: string;
  user_id: string;
  tag: SessionTag | null;
  status: SessionStatus;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
}

export interface SessionCreate {
  tag: SessionTag | null;
}

export interface AcousticTelemetryPoint {
  timestamp: number;
  wpm: number;
  pitch_hz: number;
}

export interface InsightPayload {
  state_shift_summary: string;
  acoustic_telemetry: AcousticTelemetryPoint[];
  action_items: string[];
  identified_triggers: string[];
  core_breakthrough: boolean;
}

export interface InsightSummary {
  session_id: string;
  payload: InsightPayload;
  core_breakthrough: boolean;
  created_at: string;
}
