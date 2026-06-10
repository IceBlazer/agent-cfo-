/**
 * spoke_extension.js — Phase 1: DOM Interceptor (thin client)
 * Detects B2B checkout pages, scrapes cart data, freezes checkout events.
 */
const SpokeExtension = (() => {
  const CHECKOUT_BUTTON_SELECTORS = [
    'button[type="submit"]',
    'input[type="submit"]',
    '[data-testid*="checkout"]',
    '[data-testid*="place-order"]',
    "#place-order",
    ".place-order",
    'button[name="checkout"]',
  ];

  const CHECKOUT_KEYWORDS = /place order|complete purchase|pay now|submit order|buy now|checkout/i;

  const PII_PATTERNS = [
    [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[EMAIL_REDACTED]"],
    [/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[PHONE_REDACTED]"],
    [/\b(?:\d{4}[-\s]?){3}\d{4}\b/g, "[CARD_REDACTED]"],
    [/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN_REDACTED]"],
    [/\b\d{1,5}\s+\w+\s+(?:st|street|ave|avenue|rd|road|blvd|drive|dr|ln|lane)\b/gi, "[ADDRESS_REDACTED]"],
  ];

  const PII_FIELD_SELECTORS =
    'input[type="email"], input[autocomplete*="email"], input[name*="email"], ' +
    'input[name*="phone"], input[name*="address"], input[name*="name"], ' +
    'input[autocomplete*="address"], [data-testid*="billing"], [data-testid*="shipping"]';

  let frozenButtons = [];
  let mutationObserver = null;

  function isCheckoutPage() {
    const bodyText = document.body?.innerText?.slice(0, 8000) || "";
    return /total|subtotal|amount due/i.test(bodyText) && CHECKOUT_KEYWORDS.test(bodyText);
  }

  function findCheckoutButtons() {
    const buttons = new Set();
    for (const selector of CHECKOUT_BUTTON_SELECTORS) {
      document.querySelectorAll(selector).forEach((el) => {
        const label = (el.innerText || el.value || "").trim();
        if (
          CHECKOUT_KEYWORDS.test(label) ||
          selector.includes("checkout") ||
          selector.includes("place-order")
        ) {
          buttons.add(el);
        }
      });
    }
    return [...buttons];
  }

  function stripPiiFromText(text) {
    let sanitized = text || "";
    for (const [pattern, replacement] of PII_PATTERNS) {
      sanitized = sanitized.replace(pattern, replacement);
    }
    return sanitized;
  }

  function scrapeCartData() {
    const excludeNodes = document.querySelectorAll(PII_FIELD_SELECTORS);
    const excludedText = new Set();
    excludeNodes.forEach((node) => {
      const parent = node.closest("fieldset, section, div, form") || node.parentElement;
      if (parent) excludedText.add(parent);
    });

    const main = document.querySelector("main") || document.body;
    const clone = main.cloneNode(true);
    clone.querySelectorAll(PII_FIELD_SELECTORS).forEach((el) => el.remove());

    let raw_dom_text = (clone.innerText || "").slice(0, 6000);
    raw_dom_text = stripPiiFromText(raw_dom_text);

    const merchant =
      document.querySelector('meta[property="og:site_name"]')?.content ||
      document.title.split("|")[0]?.trim() ||
      window.location.hostname;

    const amountMatch = raw_dom_text.match(/total[:\s]*\$?([\d,]+(?:\.\d{2})?)/i);
    const amount_cents = amountMatch
      ? Math.round(parseFloat(amountMatch[1].replace(/,/g, "")) * 100)
      : null;

    const line_items = [];
    const itemMatch = raw_dom_text.match(/(\d+)\s*x\s+(.+?)(?:\s*[-–|]|$)/i);
    if (itemMatch) {
      line_items.push({
        name: itemMatch[2].trim().slice(0, 120),
        quantity: parseInt(itemMatch[1], 10),
      });
    }

    return sanitizePayload({
      raw_dom_text,
      merchant: stripPiiFromText(merchant),
      amount_cents,
      currency: "usd",
      department: "Development",
      used_card_id: "ic_extension_card",
      category: "software",
      page_url: window.location.origin + window.location.pathname,
    });
  }

  function sanitizePayload(payload) {
    const clean = { ...payload };
    if (typeof clean.raw_dom_text === "string") {
      clean.raw_dom_text = stripPiiFromText(clean.raw_dom_text);
    }
    if (typeof clean.merchant === "string") {
      clean.merchant = stripPiiFromText(clean.merchant);
    }
    delete clean.card_number;
    delete clean.email;
    delete clean.phone;
    return clean;
  }

  function freezeCheckoutEvent(event, buttonEl) {
    event.preventDefault();
    event.stopImmediatePropagation();

    frozenButtons = findCheckoutButtons();
    frozenButtons.forEach((btn) => {
      btn.dataset.apeOrigPointer = btn.style.pointerEvents || "";
      btn.dataset.apeOrigOpacity = btn.style.opacity || "";
      btn.style.pointerEvents = "none";
      btn.style.opacity = "0.48";
      btn.setAttribute("aria-disabled", "true");
      btn.dataset.apeFrozen = "true";
    });

    if (buttonEl && !frozenButtons.includes(buttonEl)) {
      buttonEl.style.pointerEvents = "none";
      buttonEl.style.opacity = "0.48";
      frozenButtons.push(buttonEl);
    }

    return {
      originButton: buttonEl,
      originForm: buttonEl?.closest("form") || null,
    };
  }

  function unfreezeCheckout() {
    frozenButtons.forEach((btn) => {
      btn.style.pointerEvents = btn.dataset.apeOrigPointer || "";
      btn.style.opacity = btn.dataset.apeOrigOpacity || "";
      btn.removeAttribute("aria-disabled");
      delete btn.dataset.apeFrozen;
    });
    frozenButtons = [];
  }

  function triggerOriginalCheckout(originButton, originForm) {
    unfreezeCheckout();
    if (originForm) {
      originForm.requestSubmit?.(originButton) || originForm.submit();
    } else if (originButton) {
      originButton.style.pointerEvents = "";
      originButton.style.opacity = "";
      originButton.removeAttribute("aria-disabled");
      originButton.click();
    }
  }

  function attachMutationObservers(onCheckoutButtonFound) {
    if (mutationObserver) return;

    const scan = () => {
      if (!isCheckoutPage()) return;
      findCheckoutButtons().forEach((btn) => {
        if (btn.dataset.apeListener) return;
        btn.dataset.apeListener = "true";
        btn.addEventListener(
          "click",
          (event) => onCheckoutButtonFound(event, btn),
          true
        );
      });
    };

    mutationObserver = new MutationObserver(scan);
    mutationObserver.observe(document.documentElement, { childList: true, subtree: true });
    scan();
  }

  return {
    isCheckoutPage,
    scrapeCartData,
    sanitizePayload,
    freezeCheckoutEvent,
    unfreezeCheckout,
    triggerOriginalCheckout,
    attachMutationObservers,
  };
})();
