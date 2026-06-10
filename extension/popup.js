const apiBase = document.getElementById("apiBase");
const riskTolerance = document.getElementById("riskTolerance");
const saveBtn = document.getElementById("save");
const hubDot = document.getElementById("hub-dot");
const hubText = document.getElementById("hub-text");

chrome.storage.sync.get(["apiBase", "riskTolerance"], (stored) => {
  if (stored.apiBase) apiBase.value = stored.apiBase;
  if (stored.riskTolerance) riskTolerance.value = stored.riskTolerance;
  checkHub(stored.apiBase || "http://127.0.0.1:8787");
});

saveBtn.addEventListener("click", () => {
  const url = apiBase.value.trim();
  chrome.storage.sync.set({ apiBase: url, riskTolerance: riskTolerance.value }, () => {
    saveBtn.textContent = "Saved!";
    checkHub(url);
    setTimeout(() => {
      saveBtn.textContent = "Save Settings";
    }, 1400);
  });
});

document.getElementById("launchDemo").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("demo.html") });
});

document.getElementById("previewUI").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("preview.html") });
});

document.getElementById("launchServerDemo").addEventListener("click", () => {
  const url = `${apiBase.value.trim().replace(/\/$/, "")}/demo`;
  chrome.tabs.create({ url });
});

async function checkHub(base) {
  hubDot.className = "status-dot";
  hubText.textContent = "Checking Python hub…";
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/health`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      hubDot.classList.add("status-dot--ok");
      hubText.textContent = "Python hub online — ready for live demo";
    } else {
      throw new Error("not ok");
    }
  } catch {
    hubDot.classList.add("status-dot--err");
    hubText.textContent = "Python hub offline — run: python api_server.py";
  }
}
