import { prisma } from "@/lib/prisma";
import { getPostPermalink, getSiteSettings } from "@/lib/site-settings";
import type { BuilderGlobalStyles, BuilderLayout, BuilderNode } from "@/lib/builder/types";

export type PublicBuilderDocumentData = {
  layout: BuilderLayout;
  globalStyles: BuilderGlobalStyles | null;
};
type PublicKind = "header" | "footer";
type ConditionsShape = {
  include?: unknown;
  exclude?: unknown;
  rules?: unknown;
};
type RuleAction = "include" | "exclude";
type SemanticCondition = {
  action: RuleAction;
  type: string;
  id?: string;
  slug?: string;
  path?: string;
};
type MatchContext = {
  pagePaths: Map<string, string>;
  postPaths: Map<string, string>;
  customPostPaths: Map<string, string>;
  customTypeSlugs: Set<string>;
  categorySlugs: Map<string, string>;
  tagSlugs: Map<string, string>;
};

function isBuilderNode(value: unknown, depth: number, count: { value: number }): value is BuilderNode {
  if (depth > 20 || !value || typeof value !== "object" || Array.isArray(value)) return false;
  const node = value as Record<string, unknown>;
  count.value += 1;
  if (count.value > 500 || typeof node.id !== "string" || typeof node.type !== "string" || typeof node.label !== "string" || typeof node.enabled !== "boolean" || !node.props || typeof node.props !== "object" || Array.isArray(node.props) || !node.styles || typeof node.styles !== "object" || Array.isArray(node.styles)) return false;
  return node.children === undefined || (Array.isArray(node.children) && node.children.length <= 100 && node.children.every((child) => isBuilderNode(child, depth + 1, count)));
}

export function getPublicBuilderLayout(value: unknown): BuilderLayout | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const layout = value as Record<string, unknown>;
  const count = { value: 0 };
  if (layout.version !== 1 || !Array.isArray(layout.root) || layout.root.length > 100 || !layout.root.every((node) => isBuilderNode(node, 0, count))) return null;
  return layout as BuilderLayout;
}

function normalizePath(value: string): string {
  const path = value.split("?")[0].split("#")[0] || "/";
  if (path === "/") return "/";
  return `/${path.split("/").filter(Boolean).join("/")}`;
}

function matchesRule(pathname: string, rule: string): boolean {
  if (rule === "*") return true;
  if (rule.endsWith("/*")) {
    const prefix = rule.slice(0, -2).replace(/\/+$/, "");
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  }
  return pathname === normalizePath(rule);
}

function getRules(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function getSemanticRules(value: unknown): SemanticCondition[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is SemanticCondition => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const rule = item as Record<string, unknown>;
    return (rule.action === "include" || rule.action === "exclude") && typeof rule.type === "string";
  });
}

function makePagePermalink(slug: string, parentPermalink = ""): string {
  const cleanSlug = slug.replace(/^\/+|\/+$/g, "");
  if (cleanSlug.toLowerCase() === "home" && !parentPermalink) return "/";
  return normalizePath(`${parentPermalink}/${cleanSlug}/`);
}

async function buildMatchContext(): Promise<MatchContext> {
  const [pages, posts, customTypes, categories, tags, siteSettings] = await Promise.all([
    prisma.page.findMany({
      where: { status: "PUBLISHED", deletedAt: null },
      select: { id: true, slug: true, parentId: true },
    }),
    prisma.post.findMany({
      where: { status: "PUBLISHED", deletedAt: null },
      select: {
        id: true,
        slug: true,
        publishedAt: true,
        createdAt: true,
        postTypeId: true,
        postType: { select: { slug: true } },
        categories: { select: { category: { select: { slug: true } } } },
      },
    }),
    prisma.customPostType.findMany({ select: { id: true, slug: true } }),
    prisma.category.findMany({ select: { id: true, slug: true } }),
    prisma.tag.findMany({ select: { id: true, slug: true } }),
    getSiteSettings(),
  ]);

  const pageMap = new Map(pages.map((page) => [page.id, page]));
  const pagePaths = new Map<string, string>();
  const resolvePagePath = (id: string, visited = new Set<string>()): string => {
    const known = pagePaths.get(id);
    if (known) return known;
    const page = pageMap.get(id);
    if (!page || visited.has(id)) return "/";
    visited.add(id);
    const parent = page.parentId ? resolvePagePath(page.parentId, visited) : "";
    const permalink = makePagePermalink(page.slug, parent === "/" ? "" : parent);
    pagePaths.set(id, permalink);
    return permalink;
  };
  pages.forEach((page) => resolvePagePath(page.id));

  const customTypeSlugs = new Set(customTypes.map((type) => type.slug));
  const postPaths = new Map<string, string>();
  const customPostPaths = new Map<string, string>();
  for (const post of posts) {
    if (post.postTypeId && post.postType?.slug) {
      customPostPaths.set(post.id, normalizePath(`/content/${post.postType.slug}/${post.slug}`));
    } else {
      postPaths.set(post.id, normalizePath(getPostPermalink(post, siteSettings)));
    }
  }

  return {
    pagePaths,
    postPaths,
    customPostPaths,
    customTypeSlugs,
    categorySlugs: new Map(categories.map((item) => [item.id, item.slug])),
    tagSlugs: new Map(tags.map((item) => [item.id, item.slug])),
  };
}

function semanticRuleScore(rule: SemanticCondition, pathname: string, context: MatchContext): number | null {
  switch (rule.type) {
    case "entire-site": return 0;
    case "all-pages": return [...context.pagePaths.values()].some((path) => path === pathname) ? 500 : null;
    case "selected-page": return rule.id && context.pagePaths.get(rule.id) === pathname ? 1500 : null;
    case "all-posts": return [...context.postPaths.values()].some((path) => path === pathname) ? 600 : null;
    case "selected-post": return rule.id && context.postPaths.get(rule.id) === pathname ? 1600 : null;
    case "selected-custom-post": return rule.id && context.customPostPaths.get(rule.id) === pathname ? 1650 : null;
    case "all-singular": return [...context.pagePaths.values(), ...context.postPaths.values(), ...context.customPostPaths.values()].includes(pathname) ? 650 : null;
    case "blog-archive": return pathname === "/blog" ? 800 : null;
    case "category-archives": return pathname.startsWith("/blog/category/") ? 700 : null;
    case "tag-archives": return pathname.startsWith("/blog/tag/") ? 700 : null;
    case "selected-category": {
      const slug = rule.id ? context.categorySlugs.get(rule.id) : undefined;
      return slug && pathname === normalizePath(`/blog/category/${slug}`) ? 1600 : null;
    }
    case "selected-tag": {
      const slug = rule.id ? context.tagSlugs.get(rule.id) : undefined;
      return slug && pathname === normalizePath(`/blog/tag/${slug}`) ? 1600 : null;
    }
    case "all-archives": {
      if (pathname === "/blog" || pathname.startsWith("/blog/category/") || pathname.startsWith("/blog/tag/")) return 750;
      const match = pathname.match(/^\/content\/([^/]+)$/);
      return match && context.customTypeSlugs.has(match[1]) ? 750 : null;
    }
    case "custom-archives": {
      const match = pathname.match(/^\/content\/([^/]+)$/);
      return match && context.customTypeSlugs.has(match[1]) ? 800 : null;
    }
    case "custom-type-archive": return rule.slug && pathname === normalizePath(`/content/${rule.slug}`) ? 1600 : null;
    case "all-custom-singular": return [...context.customPostPaths.values()].includes(pathname) ? 650 : null;
    case "custom-type-singular": return rule.slug && pathname.startsWith(`/content/${rule.slug}/`) ? 850 : null;
    case "custom-path": return rule.path && matchesRule(pathname, rule.path) ? (rule.path === "*" ? 0 : rule.path.endsWith("/*") ? 700 : 1400) : null;
    default: return null;
  }
}

function getMatchScore(documentKey: string, value: unknown, pathname: string, context: MatchContext): number | null {
  const conditions = value && typeof value === "object" && !Array.isArray(value) ? value as ConditionsShape : {};
  const include = getRules(conditions.include);
  const exclude = getRules(conditions.exclude);
  const rules = getSemanticRules(conditions.rules);

  if (exclude.some((rule) => matchesRule(pathname, rule))) return null;
  if (rules.some((rule) => rule.action === "exclude" && semanticRuleScore(rule, pathname, context) !== null)) return null;

  const legacyScores = include.filter((rule) => matchesRule(pathname, rule)).map((rule) => rule === "*" ? 0 : rule.endsWith("/*") ? rule.length - 1 : 1400 + rule.length);
  const semanticIncludes = rules.filter((rule) => rule.action === "include");
  const semanticScores = semanticIncludes.flatMap((rule) => {
    const score = semanticRuleScore(rule, pathname, context);
    return score === null ? [] : [score];
  });
  const scores = [...legacyScores, ...semanticScores];
  const hasIncludes = include.length > 0 || semanticIncludes.length > 0;
  if (!hasIncludes) return documentKey.endsWith(":primary") ? -1 : null;
  return scores.length ? Math.max(...scores) : null;
}

function toPublicData(document: { layout: unknown; globalStyles: unknown }): PublicBuilderDocumentData | null {
  const layout = getPublicBuilderLayout(document.layout);
  if (!layout || !layout.root.length) return null;
  const globalStyles = document.globalStyles && typeof document.globalStyles === "object" && !Array.isArray(document.globalStyles)
    ? document.globalStyles as unknown as BuilderGlobalStyles
    : null;
  return { layout, globalStyles };
}

export async function getPublishedBuilderDocument(documentKey: string): Promise<PublicBuilderDocumentData | null> {
  try {
    const document = await prisma.builderDocument.findFirst({ where: { documentKey, status: "PUBLISHED" }, select: { layout: true, globalStyles: true } });
    return document ? toPublicData(document) : null;
  } catch (error) {
    console.error(`Unable to load published builder document: ${documentKey}`, error);
    return null;
  }
}

export async function getPublishedBuilderDocumentForPath(kind: PublicKind, currentPath: string): Promise<PublicBuilderDocumentData | null> {
  const pathname = normalizePath(currentPath);
  try {
    const documents = await prisma.builderDocument.findMany({
      where: { kind, status: "PUBLISHED" },
      select: { documentKey: true, layout: true, globalStyles: true, conditions: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });
    const hasSemanticRules = documents.some((document) => getSemanticRules((document.conditions as ConditionsShape | null)?.rules).length > 0);
    const context = hasSemanticRules ? await buildMatchContext() : {
      pagePaths: new Map<string, string>(),
      postPaths: new Map<string, string>(),
      customPostPaths: new Map<string, string>(),
      customTypeSlugs: new Set<string>(),
      categorySlugs: new Map<string, string>(),
      tagSlugs: new Map<string, string>(),
    };
    const candidates: Array<{ document: (typeof documents)[number]; score: number }> = [];
    for (const document of documents) {
      const score = getMatchScore(document.documentKey, document.conditions, pathname, context);
      if (score !== null) candidates.push({ document, score });
    }
    candidates.sort((a, b) => b.score - a.score || b.document.updatedAt.getTime() - a.document.updatedAt.getTime());
    for (const candidate of candidates) {
      const data = toPublicData(candidate.document);
      if (data) return data;
    }
    return null;
  } catch (error) {
    console.error(`Unable to resolve published ${kind} for ${pathname}:`, error);
    return null;
  }
}
