"use client";

import { useState, useEffect } from "react";
import Card, { CardHeader, CardContent } from "@/components/ui/card";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";

export default function AdminSettingsPage() {
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchOrg() {
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        const data = await res.json();
        setOrg(data.organization);
      }
      setLoading(false);
    }
    fetchOrg();
  }, []);

  function set(field) {
    return (e) => setOrg({ ...org, [field]: e.target.value });
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess(false);

    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: org.name,
        description: org.description,
        businessHoursStart: org.businessHoursStart,
        businessHoursEnd: org.businessHoursEnd,
        timezone: org.timezone,
      }),
    });

    if (res.ok) {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } else {
      const data = await res.json();
      setError(data.error || "Failed to save settings.");
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-text">Organization Settings</h1>
        <p className="text-sm text-text-muted">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text">Organization Settings</h1>
        <p className="text-sm text-text-secondary">
          Configure your organization&apos;s general settings.
        </p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-text">General</h2>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4 max-w-2xl">
            <Input label="Organization Name" value={org?.name || ""} onChange={set("name")} required />
            <Input label="Description" value={org?.description || ""} onChange={set("description")} />
            <Input label="Slug" value={org?.slug || ""} disabled />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Business Hours Start" type="time" value={org?.businessHoursStart || ""} onChange={set("businessHoursStart")} />
              <Input label="Business Hours End" type="time" value={org?.businessHoursEnd || ""} onChange={set("businessHoursEnd")} />
            </div>
            <Input label="Timezone" value={org?.timezone || ""} onChange={set("timezone")} />
            {error && <p className="text-sm text-danger-600">{error}</p>}
            {success && <p className="text-sm text-success-600">Settings saved successfully.</p>}
            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Settings"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
