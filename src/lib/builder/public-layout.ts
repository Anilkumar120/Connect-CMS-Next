import { prisma } from "@/lib/prisma";
import type { BuilderGlobalStyles, BuilderLayout, BuilderNode } from "@/lib/builder/types";

export type PublicBuilderDocumentData = {
  layout: BuilderLayout;
  globalStyles: BuilderGlobalStyles | null;
};
type PublicKind = "header" | "footer";
type ConditionsShape = { include?: unknown; exclude?: unknown };

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

function getMatchScore(documentKey: string, value: unknown, pathname: string): number | null {
  const conditions = value && typeof value === "object" && !Array.isArray(value) ? value as ConditionsShape : {};
  const include = getRules(conditions.include);
  const exclude = getRules(conditions.exclude);
  if (exclude.some((rule) => matchesRule(pathname, rule))) return null;
  const isPrimary = documentKey.endsWith(":primary");
  if (!include.length) return isPrimary ? -1 : null;
  const matches = include.filter((rule) => matchesRule(pathname, rule));
  if (!matches.length) return null;
  return Math.max(...matches.map((rule) => rule === "*" ? 0 : rule.endsWith("/*") ? rule.length - 1 : 1000 + rule.length));
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
    const candidates: Array<{ document: (typeof documents)[number]; score: number }> = [];
    for (const document of documents) {
      const score = getMatchScore(document.documentKey, document.conditions, pathname);
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
