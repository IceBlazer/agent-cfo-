import { useEffect, useState } from "react";
import { api } from "../api/client";
import { BudgetProgress } from "../components/UI";

export default function Financial() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.financialHealth().then(setData).catch(() => setData(null));
  }, []);

  if (!data) return <p className="text-muted">Loading…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Your Financial Health</h1>
        <p className="text-muted">Real-time snapshot of your business.</p>
      </div>
      <div className="rounded-card border border-green-200 bg-brand-light p-5">
        <p className="text-sm font-semibold text-brand">Cash flow looks good</p>
        <p className="text-2xl font-bold">Status: {data.cash_flow_status}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-card border border-border bg-white p-4 shadow-soft">
          <p className="text-sm text-muted">Cash on Hand</p>
          <p className="text-2xl font-bold">${data.cash_on_hand?.toLocaleString()}</p>
        </div>
        <div className="rounded-card border border-border bg-white p-4 shadow-soft">
          <p className="text-sm text-muted">Monthly Burn</p>
          <p className="text-2xl font-bold">${data.monthly_burn?.toLocaleString()}</p>
        </div>
        <div className="rounded-card border border-border bg-white p-4 shadow-soft">
          <p className="text-sm text-muted">Runway</p>
          <p className="text-2xl font-bold">{data.runway_months} months</p>
        </div>
      </div>
      <div className="space-y-3">
        <h2 className="font-bold">Budget usage</h2>
        {data.departments &&
          Object.entries(data.departments).map(([name, b]) => (
            <BudgetProgress key={name} label={name} spent={b.spent} limit={b.limit} />
          ))}
      </div>
      <p className="text-sm text-muted">Tip: Keep runway above 3 months for peace of mind.</p>
    </div>
  );
}
