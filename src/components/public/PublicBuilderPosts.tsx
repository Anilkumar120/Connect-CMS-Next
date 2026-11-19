import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { CSSProperties } from "react";

type Props = {
  postType?: string;
  count?: number;
  columns?: number;
  category?: string;
  orderBy?: string;
  order?: string;
  showImage?: boolean;
  showTitle?: boolean;
  showExcerpt?: boolean;
  showDate?: boolean;
  showReadMore?: boolean;
  readMoreText?: string;
  imageHeight?: string;
  cardBackground?: string;
  cardBorderColor?: string;
  cardRadius?: string;
  gap?: string;
  layout?: "grid" | "carousel";
  className?: string;
  style?: CSSProperties;
};

function safeImage(value: unknown): string {
  if (typeof value !== "string") return "";
  const url = value.trim();
  if (url.startsWith("/") && !url.startsWith("//") && !url.includes("\\")) return url;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? url : "";
  } catch {
    return "";
  }
}

export default async function PublicBuilderPosts({
  postType = "post",
  count = 6,
  columns = 3,
  category = "",
  orderBy = "date",
  order = "desc",
  showImage = true,
  showTitle = true,
  showExcerpt = true,
  showDate = true,
  showReadMore = true,
  readMoreText = "Read More",
  imageHeight = "180px",
  cardBackground = "#ffffff",
  cardBorderColor = "#e2e8f0",
  cardRadius = "8px",
  gap = "18px",
  layout = "grid",
  className,
  style,
}: Props) {
  const safeCount = Math.max(1, Math.min(24, Math.floor(Number(count) || 6)));
  const safeColumns = Math.max(1, Math.min(6, Math.floor(Number(columns) || 3)));
  const direction: Prisma.SortOrder = order === "asc" ? "asc" : "desc";
  const orderByClause: Prisma.PostOrderByWithRelationInput =
    orderBy === "title"
      ? { title: direction }
      : orderBy === "created"
        ? { createdAt: direction }
        : { publishedAt: direction };
  const where: Prisma.PostWhereInput = {
    status: "PUBLISHED" as const,
    deletedAt: null,
    ...(postType && postType !== "post"
      ? { postType: { is: { slug: postType } } }
      : { postTypeId: null }),
    ...(category.trim()
      ? { categories: { some: { category: { slug: category.trim() } } } }
      : {}),
  };
  let posts: Array<{
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    featuredImage: string | null;
    publishedAt: Date | null;
  }> = [];

  try {
    posts = await prisma.post.findMany({
      where,
      orderBy: orderByClause,
      take: safeCount,
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        featuredImage: true,
        publishedAt: true,
      },
    });
  } catch (error) {
    console.error("Public builder posts widget query failed:", error);
  }

  if (!posts.length) {
    return <div className={className} style={style}>No published posts found.</div>;
  }

  const cardStyle: CSSProperties = {
    minWidth: 0,
    overflow: "hidden",
    border: `1px solid ${cardBorderColor}`,
    borderRadius: cardRadius,
    background: cardBackground,
  };

  return (
    <div
      className={className}
      style={{
        ...style,
        display: style?.display || (layout === "carousel" ? "flex" : "grid"),
        flexDirection: style?.flexDirection || ("var(--builder-style-flex-direction, row)" as CSSProperties["flexDirection"]),
        flexWrap: style?.flexWrap || ("var(--builder-style-flex-wrap, nowrap)" as CSSProperties["flexWrap"]),
        gridTemplateColumns: style?.gridTemplateColumns || `var(--builder-style-grid-template-columns, repeat(var(--builder-prop-columns, ${safeColumns}), minmax(0, 1fr)))`,
        gap: style?.gap || `var(--builder-style-gap, var(--builder-prop-gap, ${gap}))`,
        rowGap: style?.rowGap || "var(--builder-style-row-gap, var(--builder-prop-rowGap, inherit))",
        columnGap: style?.columnGap || "var(--builder-style-column-gap, var(--builder-prop-columnGap, inherit))",
        overflowX: layout === "carousel" ? "auto" : style?.overflowX,
        alignItems: style?.alignItems || ("var(--builder-style-align-items, stretch)" as CSSProperties["alignItems"]),
        justifyContent: style?.justifyContent || ("var(--builder-style-justify-content, flex-start)" as CSSProperties["justifyContent"]),
      }}
    >
      {posts.map((post) => {
        const image = safeImage(post.featuredImage);
        const href = postType && postType !== "post"
          ? `/content/${encodeURIComponent(postType)}/${encodeURIComponent(post.slug)}`
          : `/blog/${encodeURIComponent(post.slug)}`;
        return (
          <article key={post.id} style={{ ...cardStyle, ...(layout === "carousel" ? { flex: "0 0 min(82%, 340px)" } : {}) }}>
            {showImage && image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt={post.title} style={{ display: "block", width: "100%", height: imageHeight, objectFit: "cover" }} />
            ) : null}
            <div style={{ padding: 16 }}>
              {showDate && post.publishedAt ? (
                <time dateTime={post.publishedAt.toISOString()} style={{ display: "block", marginBottom: 8, fontSize: 12, opacity: 0.7 }}>
                  {post.publishedAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                </time>
              ) : null}
              {showTitle ? <h3 style={{ margin: "0 0 8px", fontSize: 18, lineHeight: 1.35 }}>{post.title}</h3> : null}
              {showExcerpt && post.excerpt ? <p style={{ margin: "0 0 12px", lineHeight: 1.6 }}>{post.excerpt}</p> : null}
              {showReadMore ? <a href={href} style={{ fontWeight: 600, textDecoration: "none" }}>{readMoreText}</a> : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
