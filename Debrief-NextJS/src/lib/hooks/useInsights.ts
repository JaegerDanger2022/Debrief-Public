"use client";
import { useQuery } from "@tanstack/react-query";
import { insightsApi } from "@/lib/api/insights";

export function useInsights(sessionId: string | null) {
  return useQuery({
    queryKey: ["insights", sessionId],
    queryFn: () => insightsApi.getBySession(sessionId!).then((r) => r.data),
    enabled: !!sessionId,
  });
}
