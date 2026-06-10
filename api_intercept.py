"""Map APE pipeline output to friendly v1 intercept response."""

from __future__ import annotations

import time
import uuid
from typing import Any

from api_store import add_audit_entry, get_financial_health, save_purchase

STATUS_MAP = {
    "protection_on": "protection_on",
    "review_needed": "review_needed",
    "savings_found": "savings_found",
    "high_risk": "high_risk",
}


def _billing_from_cart(cart: dict[str, Any], payload: dict[str, Any]) -> str:
    if payload.get("billing_cycle"):
        return payload["billing_cycle"]
    text = (cart.get("raw_dom_text") or "").lower()
    if "/yr" in text or "annual" in text or "year" in text:
        return "yearly"
    if "month" in text:
        return "monthly"
    return "unknown"


def _price_dollars(cart: dict[str, Any], payload: dict[str, Any]) -> float:
    if payload.get("price") is not None:
        return float(payload["price"])
    cents = cart.get("amount_cents") or 0
    billing = _billing_from_cart(cart, payload)
    if billing == "yearly" and cents > 50000:
        return round(cents / 100, 2)
    if billing == "monthly":
        return round(cents / 100, 2) if cents < 500000 else round(cents / 100 / 12, 2)
    return round(cents / 100, 2) if cents else 96.0


def _product_name(cart: dict[str, Any], payload: dict[str, Any]) -> str:
    if payload.get("product_name"):
        return payload["product_name"]
    items = cart.get("line_items") or []
    if items:
        return items[0].get("name", "Software purchase")
    merchant = cart.get("merchant") or payload.get("merchant") or "Purchase"
    return f"{merchant} plan"


def _derive_status(is_flagged: bool, premium: float, budget_pct: float) -> str:
    if budget_pct > 100:
        return "high_risk"
    if premium >= 10:
        return "savings_found"
    if is_flagged:
        return "review_needed"
    return "protection_on"


def _demo_alternative(product: str, price: float, premium: float) -> dict[str, Any]:
    if "notion" in product.lower():
        alt_price = 77.0
        return {
            "name": "ClickUp Business",
            "price": alt_price,
            "billing_cycle": "monthly",
            "reason": "Similar features at a lower cost",
            "estimated_monthly_savings": max(0, round(price - alt_price, 2)),
            "features": ["Tasks & docs", "Team collaboration", "Integrations"],
        }
    if "github" in product.lower():
        alt_price = round(price * 0.78, 2)
        return {
            "name": "GitLab Premium",
            "price": alt_price,
            "billing_cycle": "monthly",
            "reason": "Comparable dev tooling at lower volume pricing",
            "estimated_monthly_savings": max(0, round(price - alt_price, 2)),
            "features": ["CI/CD", "Issue tracking", "Security scanning"],
        }
    savings = max(19, round(price * (premium / 100) if premium else 0.2 * price))
    alt_price = max(1, round(price - savings, 2))
    return {
        "name": "TaskFlow",
        "price": alt_price,
        "billing_cycle": "monthly",
        "reason": "Similar features at a lower cost",
        "estimated_monthly_savings": savings,
        "features": ["Core workflows", "Team seats", "Reports"],
    }


def payload_to_cart(body: dict[str, Any]) -> dict[str, Any]:
    """Normalize v1 intercept body to internal cart format."""
    price = body.get("price")
    billing = body.get("billing_cycle", "unknown")
    amount_cents = None
    if price is not None:
        amount_cents = int(round(float(price) * 100))
        if billing == "yearly":
            amount_cents = int(round(float(price) * 100))

    raw = body.get("description") or body.get("raw_dom_text") or ""
    if not raw and body.get("product_name"):
        raw = f"{body['product_name']} | Total: ${price}"

    return {
        "merchant": body.get("merchant") or "Unknown",
        "raw_dom_text": raw or f"Product: {body.get('product_name', 'Purchase')} Total: ${price or 0}",
        "amount_cents": amount_cents or body.get("amount_cents"),
        "currency": "usd",
        "department": body.get("department", "Software"),
        "used_card_id": body.get("used_card_id", "ic_extension_card"),
        "category": body.get("category", "software"),
        "page_url": body.get("url") or body.get("page_url", ""),
        "line_items": body.get("line_items"),
        "_v1_payload": body,
    }


def build_intercept_response(
    pipeline: dict[str, Any],
    v1_payload: dict[str, Any],
    elapsed_ms: int = 0,
) -> dict[str, Any]:
    cart = pipeline.get("cart", {})
    audit = pipeline.get("audit", {})
    signals = audit.get("signals", {})
    financials = get_financial_health()

    product = _product_name(cart, v1_payload)
    price = _price_dollars(cart, v1_payload)
    billing = _billing_from_cart(cart, v1_payload)
    premium = signals.get("market_premium_percent", 0)
    budget_pct = signals.get("department_projected_utilization_percent", financials["budget_used"])
    is_flagged = audit.get("is_flagged", False)

    best_alt = _demo_alternative(product, price, premium)
    monthly_save = best_alt.get("estimated_monthly_savings", 0)
    if billing == "yearly" and monthly_save > 100:
        monthly_save = round(monthly_save / 12, 2)

    status = _derive_status(is_flagged, premium, budget_pct)
    if monthly_save >= 15 and status in ("protection_on", "review_needed"):
        status = "savings_found"

    purchase_id = f"pur_{uuid.uuid4().hex[:10]}"
    pending_auth_id = pipeline.get("pending_auth_id")

    audit_steps = [
        {"step": "read_checkout", "label": "Read checkout details", "status": "done", "ms": max(40, elapsed_ms // 5)},
        {"step": "exa_query", "label": "Created market search query", "status": "done", "ms": max(80, elapsed_ms // 4), "result": pipeline.get("exa_query", "")[:80]},
        {"step": "exa_scan", "label": "Found market alternatives", "status": "done", "ms": max(120, elapsed_ms // 3)},
        {"step": "budget_check", "label": "Checked budget and company rules", "status": "done", "ms": max(90, elapsed_ms // 4)},
        {"step": "stripe", "label": "Verified financial health", "status": "done", "ms": max(60, elapsed_ms // 6)},
        {"step": "recommend", "label": "Recommended next step", "status": "done", "ms": max(50, elapsed_ms // 8)},
    ]

    friendly_summaries = [
        "Detected this purchase from the checkout page.",
        "Compared pricing against similar tools.",
    ]
    if monthly_save > 0:
        friendly_summaries.append("Found a lower-cost option with similar features.")
    if budget_pct > 100:
        friendly_summaries.append("This purchase may exceed your software budget.")
    else:
        friendly_summaries.append("Checked your current budget impact.")
    if premium >= 10:
        friendly_summaries.append(f"Detected purchase is about {int(premium)}% above comparable tools.")
    duplicates = signals.get("stack_duplicates", [])
    if duplicates:
        friendly_summaries.append(
            f"Found {len(duplicates)} existing tool(s) with overlapping features."
        )

    question = audit.get("missing_context_question") or (
        "Why do you need this specific option instead of the recommended alternative?"
    )

    response = {
        "purchase_id": purchase_id,
        "pending_auth_id": pending_auth_id,
        "status": status,
        "is_flagged": is_flagged,
        "purchase": {
            "merchant": cart.get("merchant") or v1_payload.get("merchant", "Unknown"),
            "product_name": product,
            "price": price,
            "billing_cycle": billing,
            "quantity": v1_payload.get("quantity", 1),
        },
        "savings": {
            "estimated_monthly_savings": monthly_save,
            "estimated_annual_savings": round(monthly_save * 12, 2),
        },
        "best_alternative": {
            "name": best_alt["name"],
            "price": best_alt["price"],
            "billing_cycle": best_alt.get("billing_cycle", billing),
            "reason": best_alt["reason"],
        },
        "alternatives": [
            best_alt,
            {
                "name": "Linear Pro",
                "price": round(price * 0.85, 2),
                "billing_cycle": billing,
                "reason": "Lighter workflow tool",
                "estimated_monthly_savings": round(price * 0.15, 2),
                "features": ["Issues", "Roadmaps"],
                "badge": "Good fit",
            },
        ],
        "financial_health": {
            "cash_flow_status": financials["cash_flow_status"],
            "cash_on_hand": financials["cash_on_hand"],
            "monthly_burn": financials["monthly_burn"],
            "runway_months": financials["runway_months"],
            "budget_used": int(budget_pct) if budget_pct else financials["budget_used"],
            "budget_limit": financials["budget_limit"],
            "budget_spent": financials["budget_spent"],
            "fits_budget": budget_pct <= 100,
        },
        "audit_summary": friendly_summaries,
        "audit_timeline": audit_steps,
        "question": question,
    }

    save_purchase(
        {
            "purchase_id": purchase_id,
            "vendor": response["purchase"]["merchant"],
            "name": product,
            "price": price,
            "billing_cycle": billing,
            "status": status,
            "savings": 0,
            "potential_savings": response["savings"]["estimated_annual_savings"],
            "date": time.strftime("%Y-%m-%d"),
            "pending_auth_id": pending_auth_id,
            "justification": "",
            "full_response": response,
        }
    )
    add_audit_entry(
        {
            "purchase_id": purchase_id,
            "event": "intercept",
            "status": status,
            "summary": friendly_summaries[0],
            "timeline": audit_steps,
        }
    )
    return response
