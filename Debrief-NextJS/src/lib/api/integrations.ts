import { apiClient } from "./client";

export type IntegrationSlug = "notion" | "todoist";

export interface IntegrationStatus {
  slug: IntegrationSlug;
  connected: boolean;
  account_label: string | null;
  default_resource_id: string | null;
}

export interface NotionPage {
  id: string;
  title: string;
  type: "page" | "database";
}

export interface TodoistSection {
  id: string;
  name: string;
}

export interface TodoistProject {
  id: string;
  name: string;
  is_inbox: boolean;
  sections: TodoistSection[];
}

export interface PinnedResource {
  id: string; // Firestore doc id
  slug: IntegrationSlug;
  resource_id: string;
  label: string;
}

export const integrationsApi = {
  list: () => apiClient.get<IntegrationStatus[]>("/integrations"),

  connect: (slug: IntegrationSlug) =>
    apiClient.get<{ auth_url: string }>(`/integrations/${slug}/connect`),

  disconnect: (slug: IntegrationSlug) =>
    apiClient.delete(`/integrations/${slug}`),

  notionPages: () => apiClient.get<NotionPage[]>("/integrations/notion/pages"),

  todoistProjects: () =>
    apiClient.get<TodoistProject[]>("/integrations/todoist/projects"),

  listResources: () => apiClient.get<PinnedResource[]>("/integrations/resources"),

  addResource: (slug: IntegrationSlug, resource_id: string, label: string) =>
    apiClient.post<PinnedResource>("/integrations/resources", { slug, resource_id, label }),

  removeResource: (doc_id: string) =>
    apiClient.delete(`/integrations/resources/${doc_id}`),
};
