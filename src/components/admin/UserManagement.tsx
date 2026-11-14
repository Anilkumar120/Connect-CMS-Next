"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ImagePlus, Pencil, Plus, Search, Trash2, UserRound } from "lucide-react";
import Link from "next/link";
import MediaPickerModal, { type MediaPickerItem } from "@/components/admin/MediaPickerModal";
import styles from "./UserManagement.module.css";

type UserRole = "SUPER_ADMIN" | "ADMIN" | "EDITOR" | "AUTHOR" | "CONTRIBUTOR" | "SEO_MANAGER" | "WEB_DESIGNER";
type ManagedUser = {
  id: string;
  name: string;
  username: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
};
type Draft = {
  name: string;
  username: string;
  email: string;
  phone: string;
  avatarUrl: string | null;
  role: UserRole;
  password: string;
  isActive: boolean;
};

const blankDraft: Draft = {
  name: "",
  username: "",
  email: "",
  phone: "",
  avatarUrl: null,
  role: "EDITOR",
  password: "",
  isActive: true,
};

const allRoles: UserRole[] = [
  "SUPER_ADMIN", "ADMIN", "EDITOR", "AUTHOR", "CONTRIBUTOR", "SEO_MANAGER", "WEB_DESIGNER",
];

async function requestJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.success === false) {
    throw new Error(result.message || "Request failed.");
  }
  return result;
}

export default function UserManagement({ actorId, actorRole }: { actorId: string; actorRole: UserRole }) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [formOpen, setFormOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const isSuperAdmin = actorRole === "SUPER_ADMIN";

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await requestJson("/api/admin/users", { cache: "no-store" });
      setUsers(result.users);
      setSelectedIds([]);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadUsers(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadUsers]);

  const visibleUsers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return users;
    return users.filter((user) =>
      [user.name, user.username, user.email, user.phone || "", user.role]
        .some((value) => value.toLowerCase().includes(needle))
    );
  }, [search, users]);

  const mayManage = (user: ManagedUser) =>
    user.id !== actorId &&
    (isSuperAdmin || (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN"));

  const beginCreate = () => {
    setFormOpen(true);
    setEditing(null);
    setDraft({ ...blankDraft });
    setShowPassword(false);
    setMessage("");
    setError("");
  };

  const beginEdit = (user: ManagedUser) => {
    setFormOpen(true);
    setEditing(user);
    setDraft({
      name: user.name,
      username: user.username,
      email: user.email,
      phone: user.phone || "",
      avatarUrl: user.avatarUrl,
      role: user.role,
      password: "",
      isActive: user.isActive,
    });
    setMessage("");
    setError("");
  };

  const saveUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        name: draft.name,
        username: draft.username,
        email: draft.email,
        phone: draft.phone,
        avatarUrl: draft.avatarUrl,
        role: draft.role,
        isActive: draft.isActive,
        ...(!editing ? { password: draft.password } : {}),
      };
      await requestJson(editing ? `/api/admin/users/${editing.id}` : "/api/admin/users", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setMessage(editing ? "User updated." : "User created.");
      setEditing(null);
      setFormOpen(false);
      setDraft({ ...blankDraft });
      await loadUsers();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save user.");
    } finally {
      setSaving(false);
    }
  };

  const runBulkAction = async (action: "activate" | "deactivate" | "delete") => {
    if (!selectedIds.length) return;
    if (action === "delete" && !window.confirm(`Permanently delete ${selectedIds.length} selected user(s)?`)) return;
    setError("");
    setMessage("");
    try {
      const result = await requestJson("/api/admin/users/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, action }),
      });
      setMessage(`${result.count} user(s) ${action === "delete" ? "deleted" : `${action}d`}.`);
      await loadUsers();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Bulk action failed.");
    }
  };

  const deleteUser = async (user: ManagedUser) => {
    if (!window.confirm(`Permanently delete ${user.name}?`)) return;
    try {
      await requestJson(`/api/admin/users/${user.id}`, { method: "DELETE" });
      setMessage("User deleted.");
      await loadUsers();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to delete user.");
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => current.includes(id)
      ? current.filter((value) => value !== id)
      : [...current, id]);
  };
  const selectableVisibleUsers = visibleUsers.filter(mayManage);
  const allVisibleSelected = selectableVisibleUsers.length > 0 &&
    selectableVisibleUsers.every((user) => selectedIds.includes(user.id));

  const handleMediaSelect = (item: MediaPickerItem) => {
    setDraft((current) => ({ ...current, avatarUrl: item.url }));
  };

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>ACCOUNT MANAGEMENT</span>
          <h1>Users</h1>
          <p>Create accounts, assign roles, and manage access.</p>
        </div>
        <div className={styles.headingActions}>
          <Link className={styles.secondaryButton} href="/admin/profile">My Profile</Link>
          <button type="button" className={styles.primaryButton} onClick={beginCreate}>
            <Plus size={17} /> Add User
          </button>
        </div>
      </header>

      {message && <div className={styles.success} role="status">{message}</div>}
      {error && <div className={styles.error} role="alert">{error}</div>}

      <section className={styles.panel}>
        <div className={styles.toolbar}>
          <label className={styles.search}>
            <Search size={17} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search users" />
          </label>
          <span className={styles.total}>{users.length} total</span>
        </div>

        {selectedIds.length > 0 && (
          <div className={styles.bulkBar}>
            <span>{selectedIds.length} selected</span>
            <button type="button" onClick={() => void runBulkAction("activate")}>Activate</button>
            <button type="button" onClick={() => void runBulkAction("deactivate")}>Deactivate</button>
            <button type="button" className={styles.dangerText} onClick={() => void runBulkAction("delete")}>Delete</button>
          </div>
        )}

        {loading ? <p className={styles.empty}>Loading users...</p> : visibleUsers.length === 0 ? (
          <p className={styles.empty}>{search ? "No users match your search." : "No users have been added."}</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th><input type="checkbox" aria-label="Select all visible users" checked={allVisibleSelected}
                    onChange={() => setSelectedIds(allVisibleSelected
                      ? selectedIds.filter((id) => !selectableVisibleUsers.some((user) => user.id === id))
                      : [...new Set([...selectedIds, ...selectableVisibleUsers.map((user) => user.id)])])} /></th>
                  <th>User</th><th>Username</th><th>Role</th><th>Status</th><th>Created</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map((user) => (
                  <tr key={user.id}>
                    <td><input type="checkbox" aria-label={`Select ${user.name}`} checked={selectedIds.includes(user.id)}
                      disabled={!mayManage(user)} onChange={() => toggleSelected(user.id)} /></td>
                    <td>
                      <div className={styles.identity}>
                        {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <span className={styles.avatar}><UserRound size={18} /></span>}
                        <span><strong>{user.name}</strong><small>{user.email}{user.phone ? ` · ${user.phone}` : ""}</small></span>
                      </div>
                    </td>
                    <td>{user.username}</td>
                    <td><span className={styles.role}>{user.role.replaceAll("_", " ")}</span></td>
                    <td><span className={`${styles.status} ${user.isActive ? styles.active : styles.inactive}`}>
                      {user.isActive ? "Active" : "Inactive"}
                    </span></td>
                    <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                    <td>
                      <div className={styles.rowActions}>
                        {mayManage(user) ? <>
                          <button type="button" aria-label={`Edit ${user.name}`} onClick={() => beginEdit(user)}><Pencil size={16} /></button>
                          <button type="button" aria-label={`Delete ${user.name}`} className={styles.dangerText} onClick={() => void deleteUser(user)}><Trash2 size={16} /></button>
                        </> : <span className={styles.protected}>Protected</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {formOpen && (
        <div className={styles.formPanel} id="user-form">
          <div className={styles.formHeading}>
            <div><h2>{editing ? "Edit User" : "Create User"}</h2><p>{editing ? "Update account information and access." : "Create a user account with an initial password."}</p></div>
            <button type="button" onClick={() => { setEditing(null); setDraft({ ...blankDraft }); setFormOpen(false); }}>Close</button>
          </div>
          <form onSubmit={saveUser} className={styles.form}>
            <div className={styles.photoField}>
              {draft.avatarUrl ? <img src={draft.avatarUrl} alt="Selected profile" /> : <span><UserRound size={28} /></span>}
              <div><strong>Profile photo</strong><small>Select an image from the media library.</small>
                <button type="button" className={styles.secondaryButton} onClick={() => setMediaOpen(true)}><ImagePlus size={16} /> Choose photo</button>
                {draft.avatarUrl && <button type="button" className={styles.linkButton} onClick={() => setDraft((value) => ({ ...value, avatarUrl: null }))}>Remove photo</button>}
              </div>
            </div>
            <div className={styles.fields}>
              <label>Full name<input required maxLength={100} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
              <label>Username<input required minLength={3} maxLength={50} autoComplete="off" value={draft.username} onChange={(e) => setDraft({ ...draft, username: e.target.value })} /></label>
              <label>Email<input required type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></label>
              <label>Phone <small>Optional; use international format.</small><input type="tel" placeholder="+14155550123" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} /></label>
              <label>Role<select value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as UserRole })}>
                {allRoles.filter((role) => isSuperAdmin || (role !== "SUPER_ADMIN" && role !== "ADMIN")).map((role) => <option key={role} value={role}>{role.replaceAll("_", " ")}</option>)}
              </select></label>
              <label className={styles.checkboxField}><input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} /> Account is active</label>
              {!editing && <label className={styles.passwordField}>Initial password
                <span className={styles.passwordInput}><input required minLength={8} maxLength={72} type={showPassword ? "text" : "password"} autoComplete="new-password" value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} /><button type="button" onClick={() => setShowPassword((shown) => !shown)}>{showPassword ? "Hide" : "Show"}</button></span>
              </label>}
            </div>
            <div className={styles.formActions}>
              <button type="button" className={styles.secondaryButton} onClick={() => { setEditing(null); setDraft({ ...blankDraft }); setFormOpen(false); }}>Cancel</button>
              <button type="submit" className={styles.primaryButton} disabled={saving}>{saving ? "Saving..." : editing ? "Save Changes" : "Create User"}</button>
            </div>
          </form>
        </div>
      )}

      <MediaPickerModal open={mediaOpen} onClose={() => setMediaOpen(false)} onSelect={handleMediaSelect} />
    </div>
  );
}
