"""Spoke: Precollected Company Data — Mission Hub, Stack Registry, Policy Spoke."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

_PROFILES_DIR = Path(__file__).parent / "data" / "company_profiles"


def get_company_dna(profile_id: str = "standard_b2b_startup") -> dict[str, Any]:
    """Load precollected corporate rules: mission, stack registry, and expense policies."""
    profile_path = _PROFILES_DIR / f"{profile_id}.json"
    if not profile_path.exists():
        raise FileNotFoundError(f"Company profile not found: {profile_id}")

    with profile_path.open(encoding="utf-8") as f:
        profile = json.load(f)

    return {
        "profile_id": profile["profile_id"],
        "mission_hub": profile["mission_hub"],
        "stack_registry": profile["stack_registry"],
        "policy_spoke": profile["policy_spoke"],
    }


def detect_stack_duplicates(cart: dict[str, Any], company_dna: dict[str, Any]) -> list[dict[str, Any]]:
    """Flag line items that overlap with existing Stack Registry subscriptions."""
    cart_category = cart.get("category", "").lower()
    cart_names = " ".join(item.get("name", "") for item in cart.get("line_items", [])).lower()
    duplicates: list[dict[str, Any]] = []

    for sub in company_dna["stack_registry"]["active_subscriptions"]:
        tool_lower = sub["tool"].lower()
        category_match = sub.get("category", "").lower() == cart_category
        name_match = any(token in cart_names for token in tool_lower.split() if len(token) > 3)

        if category_match or name_match:
            unused = sub["seats_total"] - sub["seats_used"]
            if unused > 0 or category_match:
                duplicates.append(
                    {
                        "existing_tool": sub["tool"],
                        "unused_seats": unused,
                        "category": sub.get("category"),
                    }
                )
    return duplicates


def evaluate_policy_violations(
    cart: dict[str, Any], company_dna: dict[str, Any]
) -> list[dict[str, Any]]:
    """Check cart against predefined expense policies."""
    violations: list[dict[str, Any]] = []
    policies = company_dna["policy_spoke"]["expense_policies"]
    dept = cart.get("department", "Engineering")
    budgets = company_dna["policy_spoke"]["department_budgets"]

    for policy in policies:
        if policy.get("unit") == "per_seat_monthly":
            threshold = policy.get("threshold_cents", 0)
            for item in cart.get("line_items", []):
                monthly_cents = item.get("unit_price_cents", 0)
                if item.get("billing_period") == "annual":
                    monthly_cents = monthly_cents // 12
                if monthly_cents > threshold:
                    violations.append(
                        {
                            "rule_id": policy["rule_id"],
                            "description": policy["description"],
                            "detail": f"{item['name']} at ${monthly_cents / 100:.2f}/mo exceeds threshold.",
                        }
                    )

        if policy.get("unit") == "department_budget" and dept in budgets:
            budget = budgets[dept]
            projected = budget["spent_cents"] + cart.get("amount_cents", 0)
            pct = (projected / budget["allocation_cents"]) * 100 if budget["allocation_cents"] else 0
            if pct > policy.get("threshold_percent", 100):
                violations.append(
                    {
                        "rule_id": policy["rule_id"],
                        "description": policy["description"],
                        "detail": (
                            f"{dept} budget would reach {pct:.0f}% "
                            f"(${projected / 100:,.2f} of ${budget['allocation_cents'] / 100:,.2f})."
                        ),
                    }
                )

    return violations
