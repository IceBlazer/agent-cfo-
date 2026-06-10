/** Content script — checkout detection + overlay (thin client). */
(() => {
  let busy = false;

  async function runIntercept(event, buttonEl) {
    if (busy) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    busy = true;

    const ctx = SpokeExtension.freezeCheckoutEvent(event, buttonEl);
    const cart = SpokeExtension.scrapeCartData();
    const payload = SpokeExtension.toInterceptPayload(cart);

    CheckoutOverlay.showLoading();
    await AgentStorage.setPopupState("processing");

    try {
      const review = await ApiClient.intercept(payload);
      await AgentStorage.saveReview(review);
      CheckoutOverlay.injectAgentCFOOverlay(review, {
        ...ctx,
        onDone: () => {
          busy = false;
        },
      });
    } catch (err) {
      const isTimeout = err.name === "AbortError" || /timeout|aborted/i.test(err.message);
      CheckoutOverlay.showTimeoutFallback(
        () => {
          CheckoutOverlay.remove();
          SpokeExtension.unfreezeCheckout();
          busy = false;
        },
        () => {
          busy = false;
          runIntercept(event, buttonEl);
        }
      );
      if (!isTimeout) {
        CheckoutOverlay.remove();
        SpokeExtension.unfreezeCheckout();
        busy = false;
      }
    }
  }

  SpokeExtension.observeCheckoutChanges(runIntercept);
})();
