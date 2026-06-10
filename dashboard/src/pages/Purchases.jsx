import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { StatusBadge, AgentTimeline } from "../components/UI";

export default function Purchases() {
  const { id } = useParams();
  const [list, setList] = useState([]);
  const [detail, setDetail] = useState(null);
  const [justification, setJustification] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    api.recentPurchases().then(setList).catch(() => setList([]));
  }, []);

  useEffect(() => {
    if (!id) return setDetail(null);
    api.purchase(id).then(setDetail).catch(() => setDetail(null));
  }, [id]);

  async function handleResolve(action) {
    if (!detail) return;
    const pid = detail.id || detail.purchase_id;
    if (action === "continue_with_justification" && !justification.trim()) {
      setMessage("Please add a brief reason before continuing.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await api.resolve(pid, action, justification.trim());
      setMessage(
        action === "cancel"
          ? "Purchase avoided — we'll log the savings."
          : action === "continue_with_justification"
            ? "Logged with your justification."
            : "Purchase approved."
      );
      const updated = await api.purchase(pid);
      setDetail(updated);
    } catch (e) {
      setMessage(e.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (id && detail) {
    const full = detail.full_response || {};
    const alts = [full.best_alternative, ...(full.alternatives || [])].filter(Boolean);
    const isHighRisk = detail.status === "high_risk";
    const saveMo = full.savings?.estimated_monthly_savings;

    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Better alternatives found!</h1>
          <p className="text-muted">We found similar options that can save your business money.</p>
        </div>

        <div className="rounded-card border border-border bg-white p-5 shadow-soft">
          <p className="text-sm text-muted">Original purchase</p>
          <h2 className="text-xl font-bold">{detail.name}</h2>
          <p className="text-lg">
            ${detail.price}/{detail.billing_cycle === "yearly" ? "yr" : "mo"}
          </p>
          <StatusBadge status={detail.status} />
          {detail.flagged_reason && (
            <p className="mt-2 text-sm text-amber-800">{detail.flagged_reason}</p>
          )}
        </div>

        {alts.map((alt, i) => (
          <div
            key={alt.name || i}
            className={`rounded-card border p-5 ${i === 0 ? "border-green-200 bg-brand-light" : "border-border bg-white shadow-soft"}`}
          >
            <p className="text-sm font-semibold text-brand">{i === 0 ? "Recommended" : "Best Value"}</p>
            <h3 className="text-lg font-bold">{alt.name}</h3>
            <p>
              ${alt.price}/mo — {alt.reason}
            </p>
            {saveMo && i === 0 && (
              <p className="mt-2 font-semibold text-brand">You could save ${saveMo}/mo</p>
            )}
            <ul className="mt-2 space-y-1 text-sm text-muted">
              {(alt.features || ["Similar features", "Team collaboration"]).map((f) => (
                <li key={f}>✓ {f}</li>
              ))}
            </ul>
            <button type="button" className="mt-3 text-sm font-semibold text-brand">
              View Option →
            </button>
          </div>
        ))}

        {saveMo > 0 && (
          <div className="rounded-card border border-green-200 bg-brand-light p-4 text-sm">
            Original: {detail.name} at ${detail.price}/mo · You could save up to ${saveMo}/mo
          </div>
        )}

        {full.question && (
          <div className="rounded-card border border-border bg-white p-4">
            <p className="text-sm font-medium text-gray-900">{full.question}</p>
            <textarea
              className="mt-2 w-full rounded-xl border border-border p-3 text-sm shadow-inner"
              rows={3}
              maxLength={250}
              placeholder="Why do you need this specific option?"
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
            />
            <p className="text-xs text-muted">{justification.length} / 250</p>
          </div>
        )}

        {message && <p className="text-sm font-medium text-brand">{message}</p>}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => handleResolve("cancel")}
            className="rounded-full border border-border bg-white px-5 py-2.5 text-sm font-bold text-gray-900 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel Purchase
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => handleResolve("continue")}
            className="rounded-full border border-border bg-white px-5 py-2.5 text-sm font-bold text-gray-900 hover:bg-gray-50 disabled:opacity-50"
          >
            Continue Anyway
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              handleResolve(isHighRisk || justification.trim() ? "continue_with_justification" : "continue")
            }
            className="rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-dark disabled:opacity-50"
          >
            Submit Justification
          </button>
        </div>

        {full.audit_summary && (
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
            {full.audit_summary.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        )}

        <AgentTimeline steps={full.audit_timeline || []} />

        <Link to="/purchases" className="text-sm font-semibold text-brand">
          ← Back to purchases
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Purchases</h1>
      <p className="text-muted">Every checkout review from the extension appears here.</p>
      <div className="space-y-3">
        {list.length === 0 && (
          <div className="rounded-card border border-border bg-white p-8 text-center text-muted shadow-soft">
            No purchases yet. Try the extension demo checkout to see one appear.
          </div>
        )}
        {list.map((p) => (
          <Link
            key={p.id || p.purchase_id}
            to={`/purchases/${p.id || p.purchase_id}`}
            className="block rounded-card border border-border bg-white p-4 shadow-soft hover:border-green-200"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{p.name}</p>
                <p className="text-sm text-muted">
                  {p.vendor} · {p.date}
                </p>
              </div>
              <StatusBadge status={p.status} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
