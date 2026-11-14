-- CreateTable
CREATE TABLE `BuilderDocument` (
    `id` VARCHAR(191) NOT NULL,
    `documentKey` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(40) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NULL,
    `targetId` VARCHAR(191) NULL,
    `postTypeSlug` VARCHAR(100) NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `layout` JSON NOT NULL,
    `settings` JSON NULL,
    `globalStyles` JSON NULL,
    `conditions` JSON NULL,
    `legacyData` JSON NULL,
    `publishedAt` DATETIME(3) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `BuilderDocument_documentKey_key`(`documentKey`),
    INDEX `BuilderDocument_kind_status_idx`(`kind`, `status`),
    INDEX `BuilderDocument_targetId_idx`(`targetId`),
    INDEX `BuilderDocument_postTypeSlug_idx`(`postTypeSlug`),
    INDEX `BuilderDocument_slug_idx`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BuilderRevision` (
    `id` VARCHAR(191) NOT NULL,
    `documentId` VARCHAR(191) NOT NULL,
    `revisionNo` INTEGER NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `snapshot` JSON NOT NULL,
    `message` VARCHAR(500) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BuilderRevision_documentId_createdAt_idx`(`documentId`, `createdAt`),
    UNIQUE INDEX `BuilderRevision_documentId_revisionNo_key`(`documentId`, `revisionNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BuilderRevision` ADD CONSTRAINT `BuilderRevision_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `BuilderDocument`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
