import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { TodoCard } from "../components/UI";

export default function Todo() {
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    api.actions().then(setTasks).catch(() => setTasks([]));
  }, []);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">What's Next?</h1>
        <p className="text-muted">Here's what AgentCFO recommends.</p>
      </div>
      <div className="space-y-3">
        {tasks.map((t) => (
          <TodoCard
            key={t.task_id}
            task={t}
            onClick={() => {
              if (t.purchase_id) window.location.href = `/app/purchases/${t.purchase_id}`;
            }}
          />
        ))}
      </div>
      <p className="text-center text-sm text-muted">We're here to help you save and stay in control.</p>
      <Link to="/" className="block text-center text-sm font-semibold text-brand">Back to Home</Link>
    </div>
  );
}
