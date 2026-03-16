/**
 * background.js — Service Worker
 *
 * Orchestrates the full capture flow:
 *   1. Cmd+Shift+D → inject content.js modal into active tab
 *   2. content.js sends START_SESSION with page metadata
 *   3. background: generate UUID locally, open WS /sessions/{uuid}/stream-ext directly
 *      (backend auto-creates the session doc on WS connect — no REST pre-call needed)
 *   4. WS open: send INITIAL_CONTEXT text frame with tab/page metadata
 *   5. offscreen.html records microphone → sends PCM binary frames via AUDIO_DATA messages
 *   6. background pipes PCM binary to WebSocket
 *   7. WebSocket text frames forwarded to content.js for UI updates
 *   8. On "close_tab" signal → chrome.tabs.remove(tab_id)
 */

const API_BASE = "http://localhost:8000";
const WS_BASE  = "ws://localhost:8000";

let socket          = null;  // content.js (Ctrl+Shift+U) session socket
let spSocket        = null;  // sidepanel session socket
let spDraining      = false; // true = mic stopped, waiting for ai_turn_end before closing
let spDrainTimer    = null;  // safety close timer while draining
let activeTabId     = null;
let sessionId       = null;
let auditIntervalId = null;
async function requestMicPermission() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["debrief_mic_granted"], (result) => {
      resolve(!!result.debrief_mic_granted);
    });
  });
}

// ── Keyboard shortcut ─────────────────────────────────────────────────────────

chrome.commands.onCommand.addListener((command) => {
  if (command === "trigger-debrief") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      activeTabId = tabs[0].id;
      chrome.tabs.sendMessage(activeTabId, { action: "OPEN_MODAL" });
    });
  } else if (command === "open-sidebar") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      chrome.sidePanel.open({ tabId: tabs[0].id });
    });
  }
});

// ── On install: open extension settings so user can grant mic permission ──────
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` });
  }
});

// ── External message handler (from Debrief web app at localhost:3000) ────────
// The web app calls chrome.runtime.sendMessage(EXT_ID, {action:"AUTH_TOKEN", token})
// after Firebase sign-in, so the user never has to copy-paste anything.

chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  if (request.action === "AUTH_TOKEN" && request.token) {
    const data = { debrief_token: request.token };
    if (request.refreshToken) data.debrief_refresh_token = request.refreshToken;
    chrome.storage.local.set(data, () => { sendResponse({ ok: true }); });
    return true;
  }

  if (request.action === "GET_ACTIVE_TAB") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      sendResponse({
        url:   tab?.url   ?? "",
        title: tab?.title ?? "",
      });
    });
    return true;
  }
});

// ── Internal message handler ──────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Token relayed from content.js (window.postMessage path — no ext ID needed)
  if (request.action === "AUTH_TOKEN" && request.token) {
    const data = { debrief_token: request.token };
    if (request.refreshToken) data.debrief_refresh_token = request.refreshToken;
    chrome.storage.local.set(data);
    return;
  }

  if (request.action === "GET_TOKEN") {
    getToken().then((token) => sendResponse({ token }));
    return true;
  }


  if (request.action === "START_SESSION") {
    const tabId = sender.tab ? sender.tab.id : activeTabId;
    startSession(request.payload, tabId);
    return true;
  }

  if (request.action === "STOP_SESSION") {
    stopSession();
    return;
  }

  if (request.action === "OPEN_SIDEBAR") {
    const tabId = sender.tab ? sender.tab.id : activeTabId;
    if (tabId) chrome.sidePanel.open({ tabId });
    return;
  }

  // Sidepanel asks for active tab context so it can open its own session WS
  if (request.action === "GET_ACTIVE_TAB") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      sendResponse({
        url:   tab?.url   ?? "",
        title: tab?.title ?? "",
      });
    });
    return true; // keep channel open for async sendResponse
  }

  if (request.action === "OFFSCREEN_ERROR") {
    console.error("[bg] Offscreen error:", request.message);
    return;
  }

  // PCM audio data from offscreen page — pipe to whichever socket is active
  if (request.action === "AUDIO_DATA") {
    const buf = new Uint8Array(request.pcm).buffer;
    console.log("[bg] AUDIO_DATA byteLength:", buf.byteLength, "spSocket:", spSocket?.readyState, "socket:", socket?.readyState);
    if (socket && socket.readyState === WebSocket.OPEN) socket.send(buf);
    if (spSocket && spSocket.readyState === WebSocket.OPEN) spSocket.send(buf);
    // Forward mic RMS to sidepanel for waveform visualization
    if (spSocket && request.rms !== undefined) {
      chrome.runtime.sendMessage({ action: "SIDEPANEL_MIC_RMS", rms: request.rms }).catch(() => {});
    }
    return;
  }

  // ── Sidepanel session ──────────────────────────────────────────────────────
  if (request.action === "START_SIDEPANEL_SESSION") {
    startSidepanelSession(request.tabUrl, request.tabTitle).then((err) => {
      if (err) sendResponse({ error: err });
      else sendResponse({ ok: true });
    });
    return true;
  }

  if (request.action === "STOP_SIDEPANEL_SESSION") {
    stopSidepanelSession();
    return;
  }

  // Sidepanel detected an active tab change mid-session — send new INITIAL_CONTEXT
  // so the backend creates a fresh ledger item for the new page.
  if (request.action === "UPDATE_SIDEPANEL_CONTEXT") {
    if (spSocket && spSocket.readyState === WebSocket.OPEN) {
      spSocket.send(JSON.stringify({
        type: "INITIAL_CONTEXT",
        data: { url: request.tabUrl ?? "", title: request.tabTitle ?? "", selection: "", tab_id: "" },
      }));
    }
    return;
  }

  // Sidepanel sends interrupt signal — forward to session WS
  if (request.action === "SIDEPANEL_CONTROL") {
    if (spSocket && spSocket.readyState === WebSocket.OPEN) {
      spSocket.send(JSON.stringify(request.payload));
    }
    return;
  }
});

// ── Session lifecycle ─────────────────────────────────────────────────────────

async function startSession(metadata, tabId) {
  const token = await getToken();
  if (!token) {
    notifyContent("ERROR", "Not logged in. Click the extension icon and log in at localhost:4321.");
    return "Not logged in";
  }

  try {
    // Generate a UUID locally — the backend auto-creates the session doc on WS connect.
    sessionId = crypto.randomUUID();

    socket = new WebSocket(`${WS_BASE}/sessions/${sessionId}/stream-ext?token=${encodeURIComponent(token)}`);
    socket.binaryType = "arraybuffer";

    socket.onopen = () => {
      // Send page context as first text frame — backend creates the ledger entry from this
      socket.send(JSON.stringify({
        type: "INITIAL_CONTEXT",
        data: {
          url:      metadata.url,
          title:    metadata.title,
          selection: metadata.selection,
          tab_id:   String(tabId),
        },
      }));
      notifyContent("STATUS", "Connected — recording...");
      startAuditPolling();
    };

    socket.onmessage = (event) => {
      if (typeof event.data === "string") {
        handleServerText(JSON.parse(event.data));
      }
      // Binary = AI audio — we don't play it back in the extension (no audio element here)
    };

    socket.onerror = () => {
      notifyContent("ERROR", "WebSocket error — check backend is running.");
    };

    socket.onclose = () => {
      notifyContent("STATUS", "Session closed.");
      socket = null;
    };

    // Start audio capture in the offscreen document
    await setupOffscreen();
    chrome.runtime.sendMessage({ action: "START_RECORDING" });

  } catch (err) {
    notifyContent("ERROR", `Failed to start: ${err.message}`);
    return err.message;
  }
}

function stopSession() {
  chrome.runtime.sendMessage({ action: "STOP_RECORDING" });
  if (socket) {
    socket.close();
    socket = null;
  }
  closeOffscreen();
  stopAuditPolling();
}

// ── Sidepanel session lifecycle ───────────────────────────────────────────────

async function _extractPageText(tabId) {
  // Extract visible text from the active tab — strip nav/footer/scripts, cap at 1500 chars.
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "NAV", "FOOTER", "HEADER", "ASIDE"]);
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
          { acceptNode: (n) => SKIP.has(n.parentElement?.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT }
        );
        const parts = [];
        let node;
        while ((node = walker.nextNode())) {
          const t = node.textContent.trim();
          if (t.length > 20) parts.push(t);
        }
        return parts.join(" ").replace(/\s+/g, " ").slice(0, 800);
      },
    });
    return results?.[0]?.result ?? "";
  } catch {
    return "";
  }
}

async function startSidepanelSession(tabUrl, tabTitle) {
  const token = await getToken();
  if (!token) return "Not authenticated";

  if (spDrainTimer) { clearTimeout(spDrainTimer); spDrainTimer = null; }
  spDraining = false;
  if (spSocket) { spSocket.close(); spSocket = null; }

  // Get active tab ID so we can extract page text, selection, and screenshot fallback
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const activeTab = tabs[0];
  let pageText = activeTab?.id ? await _extractPageText(activeTab.id) : "";
  let pageSelection = "";
  if (activeTab?.id) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: () => window.getSelection()?.toString() ?? "",
      });
      pageSelection = results?.[0]?.result ?? "";
    } catch { /* silently skip — CSP or chrome:// page */ }
  }
  let pageScreenshot = "";
  if (!pageText && activeTab?.id) {
    // Text extraction failed (CSP, PDF, chrome:// page) — fall back to screenshot
    try {
      // captureVisibleTab returns a data URL: "data:image/jpeg;base64,..."
      const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: "jpeg", quality: 60 });
      pageScreenshot = dataUrl.split(",")[1] ?? ""; // strip the data: prefix, keep base64
    } catch { /* silently skip */ }
  }

  const spSessionId = crypto.randomUUID();
  spSocket = new WebSocket(`${WS_BASE}/sessions/${spSessionId}/stream-ext?token=${encodeURIComponent(token)}`);
  spSocket.binaryType = "arraybuffer";

  spSocket.onopen = () => {
    spSocket.send(JSON.stringify({
      type: "INITIAL_CONTEXT",
      data: { url: tabUrl ?? "", title: tabTitle ?? "", selection: pageSelection, tab_id: String(activeTab?.id ?? ""), page_text: pageText, page_screenshot: pageScreenshot },
    }));
  };

  spSocket.onmessage = (event) => {
    if (typeof event.data === "string") {
      // Forward text control frames to sidepanel
      chrome.runtime.sendMessage({ action: "SIDEPANEL_MESSAGE", payload: JSON.parse(event.data) }).catch(() => {});
    } else {
      // Convert ArrayBuffer to plain array for structured-clone transfer via sendMessage
      const pcm = Array.from(new Uint8Array(event.data));
      chrome.runtime.sendMessage({ action: "SIDEPANEL_AUDIO", pcm }).catch((e) => {
        console.warn("[bg] SIDEPANEL_AUDIO delivery failed (sidepanel closed?):", e?.message);
      });
    }
  };

  spSocket.onerror = () => {
    chrome.runtime.sendMessage({ action: "SIDEPANEL_MESSAGE", payload: { type: "error", message: "WebSocket error" } }).catch(() => {});
  };

  spSocket.onclose = () => {
    spSocket = null;
    chrome.runtime.sendMessage({ action: "SIDEPANEL_MESSAGE", payload: { type: "closed" } }).catch(() => {});
  };

  // Mic is captured directly in the sidepanel — no offscreen needed for sidepanel sessions
  return null; // no error
}

function stopSidepanelSession() {
  // Mic is stopped by the sidepanel directly.
  // Don't close the WS immediately — Nova Sonic needs a few seconds to process
  // the audio and send back the toolUse event. Close only after ai_turn_end
  // (or after a 8s safety timeout so we don't leave the socket open forever).
  if (!spSocket || spSocket.readyState !== WebSocket.OPEN) return;
  spDraining = true;
  if (spDrainTimer) clearTimeout(spDrainTimer);
  spDrainTimer = setTimeout(() => {
    if (spDraining && spSocket) { spSocket.close(); spSocket = null; spDraining = false; }
  }, 8000);
}

// ── Server message routing ────────────────────────────────────────────────────

function _closeDrainedSocket() {
  if (spDrainTimer) { clearTimeout(spDrainTimer); spDrainTimer = null; }
  if (spSocket) { spSocket.close(); spSocket = null; }
  spDraining = false;
}

function handleServerText(msg) {
  if (msg.type === "ready") {
    notifyContent("STATUS", "Recording voice intent...");
  } else if (msg.type === "close_tab") {
    const targetTabId = parseInt(msg.tab_id, 10);
    if (!isNaN(targetTabId)) {
      chrome.tabs.remove(targetTabId);
    }
  } else if (msg.type === "ai_turn_end") {
    notifyContent("STATUS", "AI responded — keep talking or close.");
    // If mic was already stopped, close the socket now that Sonic has finished its turn
    if (spDraining) _closeDrainedSocket();
  } else if (msg.type === "session_end") {
    // Backend auto-stopped after dispatching an intent — close immediately
    _closeDrainedSocket();
  } else if (msg.type === "clarify") {
    // Sonic is asking a clarifying question — keep session open, suppress drain timer
    if (spDrainTimer) { clearTimeout(spDrainTimer); spDrainTimer = null; }
    spDraining = false;
  } else if (msg.type === "confirmation") {
    // Nova Sonic has confirmed an action — safe to close if draining
    if (spDraining) _closeDrainedSocket();
  } else if (msg.type === "barge_in") {
    notifyContent("STATUS", "Barge-in detected...");
  } else if (msg.type === "interrupt_ack") {
    notifyContent("STATUS", "Interrupted — listening...");
  } else if (msg.type === "tab_audit_flag") {
    chrome.notifications.create(`audit-${msg.tab_id}`, {
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: "Debrief: Redundant Tab",
      message: msg.message ?? "This tab is already in your resolved ledger.",
    });
  }
  // Forward all server messages to popup
  chrome.runtime.sendMessage({ action: "SERVER_MESSAGE", payload: msg }).catch(() => {});
}

// ── Offscreen document ────────────────────────────────────────────────────────

async function setupOffscreen() {
  const has = await chrome.offscreen.hasDocument();
  console.log("[bg] setupOffscreen — hasDocument:", has);
  if (has) return;
  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["USER_MEDIA"],
    justification: "Capture microphone audio for Nova Sonic streaming",
  });
  console.log("[bg] offscreen document created");
}

function closeOffscreen() {
  chrome.offscreen.hasDocument().then((has) => {
    if (has) chrome.offscreen.closeDocument();
  });
}

// ── Tab audit ─────────────────────────────────────────────────────────────────
// Runs every 30s when a session is active. Sends all open tab URLs to the
// backend which compares them against the resolved ledger and pushes
// tab_audit_flag messages back through the /ws/ledger WebSocket.

async function runTabAudit() {
  const token = await getToken();
  if (!token) return;
  chrome.tabs.query({}, async (tabs) => {
    const tabList = tabs
      .filter((t) => t.url && t.url.startsWith("http"))
      .map((t) => ({ tab_id: String(t.id), url: t.url }));
    if (!tabList.length) return;
    try {
      await fetch(`${API_BASE}/ledger/audit-tabs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ tabs: tabList }),
      });
      // Redundant tab flags are pushed back via /ws/ledger — no need to read response
    } catch {
      // Backend offline — silently skip until next interval
    }
  });
}

function startAuditPolling() {
  if (auditIntervalId) return;
  runTabAudit(); // run immediately on session start
  auditIntervalId = setInterval(runTabAudit, 30_000);
}

function stopAuditPolling() {
  if (auditIntervalId) {
    clearInterval(auditIntervalId);
    auditIntervalId = null;
  }
}

// ── Auth token helper ─────────────────────────────────────────────────────────

const FIREBASE_API_KEY = "AIzaSyClV-gw0rly6Q60_diYizhzeBn9-DjeEfY";

function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    // Refresh 60s before actual expiry to avoid races
    return Date.now() / 1000 > payload.exp - 60;
  } catch {
    return true;
  }
}

async function refreshIdToken(refreshToken) {
  const res = await fetch(
    `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grant_type: "refresh_token", refresh_token: refreshToken }),
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return { idToken: data.id_token, refreshToken: data.refresh_token };
}

async function getToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["debrief_token", "debrief_refresh_token"], async (result) => {
      const token = result.debrief_token;
      const refreshToken = result.debrief_refresh_token;
      if (!token) return resolve(null);
      if (!isTokenExpired(token)) return resolve(token);
      if (!refreshToken) return resolve(null);
      const refreshed = await refreshIdToken(refreshToken);
      if (!refreshed) return resolve(null);
      chrome.storage.local.set({ debrief_token: refreshed.idToken, debrief_refresh_token: refreshed.refreshToken });
      resolve(refreshed.idToken);
    });
  });
}

// ── Popup notification helper ─────────────────────────────────────────────────

function notifyContent(type, message) {
  chrome.runtime.sendMessage({ action: "UPDATE_MODAL", type, message }).catch(() => {});
}
