import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { verifyRequestOrigin } from "@/lib/auth/request";
import type {
  PageBuilderElement,
  PageBuilderLayout,
} from "@/lib/page-builder-types";

type RouteContext = { params: Promise<{ id: string }> };

const stylesSchema = z
  .object({
    color: z.string().max(120).optional(),
    backgroundColor: z.string().max(120).optional(),
    backgroundImage: z.string().max(1000).optional(),
    hoverColor: z.string().max(120).optional(),
    hoverBackgroundColor: z.string().max(120).optional(),
    fontFamily: z.string().max(120).optional(),
    fontSize: z.string().max(40).optional(),
    fontWeight: z.string().max(20).optional(),
    textAlign: z.string().max(20).optional(),
    borderRadius: z.string().max(40).optional(),
    width: z.string().max(40).optional(),
    height: z.string().max(40).optional(),
    margin: z.string().max(80).optional(),
    padding: z.string().max(80).optional(),
    gap: z.string().max(40).optional(),
    minWidth: z.string().max(40).optional(),
    maxWidth: z.string().max(40).optional(),
    minHeight: z.string().max(40).optional(),
    maxHeight: z.string().max(40).optional(),
    flexBasis: z.string().max(40).optional(),
    flexGrow: z.string().max(20).optional(),
    flexShrink: z.string().max(20).optional(),
    order: z.string().max(20).optional(),
    overflow: z.enum(["visible", "hidden", "auto"]).optional(),
    borderWidth: z.string().max(40).optional(),
    borderStyle: z.enum(["none", "solid", "dashed", "dotted"]).optional(),
    borderColor: z.string().max(120).optional(),
  })
  .strict();

const elementSchema: z.ZodType<PageBuilderElement> = z.lazy(() =>
  z
    .object({
      id: z.string().min(1).max(100),
      type: z.enum([
        "section",
        "container",
        "heading",
        "text",
        "image",
        "icon",
        "button",
        "link",
        "divider",
        "spacer",
      ]),
      content: z.string().max(10000).optional(),
      level: z.number().int().min(1).max(6).optional(),
      src: z.string().max(1000).optional(),
      alt: z.string().max(500).optional(),
      href: z.string().max(1000).optional(),
      linkTarget: z.enum(["_self", "_blank"]).optional(),
      display: z.enum(["flex", "grid", "block"]).optional(),
      columns: z.number().int().min(1).max(12).optional(),
      alignItems: z.string().max(30).optional(),
      justifyContent: z.string().max(30).optional(),
      flexWrap: z.enum(["wrap", "nowrap"]).optional(),
      flexDirection: z.enum(["row", "column", "row-reverse", "column-reverse"]).optional(),
      alignContent: z.enum(["start", "center", "end", "space-between", "space-around", "stretch"]).optional(),
      columnGap: z.string().max(40).optional(),
      rowGap: z.string().max(40).optional(),
      styles: stylesSchema.optional(),
      responsive: z
        .object({
          desktop: stylesSchema.optional(),
          tablet: stylesSchema.optional(),
          mobile: stylesSchema.optional(),
        })
        .strict()
        .optional(),
      children: z.array(elementSchema).max(100).optional(),
    })
    .strict()
);

const layoutSchema = z
  .object({
    version: z.literal(1),
    elements: z.array(elementSchema).max(100),
  })
  .strict();

const requestSchema = z
  .object({
    action: z.enum(["saveDraft", "publish"]),
    layout: layoutSchema,
    headerTemplateId: z.string().max(100).nullable().optional(),
  })
  .strict();

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isWithinLayoutLimits(value: unknown) {
  if (!isObject(value) || !Array.isArray(value.elements)) return false;

  const pending: Array<{ value: unknown; depth: number }> = value.elements.map(
    (element) => ({ value: element, depth: 0 })
  );
  let count = 0;

  while (pending.length) {
    const current = pending.pop();
    if (!current || !isObject(current.value) || current.depth > 20) {
      return false;
    }

    count += 1;
    if (count > 500) return false;

    if (current.value.children !== undefined) {
      if (!Array.isArray(current.value.children)) return false;
      for (const child of current.value.children) {
        pending.push({ value: child, depth: current.depth + 1 });
      }
    }
  }

  return true;
}

function countElements(elements: PageBuilderElement[]): number {
  return elements.reduce(
    (total, element) => total + 1 + countElements(element.children ?? []),
    0
  );
}

async function getActiveUser() {
  const user = await getCurrentUser();
  return user?.isActive ? user : null;
}

async function resolveTarget(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type");
  const postTypeSlug = request.nextUrl.searchParams.get("postType");
  if ((type !== "page" && type !== "post") || (postTypeSlug && type !== "post")) {
    return { error: "Invalid builder target.", status: 400 } as const;
  }

  if (!postTypeSlug) return { type, postTypeId: null } as const;
  const postType = await prisma.customPostType.findUnique({
    where: { slug: postTypeSlug },
    select: { id: true },
  });
  if (!postType) {
    return { error: "Custom post type not found.", status: 404 } as const;
  }
  return { type, postTypeId: postType.id } as const;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    if (!(await getActiveUser())) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const target = await resolveTarget(request);
    if ("error" in target) {
      return NextResponse.json(
        { success: false, message: target.error },
        { status: target.status }
      );
    }

    const { id } = await context.params;
    const record =
      target.type === "page"
        ? await prisma.page.findFirst({
            where: { id, deletedAt: null, status: { not: "ARCHIVED" } },
            select: { id: true, title: true, status: true, content: true },
          })
        : await prisma.post.findFirst({
            where: {
              id,
              deletedAt: null,
              postTypeId: target.postTypeId,
            },
            select: { id: true, title: true, status: true, content: true },
          });

    if (!record) {
      return NextResponse.json(
        { success: false, message: "Content not found." },
        { status: 404 }
      );
    }

    const content = isObject(record.content) ? record.content : {};
    const draft = isObject(content.layoutDraft) ? content.layoutDraft : null;
    const published = isObject(content.layout) ? content.layout : null;
    const layout = draft ?? published ?? { version: 1, elements: [] };
    const parsedLayout = isWithinLayoutLimits(layout)
      ? layoutSchema.safeParse(layout)
      : { success: false as const };

    if (!parsedLayout.success) {
      console.error("Stored builder layout is invalid:", record.id);
      return NextResponse.json(
        {
          success: false,
          message: "The stored content layout is invalid and cannot be edited.",
        },
        { status: 500 }
      );
    }

    const headerTemplatesSetting = await prisma.siteSetting.findUnique({
      where: { key: "header_templates" },
      select: { value: true },
    });
    return NextResponse.json({
      success: true,
      page: { id: record.id, title: record.title, status: record.status },
      layout: parsedLayout.data,
      hasDraft: Boolean(draft),
      headerTemplateId:
        typeof content.headerTemplateId === "string"
          ? content.headerTemplateId
          : null,
      headerTemplates: headerTemplatesSetting?.value ?? [],
    });
  } catch (error) {
    console.error("Load content builder error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load the content builder." },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const originError = verifyRequestOrigin(request);
  if (originError) return originError;

  try {
    if (!(await getActiveUser())) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const target = await resolveTarget(request);
    if ("error" in target) {
      return NextResponse.json(
        { success: false, message: target.error },
        { status: target.status }
      );
    }

    const { id } = await context.params;
    const record =
      target.type === "page"
        ? await prisma.page.findFirst({
            where: { id, deletedAt: null, status: { not: "ARCHIVED" } },
            select: { id: true, status: true, content: true },
          })
        : await prisma.post.findFirst({
            where: {
              id,
              deletedAt: null,
              postTypeId: target.postTypeId,
            },
            select: { id: true, status: true, content: true },
          });

    if (!record) {
      return NextResponse.json(
        { success: false, message: "Content not found." },
        { status: 404 }
      );
    }

    const body: unknown = await request.json();
    if (!isObject(body) || !isWithinLayoutLimits(body.layout)) {
      return NextResponse.json(
        { success: false, message: "The content layout is too large or deeply nested." },
        { status: 400 }
      );
    }

    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsed.error.issues[0]?.message ?? "Invalid builder layout.",
        },
        { status: 400 }
      );
    }

    const layout: PageBuilderLayout = parsed.data.layout;
    if (countElements(layout.elements) > 500) {
      return NextResponse.json(
        { success: false, message: "Content can contain at most 500 elements." },
        { status: 400 }
      );
    }

    const content = isObject(record.content) ? { ...record.content } : {};
    if (parsed.data.headerTemplateId !== undefined) {
      if (parsed.data.headerTemplateId === null) {
        delete content.headerTemplateId;
      } else {
        const headerTemplatesSetting = await prisma.siteSetting.findUnique({
          where: { key: "header_templates" },
          select: { value: true },
        });
        const templates = Array.isArray(headerTemplatesSetting?.value)
          ? headerTemplatesSetting.value
          : [];
        const templateExists = templates.some(
          (template) =>
            isObject(template) && template.id === parsed.data.headerTemplateId
        );
        if (!templateExists) {
          return NextResponse.json(
            { success: false, message: "Selected header template was not found." },
            { status: 400 }
          );
        }
        content.headerTemplateId = parsed.data.headerTemplateId;
      }
    }

    if (parsed.data.action === "publish") {
      content.layout = layout;
      delete content.layoutDraft;

      if (target.type === "page") {
        await prisma.page.update({
          where: { id },
          data: {
            content,
            status: "PUBLISHED",
            publishedAt: record.status === "PUBLISHED" ? undefined : new Date(),
          },
        });
      } else {
        await prisma.post.update({
          where: { id },
          data: {
            content,
            status: "PUBLISHED",
            publishedAt: record.status === "PUBLISHED" ? undefined : new Date(),
          },
        });
      }

      return NextResponse.json({
        success: true,
        message: "Content layout published.",
        status: "PUBLISHED",
      });
    }

    content.layoutDraft = layout;
    if (target.type === "page") {
      await prisma.page.update({ where: { id }, data: { content } });
    } else {
      await prisma.post.update({ where: { id }, data: { content } });
    }

    return NextResponse.json({
      success: true,
      message: "Builder draft saved.",
      status: record.status,
    });
  } catch (error) {
    console.error("Save content builder error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to save the content layout." },
      { status: 500 }
    );
  }
}
