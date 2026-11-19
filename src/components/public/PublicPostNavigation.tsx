import Link from "next/link";
import { prisma } from "@/lib/prisma";

type Props = {
  postId: string;
  postTypeId?: string | null;
  publishedAt?: Date | null;
  prefix?: string;
  showPrevious?: boolean;
  showNext?: boolean;
  previousText?: string;
  nextText?: string;
};

export default async function PublicPostNavigation({
  postId,
  postTypeId,
  publishedAt,
  prefix = "/blog",
  showPrevious = true,
  showNext = true,
  previousText = "Previous Post",
  nextText = "Next Post",
}: Props) {
  if (!publishedAt) return null;
  const scope = { status: "PUBLISHED" as const, deletedAt: null, postTypeId: postTypeId || null };
  const [previous, next] = await Promise.all([
    showPrevious ? prisma.post.findFirst({ where: { ...scope, publishedAt: { lt: publishedAt }, NOT: { id: postId } }, orderBy: { publishedAt: "desc" }, select: { title: true, slug: true } }) : null,
    showNext ? prisma.post.findFirst({ where: { ...scope, publishedAt: { gt: publishedAt }, NOT: { id: postId } }, orderBy: { publishedAt: "asc" }, select: { title: true, slug: true } }) : null,
  ]);
  if (!previous && !next) return null;
  return <nav aria-label="Post navigation" style={{ display: "flex", justifyContent: "space-between", gap: 16, margin: "30px 0" }}>
    {previous ? <Link href={`${prefix}/${encodeURIComponent(previous.slug)}`} style={{ textDecoration: "none" }}><small>{previousText}</small><strong style={{ display: "block" }}>{previous.title}</strong></Link> : <span />}
    {next ? <Link href={`${prefix}/${encodeURIComponent(next.slug)}`} style={{ textDecoration: "none", textAlign: "right" }}><small>{nextText}</small><strong style={{ display: "block" }}>{next.title}</strong></Link> : <span />}
  </nav>;
}
