import os
import sys

import stripe

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# ---------------------------------------------------------
# 1. Spoke Imports (The Hub & Spoke Architecture)
# ---------------------------------------------------------
# Simulated Data Hubs
from spoke_extension import intercept_checkout_dom
from spoke_cards import get_company_dna
from spoke_stripe_tracker import fetch_live_financial_health, capture_pending_auth, resolve_authorization

# External API Execution Hubs
from spoke_market import execute_exa_instant_scan
from spoke_intelligence import run_search_strategist, run_cfo_auditor

# ---------------------------------------------------------
# 2. Global Configurations
# ---------------------------------------------------------
stripe.api_key = os.getenv("STRIPE_TEST_KEY")
EXA_API_KEY = os.getenv("EXA_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# ---------------------------------------------------------
# 3. Main Orchestration Loop
# ---------------------------------------------------------
def main():
    print("Initiating Autonomous Procurement Engine (APE)...")

    # =========================================================
    # PHASE 1: Interception & Context Gathering
    # =========================================================

    # 1. Triggered by extension: Pull simulated cart data from the browser DOM
    cart_data = intercept_checkout_dom(scenario="overpriced_saas")
    print(f"Intercepted transaction at {cart_data['merchant']} for {cart_data['amount_cents']} cents.")

    # 2. Pull the company's baseline rules and active software stack
    company_dna = get_company_dna(profile_id="standard_b2b_startup")

    # 3. Pull live cash balances and the pending Stripe Authorization ID
    stripe_health = fetch_live_financial_health(card_id=cart_data["used_card_id"])

    pending_stripe_auth_id = capture_pending_auth(
        card_id=cart_data["used_card_id"],
        amount_cents=cart_data["amount_cents"],
        merchant=cart_data["merchant"],
    )
    stripe_health["pending_auth_id"] = pending_stripe_auth_id

    # =========================================================
    # PHASE 2: Market Intelligence Pipeline
    # =========================================================

    # 4. Agent 1: Convert raw DOM text into an optimized Exa query
    exa_query = run_search_strategist(
        raw_cart=cart_data,
        api_key=OPENAI_API_KEY,
    )
    print(f"Search Strategist formulated query: {exa_query}")

    # 5. Exa API: Scour the web for real-time pricing tiers (sub-180ms)
    market_benchmarks = execute_exa_instant_scan(
        query=exa_query,
        api_key=EXA_API_KEY,
    )

    # =========================================================
    # PHASE 3: The CFO Audit & Enforcement
    # =========================================================

    # 6. Agent 2: Cross-examine all data points to determine fiscal alignment
    audit_decision = run_cfo_auditor(
        cart=cart_data,
        market_data=market_benchmarks,
        company_rules=company_dna,
        financials=stripe_health,
        api_key=OPENAI_API_KEY,
    )

    # 7. Render the decision to the user via the Extension UI
    print("\n--- HARD-WALL UI RENDERED ---")
    print(f"Flagged: {audit_decision['is_flagged']}")
    print(f"Analysis: {audit_decision['concise_analysis']}")
    print(f"User Prompt: {audit_decision['missing_context_question']}")
    print("-------------------------------\n")

    # =========================================================
    # PHASE 4: Stripe Transaction Resolution
    # =========================================================

    # 8. Simulate waiting for the user's click on the browser extension modal
    # In production, this would be an async webhook listener
    user_action = input("User Action (Type 'override' to approve, 'abort' to cancel): ").strip().lower()

    if user_action == "override":
        # User justified the expense -> Tell Stripe to release funds to the merchant
        result = resolve_authorization(pending_stripe_auth_id, "override")
        print(f"Stripe Action: Authorization APPROVED. {result['message']}")
    else:
        # User canceled the expense -> Tell Stripe to wipe the hold
        result = resolve_authorization(pending_stripe_auth_id, "abort")
        print(f"Stripe Action: Authorization DECLINED. {result['message']}")


if __name__ == "__main__":
    main()
