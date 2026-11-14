
"use client";

import {
  Menu,
  Search,
  Bell,
  Sun,
  UserCircle,
  LogOut,
  User,
  ChevronDown,
} from "lucide-react";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

type AdminUser = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: string;
  isActive: boolean;
};

type AdminTopbarProps = {
  onMenuToggle: () => void;
  user: AdminUser;
};

function formatRole(role: string) {
  return role
    .toLowerCase()
    .split("_")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(" ");
}

export default function AdminTopbar({
  onMenuToggle,
  user,
}: AdminTopbarProps) {
  const router = useRouter();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Logout failed");
      }

      setDropdownOpen(false);
      router.replace("/admin-login");
      router.refresh();
    } catch (error) {
      console.error("Logout error:", error);

      alert(
        error instanceof Error
          ? error.message
          : "Unable to logout. Please try again."
      );

      setLoggingOut(false);
    }
  };

  return (
    <header className="admin-topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="topbar-menu-button"
          onClick={onMenuToggle}
          aria-label="Open menu"
        >
          <Menu size={21} />
        </button>

        <div className="topbar-search">
          <Search size={17} />

          <input
            type="search"
            placeholder="Search anything..."
            aria-label="Search admin panel"
          />

          <span>Ctrl K</span>
        </div>
      </div>

      <div className="topbar-actions">
        <button
          type="button"
          className="topbar-icon-button"
          aria-label="Light theme"
          title="Theme settings will be added later"
        >
          <Sun size={19} />
        </button>

        <button
          type="button"
          className="topbar-icon-button notification-button"
          aria-label="Notifications"
        >
          <Bell size={19} />
          <span className="notification-dot" />
        </button>

        {/* Profile Dropdown */}
        <div
          className={`topbar-profile-dropdown ${
            dropdownOpen ? "dropdown-open" : ""
          }`}
        >
          <button
            type="button"
            className="topbar-profile"
            onClick={() => setDropdownOpen((open) => !open)}
            aria-expanded={dropdownOpen}
            aria-haspopup="menu"
            title="Account menu"
          >
            <span className="profile-avatar">
              <UserCircle size={25} />
            </span>

            <span className="profile-details">
              <strong>{user.name}</strong>
              <small>{formatRole(user.role)}</small>
            </span>

            <ChevronDown
              size={15}
              className="profile-chevron"
            />
          </button>

          {dropdownOpen && (
            <>
              <button
                type="button"
                className="profile-dropdown-backdrop"
                aria-label="Close profile menu"
                onClick={() => setDropdownOpen(false)}
              />

              <div className="profile-dropdown-menu" role="menu">
                <div className="profile-dropdown-header">
                  <div className="profile-dropdown-avatar">
                    <UserCircle size={34} />
                  </div>

                  <div className="profile-dropdown-user">
                    <strong>{user.name}</strong>
                    <span>{user.email}</span>
                    <small>{formatRole(user.role)}</small>
                  </div>
                </div>

                <div className="profile-dropdown-divider" />

                <Link
                  href="/admin/profile"
                  className="profile-dropdown-item"
                  role="menuitem"
                  onClick={() => setDropdownOpen(false)}
                >
                  <User size={17} />
                  <span>My Profile</span>
                </Link>

                <div className="profile-dropdown-divider" />

                <button
                  type="button"
                  className="profile-dropdown-item logout-dropdown-item"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  role="menuitem"
                >
                  <LogOut size={17} />
                  <span>
                    {loggingOut ? "Logging out..." : "Logout"}
                  </span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
