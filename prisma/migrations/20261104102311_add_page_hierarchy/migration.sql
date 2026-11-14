-- DropIndex
DROP INDEX `Page_status_idx` ON `page`;

-- DropIndex
DROP INDEX `Page_updatedAt_idx` ON `page`;

-- AlterTable
ALTER TABLE `page` ADD COLUMN `parentId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `Page_parentId_idx` ON `Page`(`parentId`);

-- AddForeignKey
ALTER TABLE `Page` ADD CONSTRAINT `Page_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `Page`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
