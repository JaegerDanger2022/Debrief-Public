"use client";
import { useState, useCallback } from "react";
import { sessionsApi } from "@/lib/api/sessions";
import type { SessionTag } from "@/types/session";

export function useSession() {
  const [status, setStatus] = useState<"idle" | "recording" | "processing" | "complete">("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);

  const startSession = useCallback(async (tag: SessionTag | null) => {
    const { data } = await sessionsApi.create({ tag });
    setSessionId(data.id);
    setStatus("recording");
  }, []);

  const endSession = useCallback(async () => {
    setStatus("processing");
    // TODO: signal backend to finalize session
    setStatus("complete");
  }, []);

  return { status, sessionId, startSession, endSession };
}
