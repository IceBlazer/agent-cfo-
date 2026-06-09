const input = document.getElementById("apiBase");
const saveBtn = document.getElementById("save");

chrome.storage.sync.get(["apiBase"], (stored) => {
  if (stored.apiBase) input.value = stored.apiBase;
});

saveBtn.addEventListener("click", () => {
  chrome.storage.sync.set({ apiBase: input.value.trim() }, () => {
    saveBtn.textContent = "Saved!";
    setTimeout(() => {
      saveBtn.textContent = "Save";
    }, 1200);
  });
});
