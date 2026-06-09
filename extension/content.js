/**
 * AgentCFO content script — freezes checkout, scrapes DOM, renders hard-wall overlay.
 */

const CHECKOUT_BUTTON_SELECTORS = [
  'button[type="submit"]',
  'input[type="submit"]',
  '[data-testid*="checkout"]',
  '[data-testid*="place-order"]',
  '#place-order',
  '.place-order',
  'button[name="checkout"]',
  'button:where(:not([disabled]))',
];

const CHECKOUT_KEYWORDS = /place order|complete purchase|pay now|submit order|buy now|checkout/i;

let interceptActive = false;
let frozenButtons = [];

function isCheckoutPage() {
  const bodyText = document.body?.innerText?.slice(0, 8000) || "";
  const hasTotal = /total|subtotal|amount due/i.test(bodyText);
  const hasPay = CHECKOUT_KEYWORDS.test(bodyText);
  return hasTotal && hasPay;
}

function findCheckoutButtons() {
  const buttons = new Set();
  for (const selector of CHECKOUT_BUTTON_SELECTORS) {
    document.querySelectorAll(selector).forEach((el) => {
      const label = (el.innerText || el.value || "").trim();
      if (CHECKOUT_KEYWORDS.test(label) || selector.includes("checkout") || selector.includes("place-order")) {
        buttons.add(el);
      }
    });
  }
  return [...buttons];
}

function freezeCheckoutButtons() {
  frozenButtons = findCheckoutButtons();
  frozenButtons.forEach((btn) => {
    if (!btn.dataset.apeOriginalPointerEvents) {
      btn.dataset.apeOriginalPointerEvents = btn.style.pointerEvents || "";
      btn.dataset.apeOriginalOpacity = btn.style.opacity || "";
    }
    btn.style.pointerEvents = "none";
    btn.style.opacity = "0.45";
    btn.setAttribute("aria-disabled", "true");
    btn.dataset.apeFrozen = "true";
  });
}

function unfreezeCheckoutButtons() {
  frozenButtons.forEach((btn) => {
    btn.style.pointerEvents = btn.dataset.apeOriginalPointerEvents || "";
    btn.style.opacity = btn.dataset.apeOriginalOpacity || "";
    btn.removeAttribute("aria-disabled");
    delete btn.dataset.apeFrozen;
  });
  frozenButtons = [];
}

function scrapeCheckoutDom() {
  const main = document.querySelector("main") || document.body;
  const raw_dom_text = (main?.innerText || document.body.innerText || "").slice(0, 6000);
  const title = document.title || "";
  const merchant =
    document.querySelector('meta[property="og:site_name"]')?.content ||
    title.split("|")[0]?.trim() ||
    window.location.hostname;

  const amountMatch = raw_dom_text.match(/total[:\s]*\$?([\d,]+(?:\.\d{2})?)/i);
  const amount_cents = amountMatch
    ? Math.round(parseFloat(amountMatch[1].replace(/,/g, "")) * 100)
    : null;

  return {
    raw_dom_text,
    merchant,
    amount_cents,
    currency: "usd",
    department: "Development",
    used_card_id: "ic_extension_card",
    category: "software",
    page_url: window.location.href,
  };
}

function renderHardWall(auditPayload) {
  removeHardWall();

  const { audit, pending_auth_id } = auditPayload;
  const overlay = document.createElement("div");
  overlay.id = "ape-hardwall-overlay";
  overlay.innerHTML = `
    <div class="ape-hardwall-modal" role="dialog" aria-modal="true" aria-labelledby="ape-title">
      <header class="ape-header">
        <span class="ape-badge">APE</span>
        <h1 id="ape-title">🛑 APE Intercept: Fiscal Alignment Review</h1>
      </header>
      <section class="ape-analysis">${formatAnalysis(audit.concise_analysis)}</section>
      <section class="ape-question">
        <label for="ape-justification"><strong>Context Required:</strong> ${escapeHtml(audit.missing_context_question)}</label>
        <textarea id="ape-justification" rows="3" placeholder="Enter justification here..."></textarea>
      </section>
      <div class="ape-actions">
        <button type="button" id="ape-abort" class="ape-btn ape-btn-decline">Cancel Purchase</button>
        <button type="button" id="ape-override" class="ape-btn ape-btn-approve">Override &amp; Log to CFO</button>
      </div>
      <p id="ape-status" class="ape-status" hidden></p>
    </div>
  `;

  document.documentElement.appendChild(overlay);

  overlay.querySelector("#ape-abort").addEventListener("click", () =>
    handleResolve(pending_auth_id, "abort", "", overlay)
  );
  overlay.querySelector("#ape-override").addEventListener("click", () => {
    const justification = overlay.querySelector("#ape-justification").value.trim();
    handleResolve(pending_auth_id, "override", justification, overlay);
  });
}

function formatAnalysis(text) {
  return escapeHtml(text || "").replace(/\n/g, "<br>");
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function removeHardWall() {
  document.getElementById("ape-hardwall-overlay")?.remove();
}

async function handleResolve(authId, action, justification, overlay) {
  const status = overlay.querySelector("#ape-status");
  status.hidden = false;
  status.textContent = "Resolving authorization with Stripe...";

  const result = await chrome.runtime.sendMessage({
    type: "APE_RESOLVE",
    payload: { auth_id: authId, action, justification },
  });

  if (result?.error) {
    status.textContent = `Error: ${result.error}`;
    return;
  }

  status.textContent = result.message || `Authorization ${result.action}.`;
  if (action === "override") {
    unfreezeCheckoutButtons();
    setTimeout(() => {
      removeHardWall();
      interceptActive = false;
    }, 1200);
  } else {
    setTimeout(() => {
      removeHardWall();
      window.history.back();
    }, 1200);
  }
}

async function interceptCheckout(clickedButton) {
  if (interceptActive) return;
  interceptActive = true;

  freezeCheckoutButtons();
  if (clickedButton && !frozenButtons.includes(clickedButton)) {
    clickedButton.style.pointerEvents = "none";
    clickedButton.style.opacity = "0.45";
    frozenButtons.push(clickedButton);
  }

  const payload = scrapeCheckoutDom();

  let auditPayload;
  try {
    auditPayload = await chrome.runtime.sendMessage({ type: "APE_AUDIT", payload });
  } catch (err) {
    auditPayload = { error: err.message };
  }

  if (auditPayload?.error) {
    renderHardWall({
      pending_auth_id: "offline",
      audit: {
        concise_analysis:
          "Backend unreachable. Start api_server.py on port 8787.\n\n" + auditPayload.error,
        missing_context_question: "Start the APE backend and retry, or cancel this purchase.",
        is_flagged: true,
      },
    });
    return;
  }

  renderHardWall(auditPayload);
}

function attachInterceptListeners() {
  if (!isCheckoutPage()) return;

  findCheckoutButtons().forEach((btn) => {
    if (btn.dataset.apeListener) return;
    btn.dataset.apeListener = "true";
    btn.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        event.stopPropagation();
        interceptCheckout(btn);
      },
      true
    );
  });
}

const observer = new MutationObserver(() => attachInterceptListeners());
observer.observe(document.documentElement, { childList: true, subtree: true });
attachInterceptListeners();
