# AgentCFO — Autonomous Procurement Engine (APE)

Python-heavy procurement gatekeeper. The Chrome extension is a **thin client** — it scrapes DOM, renders Liquid Glass UI, and delegates all intelligence to the Python hub.

## Thin-client bridge architecture

```
Phase 1  spoke_extension.js     scrapeCartData · freezeCheckoutEvent · PII sanitize
Phase 2  python-bridge.js       transmitToPythonHub · awaitAuditDecision (4.5s timeout)
Phase 3  hardwall-ui.js         populateGlassCapsules · renderAIContextRequest · toggleWarningState
Phase 4  hardwall-ui.js         handleAbortClick · handleOverrideSubmit → Stripe via Python
         background.js           fetch proxy to Python hub (CORS / MV3 service worker)
```

## Quick start

### 1. Python hub (required)

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python api_server.py          # http://127.0.0.1:8787
```

### 2. Chrome extension

1. `chrome://extensions` → Developer mode → **Load unpacked** → `extension/`
2. Open `extension/demo_checkout.html`
3. Click **Place Order**

Extension popup settings:
- **Python hub URL** — default `http://127.0.0.1:8787`
- **Timeout fallback** — `fail-closed` (block) or `fail-open` (soft warning + proceed)

## API endpoints (v1)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/intercept` | Full APE pipeline → UI-ready capsules JSON |
| `POST` | `/api/v1/resolve?action=approve\|decline` | Stripe auth approve / decline |

Legacy: `/api/audit`, `/api/resolve` still supported.

## Extension modules

| File | Role |
|------|------|
| `js/spoke_extension.js` | DOM mutation observers, cart scrape, checkout freeze |
| `js/python-bridge.js` | Async bridge, 4.5s timeout, fail-open/closed fallback |
| `js/hardwall-ui.js` | Liquid Glass overlay + resolution handshake |
| `js/content.js` | Orchestrator wiring |
| `css/liquid-glass.css` | Frutiger Eco glass UI |

## Python spokes

| Module | Role |
|--------|------|
| `spoke_extension.py` | Server-side cart normalization |
| `spoke_cards.py` | Company DNA |
| `spoke_stripe_tracker.py` | Stripe health + auth hold |
| `spoke_market.py` | Exa benchmarks |
| `spoke_intelligence.py` | OpenAI evaluators |
| `api_server.py` | FastAPI hub |
| `main.py` | CLI reference |

## Environment variables

See `.env.example` for `STRIPE_TEST_KEY`, `EXA_API_KEY`, and `OPENAI_API_KEY`.
