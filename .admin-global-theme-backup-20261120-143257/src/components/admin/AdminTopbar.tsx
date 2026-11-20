"use client";

import {
  Menu, Search, Bell, Sun, Moon, UserCircle, LogOut, User, ChevronDown,
  X, CheckCheck, Palette, Loader2, ArrowUpRight, FileText, Newspaper,
  Images, ClipboardList, MessageSquare,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import styles from "./AdminTopbar.module.css";

type AdminUser = { id: string; name: string; username: string; email: string; avatarUrl: string | null; role: string; isActive: boolean };
type AdminTopbarProps = { onMenuToggle: () => void; user: AdminUser };
type ThemePreferences = {
  mode: "light" | "dark" | "system";
  primaryColor: string;
  accentColor: string;
  buttonColor: string;
  buttonTextColor: string;
  buttonHoverColor: string;
};
type SearchResult = { id: string; title: string; subtitle: string; type: string; href: string };
type NotificationItem = { id: string; title: string; message: string; href: string; readAt: string | null; createdAt: string; sourceType: string };

const defaultTheme: ThemePreferences = {
  mode: "light", primaryColor: "#0c2f55", accentColor: "#3984e8",
  buttonColor: "#3984e8", buttonTextColor: "#ffffff", buttonHoverColor: "#2c6fcb",
};

function formatRole(role: string) {
  return role.toLowerCase().split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

function timeAgo(value: string) {
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function AdminTopbar({ onMenuToggle, user }: AdminTopbarProps) {
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchError, setSearchError] = useState("");
  const [themeOpen, setThemeOpen] = useState(false);
  const [theme, setTheme] = useState<ThemePreferences>(defaultTheme);
  const [themeSaving, setThemeSaving] = useState(false);
  const [themeMessage, setThemeMessage] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationError, setNotificationError] = useState("");

  useEffect(() => setAvatarError(false), [user.avatarUrl]);

  const loadNotifications = useCallback(async () => {
    setNotificationsLoading(true);
    try {
      const response = await fetch("/api/admin/notifications", { cache: "no-store" });
      const result = await response.json() as { success: boolean; notifications?: NotificationItem[]; unreadCount?: number; message?: string };
      if (!response.ok || !result.success) throw new Error(result.message || "Unable to load notifications.");
      setNotifications(result.notifications || []);
      setUnreadCount(result.unreadCount || 0);
      setNotificationError("");
    } catch (error) {
      setNotificationError(error instanceof Error ? error.message : "Unable to load notifications.");
    } finally { setNotificationsLoading(false); }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/theme/preferences", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as { success: boolean; preferences?: ThemePreferences };
        if (active && response.ok && result.success && result.preferences) setTheme({ ...defaultTheme, ...result.preferences });
      })
      .catch((error) => console.error("Load admin theme failed:", error));
    void loadNotifications();
    const interval = window.setInterval(() => void loadNotifications(), 30000);
    return () => { active = false; window.clearInterval(interval); };
  }, [loadNotifications]);

  useEffect(() => {
    const shell = document.querySelector<HTMLElement>(".admin-shell");
    if (shell) {
      shell.style.setProperty("--admin-primary", theme.primaryColor);
      shell.style.setProperty("--admin-accent", theme.accentColor);
      shell.style.setProperty("--admin-button-bg", theme.buttonColor);
      shell.style.setProperty("--admin-button-text", theme.buttonTextColor);
      shell.style.setProperty("--admin-button-hover", theme.buttonHoverColor);
    }
    const prefersDark = typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.dataset.adminTheme = theme.mode === "system" ? (prefersDark ? "dark" : "light") : theme.mode;
  }, [theme]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); setSearchOpen(true);
        window.setTimeout(() => document.getElementById("admin-global-search")?.focus(), 0);
      }
      if (event.key === "Escape") {
        setSearchOpen(false); setThemeOpen(false); setNotificationsOpen(false); setDropdownOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) { setSearchResults([]); setSearchLoading(false); setSearchError(""); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearchLoading(true); setSearchError("");
      try {
        const response = await fetch(`/api/admin/search?q=${encodeURIComponent(q)}`, { cache: "no-store", signal: controller.signal });
        const result = await response.json() as { success: boolean; results?: SearchResult[]; message?: string };
        if (!response.ok || !result.success) throw new Error(result.message || "Search failed.");
        setSearchResults(result.results || []);
      } catch (error) {
        if (!controller.signal.aborted) setSearchError(error instanceof Error ? error.message : "Search failed.");
      } finally { if (!controller.signal.aborted) setSearchLoading(false); }
    }, 220);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [search]);

  const saveTheme = async () => {
    setThemeSaving(true); setThemeMessage("");
    try {
      const response = await fetch("/api/admin/theme/preferences", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(theme),
      });
      const result = await response.json() as { success: boolean; message?: string };
      if (!response.ok || !result.success) throw new Error(result.message || "Unable to save theme.");
      setThemeMessage("Theme saved successfully.");
    } catch (error) { setThemeMessage(error instanceof Error ? error.message : "Unable to save theme."); }
    finally { setThemeSaving(false); }
  };

  const markNotificationRead = async (item: NotificationItem) => {
    if (!item.readAt) {
      try {
        await fetch("/api/admin/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id }) });
      } catch (error) { console.error("Mark notification read failed:", error); }
    }
    setNotificationsOpen(false); setNotifications((current) => current.map((entry) => entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry));
    setUnreadCount((count) => item.readAt ? count : Math.max(0, count - 1));
    router.push(item.href);
  };

  const markAllRead = async () => {
    try {
      const response = await fetch("/api/admin/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ markAllRead: true }) });
      const result = await response.json() as { success: boolean; message?: string };
      if (!response.ok || !result.success) throw new Error(result.message || "Unable to update notifications.");
      setNotifications((current) => current.map((item) => ({ ...item, readAt: new Date().toISOString() })));
      setUnreadCount(0);
    } catch (error) { setNotificationError(error instanceof Error ? error.message : "Unable to update notifications."); }
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Logout failed");
      setDropdownOpen(false); router.replace("/admin-login"); router.refresh();
    } catch (error) {
      console.error("Logout error:", error);
      alert(error instanceof Error ? error.message : "Unable to logout. Please try again.");
      setLoggingOut(false);
    }
  };

  const ProfileAvatar = ({ size = 25, className = "" }: { size?: number; className?: string }) => {
    if (user.avatarUrl && !avatarError) return <img key={user.avatarUrl} src={user.avatarUrl} alt={`${user.name}'s profile`} className={`admin-user-avatar-image ${className}`} width={size} height={size} onError={() => setAvatarError(true)} />;
    return <UserCircle size={size} className={className} strokeWidth={1.7} />;
  };

  const resultIcon = (type: string) => type === "Post" ? <Newspaper size={16}/> : type === "Media" ? <Images size={16}/> : type === "Form" ? <ClipboardList size={16}/> : type === "Comment" ? <MessageSquare size={16}/> : <FileText size={16}/>;

  return (
    <header className="admin-topbar">
      <div className="topbar-left">
        <button type="button" className="topbar-menu-button" onClick={onMenuToggle} aria-label="Open menu"><Menu size={21}/></button>
        <div className={`topbar-search ${styles.searchBox}`}>
          <Search size={17}/>
          <input id="admin-global-search" type="search" placeholder="Search pages, posts, media..." aria-label="Search admin panel" value={search} onFocus={() => setSearchOpen(true)} onChange={(event) => { setSearch(event.target.value); setSearchOpen(true); }}/>
          <button type="button" className={styles.shortcut} onClick={() => { setSearchOpen(true); document.getElementById("admin-global-search")?.focus(); }}>Ctrl K</button>
          {searchOpen && <div className={styles.popover}>
            <div className={styles.popoverHeader}><strong>Global Search</strong><button type="button" onClick={() => { setSearchOpen(false); setSearch(""); }} aria-label="Close search"><X size={15}/></button></div>
            {search.trim().length < 2 ? <p className={styles.hint}>Type at least 2 characters to search pages, posts, media, forms and comments.</p> : searchLoading ? <p className={styles.hint}><Loader2 className={styles.spin} size={15}/> Searching...</p> : searchError ? <p className={styles.error}>{searchError}</p> : searchResults.length ? <div className={styles.resultList}>{searchResults.map((item) => <button type="button" key={`${item.type}-${item.id}`} className={styles.result} onClick={() => { setSearchOpen(false); setSearch(""); router.push(item.href); }}><span className={styles.resultIcon}>{resultIcon(item.type)}</span><span className={styles.resultText}><strong>{item.title}</strong><small>{item.subtitle}</small></span><span className={styles.resultType}>{item.type}</span><ArrowUpRight size={14}/></button>)}</div> : <p className={styles.hint}>No matching content found.</p>}
          </div>}
        </div>
      </div>

      <div className="topbar-actions">
        <div className={styles.actionWrap}>
          <button type="button" className="topbar-icon-button" aria-label="Theme settings" title="Theme settings" onClick={() => { setThemeOpen((open) => !open); setNotificationsOpen(false); }}><Palette size={19}/></button>
          {themeOpen && <div className={`${styles.popover} ${styles.themePopover}`}>
            <div className={styles.popoverHeader}><strong>Admin Theme</strong><button type="button" onClick={() => setThemeOpen(false)} aria-label="Close theme settings"><X size={15}/></button></div>
            <label className={styles.field}>Appearance<select value={theme.mode} onChange={(e) => setTheme({ ...theme, mode: e.target.value as ThemePreferences["mode"] })}><option value="light">Light</option><option value="dark">Dark</option><option value="system">System</option></select></label>
            <div className={styles.colorGrid}>
              {([ ["Sidebar / Primary", "primaryColor"], ["Accent", "accentColor"], ["Button", "buttonColor"], ["Button Text", "buttonTextColor"], ["Button Hover", "buttonHoverColor"] ] as const).map(([label, key]) => <label className={styles.colorField} key={key}>{label}<input type="color" value={theme[key]} onChange={(e) => setTheme({ ...theme, [key]: e.target.value })}/><code>{theme[key]}</code></label>)}
            </div>
            {themeMessage && <p className={styles.hint}>{themeMessage}</p>}
            <button type="button" className={styles.saveButton} onClick={() => void saveTheme()} disabled={themeSaving}>{themeSaving ? "Saving..." : "Save Theme"}</button>
          </div>}
        </div>

        <div className={styles.actionWrap}>
          <button type="button" className={`topbar-icon-button notification-button ${styles.bellButton}`} aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`} onClick={() => { setNotificationsOpen((open) => !open); setThemeOpen(false); if (!notificationsOpen) void loadNotifications(); }}><Bell size={19}/>{unreadCount > 0 && <span className={styles.badge}>{unreadCount > 99 ? "99+" : unreadCount}</span>}</button>
          {notificationsOpen && <div className={`${styles.popover} ${styles.notificationPopover}`}>
            <div className={styles.popoverHeader}><strong>Notifications {unreadCount > 0 && <span className={styles.unreadLabel}>{unreadCount} new</span>}</strong><div className={styles.headerActions}><button type="button" onClick={() => void loadNotifications()} title="Refresh"><Loader2 size={14}/></button><button type="button" onClick={() => setNotificationsOpen(false)} aria-label="Close notifications"><X size={15}/></button></div></div>
            {unreadCount > 0 && <button type="button" className={styles.markAll} onClick={() => void markAllRead()}><CheckCheck size={14}/> Mark all as read</button>}
            {notificationError && <p className={styles.error}>{notificationError}</p>}
            <div className={styles.notificationList}>{notificationsLoading && !notifications.length ? <p className={styles.hint}>Loading notifications...</p> : notifications.length ? notifications.map((item) => <button type="button" key={item.id} className={`${styles.notificationItem} ${!item.readAt ? styles.unread : ""}`} onClick={() => void markNotificationRead(item)}><span className={styles.notificationIcon}>{item.sourceType === "COMMENT" ? <MessageSquare size={16}/> : item.sourceType === "PAYMENT_REQUEST" ? <ArrowUpRight size={16}/> : <ClipboardList size={16}/>}</span><span className={styles.notificationText}><strong>{item.title}</strong><small>{item.message}</small><time>{timeAgo(item.createdAt)}</time></span>{!item.readAt && <i/>}</button>) : <p className={styles.hint}>You are all caught up. No notifications yet.</p>}</div>
          </div>}
        </div>

        <div className={`topbar-profile-dropdown ${dropdownOpen ? "dropdown-open" : ""}`}>
          <button type="button" className="topbar-profile" onClick={() => setDropdownOpen((open) => !open)} aria-expanded={dropdownOpen} aria-haspopup="menu" title="Account menu">
            <span className="profile-avatar"><ProfileAvatar size={25}/></span><span className="profile-details"><strong>{user.name}</strong><small>{formatRole(user.role)}</small></span><ChevronDown size={15} className="profile-chevron"/>
          </button>
          {dropdownOpen && <><button type="button" className="profile-dropdown-backdrop" aria-label="Close profile menu" onClick={() => setDropdownOpen(false)}/><div className="profile-dropdown-menu" role="menu">
            <div className="profile-dropdown-header"><div className="profile-dropdown-avatar"><ProfileAvatar size={34}/></div><div className="profile-dropdown-user"><strong>{user.name}</strong><span>{user.email}</span><small>{formatRole(user.role)}</small></div></div>
            <div className="profile-dropdown-divider"/><Link href="/admin/profile" className="profile-dropdown-item" role="menuitem" onClick={() => setDropdownOpen(false)}><User size={17}/><span>My Profile</span></Link><div className="profile-dropdown-divider"/>
            <button type="button" className="profile-dropdown-item logout-dropdown-item" onClick={handleLogout} disabled={loggingOut} role="menuitem"><LogOut size={17}/><span>{loggingOut ? "Logging out..." : "Logout"}</span></button>
          </div></>}
        </div>
      </div>
    </header>
  );
}
