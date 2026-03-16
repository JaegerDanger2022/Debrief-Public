import { apiClient } from "./client";
import type { InsightSummary } from "@/types/session";

export const insightsApi = {
  getBySession: (sessionId: string) => apiClient.get<InsightSummary>(`/insights/${sessionId}`),
};
