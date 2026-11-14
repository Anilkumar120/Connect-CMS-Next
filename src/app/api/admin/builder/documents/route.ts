
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { verifyRequestOrigin } from "@/lib/auth/request";

const ALLOWED_KINDS = [
  "header",
  "footer",
  "page",
  "post",
  "single",
  "archive",
  "custom",
] as const;

type BuilderKind = (typeof ALLOWED_KINDS)[number];

type SaveBody = {
  action?: "save" | "restore";
  revisionId?: string;
  documentKey?: string;
  kind?: BuilderKind;
  title?: string;
  slug?: string | null;
  targetId?: string | null;
  postTypeSlug?: string | null;
  status?: "DRAFT" | "PUBLISHED";
  layout?: {
    version: 1;
    root: unknown[];
  };
  settings?: Record<string, unknown>;
  globalStyles?: Record<string, unknown>;
  conditions?: Record<string, unknown>;
  revisionMessage?: string;
};

type Snapshot = {
  layout?: {
    version: 1;
    root: unknown[];
  };
  settings?: Record<string, unknown>;
  globalStyles?: Record<string, unknown>;
  conditions?: Record<string, unknown>;
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
};

function jsonError(
  message: string,
  status = 400,
) {
  return NextResponse.json(
    { success: false, message },
    { status },
  );
}

async function authorize() {
  const user = await getCurrentUser();

  if (!user || !user.isActive) {
    return {
      user: null,
      response: jsonError(
        "Unauthorized. Please log in again.",
        401,
      ),
    };
  }

  return {
    user,
    response: null,
  };
}

function isValidDocumentKey(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 191 &&
    /^[a-zA-Z0-9:_-]+$/.test(value)
  );
}

function countNodes(
  nodes: unknown[],
  depth = 0,
  seen = new Set<string>(),
): number {
  if (depth > 20) {
    throw new Error(
      "Builder layout nesting limit exceeded.",
    );
  }

  let count = 0;

  for (const item of nodes) {
    if (
      !item ||
      typeof item !== "object" ||
      Array.isArray(item)
    ) {
      throw new Error("Invalid builder element.");
    }

    const node = item as Record<string, unknown>;

    if (
      typeof node.id !== "string" ||
      !node.id.trim() ||
      typeof node.type !== "string" ||
      !node.type.trim() ||
      typeof node.label !== "string" ||
      typeof node.enabled !== "boolean" ||
      !node.props ||
      typeof node.props !== "object" ||
      Array.isArray(node.props) ||
      !node.styles ||
      typeof node.styles !== "object" ||
      Array.isArray(node.styles)
    ) {
      throw new Error(
        "Builder element has an invalid structure.",
      );
    }

    if (seen.has(node.id)) {
      throw new Error(
        `Duplicate builder element ID: ${node.id}`,
      );
    }

    seen.add(node.id);
    count += 1;

    if (Array.isArray(node.children)) {
      count += countNodes(
        node.children,
        depth + 1,
        seen,
      );
    }

    if (count > 500) {
      throw new Error(
        "Builder layout cannot contain more than 500 elements.",
      );
    }
  }

  return count;
}

function isValidLayout(
  value: unknown,
): value is {
  version: 1;
  root: unknown[];
} {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return false;
  }

  const layout = value as Record<string, unknown>;

  if (
    layout.version !== 1 ||
    !Array.isArray(layout.root)
  ) {
    return false;
  }

  countNodes(layout.root);

  return true;
}

export async function GET(request: NextRequest) {
  const auth = await authorize();

  if (auth.response) return auth.response;

  const documentKey =
    request.nextUrl.searchParams.get("documentKey");

  const action =
    request.nextUrl.searchParams.get("action");

  if (!isValidDocumentKey(documentKey)) {
    return jsonError(
      "A valid documentKey is required.",
    );
  }

  try {
    const document =
      await prisma.builderDocument.findUnique({
        where: { documentKey },
      });

    if (action === "revisions") {
      if (!document) {
        return NextResponse.json({
          success: true,
          revisions: [],
        });
      }

      const revisions =
        await prisma.builderRevision.findMany({
          where: {
            documentId: document.id,
          },
          orderBy: {
            revisionNo: "desc",
          },
          take: 100,
        });

      return NextResponse.json({
        success: true,
        revisions,
      });
    }

    return NextResponse.json({
      success: true,
      document,
    });
  } catch (error) {
    console.error(
      "Builder document GET error:",
      error,
    );

    return jsonError(
      "Unable to load builder document.",
      500,
    );
  }
}

export async function POST(request: NextRequest) {
  const originError = verifyRequestOrigin(request);

  if (originError) return originError;

  const auth = await authorize();

  if (auth.response) return auth.response;

  let body: SaveBody;

  try {
    body = (await request.json()) as SaveBody;
  } catch {
    return jsonError("Invalid JSON request body.");
  }

  if (!isValidDocumentKey(body.documentKey)) {
    return jsonError(
      "A valid documentKey is required.",
    );
  }

  // Restore a saved revision.
  if (body.action === "restore") {
    if (
      typeof body.revisionId !== "string" ||
      !body.revisionId.trim()
    ) {
      return jsonError(
        "A valid revisionId is required.",
      );
    }

    try {
      const restored = await prisma.$transaction(
        async (tx) => {
          const existing =
            await tx.builderDocument.findUnique({
              where: {
                documentKey: body.documentKey!,
              },
            });

          if (!existing) {
            throw new Error(
              "Builder document was not found.",
            );
          }

          const revision =
            await tx.builderRevision.findFirst({
              where: {
                id: body.revisionId!,
                documentId: existing.id,
              },
            });

          if (!revision) {
            throw new Error(
              "Selected revision was not found.",
            );
          }

          const snapshot =
            revision.snapshot as unknown as Snapshot;

          if (!snapshot || !isValidLayout(snapshot.layout)) {
            throw new Error(
              "The selected revision has an invalid layout.",
            );
          }

          const layout =
            snapshot.layout as Prisma.InputJsonValue;

          const settings =
            (snapshot.settings ?? {}) as Prisma.InputJsonValue;

          const globalStyles =
            (snapshot.globalStyles ?? {}) as Prisma.InputJsonValue;

          const conditions =
            (snapshot.conditions ?? {
              include: [],
              exclude: [],
            }) as Prisma.InputJsonValue;

          const restoredDocument =
            await tx.builderDocument.update({
              where: {
                id: existing.id,
              },
              data: {
                layout,
                settings,
                globalStyles,
                conditions,
                status:
                  snapshot.status === "PUBLISHED"
                    ? "PUBLISHED"
                    : "DRAFT",
                title: revision.title || existing.title,
              },
            });

          const latest =
            await tx.builderRevision.aggregate({
              where: {
                documentId: existing.id,
              },
              _max: {
                revisionNo: true,
              },
            });

          const revisionNo =
            (latest._max.revisionNo ?? 0) + 1;

          await tx.builderRevision.create({
            data: {
              documentId: existing.id,
              revisionNo,
              title: restoredDocument.title,
              snapshot: {
                layout,
                settings,
                globalStyles,
                conditions,
                status: restoredDocument.status,
              } as Prisma.InputJsonValue,
              message: `Restored revision ${revision.revisionNo}`,
              createdById: auth.user!.id,
            },
          });

          return restoredDocument;
        },
      );

      return NextResponse.json({
        success: true,
        message: "Revision restored successfully.",
        document: restored,
      });
    } catch (error) {
      console.error(
        "Builder revision restore error:",
        error,
      );

      return jsonError(
        error instanceof Error
          ? error.message
          : "Unable to restore revision.",
        500,
      );
    }
  }

  // Normal save or publish.
  if (
    !body.kind ||
    !ALLOWED_KINDS.includes(body.kind)
  ) {
    return jsonError(
      "Invalid builder document kind.",
    );
  }

  if (
    typeof body.title !== "string" ||
    !body.title.trim() ||
    body.title.length > 255
  ) {
    return jsonError(
      "Document title is required and must be under 255 characters.",
    );
  }

  if (
    body.status !== "DRAFT" &&
    body.status !== "PUBLISHED"
  ) {
    return jsonError(
      "Invalid document status.",
    );
  }

  try {
    if (!isValidLayout(body.layout)) {
      return jsonError("Invalid builder layout.");
    }
  } catch (error) {
    return jsonError(
      error instanceof Error
        ? error.message
        : "Invalid builder layout.",
    );
  }

  const layout =
    body.layout as Prisma.InputJsonValue;

  const settings =
    (body.settings ?? {}) as Prisma.InputJsonValue;

  const globalStyles =
    (body.globalStyles ?? {}) as Prisma.InputJsonValue;

  const conditions =
    (body.conditions ?? {
      include: [],
      exclude: [],
    }) as Prisma.InputJsonValue;

  try {
    const savedDocument =
      await prisma.$transaction(async (tx) => {
        const existing =
          await tx.builderDocument.findUnique({
            where: {
              documentKey: body.documentKey!,
            },
          });

        if (
          existing &&
          existing.kind !== body.kind
        ) {
          throw new Error(
            "Document key is already used by another builder type.",
          );
        }

        const document =
          await tx.builderDocument.upsert({
            where: {
              documentKey: body.documentKey!,
            },
            create: {
              documentKey: body.documentKey!,
              kind: body.kind!,
              title: body.title!.trim(),
              slug: body.slug ?? null,
              targetId: body.targetId ?? null,
              postTypeSlug: body.postTypeSlug ?? null,
              status: body.status!,
              layout,
              settings,
              globalStyles,
              conditions,
              publishedAt:
                body.status === "PUBLISHED"
                  ? new Date()
                  : null,
              createdById: auth.user!.id,
            },
            update: {
              title: body.title!.trim(),
              slug: body.slug ?? null,
              targetId: body.targetId ?? null,
              postTypeSlug: body.postTypeSlug ?? null,
              status: body.status!,
              layout,
              settings,
              globalStyles,
              conditions,
              ...(body.status === "PUBLISHED"
                ? { publishedAt: new Date() }
                : {}),
            },
          });

        if (
          body.status === "PUBLISHED" &&
          (body.kind === "page" ||
            body.kind === "post" ||
            body.kind === "custom")
        ) {
          if (!body.targetId) {
            throw new Error("A content ID is required to publish this builder.");
          }

          if (body.kind === "page") {
            const page = await tx.page.findFirst({
              where: {
                id: body.targetId,
                deletedAt: null,
                status: { not: "ARCHIVED" },
              },
              select: { id: true, status: true },
            });
            if (!page) {
              throw new Error("The page to publish was not found.");
            }
            await tx.page.update({
              where: { id: page.id },
              data: {
                status: "PUBLISHED",
                publishedAt:
                  page.status === "PUBLISHED" ? undefined : new Date(),
              },
            });
          } else {
            const post = await tx.post.findFirst({
              where: {
                id: body.targetId,
                deletedAt: null,
                status: { not: "ARCHIVED" },
                ...(body.kind === "custom" && body.postTypeSlug
                  ? { postType: { slug: body.postTypeSlug } }
                  : {}),
              },
              select: { id: true, status: true },
            });
            if (!post) {
              throw new Error("The post to publish was not found.");
            }
            await tx.post.update({
              where: { id: post.id },
              data: {
                status: "PUBLISHED",
                publishedAt:
                  post.status === "PUBLISHED" ? undefined : new Date(),
              },
            });
          }
        }

        if (body.status === "PUBLISHED") {
          const latest =
            await tx.builderRevision.aggregate({
              where: {
                documentId: document.id,
              },
              _max: {
                revisionNo: true,
              },
            });

          const revisionNo =
            (latest._max.revisionNo ?? 0) + 1;

          await tx.builderRevision.create({
            data: {
              documentId: document.id,
              revisionNo,
              title: document.title,
              snapshot: {
                layout,
                settings,
                globalStyles,
                conditions,
                status: body.status,
              } as Prisma.InputJsonValue,
              message:
                body.revisionMessage?.trim() ||
                `Published revision ${revisionNo}`,
              createdById: auth.user!.id,
            },
          });
        }

        return document;
      });

    return NextResponse.json({
      success: true,
      message:
        body.status === "PUBLISHED"
          ? "Builder document published successfully."
          : "Builder draft saved successfully.",
      document: savedDocument,
    });
  } catch (error) {
    console.error(
      "Builder document POST error:",
      error,
    );

    return jsonError(
      error instanceof Error
        ? error.message
        : "Unable to save builder document.",
      500,
    );
  }
}
