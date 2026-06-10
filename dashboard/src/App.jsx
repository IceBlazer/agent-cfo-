import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Purchases from "./pages/Purchases";
import Financial from "./pages/Financial";
import Todo from "./pages/Todo";
import { Savings, Insights, Alerts, SettingsPage } from "./pages/SimplePage";

export default function App() {
  return (
    <BrowserRouter basename="/app">
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="purchases" element={<Purchases />} />
          <Route path="purchases/:id" element={<Purchases />} />
          <Route path="savings" element={<Savings />} />
          <Route path="insights" element={<Insights />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="financial" element={<Financial />} />
          <Route path="todo" element={<Todo />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
