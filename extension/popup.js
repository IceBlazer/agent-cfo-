const apiBase = document.getElementById("apiBase");
const riskTolerance = document.getElementById("riskTolerance");
const saveBtn = document.getElementById("save");

chrome.storage.sync.get(["apiBase", "riskTolerance"], (stored) => {
  if (stored.apiBase) apiBase.value = stored.apiBase;
  if (stored.riskTolerance) riskTolerance.value = stored.riskTolerance;
});

saveBtn.addEventListener("click", () => {
  chrome.storage.sync.set(
    {
      apiBase: apiBase.value.trim(),
      riskTolerance: riskTolerance.value,
    },
    () => {
      saveBtn.textContent = "Saved";
      setTimeout(() => {
        saveBtn.textContent = "Save";
      }, 1400);
    }
  );
});
