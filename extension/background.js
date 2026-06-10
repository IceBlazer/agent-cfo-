const DEFAULT_API_BASE = "http://127.0.0.1:8787";

async function getApiBase() {
  const stored = await chrome.storage.sync.get(["apiBase"]);
  return stored.apiBase || DEFAULT_API_BASE;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "APE_INTERCEPT") {
    runIntercept(message.payload).then(sendResponse).catch((err) => sendResponse({ error: err.message }));
    return true;
  }

  if (message.type === "APE_RESOLVE") {
    runResolve(message.payload).then(sendResponse).catch((err) => sendResponse({ error: err.message }));
    return true;
  }

  // Legacy message types
  if (message.type === "APE_AUDIT") {
    runIntercept(message.payload).then(sendResponse).catch((err) => sendResponse({ error: err.message }));
    return true;
  }
});

async function runIntercept(payload) {
  const apiBase = await getApiBase();
  const response = await fetch(`${apiBase}/api/v1/intercept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Intercept failed (${response.status}): ${detail}`);
  }

  return response.json();
}

async function runResolve({ auth_id, action, justification }) {
  const apiBase = await getApiBase();
  const bridgeAction = action === "approve" || action === "override" ? "approve" : "decline";
  const response = await fetch(
    `${apiBase}/api/v1/resolve?action=${bridgeAction}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auth_id, justification: justification || "" }),
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Resolve failed (${response.status}): ${detail}`);
  }

  return response.json();
}
