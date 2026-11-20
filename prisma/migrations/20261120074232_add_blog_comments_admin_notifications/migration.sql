-- CreateTable
CREATE TABLE `Comment` (
    `id` VARCHAR(191) NOT NULL,
    `postId` VARCHAR(191) NOT NULL,
    `authorName` VARCHAR(120) NOT NULL,
    `authorEmail` VARCHAR(254) NOT NULL,
    `content` TEXT NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'SPAM') NOT NULL DEFAULT 'PENDING',
    `ipHash` CHAR(64) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Comment_postId_status_createdAt_idx`(`postId`, `status`, `createdAt`),
    INDEX `Comment_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `Comment_deletedAt_idx`(`deletedAt`),
    INDEX `Comment_ipHash_createdAt_idx`(`ipHash`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdminNotification` (
    `id` VARCHAR(191) NOT NULL,
    `sourceType` VARCHAR(50) NOT NULL,
    `sourceId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `message` VARCHAR(500) NOT NULL,
    `href` VARCHAR(500) NOT NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AdminNotification_readAt_createdAt_idx`(`readAt`, `createdAt`),
    UNIQUE INDEX `AdminNotification_sourceType_sourceId_key`(`sourceType`, `sourceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Comment` ADD CONSTRAINT `Comment_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `Post`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
