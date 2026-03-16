"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { onAuthStateChanged, getIdToken } from "@/lib/firebase-auth";
import { ledgerApi } from "@/lib/api/ledger";
import { useAudioPlayback } from "@/lib/hooks/useAudioPlayback";
import { useAudioStream } from "@/lib/hooks/useAudioStream";
import type { LedgerItem, LedgerWsMessage } from "@/types/ledger";

// ─── Types ────────────────────────────────────────────────────────────────────

type IntegrationTarget = "notion" | "todoist" | "slack" | "sheets";

const INTEGRATION_LABELS: Record<IntegrationTarget, string> = {
  notion: "NT",
  todoist: "TD",
  slack: "SL",
  sheets: "GS",
};

// Metadata fields excluded from the visible enrichment display
const ENRICHMENT_META_FIELDS = new Set(["enrichment_method", "enriched_at"]);

// ─── Item Card ────────────────────────────────────────────────────────────────

function LedgerCard({
  item,
  onResolve,
  enrichingState,
}: {
  item: LedgerItem;
  onResolve: (id: string, closeTab: boolean) => void;
  enrichingState?: { fields: Record<string, unknown>; action: string };
}) {
  const [routing, setRouting] = useState(false);
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
  if (item.intent_description) {
    if (/newsletter|publish|post/i.test(item.intent_description)) tags.push("#Publishing");
    if (/research|study|read/i.test(item.intent_description)) tags.push("#Research");
    if (/lead|contact|reach/i.test(item.intent_description)) tags.push("#Leads");
    if (/buy|purchase|order/i.test(item.intent_description)) tags.push("#ToBuy");
    if (/snippet|code|script/i.test(item.intent_description)) tags.push("#Code");
  }
  if (tags.length === 0) tags.push("#Misc");

  const isUrgent = item.intent_description
    ? /urgent|asap|immediately|priority|important/i.test(item.intent_description)
    : false;

  const handleRoute = async (target: IntegrationTarget) => {
    setRouting(true);
    console.log(`Routing item ${item.id} to ${target}`);
    await onResolve(item.id, item.should_close_tab);
  };

  const handleResolve = async () => {
    setRouting(true);
    await onResolve(item.id, item.should_close_tab);
  };

  // Is Nova Act actively enriching this item?
  const isEnriching = !!enrichingState;
  // Has enrichment completed and we have stored data?
  const isEnriched = !isEnriching && item.status === "enriched" && !!item.captured_data;

  // Card left-border: enriching=green, enriched=solid green, urgent=red, default=white
  const borderLeft = isEnriching
    ? "4px solid #00ff00"
    : isEnriched
    ? "2px solid #00ff00"
    : isUrgent
    ? "4px solid #ff0055"
    : "1px solid #fff";

  return (
    <div
      style={{
        borderLeft,
        borderTop: "1px solid #fff",
        borderRight: "1px solid #fff",
        borderBottom: "1px solid #fff",
        padding: "12px",
        marginBottom: "8px",
        background: "#000",
        opacity: routing ? 0.4 : 1,
        transition: "opacity 0.1s, border-left 0.3s",
      }}
    >
      {/* Header row */}
      <div
        onClick={() => setExpanded((v) => !v)}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: expanded ? "6px" : 0, cursor: "pointer" }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "11px", fontWeight: "bold", color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {item.page_title ?? new URL(item.url).hostname}
          </div>
          <div style={{ fontSize: "9px", color: "#555", marginTop: "2px" }}>{age}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "8px" }}>
          {isUrgent && !isEnriching && (
            <div style={{ fontSize: "8px", color: "#ff0055", fontWeight: "bold", whiteSpace: "nowrap" }}>
              !! URGENT
            </div>
          )}
          {isEnriching && (
            <div style={{ fontSize: "8px", color: "#00ff00", fontWeight: "bold", whiteSpace: "nowrap" }}>
              ⬡ NOVA ACT
            </div>
          )}
          <div style={{ fontSize: "8px", color: "#555" }}>{expanded ? "▲" : "▼"}</div>
        </div>
      </div>

      {expanded && (<>
      {/* Surgical snippet */}
      {item.selection_text && (
        <div
          style={{
            background: "#111",
            border: "1px solid #333",
            padding: "6px 8px",
            fontSize: "10px",
            color: "#fff",
            fontFamily: "JetBrains Mono, Courier New, monospace",
            marginBottom: "6px",
            overflowX: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {item.selection_text}
        </div>
      )}

      {/* Vocal intent */}
      {item.intent_description && (
        <div style={{ fontSize: "10px", color: "#aaa", marginBottom: "6px", fontStyle: "italic" }}>
          &ldquo;{item.intent_description}&rdquo;
        </div>
      )}

      {/* Nova Act live enrichment — fields streaming in one by one */}
      {isEnriching && (
        <div
          style={{
            borderTop: "1px solid #00ff00",
            marginTop: "6px",
            paddingTop: "6px",
            marginBottom: "6px",
          }}
        >
          <div style={{ fontSize: "8px", color: "#00ff00", marginBottom: "4px", letterSpacing: "0.1em" }}>
            ⬡ NOVA ACT: {enrichingState.action.replace(/_/g, " ").toUpperCase()}
          </div>
          {Object.keys(enrichingState.fields).length === 0 && (
            <div style={{ fontSize: "9px", color: "#555" }}>scanning...</div>
          )}
          {Object.entries(enrichingState.fields).map(([field, value]) => (
            <div key={field} style={{ fontSize: "9px", display: "flex", gap: "6px", marginBottom: "2px" }}>
              <span style={{ color: "#00ff00", minWidth: "90px", textTransform: "uppercase", flexShrink: 0 }}>
                {field.replace(/_/g, " ")}
              </span>
              <span style={{ color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {Array.isArray(value) ? (value as string[]).join(", ") : String(value)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Static enriched data (after enrichment_complete + re-fetch) */}
      {isEnriched && (
        <div
          style={{
            borderTop: "1px solid #00ff00",
            marginTop: "6px",
            paddingTop: "6px",
            marginBottom: "6px",
          }}
        >
          <div style={{ fontSize: "8px", color: "#00ff00", marginBottom: "4px", letterSpacing: "0.1em" }}>
            ⬡ ENRICHED
          </div>
          {Object.entries(item.captured_data!)
            .filter(([k, v]) =>
              !ENRICHMENT_META_FIELDS.has(k) &&
              v !== null &&
              v !== "" &&
              !(Array.isArray(v) && v.length === 0)
            )
            .map(([field, value]) => (
              <div key={field} style={{ fontSize: "9px", display: "flex", gap: "6px", marginBottom: "2px" }}>
                <span style={{ color: "#00ff00", minWidth: "90px", textTransform: "uppercase", flexShrink: 0 }}>
                  {field.replace(/_/g, " ")}
                </span>
                <span style={{ color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {Array.isArray(value) ? (value as string[]).join(", ") : String(value)}
                </span>
              </div>
            ))}
        </div>
      )}

      {/* Tags */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "8px" }}>
        {tags.map((t) => (
          <span
            key={t}
            style={{ fontSize: "8px", color: "#00ff00", border: "1px solid #00ff00", padding: "1px 4px" }}
          >
            {t}
          </span>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
        {(["notion", "todoist", "slack", "sheets"] as IntegrationTarget[]).map((t) => (
          <button
            key={t}
            onClick={() => handleRoute(t)}
            disabled={routing}
            style={{
              background: "#000",
              border: "1px solid #fff",
              color: "#fff",
              fontSize: "8px",
              fontFamily: "inherit",
              fontWeight: "bold",
              padding: "3px 6px",
              cursor: "pointer",
            }}
          >
            {INTEGRATION_LABELS[t]}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button
          onClick={handleResolve}
          disabled={routing}
          style={{
            background: "rgba(255,255,255,0.10)",
            border: "1px solid rgba(255,255,255,0.18)",
            color: "#fff",
            fontSize: "8px",
            fontFamily: "inherit",
            fontWeight: "bold",
            padding: "4px 10px",
            cursor: "pointer",
            textTransform: "uppercase",
            borderRadius: "999px",
            letterSpacing: "0.1em",
            boxShadow: "0 8px 18px rgba(0,0,0,0.18)",
          }}
        >
          DONE
        </button>
      </div>
      </>)}
    </div>
  );
}

// ─── Sidebar Shell ────────────────────────────────────────────────────────────

function SidebarShell() {
  const [items, setItems] = useState<LedgerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [wsAlive, setWsAlive] = useState(false);
  // Per-item enrichment state: item_id → { fields, action }
  const [enrichingItems, setEnrichingItems] = useState<
    Record<string, { fields: Record<string, unknown>; action: string }>
  >({});
  // Voice / session state
  const params = useSearchParams();
  const extId = params.get("extId") ?? "";
  const [listenActive, setListenActive] = useState(false);
  const [listenError, setListenError] = useState<string | null>(null);
  const sessionWsRef = useRef<WebSocket | null>(null);
  const micStartedRef = useRef(false);

  const { enqueue: enqueueAudio, flush: flushAudio, isAiSpeakingRef, resumeForPlayback } = useAudioPlayback();

  const sendChunk = useCallback((chunk: ArrayBuffer) => {
    const ws = sessionWsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(chunk);
  }, []);

  const sendControl = useCallback((msg: object) => {
    const ws = sessionWsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  const { prepare: prepareMic, startRecording, stop: stopMic, resetInterruptFlag } = useAudioStream(
    sendChunk,
    flushAudio,
    isAiSpeakingRef,
    sendControl,
  );

  const fetchItems = useCallback(async () => {
    try {
      const { data } = await ledgerApi.list();
      setItems(data.filter((i: LedgerItem) => i.status !== "resolved"));
    } catch {
      // silently retry on next poll
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll every 5 s as fallback
  useEffect(() => {
    fetchItems();
    const iv = setInterval(fetchItems, 5000);
    return () => clearInterval(iv);
  }, [fetchItems]);

  // WebSocket — enrichment streaming + live-update pulse
  useEffect(() => {
    let ws: WebSocket | null = null;
    let dead = false;

    const connect = async () => {
      try {
        const token = await getIdToken();
        const wsUrl = token
          ? `ws://localhost:8000/ws/ledger?token=${encodeURIComponent(token)}`
          : "ws://localhost:8000/ws/ledger";
        ws = new WebSocket(wsUrl);
        ws.onopen = () => setWsAlive(true);
        ws.onclose = () => {
          setWsAlive(false);
          if (!dead) setTimeout(connect, 3000);
        };
        ws.onerror = () => ws?.close();

        ws.onmessage = (event) => {
          try {
            const msg: LedgerWsMessage = JSON.parse(event.data);

            if (msg.type === "enrichment_start") {
              setEnrichingItems((prev) => ({
                ...prev,
                [msg.item_id]: { fields: {}, action: msg.action },
              }));
            } else if (msg.type === "enrichment_field") {
              setEnrichingItems((prev) => {
                const ex = prev[msg.item_id] ?? { fields: {}, action: "" };
                return {
                  ...prev,
                  [msg.item_id]: {
                    ...ex,
                    fields: { ...ex.fields, [msg.field]: msg.value },
                  },
                };
              });
            } else if (msg.type === "enrichment_complete") {
              // Re-fetch canonical Firestore state, then clear the live overlay
              fetchItems().then(() => {
                setEnrichingItems((prev) => {
                  const next = { ...prev };
                  delete next[msg.item_id];
                  return next;
                });
              });
            } else if (msg.type === "enrichment_error") {
              setEnrichingItems((prev) => {
                const next = { ...prev };
                delete next[msg.item_id];
                return next;
              });
            }
            // tab_audit_flag is handled via chrome.notifications in background.js
          } catch {
            // Non-JSON — fall back to poll
            fetchItems();
          }
        };
      } catch {
        setWsAlive(false);
      }
    };

    connect();
    return () => {
      dead = true;
      ws?.close();
    };
  }, [fetchItems]);

  const stopListen = useCallback(() => {
    stopMic();
    sessionWsRef.current?.close();
    sessionWsRef.current = null;
    micStartedRef.current = false;
    setListenActive(false);
  }, [stopMic]);

  const startListen = useCallback(async () => {
    setListenError(null);
    try {
      // getUserMedia MUST be the first await — any prior async call breaks the
      // user-gesture chain and Chrome will deny the permission.
      try {
        await prepareMic();
      } catch {
        throw new Error("Mic access denied — allow microphone for localhost:4321 in Chrome settings.");
      }
      await resumeForPlayback();

      const token = await getIdToken();
      if (!token) throw new Error("Not authenticated");

      // Ask background.js for the active tab's URL/title
      let tabUrl = "";
      let tabTitle = "";
      if (extId && typeof chrome !== "undefined") {
        const tab = await new Promise<{ url: string; title: string }>((resolve) => {
          chrome.runtime.sendMessage(extId, { action: "GET_ACTIVE_TAB" }, (resp) => {
            resolve(resp ?? { url: "", title: "" });
          });
        });
        tabUrl = tab.url;
        tabTitle = tab.title;
      }

      const sessionId = crypto.randomUUID();
      const wsBase = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/^http/, "ws");
      const ws = new WebSocket(`${wsBase}/sessions/${sessionId}/stream?token=${encodeURIComponent(token)}`);
      ws.binaryType = "arraybuffer";
      sessionWsRef.current = ws;
      micStartedRef.current = false;

      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: "INITIAL_CONTEXT",
          data: { url: tabUrl, title: tabTitle, selection: "", tab_id: "" },
        }));
      };

      ws.onmessage = async (e) => {
        if (typeof e.data === "string") {
          const msg = JSON.parse(e.data);
          if (msg.type === "ready") {
            setListenActive(true);
            if (!micStartedRef.current) {
              micStartedRef.current = true;
              startRecording();
            }
          } else if (msg.type === "ai_turn_end") {
            // AI finished speaking — resume mic if barge-in had paused it
            if (!micStartedRef.current) {
              micStartedRef.current = true;
              startRecording();
            }
          } else if (msg.type === "barge_in") {
            resetInterruptFlag();
          }
        } else {
          enqueueAudio(e.data as ArrayBuffer);
        }
      };

      ws.onerror = () => setListenError("WebSocket error — check backend is running.");
      ws.onclose = () => { setListenActive(false); sessionWsRef.current = null; };
    } catch (err) {
      setListenError(err instanceof Error ? err.message : "Error");
    }
  }, [extId, prepareMic, resumeForPlayback, startRecording, resetInterruptFlag, enqueueAudio]); // resumeForPlayback kept — called at top of startListen

  const handleListenToggle = () => {
    if (listenActive) { stopListen(); } else { startListen(); }
  };

  const handleResolve = async (id: string, closeTab: boolean) => {
    try {
      await ledgerApi.resolve(id, closeTab);
      setItems((prev) => prev.filter((i: LedgerItem) => i.id !== id));
    } catch {
      // ignore
    }
  };

  const handleResolveAll = async () => {
    for (const item of items) {
      await ledgerApi.resolve(item.id, item.should_close_tab);
    }
    setItems([]);
  };

  const pending = items.filter((i) => i.status === "pending");
  const enriched = items.filter((i) => i.status === "enriched");
  const enrichingIds = new Set(Object.keys(enrichingItems));
  // Display order: actively enriching first, then stored-enriched, then pending
  const displayed = [
    ...items.filter((i) => enrichingIds.has(i.id)),
    ...enriched.filter((i) => !enrichingIds.has(i.id)),
    ...pending.filter((i) => !enrichingIds.has(i.id)),
  ];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "#000",
        color: "#fff",
        fontFamily: "JetBrains Mono, Courier New, monospace",
        fontSize: "12px",
      }}
    >
      {/* ── Header ── */}
      <div style={{ flexShrink: 0 }}>
        <div
          style={{
            padding: "8px 12px",
            borderBottom: listenActive ? "1px solid #ff0055" : "1px solid #fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontWeight: "bold", letterSpacing: "0.15em", fontSize: "9px", textTransform: "uppercase" }}>
            DEBRIEF // INTENT LEDGER
          </span>
          <span style={{ fontSize: "8px", color: "#555" }}>{displayed.length} PENDING</span>
        </div>
        <button
          onClick={handleListenToggle}
          style={{
            display: "block",
            width: "100%",
            padding: "14px 0",
            background: listenActive ? "#ff0055" : "#fff",
            color: listenActive ? "#fff" : "#000",
            border: "none",
            borderBottom: "1px solid #fff",
            fontFamily: "JetBrains Mono, Courier New, monospace",
            fontSize: "11px",
            fontWeight: "bold",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          {listenActive ? "■  STOP  CAPTURE" : "►  START  CAPTURE"}
        </button>
        {listenError && (
          <div style={{ padding: "4px 12px", fontSize: "8px", color: "#ff0055", borderBottom: "1px solid #333" }}>
            {listenError}
          </div>
        )}
      </div>

      {/* ── Ledger list ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 10px 0" }}>
        {loading && (
          <div style={{ color: "#555", fontSize: "10px", textAlign: "center", paddingTop: "40px" }}>
            LOADING...
          </div>
        )}
        {!loading && displayed.length === 0 && (
          <div style={{ color: "#333", fontSize: "10px", textAlign: "center", paddingTop: "40px" }}>
            LEDGER CLEAR
          </div>
        )}
        {displayed.map((item) => (
          <LedgerCard
            key={item.id}
            item={item}
            onResolve={handleResolve}
            enrichingState={enrichingItems[item.id]}
          />
        ))}
      </div>

      {/* ── Footer ── */}
      <div
        style={{
          borderTop: "1px solid #fff",
          padding: "8px 12px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          flexShrink: 0,
        }}
      >
        {/* Connection pulse */}
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <div
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              background: wsAlive ? "#00ff00" : "#555",
            }}
          />
          <span style={{ fontSize: "8px", color: wsAlive ? "#00ff00" : "#555" }}>
            {wsAlive ? "LIVE" : "OFFLINE"}
          </span>
        </div>

        <div style={{ flex: 1 }} />

        {/* Bulk resolve */}
        {displayed.length > 0 && (
          <button
            onClick={handleResolveAll}
            style={{
              background: "#000",
              border: "1px solid #ff0055",
              color: "#ff0055",
              fontSize: "8px",
              fontFamily: "inherit",
              fontWeight: "bold",
              padding: "4px 8px",
              cursor: "pointer",
              textTransform: "uppercase",
            }}
          >
            CLEAR ALL
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Page root (auth gate) ────────────────────────────────────────────────────

export default function SidePanelPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged((user) => setAuthed(!!user));
    return unsub;
  }, []);

  if (authed === null) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#000", color: "#fff", fontFamily: "Courier New, monospace", fontSize: "12px" }}>
        LOADING...
      </div>
    );
  }

  if (!authed) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", background: "#000", color: "#fff", fontFamily: "Courier New, monospace", fontSize: "12px", gap: "12px" }}>
        <span style={{ opacity: 0.5, fontSize: "10px" }}>NOT AUTHENTICATED</span>
        <a
          href="http://localhost:4321/login?ext=1"
          target="_blank"
          rel="noreferrer"
          style={{ color: "#fff", fontSize: "10px", fontWeight: "bold", textDecoration: "underline" }}
        >
          LOG IN
        </a>
      </div>
    );
  }

  return <SidebarShell />;
}
