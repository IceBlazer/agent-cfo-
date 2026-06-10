/** Demo checkout — Notion Team Plan example. */
(() => {
  document.getElementById("place-order")?.addEventListener("click", async (e) => {
    e.preventDefault();
    const btn = e.currentTarget;
    btn.disabled = true;

    const ctx = SpokeExtension.freezeCheckoutIfNeeded(e, btn);
    const payload = {
      merchant: "Notion",
      product_name: "Notion Team Plan",
      description: "Notion Team Plan | $96.00/month | Total: $96.00",
      raw_dom_text: "Notion Team Plan | $96.00/month | Total: $96.00",
      price: 96,
      billing_cycle: "monthly",
      quantity: 1,
      url: "demo",
      checkout_confidence: 1,
      timestamp: new Date().toISOString(),
    };

    InjectedOverlay.showLoading();
    try {
      const review = await ApiClient.sendInterceptPayload(payload);
      await AgentStorage.saveReview(review);
      InjectedOverlay.injectAgentCFOOverlay(review, {
        ...ctx,
        onDone: () => { btn.disabled = false; },
      });
    } catch (err) {
      alert(err.message);
      InjectedOverlay.remove();
      SpokeExtension.unfreezeCheckout();
      btn.disabled = false;
    }
  });
})();
