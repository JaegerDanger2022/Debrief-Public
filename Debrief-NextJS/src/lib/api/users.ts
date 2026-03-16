import { apiClient } from "./client";
import type { User } from "@/types/user";

export const usersApi = {
  me: () => apiClient.get<User>("/users/me"),
  update: (data: Partial<User>) => apiClient.patch<User>("/users/me", data),
  forgetMe: () => apiClient.delete("/users/me"),
  uploadBaseline: (form: FormData) =>
    apiClient.post("/users/me/baseline", form, {
      headers: { "Content-Type": undefined },
    }),
};
