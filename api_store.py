"""In-memory store — extension actions sync to dashboard (demo + live)."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

# Demo baseline metrics
DEMO_SUMMARY = {
    "saved_this_month": 1247,
    "purchases_reviewed": 8,
    "upcoming_renewals": 3,
    "potential_savings": 1247,
    "active_reviews": 1,
    "budget_health_percent": 62,
    "month_spend": 1250,
    "protection_on": True,
    "user_name": "Alex",
}

DEMO_FINANCIAL = {
    "cash_flow_status": "Good",
    "cash_on_hand": 28450,
    "monthly_burn": 3470,
    "runway_months": 8.2,
    "budget_used": 62,
    "budget_limit": 2000,
    "budget_spent": 1250,
    "departments": {
        "Marketing": {"spent": 420, "limit": 800},
        "Software": {"spent": 1250, "limit": 2000},
        "Operations": {"spent": 310, "limit": 600},
    },
}

DEMO_RECENT = [
    {
        "id": "pur_slack",
        "vendor": "Slack",
        "name": "Slack Business+",
        "price": 150,
        "billing_cycle": "monthly",
        "status": "continued_with_justification",
        "savings": 0,
        "potential_savings": 0,
        "date": "2026-06-07",
    },
    {
        "id": "pur_notion",
        "vendor": "Notion",
        "name": "Notion Team Plan",
        "price": 96,
        "billing_cycle": "monthly",
        "status": "savings_found",
        "savings": 0,
        "potential_savings": 228,
        "date": "2026-06-05",
    },
    {
        "id": "pur_adobe",
        "vendor": "Adobe",
        "name": "Adobe Creative Cloud",
        "price": 55,
        "billing_cycle": "monthly",
        "status": "canceled",
        "savings": 55,
        "potential_savings": 0,
        "date": "2026-06-02",
    },
    {
        "id": "pur_semrush",
        "vendor": "SEMrush",
        "name": "SEMrush Pro",
        "price": 120,
        "billing_cycle": "monthly",
        "status": "review_needed",
        "savings": 0,
        "potential_savings": 40,
        "date": "2026-06-01",
    },
]

DEMO_ACTIONS = [
    {
        "task_id": "task_review",
        "icon": "clipboard",
        "title": "Review pending purchase approval",
        "description": "Notion Team Plan needs your decision",
        "badge": "Action needed",
        "purchase_id": "pur_notion",
    },
    {
        "task_id": "task_budget",
        "icon": "chart",
        "title": "Update Q2 marketing budget",
        "description": "Marketing is at 52% of monthly cap",
        "badge": "Soon",
    },
    {
        "task_id": "task_renewals",
        "icon": "calendar",
        "title": "Check expiring subscriptions",
        "description": "3 renewals in the next 14 days",
        "badge": "3 due",
    },
    {
        "task_id": "task_canva",
        "icon": "renewal",
        "title": "Canva Pro renewal",
        "description": "Renews Jun 18 — consider negotiating",
        "badge": "Renewal",
    },
    {
        "task_id": "task_workspace",
        "icon": "renewal",
        "title": "Google Workspace renewal",
        "description": "Renews Jun 22",
        "badge": "Renewal",
    },
    {
        "task_id": "task_zoom",
        "icon": "renewal",
        "title": "Zoom Pro renewal",
        "description": "Renews Jun 25",
        "badge": "Renewal",
    },
    {
        "task_id": "task_dupes",
        "icon": "layers",
        "title": "Consolidate duplicate licenses",
        "description": "2 tools overlap with existing subscriptions",
        "badge": "Save money",
    },
    {
        "task_id": "task_audit",
        "icon": "search",
        "title": "Run unused subscription audit",
        "description": "Find tools nobody has logged into lately",
        "badge": "Recommended",
    },
]

_purchases: dict[str, dict[str, Any]] = {}
_audit_log: list[dict[str, Any]] = []
_tasks: list[dict[str, Any]] = list(DEMO_ACTIONS)
_initialized = False


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def init_store() -> None:
    global _initialized
    if _initialized:
        return
    for p in DEMO_RECENT:
        _purchases[p["id"]] = {**p, "purchase_id": p["id"]}
    _initialized = True


def new_purchase_id() -> str:
    return f"pur_{uuid.uuid4().hex[:10]}"


def save_purchase(record: dict[str, Any]) -> dict[str, Any]:
    init_store()
    pid = record.get("purchase_id") or new_purchase_id()
    record["purchase_id"] = pid
    record["updated_at"] = _now_iso()
    _purchases[pid] = record
    return record


def get_purchase(purchase_id: str) -> dict[str, Any] | None:
    init_store()
    return _purchases.get(purchase_id)


def update_purchase_status(purchase_id: str, status: str, **extra: Any) -> dict[str, Any] | None:
    init_store()
    rec = _purchases.get(purchase_id)
    if not rec:
        return None
    rec["status"] = status
    rec.update(extra)
    rec["updated_at"] = _now_iso()
    return rec


def add_audit_entry(entry: dict[str, Any]) -> dict[str, Any]:
    init_store()
    entry.setdefault("id", f"log_{uuid.uuid4().hex[:8]}")
    entry.setdefault("timestamp", _now_iso())
    _audit_log.insert(0, entry)
    return entry


def get_audit_log(limit: int = 50) -> list[dict[str, Any]]:
    init_store()
    return _audit_log[:limit]


def get_recent_purchases(limit: int = 20) -> list[dict[str, Any]]:
    init_store()
    items = sorted(_purchases.values(), key=lambda x: x.get("date", ""), reverse=True)
    return items[:limit]


def get_summary() -> dict[str, Any]:
    init_store()
    active = sum(1 for p in _purchases.values() if p.get("status") in ("review_needed", "savings_found", "high_risk"))
    saved = sum(p.get("savings", 0) for p in _purchases.values()) + DEMO_SUMMARY["saved_this_month"]
    potential = sum(p.get("potential_savings", 0) for p in _purchases.values())
    return {
        **DEMO_SUMMARY,
        "saved_this_month": saved,
        "active_reviews": max(active, DEMO_SUMMARY["active_reviews"]),
        "potential_savings": max(potential, DEMO_SUMMARY["potential_savings"]),
        "onboarding": (
            "AgentCFO works in two ways: the extension helps you before you buy, "
            "and the dashboard shows your savings, budget health, and next steps."
        ),
    }


def get_financial_health() -> dict[str, Any]:
    init_store()
    return dict(DEMO_FINANCIAL)


def get_actions() -> list[dict[str, Any]]:
    init_store()
    return list(_tasks)


def add_task(task: dict[str, Any]) -> dict[str, Any]:
    init_store()
    task.setdefault("task_id", f"task_{uuid.uuid4().hex[:8]}")
    _tasks.insert(0, task)
    return task
