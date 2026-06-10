/**
 * contentScript.js — checkout detection, PII-safe scrape, overlay injection.
 */
(() => {
  let busy = false;

  async function runIntercept(event, buttonEl) {
    if (busy) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    busy = true;

    const ctx = SpokeExtension.freezeCheckoutIfNeeded(event, buttonEl);
    const cart = SpokeExtension.scrapeCartData();
    const payload = SpokeExtension.sanitizeCartPayload(
      SpokeExtension.toInterceptPayload(cart)
    );

    InjectedOverlay.showLoading();
    await AgentStorage.setPopupState("processing");
    chrome.runtime.sendMessage({ type: "ICON_UPDATE", state: "review" });

    try {
      const review = await ApiClient.sendInterceptPayload(payload);
      await AgentStorage.saveReview(review);
      InjectedOverlay.injectAgentCFOOverlay(review, {
        ...ctx,
        onDone: () => {
          busy = false;
        },
      });
    } catch (err) {
      const isTimeout = err.name === "AbortError" || /abort|timeout/i.test(err.message);
      if (isTimeout) {
        InjectedOverlay.showTimeoutFallback(
          () => {
            InjectedOverlay.remove();
            SpokeExtension.unfreezeCheckout();
            busy = false;
            chrome.runtime.sendMessage({ type: "ICON_UPDATE", state: "active" });
          },
          () => {
            busy = false;
            runIntercept(event, buttonEl);
          }
        );
      } else {
        InjectedOverlay.showError(err.message, () => {
          InjectedOverlay.remove();
          SpokeExtension.unfreezeCheckout();
          busy = false;
        });
      }
    }
  }

  if (SpokeExtension.detectCheckoutPage()) {
    SpokeExtension.observeCheckoutChanges(runIntercept);
  } else {
    SpokeExtension.observeCheckoutChanges(runIntercept);
  }
})();
