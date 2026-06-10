export function Savings() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Savings</h1>
      <div className="rounded-card border border-border bg-white p-6 shadow-soft">
        <p className="text-3xl font-bold text-brand">$1,247</p>
        <p className="text-muted">Saved this month by reviewing purchases before checkout.</p>
        <ul className="mt-4 space-y-2 text-sm">
          <li>Adobe Creative Cloud canceled — $55/mo saved</li>
          <li>Notion vs ClickUp — $228/yr potential savings flagged</li>
        </ul>
      </div>
    </div>
  );
}

export function Insights() {
  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-bold">How AgentCFO Works</h1>
      <div className="rounded-card border border-border bg-white p-6 shadow-soft space-y-4 text-sm">
        <p><strong>Before you buy</strong> — the extension checks price, budget, and duplicates.</p>
        <p><strong>We compare</strong> using market data (Exa) to find cheaper similar tools.</p>
        <p><strong>We check</strong> your budget and cash flow (Stripe).</p>
        <p><strong>You decide</strong> — cancel, pick an alternative, or continue with a quick note.</p>
        <p className="text-muted">AgentCFO works in two ways: the extension helps you before you buy, and the dashboard shows your savings, budget health, and next steps.</p>
      </div>
    </div>
  );
}

export function Alerts() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Alerts</h1>
      <div className="space-y-3">
        {[
          { t: "Review needed", d: "Notion Team Plan — better option found", c: "amber" },
          { t: "Renewal soon", d: "Canva Pro renews in 9 days", c: "blue" },
          { t: "Budget watch", d: "Software budget at 62%", c: "green" },
        ].map((a) => (
          <div key={a.d} className="rounded-card border border-border bg-white p-4 shadow-soft">
            <p className="font-semibold">{a.t}</p>
            <p className="text-sm text-muted">{a.d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SettingsPage() {
  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-2xl font-bold">Settings</h1>
      {["Enable Protection", "Auto-block high risk purchases", "Show savings opportunities", "Preferences", "Account"].map((l) => (
        <label key={l} className="flex items-center justify-between rounded-card border border-border bg-white p-4 shadow-soft">
          <span className="font-medium">{l}</span>
          <input type="checkbox" defaultChecked className="h-4 w-4 accent-green-600" />
        </label>
      ))}
    </div>
  );
}
