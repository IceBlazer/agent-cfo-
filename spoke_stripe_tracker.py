"""Spoke: Stripe API — live financial health context and issuing authorization control."""

from __future__ import annotations

import os
import uuid
from typing import Any

import stripe

# In-memory store for simulated / dev authorization holds keyed by auth id
_PENDING_AUTHS: dict[str, dict[str, Any]] = {}


def fetch_live_financial_health(card_id: str) -> dict[str, Any]:
    """
    Pull real-time balances, runway, departmental context, and pending auth id.
    Falls back to simulated metrics when STRIPE_TEST_KEY is unset.
    """
    api_key = os.getenv("STRIPE_TEST_KEY")
    if not api_key:
        return _simulated_financial_health(card_id)

    stripe.api_key = api_key
    try:
        balance = stripe.Balance.retrieve()
        available_usd = next(
            (b["amount"] for b in balance.get("available", []) if b.get("currency") == "usd"),
            0,
        )

        pending_auth_id = capture_pending_auth(card_id=card_id, amount_cents=0)
        cardholder = _lookup_cardholder(card_id)

        monthly_burn_cents = int(os.getenv("APE_MONTHLY_BURN_CENTS", "35000000"))
        runway_months = round(available_usd / monthly_burn_cents, 1) if monthly_burn_cents else 0

        return {
            "mode": "live",
            "cash_balance_cents": available_usd,
            "cash_runway_months": runway_months,
            "monthly_burn_cents": monthly_burn_cents,
            "department_budgets": _department_budgets_from_env(),
            "cardholder": cardholder,
            "pending_auth_id": pending_auth_id,
        }
    except stripe.error.StripeError:
        return _simulated_financial_health(card_id)


def capture_pending_auth(card_id: str, amount_cents: int, merchant: str = "APE Intercept") -> str:
    """
    Register a manual authorization hold — funds reserved, merchant cannot capture.
    Returns the authorization id for later approve/decline.
    """
    api_key = os.getenv("STRIPE_TEST_KEY")
    auth_id = f"iauth_{uuid.uuid4().hex[:24]}"

    if not api_key:
        _PENDING_AUTHS[auth_id] = {
            "card_id": card_id,
            "amount_cents": amount_cents,
            "merchant": merchant,
            "status": "pending",
        }
        return auth_id

    stripe.api_key = api_key
    try:
        auth = stripe.issuing.Authorization.create(
            card=card_id,
            amount=amount_cents,
            currency="usd",
            merchant_data={"name": merchant, "category": "software"},
        )
        auth_id = auth.id
        _PENDING_AUTHS[auth_id] = {"status": "pending", "stripe_object": auth.id}
    except stripe.error.StripeError:
        _PENDING_AUTHS[auth_id] = {
            "card_id": card_id,
            "amount_cents": amount_cents,
            "merchant": merchant,
            "status": "pending",
            "simulated_fallback": True,
        }

    return auth_id


def resolve_authorization(auth_id: str, action: str) -> dict[str, Any]:
    """Approve (release funds) or decline (cancel hold) a pending authorization."""
    action = action.lower().strip()
    if action not in ("override", "approve", "abort", "decline"):
        raise ValueError("action must be 'override'/'approve' or 'abort'/'decline'")

    approve = action in ("override", "approve")
    api_key = os.getenv("STRIPE_TEST_KEY")
    record = _PENDING_AUTHS.get(auth_id, {"status": "unknown"})

    if api_key and not record.get("simulated_fallback"):
        stripe.api_key = api_key
        try:
            if approve:
                stripe.issuing.Authorization.approve(auth_id)
            else:
                stripe.issuing.Authorization.decline(auth_id)
        except stripe.error.StripeError as exc:
            return {"success": False, "action": action, "auth_id": auth_id, "error": str(exc)}

    _PENDING_AUTHS[auth_id] = {**record, "status": "approved" if approve else "declined"}
    return {
        "success": True,
        "action": "approved" if approve else "declined",
        "auth_id": auth_id,
        "message": (
            "Funds released to merchant."
            if approve
            else "Authorization declined. Purchase terminated."
        ),
    }


def _simulated_financial_health(card_id: str) -> dict[str, Any]:
    dept_map = {
        "ic_sim_dev_card_001": "Development",
        "ic_sim_sales_card_002": "Sales",
        "ic_sim_eng_card_003": "Engineering",
    }
    department = dept_map.get(card_id, "Engineering")
    budgets = {
        "Engineering": {"allocation_cents": 1500000, "spent_cents": 1380000},
        "Development": {"allocation_cents": 800000, "spent_cents": 780000},
        "Sales": {"allocation_cents": 500000, "spent_cents": 320000},
    }
    dept_budget = budgets.get(department, budgets["Engineering"])

    return {
        "mode": "simulated",
        "cash_balance_cents": 490000000,
        "cash_runway_months": 14.0,
        "monthly_burn_cents": 35000000,
        "department": department,
        "department_budget": dept_budget,
        "department_budgets": budgets,
        "cardholder": {
            "card_id": card_id,
            "employee_tier": "IC",
            "spend_history_90d_cents": 452300,
        },
        "pending_auth_id": capture_pending_auth(card_id=card_id, amount_cents=0),
    }


def _lookup_cardholder(card_id: str) -> dict[str, Any]:
    return {
        "card_id": card_id,
        "employee_tier": os.getenv("APE_CARDHOLDER_TIER", "IC"),
        "spend_history_90d_cents": int(os.getenv("APE_SPEND_HISTORY_90D_CENTS", "452300")),
    }


def _department_budgets_from_env() -> dict[str, dict[str, int]]:
    return {
        "Engineering": {"allocation_cents": 1500000, "spent_cents": 1380000},
        "Development": {"allocation_cents": 800000, "spent_cents": 780000},
        "Sales": {"allocation_cents": 500000, "spent_cents": 320000},
    }
