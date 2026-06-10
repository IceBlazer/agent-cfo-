/** popup.js — extension toolbar UI (all states + settings). */
const SHIELD = `<svg class="popup-shield" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;

let view = "main"; // main | settings

const app = document.getElementById("app");

async function openDashboard(path = "/") {
  chrome.tabs.create({ url: await ApiClient.getDashboardUrl(path) });
}

function esc(s) {
  return String(s || "").replace(/</g, "&lt;");
}

function header(badge, badgeClass = "") {
  return `
    <header class="popup-header">
      ${SHIELD}
      <div class="popup-header-main">
        <span class="popup-badge ${badgeClass}">${badge}</span>
        <h1>AgentCFO</h1>
      </div>
      <button type="button" class="popup-menu-btn" id="menu-btn" title="Settings">⋮</button>
    </header>`;
}

function renderDefaultState(m) {
  return `
    ${header("Protection is ON")}
    <div class="popup-body">
      <p class="popup-onboarding">AgentCFO works in two ways: the extension helps you before you buy, and the dashboard shows your savings, budget health, and next steps.</p>
      <div class="popup-card popup-card--hero">
        <span class="popup-hero-icon">✨</span>
        <div>
          <strong>All good!</strong>
          <p style="margin:6px 0 0;font-size:0.85rem;color:#6b7280">AgentCFO is watching for purchases to help you save money.</p>
        </div>
      </div>
      <div class="popup-metrics">
        <div class="popup-metric">Saved this month<strong>$${(m.savedThisMonth || 1247).toLocaleString()}</strong></div>
        <div class="popup-metric">Purchases reviewed<strong>${m.purchasesReviewed || 8}</strong></div>
        <div class="popup-metric">Upcoming renewals<strong>${m.upcomingRenewals || 3}</strong></div>
      </div>
      <div class="popup-card popup-card--tip">Tip: We'll notify you when we find a way to save you money.</div>
      <button type="button" id="open-dash" class="popup-btn popup-btn--primary">Open Dashboard</button>
      <div class="popup-row">
        <button type="button" id="open-demo" class="popup-btn popup-btn--ghost">Try Demo</button>
        <button type="button" id="open-settings" class="popup-btn popup-btn--ghost">Settings</button>
      </div>
    </div>
    <footer class="popup-footer">Last updated just now</footer>`;
}

function renderProcessingState() {
  return `
    ${header("Checking...", "popup-badge--gray")}
    <div class="popup-body" style="text-align:center">
      <div class="acf-spinner" style="margin:16px auto"></div>
      <strong>Checking this purchase...</strong>
      <p style="font-size:0.85rem;color:#6b7280;margin-top:6px">This will only take a few seconds.</p>
      <ul class="acf-timeline" style="margin-top:16px">
        <li class="acf-step done"><span class="acf-step-icon">✓</span> Reading cart details</li>
        <li class="acf-step current"><span class="acf-step-icon acf-dot"></span> Checking market prices</li>
        <li class="acf-step pending"><span class="acf-step-icon">○</span> Reviewing budget impact</li>
        <li class="acf-step pending"><span class="acf-step-icon">○</span> Analyzing alternatives</li>
      </ul>
      <p style="font-size:0.78rem;color:#6b7280;margin-top:12px">You'll be notified with our recommendation.</p>
    </div>`;
}

function renderReviewNeededState(r) {
  const p = r.purchase || {};
  return `
    ${header("Review Needed", "popup-badge--yellow")}
    <div class="popup-body">
      <div class="popup-card popup-card--yellow">
        <strong>🛒 Purchase detected</strong>
        <p style="margin:6px 0 0;font-size:0.85rem">We found this on your cart and think it's worth reviewing.</p>
      </div>
      <div class="popup-card popup-purchase-row">
        <div class="popup-vendor">${(p.merchant || p.product_name || "N")[0]}</div>
        <div style="flex:1">
          <strong>${esc(p.product_name || "Purchase")}</strong>
          <span style="display:block;font-size:0.85rem;color:#6b7280">$${p.price || "—"} / ${p.billing_cycle === "yearly" ? "year" : "month"}</span>
        </div>
        <span class="popup-chevron">›</span>
      </div>
      <p style="font-size:0.82rem;color:#6b7280">Our quick check found potential savings and budget impact.</p>
      <button type="button" id="review-now" class="popup-btn popup-btn--primary">Review Now</button>
      <button type="button" id="maybe-later" class="popup-btn popup-btn--ghost">Maybe Later</button>
      <p style="font-size:0.72rem;color:#9ca3af;margin-top:8px">You can change this anytime in settings.</p>
    </div>`;
}

function renderSavingsFoundState(r) {
  const p = r.purchase || {};
  const alt = r.best_alternative || {};
  const save = r.savings?.estimated_monthly_savings || 19;
  return `
    ${header("Savings Found", "popup-badge")}
    <div class="popup-body">
      <div class="popup-card popup-card--green">
        <strong>✓ Better option found!</strong>
        <p style="margin:6px 0 0">You could save $${save.toFixed(2)} every month.</p>
      </div>
      <div class="popup-card">
        <span class="popup-tag popup-tag--warn">Overpriced</span>
        <strong>${esc(p.product_name)}</strong>
        <span style="display:block">$${p.price} / month</span>
      </div>
      <div class="popup-card popup-card--green popup-purchase-row">
        <div style="flex:1">
          <span class="popup-tag popup-tag--save">Save $${save.toFixed(2)}</span>
          <strong>${esc(alt.name || "ClickUp Business")}</strong>
          <span style="display:block">$${alt.price || 77} / month</span>
        </div>
        <span class="popup-chevron">›</span>
      </div>
      <button type="button" id="view-alts" class="popup-btn popup-btn--primary">View Alternatives</button>
      <button type="button" id="continue-anyway" class="popup-btn popup-btn--ghost">Continue Anyway</button>
      <button type="button" id="how-found" class="popup-link">How did we find this?</button>
      <div id="how-panel" hidden style="font-size:0.78rem;color:#6b7280;margin-top:8px;line-height:1.5">
        <p>We compared this item against market prices using Exa.</p>
        <p>We checked your business budget.</p>
        <p>We checked if you already have similar tools.</p>
        <p>We found a lower-cost option with similar features.</p>
      </div>
    </div>`;
}

function renderHighRiskState(r) {
  const p = r.purchase || {};
  return `
    ${header("High Risk", "popup-badge--red")}
    <div class="popup-body">
      <div class="popup-card popup-card--red">
        <strong>⚠ This could impact your budget</strong>
        <p style="margin:6px 0 0;font-size:0.85rem">This purchase may put you over your Software Budget for this month.</p>
      </div>
      <div class="popup-card popup-purchase-row">
        <div class="popup-vendor">${(p.product_name || "?")[0]}</div>
        <div style="flex:1"><strong>${esc(p.product_name)}</strong><span style="display:block">$${p.price} / mo</span></div>
        <span class="popup-chevron">›</span>
      </div>
      <button type="button" id="review-details" class="popup-btn popup-btn--primary">Review Details</button>
      <button type="button" id="continue-risk" class="popup-btn popup-btn--ghost">Continue Anyway</button>
      <p style="font-size:0.72rem;color:#9ca3af;margin-top:8px">We'll log this for your records.</p>
    </div>`;
}

function renderSettingsState() {
  return `
    <header class="popup-header">
      ${SHIELD}
      <div class="popup-header-main"><h1>Settings</h1></div>
      <button type="button" class="popup-menu-btn" id="close-settings">✕</button>
    </header>
    <div class="popup-body">
      <label class="popup-setting"><span>Enable Protection<small>Detect and review purchases</small></span><input type="checkbox" id="s-protect" checked /></label>
      <label class="popup-setting"><span>Auto-block high risk<small>Block purchases that exceed budget</small></span><input type="checkbox" id="s-autoblock" /></label>
      <label class="popup-setting"><span>Show savings opportunities<small>Notify when better options are found</small></span><input type="checkbox" id="s-savings" checked /></label>
      <label class="popup-setting">Python hub URL<input type="text" id="s-api" style="width:100%;margin-top:6px;padding:8px;border-radius:10px;border:1px solid #e5e7eb" /></label>
      <button type="button" id="open-dash-settings" class="popup-btn popup-btn--primary">Open Dashboard</button>
      <button type="button" id="save-settings" class="popup-btn popup-btn--ghost">Save</button>
    </div>`;
}

async function render() {
  if (view === "settings") {
    app.innerHTML = renderSettingsState();
    chrome.storage.sync.get(["apiBase", "settings"], (s) => {
      document.getElementById("s-api").value = s.apiBase || "http://127.0.0.1:8787";
      const st = s.settings || {};
      document.getElementById("s-protect").checked = st.protect !== false;
      document.getElementById("s-autoblock").checked = !!st.autoblock;
      document.getElementById("s-savings").checked = st.savings !== false;
    });
    document.getElementById("close-settings").onclick = () => { view = "main"; render(); };
    document.getElementById("save-settings").onclick = saveSettings;
    document.getElementById("open-dash-settings").onclick = () => openDashboard("/");
    return;
  }

  const { state, review, metrics } = await AgentStorage.getPopupState();
  const summary = await ApiClient.getSummary();
  const m = {
    savedThisMonth: summary.saved_this_month,
    purchasesReviewed: summary.purchases_reviewed,
    upcomingRenewals: summary.upcoming_renewals,
  };
  await AgentStorage.cacheMetrics(m);

  if (state === "processing") {
    app.innerHTML = renderProcessingState();
    return;
  }
  if (state === "savings" && review) {
    app.innerHTML = renderSavingsFoundState(review);
    bindSavings(review);
    return;
  }
  if (state === "risk" && review) {
    app.innerHTML = renderHighRiskState(review);
    bindRisk(review);
    return;
  }
  if (state === "review" && review) {
    app.innerHTML = renderReviewNeededState(review);
    bindReview(review);
    return;
  }

  app.innerHTML = renderDefaultState(m);
  bindDefault();
}

function bindDefault() {
  document.getElementById("open-dash")?.addEventListener("click", () => openDashboard("/"));
  document.getElementById("open-demo")?.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("demo.html") });
  });
  document.getElementById("open-settings")?.addEventListener("click", () => { view = "settings"; render(); });
  document.getElementById("menu-btn")?.addEventListener("click", () => { view = "settings"; render(); });
}

function bindReview(r) {
  document.getElementById("menu-btn")?.addEventListener("click", () => { view = "settings"; render(); });
  document.getElementById("review-now")?.addEventListener("click", () =>
    openDashboard(`/purchases/${r.purchase_id}`)
  );
  document.getElementById("maybe-later")?.addEventListener("click", async () => {
    await AgentStorage.setPopupState("default");
    render();
  });
}

function bindSavings(r) {
  document.getElementById("menu-btn")?.addEventListener("click", () => { view = "settings"; render(); });
  document.getElementById("view-alts")?.addEventListener("click", () =>
    openDashboard(`/purchases/${r.purchase_id}`)
  );
  document.getElementById("continue-anyway")?.addEventListener("click", () =>
    openDashboard(`/purchases/${r.purchase_id}`)
  );
  document.getElementById("how-found")?.addEventListener("click", () => {
    const p = document.getElementById("how-panel");
    if (p) p.hidden = !p.hidden;
  });
}

function bindRisk(r) {
  document.getElementById("menu-btn")?.addEventListener("click", () => { view = "settings"; render(); });
  document.getElementById("review-details")?.addEventListener("click", () =>
    openDashboard("/financial")
  );
  document.getElementById("continue-risk")?.addEventListener("click", () =>
    openDashboard(`/purchases/${r.purchase_id}`)
  );
}

function saveSettings() {
  const apiBase = document.getElementById("s-api").value.trim();
  chrome.storage.sync.set({
    apiBase,
    settings: {
      protect: document.getElementById("s-protect").checked,
      autoblock: document.getElementById("s-autoblock").checked,
      savings: document.getElementById("s-savings").checked,
    },
  }, () => {
    document.getElementById("save-settings").textContent = "Saved!";
    setTimeout(() => render(), 800);
  });
}

render();
