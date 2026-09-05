"use client";

import { useState, useEffect } from "react";
import AppShell from "@/components/layout/app-shell";
import Card, { CardHeader, CardContent } from "@/components/ui/card";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";

export default function AdminTagsPage() {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const res = await fetch("/api/admin/tags");
      if (res.ok && !cancelled) {
        const data = await res.json();
        setTags(data.tags);
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [refreshKey]);

  function refresh() { setRefreshKey((k) => k + 1); }

  async function handleCreate(name) {
    const res = await fetch("/api/admin/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) { setShowCreate(false); refresh(); }
    return res.ok;
  }

  async function handleDelete(tagId, tagName) {
    if (!confirm(`Delete tag "${tagName}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/tags/${tagId}`, { method: "DELETE" });
    if (res.ok) refresh();
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text">Tags</h1>
            <p className="text-sm text-text-secondary">Manage ticket tags for flexible classification.</p>
          </div>
          <Button onClick={() => setShowCreate(true)}>Add Tag</Button>
        </div>

        <Card>
          <CardContent>
            {loading ? (
              <p className="text-sm text-text-muted">Loading...</p>
            ) : tags.length === 0 ? (
              <p className="text-sm text-text-muted">No tags found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="pb-2 pr-4 font-medium text-text-muted">Name</th>
                      <th className="pb-2 pr-4 font-medium text-text-muted">Used On</th>
                      <th className="pb-2 font-medium text-text-muted">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tags.map((t) => (
                      <tr key={t.id} className="border-b border-border last:border-0">
                        <td className="py-2 pr-4 font-medium text-text">{t.name}</td>
                        <td className="py-2 pr-4 text-text-secondary">{t._count?.ticketTags || 0} tickets</td>
                        <td className="py-2">
                          <Button variant="ghost" size="sm" className="text-danger-600" onClick={() => handleDelete(t.id, t.name)}>
                            Delete
                          </Button>
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
        <TagModal onClose={() => setShowCreate(false)} onSubmit={handleCreate} />
      )}
    </AppShell>
  );
}

function TagModal({ onClose, onSubmit }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const ok = await onSubmit(name);
    if (!ok) setError("Tag name already exists.");
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-text">Add Tag</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Tag Name" value={name} onChange={(e) => setName(e.target.value)} required />
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
