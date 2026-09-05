"use client";

import { useState, useEffect } from "react";
import AppShell from "@/components/layout/app-shell";
import Card, { CardHeader, CardContent } from "@/components/ui/card";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Select from "@/components/ui/select";

const PRIORITY_OPTIONS = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

export default function AdminSlaPage() {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editConfig, setEditConfig] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const res = await fetch("/api/admin/sla-configs");
      if (res.ok && !cancelled) {
        const data = await res.json();
        setConfigs(data.configs);
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [refreshKey]);

  function refresh() { setRefreshKey((k) => k + 1); }

  async function handleCreate(data) {
    const res = await fetch("/api/admin/sla-configs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) { setShowCreate(false); refresh(); }
    return res;
  }

  async function handleUpdate(data) {
    const res = await fetch(`/api/admin/sla-configs/${editConfig.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) { setEditConfig(null); refresh(); }
    return res;
  }

  const existingPriorities = configs.map((c) => c.priority);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text">SLA Configuration</h1>
            <p className="text-sm text-text-secondary">
              Configure priority-based SLA response and resolution targets (elapsed time only).
            </p>
          </div>
          <Button onClick={() => setShowCreate(true)}>Add SLA Config</Button>
        </div>

        <Card>
          <CardContent>
            {loading ? (
              <p className="text-sm text-text-muted">Loading...</p>
            ) : configs.length === 0 ? (
              <p className="text-sm text-text-muted">No SLA configurations found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="pb-2 pr-4 font-medium text-text-muted">Priority</th>
                      <th className="pb-2 pr-4 font-medium text-text-muted">Response Time</th>
                      <th className="pb-2 pr-4 font-medium text-text-muted">Resolution Time</th>
                      <th className="pb-2 font-medium text-text-muted">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {configs.map((c) => (
                      <tr key={c.id} className="border-b border-border last:border-0">
                        <td className="py-2 pr-4">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            c.priority === "CRITICAL" ? "bg-danger-50 text-danger-700" :
                            c.priority === "HIGH" ? "bg-warning-50 text-warning-700" :
                            c.priority === "MEDIUM" ? "bg-primary-50 text-primary-700" :
                            "bg-surface-secondary text-text-secondary"
                          }`}>
                            {c.priority}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-text-secondary">{c.responseTimeMinutes} min</td>
                        <td className="py-2 pr-4 text-text-secondary">{c.resolutionTimeMinutes} min</td>
                        <td className="py-2">
                          <Button variant="ghost" size="sm" onClick={() => setEditConfig(c)}>Edit</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {showCreate && (
        <SLAConfigModal title="Add SLA Config" onClose={() => setShowCreate(false)} onSubmit={handleCreate} excludePriorities={existingPriorities} />
      )}
      {editConfig && (
        <SLAConfigModal title="Edit SLA Config" initialData={editConfig} onClose={() => setEditConfig(null)} onSubmit={handleUpdate} excludePriorities={[]} />
      )}
    </AppShell>
  );
}

function SLAConfigModal({ title, initialData, onClose, onSubmit, excludePriorities }) {
  const [form, setForm] = useState({
    priority: initialData?.priority || "",
    responseTimeMinutes: initialData?.responseTimeMinutes || "",
    resolutionTimeMinutes: initialData?.resolutionTimeMinutes || "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function set(field) {
    return (e) => setForm({ ...form, [field]: e.target.value });
  }

  const availablePriorities = PRIORITY_OPTIONS.filter((p) => !excludePriorities.includes(p));

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const payload = {
      ...form,
      responseTimeMinutes: parseInt(form.responseTimeMinutes, 10),
      resolutionTimeMinutes: parseInt(form.resolutionTimeMinutes, 10),
    };
    const res = await onSubmit(payload);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Operation failed.");
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-text">{title}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {initialData ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text">Priority</label>
              <p className="rounded-lg border border-border bg-surface-secondary px-3 py-2 text-sm text-text">
                {initialData.priority}
              </p>
            </div>
          ) : (
            <Select label="Priority" value={form.priority} onChange={set("priority")} required>
              <option value="">Select priority</option>
              {availablePriorities.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </Select>
          )}
          <Input
            label="Response Time (minutes)"
            type="number"
            min="1"
            value={form.responseTimeMinutes}
            onChange={set("responseTimeMinutes")}
            required
          />
          <Input
            label="Resolution Time (minutes)"
            type="number"
            min="1"
            value={form.resolutionTimeMinutes}
            onChange={set("resolutionTimeMinutes")}
            required
          />
          {error && <p className="text-sm text-danger-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
