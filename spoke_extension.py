"""Spoke: Browser Extension — intercepts checkout DOM and normalizes cart payloads."""

from __future__ import annotations

import re
from typing import Any

# Simulated checkout scenarios for CLI / offline demo
SIMULATED_SCENARIOS: dict[str, dict[str, Any]] = {
    "overpriced_saas": {
        "merchant": "GitHub Inc.",
        "raw_dom_text": (
            "Item: 10x GitHub Enterprise Seats - Price: $2,100/yr "
            "($210/seat/year) | Subtotal: $2,100.00 | Tax: $168.00 | Total: $2,268.00"
        ),
        "line_items": [
            {
                "name": "GitHub Enterprise Seats",
                "quantity": 10,
                "unit_price_cents": 21000,
                "billing_period": "annual",
            }
        ],
        "amount_cents": 226800,
        "currency": "usd",
        "department": "Development",
        "used_card_id": "ic_sim_dev_card_001",
        "category": "developer_tools",
    },
    "duplicate_collaboration": {
        "merchant": "Zoom Video Communications",
        "raw_dom_text": (
            "Zoom Business - 5 Licenses | $19.99/user/month | "
            "Annual billing: $1,199.40 | Total due today: $1,199.40"
        ),
        "line_items": [
            {
                "name": "Zoom Business License",
                "quantity": 5,
                "unit_price_cents": 1999,
                "billing_period": "monthly",
            }
        ],
        "amount_cents": 119940,
        "currency": "usd",
        "department": "Sales",
        "used_card_id": "ic_sim_sales_card_002",
        "category": "collaboration",
    },
    "clean_purchase": {
        "merchant": "Linear",
        "raw_dom_text": "Linear Pro - 2 seats | $8.00/seat/month | Total: $16.00/month",
        "line_items": [
            {
                "name": "Linear Pro Seat",
                "quantity": 2,
                "unit_price_cents": 800,
                "billing_period": "monthly",
            }
        ],
        "amount_cents": 1600,
        "currency": "usd",
        "department": "Engineering",
        "used_card_id": "ic_sim_eng_card_003",
        "category": "project_management",
    },
}


def intercept_checkout_dom(scenario: str = "overpriced_saas") -> dict[str, Any]:
    """Pull cart data — simulated for CLI; extension POSTs equivalent JSON to /api/audit."""
    if scenario not in SIMULATED_SCENARIOS:
        raise ValueError(f"Unknown scenario '{scenario}'. Choose from: {list(SIMULATED_SCENARIOS)}")
    return dict(SIMULATED_SCENARIOS[scenario])


def normalize_extension_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Normalize raw DOM payload from the Chrome extension into audit-ready cart data."""
    raw_text = payload.get("raw_dom_text", "")
    line_items = payload.get("line_items") or _parse_line_items_from_dom(raw_text)

    amount_cents = payload.get("amount_cents")
    if amount_cents is None:
        amount_cents = _extract_total_cents(raw_text)

    return {
        "merchant": payload.get("merchant") or _guess_merchant(raw_text),
        "raw_dom_text": raw_text,
        "line_items": line_items,
        "amount_cents": int(amount_cents or 0),
        "currency": (payload.get("currency") or "usd").lower(),
        "department": payload.get("department") or "Engineering",
        "used_card_id": payload.get("used_card_id") or "ic_extension_card",
        "category": payload.get("category") or "software",
        "page_url": payload.get("page_url", ""),
    }


def _parse_line_items_from_dom(raw_text: str) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    qty_match = re.search(r"(\d+)\s*x\s+(.+?)\s*-\s*Price", raw_text, re.I)
    if qty_match:
        price_match = re.search(r"\$[\d,]+(?:\.\d{2})?", raw_text)
        unit_cents = _dollars_to_cents(price_match.group(0)) if price_match else 0
        items.append(
            {
                "name": qty_match.group(2).strip(),
                "quantity": int(qty_match.group(1)),
                "unit_price_cents": unit_cents,
                "billing_period": "annual" if "/yr" in raw_text.lower() else "monthly",
            }
        )
    return items


def _extract_total_cents(raw_text: str) -> int:
    for pattern in (r"Total[:\s]*\$?([\d,]+(?:\.\d{2})?)", r"\$([\d,]+(?:\.\d{2})?)\s*$"):
        match = re.search(pattern, raw_text, re.I)
        if match:
            return _dollars_to_cents(match.group(1))
    return 0


def _guess_merchant(raw_text: str) -> str:
    first_line = raw_text.split("|")[0].strip()
    return first_line[:80] if first_line else "Unknown Merchant"


def _dollars_to_cents(value: str) -> int:
    cleaned = value.replace("$", "").replace(",", "").strip()
    return int(round(float(cleaned) * 100))
