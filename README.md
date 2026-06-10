# AgentCFO — AI Finance Assistant for Small Business

**Before you buy this, AgentCFO checks if there is a cheaper option, whether it fits your budget, and whether you already have something similar.**

Two connected experiences:
- **Chrome extension** — real-time checkout helper
- **Dashboard** — savings, budget health, renewals, and purchase history

> AgentCFO works in two ways: the extension helps you before you buy, and the dashboard shows your savings, budget health, and next steps.

## Quick start

### 1. Python API (required)

```powershell
cd c:\Users\18634\AgentCFO\agent-cfo-
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python api_server.py
```

API: `http://127.0.0.1:8787`  
Dashboard (after build): `http://127.0.0.1:8787/app`

### 2. Dashboard

```powershell
cd dashboard
npm install
npm run build
```

Dev mode with hot reload: `npm run dev` → `http://localhost:5173/app`

### 3. Chrome extension

1. `chrome://extensions` → Developer mode → **Load unpacked** → `extension/`
2. Click the AgentCFO icon → **Try Demo** or **Open Dashboard**
3. On demo checkout, click **Place Order** to see the review overlay

## API endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/dashboard/summary` | Dashboard home metrics |
| GET | `/api/v1/purchases/recent` | Recent activity |
| GET | `/api/v1/financial-health` | Cash flow & budgets |
| GET | `/api/v1/actions` | To-do / action center |
| GET | `/api/v1/audit-log` | Decision timeline |
| POST | `/api/v1/intercept` | Checkout review |
| POST | `/api/v1/resolve` | Cancel / continue |

## Architecture

```
Extension (thin client)          Python hub                    Dashboard
─────────────────────           ────────────                  ───────────
detect checkout        →        OpenAI Evaluator 1    →       summary
scrape + sanitize      →        Exa market scan       →       purchases
overlay UI             →        OpenAI Evaluator 2    →       financial
resolve action         →        Stripe + company DNA  →       to-do
```

## Environment variables

Copy `.env.example` — never commit keys.

## Demo flow

1. Start `python api_server.py`
2. Build dashboard (`npm run build` in `dashboard/`)
3. Reload extension
4. Extension popup → **Try Demo** → **Place Order**
5. See savings overlay → **Open Dashboard** to view synced purchase
