"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SetupPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    setupSecret: "",
  });

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  function updateField(field: string, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.message || "Setup failed.");
        return;
      }

      router.replace("/admin");
      router.refresh();
    } catch {
      setMessage("Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Connect Broadband CMS</h1>
        <h2>Create Super Admin</h2>
        <p>Initial administrator account setup</p>

        <label>Full Name</label>
        <input
          required
          minLength={2}
          maxLength={100}
          value={form.name}
          onChange={(e) => updateField("name", e.target.value)}
          placeholder="Your full name"
        />

        <label>Username</label>
        <input
          required
          minLength={3}
          maxLength={50}
          pattern="[a-zA-Z0-9_.-]+"
          value={form.username}
          onChange={(e) => updateField("username", e.target.value)}
          placeholder="Choose a username"
        />

        <label>Email Address</label>
        <input
          required
          type="email"
          maxLength={255}
          value={form.email}
          onChange={(e) => updateField("email", e.target.value)}
          placeholder="admin@example.com"
        />

        <label>Password</label>
        <input
          required
          type="password"
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
          value={form.password}
          onChange={(e) => updateField("password", e.target.value)}
          placeholder="Minimum 8 characters"
        />

        <label>Setup Secret</label>
        <input
          required
          type="password"
          autoComplete="off"
          value={form.setupSecret}
          onChange={(e) => updateField("setupSecret", e.target.value)}
          placeholder="Enter your setup secret"
        />

        {message && <p className="auth-message">{message}</p>}

        <button type="submit" disabled={loading}>
          {loading ? "Creating account..." : "Create Super Admin"}
        </button>
      </form>
    </main>
  );
}
