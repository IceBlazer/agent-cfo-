import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeDollarSign, ClipboardList, Wallet, ShoppingBag } from "lucide-react";
import { api } from "../api/client";
import { MetricCard, StatusBadge } from "../components/UI";

export default function Home() {
  const [summary, setSummary] = useState(null);
  const [purchases, setPurchases] = useState([]);

  useEffect(() => {
    api.summary().then(setSummary).catch(() =>
      setSummary({
        user_name: "Alex",
        potential_savings: 1247,
        active_reviews: 1,
        budget_health_percent: 62,
        month_spend: 1250,
        onboarding:
          "AgentCFO works in two ways: the extension helps you before you buy, and the dashboard shows your savings, budget health, and next steps.",
      })
    );
    api.recentPurchases().then(setPurchases).catch(() => setPurchases([]));
  }, []);

  if (!summary) return <p className="text-muted">Loading…</p>;

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-bold">Good morning, {summary.user_name}!</h1>
        <p className="mt-2 max-w-2xl text-muted">
          AgentCFO is watching your purchases and helping you make smarter spending decisions.
        </p>
        <p className="mt-4 rounded-card border border-green-100 bg-white p-4 text-sm text-muted shadow-soft">
          {summary.onboarding}
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Potential Savings" value={`$${summary.potential_savings?.toLocaleString()}`} icon={BadgeDollarSign} tone="green" />
        <MetricCard title="Active Reviews" value={summary.active_reviews} icon={ClipboardList} />
        <MetricCard title="Budget Health" value={`${summary.budget_health_percent}%`} sub="Software budget used" icon={Wallet} tone="yellow" />
        <MetricCard title="This Month's Spend" value={`$${summary.month_spend?.toLocaleString()}`} icon={ShoppingBag} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-card border border-border bg-white shadow-soft">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-bold">Recent Activity</h2>
          </div>
          <div className="divide-y divide-border">
            {purchases.map((p) => (
              <Link
                key={p.id || p.purchase_id}
                to={`/purchases/${p.id || p.purchase_id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-light text-sm font-bold text-brand">
                  {(p.vendor || p.name || "?")[0]}
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-sm text-muted">{p.date}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">${p.price}/{p.billing_cycle === "yearly" ? "yr" : "mo"}</p>
                  <StatusBadge status={p.status} />
                </div>
                {(p.potential_savings > 0 || p.savings > 0) && (
                  <p className="text-sm font-semibold text-brand">
                    {p.savings > 0 ? `Saved $${p.savings}` : `Save $${p.potential_savings}`}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-card border border-border bg-white p-6 shadow-soft">
          <h3 className="text-lg font-bold">AgentCFO is your AI Finance Assistant</h3>
          <ul className="mt-4 space-y-2 text-sm text-muted">
            <li>✓ Stops overpaying</li>
            <li>✓ Protects your budget</li>
            <li>✓ Fits your business</li>
          </ul>
          <Link to="/insights" className="mt-5 inline-block rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white">
            See How It Works
          </Link>
        </div>
      </div>
    </div>
  );
}
