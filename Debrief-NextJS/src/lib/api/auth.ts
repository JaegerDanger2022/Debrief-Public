import { apiClient } from "./client";

export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post<{ access_token: string; refresh_token: string }>("/auth/login", { email, password }),

  signup: (email: string, password: string, consentProsody: boolean) =>
    apiClient.post("/auth/signup", { email, password, consent_prosody: consentProsody }),

  logout: () => apiClient.post("/auth/logout"),

  refresh: (refreshToken: string) =>
    apiClient.post<{ access_token: string }>("/auth/refresh", { refresh_token: refreshToken }),
};
