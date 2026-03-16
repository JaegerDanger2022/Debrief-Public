/**
 * content.js
 *
 * Relays auth token from the localhost:4321 login page to background.js.
 * No UI is injected — capture is handled entirely via the extension popup.
 */

if (location.hostname === "localhost" && location.port === "4321") {
  const stored = localStorage.getItem("debrief_ext_token");
  const storedRefresh = localStorage.getItem("debrief_ext_refresh_token");
  if (stored) {
    chrome.runtime.sendMessage({ action: "AUTH_TOKEN", token: stored, refreshToken: storedRefresh || undefined });
    localStorage.removeItem("debrief_ext_token");
    localStorage.removeItem("debrief_ext_refresh_token");
  }
  window.addEventListener("message", (event) => {
    if (event.origin !== "http://localhost:4321") return;
    if (event.data?.type !== "DEBRIEF_AUTH_TOKEN" || !event.data.token) return;
    chrome.runtime.sendMessage({ action: "AUTH_TOKEN", token: event.data.token, refreshToken: event.data.refreshToken || undefined });
    localStorage.removeItem("debrief_ext_token");
    localStorage.removeItem("debrief_ext_refresh_token");
  });
}
