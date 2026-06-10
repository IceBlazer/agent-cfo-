import { NavLink, Outlet, useSearchParams } from "react-router-dom";
import {
  ShieldCheck,
  Home,
  ShoppingCart,
  BadgeDollarSign,
  Wallet,
  Lightbulb,
  Bell,
  ListTodo,
  Settings,
  ExternalLink,
} from "lucide-react";
import { StatusBadge } from "./UI";

const nav = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/purchases", icon: ShoppingCart, label: "Purchases" },
  { to: "/savings", icon: BadgeDollarSign, label: "Savings" },
  { to: "/financial", icon: Wallet, label: "Financial Health" },
  { to: "/insights", icon: Lightbulb, label: "Insights" },
  { to: "/alerts", icon: Bell, label: "Alerts" },
  { to: "/todo", icon: ListTodo, label: "To Do" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export default function Layout() {
  const [params] = useSearchParams();
  const purchaseId = params.get("purchase");

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 border-r border-border bg-white p-5 md:block">
        <div className="mb-8 flex items-center gap-2">
          <ShieldCheck className="h-7 w-7 text-brand" />
          <span className="text-lg font-bold">AgentCFO</span>
        </div>
        <nav className="space-y-1">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${
                  isActive ? "bg-brand-light text-brand-dark" : "text-muted hover:bg-gray-50"
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <a
          href="/demo"
          target="_blank"
          rel="noreferrer"
          className="mt-8 flex items-center gap-2 text-sm font-medium text-brand hover:underline"
        >
          Try checkout demo <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </aside>
      <main className="flex-1 p-6 md:p-8">
        <div className="mb-6 flex items-center justify-between">
          <StatusBadge status="protection_on" />
          {purchaseId && (
            <span className="text-sm text-muted">Viewing purchase {purchaseId}</span>
          )}
        </div>
        <Outlet />
      </main>
    </div>
  );
}
