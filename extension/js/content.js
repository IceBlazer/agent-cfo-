/**
 * content.js — Thin-client orchestrator
 * Wires interceptor → Python bridge → Liquid Glass UI
 */
(() => {
  let interceptActive = false;

  function releaseInterceptLock() {
    interceptActive = false;
  }

  async function onCheckoutButtonFound(event, buttonEl) {
    if (interceptActive) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    interceptActive = true;

    const checkoutContext = SpokeExtension.freezeCheckoutEvent(event, buttonEl);
    const cartPayload = SpokeExtension.scrapeCartData();

    const result = await PythonBridge.awaitAuditDecision(cartPayload);
    const { riskTolerance } = await PythonBridge.getConfig();

    const panelOpts = {
      ...checkoutContext,
      isFallback: !result.ok,
      showFailOpen: !result.ok && riskTolerance === "fail-open",
      onSessionEnd: releaseInterceptLock,
    };

    LiquidGlassUI.renderAuditPanel(result.data, panelOpts);

    if (result.ok) {
      // Lock held until user resolves modal (onSessionEnd)
      return;
    }

    if (riskTolerance === "fail-closed") {
      LiquidGlassUI.toggleWarningState(true);
    }
  }

  SpokeExtension.attachMutationObservers(onCheckoutButtonFound);
})();
