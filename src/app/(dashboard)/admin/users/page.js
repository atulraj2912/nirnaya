"use client";

import { useState, useEffect, useCallback } from "react";
import AppShell from "@/components/layout/app-shell";
import Card, { CardHeader, CardContent } from "@/components/ui/card";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Select from "@/components/ui/select";
import { StatusBadge } from "@/components/tickets/status-badge";

const ROLE_OPTIONS = ["", "USER", "AGENT", "ADMIN"];
const STATUS_OPTIONS = ["", "ACTIVE", "INACTIVE", "SUSPENDED"];

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [departments, setDepartments] = useState([]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: 15 });
    if (search) params.set("search", search);
    if (roleFilter) params.set("role", roleFilter);
    if (statusFilter) params.set("status", statusFilter);

    const res = await fetch(`/api/admin/users?${params}`);
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users);
      setTotal(data.total);
    }
    setLoading(false);
  }, [page, search, roleFilter, statusFilter]);

  const fetchDepts = useCallback(async () => {
    const res = await fetch("/api/admin/departments?limit=100");
    if (res.ok) {
      const data = await res.json();
      setDepartments(data.departments);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetchDepts();
  }, [fetchDepts]);

  async function handleCreate(data) {
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      setShowCreate(false);
      fetchUsers();
    }
    return res.ok;
  }

  async function handleUpdate(data) {
    const res = await fetch(`/api/admin/users/${editUser.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      setEditUser(null);
      fetchUsers();
    }
    return res.ok;
  }

  async function handleDeactivate(userId) {
    if (!confirm("Are you sure you want to deactivate this user?")) return;
    const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    if (res.ok) fetchUsers();
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text">User Management</h1>
            <p className="text-sm text-text-secondary">
              Manage organization users, roles, and access.
            </p>
          </div>
          <Button onClick={() => setShowCreate(true)}>Add User</Button>
        </div>

        <Card>
          <CardContent>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <Input
                  placeholder="Search users..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
              <Select
                value={roleFilter}
                onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>{r || "All Roles"}</option>
                ))}
              </Select>
              <Select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s || "All Statuses"}</option>
                ))}
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            {loading ? (
              <p className="text-sm text-text-muted">Loading...</p>
            ) : users.length === 0 ? (
              <p className="text-sm text-text-muted">No users found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="pb-2 pr-4 font-medium text-text-muted">Username</th>
                      <th className="pb-2 pr-4 font-medium text-text-muted">Email</th>
                      <th className="pb-2 pr-4 font-medium text-text-muted">Role</th>
                      <th className="pb-2 pr-4 font-medium text-text-muted">Status</th>
                      <th className="pb-2 pr-4 font-medium text-text-muted">Department</th>
                      <th className="pb-2 font-medium text-text-muted">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-b border-border last:border-0">
                        <td className="py-2 pr-4 font-medium text-text">{u.username}</td>
                        <td className="py-2 pr-4 text-text-secondary">{u.email}</td>
                        <td className="py-2 pr-4">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            u.role === "ADMIN" ? "bg-danger-50 text-danger-700" :
                            u.role === "AGENT" ? "bg-warning-50 text-warning-700" :
                            "bg-surface-secondary text-text-secondary"
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="py-2 pr-4"><StatusBadge status={u.status} /></td>
                        <td className="py-2 pr-4 text-text-secondary">{u.department?.name || "—"}</td>
                        <td className="py-2">
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setEditUser(u)}>
                              Edit
                            </Button>
                            {u.status === "ACTIVE" && (
                              <Button variant="ghost" size="sm" className="text-danger-600" onClick={() => handleDeactivate(u.id)}>
                                Deactivate
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {total > 15 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-text-muted">{total} users total</p>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
                  <span className="flex items-center px-3 text-sm text-text-muted">Page {page}</span>
                  <Button variant="secondary" size="sm" disabled={users.length < 15} onClick={() => setPage(page + 1)}>Next</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {showCreate && (
        <UserModal title="Add User" onClose={() => setShowCreate(false)} onSubmit={handleCreate} departments={departments} />
      )}
      {editUser && (
        <UserModal title="Edit User" initialData={editUser} onClose={() => setEditUser(null)} onSubmit={handleUpdate} departments={departments} />
      )}
    </AppShell>
  );
}

function UserModal({ title, initialData, onClose, onSubmit, departments }) {
  const [form, setForm] = useState({
    username: initialData?.username || "",
    email: initialData?.email || "",
    password: "",
    role: initialData?.role || "USER",
    departmentId: initialData?.departmentId || "",
    employeeId: initialData?.employeeId || "",
    designation: initialData?.designation || "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function set(field) {
    return (e) => setForm({ ...form, [field]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!initialData && !form.password) {
      setError("Password is required for new users");
      return;
    }
    setSaving(true);
    const payload = { ...form };
    if (initialData && !payload.password) delete payload.password;
    if (!payload.departmentId) delete payload.departmentId;
    if (!payload.employeeId) delete payload.employeeId;
    if (!payload.designation) delete payload.designation;
    const ok = await onSubmit(payload);
    if (!ok) setError("Operation failed. Check for duplicate values.");
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-text">{title}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Username" value={form.username} onChange={set("username")} required />
          <Input label="Email" type="email" value={form.email} onChange={set("email")} required />
          {!initialData && (
            <Input label="Password" type="password" value={form.password} onChange={set("password")} required />
          )}
          <Select label="Role" value={form.role} onChange={set("role")}>
            <option value="USER">User</option>
            <option value="AGENT">Agent</option>
            <option value="ADMIN">Admin</option>
          </Select>
          <Select label="Department" value={form.departmentId} onChange={set("departmentId")}>
            <option value="">No department</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </Select>
          <Input label="Employee ID" value={form.employeeId} onChange={set("employeeId")} />
          <Input label="Designation" value={form.designation} onChange={set("designation")} />
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
