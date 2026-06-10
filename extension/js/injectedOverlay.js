/**
 * injectedOverlay.js — Quick Purchase Review floating panel (360px).
 */
const InjectedOverlay = (() => {
  let root = null;
  let session = {
    purchaseId: null,
    pendingAuthId: null,
    data: null,
    tab: "overview",
    tasks: null,
    financial: null,
    onDone: null,
    originButton: null,
    originForm: null,
  };

  const fmt = (n) => `$${Number(n || 0).toFixed(2)}`;
  const ICON = `<svg class="acf-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;

  function injectAgentCFOOverlay(review, ctx = {}) {
    remove();
    session = {
      purchaseId: review.purchase_id,
      pendingAuthId: review.pending_auth_id,
      data: review,
      tab: "overview",
      tasks: null,
      financial: review.financial_health || null,
      onDone: ctx.onDone,
      originButton: ctx.originButton,
      originForm: ctx.originForm,
    };
    root = document.createElement("div");
    root.id = "agentcfo-overlay";
    const isHighRisk = review.status === "high_risk";
    root.className = `acf-overlay ${isHighRisk ? "acf-overlay--risk" : ""} acf--${review.status}`;
    document.documentElement.appendChild(root);
    render();
    if (session.tab === "todo") loadTasks();
    if (session.tab === "financial" && !session.financial) loadFinancial();
  }

  async function loadTasks() {
    session.tasks = await ApiClient.getActions();
    render();
  }

  async function loadFinancial() {
    session.financial = await ApiClient.getFinancialHealth();
    render();
  }

  function render() {
    if (!root || !session.data) return;
    const d = session.data;
    const badge = updateStatusBadge(d.status);

    root.innerHTML = `
      <div class="acf-panel" role="dialog" aria-label="Quick Purchase Review">
        <header class="acf-head">
          <div class="acf-brand">${ICON}<span>AgentCFO</span></div>
          <span class="acf-badge acf-badge--${d.status}">${badge}</span>
          <button type="button" class="acf-icon-btn" id="acf-dash" title="Open Dashboard">↗</button>
          <button type="button" class="acf-icon-btn" id="acf-minimize" title="Minimize">−</button>
        </header>
        <nav class="acf-tabs" role="tablist">
          ${tabBtn("overview", "Overview")}
          ${tabBtn("alternatives", "Alternatives")}
          ${tabBtn("financial", "Financial Health")}
          ${tabBtn("todo", "To-Do")}
        </nav>
        <div class="acf-body">${renderTab()}</div>
        <footer class="acf-foot"><p>We'll log this for your records.</p></footer>
      </div>`;

    root.querySelectorAll(".acf-tab").forEach((btn) => {
      btn.addEventListener("click", async () => {
        session.tab = btn.dataset.tab;
        if (session.tab === "todo" && !session.tasks) await loadTasks();
        if (session.tab === "financial" && !session.financial) await loadFinancial();
        render();
      });
    });
    root.querySelector("#acf-minimize")?.addEventListener("click", () => root.classList.toggle("acf--minimized"));
    root.querySelector("#acf-dash")?.addEventListener("click", openDashboard);
    bindOverviewActions();
  }

  function tabBtn(id, label) {
    return `<button type="button" role="tab" class="acf-tab ${session.tab === id ? "active" : ""}" data-tab="${id}">${label}</button>`;
  }

  function renderTab() {
    const d = session.data;
    const p = d.purchase || {};
    const alt = d.best_alternative;
    const fin = session.financial || d.financial_health || {};
    const saveMo = d.savings?.estimated_monthly_savings || 0;
    const saveYr = d.savings?.estimated_annual_savings || saveMo * 12;

    if (session.tab === "overview") return renderOverviewTab(d, p, alt, fin, saveMo, saveYr);
    if (session.tab === "alternatives") return renderAlternativesTab(d, alt, saveMo);
    if (session.tab === "financial") return renderFinancialHealthTab(fin);
    return renderTodoTab();
  }

  function renderOverviewTab(d, p, alt, fin, saveMo, saveYr) {
    const fits = fin.fits_budget !== false && (fin.budget_used || 62) <= 100;
    const isYearly = p.billing_cycle === "yearly";
    const compare = isYearly && saveYr > 0
      ? `<div class="acf-save">${fmt(p.price)} → ${fmt(Math.max(0, p.price - saveYr))} / year</div>`
      : saveMo > 0
        ? `<div class="acf-save">You could save <strong>${fmt(saveMo)}/mo</strong></div>`
        : "";

    const needsJustification = d.status === "high_risk";

    return `
      <h2 class="acf-title">Quick Purchase Review</h2>
      <p class="acf-sub">You're about to buy</p>
      <div class="acf-card acf-card--product">
        <div class="acf-vendor-icon">${(p.merchant || p.product_name || "?")[0]}</div>
        <div>
          <strong>${esc(p.product_name)}</strong>
          <span class="acf-muted">${esc(p.billing_cycle || "monthly")} plan</span>
          <span class="acf-price">${fmt(p.price)} / ${isYearly ? "year" : "month"}</span>
        </div>
      </div>
      ${compare}
      ${alt ? `
        <div class="acf-card acf-card--alt">
          <span class="acf-pill acf-pill--green">Better alternative</span>
          <strong>${esc(alt.name)}</strong>
          <span>${fmt(alt.price)}/mo</span>
          <span class="acf-pill">Recommended</span>
        </div>` : ""}
      <div class="acf-card ${fits ? "acf-card--ok" : "acf-card--warn"}">
        ${fits ? "✓ Fits your budget" : "⚠ May exceed budget"}
      </div>
      <div class="acf-card acf-card--info">
        ${esc((d.audit_summary || ["We found a cheaper option with similar features."])[2] || "We compared pricing and budget impact.")}
      </div>
      ${needsJustification || d.status !== "protection_on" ? `
        <label class="acf-label">Why do you need this option?</label>
        <textarea id="acf-justification" class="acf-input" maxlength="250" placeholder="Add a brief reason..."></textarea>
        <span class="acf-count"><span id="acf-char">0</span> / 250</span>` : ""}
      <div class="acf-actions">
        <button type="button" id="acf-cancel" class="acf-btn acf-btn--ghost">Cancel Purchase</button>
        <button type="button" id="acf-continue" class="acf-btn acf-btn--primary">
          ${needsJustification ? "Continue with Justification" : "Continue Anyway"}
        </button>
      </div>`;
  }

  function renderAlternativesTab(d, alt, saveMo) {
    const alts = [d.best_alternative, ...(d.alternatives || [])].filter(Boolean);
    return `
      <h2 class="acf-title">Better alternatives</h2>
      <p class="acf-sub">Similar tools that may cost less</p>
      ${alts.slice(0, 3).map((a, i) => `
        <div class="acf-card acf-card--alt">
          <div class="acf-alt-head">
            <strong>${esc(a.name)}</strong>
            <span class="acf-pill ${i === 0 ? "acf-pill--green" : ""}">${i === 0 ? "Recommended" : "Best Value"}</span>
          </div>
          <span class="acf-price">${fmt(a.price)}/mo · Save ${fmt(a.estimated_monthly_savings || saveMo)}</span>
          <p class="acf-muted">${esc(a.reason || "")}</p>
          <div class="acf-chips">${(a.features || ["Similar features", "Team seats"]).map((f) => `<span class="acf-chip">✓ ${esc(f)}</span>`).join("")}</div>
          <button type="button" class="acf-btn acf-btn--ghost acf-btn--sm acf-choose-alt" data-name="${esc(a.name)}">View option</button>
        </div>`).join("")}`;
  }

  function renderFinancialHealthTab(fin) {
    const fallback = fin._fallback ? `<p class="acf-warn">Live budget data is unavailable. Showing saved estimate.</p>` : "";
    return `
      <h2 class="acf-title">Financial Health</h2>
      <p class="acf-sub">Simple snapshot of your business.</p>
      ${fallback}
      <div class="acf-card acf-card--ok">
        <strong>Cash flow looks good</strong>
        <span class="acf-muted">You're in a healthy position (${esc(fin.cash_flow_status || "Good")}).</span>
      </div>
      <div class="acf-metrics">
        <div class="acf-metric"><span>Cash on Hand</span><strong>${fmt(fin.cash_on_hand)}</strong></div>
        <div class="acf-metric"><span>Monthly Burn</span><strong>${fmt(fin.monthly_burn)}</strong></div>
        <div class="acf-metric"><span>Runway</span><strong>${fin.runway_months || "—"} mo</strong></div>
      </div>
      <div class="acf-progress-wrap">
        <div class="acf-progress"><div style="width:${Math.min(fin.budget_used || 62, 100)}%"></div></div>
        <span>$${(fin.budget_spent || 1250).toLocaleString()} of $${(fin.budget_limit || 2000).toLocaleString()} · ${fin.budget_used || 62}% used</span>
      </div>
      <p class="acf-tip">Tip: Keep runway above 3 months for peace of mind.</p>`;
  }

  function renderTodoTab() {
    const tasks = session.tasks || [];
    return `
      <h2 class="acf-title">To-Do List</h2>
      <p class="acf-sub">Stay on top of important tasks.</p>
      ${tasks.length ? tasks.slice(0, 5).map((t) => `
        <div class="acf-card acf-card--task">
          <div>
            <strong>${esc(t.title)}</strong>
            <p class="acf-muted">${esc(t.description)}</p>
          </div>
          <span class="acf-pill">${esc(t.badge || "Action needed")}</span>
          <span class="acf-chevron">›</span>
        </div>`).join("") : `
        <div class="acf-card">Review pending approval</div>
        <div class="acf-card">Check upcoming renewals</div>
        <div class="acf-card">Audit unused subscriptions</div>`}
      <p class="acf-tip">We're here to help you save and stay in control.</p>`;
  }

  function bindOverviewActions() {
    const ta = root.querySelector("#acf-justification");
    const counter = root.querySelector("#acf-char");
    ta?.addEventListener("input", () => {
      if (counter) counter.textContent = ta.value.length;
    });
    root.querySelector("#acf-cancel")?.addEventListener("click", () => handleResolve("cancel"));
    root.querySelector("#acf-continue")?.addEventListener("click", () => {
      const j = root.querySelector("#acf-justification")?.value?.trim() || "";
      const needsJ = session.data?.status === "high_risk";
      if (needsJ && !j) {
        alert("Please add a brief reason before continuing.");
        return;
      }
      handleResolve(needsJ || j ? "continue_with_justification" : "continue", j);
    });
    root.querySelectorAll(".acf-choose-alt").forEach((btn) => {
      btn.addEventListener("click", () => openDashboard(`/purchases/${session.purchaseId}`));
    });
  }

  async function handleResolve(action, justification = "") {
    try {
      await ApiClient.resolvePurchase(action, session.purchaseId, justification, session.pendingAuthId);
      const status =
        action === "cancel"
          ? "canceled"
          : action === "continue"
            ? "approved"
            : "continued_with_justification";
      await AgentStorage.saveReview({ ...session.data, status });
      remove();
      if (action === "cancel") {
        SpokeExtension.unfreezeCheckout();
        session.onDone?.("cancel");
      } else {
        SpokeExtension.triggerOriginalCheckout(session.originButton, session.originForm);
        session.onDone?.("continue");
      }
    } catch (e) {
      alert(e.message);
    }
  }

  async function openDashboard() {
    const base = ApiClient.dashboardPathForStatus(session.data?.status);
    const pid = session.purchaseId ? `/${session.purchaseId}` : "";
    const url = await ApiClient.getDashboardUrl(`${base}${pid}`);
    window.open(url, "_blank");
  }

  function showLoading() {
    remove();
    root = document.createElement("div");
    root.id = "agentcfo-overlay";
    root.className = "acf-overlay";
    root.innerHTML = `
      <div class="acf-panel acf-panel--loading">
        <div class="acf-brand">${ICON}<span>AgentCFO</span></div>
        <span class="acf-badge">Checking...</span>
        <div class="acf-spinner"></div>
        <h2>Checking this purchase...</h2>
        <p class="acf-muted">This will only take a few seconds.</p>
        <ul class="acf-timeline">
          <li class="acf-step done"><span class="acf-step-icon">✓</span> Reading cart details</li>
          <li class="acf-step current"><span class="acf-step-icon acf-dot"></span> Checking market prices</li>
          <li class="acf-step pending"><span class="acf-step-icon">○</span> Reviewing budget impact</li>
          <li class="acf-step pending"><span class="acf-step-icon">○</span> Analyzing alternatives</li>
        </ul>
        <p class="acf-foot-note">You'll be notified with our recommendation.</p>
      </div>`;
    document.documentElement.appendChild(root);
    animateLoadingSteps();
  }

  function animateLoadingSteps() {
    const steps = root?.querySelectorAll(".acf-step");
    if (!steps) return;
    let i = 1;
    const iv = setInterval(() => {
      if (i >= steps.length || !root) return clearInterval(iv);
      steps[i - 1]?.classList.replace("current", "done");
      steps[i - 1]?.querySelector(".acf-step-icon")?.replaceChildren(document.createTextNode("✓"));
      steps[i]?.classList.replace("pending", "current");
      steps[i]?.querySelector(".acf-step-icon")?.classList.add("acf-dot");
      i++;
    }, 700);
  }

  function showTimeoutFallback(onContinue, onRetry) {
    if (!root) return;
    root.innerHTML = `
      <div class="acf-panel">
        <h2>Review is taking longer than expected.</h2>
        <p class="acf-muted">You can continue, but AgentCFO will log this purchase for follow-up.</p>
        <div class="acf-actions">
          <button type="button" id="acf-retry" class="acf-btn acf-btn--ghost">Try again</button>
          <button type="button" id="acf-continue-now" class="acf-btn acf-btn--primary">Continue for now</button>
        </div>
      </div>`;
    root.querySelector("#acf-retry")?.addEventListener("click", onRetry);
    root.querySelector("#acf-continue-now")?.addEventListener("click", onContinue);
  }

  function showError(msg, onDismiss) {
    if (!root) return;
    root.innerHTML = `
      <div class="acf-panel">
        <h2>AgentCFO could not complete the review.</h2>
        <p class="acf-muted">${esc(msg)}</p>
        <div class="acf-actions">
          <button type="button" id="acf-dismiss" class="acf-btn acf-btn--primary">Continue</button>
        </div>
      </div>`;
    root.querySelector("#acf-dismiss")?.addEventListener("click", onDismiss);
  }

  function remove() {
    document.getElementById("agentcfo-overlay")?.remove();
    root = null;
  }

  function updateStatusBadge(status) {
    return {
      savings_found: "Savings found",
      review_needed: "Review needed",
      high_risk: "Action needed",
      protection_on: "Protection is ON",
    }[status] || "Review needed";
  }

  function esc(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  }

  return {
    injectAgentCFOOverlay,
    showLoading,
    showTimeoutFallback,
    showError,
    remove,
    updateStatusBadge,
    renderOverviewTab,
    renderAlternativesTab,
    renderFinancialHealthTab,
    renderTodoTab,
  };
})();

// Aliases per architecture spec
const CheckoutOverlay = InjectedOverlay;
