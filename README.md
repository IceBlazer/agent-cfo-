# AgentCFO — Autonomous Procurement Engine (APE)

Corporate checkout gatekeeper: a Chrome extension intercepts purchases, a Python hub-and-spoke backend audits them against company DNA, Exa market benchmarks, and Stripe financial health, then approves or declines the Stripe Issuing authorization hold.

## Architecture

```
Browser DOM Checkout
       ↓
Spoke: Extension (cart intercept + hard-wall UI)
       ↓
Spoke: Cards (Mission Hub, Stack Registry, Policy Spoke)
Spoke: Stripe Tracker (balances, runway, auth hold)
       ↓
Agent 1 — Search Strategist (OpenAI) → Exa Instant scan
       ↓
Agent 2 — CFO Auditor (OpenAI)
       ↓
Hard-Wall Overlay → Override (approve) / Cancel (decline)
```

## Quick start

### 1. Python backend

```bash
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
copy .env.example .env        # optional: add API keys
python api_server.py          # http://127.0.0.1:8787
```

CLI demo (simulated cart, no extension):

```bash
python main.py
```

Works offline without API keys — spokes fall back to simulated Stripe, Exa, and OpenAI responses.

### 2. Chrome extension

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select the `extension/` folder
4. Open `extension/demo_checkout.html` in Chrome
5. Click **Place Order** — the hard-wall should appear after the audit

Configure backend URL via the extension popup (default `http://127.0.0.1:8787`).

## Spoke modules

| Module | Role |
|--------|------|
| `spoke_extension.py` | Cart DOM intercept / normalization |
| `spoke_cards.py` | Precollected company DNA |
| `spoke_stripe_tracker.py` | Live financial health + auth hold/release |
| `spoke_market.py` | Exa Instant market benchmarks |
| `spoke_intelligence.py` | OpenAI Search Strategist + CFO Auditor |
| `main.py` | CLI orchestration (reference template) |
| `api_server.py` | HTTP API for the extension |

## Environment variables

See `.env.example` for `STRIPE_TEST_KEY`, `EXA_API_KEY`, and `OPENAI_API_KEY`.
