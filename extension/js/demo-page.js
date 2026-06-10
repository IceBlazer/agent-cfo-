/**
 * Standalone demo page — runs inside extension (chrome-extension://)
 * Does not rely on content scripts (which fail on file:// URLs).
 */
(() => {
  const DEMO_CART = {
    raw_dom_text:
      "Item: 10x GitHub Enterprise Seats - Price: $2,100/yr | Subtotal: $2,100.00 | Tax: $168.00 | Total: $2,268.00",
    merchant: "GitHub Inc.",
    amount_cents: 226800,
    currency: "usd",
    department: "Development",
    used_card_id: "ic_extension_card",
    category: "developer_tools",
    page_url: "demo",
  };

  let intercepting = false;

  document.getElementById("place-order")?.addEventListener("click", async (event) => {
    if (intercepting) return;
    intercepting = true;
    event.preventDefault();

    const btn = event.currentTarget;
    btn.disabled = true;
    btn.textContent = "Held — audit in progress…";

    const checkoutContext = SpokeExtension.freezeCheckoutEvent(event, btn);
    const cartPayload = { ...DEMO_CART, ...SpokeExtension.scrapeCartData() };

    const result = await PythonBridge.awaitAuditDecision(cartPayload);
    const { riskTolerance } = await PythonBridge.getConfig();

    LiquidGlassUI.renderAuditPanel(result.data, {
      ...checkoutContext,
      isFallback: !result.ok,
      showFailOpen: !result.ok && riskTolerance === "fail-open",
      onSessionEnd: () => {
        intercepting = false;
        btn.disabled = false;
        btn.textContent = "Place Order";
      },
    });

    if (!result.ok && riskTolerance === "fail-closed") {
      LiquidGlassUI.toggleWarningState(true);
    }
  });
})();
