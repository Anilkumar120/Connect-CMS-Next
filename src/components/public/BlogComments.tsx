"use client";

import { useState, type FormEvent } from "react";
import styles from "./BlogComments.module.css";

type CommentItem = { id: string; authorName: string; content: string; createdAt: string };

export default function BlogComments({ postSlug, comments }: { postSlug: string; comments: CommentItem[] }) {
  const [authorName, setAuthorName] = useState("");
  const [authorEmail, setAuthorEmail] = useState("");
  const [content, setContent] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setMessage(""); setError(false);
    try {
      const response = await fetch(`/api/public/posts/${encodeURIComponent(postSlug)}/comments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorName, authorEmail, content, website }),
      });
      const result = await response.json() as { success: boolean; message?: string };
      if (!response.ok || !result.success) throw new Error(result.message || "Unable to submit comment.");
      setMessage(result.message || "Comment submitted for review.");
      setAuthorName(""); setAuthorEmail(""); setContent(""); setWebsite("");
    } catch (err) {
      setError(true); setMessage(err instanceof Error ? err.message : "Unable to submit comment.");
    } finally { setBusy(false); }
  }

  return (
    <section className={styles.comments} aria-labelledby="comments-title">
      <h2 id="comments-title">Comments ({comments.length})</h2>
      {comments.length ? <div className={styles.list}>{comments.map((comment) => (
        <article className={styles.comment} key={comment.id}>
          <strong>{comment.authorName}</strong>
          <time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleDateString()}</time>
          <p>{comment.content}</p>
        </article>
      ))}</div> : <p className={styles.empty}>No comments yet. Be the first to comment.</p>}

      <form className={styles.form} onSubmit={submit}>
        <h3>Leave a Comment</h3>
        <p>Your email address will not be published. Comments are reviewed before appearing.</p>
        <div className={styles.fields}>
          <label>Name<input required maxLength={120} value={authorName} onChange={(e) => setAuthorName(e.target.value)} autoComplete="name" /></label>
          <label>Email<input required type="email" maxLength={254} value={authorEmail} onChange={(e) => setAuthorEmail(e.target.value)} autoComplete="email" /></label>
        </div>
        <label>Comment<textarea required minLength={3} maxLength={5000} rows={5} value={content} onChange={(e) => setContent(e.target.value)} /></label>
        <label className={styles.honeypot} aria-hidden="true">Leave this field empty<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
        {message && <p className={error ? styles.error : styles.success} role="status">{message}</p>}
        <button type="submit" disabled={busy}>{busy ? "Submitting..." : "Post Comment"}</button>
      </form>
    </section>
  );
}
