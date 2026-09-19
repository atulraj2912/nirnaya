"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import {
  useDepartments,
  useCategories,
  useTags,
  useCreateTicket,
} from "@/hooks/use-ticket-queries";

export default function TicketForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);

  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "MEDIUM",
    type: "INCIDENT",
    departmentId: "",
    categoryId: "",
  });

  const { data: deptData } = useDepartments();
  const { data: catData } = useCategories();
  const { data: tagData } = useTags();
  const createTicket = useCreateTicket();

  const departments = deptData?.departments ?? [];
  const categories = catData?.categories ?? [];
  const tags = tagData?.tags ?? [];

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

    try {
      const data = await createTicket.mutateAsync({
        ...form,
        categoryId: form.categoryId || null,
        tagIds: selectedTags,
      });
      router.push(`/tickets/${data.ticket.id}`);
    } catch (err) {
      setError(err.message || "An unexpected error occurred");
    }
  }

  const loading = createTicket.isPending;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {error && (
        <div className="rounded-lg bg-danger-50 p-3 text-sm font-medium text-danger-700 ring-1 ring-inset ring-danger-200">{error}</div>
      )}

      <Input
        label="Title"
        value={form.title}
        onChange={(e) => updateField("title", e.target.value)}
        placeholder="Brief description of the issue"
        maxLength={200}
        required
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-text">Description</label>
        <textarea
          value={form.description}
          onChange={(e) => updateField("description", e.target.value)}
          placeholder="Provide details about your request..."
          rows={6}
          maxLength={10000}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          required
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text">Priority</label>
          <select
            value={form.priority}
            onChange={(e) => updateField("priority", e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
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
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
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
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
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
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          >
            <option value="">Select category</option>
            {categories.map((c) => (
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
                className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  selectedTags.includes(tag.id)
                    ? "bg-primary-600 text-white shadow-sm"
                    : "bg-surface-secondary text-text-secondary hover:bg-border ring-1 ring-inset ring-border"
                }`}
              >
                {tag.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
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
