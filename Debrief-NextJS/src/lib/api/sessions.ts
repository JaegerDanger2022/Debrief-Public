import { apiClient } from "./client";
import type { Session, SessionCreate } from "@/types/session";

export const sessionsApi = {
  create: (data: SessionCreate) => apiClient.post<Session>("/sessions", data),
  list: () => apiClient.get<Session[]>("/sessions"),
  getById: (id: string) => apiClient.get<Session>(`/sessions/${id}`),
};
