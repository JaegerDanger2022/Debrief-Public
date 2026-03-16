import { apiClient } from "./client";
import type { LedgerItem, LedgerCaptureRequest } from "@/types/ledger";

export const ledgerApi = {
  capture: (data: LedgerCaptureRequest) =>
    apiClient.post<LedgerItem>("/ledger", data),
  list: () => apiClient.get<LedgerItem[]>("/ledger"),
  getById: (id: string) => apiClient.get<LedgerItem>(`/ledger/${id}`),
  resolve: (id: string, closeTab = false) =>
    apiClient.patch<LedgerItem>(`/ledger/${id}/resolve?close_tab=${closeTab}`),
  enrich: (id: string) =>
    apiClient.post<LedgerItem>(`/ledger/${id}/enrich`),
  auditTabs: (tabs: Array<{ tab_id: string; url: string }>) =>
    apiClient.post<{ flags: Array<{ tab_id: string; item_id: string | null; message: string | null }> }>(
      "/ledger/audit-tabs",
      { tabs },
    ),
};
