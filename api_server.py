"""
FastAPI hub for the Chrome extension (thin client).
All intelligence runs here — extension only scrapes DOM and renders UI.
"""

from __future__ import annotations

import os
import re
from typing import Any, Literal

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from spoke_cards import get_company_dna
from spoke_extension import normalize_extension_payload
from spoke_intelligence import run_cfo_auditor, run_search_strategist
from spoke_market import execute_exa_instant_scan
from spoke_stripe_tracker import capture_pending_auth, fetch_live_financial_health, resolve_authorization

app = FastAPI(title="AgentCFO APE Backend", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PROFILE_ID = os.getenv("APE_COMPANY_PROFILE", "standard_b2b_startup")


class InterceptRequest(BaseModel):
    raw_dom_text: str = Field(..., description="Sanitized checkout DOM text from extension")
    merchant: str | None = None
    amount_cents: int | None = None
    currency: str = "usd"
    department: str = "Engineering"
    used_card_id: str = "ic_extension_card"
    category: str = "software"
    line_items: list[dict[str, Any]] | None = None
    page_url: str = ""


class ResolveBody(BaseModel):
    auth_id: str
    justification: str = ""


def _parse_analysis_sections(concise_analysis: str | dict[str, Any]) -> dict[str, str]:
    if isinstance(concise_analysis, dict):
        return {
            "market": concise_analysis.get("market", ""),
            "financial": concise_analysis.get("financial", ""),
            "company": concise_analysis.get("company", ""),
        }

    sections = {"market": "", "financial": "", "company": ""}
    patterns = {
        "market": r"Market Intelligence \(Exa\):\s*(.+?)(?=Financial|Company|$)",
        "financial": r"Financial Health \(Stripe\):\s*(.+?)(?=Company|Market|$)",
        "company": r"Company Context \(Precollected DNA\):\s*(.+?)(?=Market|Financial|$)",
    }
    for key, pattern in patterns.items():
        match = re.search(pattern, concise_analysis, re.I | re.S)
        if match:
            sections[key] = match.group(1).strip()
    if not any(sections.values()):
        sections["market"] = concise_analysis[:500]
    return sections


def _cents_to_display(cents: int) -> str:
    return f"${cents / 100:,.0f}/mo" if cents else "—"


def _build_ui_capsules(
    audit: dict[str, Any],
    market_data: dict[str, Any],
    financials: dict[str, Any],
    company_dna: dict[str, Any],
    cart: dict[str, Any] | None = None,
) -> dict[str, dict[str, Any]]:
    signals = audit.get("signals", {})
    sections = _parse_analysis_sections(audit.get("concise_analysis", ""))
    premium = signals.get("market_premium_percent", market_data.get("summary", {}).get("estimated_premium_percent", 0))
    util = signals.get("department_projected_utilization_percent", 0)
    runway = signals.get("cash_runway_months", financials.get("cash_runway_months", 0))
    cart = cart or {}

    amount_cents = cart.get("amount_cents") or 0
    target_monthly = amount_cents // 12 if amount_cents > 10000 else amount_cents
    fair_monthly = int(target_monthly / (1 + premium / 100)) if premium else target_monthly
    efficiency_delta = -int(premium) if premium else 0

    dept = cart.get("department") or financials.get("department", "Team")
    budget_label = (
        f"{dept} Software Budget At Peak Capacity"
        if util > 90
        else f"{dept} Software Budget Utilization"
    )

    checklist: list[dict[str, str]] = []
    for dup in signals.get("stack_duplicates", []):
        checklist.append(
            {
                "text": f"Stack redundancy: {dup.get('unused_seats', 0)} unused {dup.get('existing_tool', 'tool')} licenses",
                "status": "warn",
            }
        )
    for v in signals.get("policy_violations", []):
        checklist.append({"text": v.get("detail") or v.get("description", "Policy check"), "status": "warn"})
    if not checklist:
        checklist.append({"text": "Mission alignment verified against sustainability charter", "status": "ok"})
        checklist.append({"text": "No duplicate tooling detected in Stack Registry", "status": "ok"})
        checklist.append({"text": "Expense policy thresholds within nominal range", "status": "ok"})

    return {
        "market": {
            "source": "Exa",
            "headline": "Market Benchmark Baseline",
            "label": "Market Intelligence (Exa API Data)",
            "metric_percent": premium,
            "target_display": _cents_to_display(target_monthly),
            "fair_rate_display": _cents_to_display(fair_monthly),
            "efficiency_delta": efficiency_delta,
            "body": sections["market"]
            or market_data.get("summary", {}).get("baseline_note", "Benchmark scan complete."),
        },
        "financial": {
            "source": "Stripe",
            "headline": "Stripe Corporate Ledger",
            "label": "Financial Health (Stripe API Data)",
            "metric_percent": util,
            "budget_fill_percent": min(int(util), 100),
            "budget_label": budget_label,
            "runway_months": runway,
            "body": sections["financial"]
            or f"Cash runway ~{runway} months; department utilization {util:.0f}%.",
        },
        "company": {
            "source": "DNA",
            "headline": "Corporate DNA Sync",
            "label": "Strategic Alignment (Precollected DNA Data)",
            "body": sections["company"] or company_dna["mission_hub"]["statement"],
            "checklist": checklist,
        },
    }


def _run_intercept_pipeline(cart_data: dict[str, Any]) -> dict[str, Any]:
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

    capsules = _build_ui_capsules(audit_decision, market_benchmarks, stripe_health, company_dna, cart_data)

    return {
        "cart": cart_data,
        "exa_query": exa_query,
        "pending_auth_id": pending_auth_id,
        "audit": {
            "is_flagged": audit_decision.get("is_flagged", False),
            "missing_context_question": audit_decision.get("missing_context_question", ""),
            "capsules": capsules,
            "signals": audit_decision.get("signals", {}),
        },
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "agentcfo-ape", "version": "1.1.0"}


@app.post("/api/v1/intercept")
def intercept_v1(request: InterceptRequest) -> dict[str, Any]:
    """Primary thin-client endpoint — full APE pipeline, UI-ready JSON."""
    cart_data = normalize_extension_payload(request.model_dump())
    return _run_intercept_pipeline(cart_data)


@app.post("/api/v1/resolve")
def resolve_v1(
    body: ResolveBody,
    action: Literal["approve", "decline"] = Query(..., description="approve or decline"),
) -> dict[str, Any]:
    """Finalize Stripe authorization after user decision."""
    bridge_action = "override" if action == "approve" else "abort"
    if action == "approve" and not body.justification.strip():
        raise HTTPException(status_code=400, detail="Justification required for approve.")

    result = resolve_authorization(auth_id=body.auth_id, action=bridge_action)
    result["justification"] = body.justification
    result["action"] = action
    return result


# Legacy routes (backward compatible)
class AuditRequest(InterceptRequest):
    pass


class ResolveRequest(BaseModel):
    auth_id: str
    action: Literal["override", "abort"]
    justification: str = ""


@app.post("/api/audit")
def run_audit(request: AuditRequest) -> dict[str, Any]:
    return _run_intercept_pipeline(normalize_extension_payload(request.model_dump()))


@app.post("/api/resolve")
def resolve_transaction(request: ResolveRequest) -> dict[str, Any]:
    if request.action == "override" and not request.justification.strip():
        raise HTTPException(status_code=400, detail="Justification required for override.")
    result = resolve_authorization(auth_id=request.auth_id, action=request.action)
    result["justification"] = request.justification
    return result


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("api_server:app", host="127.0.0.1", port=8787, reload=True)
