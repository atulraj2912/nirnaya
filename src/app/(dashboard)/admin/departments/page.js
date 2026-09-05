"use client";

import { useState, useEffect } from "react";
import Card, { CardHeader, CardContent } from "@/components/ui/card";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";

export default function AdminDepartmentsPage() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editDept, setEditDept] = useState(null);
  const [users, setUsers] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const res = await fetch("/api/admin/departments");
      if (res.ok && !cancelled) {
        const data = await res.json();
        setDepartments(data.departments);
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [refreshKey]);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/admin/users?limit=100&role=ADMIN");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
      }
    }
    load();
  }, []);

  function refresh() { setRefreshKey((k) => k + 1); }

  async function handleCreate(data) {
    const res = await fetch("/api/admin/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) { setShowCreate(false); refresh(); }
    return res.ok;
  }

  async function handleUpdate(data) {
    const res = await fetch(`/api/admin/departments/${editDept.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) { setEditDept(null); refresh(); }
    return res.ok;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Departments</h1>
          <p className="text-sm text-text-secondary">Manage organizational departments.</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>Add Department</Button>
      </div>

      <Card>
        <CardContent>
          {loading ? (
            <p className="text-sm text-text-muted">Loading...</p>
          ) : departments.length === 0 ? (
            <p className="text-sm text-text-muted">No departments found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-2 pr-4 font-medium text-text-muted">Name</th>
                    <th className="pb-2 pr-4 font-medium text-text-muted">Code</th>
                    <th className="pb-2 pr-4 font-medium text-text-muted">Manager</th>
                    <th className="pb-2 pr-4 font-medium text-text-muted">Users</th>
                    <th className="pb-2 pr-4 font-medium text-text-muted">Tickets</th>
                    <th className="pb-2 pr-4 font-medium text-text-muted">Status</th>
                    <th className="pb-2 font-medium text-text-muted">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {departments.map((d) => (
                    <tr key={d.id} className="border-b border-border last:border-0">
                      <td className="py-2 pr-4 font-medium text-text">{d.name}</td>
                      <td className="py-2 pr-4 font-mono text-xs text-text-secondary">{d.code}</td>
                      <td className="py-2 pr-4 text-text-secondary">{d.manager?.username || "\u2014"}</td>
                      <td className="py-2 pr-4 text-text-secondary">{d._count?.users || 0}</td>
                      <td className="py-2 pr-4 text-text-secondary">{d._count?.tickets || 0}</td>
                      <td className="py-2 pr-4">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          d.isActive ? "bg-success-50 text-success-700" : "bg-surface-secondary text-text-muted"
                        }`}>
                          {d.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="py-2">
                        <Button variant="ghost" size="sm" onClick={() => setEditDept(d)}>Edit</Button>
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
  );
}

function DeptModal({ title, initialData, onClose, onSubmit, users }) {
  const [form, setForm] = useState({
    name: initialData?.name || "",
    code: initialData?.code || "",
    managerId: initialData?.managerId || "",
    isActive: initialData?.isActive ?? true,
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function set(field) {
    return (e) => setForm({ ...form, [field]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const payload = { ...form };
    if (!payload.managerId) delete payload.managerId;
    const ok = await onSubmit(payload);
    if (!ok) setError("Operation failed. Check for duplicate values.");
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-text">{title}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Name" value={form.name} onChange={set("name")} required />
          <Input label="Code" value={form.code} onChange={set("code")} required />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text">Manager</label>
            <select
              value={form.managerId}
              onChange={set("managerId")}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="">No manager</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.username}</option>
              ))}
            </select>
          </div>
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
