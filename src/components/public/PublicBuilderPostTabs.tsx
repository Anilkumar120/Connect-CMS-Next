import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import PublicPostTabsClient from "./PublicPostTabsClient";
import type { CSSProperties } from "react";

type RawTab = { id?: string; title?: string; categorySlug?: string };
type Props = {
  postType?: string;
  tabs?: RawTab[];
  count?: number;
  columns?: number;
  orderBy?: string;
  order?: string;
  showImage?: boolean;
  showTitle?: boolean;
  showExcerpt?: boolean;
  showDate?: boolean;
  showReadMore?: boolean;
  readMoreText?: string;
  tabNormalColor?: string;
  tabNormalBackground?: string;
  tabHoverColor?: string;
  tabHoverBackground?: string;
  tabActiveColor?: string;
  tabActiveBackground?: string;
  gap?: string;
  imageHeight?: string;
  cardBackground?: string;
  cardBorderColor?: string;
  cardRadius?: string;
  style?: CSSProperties;
};

export default async function PublicBuilderPostTabs(props: Props) {
  const rawTabs = Array.isArray(props.tabs) ? props.tabs.slice(0, 12) : [];
  const postType = props.postType || "post";
  const count = Math.max(1, Math.min(12, Math.floor(Number(props.count) || 4)));
  const order: Prisma.SortOrder = props.order === "asc" ? "asc" : "desc";
  const orderByClause: Prisma.PostOrderByWithRelationInput =
    props.orderBy === "title"
      ? { title: order }
      : props.orderBy === "created"
        ? { createdAt: order }
        : { publishedAt: order };
  const tabs = await Promise.all(rawTabs.map(async (tab, index) => {
    const categorySlug = typeof tab.categorySlug === "string" ? tab.categorySlug.trim() : "";
    const where = {
      status: "PUBLISHED" as const,
      deletedAt: null,
      ...(postType !== "post" ? { postType: { is: { slug: postType } } } : { postTypeId: null }),
      ...(categorySlug ? { categories: { some: { category: { slug: categorySlug } } } } : {}),
    };
    try {
      const posts = await prisma.post.findMany({
        where,
        orderBy: orderByClause,
        take: count,
        select: { id: true, title: true, slug: true, excerpt: true, featuredImage: true, publishedAt: true },
      });
      return {
        id: typeof tab.id === "string" ? tab.id : `tab-${index + 1}`,
        title: typeof tab.title === "string" && tab.title.trim() ? tab.title : `Tab ${index + 1}`,
        posts: posts.map((post: { id: string; title: string; slug: string; excerpt: string | null; featuredImage: string | null; publishedAt: Date | null }) => ({
          ...post,
          publishedAt: post.publishedAt?.toISOString() || null,
          featuredImage: typeof post.featuredImage === "string" ? post.featuredImage : null,
          href: postType !== "post" ? `/content/${encodeURIComponent(postType)}/${encodeURIComponent(post.slug)}` : `/blog/${encodeURIComponent(post.slug)}`,
        })),
      };
    } catch (error) {
      console.error("Public builder post tab query failed:", error);
      return { id: typeof tab.id === "string" ? tab.id : `tab-${index + 1}`, title: typeof tab.title === "string" ? tab.title : `Tab ${index + 1}`, posts: [] };
    }
  }));

  return (
    <PublicPostTabsClient
      tabs={tabs}
      postType={postType}
      columns={props.columns}
      showImage={props.showImage}
      showTitle={props.showTitle}
      showExcerpt={props.showExcerpt}
      showDate={props.showDate}
      showReadMore={props.showReadMore}
      readMoreText={props.readMoreText}
      normalColor={props.tabNormalColor}
      normalBackground={props.tabNormalBackground}
      hoverColor={props.tabHoverColor}
      hoverBackground={props.tabHoverBackground}
      activeColor={props.tabActiveColor}
      activeBackground={props.tabActiveBackground}
      gap={props.gap}
      imageHeight={props.imageHeight}
      cardBackground={props.cardBackground}
      cardBorderColor={props.cardBorderColor}
      cardRadius={props.cardRadius}
      style={props.style}
    />
  );
}
