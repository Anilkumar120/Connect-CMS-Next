import { prisma } from "@/lib/prisma";
import type {
  BuilderGlobalStyles,
  BuilderLayout,
  BuilderNode,
} from "@/lib/builder/types";

export type PublicBuilderDocumentData = {
  layout: BuilderLayout;
  globalStyles: BuilderGlobalStyles | null;
};

function isBuilderNode(value: unknown, depth: number, count: { value: number }): value is BuilderNode {
  if (
    depth > 20 ||
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return false;
  }

  const node = value as Record<string, unknown>;
  count.value += 1;

  if (
    count.value > 500 ||
    typeof node.id !== "string" ||
    typeof node.type !== "string" ||
    typeof node.label !== "string" ||
    typeof node.enabled !== "boolean" ||
    !node.props ||
    typeof node.props !== "object" ||
    Array.isArray(node.props) ||
    !node.styles ||
    typeof node.styles !== "object" ||
    Array.isArray(node.styles)
  ) {
    return false;
  }

  return (
    node.children === undefined ||
    (Array.isArray(node.children) &&
      node.children.length <= 100 &&
      node.children.every((child) =>
        isBuilderNode(child, depth + 1, count)
      ))
  );
}

export function getPublicBuilderLayout(value: unknown): BuilderLayout | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const layout = value as Record<string, unknown>;
  const count = { value: 0 };
  if (
    layout.version !== 1 ||
    !Array.isArray(layout.root) ||
    layout.root.length > 100 ||
    !layout.root.every((node) => isBuilderNode(node, 0, count))
  ) {
    return null;
  }

  return layout as BuilderLayout;
}

export async function getPublishedBuilderDocument(
  documentKey: string
): Promise<PublicBuilderDocumentData | null> {
  try {
    const document = await prisma.builderDocument.findFirst({
      where: {
        documentKey,
        status: "PUBLISHED",
      },
      select: {
        layout: true,
        globalStyles: true,
      },
    });

    const layout = getPublicBuilderLayout(document?.layout);

    if (document && !layout) {
      console.error(
        "Stored public builder layout is invalid:",
        documentKey
      );
    }

    if (!layout) return null;

    const globalStyles =
      document?.globalStyles &&
      typeof document.globalStyles === "object" &&
      !Array.isArray(document.globalStyles)
        ? (document.globalStyles as unknown as BuilderGlobalStyles)
        : null;

    return {
      layout,
      globalStyles,
    };
  } catch (error) {
    console.error(
      `Unable to load published builder document: ${documentKey}`,
      error
    );

    return null;
  }
}

