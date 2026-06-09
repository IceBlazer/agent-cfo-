const DEFAULT_API_BASE = "http://127.0.0.1:8787";

async function getApiBase() {
  const stored = await chrome.storage.sync.get(["apiBase"]);
  return stored.apiBase || DEFAULT_API_BASE;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "APE_AUDIT") {
    runAudit(message.payload)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }

  if (message.type === "APE_RESOLVE") {
    runResolve(message.payload)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
});

async function runAudit(payload) {
  const apiBase = await getApiBase();
  const response = await fetch(`${apiBase}/api/audit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Audit failed (${response.status}): ${detail}`);
  }

  return response.json();
}

async function runResolve(payload) {
  const apiBase = await getApiBase();
  const response = await fetch(`${apiBase}/api/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Resolve failed (${response.status}): ${detail}`);
  }

  return response.json();
}
