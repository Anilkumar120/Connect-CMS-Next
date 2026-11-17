
import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { verifyRequestOrigin } from "@/lib/auth/request";
import { prisma } from "@/lib/prisma";
import { FORM_FIELD_TYPES, normalizeFormSlug } from "@/lib/forms";

const editorRoles = ["SUPER_ADMIN", "ADMIN", "EDITOR"];

const fieldSchema = z.object({
  id: z.string().trim().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/),
  label: z.string().trim().min(1).max(200),
  type: z.enum(FORM_FIELD_TYPES),
  required: z.boolean().optional(),
  placeholder: z.string().max(500).optional(),
  options: z.array(z.string().max(200)).max(100).optional(),

  // Advanced field settings
  min: z.number().finite().optional(),
  max: z.number().finite().optional(),
  content: z.string().max(20000).optional(),
}).superRefine((field, context) => {
  if (
    field.min !== undefined &&
    field.max !== undefined &&
    field.min > field.max
  ) {
    context.addIssue({
      code: "custom",
      path: ["max"],
      message: "Maximum value cannot be less than minimum value.",
    });
  }
});

const fieldsSchema = z.array(fieldSchema).max(500).superRefine((fields, context) => {
  const seen = new Set<string>();

  fields.forEach((field, index) => {
    if (seen.has(field.id)) {
      context.addIssue({
        code: "custom",
        path: [index, "id"],
        message: "Field IDs must be unique.",
      });
    }

    seen.add(field.id);
  });
});

const formSchema = z.object({
  title: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(200),
  description: z.string().max(10000).optional().default(""),
  fields: fieldsSchema,
  settings: z.record(z.string(), z.unknown()).optional(),
  styles: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user || !editorRoles.includes(user.role)) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const includeTrash = request.nextUrl.searchParams.get("trash") === "1";

    const forms = await prisma.form.findMany({
      where: {
        deletedAt: includeTrash ? { not: null } : null,
      },
      orderBy: {
        updatedAt: "desc",
      },
      include: {
        _count: {
          select: {
            submissions: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      forms,
    });
  } catch (error) {
    console.error("Fetch forms failed:", error);

    return NextResponse.json(
      { success: false, message: "Unable to fetch forms." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const originError = verifyRequestOrigin(request);

  if (originError) return originError;

  const user = await getCurrentUser();

  if (!user || !editorRoles.includes(user.role)) {
    return NextResponse.json(
      { success: false, message: "Unauthorized." },
      { status: 401 }
    );
  }

  try {
    const parsed = formSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsed.error.issues[0]?.message ?? "Invalid form.",
        },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const slug = normalizeFormSlug(data.slug);

    if (!slug) {
      return NextResponse.json(
        { success: false, message: "Enter a valid form URL." },
        { status: 400 }
      );
    }

    const form = await prisma.form.create({
      data: {
        title: data.title,
        slug,
        description: data.description,
        fields: data.fields as Prisma.InputJsonValue,
        settings: data.settings as Prisma.InputJsonValue | undefined,
        styles: data.styles as Prisma.InputJsonValue | undefined,
        status: data.status ?? "DRAFT",
      },
    });

    return NextResponse.json(
      {
        success: true,
        form,
      },
      { status: 201 }
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { success: false, message: "That form URL is already in use." },
        { status: 409 }
      );
    }

    console.error("Create form failed:", error);

    return NextResponse.json(
      { success: false, message: "Unable to save form." },
      { status: 500 }
    );
  }
}

