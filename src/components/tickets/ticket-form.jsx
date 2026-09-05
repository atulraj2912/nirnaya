"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";

export default function TicketForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);

  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "MEDIUM",
    type: "INCIDENT",
    departmentId: "",
    categoryId: "",
  });

  useEffect(() => {
    async function fetchDropdowns() {
      const [deptRes, catRes, tagRes] = await Promise.all([
        fetch("/api/departments"),
        fetch("/api/categories"),
        fetch("/api/tags"),
      ]);
      if (deptRes.ok) {
        const d = await deptRes.json();
        setDepartments(d.departments);
      }
      if (catRes.ok) {
        const c = await catRes.json();
        setCategories(c.categories);
      }
      if (tagRes.ok) {
        const t = await tagRes.json();
        setTags(t.tags);
      }
    }
    fetchDropdowns();
  }, []);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleTag(tagId) {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!form.title || !form.description || !form.departmentId) {
      setError("Title, description, and department are required");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          categoryId: form.categoryId || null,
          tagIds: selectedTags,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create ticket");
        return;
      }

      router.push(`/tickets/${data.ticket.id}`);
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  const filteredCategories = form.departmentId
    ? categories.filter((c) => c.departmentId === form.departmentId)
    : categories;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg bg-danger-50 p-3 text-sm text-danger-700">{error}</div>
      )}

      <Input
        label="Title"
        value={form.title}
        onChange={(e) => updateField("title", e.target.value)}
        placeholder="Brief description of the issue"
        required
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-text">Description</label>
        <textarea
          value={form.description}
          onChange={(e) => updateField("description", e.target.value)}
          placeholder="Provide details about your request..."
          rows={6}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          required
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text">Priority</label>
          <select
            value={form.priority}
            onChange={(e) => updateField("priority", e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text">Type</label>
          <select
            value={form.type}
            onChange={(e) => updateField("type", e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="INCIDENT">Incident</option>
            <option value="SERVICE_REQUEST">Service Request</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text">Department *</label>
          <select
            value={form.departmentId}
            onChange={(e) => updateField("departmentId", e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            required
          >
            <option value="">Select department</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text">Category</label>
          <select
            value={form.categoryId}
            onChange={(e) => updateField("categoryId", e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="">Select category</option>
            {filteredCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text">Tags</label>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  selectedTags.includes(tag.id)
                    ? "bg-primary-600 text-white"
                    : "bg-surface-secondary text-text-secondary hover:bg-border"
                }`}
              >
                {tag.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.back()}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Creating..." : "Create Ticket"}
        </Button>
      </div>
    </form>
  );
}
