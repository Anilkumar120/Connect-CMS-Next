
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { verifyRequestOrigin } from "@/lib/auth/request";
import { DEFAULT_GLOBAL_STYLES } from "@/lib/builder/defaults";

const allowedRoles = ["SUPER_ADMIN", "ADMIN", "WEB_DESIGNER"] as const;
const allowedKinds = ["single", "archive"] as const;

type TemplateKind = (typeof allowedKinds)[number];
type TemplateAction = "saveDraft" | "publish" | "delete";

function jsonError(message: string, status = 400) {
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
      response: jsonError("Authentication required.", 401),
    };
  }

  if (!allowedRoles.includes(user.role as (typeof allowedRoles)[number])) {
    return {
      user: null,
      response: jsonError(
        "You do not have permission to manage templates.",
        403,
      ),
    };
  }

  return { user, response: null };
}

function isTemplateKind(value: unknown): value is TemplateKind {
  return (
    typeof value === "string" &&
    allowedKinds.includes(value as TemplateKind)
  );
}

function safeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 150);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value),
  );
}

function mapTemplate(document: {
  id: string;
  documentKey: string;
  kind: string;
  title: string;
  slug: string | null;
  status: string;
  layout: Prisma.JsonValue;
  conditions: Prisma.JsonValue | null;
  legacyData: Prisma.JsonValue | null;
  updatedAt: Date;
}) {
  const legacyData = isObject(document.legacyData)
    ? document.legacyData
    : {};

  return {
    id: document.slug || document.id,
    documentId: document.id,
    documentKey: document.documentKey,
    name: document.title,
    description:
      typeof legacyData.description === "string"
        ? legacyData.description
        : "",
    layout: document.layout,
    conditions: document.conditions,
    status: document.status,
    updatedAt: document.updatedAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const auth = await authorize();
  if (auth.response) return auth.response;

  const kind = request.nextUrl.searchParams.get("kind");

  if (!isTemplateKind(kind)) {
    return jsonError("Kind must be single or archive.");
  }

  try {
    const documents = await prisma.builderDocument.findMany({
      where: {
        kind,
        status: {
          in: ["DRAFT", "PUBLISHED"],
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    const templates = documents
      .filter((document) => document.status === "PUBLISHED")
      .map(mapTemplate);

    const draftTemplates = documents
      .filter((document) => document.status === "DRAFT")
      .map(mapTemplate);

    return NextResponse.json(
      {
        success: true,
        kind,
        templates,
        draftTemplates,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Builder templates GET error:", error);
    return jsonError("Unable to load templates.", 500);
  }
}

export async function POST(request: NextRequest) {
  const originError = verifyRequestOrigin(request);
  if (originError) return originError;

  const auth = await authorize();
  if (auth.response) return auth.response;

  try {
    const body: unknown = await request.json();

    if (!isObject(body)) {
      return jsonError("Invalid request body.");
    }

    const kind = body.kind;
    const action = body.action;
    const template = body.template;

    if (!isTemplateKind(kind)) {
      return jsonError("Invalid template kind.");
    }

    if (
      action !== "saveDraft" &&
      action !== "publish" &&
      action !== "delete"
    ) {
      return jsonError("Invalid template action.");
    }

    if (!isObject(template)) {
      return jsonError("Template data is required.");
    }

    const id =
      typeof template.id === "string"
        ? safeSlug(template.id)
        : "";

    if (!id) {
      return jsonError("A valid template ID is required.");
    }

    const documentKey = `${kind}:${id}`;

    if (action === "delete") {
      const existing = await prisma.builderDocument.findUnique({
        where: { documentKey },
      });

      if (!existing || existing.kind !== kind) {
        return jsonError("Template not found.", 404);
      }

      await prisma.builderDocument.update({
        where: { documentKey },
        data: {
          status: "ARCHIVED",
        },
      });

      return NextResponse.json({
        success: true,
        message: "Template moved to archive.",
      });
    }

    const name =
      typeof template.name === "string"
        ? template.name.trim()
        : "";

    if (!name || name.length > 255) {
      return jsonError("Template name is required.");
    }

    const description =
      typeof template.description === "string"
        ? template.description.slice(0, 1000)
        : "";

    const status = action === "publish" ? "PUBLISHED" : "DRAFT";

    const layout = isObject(template.layout) &&
      template.layout.version === 1 &&
      Array.isArray(template.layout.root)
        ? template.layout
        : {
            version: 1,
            root: [],
          };

    const conditions = isObject(template.conditions)
      ? template.conditions
      : {
          include: [],
          exclude: [],
        };

    const settings = {};
    const globalStyles = DEFAULT_GLOBAL_STYLES;

    const savedDocument = await prisma.$transaction(async (tx) => {
      const existing = await tx.builderDocument.findUnique({
        where: { documentKey },
      });

      if (existing && existing.kind !== kind) {
        throw new Error("This template ID is already used by another builder type.");
      }

      const document = await tx.builderDocument.upsert({
        where: { documentKey },
        create: {
          documentKey,
          kind,
          title: name,
          slug: id,
          status,
          layout: layout as Prisma.InputJsonValue,
          settings: settings as Prisma.InputJsonValue,
          globalStyles: globalStyles as Prisma.InputJsonValue,
          conditions: conditions as Prisma.InputJsonValue,
          legacyData: {
            description,
          } as Prisma.InputJsonValue,
          publishedAt: status === "PUBLISHED" ? new Date() : null,
          createdById: auth.user!.id,
        },
        update: {
          title: name,
          slug: id,
          status,
          layout: layout as Prisma.InputJsonValue,
          settings: settings as Prisma.InputJsonValue,
          globalStyles: globalStyles as Prisma.InputJsonValue,
          conditions: conditions as Prisma.InputJsonValue,
          legacyData: {
            description,
          } as Prisma.InputJsonValue,
          ...(status === "PUBLISHED"
            ? { publishedAt: new Date() }
            : {}),
        },
      });

      if (status === "PUBLISHED") {
        const latest = await tx.builderRevision.aggregate({
          where: {
            documentId: document.id,
          },
          _max: {
            revisionNo: true,
          },
        });

        const revisionNo = (latest._max.revisionNo ?? 0) + 1;

        await tx.builderRevision.create({
          data: {
            documentId: document.id,
            revisionNo,
            title: document.title,
            snapshot: {
              layout: layout as Prisma.InputJsonValue,
              settings: settings as Prisma.InputJsonValue,
              globalStyles: globalStyles as Prisma.InputJsonValue,
              conditions: conditions as Prisma.InputJsonValue,
              status,
            } as Prisma.InputJsonValue,
            message: `Published template revision ${revisionNo}`,
            createdById: auth.user!.id,
          },
        });
      }

      return document;
    });

    return NextResponse.json({
      success: true,
      message:
        status === "PUBLISHED"
          ? "Template published successfully."
          : "Template draft saved successfully.",
      template: mapTemplate(savedDocument),
    });
  } catch (error) {
    console.error("Builder templates POST error:", error);

    return jsonError(
      error instanceof Error
        ? error.message
        : "Unable to save template.",
      500,
    );
  }
}
