const DEFAULT_API_BASE = "http://127.0.0.1:8787";
const DASHBOARD_BASE = DEFAULT_API_BASE;

const ICON_PATHS = {
  active: { path: "icons/icon-green.png" },
  review: { path: "icons/icon-yellow.png" },
  risk: { path: "icons/icon-red.png" },
  offline: { path: "icons/icon-gray.png" },
};

async function getApiBase() {
  const stored = await chrome.storage.sync.get(["apiBase"]);
  return stored.apiBase || DEFAULT_API_BASE;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "APE_INTERCEPT") {
    runIntercept(message.payload).then(sendResponse).catch((e) => sendResponse({ error: e.message }));
    return true;
  }
  if (message.type === "APE_RESOLVE") {
    runResolve(message.payload).then(sendResponse).catch((e) => sendResponse({ error: e.message }));
    return true;
  }
  if (message.type === "ICON_UPDATE") {
    setIconState(message.state);
    sendResponse({ ok: true });
    return false;
  }
});

async function runIntercept(payload) {
  const apiBase = await getApiBase();
  const response = await fetch(`${apiBase}/api/v1/intercept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

async function runResolve({ purchase_id, action, justification, pending_auth_id }) {
  const apiBase = await getApiBase();
  const response = await fetch(`${apiBase}/api/v1/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ purchase_id, action, justification, pending_auth_id }),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

function setIconState(state) {
  const cfg = ICON_PATHS[state] || ICON_PATHS.active;
  chrome.action.setIcon({ path: cfg.path }).catch(() => {
    // Icons optional — badge fallback
    const colors = { active: "#16A34A", review: "#EAB308", risk: "#DC2626", offline: "#9CA3AF" };
    chrome.action.setBadgeBackgroundColor({ color: colors[state] || colors.active });
    chrome.action.setBadgeText({ text: state === "active" ? "✓" : "!" });
  });
  const titles = {
    active: "AgentCFO — AI Finance Assistant · Protection is ON",
    review: "AgentCFO — Review needed",
    risk: "AgentCFO — Action needed",
    offline: "AgentCFO — Offline",
  };
  chrome.action.setTitle({ title: titles[state] || titles.active });
}

chrome.runtime.onInstalled.addListener(() => setIconState("active"));
