export type LedgerPlatform = "desktop" | "mobile";
export type LedgerStatus = "pending" | "enriched" | "resolved";
export type RoutingIntegration = "notion" | "todoist";
export type RoutingMode = "create" | "append";

export interface LedgerItem {
  id: string;
  user_id: string;
  url: string;
  tab_id: string | null;
  platform: LedgerPlatform;
  page_title: string | null;
  selection_text: string | null;
  intent_description: string | null;
  captured_data: Record<string, unknown> | null;
  status: LedgerStatus;
  should_close_tab: boolean;
  created_at: string; // ISO datetime
  routing_integration: RoutingIntegration | null;
  routing_mode: RoutingMode;
  routing_target_id: string | null; // Notion page ID or Todoist project ID (append mode only)
}

export interface LedgerCaptureRequest {
  url: string;
  page_title?: string;
  selection_text?: string;
  intent_description?: string;
  platform?: LedgerPlatform;
  tab_id?: string;
  routing_integration?: RoutingIntegration;
  routing_mode?: RoutingMode;
  routing_target_id?: string;
}

// Nova Act enrichment output — mirrors CapturedData Pydantic model
export interface CapturedData {
  author?: string | null;
  published_date?: string | null;
  doi?: string | null;
  price?: string | null;
  contact_email?: string | null;
  organization?: string | null;
  word_count?: number | null;
  linkedin_url?: string | null;
  twitter_handle?: string | null;
  summary?: string | null;
  key_topics?: string[];
  enrichment_method?: "enrich_page" | "deep_clip";
  enriched_at?: string | null;
}

// WebSocket message protocol from /ws/ledger
export type LedgerWsMessage =
  | { type: "enrichment_start";    item_id: string; action: string }
  | { type: "enrichment_field";    item_id: string; field: string; value: unknown }
  | { type: "enrichment_complete"; item_id: string; status: string }
  | { type: "enrichment_error";    item_id: string; message: string }
  | { type: "tab_audit_flag";      tab_id: string; item_id: string | null; message: string };
