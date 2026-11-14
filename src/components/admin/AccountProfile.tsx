"use client";

import { useEffect, useState } from "react";
import { ImagePlus, UserRound } from "lucide-react";
import Link from "next/link";
import MediaPickerModal, { type MediaPickerItem } from "@/components/admin/MediaPickerModal";
import styles from "./AccountProfile.module.css";

type ProfileData = {
  id: string;
  name: string;
  username: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  role: string;
};

async function requestJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.success === false) {
    throw new Error(result.message || "Request failed.");
  }
  return result;
}

export default function AccountProfile() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState(false);
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    requestJson("/api/account/profile", { cache: "no-store" })
      .then((result) => setProfile(result.profile))
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load your profile."))
      .finally(() => setLoading(false));
  }, []);

  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;
    setSavingProfile(true);
    setMessage("");
    setError("");
    try {
      const result = await requestJson("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      setProfile(result.profile);
      setMessage("Profile updated.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update your profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setError("");
    if (passwords.newPassword !== passwords.confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }
    setSavingPassword(true);
    try {
      const result = await requestJson("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwords.currentPassword,
          newPassword: passwords.newPassword,
        }),
      });
      setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setMessage(result.message || "Password updated.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update your password.");
    } finally {
      setSavingPassword(false);
    }
  };

  const selectAvatar = (item: MediaPickerItem) => {
    setProfile((current) => current ? { ...current, avatarUrl: item.url } : current);
  };

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <div><span className={styles.eyebrow}>ACCOUNT</span><h1>My Profile</h1><p>Update your details and sign-in password.</p></div>
        {profile && (profile.role === "SUPER_ADMIN" || profile.role === "ADMIN") && (
          <Link href="/admin/users" className={styles.backLink}>Manage Users</Link>
        )}
      </header>
      {message && <div className={styles.success} role="status">{message}</div>}
      {error && <div className={styles.error} role="alert">{error}</div>}
      {loading ? <div className={styles.panel}>Loading profile...</div> : !profile ? null : (
        <div className={styles.grid}>
          <section className={styles.panel}>
            <div className={styles.sectionHeading}><h2>Profile Information</h2><p>These details are associated with your account.</p></div>
            <form onSubmit={saveProfile}>
              <div className={styles.avatarRow}>
                {profile.avatarUrl ? <img src={profile.avatarUrl} alt="Your profile" /> : <span className={styles.avatarPlaceholder}><UserRound size={30} /></span>}
                <div><strong>Profile photo</strong><p>Choose an image from the media library.</p>
                  <button type="button" className={styles.secondaryButton} onClick={() => setMediaOpen(true)}><ImagePlus size={16} /> Choose photo</button>
                  {profile.avatarUrl && <button type="button" className={styles.removePhoto} onClick={() => setProfile({ ...profile, avatarUrl: null })}>Remove</button>}
                </div>
              </div>
              <label>Full name<input required maxLength={100} value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></label>
              <label>Username<input required minLength={3} maxLength={50} value={profile.username} onChange={(e) => setProfile({ ...profile, username: e.target.value })} /></label>
              <label>Email<input required type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} /></label>
              <label>Phone <small>Optional; use international format.</small><input type="tel" placeholder="+14155550123" value={profile.phone || ""} onChange={(e) => setProfile({ ...profile, phone: e.target.value || null })} /></label>
              <div className={styles.roleRow}><span>Account role</span><strong>{profile.role.replaceAll("_", " ")}</strong></div>
              <button type="submit" className={styles.primaryButton} disabled={savingProfile}>{savingProfile ? "Saving..." : "Save Profile"}</button>
            </form>
          </section>

          <section className={styles.panel}>
            <div className={styles.sectionHeading}><h2>Change Password</h2><p>Use your current password to set a new one.</p></div>
            <form onSubmit={savePassword}>
              <label>Current password<input required type={visiblePasswords ? "text" : "password"} autoComplete="current-password" value={passwords.currentPassword} onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })} /></label>
              <label>New password <small>At least 8 characters.</small><input required minLength={8} maxLength={72} type={visiblePasswords ? "text" : "password"} autoComplete="new-password" value={passwords.newPassword} onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })} /></label>
              <label>Confirm new password<input required minLength={8} maxLength={72} type={visiblePasswords ? "text" : "password"} autoComplete="new-password" value={passwords.confirmPassword} onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })} /></label>
              <label className={styles.showPassword}><input type="checkbox" checked={visiblePasswords} onChange={(e) => setVisiblePasswords(e.target.checked)} /> Show passwords</label>
              <button type="submit" className={styles.primaryButton} disabled={savingPassword}>{savingPassword ? "Updating..." : "Update Password"}</button>
            </form>
          </section>
        </div>
      )}
      <MediaPickerModal open={mediaOpen} onClose={() => setMediaOpen(false)} onSelect={selectAvatar} />
    </div>
  );
}
