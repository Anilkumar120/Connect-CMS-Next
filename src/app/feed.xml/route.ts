import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPostHtml, sanitizePostHtml } from "@/lib/blog-content";
import { getPostPermalink, getSiteSettings } from "@/lib/site-settings";

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cdata(value: string) {
  return `<![CDATA[${value.replace(/\]\]>/g, "]]]]><![CDATA[>")}]]>`;
}

export async function GET() {
  await connection();
  const settings = await getSiteSettings();
  const posts = await prisma.post.findMany({
    where: { status: "PUBLISHED", deletedAt: null, postTypeId: null },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: settings.reading.postsPerFeed,
    include: {
      categories: {
        include: { category: { select: { name: true, slug: true } } },
      },
    },
  });
  const siteUrl = settings.general.siteAddress.replace(/\/+$/, "");
  const items = posts.map((post) => {
    const permalink = getPostPermalink(post, settings);
    const link = new URL(permalink, `${siteUrl}/`).toString();
    const content = settings.reading.feedContent === "full"
      ? sanitizePostHtml(getPostHtml(post.content))
      : post.excerpt || "";
    return `<item><title>${escapeXml(post.title)}</title><link>${escapeXml(link)}</link><guid isPermaLink="true">${escapeXml(link)}</guid><pubDate>${(post.publishedAt || post.createdAt).toUTCString()}</pubDate><description>${cdata(content)}</description></item>`;
  });
  const body = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${escapeXml(settings.general.siteTitle)}</title><link>${escapeXml(siteUrl)}</link><description>${escapeXml(settings.general.tagline || settings.general.siteTitle)}</description>${items.join("")}</channel></rss>`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
