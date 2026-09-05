"use client";

import { useState, useEffect } from "react";
import AppShell from "@/components/layout/app-shell";
import Card, { CardHeader, CardContent } from "@/components/ui/card";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editCat, setEditCat] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const res = await fetch("/api/admin/categories");
      if (res.ok && !cancelled) {
        const data = await res.json();
        setCategories(data.categories);
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [refreshKey]);

  function refresh() { setRefreshKey((k) => k + 1); }

  async function handleCreate(data) {
    const res = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) { setShowCreate(false); refresh(); }
    return res.ok;
  }

  async function handleUpdate(data) {
    const res = await fetch(`/api/admin/categories/${editCat.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) { setEditCat(null); refresh(); }
    return res.ok;
  }

  async function handleToggleActive(cat) {
    const res = await fetch(`/api/admin/categories/${cat.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !cat.isActive }),
    });
    if (res.ok) refresh();
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text">Categories</h1>
            <p className="text-sm text-text-secondary">Manage ticket classification categories.</p>
          </div>
          <Button onClick={() => setShowCreate(true)}>Add Category</Button>
        </div>

        <Card>
          <CardContent>
            {loading ? (
              <p className="text-sm text-text-muted">Loading...</p>
            ) : categories.length === 0 ? (
              <p className="text-sm text-text-muted">No categories found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="pb-2 pr-4 font-medium text-text-muted">Name</th>
                      <th className="pb-2 pr-4 font-medium text-text-muted">Tickets</th>
                      <th className="pb-2 pr-4 font-medium text-text-muted">Status</th>
                      <th className="pb-2 font-medium text-text-muted">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((c) => (
                      <tr key={c.id} className="border-b border-border last:border-0">
                        <td className="py-2 pr-4 font-medium text-text">{c.name}</td>
                        <td className="py-2 pr-4 text-text-secondary">{c._count?.tickets || 0}</td>
                        <td className="py-2 pr-4">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            c.isActive ? "bg-success-50 text-success-700" : "bg-surface-secondary text-text-muted"
                          }`}>
                            {c.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="py-2">
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setEditCat(c)}>Edit</Button>
                            <Button variant="ghost" size="sm" onClick={() => handleToggleActive(c)}>
                              {c.isActive ? "Deactivate" : "Activate"}
                            </Button>
                          </div>
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
        <CategoryModal title="Add Category" onClose={() => setShowCreate(false)} onSubmit={handleCreate} />
      )}
      {editCat && (
        <CategoryModal title="Edit Category" initialData={editCat} onClose={() => setEditCat(null)} onSubmit={handleUpdate} />
      )}
    </AppShell>
  );
}

function CategoryModal({ title, initialData, onClose, onSubmit }) {
  const [name, setName] = useState(initialData?.name || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const ok = await onSubmit({ name });
    if (!ok) setError("Category name already exists.");
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-text">{title}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Category Name" value={name} onChange={(e) => setName(e.target.value)} required />
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
