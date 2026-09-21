"use client";

import { useState } from "react";
import Card, { CardHeader, CardContent } from "@/components/ui/card";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import { useSavedReplies } from "@/hooks/use-dashboard-queries";

export default function SavedRepliesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editReply, setEditReply] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const { data, isLoading, error } = useSavedReplies({ page, limit: 15, search });
  const replies = data?.replies || [];
  const total = data?.total || 0;

  function refresh() { setRefreshKey((k) => k + 1); }

  async function handleCreate(formData) {
    const res = await fetch("/api/admin/saved-replies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });
    if (res.ok) { setShowCreate(false); refresh(); }
    return res.ok;
  }

  async function handleUpdate(formData) {
    const res = await fetch(`/api/admin/saved-replies/${editReply.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });
    if (res.ok) { setEditReply(null); refresh(); }
    return res.ok;
  }

  async function handleDelete(id, title) {
    if (!confirm(`Delete saved reply "${title}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/saved-replies/${id}`, { method: "DELETE" });
    if (res.ok) refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">Saved Replies</h1>
          <p className="text-sm text-text-secondary">Manage canned response templates for agents.</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>Add Reply</Button>
      </div>

      <Card>
        <CardContent>
          <Input
            placeholder="Search replies..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-text-muted">Loading...</p>
          ) : error ? (
            <p className="text-sm text-danger-600">Failed to load saved replies.</p>
          ) : replies.length === 0 ? (
            <p className="text-sm text-text-muted">No saved replies found. Create one to get started.</p>
          ) : (
            <div className="space-y-3">
              {replies.map((r) => (
                <div key={r.id} className="rounded-lg border border-border p-4">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-text">{r.title}</h3>
                      <p className="mt-1 text-xs text-text-muted line-clamp-2">{r.content}</p>
                      <p className="mt-1 text-xs text-text-muted">
                        Created by {r.createdBy?.username || "Unknown"} 
                        {r.updatedAt && <> &middot; Updated {new Date(r.updatedAt).toLocaleDateString()}</>}
                      </p>
                    </div>
                    <div className="flex gap-2 ml-4 flex-shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => setEditReply(r)}>Edit</Button>
                      <Button variant="ghost" size="sm" className="text-danger-600" onClick={() => handleDelete(r.id, r.title)}>Delete</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {total > 15 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-text-muted">{total} replies total</p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
                <span className="flex items-center px-3 text-sm text-text-muted">Page {page}</span>
                <Button variant="secondary" size="sm" disabled={replies.length < 15} onClick={() => setPage(page + 1)}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {(showCreate || editReply) && (
        <SavedReplyModal
          title={editReply ? "Edit Saved Reply" : "Add Saved Reply"}
          initialData={editReply}
          onClose={() => { setShowCreate(false); setEditReply(null); }}
          onSubmit={editReply ? handleUpdate : handleCreate}
        />
      )}
    </div>
  );
}

function SavedReplyModal({ title, initialData, onClose, onSubmit }) {
  const [form, setForm] = useState({
    title: initialData?.title || "",
    content: initialData?.content || "",
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
    const ok = await onSubmit(form);
    if (!ok) setError("Operation failed. Check for duplicate values.");
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-text">{title}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Title" value={form.title} onChange={set("title")} required />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text">Content</label>
            <textarea
              value={form.content}
              onChange={set("content")}
              rows={6}
              required
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-y"
            />
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
