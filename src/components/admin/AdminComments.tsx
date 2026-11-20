"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Edit3, RefreshCw, RotateCcw, Search, ShieldAlert, Trash2, X } from "lucide-react";
import styles from "./AdminComments.module.css";

type CommentStatus = "PENDING" | "APPROVED" | "SPAM";
type CommentItem = {
  id: string; postId: string; authorName: string; authorEmail: string; content: string;
  status: CommentStatus; deletedAt: string | null; createdAt: string; updatedAt: string;
  post: { id: string; title: string; slug: string };
};
type Counts = { all: number; pending: number; approved: number; spam: number; trash: number };
type Editor = { id: string; authorName: string; authorEmail: string; content: string };
const tabs = [{ id: "all", label: "All" }, { id: "pending", label: "Pending" }, { id: "approved", label: "Approved" }, { id: "spam", label: "Spam" }, { id: "trash", label: "Trash" }] as const;

export default function AdminComments() {
  const [view, setView] = useState<(typeof tabs)[number]["id"]>("all");
  const [search, setSearch] = useState("");
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [counts, setCounts] = useState<Counts>({ all: 0, pending: 0, approved: 0, spam: 0, trash: 0 });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editor, setEditor] = useState<Editor | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ view, q: search });
      const response = await fetch(`/api/admin/comments?${params}`, { cache: "no-store" });
      const result = await response.json() as { success: boolean; message?: string; comments?: CommentItem[]; counts?: Counts };
      if (!response.ok || !result.success) throw new Error(result.message || "Unable to load comments.");
      setComments(result.comments || []); setCounts(result.counts || { all: 0, pending: 0, approved: 0, spam: 0, trash: 0 });
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to load comments."); }
    finally { setLoading(false); }
  }, [view, search]);

  useEffect(() => { void load(); }, [load]);

  const action = async (body: Record<string, unknown>, method: "PATCH" | "DELETE" = "PATCH") => {
    const id = String(body.id || ""); setBusyId(id); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/comments", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json() as { success: boolean; message?: string };
      if (!response.ok || !result.success) throw new Error(result.message || "Comment action failed.");
      setNotice(result.message || "Comment updated."); setEditor(null); await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Comment action failed."); }
    finally { setBusyId(""); }
  };

  const filtered = useMemo(() => comments, [comments]);
  const saveEditor = () => editor && void action({ action: "edit", ...editor });

  return (
    <section className={styles.page}>
      <header className={styles.header}><div><span className={styles.eyebrow}>CONTENT MANAGEMENT</span><h1>Comments</h1><p>Review, edit and moderate comments submitted on your blog posts.</p></div><button className={styles.refresh} type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={16}/> Refresh</button></header>
      <nav className={styles.tabs} aria-label="Comment status">{tabs.map((tab) => <button type="button" key={tab.id} className={view === tab.id ? styles.activeTab : ""} onClick={() => setView(tab.id)}>{tab.label}<span>{counts[tab.id]}</span></button>)}</nav>
      <div className={styles.toolbar}><label className={styles.search}><Search size={17}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search comments, authors or posts..." /></label><span>{filtered.length} comments shown</span></div>
      {error && <p className={styles.error}>{error}</p>}{notice && <p className={styles.notice}>{notice}</p>}
      <div className={styles.tableWrap}><table><thead><tr><th>Author</th><th>Comment</th><th>In response to</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {loading ? <tr><td colSpan={6} className={styles.empty}>Loading comments...</td></tr> : filtered.length === 0 ? <tr><td colSpan={6} className={styles.empty}>No comments found.</td></tr> : filtered.map((comment) => <tr key={comment.id}>
          <td><strong>{comment.authorName}</strong><small>{comment.authorEmail}</small></td><td className={styles.commentText}>{comment.content}</td><td>{comment.post.title}</td><td>{new Date(comment.createdAt).toLocaleString()}</td><td><span className={`${styles.status} ${styles[comment.deletedAt ? "trashed" : comment.status.toLowerCase()]}`}>{comment.deletedAt ? "TRASH" : comment.status}</span></td><td><div className={styles.actions}>
            {!comment.deletedAt && comment.status !== "APPROVED" && <button title="Approve" onClick={() => void action({ id: comment.id, action: "approve" })} disabled={!!busyId}><Check size={15}/></button>}
            {!comment.deletedAt && <button title="Edit" onClick={() => setEditor({ id: comment.id, authorName: comment.authorName, authorEmail: comment.authorEmail, content: comment.content })}><Edit3 size={15}/></button>}
            {!comment.deletedAt && comment.status !== "SPAM" && <button title="Mark as spam" onClick={() => void action({ id: comment.id, action: "spam" })} disabled={!!busyId}><ShieldAlert size={15}/></button>}
            {comment.deletedAt ? <><button title="Restore" onClick={() => void action({ id: comment.id, action: "restore" })} disabled={!!busyId}><RotateCcw size={15}/></button><button title="Permanently delete" className={styles.danger} onClick={() => { if (window.confirm("Permanently delete this comment? This cannot be undone.")) void action({ id: comment.id }, "DELETE"); }} disabled={!!busyId}><Trash2 size={15}/></button></> : <button title="Move to trash" className={styles.danger} onClick={() => void action({ id: comment.id, action: "trash" })} disabled={!!busyId}><Trash2 size={15}/></button>}
          </div></td></tr>)}
      </tbody></table></div>
      {editor && <div className={styles.modalBackdrop} onMouseDown={(e) => { if (e.target === e.currentTarget) setEditor(null); }}><form className={styles.modal} onSubmit={(e) => { e.preventDefault(); saveEditor(); }}><header><h2>Edit Comment</h2><button type="button" onClick={() => setEditor(null)}><X size={18}/></button></header><label>Name<input required maxLength={120} value={editor.authorName} onChange={(e) => setEditor({ ...editor, authorName: e.target.value })}/></label><label>Email<input required type="email" maxLength={254} value={editor.authorEmail} onChange={(e) => setEditor({ ...editor, authorEmail: e.target.value })}/></label><label>Comment<textarea required maxLength={5000} rows={6} value={editor.content} onChange={(e) => setEditor({ ...editor, content: e.target.value })}/></label><footer><button type="button" className={styles.cancel} onClick={() => setEditor(null)}>Cancel</button><button type="submit" disabled={!!busyId}>Save Changes</button></footer></form></div>}
    </section>
  );
}
