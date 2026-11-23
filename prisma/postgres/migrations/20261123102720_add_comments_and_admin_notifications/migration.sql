-- Adds public post comments and admin notification storage.
-- The IF NOT EXISTS guards make this safe if either table/index was created
-- manually before this migration was added to the Prisma migration history.

DO $$
BEGIN
  CREATE TYPE "CommentStatus" AS ENUM ('PENDING', 'APPROVED', 'SPAM');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Comment" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "authorName" VARCHAR(120) NOT NULL,
  "authorEmail" VARCHAR(254) NOT NULL,
  "content" TEXT NOT NULL,
  "status" "CommentStatus" NOT NULL DEFAULT 'PENDING',
  "ipHash" CHAR(64),
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AdminNotification" (
  "id" TEXT NOT NULL,
  "sourceType" VARCHAR(50) NOT NULL,
  "sourceId" VARCHAR(191) NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "message" VARCHAR(500) NOT NULL,
  "href" VARCHAR(500) NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminNotification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AdminNotification_sourceType_sourceId_key"
  ON "AdminNotification"("sourceType", "sourceId");
CREATE INDEX IF NOT EXISTS "AdminNotification_readAt_createdAt_idx"
  ON "AdminNotification"("readAt", "createdAt");

CREATE INDEX IF NOT EXISTS "Comment_postId_status_createdAt_idx"
  ON "Comment"("postId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "Comment_status_createdAt_idx"
  ON "Comment"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Comment_deletedAt_idx"
  ON "Comment"("deletedAt");
CREATE INDEX IF NOT EXISTS "Comment_ipHash_createdAt_idx"
  ON "Comment"("ipHash", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Comment_postId_fkey'
      AND conrelid = '"Comment"'::regclass
  ) THEN
    ALTER TABLE "Comment"
      ADD CONSTRAINT "Comment_postId_fkey"
      FOREIGN KEY ("postId") REFERENCES "Post"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;