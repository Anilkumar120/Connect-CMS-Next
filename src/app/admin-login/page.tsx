"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryRequested, setRecoveryRequested] = useState(false);
  const [recoveryChannel, setRecoveryChannel] = useState<"EMAIL" | "SMS">("EMAIL");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showRecoveryPasswords, setShowRecoveryPasswords] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.message || "Login failed.");
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

  async function requestReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, channel: recoveryChannel }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.message || "Unable to send a reset code.");
        return;
      }
      setRecoveryRequested(true);
      setMessage(result.message || "If an active account matches those details, a reset code has been sent.");
    } catch {
      setMessage("Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (newPassword !== confirmPassword) {
      setMessage("New password and confirmation do not match.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/password-reset/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier,
          channel: recoveryChannel,
          code: recoveryCode,
          newPassword,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.message || "Unable to reset your password.");
        return;
      }
      setMessage("Password reset. You can now sign in.");
      setRecoveryMode(false);
      setRecoveryRequested(false);
      setPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setMessage("Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      {!recoveryMode ? <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Connect Broadband CMS</h1>
        <h2>Admin Login</h2>
        <p>Sign in to access your dashboard</p>

        <label>Email or Username</label>
        <input
          required
          autoComplete="username"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="Enter email or username"
        />

        <label>Password</label>
        <span className="auth-password-field">
          <input
            required
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
          />
          <button type="button" className="auth-password-toggle" onClick={() => setShowPassword((shown) => !shown)}>
            {showPassword ? "Hide" : "Show"}
          </button>
        </span>

        {message && <p className="auth-message">{message}</p>}

        <button type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Login"}
        </button>
        <button type="button" className="auth-text-button" onClick={() => { setMessage(""); setRecoveryMode(true); }}>
          Forgot password?
        </button>
      </form> : (
        <form className="auth-card" onSubmit={recoveryRequested ? resetPassword : requestReset}>
          <h1>Connect Broadband CMS</h1>
          <h2>Reset Password</h2>
          <p>Receive a one-time reset code by email or SMS.</p>
          <label>{recoveryChannel === "EMAIL" ? "Email address" : "Phone number"}</label>
          <input
            required
            type={recoveryChannel === "EMAIL" ? "email" : "tel"}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder={recoveryChannel === "EMAIL" ? "name@example.com" : "+14155550123"}
          />
          <label>Send code by</label>
          <select value={recoveryChannel} onChange={(e) => {
            setRecoveryChannel(e.target.value as "EMAIL" | "SMS");
            setRecoveryRequested(false);
            setMessage("");
          }}>
            <option value="EMAIL">Email</option>
            <option value="SMS">SMS</option>
          </select>
          {!recoveryRequested ? (
            <button type="submit" disabled={loading}>{loading ? "Sending..." : "Send Reset Code"}</button>
          ) : (
            <>
              <label>6-digit code</label>
              <input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={recoveryCode} onChange={(e) => setRecoveryCode(e.target.value)} />
              <label>New password</label>
              <input required minLength={8} maxLength={72} type={showRecoveryPasswords ? "text" : "password"} autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              <label>Confirm new password</label>
              <input required minLength={8} maxLength={72} type={showRecoveryPasswords ? "text" : "password"} autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              <label className="auth-checkbox"><input type="checkbox" checked={showRecoveryPasswords} onChange={(e) => setShowRecoveryPasswords(e.target.checked)} /> Show passwords</label>
              <button type="submit" disabled={loading}>{loading ? "Resetting..." : "Reset Password"}</button>
              <button type="button" className="auth-text-button" disabled={loading} onClick={() => { setRecoveryRequested(false); setMessage(""); }}>Send another code</button>
            </>
          )}
          {message && <p className="auth-message">{message}</p>}
          <button type="button" className="auth-text-button" onClick={() => { setRecoveryMode(false); setRecoveryRequested(false); setMessage(""); }}>Back to login</button>
        </form>
      )}
    </main>
  );
}