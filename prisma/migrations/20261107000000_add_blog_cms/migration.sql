CREATE TABLE `Post` (
  `id` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `slug` VARCHAR(191) NOT NULL,
  `excerpt` TEXT NULL,
  `content` JSON NULL,
  `featuredImage` VARCHAR(1000) NULL,
  `status` ENUM('DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  `seoTitle` VARCHAR(255) NULL,
  `seoDescription` TEXT NULL,
  `focusKeyword` VARCHAR(255) NULL,
  `publishedAt` DATETIME(3) NULL,
  `deletedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `Post_slug_key` (`slug`),
  INDEX `Post_status_publishedAt_idx` (`status`, `publishedAt`),
  INDEX `Post_deletedAt_idx` (`deletedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Category` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `slug` VARCHAR(180) NOT NULL,
  `description` TEXT NULL,
  `imageUrl` VARCHAR(1000) NULL,
  `parentId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `Category_slug_key` (`slug`),
  INDEX `Category_parentId_idx` (`parentId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Tag` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `slug` VARCHAR(180) NOT NULL,
  `imageUrl` VARCHAR(1000) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `Tag_slug_key` (`slug`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PostCategory` (
  `postId` VARCHAR(191) NOT NULL,
  `categoryId` VARCHAR(191) NOT NULL,
  INDEX `PostCategory_categoryId_idx` (`categoryId`),
  PRIMARY KEY (`postId`, `categoryId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PostTag` (
  `postId` VARCHAR(191) NOT NULL,
  `tagId` VARCHAR(191) NOT NULL,
  INDEX `PostTag_tagId_idx` (`tagId`),
  PRIMARY KEY (`postId`, `tagId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Category`
  ADD CONSTRAINT `Category_parentId_fkey`
  FOREIGN KEY (`parentId`) REFERENCES `Category`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `PostCategory`
  ADD CONSTRAINT `PostCategory_postId_fkey`
  FOREIGN KEY (`postId`) REFERENCES `Post`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `PostCategory_categoryId_fkey`
  FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `PostTag`
  ADD CONSTRAINT `PostTag_postId_fkey`
  FOREIGN KEY (`postId`) REFERENCES `Post`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `PostTag_tagId_fkey`
  FOREIGN KEY (`tagId`) REFERENCES `Tag`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
