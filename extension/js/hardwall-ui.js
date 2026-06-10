/**
 * hardwall-ui.js — Neo-Frutiger Aero Liquid Glass Hard-Wall
 */
const LiquidGlassUI = (() => {
  let overlayEl = null;
  let session = {
    pendingAuthId: null,
    isFlagged: false,
    originButton: null,
    originForm: null,
    showFailOpen: false,
    onSessionEnd: null,
  };

  const ICONS = {
    exa: `<svg class="ape-skeuo-icon" viewBox="0 0 48 48" aria-hidden="true">
      <defs><radialGradient id="globeG" cx="35%" cy="30%"><stop offset="0%" stop-color="#dff6f8"/><stop offset="100%" stop-color="#5eb8d4"/></radialGradient></defs>
      <circle cx="24" cy="24" r="18" fill="url(#globeG)" stroke="rgba(255,255,255,.85)" stroke-width="2"/>
      <ellipse cx="24" cy="24" rx="18" ry="7" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="1"/>
      <path d="M8 24c4-8 10-12 16-12s12 4 16 12" fill="none" stroke="rgba(114,196,154,.7)" stroke-width="1.5"/>
      <path d="M12 32 Q24 38 36 32" fill="none" stroke="#72c49a" stroke-width="1.2"/>
    </svg>`,
    stripe: `<svg class="ape-skeuo-icon" viewBox="0 0 48 48" aria-hidden="true">
      <defs><linearGradient id="cardG" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f0f4f8"/><stop offset="100%" stop-color="#b8c4d0"/></linearGradient></defs>
      <rect x="8" y="14" width="32" height="22" rx="4" fill="url(#cardG)" stroke="rgba(255,255,255,.9)" stroke-width="1.5"/>
      <rect x="8" y="20" width="32" height="5" fill="rgba(47,95,74,.25)"/>
      <rect x="12" y="28" width="12" height="3" rx="1" fill="rgba(255,255,255,.6)"/>
    </svg>`,
    dna: `<svg class="ape-skeuo-icon" viewBox="0 0 48 48" aria-hidden="true">
      <ellipse cx="24" cy="26" rx="20" ry="16" fill="rgba(255,255,255,.15)" stroke="rgba(255,255,255,.9)" stroke-width="2"/>
      <path d="M24 12 C18 18 16 26 24 34 C32 26 30 18 24 12Z" fill="#72c49a" stroke="#2f5f4a" stroke-width=".8"/>
      <path d="M24 14 L24 32" stroke="rgba(47,95,74,.4)" stroke-width="1"/>
    </svg>`,
    leaf: `<svg class="ape-leaf-icon" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 4 C8 12 6 22 16 28 C26 22 24 12 16 4Z" fill="#7dcea0" stroke="#2f5f4a" stroke-width=".6"/>
      <path d="M16 8 L16 24" stroke="rgba(47,95,74,.35)" stroke-width="1"/>
    </svg>`,
  };

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function ensureOverlay() {
    if (!overlayEl) {
      overlayEl = document.createElement("div");
      overlayEl.id = "ape-hardwall-overlay";
      document.documentElement.appendChild(overlayEl);
    }
    return overlayEl;
  }

  function showLoadingPulse() {
    const overlay = ensureOverlay();
    overlay.className = "ape-glass ape-glass--loading";
    overlay.innerHTML = `
      <div class="ape-eco-aurora" aria-hidden="true"></div>
      <div class="ape-glass-modal ape-glass-modal--pulse" role="status">
        <div class="ape-glint-sweep" aria-hidden="true"></div>
        <div class="ape-eco-banner">
          <span class="ape-leaf-pulse">${ICONS.leaf}</span>
          <div><h1 class="ape-banner-title">APE Intercept</h1>
          <p class="ape-banner-sub">Scanning procurement signals…</p></div>
        </div>
        <div class="ape-scan-line"><span class="ape-scan-dot"></span>Python hub · Exa · Stripe · OpenAI</div>
      </div>`;
  }

  function renderMarketCapsule(c) {
    const delta = c.efficiency_delta ?? -(c.metric_percent || 0);
    const deltaClass = delta <= -15 ? "ape-delta--bad" : "ape-delta--ok";
    return `
      <article class="ape-capsule ape-capsule--aqua" data-capsule="market">
        <div class="ape-capsule-sheen" aria-hidden="true"></div>
        <div class="ape-capsule-row">
          ${ICONS.exa}
          <div class="ape-capsule-meta">
            <span class="ape-capsule-label">${escapeHtml(c.label || "Market Intelligence")}</span>
            <h3 class="ape-capsule-title">${escapeHtml(c.headline || "Market Benchmark Baseline")}</h3>
          </div>
          <span class="ape-delta-badge ${deltaClass}">Efficiency Delta: ${delta}%</span>
        </div>
        <div class="ape-metric-compare">
          <span><em>Target</em> ${escapeHtml(c.target_display || "—")}</span>
          <span class="ape-metric-divider">|</span>
          <span><em>Market Fair Rate</em> ${escapeHtml(c.fair_rate_display || "—")}</span>
        </div>
        <p class="ape-capsule-body">${escapeHtml(c.body)}</p>
      </article>`;
  }

  function renderFinancialCapsule(c) {
    const fill = c.budget_fill_percent ?? c.metric_percent ?? 0;
    return `
      <article class="ape-capsule ape-capsule--mint" data-capsule="financial">
        <div class="ape-capsule-sheen" aria-hidden="true"></div>
        <div class="ape-capsule-row">
          ${ICONS.stripe}
          <div class="ape-capsule-meta">
            <span class="ape-capsule-label">${escapeHtml(c.label || "Financial Health")}</span>
            <h3 class="ape-capsule-title">${escapeHtml(c.headline || "Stripe Corporate Ledger")}</h3>
          </div>
        </div>
        <div class="ape-thermo">
          <div class="ape-thermo-track">
            <div class="ape-thermo-fluid" style="width:${Math.min(fill, 100)}%"></div>
            <div class="ape-thermo-glow" style="left:calc(${Math.min(fill, 100)}% - 4px)"></div>
          </div>
          <span class="ape-thermo-pct">${Math.round(fill)}%</span>
        </div>
        <p class="ape-thermo-caption">${escapeHtml(c.budget_label || "Q3 Team Software Budget")}</p>
        <p class="ape-capsule-body">${escapeHtml(c.body)}</p>
      </article>`;
  }

  function renderCompanyCapsule(c) {
    const items = c.checklist || [{ text: c.body, status: "ok" }];
    const checks = items
      .map(
        (item) => `
        <li class="ape-dew-check ape-dew-check--${item.status || "ok"}">
          <span class="ape-dew-icon" aria-hidden="true"></span>
          ${escapeHtml(item.text)}
        </li>`
      )
      .join("");
    return `
      <article class="ape-capsule ape-capsule--crystal" data-capsule="company">
        <div class="ape-capsule-sheen" aria-hidden="true"></div>
        <div class="ape-capsule-row">
          ${ICONS.dna}
          <div class="ape-capsule-meta">
            <span class="ape-capsule-label">${escapeHtml(c.label || "Strategic Alignment")}</span>
            <h3 class="ape-capsule-title">${escapeHtml(c.headline || "Corporate DNA Sync")}</h3>
          </div>
        </div>
        <ul class="ape-dew-list">${checks}</ul>
      </article>`;
  }

  /** Inject Exa + Stripe + DNA glass capsules from Python JSON */
  function populateGlassCapsules(capsules) {
    if (!capsules) return "";
    return [
      capsules.market ? renderMarketCapsule(capsules.market) : "",
      capsules.financial ? renderFinancialCapsule(capsules.financial) : "",
      capsules.company ? renderCompanyCapsule(capsules.company) : "",
    ].join("");
  }

  /** Display CFO Auditor question — updates placeholder + hidden label */
  function renderAIContextRequest(text) {
    const question =
      text ||
      "Why is this premium enterprise tier required over our unutilized alternative software licenses?";
    const field = overlayEl?.querySelector("#ape-justification");
    const label = overlayEl?.querySelector("#ape-context-label");
    if (field) {
      field.placeholder = `[AI Query: ${question} Enter justification here…]`;
    }
    if (label) label.textContent = question;
  }

  /** Flagged → bioluminescent yellow-green warning aura */
  function toggleWarningState(isFlagged) {
    session.isFlagged = isFlagged;
    const modal = overlayEl?.querySelector(".ape-glass-modal");
    if (!modal) return;
    modal.classList.toggle("ape-glass-modal--flagged", isFlagged);
    overlayEl?.classList.toggle("ape-glass--flagged", isFlagged);
  }

  function renderAuditPanel(auditResponse, checkoutContext = {}) {
    const overlay = ensureOverlay();
    const audit = auditResponse.audit || auditResponse;
    session.pendingAuthId = auditResponse.pending_auth_id;
    session.originButton = checkoutContext.originButton || null;
    session.originForm = checkoutContext.originForm || null;
    session.showFailOpen = !!checkoutContext.showFailOpen;
    session.onSessionEnd = checkoutContext.onSessionEnd || null;

    overlay.className = "ape-glass";
    overlay.innerHTML = `
      <div class="ape-eco-aurora" aria-hidden="true"></div>
      <div class="ape-glass-modal ${audit.is_flagged ? "ape-glass-modal--flagged" : ""}" role="dialog" aria-modal="true">
        <div class="ape-glint-sweep" aria-hidden="true"></div>

        <header class="ape-eco-banner">
          <span class="ape-leaf-pulse">${ICONS.leaf}</span>
          <div class="ape-banner-copy">
            <h1 class="ape-banner-title">🛑 APE Intercept: Procurement &amp; Eco-Fiscal Audit</h1>
            <p class="ape-banner-sub">Transaction frozen on credit network pending internal authorization</p>
          </div>
        </header>

        <section id="ape-capsules" class="ape-capsule-grid" aria-label="Three-spoke data grid">
          ${populateGlassCapsules(audit.capsules)}
        </section>

        <footer class="ape-gatekeeper">
          <label class="ape-gatekeeper-label" for="ape-justification">
            <span class="ape-label-tag">Context Required</span>
            <span id="ape-context-label"></span>
          </label>
          <div class="ape-recess-field">
            <textarea id="ape-justification" class="ape-recess-input" rows="3"></textarea>
          </div>
          <div class="ape-glass-actions">
            <button type="button" id="ape-abort" class="ape-gel-btn ape-gel-btn--abort">
              <span class="ape-btn-glint" aria-hidden="true"></span>
              Abort &amp; Release Funds
            </button>
            <button type="button" id="ape-override" class="ape-gel-btn ape-gel-btn--proceed">
              <span class="ape-btn-glint" aria-hidden="true"></span>
              Submit Justification to CFO
            </button>
          </div>
          ${session.showFailOpen ? `<button type="button" id="ape-failopen" class="ape-gel-btn ape-gel-btn--soft">Proceed without audit</button>` : ""}
          <p id="ape-status" class="ape-glass-status" hidden></p>
        </footer>
      </div>`;

    renderAIContextRequest(audit.missing_context_question);
    toggleWarningState(audit.is_flagged);

    overlay.querySelector("#ape-abort").addEventListener("click", handleAbortClick);
    overlay.querySelector("#ape-override").addEventListener("click", () => {
      handleOverrideSubmit(overlay.querySelector("#ape-justification").value);
    });
    overlay.querySelector("#ape-failopen")?.addEventListener("click", handleFailOpenProceed);
  }

  async function handleAbortClick() {
    const status = overlayEl.querySelector("#ape-status");
    status.hidden = false;
    status.textContent = "Sending decline signal to Python hub…";

    try {
      if (session.pendingAuthId) {
        await PythonBridge.resolveWithPython(session.pendingAuthId, "decline");
      }
      status.textContent = "Authorization declined. Purchase terminated.";
    } catch (err) {
      status.textContent = `Decline sent locally (${err.message}).`;
    }

    setTimeout(() => {
      destroyModal();
      SpokeExtension.unfreezeCheckout();
      window.history.back();
    }, 900);
  }

  async function handleOverrideSubmit(justificationText) {
    const status = overlayEl.querySelector("#ape-status");
    const justification = (justificationText || "").trim();

    if (!justification) {
      status.hidden = false;
      status.className = "ape-glass-status ape-glass-status--error";
      status.textContent = "Justification required before override.";
      return;
    }

    status.hidden = false;
    status.className = "ape-glass-status";
    status.textContent = "Submitting override to Python hub…";

    try {
      if (session.pendingAuthId) {
        const result = await PythonBridge.resolveWithPython(
          session.pendingAuthId,
          "approve",
          justification
        );
        if (!result.success && result.error) throw new Error(result.error);
      }

      status.className = "ape-glass-status ape-glass-status--success";
      status.textContent = "Approved — releasing checkout.";

      setTimeout(() => {
        destroyModal();
        SpokeExtension.triggerOriginalCheckout(session.originButton, session.originForm);
      }, 800);
    } catch (err) {
      status.className = "ape-glass-status ape-glass-status--error";
      status.textContent = err.message;
    }
  }

  function handleFailOpenProceed() {
    destroyModal();
    SpokeExtension.triggerOriginalCheckout(session.originButton, session.originForm);
  }

  function destroyModal() {
    const cb = session.onSessionEnd;
    overlayEl?.remove();
    overlayEl = null;
    session = {
      pendingAuthId: null,
      isFlagged: false,
      originButton: null,
      originForm: null,
      showFailOpen: false,
      onSessionEnd: null,
    };
    if (typeof cb === "function") cb();
  }

  return {
    showLoadingPulse,
    populateGlassCapsules,
    renderAIContextRequest,
    toggleWarningState,
    renderAuditPanel,
    handleAbortClick,
    handleOverrideSubmit,
    destroyModal,
  };
})();
