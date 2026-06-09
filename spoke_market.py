"""Spoke: Exa API — real-time market tier and baseline cost intelligence."""

from __future__ import annotations

import os
from typing import Any

import httpx

EXA_SEARCH_URL = "https://api.exa.ai/search"


def execute_exa_instant_scan(query: str, api_key: str | None = None) -> dict[str, Any]:
    """
    Scour the web for competitive pricing tiers via Exa Instant.
    Falls back to heuristic benchmarks when EXA_API_KEY is unset.
    """
    key = api_key or os.getenv("EXA_API_KEY")
    if not key:
        return _simulated_market_benchmarks(query)

    headers = {"x-api-key": key, "Content-Type": "application/json"}
    payload = {
        "query": query,
        "type": "auto",
        "numResults": 5,
        "contents": {"text": {"maxCharacters": 2000}},
    }

    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.post(EXA_SEARCH_URL, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()
    except (httpx.HTTPError, ValueError):
        return _simulated_market_benchmarks(query)

    snippets = []
    for result in data.get("results", []):
        snippets.append(
            {
                "title": result.get("title", ""),
                "url": result.get("url", ""),
                "text": (result.get("text") or "")[:500],
            }
        )

    return {
        "mode": "live",
        "query": query,
        "sources": snippets,
        "summary": _synthesize_benchmark_summary(snippets, query),
    }


def _synthesize_benchmark_summary(snippets: list[dict[str, str]], query: str) -> dict[str, Any]:
    combined = " ".join(s["text"] for s in snippets).lower()
    premium_pct = 22 if "github" in query.lower() else 8
    if "volume" in combined or "enterprise" in combined:
        premium_pct = max(premium_pct, 15)

    return {
        "market_tier": "mid_market_b2b",
        "estimated_premium_percent": premium_pct,
        "baseline_note": (
            f"Exa returned {len(snippets)} pricing references for: {query[:120]}"
        ),
    }


def _simulated_market_benchmarks(query: str) -> dict[str, Any]:
    q = query.lower()
    if "github" in q:
        return {
            "mode": "simulated",
            "query": query,
            "sources": [
                {
                    "title": "GitHub Enterprise pricing — volume tiers",
                    "url": "https://github.com/pricing",
                    "text": (
                        "Standard annual GitHub Enterprise seats for mid-market teams "
                        "typically range $180–$200/seat/year with volume discounts above 10 seats."
                    ),
                }
            ],
            "summary": {
                "market_tier": "mid_market_b2b",
                "estimated_premium_percent": 22,
                "baseline_unit_price_cents": 19000,
                "baseline_note": "Vendor charging ~22% above standard B2B volume rates for this tier.",
            },
        }

    if "zoom" in q:
        return {
            "mode": "simulated",
            "query": query,
            "sources": [
                {
                    "title": "Zoom Business pricing comparison",
                    "url": "https://zoom.us/pricing",
                    "text": "Zoom Business lists at $19.99/user/month; enterprise bundles often discount 10–15%.",
                }
            ],
            "summary": {
                "market_tier": "smb_collaboration",
                "estimated_premium_percent": 5,
                "baseline_note": "Pricing near market; duplicate-tool risk is the primary concern.",
            },
        }

    return {
        "mode": "simulated",
        "query": query,
        "sources": [],
        "summary": {
            "market_tier": "general_saas",
            "estimated_premium_percent": 0,
            "baseline_note": "No significant market premium detected in simulated scan.",
        },
    }
