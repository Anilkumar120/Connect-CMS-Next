-- AlterTable
ALTER TABLE `page` ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `Page_deletedAt_idx` ON `Page`(`deletedAt`);
