"use client";

import { useState, type FormEvent, type CSSProperties } from "react";
import { useRouter } from "next/navigation";

type Props = { usernameLabel?: string; passwordLabel?: string; submitText?: string; rememberMe?: boolean; style?: CSSProperties };

export default function PublicBuilderLoginForm({ usernameLabel = "Username or Email", passwordLabel = "Password", submitText = "Log In", rememberMe = true, style }: Props) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true); setMessage(""); setError("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier, password }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Unable to log in.");
      setMessage(result.message || "Login successful.");
      router.push("/admin");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to log in.");
    } finally { setBusy(false); }
  };
  return <form onSubmit={submit} style={{ display: "grid", gap: 12, maxWidth: 420, ...style }}>
    <label style={{ display: "grid", gap: 5 }}>{usernameLabel}<input required autoComplete="username" value={identifier} onChange={(event) => setIdentifier(event.target.value)} style={{ padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 6 }} /></label>
    <label style={{ display: "grid", gap: 5 }}>{passwordLabel}<input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} style={{ padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 6 }} /></label>
    {rememberMe ? <label style={{ display: "flex", alignItems: "center", gap: 8 }}><input type="checkbox" defaultChecked /> Remember me</label> : null}
    {error ? <p role="alert" style={{ color: "#b42318", margin: 0 }}>{error}</p> : null}
    {message ? <p role="status" style={{ color: "#067647", margin: 0 }}>{message}</p> : null}
    <button type="submit" disabled={busy} style={{ padding: "11px 16px", border: 0, borderRadius: 6, background: "#0c2f55", color: "#fff", cursor: busy ? "wait" : "pointer" }}>{busy ? "Please wait…" : submitText}</button>
  </form>;
}
