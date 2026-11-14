import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { verifyRequestOrigin } from "@/lib/auth/request";
import { prisma } from "@/lib/prisma";
import { FORM_FIELD_TYPES, normalizeFormSlug } from "@/lib/forms";

type Context = { params: Promise<{ id: string }> };
const editors = ["SUPER_ADMIN", "ADMIN", "EDITOR"];
const admins = ["SUPER_ADMIN", "ADMIN"];
const fieldSchema = z.object({
  id: z.string().trim().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/),
  label: z.string().trim().min(1).max(200),
  type: z.enum(FORM_FIELD_TYPES),
  required: z.boolean().optional(),
  placeholder: z.string().max(500).optional(),
  options: z.array(z.string().max(200)).max(100).optional(),
});
const fieldsSchema = z.array(fieldSchema).max(100).superRefine((fields, context) => {
  const seen = new Set<string>();
  fields.forEach((field, index) => {
    if (seen.has(field.id)) context.addIssue({ code: "custom", path: [index, "id"], message: "Field IDs must be unique." });
    seen.add(field.id);
  });
});
const updateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  slug: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(10000).optional(),
  fields: fieldsSchema.optional(),
  settings: z.record(z.string(), z.unknown()).nullable().optional(),
  styles: z.record(z.string(), z.unknown()).nullable().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
  action: z.enum(["TRASH", "RESTORE"]).optional(),
});

export async function GET(_request: NextRequest, context: Context) {
  const user = await getCurrentUser();
  if (!user || !editors.includes(user.role)) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const { id } = await context.params;
  const form = await prisma.form.findUnique({ where: { id } });
  if (!form) return NextResponse.json({ success: false, message: "Form not found." }, { status: 404 });
  return NextResponse.json({ success: true, form });
}

export async function PATCH(request: NextRequest, context: Context) {
  const originError = verifyRequestOrigin(request);
  if (originError) return originError;
  const user = await getCurrentUser();
  if (!user || !editors.includes(user.role)) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const { id } = await context.params;
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message ?? "Invalid form." }, { status: 400 });
  const data = parsed.data;
  if (data.action === "TRASH" && !admins.includes(user.role)) return NextResponse.json({ success: false, message: "Only administrators can delete forms." }, { status: 403 });
  if (data.slug !== undefined && !normalizeFormSlug(data.slug)) return NextResponse.json({ success: false, message: "Enter a valid form URL." }, { status: 400 });
  try {
    const form = await prisma.form.update({
      where: { id },
      data: data.action
        ? { deletedAt: data.action === "TRASH" ? new Date() : null }
        : {
            ...(data.title !== undefined && { title: data.title }),
            ...(data.slug !== undefined && { slug: normalizeFormSlug(data.slug) }),
            ...(data.description !== undefined && { description: data.description }),
            ...(data.fields !== undefined && { fields: data.fields as Prisma.InputJsonValue }),
            ...(data.settings !== undefined && { settings: data.settings as Prisma.InputJsonValue | typeof Prisma.JsonNull }),
            ...(data.styles !== undefined && { styles: data.styles as Prisma.InputJsonValue | typeof Prisma.JsonNull }),
            ...(data.status !== undefined && { status: data.status }),
          },
    });
    return NextResponse.json({ success: true, form });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ success: false, message: "That form URL is already in use." }, { status: 409 });
    }
    console.error("Update form failed:", error);
    return NextResponse.json({ success: false, message: "Unable to update form." }, { status: 500 });
  }
}
