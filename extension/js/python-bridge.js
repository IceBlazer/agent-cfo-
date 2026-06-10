/**
 * python-bridge.js — Phase 2: Python API Bridge (thin client)
 * No audit logic — packages DOM payload and awaits Python hub response.
 */
const PythonBridge = (() => {
  const BACKEND_TIMEOUT_MS = 4500;
  const DEFAULT_API_BASE = "http://127.0.0.1:8787";

  async function getConfig() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(["apiBase", "riskTolerance"], (stored) => {
        resolve({
          apiBase: stored.apiBase || DEFAULT_API_BASE,
          riskTolerance: stored.riskTolerance || "fail-closed",
        });
      });
    });
  }

  function timeoutPromise(ms) {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error("BACKEND_TIMEOUT")), ms);
    });
  }

  /**
   * POST sanitized cart JSON to Python /api/v1/intercept
   */
  async function transmitToPythonHub(payload) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: "APE_INTERCEPT", payload },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (response?.error) {
            reject(new Error(response.error));
            return;
          }
          resolve(response);
        }
      );
    });
  }

  /**
   * Manage loading pulse while Python runs Evaluator 1 + 2
   */
  async function awaitAuditDecision(cartPayload) {
    LiquidGlassUI.showLoadingPulse();

    try {
      const decision = await Promise.race([
        transmitToPythonHub(cartPayload),
        timeoutPromise(BACKEND_TIMEOUT_MS),
      ]);
      return { ok: true, data: decision };
    } catch (error) {
      return executeBackendFallback(error);
    }
  }

  /**
   * Fail-closed: block until user cancels/retries.
   * Fail-open: soft-warning then allow proceed without full audit.
   */
  async function executeBackendFallback(error) {
    const { riskTolerance } = await getConfig();
    const isTimeout = error.message === "BACKEND_TIMEOUT";

    return {
      ok: false,
      fallback: true,
      riskTolerance,
      error: error.message,
      data: {
        pending_auth_id: null,
        audit: {
          is_flagged: true,
          missing_context_question: isTimeout
            ? "Python hub did not respond in time. Cancel or proceed at your own risk?"
            : "Backend unavailable. Cancel this purchase or retry when the hub is online.",
          capsules: {
            market: {
              source: "Exa",
              headline: "Market Benchmark Baseline",
              label: "Market Intelligence (Exa API Data)",
              target_display: "—",
              fair_rate_display: "—",
              efficiency_delta: 0,
              body: isTimeout ? "Exa scan timed out." : "Could not reach Exa routing layer.",
            },
            financial: {
              source: "Stripe",
              headline: "Stripe Corporate Ledger",
              label: "Financial Health (Stripe API Data)",
              budget_fill_percent: 0,
              budget_label: "Budget data unavailable",
              body: "Stripe context unavailable during fallback.",
            },
            company: {
              source: "DNA",
              headline: "Corporate DNA Sync",
              label: "Strategic Alignment (Precollected DNA Data)",
              checklist: [{ text: `Fallback (${riskTolerance}): ${error.message}`, status: "warn" }],
            },
          },
        },
      },
    };
  }

  /**
   * Route resolution to Python /api/v1/resolve
   */
  async function resolveWithPython(authId, action, justification = "") {
    const bridgeAction = action === "approve" ? "approve" : "decline";
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: "APE_RESOLVE",
          payload: { auth_id: authId, action: bridgeAction, justification },
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (response?.error) {
            reject(new Error(response.error));
            return;
          }
          resolve(response);
        }
      );
    });
  }

  return {
    BACKEND_TIMEOUT_MS,
    transmitToPythonHub,
    awaitAuditDecision,
    executeBackendFallback,
    resolveWithPython,
    getConfig,
  };
})();
