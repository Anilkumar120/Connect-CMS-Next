CREATE TABLE `CustomPostType` (
  `id` VARCHAR(191) NOT NULL,
  `title` VARCHAR(100) NOT NULL,
  `slug` VARCHAR(100) NOT NULL,
  `icon` VARCHAR(50) NOT NULL DEFAULT 'FileText',
  `hasCategories` BOOLEAN NOT NULL DEFAULT true,
  `hasTags` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `CustomPostType_slug_key` (`slug`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Post`
  ADD COLUMN `postTypeId` VARCHAR(191) NULL,
  ADD INDEX `Post_postTypeId_status_publishedAt_idx` (`postTypeId`, `status`, `publishedAt`),
  ADD CONSTRAINT `Post_postTypeId_fkey`
    FOREIGN KEY (`postTypeId`) REFERENCES `CustomPostType`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
