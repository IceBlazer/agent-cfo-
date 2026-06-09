"""
FastAPI hub for the Chrome extension.
Exposes the same orchestration pipeline as main.py over HTTP.
"""

from __future__ import annotations

import os
from typing import Any, Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from spoke_cards import get_company_dna
from spoke_extension import normalize_extension_payload
from spoke_intelligence import run_cfo_auditor, run_search_strategist
from spoke_market import execute_exa_instant_scan
from spoke_stripe_tracker import capture_pending_auth, fetch_live_financial_health, resolve_authorization

app = FastAPI(title="AgentCFO APE Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PROFILE_ID = os.getenv("APE_COMPANY_PROFILE", "standard_b2b_startup")


class AuditRequest(BaseModel):
    raw_dom_text: str = Field(..., description="Raw checkout DOM text from the extension")
    merchant: str | None = None
    amount_cents: int | None = None
    currency: str = "usd"
    department: str = "Engineering"
    used_card_id: str = "ic_extension_card"
    category: str = "software"
    line_items: list[dict[str, Any]] | None = None
    page_url: str = ""


class ResolveRequest(BaseModel):
    auth_id: str
    action: Literal["override", "abort"]
    justification: str = ""


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "agentcfo-ape"}


@app.post("/api/audit")
def run_audit(request: AuditRequest) -> dict[str, Any]:
    """Full APE pipeline: intercept → DNA → Stripe → Exa → CFO Auditor."""
    cart_data = normalize_extension_payload(request.model_dump())

    company_dna = get_company_dna(profile_id=PROFILE_ID)
    stripe_health = fetch_live_financial_health(card_id=cart_data["used_card_id"])

    pending_auth_id = capture_pending_auth(
        card_id=cart_data["used_card_id"],
        amount_cents=cart_data["amount_cents"],
        merchant=cart_data["merchant"],
    )
    stripe_health["pending_auth_id"] = pending_auth_id

    exa_query = run_search_strategist(raw_cart=cart_data, api_key=os.getenv("OPENAI_API_KEY"))
    market_benchmarks = execute_exa_instant_scan(query=exa_query, api_key=os.getenv("EXA_API_KEY"))

    audit_decision = run_cfo_auditor(
        cart=cart_data,
        market_data=market_benchmarks,
        company_rules=company_dna,
        financials=stripe_health,
        api_key=os.getenv("OPENAI_API_KEY"),
    )

    return {
        "cart": cart_data,
        "exa_query": exa_query,
        "pending_auth_id": pending_auth_id,
        "audit": audit_decision,
    }


@app.post("/api/resolve")
def resolve_transaction(request: ResolveRequest) -> dict[str, Any]:
    """User clicked Override or Cancel on the hard-wall — approve/decline Stripe auth."""
    if request.action == "override" and not request.justification.strip():
        raise HTTPException(status_code=400, detail="Justification required for override.")

    result = resolve_authorization(auth_id=request.auth_id, action=request.action)
    result["justification"] = request.justification
    return result


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("api_server:app", host="127.0.0.1", port=8787, reload=True)
