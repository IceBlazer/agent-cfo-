"""
AgentCFO API hub — Python-heavy backend for extension + dashboard.
"""

from __future__ import annotations

import os
import time
from pathlib import Path
from typing import Any, Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from api_intercept import build_intercept_response, payload_to_cart
from api_store import (
    add_audit_entry,
    get_actions,
    get_audit_log,
    get_financial_health,
    get_purchase,
    get_recent_purchases,
    get_summary,
    init_store,
    save_purchase,
    update_purchase_status,
)
from spoke_cards import get_company_dna
from spoke_extension import normalize_extension_payload
from spoke_intelligence import run_cfo_auditor, run_search_strategist
from spoke_market import execute_exa_instant_scan
from spoke_stripe_tracker import capture_pending_auth, fetch_live_financial_health, resolve_authorization

app = FastAPI(title="AgentCFO API", version="2.0.0")
init_store()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PROFILE_ID = os.getenv("APE_COMPANY_PROFILE", "standard_b2b_startup")
_ROOT = Path(__file__).parent
_EXTENSION_DIR = _ROOT / "extension"
_DASHBOARD_DIST = _ROOT / "dashboard" / "dist"


class InterceptV1Body(BaseModel):
    merchant: str | None = None
    product_name: str | None = None
    description: str | None = None
    price: float | None = None
    billing_cycle: Literal["monthly", "yearly", "one_time", "unknown"] = "unknown"
    quantity: int = 1
    url: str = ""
    checkout_confidence: float = 0.8
    timestamp: str | None = None
    # legacy / extension fields
    raw_dom_text: str | None = None
    amount_cents: int | None = None
    used_card_id: str = "ic_extension_card"
    department: str = "Software"
    category: str = "software"
    line_items: list[dict[str, Any]] | None = None
    page_url: str = ""


class ResolveV1Body(BaseModel):
    purchase_id: str
    action: Literal["cancel", "continue", "continue_with_justification"]
    justification: str = ""
    pending_auth_id: str | None = None


def _run_pipeline(cart_data: dict[str, Any]) -> dict[str, Any]:
    company_dna = get_company_dna(profile_id=PROFILE_ID)
    stripe_health = fetch_live_financial_health(card_id=cart_data.get("used_card_id", "ic_extension_card"))
    pending_auth_id = capture_pending_auth(
        card_id=cart_data["used_card_id"],
        amount_cents=cart_data.get("amount_cents") or 0,
        merchant=cart_data.get("merchant", "Checkout"),
    )
    exa_query = run_search_strategist(raw_cart=cart_data, api_key=os.getenv("OPENAI_API_KEY"))
    market = execute_exa_instant_scan(query=exa_query, api_key=os.getenv("EXA_API_KEY"))
    audit = run_cfo_auditor(
        cart=cart_data,
        market_data=market,
        company_rules=company_dna,
        financials=stripe_health,
        api_key=os.getenv("OPENAI_API_KEY"),
    )
    return {
        "cart": cart_data,
        "exa_query": exa_query,
        "pending_auth_id": pending_auth_id,
        "audit": audit,
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "agentcfo", "version": "2.0.0"}


@app.get("/api/v1/dashboard/summary")
def dashboard_summary() -> dict[str, Any]:
    return get_summary()


@app.get("/api/v1/purchases/recent")
def purchases_recent() -> list[dict[str, Any]]:
    return get_recent_purchases()


@app.get("/api/v1/purchases/{purchase_id}")
def purchase_detail(purchase_id: str) -> dict[str, Any]:
    rec = get_purchase(purchase_id)
    if not rec:
        raise HTTPException(404, "Purchase not found")
    return rec


@app.get("/api/v1/financial-health")
def financial_health() -> dict[str, Any]:
    return get_financial_health()


@app.get("/api/v1/actions")
def actions_list() -> list[dict[str, Any]]:
    return get_actions()


@app.get("/api/v1/audit-log")
def audit_log(limit: int = 50) -> list[dict[str, Any]]:
    return get_audit_log(limit)


@app.post("/api/v1/intercept")
def intercept_v1(body: InterceptV1Body) -> dict[str, Any]:
    t0 = time.perf_counter()
    payload = body.model_dump(exclude_none=True)
    if body.raw_dom_text or body.amount_cents is not None:
        cart = normalize_extension_payload(payload)
    else:
        cart = normalize_extension_payload(payload_to_cart(payload))
    pipeline = _run_pipeline(cart)
    elapsed = int((time.perf_counter() - t0) * 1000)
    return build_intercept_response(pipeline, payload, elapsed_ms=elapsed)


@app.post("/api/v1/resolve")
def resolve_v1(body: ResolveV1Body) -> dict[str, Any]:
    purchase = get_purchase(body.purchase_id)
    auth_id = body.pending_auth_id or (purchase or {}).get("pending_auth_id")

    status_map = {
        "cancel": "canceled",
        "continue": "approved",
        "continue_with_justification": "continued_with_justification",
    }
    new_status = status_map[body.action]

    if body.action == "continue_with_justification" and not body.justification.strip():
        raise HTTPException(400, "Justification required.")

    stripe_result = None
    if auth_id:
        bridge = "override" if body.action != "cancel" else "abort"
        if bridge == "override" and body.action == "continue_with_justification" and not body.justification.strip():
            raise HTTPException(400, "Justification required for approval.")
        stripe_result = resolve_authorization(auth_id, bridge if body.action != "continue" else "override")

    savings_added = 0
    if body.action == "cancel" and purchase:
        savings_added = purchase.get("price", 0)

    update_purchase_status(
        body.purchase_id,
        new_status,
        justification=body.justification,
        savings=savings_added if body.action == "cancel" else purchase.get("savings", 0) if purchase else 0,
    )
    add_audit_entry(
        {
            "purchase_id": body.purchase_id,
            "event": "resolve",
            "status": new_status,
            "summary": f"User chose to {body.action.replace('_', ' ')}.",
            "justification": body.justification,
        }
    )
    return {
        "success": True,
        "purchase_id": body.purchase_id,
        "status": new_status,
        "message": (
            "Purchase canceled — we'll log this for your records."
            if body.action == "cancel"
            else "Thanks — we'll log this for your records."
        ),
        "stripe": stripe_result,
    }


# Static: extension demo assets
if _EXTENSION_DIR.exists():
    app.mount("/css", StaticFiles(directory=_EXTENSION_DIR / "css"), name="ext-css")
    app.mount("/js", StaticFiles(directory=_EXTENSION_DIR / "js"), name="ext-js")


@app.get("/demo")
def demo_page() -> FileResponse:
    page = _EXTENSION_DIR / "demo.html"
    return FileResponse(page if page.exists() else _EXTENSION_DIR / "demo_checkout.html")


# Dashboard SPA
if _DASHBOARD_DIST.exists():
    app.mount("/app", StaticFiles(directory=_DASHBOARD_DIST, html=True), name="dashboard")

    @app.get("/dashboard")
    @app.get("/dashboard/{path:path}")
    def dashboard_spa(path: str = "") -> FileResponse:
        return FileResponse(_DASHBOARD_DIST / "index.html")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("api_server:app", host="127.0.0.1", port=8787, reload=True)
