/**
 * Compact checkout overlay — friendly small-business copy.
 */
const CheckoutOverlay = (() => {
  let root = null;
  let session = { purchaseId: null, pendingAuthId: null, data: null, tab: "overview", onDone: null, originButton: null, originForm: null };

  const fmt = (n) => `$${Number(n).toFixed(2)}`;

  function injectAgentCFOOverlay(review, ctx = {}) {
    remove();
    session = {
      purchaseId: review.purchase_id,
      pendingAuthId: review.pending_auth_id,
      data: review,
      tab: "overview",
      onDone: ctx.onDone,
      originButton: ctx.originButton,
      originForm: ctx.originForm,
    };
    root = document.createElement("div");
    root.id = "agentcfo-overlay";
    root.className = `acf-overlay acf--${review.status}`;
    document.documentElement.appendChild(root);
    render();
  }

  function render() {
    if (!root || !session.data) return;
    const d = session.data;
    const p = d.purchase || {};
    const alt = d.best_alternative;
    const fin = d.financial_health || {};
    const save = d.savings?.estimated_monthly_savings || 0;
    const badge = statusLabel(d.status);

    root.innerHTML = `
      <div class="acf-panel" role="dialog">
        <header class="acf-head">
          <div class="acf-logo">🛡️ AgentCFO</div>
          <span class="acf-badge acf-badge--${d.status}">${badge}</span>
          <button type="button" class="acf-close" id="acf-minimize" title="Minimize">−</button>
        </header>
        <nav class="acf-tabs">
          ${["overview", "alternatives", "financial", "todo"].map((t) => `
            <button type="button" class="acf-tab ${session.tab === t ? "active" : ""}" data-tab="${t}">
              ${{ overview: "Overview", alternatives: "Alternatives", financial: "Health", todo: "To-Do" }[t]}
            </button>`).join("")}
        </nav>
        <div class="acf-body">${renderTab()}</div>
        <footer class="acf-foot">
          <p class="acf-foot-note">We'll log this for your records.</p>
        </footer>
      </div>`;

    root.querySelectorAll(".acf-tab").forEach((btn) =>
      btn.addEventListener("click", () => {
        session.tab = btn.dataset.tab;
        render();
      })
    );
    root.querySelector("#acf-minimize")?.addEventListener("click", () => {
      root.classList.toggle("acf--minimized");
    });
    bindActions();
  }

  function renderTab() {
    const d = session.data;
    const p = d.purchase || {};
    const alt = d.best_alternative;
    const fin = d.financial_health || {};
    const save = d.savings?.estimated_monthly_savings || 0;

    if (session.tab === "overview") {
      const fits = fin.fits_budget !== false && (fin.budget_used || 0) <= 100;
      return `
        <h2 class="acf-title">Quick Purchase Review</h2>
        <p class="acf-sub">You're about to buy</p>
        <div class="acf-card">
          <strong>${escape(p.product_name)}</strong>
          <span>${fmt(p.price)} / ${p.billing_cycle === "yearly" ? "year" : "month"}</span>
        </div>
        ${save > 0 ? `<div class="acf-save">You could save <strong>${fmt(save)}/mo</strong></div>` : ""}
        ${alt ? `<div class="acf-card acf-card--alt"><span class="acf-tag">Better alternative</span><strong>${escape(alt.name)}</strong><span>${fmt(alt.price)}/mo</span><p>${escape(alt.reason)}</p></div>` : ""}
        <div class="acf-card ${fits ? "acf-card--ok" : "acf-card--warn"}">
          ${fits ? "✓ Fits your budget" : "⚠ May exceed budget"}
        </div>
        ${(d.audit_summary || []).slice(-1).map((s) => `<p class="acf-finding">${escape(s)}</p>`).join("")}
        <label class="acf-label">Why do you need this option?</label>
        <textarea id="acf-justification" class="acf-input" maxlength="250" placeholder="Add a brief reason..."></textarea>
        <span class="acf-count"><span id="acf-char">0</span> / 250</span>
        <div class="acf-actions">
          <button type="button" id="acf-cancel" class="acf-btn acf-btn--ghost">Cancel Purchase</button>
          <button type="button" id="acf-continue" class="acf-btn acf-btn--primary">Continue with Justification</button>
        </div>`;
    }
    if (session.tab === "alternatives") {
      const alts = [d.best_alternative, ...(d.alternatives || [])].filter(Boolean);
      return `<h2 class="acf-title">Better alternatives</h2>${alts.slice(0, 3).map((a) => `
        <div class="acf-card acf-card--alt">
          <strong>${escape(a.name)}</strong>
          <span>${fmt(a.price)}/mo · Save ${fmt(a.estimated_monthly_savings || save)}</span>
          <p>${escape(a.reason || "")}</p>
          ${(a.features || []).map((f) => `<span class="acf-chip">✓ ${escape(f)}</span>`).join("")}
        </div>`).join("")}`;
    }
    if (session.tab === "financial") {
      return `
        <h2 class="acf-title">Financial Health</h2>
        <p class="acf-sub">Simple snapshot of your business.</p>
        <div class="acf-card acf-card--ok">Cash flow looks good — ${escape(fin.cash_flow_status || "Good")}</div>
        <div class="acf-metrics">
          <div><span>Cash on Hand</span><strong>${fmt(fin.cash_on_hand || 0)}</strong></div>
          <div><span>Monthly Burn</span><strong>${fmt(fin.monthly_burn || 0)}</strong></div>
          <div><span>Runway</span><strong>${fin.runway_months || "—"} mo</strong></div>
        </div>
        <div class="acf-progress-wrap">
          <div class="acf-progress"><div style="width:${fin.budget_used || 62}%"></div></div>
          <span>$${(fin.budget_spent || 1250).toLocaleString()} of $${(fin.budget_limit || 2000).toLocaleString()} · ${fin.budget_used || 62}% used</span>
        </div>
        <p class="acf-tip">Tip: Keep runway above 3 months for peace of mind.</p>`;
    }
    return `
      <h2 class="acf-title">To-Do List</h2>
      <div class="acf-card">Review pending approval</div>
      <div class="acf-card">Check upcoming renewals</div>
      <div class="acf-card">Audit unused subscriptions</div>
      <p class="acf-tip">We're here to help you save and stay in control.</p>`;
  }

  function bindActions() {
    const ta = root.querySelector("#acf-justification");
    const counter = root.querySelector("#acf-char");
    ta?.addEventListener("input", () => {
      if (counter) counter.textContent = ta.value.length;
    });
    root.querySelector("#acf-cancel")?.addEventListener("click", () => handleResolve("cancel"));
    root.querySelector("#acf-continue")?.addEventListener("click", () => {
      const j = root.querySelector("#acf-justification")?.value?.trim() || "";
      if (!j) {
        alert("Please add a brief reason before continuing.");
        return;
      }
      handleResolve("continue_with_justification", j);
    });
  }

  async function handleResolve(action, justification = "") {
    try {
      await ApiClient.resolve({
        purchase_id: session.purchaseId,
        pending_auth_id: session.pendingAuthId,
        action,
        justification,
      });
      await AgentStorage.saveReview({ ...session.data, status: action === "cancel" ? "canceled" : "continued_with_justification" });
      if (action === "cancel") {
        remove();
        SpokeExtension.unfreezeCheckout();
        session.onDone?.("cancel");
      } else {
        remove();
        SpokeExtension.triggerOriginalCheckout(session.originButton, session.originForm);
        session.onDone?.("continue");
      }
    } catch (e) {
      alert(e.message);
    }
  }

  function showLoading() {
    remove();
    root = document.createElement("div");
    root.id = "agentcfo-overlay";
    root.className = "acf-overlay";
    root.innerHTML = `
      <div class="acf-panel acf-panel--loading">
        <div class="acf-spinner"></div>
        <h2>Checking this purchase...</h2>
        <p>This will only take a few seconds.</p>
        <ul class="acf-steps">
          <li class="done">Reading cart details</li>
          <li class="current">Checking market prices</li>
          <li>Reviewing budget impact</li>
          <li>Analyzing alternatives</li>
        </ul>
      </div>`;
    document.documentElement.appendChild(root);
  }

  function showTimeoutFallback(onContinue, onRetry) {
    if (!root) return;
    root.innerHTML = `
      <div class="acf-panel">
        <h2>Review is taking longer than expected.</h2>
        <p>Market prices or budget data may be temporarily unavailable.</p>
        <div class="acf-actions">
          <button type="button" id="acf-retry" class="acf-btn acf-btn--ghost">Try again</button>
          <button type="button" id="acf-continue-now" class="acf-btn acf-btn--primary">Continue for now</button>
        </div>
      </div>`;
    root.querySelector("#acf-retry")?.addEventListener("click", onRetry);
    root.querySelector("#acf-continue-now")?.addEventListener("click", onContinue);
  }

  function remove() {
    document.getElementById("agentcfo-overlay")?.remove();
    root = null;
  }

  function statusLabel(s) {
    return {
      savings_found: "Savings found",
      review_needed: "Review needed",
      high_risk: "Action needed",
      protection_on: "Protection is ON",
    }[s] || "Review needed";
  }

  function escape(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
  }

  return { injectAgentCFOOverlay, showLoading, showTimeoutFallback, remove };
})();
