-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'EDITOR', 'AUTHOR', 'CONTRIBUTOR', 'SEO_MANAGER', 'WEB_DESIGNER');

-- CreateEnum
CREATE TYPE "PageStatus" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RevisionType" AS ENUM ('DRAFT', 'PUBLISHED', 'RESTORED');

-- CreateEnum
CREATE TYPE "MenuLocation" AS ENUM ('HEADER', 'FOOTER');

-- CreateEnum
CREATE TYPE "MenuItemType" AS ENUM ('PAGE', 'CUSTOM_LINK');

-- CreateEnum
CREATE TYPE "FormStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "FormSubmissionStatus" AS ENUM ('UNREAD', 'READ', 'SPAM');

-- CreateEnum
CREATE TYPE "BuilderDocumentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PasswordResetChannel" AS ENUM ('EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "PaymentRequestStatus" AS ENUM ('REQUESTED', 'PENDING_LOOKUP');

-- CreateTable
CREATE TABLE "PaymentGatewayConfig" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "displayName" VARCHAR(120) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "publicInstructions" TEXT,
    "encryptedSettings" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentGatewayConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRequest" (
    "id" TEXT NOT NULL,
    "transactionNumber" VARCHAR(40) NOT NULL,
    "status" "PaymentRequestStatus" NOT NULL DEFAULT 'PENDING_LOOKUP',
    "customerName" VARCHAR(160) NOT NULL,
    "accountNumber" VARCHAR(80) NOT NULL,
    "email" VARCHAR(254),
    "phone" VARCHAR(32),
    "amount" DECIMAL(12,2) NOT NULL,
    "gatewayCode" VARCHAR(50) NOT NULL,
    "gatewayName" VARCHAR(120) NOT NULL,
    "privacyConsent" BOOLEAN NOT NULL DEFAULT false,
    "providerTransactionId" VARCHAR(191),
    "providerStatus" VARCHAR(100),
    "providerResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "email" TEXT NOT NULL,
    "phone" VARCHAR(32),
    "avatarUrl" VARCHAR(1000),
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'EDITOR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetOtp" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "channel" "PasswordResetChannel" NOT NULL,
    "recipientHash" CHAR(64) NOT NULL,
    "requestIpHash" CHAR(64) NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetOtp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Page" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "content" JSONB,
    "status" "PageStatus" NOT NULL DEFAULT 'DRAFT',
    "seoTitle" VARCHAR(255),
    "seoDescription" TEXT,
    "canonicalUrl" VARCHAR(500),
    "focusKeyword" VARCHAR(255),
    "metaRobots" TEXT DEFAULT 'index,follow',
    "parentId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "postTypeId" TEXT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT,
    "content" JSONB,
    "featuredImage" VARCHAR(1000),
    "status" "PageStatus" NOT NULL DEFAULT 'DRAFT',
    "seoTitle" VARCHAR(255),
    "seoDescription" TEXT,
    "focusKeyword" VARCHAR(255),
    "publishedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomPostType" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "icon" VARCHAR(50) NOT NULL DEFAULT 'FileText',
    "hasCategories" BOOLEAN NOT NULL DEFAULT true,
    "hasTags" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomPostType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "description" TEXT,
    "imageUrl" VARCHAR(1000),
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "imageUrl" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostCategory" (
    "postId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "PostCategory_pkey" PRIMARY KEY ("postId","categoryId")
);

-- CreateTable
CREATE TABLE "PostTag" (
    "postId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "PostTag_pkey" PRIMARY KEY ("postId","tagId")
);

-- CreateTable
CREATE TABLE "ContentRevision" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "userId" TEXT,
    "type" "RevisionType" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "content" JSONB,
    "message" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" BIGINT NOT NULL,
    "filePath" VARCHAR(1000) NOT NULL,
    "altText" VARCHAR(500),
    "title" VARCHAR(255),
    "caption" VARCHAR(500),
    "description" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Menu" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "location" "MenuLocation",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Menu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL,
    "menuId" TEXT NOT NULL,
    "label" VARCHAR(150) NOT NULL,
    "type" "MenuItemType" NOT NULL,
    "url" VARCHAR(1000),
    "target" VARCHAR(20) NOT NULL DEFAULT '_self',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "pageId" TEXT,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Form" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "fields" JSONB NOT NULL,
    "settings" JSONB,
    "styles" JSONB,
    "status" "FormStatus" NOT NULL DEFAULT 'DRAFT',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Form_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormSubmission" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "status" "FormSubmissionStatus" NOT NULL DEFAULT 'UNREAD',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderDocument" (
    "id" TEXT NOT NULL,
    "documentKey" VARCHAR(191) NOT NULL,
    "kind" VARCHAR(40) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255),
    "targetId" VARCHAR(191),
    "postTypeSlug" VARCHAR(100),
    "status" "BuilderDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "layout" JSONB NOT NULL,
    "settings" JSONB,
    "globalStyles" JSONB,
    "conditions" JSONB,
    "legacyData" JSONB,
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuilderDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderRevision" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "revisionNo" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "message" VARCHAR(500),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuilderRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentGatewayConfig_code_key" ON "PaymentGatewayConfig"("code");

-- CreateIndex
CREATE INDEX "PaymentGatewayConfig_enabled_idx" ON "PaymentGatewayConfig"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRequest_transactionNumber_key" ON "PaymentRequest"("transactionNumber");

-- CreateIndex
CREATE INDEX "PaymentRequest_createdAt_idx" ON "PaymentRequest"("createdAt");

-- CreateIndex
CREATE INDEX "PaymentRequest_accountNumber_idx" ON "PaymentRequest"("accountNumber");

-- CreateIndex
CREATE INDEX "PaymentRequest_email_idx" ON "PaymentRequest"("email");

-- CreateIndex
CREATE INDEX "PaymentRequest_phone_idx" ON "PaymentRequest"("phone");

-- CreateIndex
CREATE INDEX "PaymentRequest_gatewayCode_createdAt_idx" ON "PaymentRequest"("gatewayCode", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentRequest_status_createdAt_idx" ON "PaymentRequest"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- CreateIndex
CREATE INDEX "PasswordResetOtp_recipientHash_channel_createdAt_idx" ON "PasswordResetOtp"("recipientHash", "channel", "createdAt");

-- CreateIndex
CREATE INDEX "PasswordResetOtp_requestIpHash_createdAt_idx" ON "PasswordResetOtp"("requestIpHash", "createdAt");

-- CreateIndex
CREATE INDEX "PasswordResetOtp_userId_idx" ON "PasswordResetOtp"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Page_slug_key" ON "Page"("slug");

-- CreateIndex
CREATE INDEX "Page_parentId_idx" ON "Page"("parentId");

-- CreateIndex
CREATE INDEX "Page_deletedAt_idx" ON "Page"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Post_slug_key" ON "Post"("slug");

-- CreateIndex
CREATE INDEX "Post_status_publishedAt_idx" ON "Post"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "Post_deletedAt_idx" ON "Post"("deletedAt");

-- CreateIndex
CREATE INDEX "Post_postTypeId_status_publishedAt_idx" ON "Post"("postTypeId", "status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CustomPostType_slug_key" ON "CustomPostType"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

-- CreateIndex
CREATE INDEX "PostCategory_categoryId_idx" ON "PostCategory"("categoryId");

-- CreateIndex
CREATE INDEX "PostTag_tagId_idx" ON "PostTag"("tagId");

-- CreateIndex
CREATE INDEX "ContentRevision_pageId_createdAt_idx" ON "ContentRevision"("pageId", "createdAt");

-- CreateIndex
CREATE INDEX "ContentRevision_userId_idx" ON "ContentRevision"("userId");

-- CreateIndex
CREATE INDEX "MediaAsset_mimeType_idx" ON "MediaAsset"("mimeType");

-- CreateIndex
CREATE INDEX "MediaAsset_isDeleted_idx" ON "MediaAsset"("isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "SiteSetting_key_key" ON "SiteSetting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Menu_location_key" ON "Menu"("location");

-- CreateIndex
CREATE INDEX "Menu_name_idx" ON "Menu"("name");

-- CreateIndex
CREATE INDEX "MenuItem_menuId_sortOrder_idx" ON "MenuItem"("menuId", "sortOrder");

-- CreateIndex
CREATE INDEX "MenuItem_parentId_idx" ON "MenuItem"("parentId");

-- CreateIndex
CREATE INDEX "MenuItem_pageId_idx" ON "MenuItem"("pageId");

-- CreateIndex
CREATE UNIQUE INDEX "Form_slug_key" ON "Form"("slug");

-- CreateIndex
CREATE INDEX "Form_status_updatedAt_idx" ON "Form"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "Form_deletedAt_idx" ON "Form"("deletedAt");

-- CreateIndex
CREATE INDEX "FormSubmission_formId_createdAt_idx" ON "FormSubmission"("formId", "createdAt");

-- CreateIndex
CREATE INDEX "FormSubmission_status_idx" ON "FormSubmission"("status");

-- CreateIndex
CREATE INDEX "FormSubmission_deletedAt_idx" ON "FormSubmission"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BuilderDocument_documentKey_key" ON "BuilderDocument"("documentKey");

-- CreateIndex
CREATE INDEX "BuilderDocument_kind_status_idx" ON "BuilderDocument"("kind", "status");

-- CreateIndex
CREATE INDEX "BuilderDocument_targetId_idx" ON "BuilderDocument"("targetId");

-- CreateIndex
CREATE INDEX "BuilderDocument_postTypeSlug_idx" ON "BuilderDocument"("postTypeSlug");

-- CreateIndex
CREATE INDEX "BuilderDocument_slug_idx" ON "BuilderDocument"("slug");

-- CreateIndex
CREATE INDEX "BuilderRevision_documentId_createdAt_idx" ON "BuilderRevision"("documentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BuilderRevision_documentId_revisionNo_key" ON "BuilderRevision"("documentId", "revisionNo");

-- AddForeignKey
ALTER TABLE "PasswordResetOtp" ADD CONSTRAINT "PasswordResetOtp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Page" ADD CONSTRAINT "Page_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Page"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_postTypeId_fkey" FOREIGN KEY ("postTypeId") REFERENCES "CustomPostType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostCategory" ADD CONSTRAINT "PostCategory_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostCategory" ADD CONSTRAINT "PostCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostTag" ADD CONSTRAINT "PostTag_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostTag" ADD CONSTRAINT "PostTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentRevision" ADD CONSTRAINT "ContentRevision_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentRevision" ADD CONSTRAINT "ContentRevision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuilderRevision" ADD CONSTRAINT "BuilderRevision_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "BuilderDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
