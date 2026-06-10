/**
 * apiClient.js — all backend communication (no API keys in extension).
 */
const ApiClient = (() => {
  const DEFAULT_BASE = "http://127.0.0.1:8787";
  const TIMEOUT_MS = 4500;

  const DEMO_FINANCIAL = {
    cash_flow_status: "Good",
    cash_on_hand: 28450,
    monthly_burn: 3470,
    runway_months: 8.2,
    budget_used: 62,
    budget_limit: 2000,
    budget_spent: 1250,
    fits_budget: true,
  };

  const DEMO_ACTIONS = [
    { task_id: "task_review", title: "Review pending approval", description: "A purchase needs your decision", badge: "Review needed" },
    { task_id: "task_renewals", title: "Check upcoming renewals", description: "3 renewals in the next 14 days", badge: "Action needed" },
    { task_id: "task_audit", title: "Audit unused subscriptions", description: "Find tools nobody uses", badge: "Save money" },
  ];

  async function getBase() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(["apiBase"], (s) => resolve(s.apiBase || DEFAULT_BASE));
    });
  }

  async function request(path, options = {}) {
    const base = (await getBase()).replace(/\/$/, "");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${base}${path}`, {
        ...options,
        signal: controller.signal,
        headers: { "Content-Type": "application/json", ...options.headers },
      });
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  function viaBackground(type, payload) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type, payload }, (r) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        if (r?.error) return reject(new Error(r.error));
        resolve(r);
      });
    });
  }

  async function sendInterceptPayload(payload) {
    return viaBackground("APE_INTERCEPT", payload);
  }

  async function resolvePurchase(action, purchaseId, justification = "", pendingAuthId = null) {
    return viaBackground("APE_RESOLVE", {
      action,
      purchase_id: purchaseId,
      justification,
      pending_auth_id: pendingAuthId,
    });
  }

  async function getFinancialHealth() {
    try {
      return await request("/api/v1/financial-health");
    } catch {
      return { ...DEMO_FINANCIAL, _fallback: true };
    }
  }

  async function getActions() {
    try {
      return await request("/api/v1/actions");
    } catch {
      return DEMO_ACTIONS;
    }
  }

  async function getSummary() {
    try {
      return await request("/api/v1/dashboard/summary");
    } catch {
      return {
        saved_this_month: 1247,
        purchases_reviewed: 8,
        upcoming_renewals: 3,
        potential_savings: 1247,
        _fallback: true,
      };
    }
  }

  function dashboardPathForStatus(status) {
    const map = {
      savings_found: "/purchases",
      review_needed: "/purchases",
      high_risk: "/financial",
      canceled: "/purchases",
      continued_with_justification: "/purchases",
    };
    return map[status] || "/";
  }

  return {
    TIMEOUT_MS,
    getBase,
    health: () => request("/health"),
    intercept: sendInterceptPayload,
    sendInterceptPayload,
    resolve: resolvePurchase,
    resolvePurchase,
    summary: getSummary,
    getSummary,
    financialHealth: getFinancialHealth,
    getFinancialHealth,
    actions: getActions,
    getActions,
    getDashboardUrl: async (path = "") => {
      const base = (await getBase()).replace(/\/$/, "");
      return `${base}/app${path}`;
    },
    dashboardPathForStatus,
  };
})();
