import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { verifyRequestOrigin } from "@/lib/auth/request";
import type {
  PageBuilderElement,
  PageBuilderLayout,
} from "@/lib/page-builder-types";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const stylesSchema = z
  .object({
    color: z.string().max(120).optional(),
    backgroundColor: z.string().max(120).optional(),
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
        "button",
        "divider",
        "spacer",
      ]),
      content: z.string().max(10000).optional(),
      level: z.number().int().min(1).max(6).optional(),
      src: z.string().max(1000).optional(),
      alt: z.string().max(500).optional(),
      href: z.string().max(1000).optional(),
      display: z.enum(["flex", "grid", "block"]).optional(),
      columns: z.number().int().min(1).max(12).optional(),
      alignItems: z.string().max(30).optional(),
      justifyContent: z.string().max(30).optional(),
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
  })
  .strict();

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function countElements(elements: PageBuilderElement[]): number {
  return elements.reduce(
    (total, element) =>
      total + 1 + countElements(element.children ?? []),
    0
  );
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

async function requireActiveUser() {
  const user = await getCurrentUser();
  return user?.isActive ? user : null;
}

export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const user = await requireActiveUser();
    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const page = await prisma.page.findFirst({
      where: { id, deletedAt: null, status: { not: "ARCHIVED" } },
      select: { id: true, title: true, status: true, content: true },
    });

    if (!page) {
      return NextResponse.json(
        { success: false, message: "Page not found." },
        { status: 404 }
      );
    }

    const content = isObject(page.content) ? page.content : {};
    const draft = isObject(content.layoutDraft)
      ? content.layoutDraft
      : null;
    const published = isObject(content.layout) ? content.layout : null;
    const layout = draft ?? published ?? { version: 1, elements: [] };
    const layoutResult = isWithinLayoutLimits(layout)
      ? layoutSchema.safeParse(layout)
      : { success: false as const };

    if (!layoutResult.success) {
      console.error("Stored page builder layout is invalid:", page.id);
      return NextResponse.json(
        {
          success: false,
          message: "The stored page layout is invalid and cannot be edited.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      page: { id: page.id, title: page.title, status: page.status },
      layout: layoutResult.data,
      hasDraft: Boolean(draft),
    });
  } catch (error) {
    console.error("Load page builder error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load the page builder." },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const originError = verifyRequestOrigin(request);
    if (originError) return originError;

    const user = await requireActiveUser();
    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const page = await prisma.page.findFirst({
      where: { id, deletedAt: null, status: { not: "ARCHIVED" } },
      select: { id: true, status: true, content: true },
    });

    if (!page) {
      return NextResponse.json(
        { success: false, message: "Page not found." },
        { status: 404 }
      );
    }

    const body: unknown = await request.json();
    if (!isObject(body) || !isWithinLayoutLimits(body.layout)) {
      return NextResponse.json(
        { success: false, message: "The page layout is too large or deeply nested." },
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
        { success: false, message: "A page can contain at most 500 elements." },
        { status: 400 }
      );
    }

    const content = isObject(page.content) ? { ...page.content } : {};

    if (parsed.data.action === "publish") {
      content.layout = layout;
      delete content.layoutDraft;

      await prisma.page.update({
        where: { id },
        data: {
          content,
          status: "PUBLISHED",
          publishedAt:
            page.status === "PUBLISHED" ? undefined : new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: "Page layout published.",
        status: "PUBLISHED",
      });
    }

    content.layoutDraft = layout;
    await prisma.page.update({
      where: { id },
      data: { content },
    });

    return NextResponse.json({
      success: true,
      message: "Builder draft saved.",
      status: page.status,
    });
  } catch (error) {
    console.error("Save page builder error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to save the page layout." },
      { status: 500 }
    );
  }
}
