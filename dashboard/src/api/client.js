const API_BASE = import.meta.env.VITE_API_BASE || "";

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const api = {
  summary: () => request("/api/v1/dashboard/summary"),
  recentPurchases: () => request("/api/v1/purchases/recent"),
  purchase: (id) => request(`/api/v1/purchases/${id}`),
  financialHealth: () => request("/api/v1/financial-health"),
  actions: () => request("/api/v1/actions"),
  auditLog: () => request("/api/v1/audit-log"),
  resolve: (purchaseId, action, justification = "") =>
    request("/api/v1/resolve", {
      method: "POST",
      body: JSON.stringify({ purchase_id: purchaseId, action, justification }),
    }),
};
