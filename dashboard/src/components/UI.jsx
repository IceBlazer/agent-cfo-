import { ChevronRight } from "lucide-react";

export function StatusBadge({ status }) {
  const map = {
    protection_on: "bg-brand-light text-brand border-green-200",
    review_needed: "bg-amber-50 text-amber-800 border-amber-200",
    savings_found: "bg-brand-light text-brand-dark border-green-200",
    high_risk: "bg-red-50 text-red-700 border-red-200",
    canceled: "bg-gray-100 text-gray-700 border-gray-200",
    approved: "bg-blue-50 text-blue-700 border-blue-200",
    continued_with_justification: "bg-blue-50 text-blue-700 border-blue-200",
  };
  const labels = {
    protection_on: "Protection is ON",
    review_needed: "Review needed",
    savings_found: "Savings found",
    high_risk: "Action needed",
    canceled: "Canceled",
    approved: "Approved",
    continued_with_justification: "Logged",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${map[status] || map.review_needed}`}>
      {labels[status] || status}
    </span>
  );
}

export function MetricCard({ title, value, sub, icon: Icon, tone = "default" }) {
  const tones = {
    default: "bg-white",
    green: "bg-brand-light border-green-100",
    yellow: "bg-amber-50 border-amber-100",
  };
  return (
    <div className={`rounded-card border border-border p-5 shadow-soft ${tones[tone]}`}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-muted">{title}</p>
        {Icon && <Icon className="h-5 w-5 text-brand" />}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
    </div>
  );
}

export function BudgetProgress({ label, spent, limit }) {
  const pct = Math.min(100, Math.round((spent / limit) * 100));
  const color = pct > 90 ? "bg-red-500" : pct > 75 ? "bg-amber-400" : "bg-brand";
  return (
    <div className="rounded-card border border-border bg-white p-4 shadow-soft">
      <div className="mb-2 flex justify-between text-sm">
        <span className="font-semibold">{label}</span>
        <span className="text-muted">${spent.toLocaleString()} of ${limit.toLocaleString()}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted">{pct}% used</p>
    </div>
  );
}

export function AgentTimeline({ steps = [], defaultOpen = false }) {
  return (
    <details className="rounded-card border border-border bg-white p-4 shadow-soft" open={defaultOpen}>
      <summary className="cursor-pointer font-semibold text-gray-900">How AgentCFO decided</summary>
      <ol className="mt-4 space-y-3">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3 text-sm">
            <span className={`mt-0.5 h-2.5 w-2.5 rounded-full ${s.status === "done" ? "bg-brand" : "bg-gray-300"}`} />
            <div>
              <p className="font-medium">{s.label}</p>
              {s.result && <p className="text-muted">{s.result}</p>}
              {s.ms != null && <p className="text-xs text-muted">{s.ms}ms</p>}
            </div>
          </li>
        ))}
      </ol>
    </details>
  );
}

export function TodoCard({ task, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-card border border-border bg-white p-4 text-left shadow-soft transition hover:border-green-200"
    >
      <div className="flex-1">
        <p className="font-semibold text-gray-900">{task.title}</p>
        <p className="text-sm text-muted">{task.description}</p>
      </div>
      <span className="rounded-full bg-brand-light px-2 py-0.5 text-xs font-semibold text-brand">{task.badge}</span>
      <ChevronRight className="h-4 w-4 text-muted" />
    </button>
  );
}
