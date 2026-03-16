import { createRoot } from "react-dom/client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useAudioPlayback } from "./useAudioPlayback";

// ─── Waveform ─────────────────────────────────────────────────────────────────

const BAR_COUNT = 20;
// How many rAF frames between each bar scroll step (~60fps / 3 = 20 updates/sec)
const FRAMES_PER_STEP = 3;

function Waveform({ micRmsRef, aiRmsRef, isActive, isAiSpeaking }: {
  micRmsRef: React.RefObject<number>;
  aiRmsRef: React.RefObject<number>;
  isActive: boolean;
  isAiSpeaking: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const barsRef = useRef<number[]>(Array(BAR_COUNT).fill(0));
  const rafRef = useRef<number>(0);
  const frameCountRef = useRef(0);

  // Size canvas to actual pixel width on mount and resize
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const resize = () => {
      canvas.width = container.clientWidth * devicePixelRatio;
      canvas.height = 40 * devicePixelRatio;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      const rms = isAiSpeaking ? (aiRmsRef.current ?? 0) : (micRmsRef.current ?? 0);
      const color = isAiSpeaking ? "#999" : "#000";

      // Scroll: shift all bars left by one slot every FRAMES_PER_STEP frames
      frameCountRef.current++;
      if (frameCountRef.current >= FRAMES_PER_STEP) {
        frameCountRef.current = 0;
        const bars = barsRef.current;
        for (let i = 0; i < BAR_COUNT - 1; i++) bars[i] = bars[i + 1];
        // New rightmost bar: amplify rms so typical speech (0.01–0.1) fills the bar
        const target = isActive ? Math.min(1, rms * 20) : 0;
        // Smooth toward target
        bars[BAR_COUNT - 1] = bars[BAR_COUNT - 1] * 0.3 + target * 0.7;
      }

      ctx.clearRect(0, 0, W, H);

      const gap = Math.round(2 * devicePixelRatio);
      const barW = (W - gap * (BAR_COUNT - 1)) / BAR_COUNT;
      const minH = 2 * devicePixelRatio;

      const bars = barsRef.current;
      for (let i = 0; i < BAR_COUNT; i++) {
        const barH = Math.max(minH, bars[i] * H);
        const x = i * (barW + gap);
        const y = (H - barH) / 2;
        ctx.fillStyle = color;
        ctx.globalAlpha = isActive ? 0.9 : 0.15;
        ctx.fillRect(x, y, barW, barH);
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isActive, isAiSpeaking, micRmsRef, aiRmsRef]);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "40px" }}>
      <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "40px" }} />
    </div>
  );
}

// ─── Config ───────────────────────────────────────────────────────────────────

const API_BASE = "http://localhost:8000";
const WS_BASE  = "ws://localhost:8000";

// ─── Types ────────────────────────────────────────────────────────────────────

type LedgerStatus = "pending" | "enriched" | "resolved";

interface LedgerItem {
  id: string;
  user_id: string;
  url: string;
  tab_id: string | null;
  page_title: string | null;
  selection_text: string | null;
  intent_description: string | null;
  action_type: "CAPTURE" | "ENRICH" | "EXECUTE" | "RESEARCH" | null;
  captured_data: Record<string, unknown> | null;
  status: LedgerStatus;
  should_close_tab: boolean;
  created_at: string;
  parent_item_id: string | null;
}

type LedgerWsMessage =
  | { type: "enrichment_start";    item_id: string; action: string }
  | { type: "enrichment_field";    item_id: string; field: string; value: unknown }
  | { type: "enrichment_complete"; item_id: string; status: string }
  | { type: "enrichment_error";    item_id: string; message: string; error_reason?: string }
  | { type: "tab_audit_flag";      tab_id: string; item_id: string | null; message: string }
  | { type: "agent_screenshot";    item_id: string; agent_id: string; b64: string }
  | { type: "agent_url";           item_id: string; agent_id: string; url: string }
  | { type: "agent_thought";       item_id: string; agent_id: string; text: string }
  | { type: "item_deleted";        item_id: string };

type IntegrationTarget = "notion" | "todoist";
const INTEGRATION_ICONS: Record<IntegrationTarget, string> = {
  notion: chrome.runtime.getURL("icons/integrations/notion-svgrepo-com.svg"),
  todoist: chrome.runtime.getURL("icons/integrations/todoist-icon-svgrepo-com.svg"),
};
const INTEGRATION_LABELS: Record<IntegrationTarget, string> = {
  notion: "Notion", todoist: "Todoist",
};
const ENRICHMENT_META_FIELDS = new Set(["enrichment_method", "enriched_at", "enrichment_error", "nova_act_server_time_s", "action_status", "error_reason", "error_message"]);
const URL_FIELDS = new Set(["source_url", "primary_source_url", "website", "linkedin_url", "route_url"]);

// Render an extracted value — returns a string for simple values, or a React element for tables.
function formatExtractedValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v !== "object") return String(v);
  if (Array.isArray(v)) {
    // Array of primitives — comma-separated
    if (v.length === 0) return "";
    if (typeof v[0] !== "object" || v[0] === null) return (v as unknown[]).map(String).join(", ");
    // Array of objects — join each row's values with " · " as a readable list
    return (v as Record<string, unknown>[]).map(row =>
      Object.values(row)
        .filter(x => x !== null && x !== undefined && x !== "")
        .map(x => String(x))
        .join("  ")
    ).join("\n");
  }
  // Plain object — join key: value pairs
  return Object.entries(v as Record<string, unknown>)
    .filter(([, x]) => x !== null && x !== undefined && x !== "")
    .map(([k, x]) => `${k.replace(/_/g, " ")}: ${x}`)
    .join(", ");
}

// Render an extracted field value — handles tables, lists, and primitives.
function ExtractedValue({ v, accent }: { v: unknown; accent: string }) {
  if (v === null || v === undefined || v === "") return null;

  // Array of objects → mini table
  if (Array.isArray(v) && v.length > 0 && typeof v[0] === "object" && v[0] !== null) {
    const rows = v as Record<string, unknown>[];
    const cols = Object.keys(rows[0]);
    return (
      <div style={{ overflowX: "auto", marginTop: "2px" }}>
        <table style={{ borderCollapse: "collapse", fontSize: "10px", width: "100%" }}>
          <thead>
            <tr>
              {cols.map(c => (
                <th key={c} style={{ color: accent, fontWeight: "600", textAlign: "left", padding: "2px 6px 2px 0", borderBottom: `1px solid ${accent}33`, whiteSpace: "nowrap", textTransform: "capitalize" }}>
                  {c.replace(/_/g, " ")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {cols.map(c => (
                  <td key={c} style={{ color: "#334155", padding: "2px 6px 2px 0", borderBottom: "1px solid rgba(0,0,0,0.04)", whiteSpace: "nowrap" }}>
                    {row[c] !== null && row[c] !== undefined ? String(row[c]) : ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Array of primitives → comma list
  if (Array.isArray(v)) {
    return <span style={{ color: "#334155", wordBreak: "break-word" }}>{(v as unknown[]).map(String).join(", ")}</span>;
  }

  // Everything else — use the string formatter
  return <span style={{ color: "#334155", wordBreak: "break-word", whiteSpace: "pre-wrap" }}>{formatExtractedValue(v)}</span>;
}

// ─── Auth helper (reads token stored by background.js) ────────────────────────

function getToken(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "GET_TOKEN" }, (resp) => {
      resolve(resp?.token ?? null);
    });
  });
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

// ─── LedgerCard ───────────────────────────────────────────────────────────────

function LedgerCard({
  item,
  onDelete,
  enrichingState,
}: {
  item: LedgerItem;
  onDelete: (id: string) => void;
  enrichingState?: {
    fields: Record<string, unknown>;
    action: string;
    screenshot?: string;   // base64 JPEG, latest frame from Nova Act (step.model_input.image)
    currentUrl?: string;
    thought?: string;
    completing?: boolean;  // true during 600ms fade-out before removal
    errorReason?: string;  // "timeout" | "no_content" | "unknown"
    errorMessage?: string;
  };
}) {
  const [routing, setRouting] = useState(false);
  const [picker, setPicker] = useState<IntegrationTarget | null>(null);
  const [pickerItems, setPickerItems] = useState<{ id: string | null; label: string }[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const age = (() => {
    const diff = Date.now() - new Date(item.created_at).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  })();

  const tags: string[] = [];
  // Primary: use action_type stamped by the pipeline dispatcher
  if (item.action_type === "RESEARCH") tags.push("#Research");
  else if (item.action_type === "ENRICH") tags.push("#Summary");
  else if (item.action_type === "EXECUTE") tags.push("#PageAction");
  else if (item.action_type === "CAPTURE") {
    // Refine CAPTURE with intent keywords
    const desc = item.intent_description ?? "";
    if (/newsletter|publish|post/i.test(desc)) tags.push("#Publishing");
    else if (/lead|contact|reach/i.test(desc)) tags.push("#Leads");
    else if (/buy|purchase|order/i.test(desc)) tags.push("#ToBuy");
    else if (/snippet|code|script/i.test(desc)) tags.push("#Code");
    else if (/job|role|career|hiring/i.test(desc)) tags.push("#Jobs");
    else if (/recipe|ingredient|cook/i.test(desc)) tags.push("#Recipes");
    else tags.push("#Saved");
  } else {
    // Fallback for older items without action_type
    const desc = item.intent_description ?? "";
    if (/research|study|dig into|investigate/i.test(desc)) tags.push("#Research");
    else if (/newsletter|publish|post/i.test(desc)) tags.push("#Publishing");
    else if (/lead|contact|reach/i.test(desc)) tags.push("#Leads");
    else if (/buy|purchase|order/i.test(desc)) tags.push("#ToBuy");
    else if (/snippet|code|script/i.test(desc)) tags.push("#Code");
    else tags.push("#Misc");
  }

  const isUrgent = item.intent_description
    ? /urgent|asap|immediately|priority|important/i.test(item.intent_description)
    : false;

  const isError = !!enrichingState?.errorReason || (item.status === "enriched" && !!(item.captured_data?.action_status === "failed"));
  const isEnriching = !!enrichingState && !enrichingState.errorReason;
  const isEnriched = !enrichingState && item.status === "enriched" && item.captured_data?.action_status !== "failed";
  const isResearch = !!item.parent_item_id;

  const openPicker = async (target: IntegrationTarget) => {
    if (picker === target) { setPicker(null); return; }
    setPicker(target);
    setPickerItems([]);
    setPickerLoading(true);
    try {
      if (target === "notion") {
        const pages = await apiFetch<{ id: string; title: string; type: string }[]>("/integrations/notion/pages");
        setPickerItems([
          { id: null, label: "New page (no parent)" },
          ...pages.map(p => ({ id: p.id, label: (p.type === "database" ? "⊞ " : "□ ") + p.title })),
        ]);
      } else if (target === "todoist") {
        const projects = await apiFetch<{ id: string; name: string; is_inbox: boolean }[]>("/integrations/todoist/projects");
        setPickerItems([
          { id: null, label: "Inbox" },
          ...projects.filter(p => !p.is_inbox).map(p => ({ id: p.id, label: p.name })),
        ]);
      }
    } catch {
      setPickerItems([{ id: "error", label: "Failed to load — check integration" }]);
    }
    setPickerLoading(false);
  };

  const confirmRoute = async (target: IntegrationTarget, destId: string | null) => {
    setPicker(null);
    setRouting(true);
    try {
      const body: Record<string, unknown> = { target };
      if (target === "notion") body.page_id = destId;
      if (target === "todoist") body.project_id = destId;
      await apiFetch(`/ledger/${item.id}/route`, { method: "POST", body: JSON.stringify(body) });
      await onDelete(item.id);
    } catch (e) {
      console.error("Route failed", e);
      setRouting(false);
    }
  };

  const displayUrl = (item.captured_data as Record<string, unknown> | null)?.primary_source_url as string | undefined ?? item.url;
  let hostname = displayUrl;
  try { hostname = new URL(displayUrl).hostname; } catch { /* keep raw url */ }

  // card glow colour — research cards use amber/gold tint
  const glowColor = isResearch
    ? "rgba(251,191,36,0.10)"
    : isEnriching
    ? "rgba(0,122,255,0.10)"
    : isUrgent
    ? "rgba(255,59,48,0.08)"
    : "rgba(0,0,0,0.04)";

  const borderColor = isError
    ? "rgba(255,59,48,0.30)"
    : isResearch
    ? (isEnriching ? "rgba(251,191,36,0.45)" : "rgba(251,191,36,0.22)")
    : isEnriching
    ? "rgba(0,122,255,0.35)"
    : "rgba(0,0,0,0.08)";

  return (
    <div style={{
      background: isResearch ? "rgba(255,252,240,0.96)" : "#FFFFFF",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      border: `1px solid ${borderColor}`,
      borderRadius: "12px",
      padding: "12px 13px",
      marginBottom: "7px",
      opacity: routing ? 0.4 : 1,
      transition: "opacity 0.15s, border-color 0.3s",
      boxShadow: `0 0 0 1px ${glowColor}, 0 2px 12px rgba(0,0,0,0.06)`,
    }}>
      {/* Research origin label */}
      {isResearch && (
        <div style={{ fontSize: "9.5px", color: "#B45309", background: "rgba(251,191,36,0.10)", border: "1px solid rgba(251,191,36,0.22)", borderRadius: "6px", padding: "2px 8px", marginBottom: "7px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
          <span style={{ opacity: 0.6 }}>↳</span> Research card
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
        <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => setExpanded((v) => !v)}>
          <div style={{ fontSize: "13px", fontWeight: "600", color: "#1D1D1F", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.35, letterSpacing: "-0.01em" }}>
            {item.page_title ?? hostname}
          </div>
          <div style={{ fontSize: "11px", color: "#6E6E73", marginTop: "2px" }}>{hostname} · {age}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "5px", marginLeft: "10px", flexShrink: 0 }}>
          <span style={{ fontSize: "10px", color: "#94A3B8", lineHeight: 1, transform: expanded ? "rotate(180deg)" : "none", display: "inline-block", transition: "transform 0.15s", cursor: "pointer" }} onClick={() => setExpanded((v) => !v)}>▾</span>
          {isResearch && !isEnriching && !isEnriched && (
            <span style={{ fontSize: "9.5px", background: "rgba(251,191,36,0.12)", color: "#B45309", border: "1px solid rgba(251,191,36,0.25)", borderRadius: "6px", padding: "2px 7px", fontWeight: "600", letterSpacing: "0.02em" }}>RESEARCHING</span>
          )}
          {isUrgent && !isEnriching && !isResearch && (
            <span style={{ fontSize: "9.5px", background: "rgba(255,59,48,0.10)", color: "#FF3B30", border: "1px solid rgba(255,59,48,0.22)", borderRadius: "6px", padding: "2px 7px", fontWeight: "600", letterSpacing: "0.02em" }}>URGENT</span>
          )}
          {isEnriching && (
            <>
              <span style={{ fontSize: "9.5px", background: isResearch ? "rgba(251,191,36,0.12)" : "rgba(0,122,255,0.10)", color: isResearch ? "#B45309" : "#007AFF", border: `1px solid ${isResearch ? "rgba(251,191,36,0.25)" : "rgba(0,122,255,0.22)"}`, borderRadius: "6px", padding: "2px 7px", fontWeight: "600", letterSpacing: "0.02em" }}>SCANNING</span>
              <button onClick={() => onDelete(item.id)} title="Stop agent" style={{ background: "rgba(255,59,48,0.07)", border: "1px solid rgba(255,59,48,0.18)", color: "#FF3B30", fontSize: "9px", fontWeight: "700", padding: "2px 5px", borderRadius: "6px", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>⏹ stop</button>
            </>
          )}
          {isError && (
            <span style={{ fontSize: "9.5px", background: "rgba(255,59,48,0.08)", color: "#FF3B30", border: "1px solid rgba(255,59,48,0.22)", borderRadius: "6px", padding: "2px 7px", fontWeight: "600", letterSpacing: "0.02em" }}>FAILED</span>
          )}
          {isEnriched && (
            <span
              style={{
                fontSize: "9.5px",
                background: "rgba(255,255,255,0.58)",
                color: "#1D1D1F",
                border: "1px solid rgba(29,29,31,0.10)",
                borderRadius: "999px",
                padding: "3px 9px",
                fontWeight: "700",
                letterSpacing: "0.04em",
                boxShadow: "0 6px 16px rgba(123,137,160,0.08)",
              }}
            >
              DONE
            </span>
          )}
        </div>
      </div>

      {/* Intent — not shown when selection text is present (EXTRACTED section covers it) */}
      {item.intent_description && !item.selection_text && (
        <div style={{ fontSize: "11.5px", color: "#007AFF", marginBottom: "8px", lineHeight: 1.4, opacity: 0.9, fontStyle: "italic" }}>
          "{item.intent_description}"
        </div>
      )}

      {/* Error panel */}
      {isError && (() => {
        const reason = enrichingState?.errorReason ?? (item.captured_data?.error_reason as string | undefined) ?? "unknown";
        const message = enrichingState?.errorMessage ?? (item.captured_data?.error_message as string | undefined) ?? "Scan failed.";
        const icon = reason === "timeout" ? "⏱" : reason === "no_content" ? "🔒" : reason === "not_found" ? "🔍" : "⚠";
        const hint = reason === "timeout"
          ? "The page took too long. Try navigating directly to the relevant section and asking again."
          : reason === "no_content"
          ? "The page couldn't be read directly. It may need login or JavaScript to render."
          : reason === "not_found"
          ? "Not found on this page. Navigate to the relevant site and ask again."
          : "An unexpected error occurred. Try again.";
        return (
          <div style={{ background: "rgba(255,59,48,0.05)", border: "1px solid rgba(255,59,48,0.16)", borderRadius: "10px", padding: "10px 11px", marginBottom: "8px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "7px" }}>
              <span style={{ fontSize: "14px", lineHeight: 1, flexShrink: 0, marginTop: "1px" }}>{icon}</span>
              <div>
                <div style={{ fontSize: "11.5px", color: "#FF3B30", fontWeight: "600", marginBottom: "3px", lineHeight: 1.4 }}>{message}</div>
                <div style={{ fontSize: "11px", color: "#6E6E73", lineHeight: 1.5 }}>{hint}</div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Live agent viewport */}
      {isEnriching && (
        <div style={{ borderRadius: "6px", overflow: "hidden", marginBottom: "8px", border: `1px solid ${isResearch ? "rgba(251,191,36,0.25)" : "rgba(99,102,241,0.25)"}`, opacity: enrichingState.completing ? 0 : 1, transition: "opacity 0.5s ease-out" }}>

          {/* Screenshot stream or placeholder */}
          {enrichingState.screenshot ? (
            <div style={{ position: "relative" }}>
              <img
                src={`data:image/jpeg;base64,${enrichingState.screenshot}`}
                style={{ width: "100%", display: "block", maxHeight: "160px", objectFit: "cover", objectPosition: "top" }}
              />
              {/* URL bar overlay */}
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, background: "rgba(255,255,255,0.88)", padding: "4px 8px", fontSize: "9px", color: isResearch ? "#B45309" : "#007AFF", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "monospace" }}>
                {enrichingState.currentUrl ?? "navigating…"}
              </div>
            </div>
          ) : (
            <div style={{ height: "72px", background: isResearch ? "rgba(251,191,36,0.04)" : "rgba(0,122,255,0.04)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "5px" }}>
              <div style={{ fontSize: "9.5px", color: isResearch ? "#B45309" : "#007AFF", letterSpacing: "0.08em", fontWeight: "700" }}>AGENT STARTING</div>
              {enrichingState.currentUrl && (
                <div style={{ fontSize: "9px", color: isResearch ? "#B45309" : "#007AFF", fontFamily: "monospace", maxWidth: "90%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{enrichingState.currentUrl}</div>
              )}
            </div>
          )}

          {/* Thought caption */}
          <div style={{ background: "rgba(255,255,255,0.88)", padding: "6px 9px", fontSize: "10px", color: isResearch ? "#B45309" : "#007AFF", lineHeight: 1.5, minHeight: "26px", fontStyle: "italic", whiteSpace: "pre-wrap", fontFamily: "monospace", maxHeight: "96px", overflowY: "auto" }}>
            {enrichingState.thought ?? ({"tavily_research": "searching the web", "deep_research": "searching the web"}[enrichingState.action] ?? enrichingState.action.replace(/_/g, " "))}
          </div>

          {/* Extracted fields as they land */}
          {Object.keys(enrichingState.fields).length > 0 && (
            <div style={{ background: isResearch ? "rgba(251,191,36,0.04)" : "rgba(0,122,255,0.04)", padding: "7px 9px", borderTop: `1px solid ${isResearch ? "rgba(251,191,36,0.10)" : "rgba(0,122,255,0.08)"}` }}>
              {Object.entries(enrichingState.fields).map(([field, value]) => {
                if (field === "image_url" && typeof value === "string" && value) {
                  return (
                    <div key={field} style={{ marginBottom: "6px" }}>
                      <img src={value} alt="Product" style={{ maxWidth: "100%", maxHeight: "120px", objectFit: "contain", borderRadius: "6px", background: "#F5F5F7" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    </div>
                  );
                }
                if ((field === "extracted" || field === "other_socials") && value && typeof value === "object" && !Array.isArray(value)) {
                  const accent = isResearch ? "#B45309" : "#007AFF";
                  return Object.entries(value as Record<string, unknown>).map(([k, v]) => (
                    <div key={`extracted_${k}`} style={{ fontSize: "10.5px", marginBottom: "4px", lineHeight: 1.4 }}>
                      <span style={{ color: accent, fontWeight: "500", textTransform: "capitalize" }}>{k.replace(/_/g, " ")}</span>
                      <div style={{ marginTop: "1px" }}><ExtractedValue v={v} accent={accent} /></div>
                    </div>
                  ));
                }
                const accent = isResearch ? "#B45309" : "#007AFF";
                return (
                  <div key={field} style={{ fontSize: "10.5px", marginBottom: "3px", lineHeight: 1.4 }}>
                    <span style={{ color: accent, fontWeight: "500", flexShrink: 0, textTransform: "capitalize" }}>{field.replace(/_/g, " ")}</span>
                    <div style={{ marginTop: "1px" }}>
                      {URL_FIELDS.has(field) && typeof value === "string" && value
                        ? <a href={value} target="_blank" rel="noreferrer" style={{ color: "#007AFF", textDecoration: "underline", wordBreak: "break-all", fontSize: "10.5px" }}>{value}</a>
                        : <ExtractedValue v={value} accent={accent} />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Enriched fields — shown by default when data exists, collapsible */}
      {isEnriched && expanded && (() => {
        const allFields = item.captured_data
          ? Object.entries(item.captured_data).filter(
              ([k, v]) => !ENRICHMENT_META_FIELDS.has(k) && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0)
            )
          : [];
        // Show extracted/other_socials freeform dicts first (intent-matched content)
        const freeformFields = allFields.filter(([k]) => k === "extracted" || k === "other_socials");
        const metaFields = allFields.filter(([k]) => k !== "extracted" && k !== "other_socials");
        const orderedFields = [...freeformFields, ...metaFields];
        return (
          <div style={{ background: "rgba(52,199,89,0.05)", border: "1px solid rgba(52,199,89,0.14)", borderRadius: "10px", padding: "9px 10px", marginBottom: "8px" }}>
            <div style={{ fontSize: "9.5px", color: "#1A7F37", fontWeight: "700", letterSpacing: "0.06em", marginBottom: orderedFields.length > 0 ? "6px" : "0", textTransform: "uppercase" }}>
              Extracted
            </div>
            {orderedFields.length === 0 && (
              <div style={{ fontSize: "11px", color: "#64748B" }}>No structured data extracted</div>
            )}
            {orderedFields.map(([field, value]) => {
              // Product image — shown as thumbnail
              if (field === "image_url" && typeof value === "string" && value) {
                return (
                  <div key={field} style={{ marginBottom: "8px" }}>
                    <img src={value} alt="Product" style={{ maxWidth: "100%", maxHeight: "140px", objectFit: "contain", borderRadius: "5px", background: "#f8fafc" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  </div>
                );
              }
              // freeform dicts (extracted, other_socials) — flatten into individual rows, shown first
              if ((field === "extracted" || field === "other_socials") && value && typeof value === "object" && !Array.isArray(value)) {
                return (
                  <div key={field} style={{ marginBottom: metaFields.length > 0 ? "8px" : "0" }}>
                    <div style={{ fontSize: "9.5px", color: "#1A7F37", fontWeight: "700", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: "4px" }}>Intent match</div>
                    {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
                      <div key={k} style={{ fontSize: "11px", marginBottom: "5px", lineHeight: 1.4 }}>
                        <span style={{ color: "#1A7F37", fontWeight: "500", textTransform: "capitalize", opacity: 0.8 }}>{k.replace(/_/g, " ")}</span>
                        <div style={{ marginTop: "1px" }}><ExtractedValue v={v} accent="#1A7F37" /></div>
                      </div>
                    ))}
                  </div>
                );
              }
              return (
                <div key={field} style={{ fontSize: "11px", display: "flex", gap: "8px", marginBottom: "3px", lineHeight: 1.4 }}>
                  <span style={{ color: "#1A7F37", minWidth: "88px", fontWeight: "500", flexShrink: 0, textTransform: "capitalize", opacity: 0.8 }}>{field.replace(/_/g, " ")}</span>
                  <span style={{ color: "#334155", wordBreak: "break-word", whiteSpace: "pre-wrap" }}>
                    {URL_FIELDS.has(field) && typeof value === "string" && value
                      ? <a href={value} target="_blank" rel="noreferrer" style={{ color: "#2563EB", textDecoration: "underline", wordBreak: "break-all" }}>{value}</a>
                      : Array.isArray(value) ? (value as string[]).join(", ") : String(value)}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Destination picker */}
      {picker && (
        <div style={{ marginBottom: "8px", background: "#F5F5F7", border: "1px solid rgba(0,0,0,0.08)", borderRadius: "10px", padding: "6px" }}>
          <div style={{ fontSize: "9.5px", color: "#6E6E73", fontWeight: "600", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: "5px", paddingLeft: "4px" }}>
            {picker === "notion" ? "Send to Notion page" : "Add to Todoist project"}
          </div>
          {pickerLoading && (
            <div style={{ fontSize: "10.5px", color: "#6E6E73", padding: "4px 4px" }}>Loading…</div>
          )}
          {!pickerLoading && pickerItems.map((opt) => (
            <button
              key={opt.id ?? "__null__"}
              disabled={opt.id === "error"}
              onClick={() => opt.id !== "error" && confirmRoute(picker, opt.id)}
              style={{
                display: "block", width: "100%", textAlign: "left",
                background: "transparent", border: "none",
                padding: "5px 8px", borderRadius: "7px",
                fontSize: "11.5px", color: opt.id === "error" ? "#FF3B30" : "#1D1D1F",
                cursor: opt.id === "error" ? "default" : "pointer",
                fontFamily: "inherit",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}
              onMouseEnter={e => { if (opt.id !== "error") (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,0,0,0.06)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Tags + actions */}
      <div style={{ display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap" }}>
        {tags.map((t) => (
          <span key={t} style={{ fontSize: "9.5px", background: "rgba(0,0,0,0.05)", color: "#3A3A3C", border: "none", borderRadius: "6px", padding: "2px 7px", fontWeight: "500" }}>{t}</span>
        ))}
        <div style={{ flex: 1 }} />
        {(["notion", "todoist"] as IntegrationTarget[]).map((t) => (
          <button key={t} onClick={() => isEnriched && openPicker(t)} disabled={routing || !isEnriched} title={isEnriched ? INTEGRATION_LABELS[t] : "Available after enrichment"}
            style={{
              background: picker === t ? "rgba(29,29,31,0.10)" : "rgba(255,255,255,0.44)",
              border: `1px solid ${picker === t ? "rgba(29,29,31,0.18)" : "rgba(29,29,31,0.07)"}`,
              padding: "3px 5px", borderRadius: "7px", cursor: isEnriched ? "pointer" : "default",
              display: "flex", alignItems: "center", opacity: isEnriched ? 1 : 0.35,
              boxShadow: "0 4px 12px rgba(123,137,160,0.06)",
            }}>
            <img src={INTEGRATION_ICONS[t]} alt={INTEGRATION_LABELS[t]} style={{ width: "14px", height: "14px", display: "block" }} />
          </button>
        ))}
        <button onClick={() => onDelete(item.id)} disabled={routing}
          style={{
            background: "rgba(255,255,255,0.52)",
            border: "1px solid rgba(29,29,31,0.10)",
            color: "#6B1F1A",
            fontSize: "9.5px",
            fontFamily: "inherit",
            fontWeight: "700",
            padding: "5px 11px",
            borderRadius: "999px",
            cursor: "pointer",
            letterSpacing: "0.02em",
            boxShadow: "0 6px 16px rgba(123,137,160,0.07)",
          }}>
          Delete
        </button>
      </div>
    </div>
  );
}

// ─── SidebarShell ─────────────────────────────────────────────────────────────

function SidebarShell() {
  const [items, setItems] = useState<LedgerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [wsAlive, setWsAlive] = useState(false);
  const [enrichingItems, setEnrichingItems] = useState<Record<string, { fields: Record<string, unknown>; action: string; screenshot?: string; currentUrl?: string; thought?: string; completing?: boolean; errorReason?: string; errorMessage?: string }>>({});
  const [listenActive, setListenActive] = useState(false);
  const [listenError, setListenError] = useState<string | null>(null);
  const [clarifyQuestion, setClarifyQuestion] = useState<string | null>(null);
  // Ref so session_end handler (defined before stopMic) can call stopMic without stale closure
  const stopMicRef = useRef<() => void>(() => {});

  const { enqueue: enqueueAudio, flush: flushAudio, isAiSpeaking, isAiSpeakingRef, aiRmsRef, resumeForPlayback } = useAudioPlayback();
  const micRmsRef = useRef(0);
  const micWorkletRef = useRef<AudioWorkletNode | null>(null);
  const micContextRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  const fetchItems = useCallback(async () => {
    try {
      const data = await apiFetch<LedgerItem[]>("/ledger");
      setItems(data.filter((i) => i.status !== "resolved"));
    } catch { /* silently retry */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchItems();
    const iv = setInterval(fetchItems, 5000);
    return () => clearInterval(iv);
  }, [fetchItems]);

  // WebSocket — enrichment streaming
  useEffect(() => {
    let ws: WebSocket | null = null;
    let dead = false;

    const connect = async () => {
      try {
        const token = await getToken();
        if (!token) { if (!dead) setTimeout(connect, 5000); return; }
        const wsUrl = `${WS_BASE}/ws/ledger?token=${encodeURIComponent(token)}`;
        ws = new WebSocket(wsUrl);
        ws.onopen = () => setWsAlive(true);
        ws.onclose = (ev) => { setWsAlive(false); if (!dead && ev.code !== 4001) setTimeout(connect, 3000); else if (!dead) setTimeout(connect, 10000); };
        ws.onerror = () => ws?.close();
        ws.onmessage = (event) => {
          try {
            const msg: LedgerWsMessage = JSON.parse(event.data);
            if (msg.type === "enrichment_start") {
              setEnrichingItems((prev) => ({ ...prev, [msg.item_id]: { fields: {}, action: msg.action } }));
            } else if (msg.type === "enrichment_field") {
              setEnrichingItems((prev) => {
                const ex = prev[msg.item_id] ?? { fields: {}, action: "" };
                return { ...prev, [msg.item_id]: { ...ex, fields: { ...ex.fields, [msg.field]: msg.value } } };
              });
            } else if (msg.type === "enrichment_complete") {
              // Mark completing → triggers fade-out, then fetch+remove after animation
              setEnrichingItems((prev) => {
                const ex = prev[msg.item_id];
                if (!ex) return prev;
                return { ...prev, [msg.item_id]: { ...ex, completing: true } };
              });
              setTimeout(() => {
                fetchItems().then(() => {
                  setEnrichingItems((prev) => { const next = { ...prev }; delete next[msg.item_id]; return next; });
                });
              }, 600);
            } else if (msg.type === "enrichment_error") {
              setEnrichingItems((prev) => {
                const ex = prev[msg.item_id] ?? { fields: {}, action: "" };
                return { ...prev, [msg.item_id]: { ...ex, errorReason: msg.error_reason ?? "unknown", errorMessage: msg.message } };
              });
              // Refresh from Firestore so captured_data reflects the persisted error, then clear enriching state
              setTimeout(() => {
                fetchItems().then(() => {
                  setEnrichingItems((prev) => { const next = { ...prev }; delete next[msg.item_id]; return next; });
                });
              }, 800);
            } else if (msg.type === "agent_screenshot") {
              setEnrichingItems((prev) => {
                const ex = prev[msg.item_id] ?? { fields: {}, action: "" };
                return { ...prev, [msg.item_id]: { ...ex, screenshot: msg.b64 } };
              });
            } else if (msg.type === "agent_url") {
              setEnrichingItems((prev) => {
                const ex = prev[msg.item_id] ?? { fields: {}, action: "" };
                return { ...prev, [msg.item_id]: { ...ex, currentUrl: msg.url } };
              });
            } else if (msg.type === "agent_thought") {
              setEnrichingItems((prev) => {
                const ex = prev[msg.item_id] ?? { fields: {}, action: "" };
                return { ...prev, [msg.item_id]: { ...ex, thought: msg.text } };
              });
            } else if (msg.type === "item_deleted") {
              setItems((prev) => prev.filter((i) => i.id !== msg.item_id));
              setEnrichingItems((prev) => { const next = { ...prev }; delete next[msg.item_id]; return next; });
            }
          } catch { fetchItems(); }
        };
      } catch { setWsAlive(false); }
    };

    connect();
    return () => { dead = true; ws?.close(); };
  }, [fetchItems]);

  // Listen for messages relayed from background.js
  useEffect(() => {
    const listener = (msg: { action: string; payload?: Record<string, unknown>; pcm?: number[]; rms?: number }) => {
      if (msg.action === "SIDEPANEL_MESSAGE" && msg.payload) {
        const { type } = msg.payload as { type: string };
        if (type === "ready") {
          setListenActive(true);
          setClarifyQuestion(null);
        } else if (type === "session_end") {
          // Backend auto-stopped after intent dispatch — background closed the socket.
          // Stop the mic tracks and update UI state.
          stopMicRef.current();
          setListenActive(false);
          setClarifyQuestion(null);
          fetchItems();
        } else if (type === "clarify") {
          // Sonic is asking a clarifying question — keep session open, show banner
          const q = (msg.payload as { question?: string }).question ?? null;
          setClarifyQuestion(q);
        } else if (type === "closed" || type === "error") {
          setListenActive(false);
          setClarifyQuestion(null);
          if (type === "error") setListenError("WebSocket error — check backend is running.");
        } else if (type === "barge_in") {
          // nothing extra needed — offscreen handles VAD
        } else if (type === "confirmation") {
          setClarifyQuestion(null);
        }
      }
      if (msg.action === "SIDEPANEL_AUDIO" && msg.pcm) {
        enqueueAudio(new Uint8Array(msg.pcm).buffer);
      }
      if (msg.action === "SIDEPANEL_MIC_RMS" && msg.rms !== undefined) {
        micRmsRef.current = msg.rms;
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [enqueueAudio]);

  // Tab change detection: when session is active and user switches tabs,
  // send a new INITIAL_CONTEXT so the backend creates a new ledger item.
  const lastTabUrlRef = useRef<string>("");
  useEffect(() => {
    if (!listenActive) return;
    const handleTabActivated = () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (!tab) return;
        const newUrl = tab.url ?? "";
        if (newUrl && newUrl !== lastTabUrlRef.current) {
          lastTabUrlRef.current = newUrl;
          chrome.runtime.sendMessage({
            action: "UPDATE_SIDEPANEL_CONTEXT",
            tabUrl: newUrl,
            tabTitle: tab.title ?? "",
          });
          fetchItems(); // refresh ledger to show new card when it appears
        }
      });
    };
    chrome.tabs.onActivated.addListener(handleTabActivated);
    chrome.tabs.onUpdated.addListener(handleTabActivated);
    return () => {
      chrome.tabs.onActivated.removeListener(handleTabActivated);
      chrome.tabs.onUpdated.removeListener(handleTabActivated);
    };
  }, [listenActive, fetchItems]);

  // Barge-in: when AI is speaking and we detect we should interrupt,
  // send the control message via background so it reaches the session WS.
  const interruptSentRef = useRef(false);
  useEffect(() => {
    // Reset interrupt flag whenever AI stops speaking
    if (!isAiSpeakingRef.current) interruptSentRef.current = false;
  });

  const stopMic = useCallback(() => {
    if (micWorkletRef.current) { micWorkletRef.current.disconnect(); micWorkletRef.current = null; }
    if (micContextRef.current) { micContextRef.current.close(); micContextRef.current = null; }
    if (micStreamRef.current) { micStreamRef.current.getTracks().forEach((t) => t.stop()); micStreamRef.current = null; }
  }, []);
  stopMicRef.current = stopMic;

  const stopListen = useCallback(() => {
    stopMic();
    chrome.runtime.sendMessage({ action: "STOP_SIDEPANEL_SESSION" });
    flushAudio();
    setListenActive(false);
  }, [flushAudio, stopMic]);

  const startListen = useCallback(async () => {
    setListenError(null);
    try {
      await resumeForPlayback();

      // Capture mic directly in the sidepanel — shares the extension's permission context with popup
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      micStreamRef.current = stream;
      const ctx = new AudioContext({ sampleRate: 16000 });
      micContextRef.current = ctx;

      // Load the AudioWorklet processor (copied to dist/ by vite build)
      await ctx.audioWorklet.addModule(chrome.runtime.getURL("dist/pcm-processor.js"));
      const worklet = new AudioWorkletNode(ctx, "pcm-processor");
      micWorkletRef.current = worklet;

      worklet.port.onmessage = (e) => {
        const { pcm, rms } = e.data as { pcm: ArrayBuffer; rms: number };
        micRmsRef.current = rms;
        chrome.runtime.sendMessage({ action: "AUDIO_DATA", pcm: Array.from(new Uint8Array(pcm)), rms });
      };

      const source = ctx.createMediaStreamSource(stream);
      source.connect(worklet);
      // worklet output is silent — no need to connect to destination

      const tab = await new Promise<{ url: string; title: string }>((resolve) => {
        chrome.runtime.sendMessage({ action: "GET_ACTIVE_TAB" }, (resp) => {
          resolve(resp ?? { url: "", title: "" });
        });
      });
      lastTabUrlRef.current = tab.url ?? "";

      const result = await new Promise<{ ok?: boolean; error?: string }>((resolve) => {
        chrome.runtime.sendMessage(
          { action: "START_SIDEPANEL_SESSION", tabUrl: tab.url, tabTitle: tab.title },
          (resp) => resolve(resp ?? { error: "No response from background" }),
        );
      });

      if (result.error) { stopMic(); throw new Error(result.error); }
    } catch (err) {
      stopMic();
      setListenError(err instanceof Error ? err.message : "Error");
    }
  }, [resumeForPlayback, stopMic]);

  const handleDelete = async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setEnrichingItems((prev) => { const next = { ...prev }; delete next[id]; return next; });
    try {
      await apiFetch(`/ledger/${id}`, { method: "DELETE" });
    } catch { /* already removed from UI */ }
  };

  const handleDeleteAll = async () => {
    const ids = items.map((i) => i.id);
    setItems([]);
    setEnrichingItems({});
    for (const id of ids) {
      try { await apiFetch(`/ledger/${id}`, { method: "DELETE" }); } catch { /* ignore */ }
    }
  };

  const enrichingIds = new Set(Object.keys(enrichingItems));
  const pending = items.filter((i) => i.status === "pending");
  const enriched = items.filter((i) => i.status === "enriched");
  const displayed = [
    ...items.filter((i) => enrichingIds.has(i.id)),
    ...enriched.filter((i) => !enrichingIds.has(i.id)),
    ...pending.filter((i) => !enrichingIds.has(i.id)),
  ];

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100vh",
      background: "linear-gradient(115deg, #d8e4f6 0%, #dbe7f7 22%, #e7edf4 48%, #efe8e9 74%, #f4ddd8 100%)",
      color: "#1D1D1F",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
      fontSize: "13px",
      WebkitFontSmoothing: "antialiased",
    }}>
      {/* Header */}
      <div style={{
        flexShrink: 0,
        background: "rgba(244,248,252,0.56)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(255,255,255,0.46)",
        padding: "14px 14px 12px",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
          <div>
            <div style={{ fontSize: "15px", fontWeight: "600", color: "#1D1D1F", letterSpacing: "-0.02em" }}>
              Debrief
            </div>
            <div style={{ fontSize: "11px", color: "#6E6E73", marginTop: "2px" }}>
              {displayed.length === 0 ? "Ledger clear" : `${displayed.length} item${displayed.length !== 1 ? "s" : ""}`}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: wsAlive ? "#34C759" : "#C7C7CC", boxShadow: wsAlive ? "0 0 6px rgba(52,199,89,0.6)" : "none" }} />
            <span style={{ fontSize: "10px", color: wsAlive ? "#1A7F37" : "#6E6E73", letterSpacing: "0.04em" }}>{wsAlive ? "LIVE" : "OFFLINE"}</span>
          </div>
        </div>

        {/* Clarification banner — shown when Sonic asks a question */}
        {clarifyQuestion && (
          <div style={{
            background: "#FFFFFF",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "1px solid rgba(0,122,255,0.35)",
            borderRadius: "12px",
            padding: "12px 13px",
            marginBottom: "10px",
            boxShadow: "0 0 0 1px rgba(0,122,255,0.10), 0 2px 12px rgba(0,0,0,0.06)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "5px" }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#007AFF", boxShadow: "0 0 6px rgba(0,122,255,0.55)", flexShrink: 0 }} />
              <span style={{ fontSize: "10px", fontWeight: "600", color: "#007AFF", letterSpacing: "0.05em" }}>DEBRIEF ASKS</span>
            </div>
            <div style={{ fontSize: "12.5px", color: "#1D1D1F", lineHeight: "1.45", marginBottom: "5px" }}>{clarifyQuestion}</div>
            <div style={{ fontSize: "10.5px", color: "#6E6E73" }}>Speak your answer</div>
          </div>
        )}

        {/* Capture button */}
        <button
          onClick={() => listenActive ? stopListen() : startListen()}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            width: "100%", padding: "11px 0",
            background: listenActive ? "#FF3B30" : "#1D1D1F",
            color: "#fff", border: "none", borderRadius: "12px",
            fontFamily: "inherit", fontSize: "13px", fontWeight: "600",
            letterSpacing: "-0.01em",
            cursor: "pointer",
            boxShadow: listenActive ? "0 4px 16px rgba(255,59,48,0.28)" : "0 8px 20px rgba(29,29,31,0.18)",
            transition: "box-shadow 0.2s, background 0.15s",
          }}
        >
          <span>{listenActive ? "■" : "▶"}</span>
          {listenActive ? "Stop Capture" : "Start Capture"}
        </button>

        {/* Waveform */}
        {listenActive && (
          <div style={{ marginTop: "10px" }}>
            <Waveform micRmsRef={micRmsRef} aiRmsRef={aiRmsRef} isActive={listenActive} isAiSpeaking={isAiSpeaking} />
          </div>
        )}

        {listenError && (
          <div style={{ marginTop: "8px", padding: "8px 10px", background: "rgba(255,59,48,0.06)", border: "1px solid rgba(255,59,48,0.16)", borderRadius: "10px", fontSize: "11.5px", color: "#FF3B30" }}>{listenError}</div>
        )}
      </div>

      {/* Card list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 10px 0" }}>
        {loading && <div style={{ color: "#6E6E73", fontSize: "11.5px", textAlign: "center", paddingTop: "48px" }}>Loading…</div>}
        {!loading && displayed.length === 0 && (
          <div style={{ textAlign: "center", paddingTop: "60px" }}>
            <div style={{ fontSize: "11px", color: "#3A3A3C", fontWeight: "600", letterSpacing: "0.04em" }}>ALL CLEAR</div>
            <div style={{ fontSize: "11px", color: "#6E6E73", marginTop: "4px" }}>Start a session to capture</div>
          </div>
        )}
        {displayed.map((item) => (
          <LedgerCard key={item.id} item={item} onDelete={handleDelete} enrichingState={enrichingItems[item.id]} />
        ))}
        <div style={{ height: "10px" }} />
      </div>

      {/* Footer */}
      {displayed.length > 0 && (
        <div style={{ flexShrink: 0, borderTop: "1px solid rgba(0,0,0,0.06)", padding: "8px 12px", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={handleDeleteAll}
            style={{ background: "rgba(255,59,48,0.07)", border: "1px solid rgba(255,59,48,0.20)", color: "#FF3B30", fontSize: "11px", fontFamily: "inherit", fontWeight: "600", padding: "5px 13px", borderRadius: "9px", cursor: "pointer", letterSpacing: "0.01em" }}>
            Delete all
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Auth gate ────────────────────────────────────────────────────────────────

function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    getToken().then((t) => setAuthed(!!t));
    const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
      if ("debrief_token" in changes) {
        // Re-check via background so refresh logic applies
        getToken().then((t) => setAuthed(!!t));
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const lightBase: React.CSSProperties = {
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    height: "100vh",
    background: "linear-gradient(115deg, #d8e4f6 0%, #dbe7f7 22%, #e7edf4 48%, #efe8e9 74%, #f4ddd8 100%)",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
    gap: "6px",
    WebkitFontSmoothing: "antialiased",
  };

  if (authed === null) {
    return (
      <div style={lightBase}>
        <div style={{ fontSize: "11px", color: "#6E6E73", letterSpacing: "0.06em" }}>LOADING</div>
      </div>
    );
  }

  if (!authed) {
    return (
      <div style={lightBase}>
        <div style={{ fontSize: "15px", fontWeight: "600", color: "#1D1D1F", letterSpacing: "-0.02em" }}>Debrief</div>
        <div style={{ fontSize: "12px", color: "#6E6E73", marginTop: "4px" }}>Open the popup to sign in</div>
      </div>
    );
  }

  return <SidebarShell />;
}

// ─── Mount ────────────────────────────────────────────────────────────────────

const root = document.getElementById("root")!;
createRoot(root).render(<App />);
