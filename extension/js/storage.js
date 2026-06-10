/** Extension state synced with dashboard purchase_ids. */
const AgentStorage = (() => {
  const KEYS = {
    LAST_REVIEW: "lastReview",
    POPUP_STATE: "popupState",
    SETTINGS: "settings",
    METRICS: "cachedMetrics",
    ICON_STATE: "iconState",
  };

  function get(keys) {
    return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
  }

  function set(data) {
    return new Promise((resolve) => chrome.storage.local.set(data, resolve));
  }

  async function saveReview(review) {
    await set({
      [KEYS.LAST_REVIEW]: { ...review, updatedAt: Date.now() },
      [KEYS.POPUP_STATE]: mapStatusToPopup(review.status),
      [KEYS.ICON_STATE]: mapStatusToIcon(review.status),
    });
    chrome.runtime.sendMessage({ type: "ICON_UPDATE", state: mapStatusToIcon(review.status) });
  }

  async function clearReview() {
    await set({
      [KEYS.LAST_REVIEW]: null,
      [KEYS.POPUP_STATE]: "default",
      [KEYS.ICON_STATE]: "active",
    });
    chrome.runtime.sendMessage({ type: "ICON_UPDATE", state: "active" });
  }

  async function getPopupState() {
    const data = await get([KEYS.POPUP_STATE, KEYS.LAST_REVIEW, KEYS.METRICS]);
    return {
      state: data[KEYS.POPUP_STATE] || "default",
      review: data[KEYS.LAST_REVIEW],
      metrics: data[KEYS.METRICS] || {
        savedThisMonth: 1247,
        purchasesReviewed: 8,
        upcomingRenewals: 3,
      },
    };
  }

  async function setPopupState(state) {
    await set({ [KEYS.POPUP_STATE]: state });
  }

  async function cacheMetrics(metrics) {
    await set({ [KEYS.METRICS]: metrics });
  }

  function mapStatusToPopup(status) {
    const m = {
      protection_on: "default",
      review_needed: "review",
      savings_found: "savings",
      high_risk: "risk",
      processing: "processing",
    };
    return m[status] || "default";
  }

  function mapStatusToIcon(status) {
    const m = {
      protection_on: "active",
      review_needed: "review",
      savings_found: "active",
      high_risk: "risk",
      error: "offline",
      processing: "review",
    };
    return m[status] || "active";
  }

  return {
    KEYS,
    get,
    set,
    saveReview,
    clearReview,
    getPopupState,
    setPopupState,
    cacheMetrics,
    mapStatusToPopup,
    mapStatusToIcon,
  };
})();
