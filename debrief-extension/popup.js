const openAppBtn    = document.getElementById("open-app-btn");
const openSidebarBtn= document.getElementById("open-sidebar-btn");
const logoutBtn     = document.getElementById("logout-btn");
const loginBtn      = document.getElementById("login-btn");
const stateOut      = document.getElementById("state-logged-out");
const stateIn       = document.getElementById("state-logged-in");
const dot           = document.getElementById("dot");
const statusText    = document.getElementById("status-text");
const snippetEl     = document.getElementById("snippet");
const captureBtn    = document.getElementById("capture-btn");
const footerUrl     = document.getElementById("footer-url");

const LOGIN_URL = "http://localhost:4321/login?ext=1";
const APP_URL   = "http://localhost:4321/home";

let capturing = false;

// ── Init ──────────────────────────────────────────────────────────────────────

chrome.storage.local.get(["debrief_token", "debrief_mic_granted"], async (result) => {
  if (result.debrief_token) {
    showLoggedIn();
    if (!result.debrief_mic_granted) {
      captureBtn.textContent = "🎙 Enable Microphone";
      captureBtn.classList.remove("stop");
      statusText.textContent = "Mic access required — click to enable.";
      setDot("error");
      captureBtn.onclick = async () => {
        try {
          const s = await navigator.mediaDevices.getUserMedia({ audio: true });
          s.getTracks().forEach((t) => t.stop());
          // Permission granted — store flag and restore normal capture button
          chrome.storage.local.set({ debrief_mic_granted: true });
          captureBtn.textContent = "▶ Start Capture";
          statusText.textContent = "Microphone enabled. Ready to capture.";
          statusText.style.color = "";
          setDot("idle");
          captureBtn.onclick = null;
          captureBtn.addEventListener("click", () => capturing ? stopCapture() : startCapture());
        } catch {
          // Chrome blocked getUserMedia in the popup — open extension settings so user can grant manually
          statusText.textContent = "Click below to open mic settings, set Microphone → Allow, then reopen this popup.";
          statusText.style.color = "#ff0055";
          captureBtn.textContent = "⚙ Open Extension Settings";
          captureBtn.onclick = () => {
            chrome.tabs.create({ url: `chrome://settings/content/siteDetails?site=chrome-extension://${chrome.runtime.id}` });
            window.close();
          };
        }
      };
    }
  } else {
    showLoggedOut();
  }
});

// ── Icon buttons ──────────────────────────────────────────────────────────────

loginBtn.addEventListener("click", () => {
  chrome.tabs.create({ url: LOGIN_URL });
  window.close();
});

openAppBtn.addEventListener("click", () => {
  chrome.tabs.create({ url: APP_URL });
  window.close();
});

openSidebarBtn.addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.sidePanel.open({ tabId: tabs[0].id });
    }
    window.close();
  });
});

logoutBtn.addEventListener("click", () => {
  chrome.storage.local.remove("debrief_token");
  showLoggedOut();
});

// ── Capture button ────────────────────────────────────────────────────────────

captureBtn.addEventListener("click", () => {
  if (captureBtn.onclick) return; // mic-enable mode — let onclick handle it
  if (!capturing) {
    startCapture();
  } else {
    stopCapture();
  }
});

function startCapture() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    const tab = tabs[0];

    const selection = ""; // popup can't read page selection — background handles it
    const metadata = {
      url:       tab.url,
      title:     tab.title,
      selection: selection,
    };

    // Show snippet of title
    if (tab.title) {
      snippetEl.textContent = tab.title;
      snippetEl.classList.add("visible");
    }
    footerUrl.textContent = tab.url;

    setDot("recording");
    statusText.textContent = "Connecting...";
    captureBtn.textContent = "■ Stop";
    captureBtn.classList.add("stop");
    capturing = true;

    chrome.runtime.sendMessage({ action: "START_SESSION", payload: metadata });
  });
}

function stopCapture() {
  capturing = false;
  captureBtn.textContent = "▶ Start Capture";
  captureBtn.classList.remove("stop");
  setDot("idle");
  statusText.textContent = "Ready to capture.";
  snippetEl.classList.remove("visible");
  chrome.runtime.sendMessage({ action: "STOP_SESSION" });
}

// ── Background message updates ────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((request) => {
  if (request.action === "UPDATE_MODAL") {
    if (request.type === "ERROR") {
      setDot("error");
      statusText.textContent = request.message;
    } else {
      statusText.textContent = request.message;
    }
  }
  if (request.action === "SERVER_MESSAGE") {
    const msg = request.payload;
    const map = {
      ready:         ["ready", "Listening..."],
      ai_turn_end:   ["ready", "AI responded — keep talking or stop."],
      barge_in:      ["recording", "Barge-in detected..."],
      interrupt_ack: ["ready", "Interrupted — listening..."],
      close_tab:     ["idle", "Session complete."],
    };
    if (map[msg.type]) {
      setDot(map[msg.type][0]);
      statusText.textContent = map[msg.type][1];
      if (msg.type === "close_tab") {
        capturing = false;
        captureBtn.textContent = "▶ Start Capture";
        captureBtn.classList.remove("stop");
        snippetEl.classList.remove("visible");
      }
    }
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function showLoggedIn() {
  stateOut.style.display = "none";
  stateIn.style.display  = "block";
  logoutBtn.style.display = "inline-block";
}

function showLoggedOut() {
  stateIn.style.display  = "none";
  stateOut.style.display = "block";
  logoutBtn.style.display = "none";
}

function setDot(state) {
  dot.className = "dot " + state;
}
